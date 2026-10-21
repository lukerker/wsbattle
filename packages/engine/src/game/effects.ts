// 效果系統：把卡片資料（時機＋條件＋費用＋動作）實際執行出來。
// 〔 〕為總合規則編號。持續效果不儲存，每次現場計算〔8.9〕；需要玩家選擇時暫停，等回應後從同一步繼續。
import type { Ability, Amount, Card, CardFilter, Condition, Cost, Effect, Selector, TriggerIcon, Zone as SchemaZone } from '../card-schema.ts';
import { RESPONSE_SECONDS, type Frame, type FrameCtx, type GameEvent, type GameState, type GameZone, type InternalOp, type Pending, type PlayerId, type Slot, type StandbyAbility, type Step } from './types.ts';

export interface Ctx {
  s: GameState;
  ev: GameEvent[];
}

export interface MoveOpts {
  toPlayer?: PlayerId;
  slot?: Slot;
  fromSlot?: Slot;
  state?: 'stand' | 'rest';
  deckTop?: boolean;
}

// 效果系統需要的引擎功能
export interface Core {
  cardOf(s: GameState, uid: string): Card;
  move(ctx: Ctx, uid: string, p: PlayerId, from: GameZone, to: GameZone, opts?: MoveOpts): void;
  then(s: GameState, ...steps: Step[]): void;
  drawOne(ctx: Ctx, p: PlayerId): boolean;
  refreshIfNeeded(ctx: Ctx, p: PlayerId): void;
  shuffle(ctx: Ctx, p: PlayerId): void;
  payStock(ctx: Ctx, p: PlayerId, n: number): void;
}

// 所有角色預設都有的「安可［③］」〔10.2.3〕
export const DEFAULT_ENCORE: Ability = {
  kind: 'auto',
  keyword: { id: 'encore' },
  trigger: { event: 'sourceLeavesStageToWaitingRoom' },
  optional: true,
  cost: [{ kind: 'stock', n: 3 }],
  effects: [{ op: 'returnSourceToSlot', state: 'rest' }],
  text: { ja: '【自】アンコール［③］', zh: '【自】安可［③］（付 3 能量，橫置回到原本的格子）' },
};

const ZONE: Record<Exclude<SchemaZone, 'marker'>, GameZone> = {
  hand: 'hand', deck: 'deck', waitingRoom: 'waiting', stage: 'stage', stock: 'stock', clock: 'clock', level: 'level', climaxZone: 'climax', memory: 'memory',
};
const ZONES: GameZone[] = ['deck', 'hand', 'waiting', 'clock', 'level', 'stock', 'climax', 'memory', 'resolution'];
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const FRONT_OF: Record<number, Slot[]> = { 3: [0, 1], 4: [1, 2] }; // 後列的「前」〔3.6.5〕
const ALL_SLOTS: Slot[] = [0, 1, 2, 3, 4];

type Done = 'done' | 'wait' | 'abort' | Step[];
type Rule = NonNullable<Ability['rules']>[number];
// 「場上以外的區域」生效的能力：哪個區域的卡、是哪個 activeIn
type Source = { uid: string; abilities: Ability[] };

export function createEffects(core: Core) {
  const { cardOf } = core;

  // ── 卡在哪裡 ──
  function locate(s: GameState, uid: string): { p: PlayerId; zone: GameZone; slot?: Slot } | null {
    for (const p of [0, 1] as PlayerId[]) {
      const pl = s.players[p];
      const slot = pl.stage.findIndex((c) => c?.uid === uid);
      if (slot >= 0) return { p, zone: 'stage', slot: slot as Slot };
      for (const z of ZONES) if ((pl[z as Exclude<GameZone, 'stage'>] as string[]).includes(uid)) return { p, zone: z };
    }
    return null;
  }
  const onStage = (s: GameState, uid: string) => locate(s, uid)?.zone === 'stage';
  const ownerOf = (s: GameState, uid: string): PlayerId => locate(s, uid)?.p ?? s.cards[uid]!.owner;
  // 標記：在哪張角色下面
  const markerHost = (s: GameState, uid: string) => Object.keys(s.markers).find((h) => s.markers[h]!.some((m) => m.uid === uid));

  // ── 能力：卡片本身＋持續效果給予的＋「那個回合中」給予的 ──
  function abilitiesOf(s: GameState, uid: string): Ability[] {
    const granted: Ability[] = [];
    for (const a of activeContinuous(s)) {
      for (const e of a.ability.effects) {
        if (e.op === 'grantAbility' && e.duration === 'whileActive' && targets(s, e.target, a.src, a.controller, {}).includes(uid)) granted.push(e.ability);
      }
    }
    return [...cardOf(s, uid).abilities, ...granted, ...s.grants.filter((g) => g.uid === uid).map((g) => g.ability)];
  }

  // 目前有效的【永】能力：舞台上的角色、名場面區的名場面〔2.12.2〕，加上給予舞台角色的【永】
  let contDepth = 0; // 計算中再算等級時，用卡上印的等級（避免無窮遞迴）
  function activeContinuous(s: GameState): { src: string; controller: PlayerId; ability: Ability }[] {
    contDepth++;
    try {
      const out: { src: string; controller: PlayerId; ability: Ability }[] = [];
      const ok = (uid: string, p: PlayerId, ability: Ability, slot: number) => {
        if (ability.kind !== 'continuous' || ability.activeIn) return;
        if (ability.keyword?.id === 'assist' && slot >= 0 && slot < 3) return; // 應援只在後列有效〔10.3.2〕
        if (ability.condition && !condOk(s, ability.condition, uid, p, {})) return;
        out.push({ src: uid, controller: p, ability });
      };
      for (const p of [0, 1] as PlayerId[]) {
        const pl = s.players[p];
        pl.stage.forEach((c, slot) => { if (c) for (const a of cardOf(s, c.uid).abilities) ok(c.uid, p, a, slot); });
        for (const uid of pl.climax) for (const a of cardOf(s, uid).abilities) ok(uid, p, a, -1);
      }
      // 給予的【永】（卡上印的【永】給予的、「那個回合中」給予的）
      const base = [...out];
      for (const a of base) {
        for (const e of a.ability.effects) {
          if (e.op !== 'grantAbility' || e.duration !== 'whileActive' || e.ability.kind !== 'continuous') continue;
          for (const u of candidates(s, e.target, a.src, a.controller, {})) {
            const loc = locate(s, u);
            if (loc?.zone === 'stage') ok(u, loc.p, e.ability, loc.slot!);
          }
        }
      }
      for (const g of s.grants) {
        const loc = locate(s, g.uid);
        if (loc?.zone === 'stage') ok(g.uid, loc.p, g.ability, loc.slot!);
      }
      return out;
    } finally {
      contDepth--;
    }
  }
  const hasRule = (s: GameState, uid: string, rule: Rule) => activeContinuous(s).some((a) => a.src === uid && a.ability.rules?.includes(rule));

  // 等級：名場面算 0；舞台上的角色加上【永】的等級增減；手牌的卡加上自己「手牌中等級－1」的能力
  function levelOf(s: GameState, uid: string): number {
    const c = cardOf(s, uid);
    if (c.type === 'climax') return 0;
    let n = c.level ?? 0;
    if (contDepth > 0) return n;
    const loc = locate(s, uid);
    if (loc?.zone === 'stage') {
      for (const a of activeContinuous(s)) {
        for (const e of a.ability.effects) if (e.op === 'modifyLevel' && targets(s, e.target, a.src, a.controller, {}).includes(uid)) n += e.amount;
      }
    } else if (loc?.zone === 'hand') {
      contDepth++;
      try {
        for (const a of c.abilities) {
          if (a.kind !== 'continuous' || a.activeIn !== 'hand' || (a.condition && !condOk(s, a.condition, uid, loc.p, {}))) continue;
          for (const e of a.effects) if (e.op === 'modifyLevel') n += e.amount;
        }
      } finally {
        contDepth--;
      }
    }
    return Math.max(0, n);
  }

  // 判定圖示：卡上印的＋【永】「得到判定圖示」（所有區域都有效，例如判定時翻到的卡）
  function triggersOf(s: GameState, uid: string): TriggerIcon[] {
    const c = cardOf(s, uid);
    const out = [...c.triggers];
    for (const a of c.abilities) {
      if (a.kind !== 'continuous' || (a.condition && !condOk(s, a.condition, uid, ownerOf(s, uid), {}))) continue;
      for (const e of a.effects) if (e.op === 'gainTrigger') out.push(e.icon);
    }
    return out;
  }

  // ── 條件 ──
  function facingOf(s: GameState, src: string): { p: PlayerId; slot: Slot } | null {
    const p = ownerOf(s, src);
    const slot = s.players[p].stage.findIndex((x) => x?.uid === src);
    return slot >= 0 && slot < 3 ? { p: other(p), slot: (2 - slot) as Slot } : null;
  }
  function condOk(s: GameState, c: Condition, src: string, controller: PlayerId, fctx: FrameCtx): boolean {
    const pl = s.players[controller];
    switch (c.kind) {
      case 'all':
        return c.of.every((x) => condOk(s, x, src, controller, fctx));
      case 'any':
        return c.of.some((x) => condOk(s, x, src, controller, fctx));
      case 'not':
        return !condOk(s, c.of, src, controller, fctx);
      case 'myTurn':
        return s.turnPlayer === controller;
      case 'stockAtMost':
        return pl.stock.length <= c.n;
      case 'countAtLeast':
        return candidates(s, c.selector, src, controller, fctx).length >= c.n;
      case 'countAtMost':
        return candidates(s, c.selector, src, controller, fctx).length <= c.n;
      case 'noOthers':
        return candidates(s, c.selector, src, controller, fctx).length === 0;
      case 'climaxInZone':
        return pl.climax.some((u) => c.name === undefined || cardOf(s, u).name.ja === c.name);
      case 'opponentClimaxInZone':
        return s.players[other(controller)].climax.length > 0;
      case 'sourceInSlot':
        return c.slots.includes(pl.stage.findIndex((x) => x?.uid === src));
      case 'opponentInFront': {
        const f = facingOf(s, src);
        return !!f && !!s.players[f.p].stage[f.slot];
      }
      case 'opponentInFrontLevel': {
        const f = facingOf(s, src);
        const opp = f ? s.players[f.p].stage[f.slot] : null;
        return !!opp && levelOf(s, opp.uid) === c.level;
      }
      case 'opponentInFrontCostAtLeast': {
        const f = facingOf(s, src);
        const opp = f ? s.players[f.p].stage[f.slot] : null;
        return !!opp && (cardOf(s, opp.uid).cost ?? 0) >= c.n;
      }
      case 'frontAbsentOrReversed': {
        const f = facingOf(s, src);
        const opp = f ? s.players[f.p].stage[f.slot] : null;
        return !!f && (!opp || opp.state === 'reverse');
      }
      case 'placedThisTurnFromHand':
        return s.placedThisTurn.includes(src) && onStage(s, src);
      case 'battleOpponentLevelAtMost': {
        const opp = battleOpponent(s, src, fctx);
        return !!opp && levelOf(s, opp) <= c.n;
      }
      case 'battleOpponentAboveItsLevel': {
        const opp = battleOpponent(s, src, fctx);
        return !!opp && levelOf(s, opp) > s.players[ownerOf(s, opp)].level.length;
      }
      case 'levelAtLeast':
        return pl.level.length >= c.n;
      case 'handAtLeast':
        return pl.hand.length >= c.n;
      case 'handAtMost':
        return pl.hand.length <= c.n;
      case 'allMine':
        return pl.stage.every((x) => !x || filterOk(s, x.uid, c.filter, src));
      case 'levelZoneSumAtLeast':
        return pl.level.reduce((n, u) => n + levelOf(s, u), 0) >= c.n;
      case 'opponentFrontClear':
        return ([0, 1, 2] as Slot[]).every((i) => { const x = s.players[other(controller)].stage[i]; return !x || x.state === 'reverse'; });
      case 'attackMode':
        return s.attack?.mode === c.mode;
      case 'hasMarker':
        return (s.markers[src] ?? []).length > 0;
      case 'phase':
        return s.phase === c.phase;
      case 'xAtLeast':
        return (fctx.x ?? 0) >= c.n;
    }
  }

  function battleOpponent(s: GameState, src: string, fctx: FrameCtx): string | undefined {
    const a = s.attack;
    if (a && a.mode === 'front') {
      if (a.attacker === src && a.defender) return a.defender;
      if (a.defender === src) return a.attacker;
    }
    return fctx.battleOpp;
  }

  // ── 選卡的候選 ──
  function filterOk(s: GameState, uid: string, f: CardFilter | undefined, src: string, x?: number): boolean {
    if (!f) return true;
    const c = cardOf(s, uid);
    if (f.anyOf && !f.anyOf.some((y) => filterOk(s, uid, y, src, x))) return false;
    if (f.nameIncludes && !f.nameIncludes.some((n) => c.name.ja.includes(n))) return false;
    if (f.names && !f.names.includes(c.name.ja)) return false;
    if (f.levelAtMostPlayerLevel) {
      const owner = ownerOf(s, src);
      if (levelOf(s, uid) > s.players[owner].level.length) return false;
    }
    if (f.levelAtLeast !== undefined && levelOf(s, uid) < f.levelAtLeast) return false;
    if (f.levelAtMost !== undefined && levelOf(s, uid) > f.levelAtMost) return false;
    if (f.levelAtMostX && levelOf(s, uid) > (x ?? 0)) return false;
    if (f.levelAboveOwnerLevel && levelOf(s, uid) <= s.players[ownerOf(s, uid)].level.length) return false;
    if (f.hasTrigger && !triggersOf(s, uid).includes(f.hasTrigger)) return false;
    if (f.type && c.type !== f.type) return false;
    if (f.color && c.color !== f.color) return false;
    if (f.trait && !c.traits.some((t) => t.ja === f.trait)) return false;
    if (f.name && c.name.ja !== f.name) return false;
    if (f.costAtMost !== undefined && (c.cost ?? 0) > f.costAtMost) return false;
    if (f.costAtLeast !== undefined && (c.cost ?? 0) < f.costAtLeast) return false;
    if (f.excludeSource && uid === src) return false;
    return true;
  }

  function candidates(s: GameState, sel: Selector, src: string, controller: PlayerId, fctx: FrameCtx): string[] {
    const p = sel.side === 'self' ? controller : other(controller);
    const pl = s.players[p];
    let list: string[];
    if (sel.zone === 'stage') {
      let slots = pl.stage.flatMap((c, i) => (c ? [{ c, i }] : []));
      if (sel.filter?.row === 'front') slots = slots.filter((x) => x.i < 3);
      if (sel.filter?.row === 'back') slots = slots.filter((x) => x.i >= 3);
      if (sel.state) slots = slots.filter((x) => x.c.state === sel.state);
      if (sel.relation === 'source') slots = slots.filter((x) => x.c.uid === src);
      if (sel.relation === 'triggerTarget') slots = slots.filter((x) => x.c.uid === fctx.target);
      if (sel.relation === 'frontOfSource') {
        const srcSlot = pl.stage.findIndex((c) => c?.uid === src);
        const front = FRONT_OF[srcSlot] ?? [];
        slots = slots.filter((x) => front.includes(x.i as Slot));
      }
      if (sel.relation === 'facingSource') {
        const f = facingOf(s, src);
        slots = slots.filter((x) => f && f.p === p && x.i === f.slot);
      }
      if (sel.relation === 'inBattleWithSource') {
        // 自己在戰鬥中的角色（助太刀：被正打的角色）
        const a = s.attack;
        const mine = a && a.mode === 'front' ? (s.turnPlayer === p ? a.attacker : a.defender) : null;
        slots = slots.filter((x) => x.c.uid === mine);
      }
      if (sel.relation === 'battleOpponentOfSource') {
        const opp = battleOpponent(s, src, fctx);
        slots = slots.filter((x) => x.c.uid === opp);
      }
      list = slots.map((x) => x.c.uid);
    } else if (sel.zone === 'marker') {
      list = (s.markers[src] ?? []).map((m) => m.uid);
    } else {
      const zone = ZONE[sel.zone] as Exclude<GameZone, 'stage'>;
      list = [...(pl[zone] as string[])];
      if (sel.zone === 'deck' && sel.fromTop !== undefined) list = list.slice(0, sel.fromTop);
      if (sel.position === 'top' && sel.zone !== 'deck') list = list.slice(-1);
      if (sel.position === 'bottom' && sel.zone !== 'deck') list = list.slice(0, 1);
      if (sel.fromTop !== undefined && sel.zone !== 'deck') list = list.slice(-sel.fromTop);
      if (sel.relation === 'source') list = list.filter((u) => u === src);
      if (sel.relation === 'triggerTarget') list = list.filter((u) => u === fctx.target);
    }
    return list.filter((u) => filterOk(s, u, sel.filter, src, fctx.x));
  }
  const targets = candidates; // 【永】的對象一律是「全部」

  // ── 數值 ──
  function amountOf(s: GameState, amt: Amount, src: string, controller: PlayerId, binds: Record<string, string[]>, target?: string, fctx: FrameCtx = {}): number {
    if (typeof amt === 'number') return amt;
    if ('per' in amt) return candidates(s, amt.per, src, controller, fctx).length * amt.multiplier;
    if ('perSoulOf' in amt) return candidates(s, amt.perSoulOf, src, controller, fctx).reduce((n, u) => n + soul(s, u), 0) * amt.multiplier;
    if ('perSoulOfBound' in amt) return (binds[amt.perSoulOfBound] ?? []).reduce((n, u) => n + soul(s, u), 0) * amt.multiplier;
    if ('countOfBound' in amt) return Math.floor((binds[amt.countOfBound] ?? []).filter((u) => filterOk(s, u, amt.filter, src, fctx.x)).length / (amt.divideBy ?? 1));
    if ('perLevelOfTarget' in amt) return target ? levelOf(s, target) * amt.multiplier : 0;
    if ('x' in amt) return (fctx.x ?? 0) * (amt.multiplier ?? 1);
    if ('levelSumOfBound' in amt) return (binds[amt.levelSumOfBound] ?? []).reduce((n, u) => n + levelOf(s, u), 0);
    if ('distinctMarkerNames' in amt) return new Set((s.markers[src] ?? []).map((m) => cardOf(s, m.uid).name.ja)).size;
    return 0;
  }

  // 攻擊力：基礎值＋【永】加成＋「那個回合中」加成〔8.9.1〕
  function power(s: GameState, uid: string): number {
    let n = cardOf(s, uid).power ?? 0;
    for (const a of activeContinuous(s)) {
      for (const e of a.ability.effects) {
        if (e.op === 'modifyPower' && e.duration === 'whileActive' && targets(s, e.target, a.src, a.controller, {}).includes(uid)) n += amountOf(s, e.amount, a.src, a.controller, {}, uid);
      }
    }
    return n + s.mods.filter((m) => m.uid === uid).reduce((x, m) => x + m.power, 0);
  }
  function soul(s: GameState, uid: string): number {
    let n = cardOf(s, uid).soul ?? 0;
    for (const a of activeContinuous(s)) {
      for (const e of a.ability.effects) {
        if (e.op === 'modifySoul' && e.duration === 'whileActive' && targets(s, e.target, a.src, a.controller, {}).includes(uid)) n += e.amount;
      }
    }
    return n + s.mods.filter((m) => m.uid === uid).reduce((x, m) => x + m.soul, 0);
  }

  // ── 費用〔8.4〕：一部分付不起就完全不能付 ──
  const need = (sel: Selector) => (sel.count === 'all' ? 0 : 'exactly' in sel.count ? sel.count.exactly : 0);
  function costPayable(s: GameState, costs: Cost[], src: string, controller: PlayerId): boolean {
    const pl = s.players[controller];
    let stock = 0;
    for (const c of costs) {
      if (c.kind === 'stock') stock += c.n;
      if (c.kind === 'restSource' && pl.stage.find((x) => x?.uid === src)?.state !== 'stand') return false;
      if (c.kind === 'discardSource' && !pl.hand.includes(src)) return false;
      if ((c.kind === 'sendSourceToWaitingRoom' || c.kind === 'sourceToDeckBottom' || c.kind === 'returnSourceToHand') && !onStage(s, src)) return false;
      if (c.kind === 'sourceToMemory' && !pl.hand.includes(src) && !onStage(s, src)) return false;
      if (c.kind === 'deckTopToClock' && pl.deck.length + pl.waiting.length === 0) return false;
      if (c.kind === 'handToClock' && pl.hand.filter((u) => u !== src).length < 1) return false;
      if (c.kind === 'discard' || c.kind === 'rest' || c.kind === 'reveal' || c.kind === 'handToDeckBottom') {
        const cands = candidates(s, c.selector, src, controller, {}).filter((u) => !(c.kind !== 'rest' && u === src));
        if (cands.length < need(c.selector)) return false;
      }
    }
    // 「手札とストックすべて」這類 all 的費用不影響付不付得起；能量要另外夠付
    return pl.stock.length >= stock;
  }
  const costOps = (costs: Cost[]): (Effect | InternalOp)[] =>
    costs.map((c): Effect | InternalOp => {
      switch (c.kind) {
        case 'stock': return { op: '_payStock', n: c.n };
        case 'restSource': return { op: '_restSource' };
        case 'discard': return { op: '_discard', selector: c.selector, ...(c.bind ? { bind: c.bind } : {}) };
        case 'discardSource': return { op: '_discardSource' };
        case 'sendSourceToWaitingRoom': return { op: '_sendSourceToWR' };
        case 'rest': return { op: '_rest', selector: c.selector };
        case 'sourceToDeckBottom': return { op: '_sourceToDeckBottom' };
        case 'sourceToMemory': return { op: 'sourceToMemory' };
        case 'deckTopToClock': return { op: '_deckTopToClock' };
        case 'handToClock': return { op: '_handToClock' };
        case 'reveal': return { op: '_reveal', selector: c.selector };
        case 'handToDeckBottom': return { op: '_handToDeckBottom', selector: c.selector };
        case 'returnSourceToHand': return { op: '_returnSourceToHand' };
      }
    });

  // ── 誘發：把自動能力放進待機〔8.7.2〕──
  function standby(s: GameState, src: string, controller: PlayerId, ability: Ability, fctx: FrameCtx) {
    s.standby.push({ id: s.nextId++, src, controller, ability, ctx: fctx });
  }

  // 與特定一張卡有關的誘發（此卡攻擊時、此卡倒置時…）
  function fireFor(s: GameState, uid: string, event: string, fctx: FrameCtx = {}, abilities?: Ability[], controller?: PlayerId) {
    const who = controller ?? ownerOf(s, uid);
    for (const a of abilities ?? abilitiesOf(s, uid)) if (a.kind === 'auto' && (a.trigger?.event === event || a.alsoOn?.event === event)) standby(s, uid, who, a, fctx);
  }

  // 玩家 p 的能力來源：舞台上的角色（不含 activeIn 的能力），以及在其他區域生效的能力（休息室、回憶區、傷害區）
  function sources(s: GameState, p: PlayerId): Source[] {
    const pl = s.players[p];
    const out: Source[] = [];
    for (const c of pl.stage) if (c) out.push({ uid: c.uid, abilities: abilitiesOf(s, c.uid).filter((a) => !a.activeIn) });
    const zoned = (uids: string[], zone: Ability['activeIn']) => {
      for (const uid of uids) {
        const abilities = cardOf(s, uid).abilities.filter((a) => a.activeIn === zone);
        if (abilities.length) out.push({ uid, abilities });
      }
    };
    zoned(pl.waiting, 'waitingRoom');
    zoned(pl.memory, 'memory');
    zoned(pl.clock, 'clock');
    zoned(pl.clock.slice(-1), 'clockTop');
    return out;
  }

  // 與時點有關的誘發：檢查雙方的能力來源。card：名場面放置時是那張名場面，判定時是翻出來的卡，其他角色的事件是那張角色
  type GlobalEvent = 'climaxPlaced' | 'encoreStepStart' | 'myClimaxPhaseStart' | 'opponentAttackPhaseStart' | 'myTriggerChecked' | 'myMainPhaseStart' | 'myAttackPhaseStart';
  function fireGlobal(s: GameState, event: GlobalEvent, card?: string) {
    for (const p of [s.turnPlayer, other(s.turnPlayer)]) {
      for (const src of sources(s, p)) {
        for (const a of src.abilities) {
          const t = a.trigger;
          if (a.kind !== 'auto' || !t || t.event !== event) continue;
          if (t.event === 'climaxPlaced') {
            const owner = locate(s, card!)?.p;
            if ((t.side === 'self') !== (owner === p)) continue;
            if (!filterOk(s, card!, t.filter, src.uid)) continue;
          }
          if (t.event === 'myTriggerChecked' && (s.turnPlayer !== p || !filterOk(s, card!, t.filter, src.uid))) continue;
          if (t.event === 'encoreStepStart' && t.side === 'self' && s.turnPlayer !== p) continue;
          if (t.event === 'encoreStepStart' && t.side === 'opponent' && s.turnPlayer === p) continue;
          if ((t.event === 'myClimaxPhaseStart' || t.event === 'myMainPhaseStart' || t.event === 'myAttackPhaseStart') && s.turnPlayer !== p) continue;
          if (t.event === 'opponentAttackPhaseStart' && s.turnPlayer === p) continue;
          standby(s, src.uid, p, a, {});
        }
      }
    }
  }

  // 「你的其他角色…時」：同一個玩家的其他能力來源（card＝那張角色，記在 ctx.target）
  type AllyEvent = 'allyFrontAttacked' | 'allyAttacks' | 'allyPlacedFromHand' | 'allyReversed' | 'allyLeavesStageToWaitingRoom';
  function fireAlly(s: GameState, p: PlayerId, event: AllyEvent, card: string, fctx: FrameCtx = {}) {
    for (const src of sources(s, p)) {
      if (src.uid === card) continue;
      for (const a of src.abilities) {
        const t = a.trigger;
        if (a.kind === 'auto' && t?.event === event && filterOk(s, card, 'filter' in t ? t.filter : undefined, src.uid)) standby(s, src.uid, p, a, { ...fctx, target: card });
      }
    }
  }
  const fireAllyFrontAttacked = (s: GameState, defender: string) => fireAlly(s, ownerOf(s, defender), 'allyFrontAttacked', defender);
  // 離開的角色已經不在舞台上，用它的主人
  const fireAllyLeaves = (s: GameState, uid: string, p: PlayerId, slot: Slot) => fireAlly(s, p, 'allyLeavesStageToWaitingRoom', uid, { slot });
  // 「你使用【起】時」（助太刀也是【起】）、「你使用集中、名場面進休息室時」：使用的玩家的能力來源
  function fireMine(s: GameState, p: PlayerId, event: 'usedActivated' | 'concentrateHitClimax') {
    for (const src of sources(s, p)) for (const a of src.abilities) if (a.kind === 'auto' && a.trigger?.event === event) standby(s, src.uid, p, a, {});
  }
  const fireUsedActivated = (s: GameState, p: PlayerId) => fireMine(s, p, 'usedActivated');

  // 「1 回合 N 次」的能力：用卡和能力原文辨認（給予的能力也一樣）
  const onceKey = (uid: string, a: Ability) => `${uid}|${a.text.ja}`;

  // ── 自動能力開始解決 ──
  const newFrame = (s: GameState, src: string, controller: PlayerId, effects: Frame['effects'], fctx: FrameCtx, auto = false): Frame => ({
    src, controller, label: cardOf(s, src).name.zh, effects, i: 0, binds: {}, ctx: fctx, tmp: {}, ...(auto ? { auto } : {}),
  });

  // 在其他區域生效的能力：那張卡還在那個區域
  function stillActive(s: GameState, w: StandbyAbility): boolean {
    const pl = s.players[w.controller];
    switch (w.ability.activeIn) {
      case 'waitingRoom': return pl.waiting.includes(w.src);
      case 'memory': return pl.memory.includes(w.src);
      case 'clock': return pl.clock.includes(w.src);
      case 'clockTop': return pl.clock.at(-1) === w.src;
      default: return true;
    }
  }

  // 這個待機的能力解決時會不會真的做事（條件、費用、安可的對象還在不在）
  function viable(s: GameState, w: StandbyAbility): boolean {
    const a = w.ability;
    if (a.perTurn && s.usedOnce.filter((k) => k === onceKey(w.src, a)).length >= a.perTurn) return false;
    if (!stillActive(s, w)) return false;
    // 安可：卡已經不在休息室、或原本的格子被占用，就沒有意義〔10.2.2〕
    if (a.keyword?.id === 'encore' && (!s.players[w.controller].waiting.includes(w.src) || w.ctx.slot === undefined || s.players[w.controller].stage[w.ctx.slot])) return false;
    if (a.condition && !condOk(s, a.condition, w.src, w.controller, w.ctx)) return false;
    if (a.cost && !costPayable(s, a.cost, w.src, w.controller)) return false;
    // 只有「移到前列空格」的能力：自己不在舞台上、或前列沒有空格，就沒有可以做的事，不問玩家
    if (a.effects.length > 0 && a.effects.every((e) => e.op === 'moveSourceToSlot')) {
      const stage = s.players[w.controller].stage;
      if (!stage.some((c) => c?.uid === w.src) || ([0, 1, 2] as const).every((i) => stage[i])) return false;
    }
    // 只有「把那張角色放回原本的格子」：那張角色已經不在休息室、或格子被占用，就沒有可以做的事
    if (a.effects.length > 0 && a.effects.every((e) => e.op === 'returnTriggerCardToSlot')) {
      const pl = s.players[w.controller];
      if (!w.ctx.target || !pl.waiting.includes(w.ctx.target) || w.ctx.slot === undefined || pl.stage[w.ctx.slot]) return false;
    }
    return true;
  }

  // 此卡現在的格子（「このカードがいた枠」：付費把此卡移走之前先記下來）
  const withSlot = (s: GameState, src: string, fctx: FrameCtx): FrameCtx => {
    const slot = s.players[ownerOf(s, src)].stage.findIndex((c) => c?.uid === src);
    return slot >= 0 && fctx.slot === undefined ? { ...fctx, slot: slot as Slot } : fctx;
  };

  function startAbility(ctx: Ctx, w: StandbyAbility) {
    const { s } = ctx;
    const a = w.ability;
    if (!viable(s, w)) return;
    ctx.ev.push({ t: 'ability', uid: w.src, cardId: s.cards[w.src]!.cardId, text: a.text.zh });
    const name = cardOf(s, w.src).name.zh;
    const ops: Frame['effects'] = [];
    if (a.optional) ops.push({ op: '_confirm', prompt: `要發動「${name}」的效果嗎？\n${a.text.zh}` });
    if (a.perTurn) ops.push({ op: '_markOnce', key: onceKey(w.src, a) });
    ops.push(...costOps(a.cost ?? []), ...a.effects);
    runFrame(ctx, newFrame(s, w.src, w.controller, ops, withSlot(s, w.src, w.ctx), true));
  }

  // 起動能力、事件、助太刀：先付費再執行
  function startPlayed(ctx: Ctx, src: string, controller: PlayerId, ability: Ability, extra: InternalOp[] = []) {
    const { s } = ctx;
    ctx.ev.push({ t: 'ability', uid: src, cardId: s.cards[src]!.cardId, text: ability.text.zh });
    const ops: Frame['effects'] = [];
    if (ability.perTurn) ops.push({ op: '_markOnce', key: onceKey(src, ability) });
    ops.push(...costOps(ability.cost ?? []), ...ability.effects);
    if (ability.keyword?.id === 'concentrate') ops.push({ op: '_fireConcentrate' });
    runFrame(ctx, newFrame(s, src, controller, [...ops, ...extra], withSlot(s, src, {})));
  }
  // 起動能力這回合還能不能用（【ターン1】）
  const usedUp = (s: GameState, uid: string, a: Ability) => !!a.perTurn && s.usedOnce.filter((k) => k === onceKey(uid, a)).length >= a.perTurn;

  // ── 執行效果 ──
  function runFrame(ctx: Ctx, f: Frame) {
    const { s } = ctx;
    while (f.i < f.effects.length) {
      if (s.winner !== null) return;
      const r = exec(ctx, f, f.effects[f.i]!);
      if (r === 'wait') {
        s.queue.push({ k: 'frame', f });
        return;
      }
      f.i++;
      f.tmp = {};
      f.answer = undefined;
      if (r === 'abort') return;
      if (Array.isArray(r)) {
        // 先執行插入的步驟（巢狀效果、傷害處理），再回來繼續
        if (f.i < f.effects.length) s.queue.push({ k: 'frame', f });
        core.then(s, ...r);
        return;
      }
    }
  }
  const sub = (f: Frame, effects: Frame['effects']): Step => ({ k: 'frame', f: { ...f, effects, i: 0, tmp: {}, answer: undefined } });

  // 向玩家提問；已有答案就直接用
  function ask(ctx: Ctx, f: Frame, key: string, pending: Pending): unknown {
    if (key in f.tmp) return f.tmp[key];
    if (f.answer !== undefined) {
      f.tmp[key] = f.answer;
      f.answer = undefined;
      return f.tmp[key];
    }
    ctx.s.pending = pending;
    return undefined;
  }

  // 依選擇器選卡〔8.6.3〕：指定張數時能選就要選滿；「まで」可選 0 張
  function pick(ctx: Ctx, f: Frame, sel: Selector, prompt: string, key = 'sel'): string[] | undefined {
    if (key in f.tmp) return f.tmp[key] as string[];
    if (sel.fromBind) {
      const want = sel.zone === 'marker' ? null : ZONE[sel.zone];
      return (f.tmp[key] = (f.binds[sel.fromBind] ?? []).filter((u) => !want || locate(ctx.s, u)?.zone === want)) as string[];
    }
    let cands = candidates(ctx.s, sel, f.src, f.controller, f.ctx);
    // 「相手の効果に選ばれない」：選擇對手的卡時排除（全部、指定關係的不算選擇）
    if (sel.side === 'opponent' && sel.count !== 'all' && !sel.relation) cands = cands.filter((u) => !(onStage(ctx.s, u) && hasRule(ctx.s, u, 'untargetable')));
    let out: string[] | undefined;
    if (sel.count === 'all') out = cands;
    else if ('exactly' in sel.count && cands.length <= sel.count.exactly) out = cands;
    else if ('upTo' in sel.count && cands.length === 0) out = [];
    if (out) {
      f.tmp[key] = out;
    } else {
      const exact = 'exactly' in (sel.count as object);
      const n = exact ? (sel.count as { exactly: number }).exactly : (sel.count as { upTo: number }).upTo;
      const chooser = sel.chooser === 'opponent' ? other(f.controller) : f.controller;
      out = ask(ctx, f, key, { kind: 'select', player: chooser, prompt: `${f.label}：${prompt}`, options: cands, min: exact ? n : 0, max: n }) as string[] | undefined;
    }
    if (out && sel.as) f.binds[sel.as] = out;
    return out;
  }
  const confirm = (ctx: Ctx, f: Frame, prompt: string, key = 'ok') => ask(ctx, f, key, { kind: 'confirm', player: f.controller, prompt }) as boolean | undefined;
  const chooseOption = (ctx: Ctx, f: Frame, prompt: string, options: string[], player = f.controller, key = 'opt') =>
    ask(ctx, f, key, { kind: 'chooseOption', player, prompt: `${f.label}：${prompt}`, options }) as number | undefined;
  // 「給對手確認」「公開」：讓對手看過並按確認；回傳 true＝已確認可以繼續
  const showOpponent = (ctx: Ctx, f: Frame, cards: string[], what: string) =>
    ask(ctx, f, 'ack', { kind: 'acknowledge', player: other(f.controller), prompt: `對手的「${f.label}」：${what}的卡`, cards, timeout: RESPONSE_SECONDS }) !== undefined;

  // 標記從角色下面拿出來，放到主人的區域
  function moveMarker(ctx: Ctx, uid: string, to: Exclude<GameZone, 'stage'>, deckTop = false) {
    const { s } = ctx;
    const host = markerHost(s, uid);
    if (!host) return;
    s.markers[host] = s.markers[host]!.filter((m) => m.uid !== uid);
    if (!s.markers[host]!.length) delete s.markers[host];
    const p = s.cards[uid]!.owner;
    if (to === 'deck' && deckTop) s.players[p].deck.unshift(uid);
    else s.players[p][to].push(uid);
    const hostLoc = locate(s, host);
    ctx.ev.push({ t: 'move', uid, cardId: to === 'deck' || to === 'hand' || to === 'stock' ? null : s.cards[uid]!.cardId, from: { p, zone: 'stage', ...(hostLoc?.slot !== undefined ? { slot: hostLoc.slot } : {}) }, to: { p, zone: to } });
  }

  function moveTo(ctx: Ctx, uid: string, to: GameZone, opts: MoveOpts = {}) {
    const loc = locate(ctx.s, uid);
    if (!loc) {
      if (to !== 'stage' && markerHost(ctx.s, uid)) moveMarker(ctx, uid, to, opts.deckTop);
      return;
    }
    core.move(ctx, uid, loc.p, loc.zone, to, { fromSlot: loc.slot, ...opts });
    if (loc.zone === 'deck') core.refreshIfNeeded(ctx, loc.p);
  }
  const setState = (ctx: Ctx, uid: string, state: 'stand' | 'rest' | 'reverse') => {
    const loc = locate(ctx.s, uid);
    const c = loc?.zone === 'stage' ? ctx.s.players[loc.p].stage[loc.slot!] : null;
    if (!c || c.state === state) return;
    c.state = state;
    ctx.ev.push({ t: 'cardState', uid, state });
  };
  // 效果讓角色倒置：誘發「此卡倒置時」「其他角色倒置時」，戰鬥中的話對手的「戰鬥對手倒置時」
  function reverseCard(ctx: Ctx, uid: string) {
    const { s } = ctx;
    const loc = locate(s, uid);
    if (loc?.zone !== 'stage' || s.players[loc.p].stage[loc.slot!]!.state === 'reverse') return;
    setState(ctx, uid, 'reverse');
    const a = s.attack;
    const opp = a && a.mode === 'front' ? (a.attacker === uid ? a.defender : a.defender === uid ? a.attacker : null) : null;
    fireFor(s, uid, 'reversedInBattle', opp ? { battleOpp: opp } : {});
    fireAlly(s, loc.p, 'allyReversed', uid);
    if (opp && onStage(s, opp)) fireFor(s, opp, 'battleOpponentReversed', { battleOpp: uid });
  }
  // 「下次的對手回合」是第幾回合：現在是自己的回合就是下一回合，是對手的回合就是下下回合
  const nextOppTurn = (s: GameState, p: PlayerId) => s.turn + (s.turnPlayer === p ? 1 : 2);

  // 放到舞台上（效果）：選格子、原本的角色進休息室、誘發「放置到舞台時」
  function placeOnStage(ctx: Ctx, f: Frame, uid: string, to: Extract<Effect, { op: 'moveCards' }>['to'], key = 'slot'): 'done' | 'wait' {
    const { s } = ctx;
    const p = to.side ? (to.side === 'self' ? f.controller : other(f.controller)) : s.cards[uid]!.owner;
    const stage = s.players[p].stage;
    const placed = f.binds._placed ?? [];
    let slots = ALL_SLOTS.filter((i) => (to.row === 'front' ? i < 3 : to.row === 'back' ? i >= 3 : true));
    if (to.slot === 'sourceSlot') slots = f.ctx.slot !== undefined ? [f.ctx.slot] : [];
    if (to.slot === 'anyNew') slots = slots.filter((i) => !stage[i] || !placed.includes(stage[i]!.uid));
    if (to.slot !== 'any' && to.slot !== 'anyNew') slots = slots.filter((i) => !stage[i]);
    if (!slots.length) return 'done';
    const chooser = to.slotChooser === 'opponent' ? other(f.controller) : f.controller;
    const slot = slots.length === 1 ? slots[0] : (ask(ctx, f, key, { kind: 'chooseSlot', player: chooser, owner: p, prompt: `${f.label}：選擇要放的格子`, slots }) as Slot | undefined);
    if (slot === undefined) return 'wait';
    const from = locate(s, uid)?.zone;
    const old = stage[slot];
    if (old) moveTo(ctx, old.uid, 'waiting');
    moveTo(ctx, uid, 'stage', { toPlayer: p, slot, state: to.state === 'rest' ? 'rest' : 'stand' });
    f.binds._placed = [...placed, uid];
    // 從手牌放到舞台：誘發「從手牌被放置到舞台時」〔效果放置也算〕
    if (from === 'hand') {
      s.placedThisTurn.push(uid);
      fireFor(s, uid, 'placedFromHandToStage');
      fireAlly(s, p, 'allyPlacedFromHand', uid);
    }
    if (from === 'waiting') fireFor(s, uid, 'placedFromWaitingRoom');
    // 「「X」の効果で舞台に置かれた時」
    const by = cardOf(s, f.src).name.ja;
    for (const a of abilitiesOf(s, uid)) {
      if (a.kind === 'auto' && [a.trigger, a.alsoOn].some((t) => t?.event === 'placedByEffectOf' && t.name === by)) standby(s, uid, p, a, {});
    }
    return 'done';
  }

  // 選項的序號
  const optionIndex = (v: unknown) => (typeof v === 'number' ? v : Number((v as string[] | undefined)?.[0]));

  function exec(ctx: Ctx, f: Frame, e: Effect | InternalOp): Done {
    const { s } = ctx;
    const me = s.players[f.controller];
    switch (e.op) {
      // ── 費用與流程 ──
      case '_confirm': {
        const ok = confirm(ctx, f, e.prompt);
        if (ok === undefined) return 'wait';
        return ok ? 'done' : 'abort';
      }
      case '_markOnce':
        s.usedOnce.push(e.key);
        return 'done';
      case '_payStock':
        core.payStock(ctx, f.controller, e.n);
        return 'done';
      case '_discard': {
        // 費用不能用發動能力的卡本身支付（和 costPayable 一致）
        const sel = { ...e.selector, filter: { ...e.selector.filter, excludeSource: true } };
        const what = e.selector.zone === 'hand' ? '手牌' : e.selector.zone === 'stage' ? '角色' : '卡';
        const picked = pick(ctx, f, sel, `選擇要放到休息室的${what}`);
        if (!picked) return 'wait';
        for (const u of picked) moveTo(ctx, u, 'waiting');
        if (e.bind) f.binds[e.bind] = [...(f.binds[e.bind] ?? []), ...picked];
        return 'done';
      }
      case '_discardSource':
        if (me.hand.includes(f.src)) moveTo(ctx, f.src, 'waiting');
        return 'done';
      case '_restSource':
        if (me.stage.some((x) => x?.uid === f.src)) setState(ctx, f.src, 'rest');
        return 'done';
      case '_sendSourceToWR':
        if (onStage(s, f.src)) moveTo(ctx, f.src, 'waiting');
        return 'done';
      case '_sourceToDeckBottom':
        if (onStage(s, f.src)) moveTo(ctx, f.src, 'deck'); // 不指定上方＝放到最下面
        return 'done';
      case '_returnSourceToHand':
        if (onStage(s, f.src)) moveTo(ctx, f.src, 'hand');
        return 'done';
      case '_rest': {
        const picked = pick(ctx, f, e.selector, '選擇要橫置的角色');
        if (!picked) return 'wait';
        for (const u of picked) setState(ctx, u, 'rest');
        return 'done';
      }
      case '_deckTopToClock': {
        core.refreshIfNeeded(ctx, f.controller);
        const top = me.deck[0];
        if (!top) return 'done';
        core.move(ctx, top, f.controller, 'deck', 'clock');
        core.refreshIfNeeded(ctx, f.controller);
        return [{ k: 'levelCheck', p: f.controller }]; // 傷害區到 7 張就先升級，再繼續效果
      }
      case '_handToClock': {
        const picked = pick(ctx, f, { zone: 'hand', side: 'self', filter: { excludeSource: true }, count: { exactly: 1 } }, '選擇要放到傷害區的手牌');
        if (!picked) return 'wait';
        for (const u of picked) moveTo(ctx, u, 'clock');
        return [{ k: 'levelCheck', p: f.controller }];
      }
      case '_reveal':
      case '_handToDeckBottom': {
        const picked = pick(ctx, f, { ...e.selector, filter: { ...e.selector.filter, excludeSource: true } }, e.op === '_reveal' ? '選擇要公開的手牌' : '選擇要公開並放到牌組下方的手牌');
        if (!picked) return 'wait';
        for (const u of picked) {
          ctx.ev.push({ t: 'reveal', uid: u, cardId: s.cards[u]!.cardId });
          ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」公開手牌的「${cardOf(s, u).name.zh}」` });
          if (e.op === '_handToDeckBottom') moveTo(ctx, u, 'deck');
        }
        return 'done';
      }
      case '_fireUsedBackup':
        fireFor(s, f.src, 'usedBackup', {}, cardOf(s, f.src).abilities, f.controller);
        return 'done';
      case '_fireConcentrate':
        if ((f.binds._milled ?? []).some((u) => cardOf(s, u).type === 'climax')) fireMine(s, f.controller, 'concentrateHitClimax');
        return 'done';
      case '_ifCancelled':
        return s.lastDamage === 'cancel' ? [sub(f, e.then)] : 'done';
      case '_eventDone':
        if (me.resolution.includes(f.src)) core.move(ctx, f.src, f.controller, 'resolution', 'waiting');
        return 'done';

      // ── 卡片效果 ──
      case 'modifyPower':
      case 'modifySoul': {
        if (e.duration === 'whileActive') return 'done'; // 【永】在計算時處理
        const picked = pick(ctx, f, e.target, '選擇角色');
        if (!picked) return 'wait';
        const until = e.duration === 'untilNextOpponentTurnEnd' ? nextOppTurn(s, f.controller) : undefined;
        for (const u of picked) {
          if (!onStage(s, u)) continue;
          const n = e.op === 'modifyPower' ? amountOf(s, e.amount, f.src, f.controller, f.binds, u, f.ctx) : e.amount;
          s.mods.push({ uid: u, power: e.op === 'modifyPower' ? n : 0, soul: e.op === 'modifySoul' ? n : 0, ...(until ? { until } : {}) });
        }
        return 'done';
      }
      case 'modifyLevel':
      case 'gainTrigger':
        return 'done'; // 【永】在計算時處理
      case 'moveCards': {
        const picked = pick(ctx, f, e.from, '選擇卡片');
        if (!picked) return 'wait';
        const to = e.to.zone === 'marker' ? 'waiting' : ZONE[e.to.zone];
        if (to === 'stage') {
          // 放到舞台（一次一張）
          const uid = picked[0];
          if (!uid) return 'done';
          if (placeOnStage(ctx, f, uid, e.to) === 'wait') return 'wait';
          if (e.bind) f.binds[e.bind] = [uid];
          return 'done';
        }
        for (const u of picked) {
          if (to === 'hand' && locate(s, u)?.zone === 'deck') ctx.ev.push({ t: 'reveal', uid: u, cardId: s.cards[u]!.cardId });
          const p = e.to.side ? (e.to.side === 'self' ? f.controller : other(f.controller)) : s.cards[u]!.owner;
          moveTo(ctx, u, to, { toPlayer: p, deckTop: e.to.position === 'top' });
          if (to === 'stock' && e.to.position === 'bottom') {
            const st = s.players[p].stock;
            st.unshift(...st.splice(st.indexOf(u), 1));
          }
          // 效果把名場面放到名場面區：也算「名場面被放置時」
          if (to === 'climax') fireGlobal(s, 'climaxPlaced', u);
        }
        if (e.bind) f.binds[e.bind] = picked;
        return 'done';
      }
      case 'draw': {
        // 「最多抽 N 張」：一張一張問
        const total = amountOf(s, e.upTo, f.src, f.controller, f.binds, undefined, f.ctx);
        let drawn = (f.tmp.drawn as number | undefined) ?? 0;
        while (drawn < total) {
          const ok = confirm(ctx, f, `${f.label}：要抽 1 張嗎？（還可以抽 ${total - drawn} 張）`, `d${drawn}`);
          if (ok === undefined) {
            f.tmp.drawn = drawn;
            return 'wait';
          }
          if (!ok) break;
          core.drawOne(ctx, f.controller);
          drawn++;
          f.tmp.drawn = drawn;
        }
        f.binds._drawn = Array<string>(drawn).fill('');
        return 'done';
      }
      case 'lookTopPick': {
        // 看牌組上方 N 張：一定把翻開的牌給玩家看（只有自己看得到），沒有符合的也要看過再放到休息室
        if (!f.tmp.done) {
          const looked = me.deck.slice(0, typeof e.look === 'number' ? e.look : amountOf(s, e.look, f.src, f.controller, f.binds, undefined, f.ctx));
          if (!looked.length) return 'done';
          const matches = looked.filter((u) => filterOk(s, u, e.pick.filter, f.src, f.ctx.x));
          const prompt = matches.length
            ? `${f.label}：牌組上方 ${looked.length} 張，可以選最多 ${e.pick.upTo} 張${e.secret ? '' : '給對手確認後'}加到手牌，其餘放到休息室`
            : `${f.label}：牌組上方 ${looked.length} 張裡沒有可以拿的卡，全部放到休息室`;
          const picked = ask(ctx, f, 'sel', {
            kind: 'select', player: f.controller, prompt, options: matches, min: 0, max: Math.min(e.pick.upTo, matches.length), shown: looked,
          }) as string[] | undefined;
          if (!picked) return 'wait';
          for (const u of picked) {
            if (!e.secret) ctx.ev.push({ t: 'reveal', uid: u, cardId: s.cards[u]!.cardId });
            core.move(ctx, u, f.controller, 'deck', 'hand');
          }
          for (const u of looked) if (!picked.includes(u) && e.rest === 'waitingRoom') core.move(ctx, u, f.controller, 'deck', 'waiting');
          core.refreshIfNeeded(ctx, f.controller);
          f.tmp.done = true;
          f.tmp.picked = picked;
        }
        const picked = f.tmp.picked as string[];
        if (picked.length && !e.secret && !showOpponent(ctx, f, picked, '加到手牌')) return 'wait';
        return picked.length && e.then ? [sub(f, e.then)] : 'done';
      }
      case 'searchDeck': {
        if (!f.tmp.done) {
          const options = me.deck.filter((u) => filterOk(s, u, e.filter, f.src, f.ctx.x));
          let picked: string[] = [];
          if (options.length) {
            const a = ask(ctx, f, 'sel', { kind: 'select', player: f.controller, prompt: `${f.label}：從牌組選最多 ${e.upTo} 張給對手確認後加到手牌`, options, min: 0, max: e.upTo }) as string[] | undefined;
            if (!a) return 'wait';
            picked = a;
          }
          for (const u of picked) {
            ctx.ev.push({ t: 'reveal', uid: u, cardId: s.cards[u]!.cardId });
            core.move(ctx, u, f.controller, 'deck', 'hand');
          }
          if (e.shuffle) core.shuffle(ctx, f.controller);
          core.refreshIfNeeded(ctx, f.controller);
          f.tmp.done = true;
          f.tmp.picked = picked;
        }
        const picked = f.tmp.picked as string[];
        if (picked.length && e.reveal && !showOpponent(ctx, f, picked, '加到手牌')) return 'wait';
        return 'done';
      }
      case 'revealTopCheck': {
        // 公開牌組最上面 1 張：翻到牌組旁邊（解決領域），雙方都看得到；
        // 發動的玩家看到結果（加到手牌／放回原位）按確認，對手從動畫和對戰紀錄得知，不用等對手按
        if (!('top' in f.tmp)) {
          core.refreshIfNeeded(ctx, f.controller);
          const top = me.deck[0];
          if (!top) return 'done';
          core.move(ctx, top, f.controller, 'deck', 'resolution');
          ctx.ev.push({ t: 'reveal', uid: top, cardId: s.cards[top]!.cardId });
          f.tmp.top = top;
          const match = filterOk(s, top, e.filter, f.src, f.ctx.x);
          const result = e.matchTo === 'deckTop' ? (match ? '符合條件，放回牌組上方' : '不符合條件，放回牌組上方') : (match ? '加到手牌' : '放回牌組上方');
          ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」公開牌組上方的「${cardOf(s, top).name.zh}」→ ${result}` });
        }
        const top = f.tmp.top as string;
        const match = filterOk(s, top, e.filter, f.src, f.ctx.x);
        const name = cardOf(s, top).name.zh;
        const back = e.matchTo === 'deckTop';
        const ok = ask(ctx, f, 'ack', {
          kind: 'acknowledge', player: f.controller, cards: [top], button: match && !back ? '加到手牌' : '放回牌組上方',
          prompt: `${f.label}：公開了牌組上方的「${name}」。${back ? (match ? '符合條件，放回牌組最上面後繼續' : '不符合條件，放回牌組最上面') : (match ? '符合條件，加到手牌' : '不符合條件，放回牌組最上面')}`,
        });
        if (ok === undefined) return 'wait';
        if (!me.resolution.includes(top)) return 'done';
        if (back) {
          core.move(ctx, top, f.controller, 'resolution', 'deck', { deckTop: true });
          return match && e.ifMatch.length ? [sub(f, e.ifMatch)] : 'done';
        }
        if (!match) {
          core.move(ctx, top, f.controller, 'resolution', 'deck', { deckTop: true });
          return 'done';
        }
        core.move(ctx, top, f.controller, 'resolution', 'hand');
        return e.ifMatch.length ? [sub(f, e.ifMatch)] : 'done';
      }
      case 'revealMill': {
        // 牌組上方 N 張一張一張翻到解決領域（牌組用完就先重洗），給發動的玩家看結果，按下按鈕後放到休息室
        if (!f.tmp.milled) {
          const milled: string[] = [];
          for (let i = 0; i < e.n; i++) {
            core.refreshIfNeeded(ctx, f.controller);
            const u = me.deck[0];
            if (!u) break;
            core.move(ctx, u, f.controller, 'deck', 'resolution');
            milled.push(u);
          }
          f.tmp.milled = milled;
          f.binds[e.bind] = milled;
          f.binds._milled = milled;
          const x = milled.filter((u) => cardOf(s, u).type === 'climax').length;
          ctx.ev.push({
            t: 'log', p: f.controller,
            text: `「${f.label}」翻開牌組上方 ${milled.length} 張，其中 ${x} 張名場面${e.result === 'draw' ? (x ? `，抽 ${x} 張` : '，不抽牌') : e.result === 'damage' ? (x ? `，給對手 ${x} 點傷害` : '，沒有傷害') : ''}`,
          });
        }
        const milled = f.tmp.milled as string[];
        if (!milled.length) return 'done';
        const x = milled.filter((u) => cardOf(s, u).type === 'climax').length;
        const draw = e.result === 'draw';
        const ok = ask(ctx, f, 'ack', {
          kind: 'acknowledge', player: f.controller, cards: milled,
          prompt: draw
            ? (x ? `${f.label}（集中）：翻到 ${x} 張名場面，抽 ${x} 張` : `${f.label}（集中）：沒有翻到名場面，所以不抽牌`)
            : e.result === 'damage'
            ? (x ? `${f.label}：翻到 ${x} 張名場面，給對手 ${x} 點傷害` : `${f.label}：沒有翻到名場面，不造成傷害`)
            : `${f.label}：翻到 ${x} 張名場面`,
          button: draw ? (x ? `抽 ${x} 張` : '放到休息室') : e.result === 'damage' ? (x ? `給對手 ${x} 點傷害` : '放到休息室') : '放到休息室',
        });
        if (ok === undefined) return 'wait';
        for (const u of milled) if (me.resolution.includes(u)) core.move(ctx, u, f.controller, 'resolution', 'waiting');
        core.refreshIfNeeded(ctx, f.controller);
        return 'done';
      }
      case 'returnSourceToHand':
        if (onStage(s, f.src)) moveTo(ctx, f.src, 'hand');
        return 'done';
      case 'returnSourceToSlot': {
        const slot = f.ctx.slot;
        if (slot !== undefined && me.waiting.includes(f.src) && !me.stage[slot]) moveTo(ctx, f.src, 'stage', { toPlayer: f.controller, slot, state: 'rest' });
        return 'done';
      }
      case 'putCardOnDeckTop': {
        const picked = pick(ctx, f, e.from, '選擇要放到牌組上方的卡');
        if (!picked) return 'wait';
        for (const u of picked) moveTo(ctx, u, 'deck', { deckTop: true });
        return 'done';
      }
      case 'restSource':
        return exec(ctx, f, { op: '_restSource' });
      case 'dealDamage': {
        // 傷害處理〔4.12〕；會發生傷害取消
        const n = amountOf(s, e.amount, f.src, f.controller, f.binds, undefined, f.ctx);
        if (n <= 0) return 'done';
        const steps: Step[] = [];
        for (let i = 0; i < (e.times ?? 1); i++) steps.push({ k: 'damage', p: other(f.controller), n, src: f.src, ...(f.auto ? { auto: true } : {}) });
        if (e.ifCancelled) steps.push(sub(f, [{ op: '_ifCancelled', then: e.ifCancelled }]));
        return steps;
      }
      case 'drawCards': {
        const n = amountOf(s, e.n, f.src, f.controller, f.binds, undefined, f.ctx);
        for (let i = 0; i < n; i++) core.drawOne(ctx, f.controller);
        return 'done';
      }
      case 'moveSourceToSlot': {
        const from = me.stage.findIndex((c) => c?.uid === f.src);
        if (from < 0 || hasRule(s, f.src, 'cannotMove')) return 'done';
        const empty = ([0, 1, 2] as Slot[]).filter((i) => !me.stage[i]);
        if (!empty.length) return 'done';
        const slot = empty.length === 1 ? empty[0] : (ask(ctx, f, 'slot', { kind: 'chooseSlot', player: f.controller, prompt: `${f.label}：選擇要移動到的格子`, slots: empty }) as Slot | undefined);
        if (slot === undefined) return 'wait';
        me.stage[slot] = me.stage[from]!;
        me.stage[from] = null;
        ctx.ev.push({ t: 'move', uid: f.src, cardId: s.cards[f.src]!.cardId, from: { p: f.controller, zone: 'stage', slot: from as Slot }, to: { p: f.controller, zone: 'stage', slot } });
        return 'done';
      }
      case 'grantAbility': {
        if (e.duration === 'whileActive') return 'done';
        const picked = pick(ctx, f, e.target, '選擇要給予能力的角色');
        if (!picked) return 'wait';
        const until = e.duration === 'untilNextOpponentTurnEnd' ? nextOppTurn(s, f.controller) : undefined;
        for (const u of picked) if (onStage(s, u)) s.grants.push({ uid: u, ability: e.ability, ...(until ? { until } : {}) });
        return 'done';
      }
      case 'sendToMemory': {
        const picked = pick(ctx, f, e.from, '選擇角色');
        if (!picked) return 'wait';
        for (const u of picked) moveTo(ctx, u, 'memory');
        return 'done';
      }
      case 'payThen': {
        if (!costPayable(s, e.cost, f.src, f.controller)) return 'done';
        const ok = confirm(ctx, f, `${f.label}：要支付費用並繼續嗎？`);
        if (ok === undefined) return 'wait';
        return ok ? [sub(f, [...costOps(e.cost), ...e.then])] : 'done';
      }
      case 'extraTriggerCheck':
        if (s.attack) {
          s.attack.checks = e.n ?? 2;
          if (e.thenStockTopToWaiting) s.attack.afterChecks = 'stockTopToWaiting';
        }
        return 'done';
      case 'moveToOtherEmptySlot': {
        const picked = pick(ctx, f, e.target, '選擇要移動的角色');
        if (!picked) return 'wait';
        const uid = picked[0];
        const loc = uid ? locate(s, uid) : null;
        if (!uid || loc?.zone !== 'stage' || hasRule(s, uid, 'cannotMove')) return 'done';
        const stage = s.players[loc.p].stage;
        const empty = ALL_SLOTS.filter((i) => !stage[i]);
        if (!empty.length) return 'done';
        const slot = empty.length === 1 ? empty[0] : (ask(ctx, f, 'slot', { kind: 'chooseSlot', player: f.controller, owner: loc.p, prompt: `${f.label}：選擇要移動到的格子`, slots: empty }) as Slot | undefined);
        if (slot === undefined) return 'wait';
        stage[slot] = stage[loc.slot!]!;
        stage[loc.slot!] = null;
        ctx.ev.push({ t: 'move', uid, cardId: s.cards[uid]!.cardId, from: { p: loc.p, zone: 'stage', slot: loc.slot! }, to: { p: loc.p, zone: 'stage', slot } });
        return 'done';
      }
      case 'lookTopHandAndStock': {
        // 看上方 N 張（或整個牌組）→ 選最多 max 張給對手確認 → 其中 1 張加到手牌、1 張放到能量區 → 其餘放休息室
        const max = e.max ?? 2;
        const looked = (f.tmp.looked as string[] | undefined) ?? (e.search ? [...me.deck] : me.deck.slice(0, e.look));
        f.tmp.looked = looked;
        if (!looked.length) return 'done';
        const matches = looked.filter((u) => filterOk(s, u, e.filter, f.src, f.ctx.x));
        const what = e.secret ? '' : '給對手確認';
        const picked = ask(ctx, f, 'sel', {
          kind: 'select', player: f.controller, options: matches, min: 0, max: Math.min(max, matches.length), ...(e.search ? {} : { shown: looked }), button: '確定',
          prompt: matches.length
            ? `${f.label}：${e.search ? '從牌組' : `牌組上方 ${looked.length} 張，`}選最多 ${max} 張${what}（1 張加到手牌、1 張放到能量區${max > 2 ? '、其餘放到休息室' : ''}）${e.search ? '' : '，沒選的放到休息室'}`
            : `${f.label}：${e.search ? '牌組' : `牌組上方 ${looked.length} 張`}裡沒有可以選的卡${e.search ? '' : '，全部放到休息室'}`,
        }) as string[] | undefined;
        if (!picked) return 'wait';
        if (picked.length && !e.secret) {
          if (!f.tmp.revealed) {
            for (const u of picked) ctx.ev.push({ t: 'reveal', uid: u, cardId: s.cards[u]!.cardId });
            f.tmp.revealed = true;
          }
          if (!showOpponent(ctx, f, picked, '選出')) return 'wait';
        }
        let toHand = picked.slice(0, 1);
        if (picked.length >= 2) {
          const h = ask(ctx, f, 'hand', { kind: 'select', player: f.controller, prompt: `${f.label}：選 1 張加到手牌`, options: picked, min: 1, max: 1 }) as string[] | undefined;
          if (!h) return 'wait';
          toHand = h;
        }
        let toStock = picked.filter((u) => !toHand.includes(u)).slice(0, 1);
        if (picked.length >= 3) {
          const st = ask(ctx, f, 'stock', { kind: 'select', player: f.controller, prompt: `${f.label}：選 1 張放到能量區（其餘放到休息室）`, options: picked.filter((u) => !toHand.includes(u)), min: 1, max: 1 }) as string[] | undefined;
          if (!st) return 'wait';
          toStock = st;
        }
        for (const u of toHand) core.move(ctx, u, f.controller, 'deck', 'hand');
        for (const u of toStock) core.move(ctx, u, f.controller, 'deck', 'stock');
        for (const u of picked) if (!toHand.includes(u) && !toStock.includes(u)) core.move(ctx, u, f.controller, 'deck', 'waiting');
        if (e.search) core.shuffle(ctx, f.controller);
        else for (const u of looked) if (!picked.includes(u)) core.move(ctx, u, f.controller, 'deck', 'waiting');
        core.refreshIfNeeded(ctx, f.controller);
        return 'done';
      }
      case 'revealTopLevelRecover': {
        // 公開牌組上方 1 張（翻到牌組旁邊），從休息室選 1 張等級 X 以下的角色回手牌，公開的卡放回原位
        if (!('top' in f.tmp)) {
          core.refreshIfNeeded(ctx, f.controller);
          const top = me.deck[0];
          if (!top) return 'done';
          core.move(ctx, top, f.controller, 'deck', 'resolution');
          ctx.ev.push({ t: 'reveal', uid: top, cardId: s.cards[top]!.cardId });
          f.tmp.top = top;
          const x = levelOf(s, top);
          ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」公開牌組上方的「${cardOf(s, top).name.zh}」（等級 ${x}）` });
        }
        const top = f.tmp.top as string;
        const x = levelOf(s, top);
        const options = me.waiting.filter((u) => cardOf(s, u).type === 'character' && levelOf(s, u) <= x && filterOk(s, u, e.filter, f.src));
        const name = cardOf(s, top).name.zh;
        const picked = options.length
          ? (ask(ctx, f, 'sel', {
              kind: 'select', player: f.controller, options, min: 1, max: 1, shown: [top, ...options], button: '加到手牌',
              prompt: `${f.label}：公開了「${name}」（等級 ${x}）。選休息室 1 張等級 ${x} 以下的角色加到手牌（公開的卡放回牌組上方）`,
            }) as string[] | undefined)
          : ask(ctx, f, 'ack', {
              kind: 'acknowledge', player: f.controller, cards: [top], button: '放回牌組上方',
              prompt: `${f.label}：公開了「${name}」（等級 ${x}），休息室沒有等級 ${x} 以下的角色`,
            }) !== undefined ? [] : undefined;
        if (!picked) return 'wait';
        for (const u of picked) moveTo(ctx, u, 'hand');
        if (me.resolution.includes(top)) core.move(ctx, top, f.controller, 'resolution', 'deck', { deckTop: true });
        return 'done';
      }
      case 'lookTopReorder': {
        // 看自己牌組上方最多 N 張，照點選的順序放回上方（先點的在最上面）
        const looked = me.deck.slice(0, e.n);
        if (looked.length <= 1) {
          if (!looked.length) return 'done';
          return ask(ctx, f, 'ack', { kind: 'acknowledge', player: f.controller, cards: looked, button: '放回牌組上方', prompt: `${f.label}：牌組最上面的卡` }) === undefined ? 'wait' : 'done';
        }
        const order = ask(ctx, f, 'sel', {
          kind: 'select', player: f.controller, options: looked, min: looked.length, max: looked.length, shown: looked, ordered: true, button: '照這個順序放回牌組上方',
          prompt: `${f.label}：牌組上方 ${looked.length} 張。依序點選，先點的放在最上面`,
        }) as string[] | undefined;
        if (!order) return 'wait';
        me.deck.splice(0, looked.length, ...order);
        ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」看了牌組上方 ${looked.length} 張，調整順序後放回` });
        return 'done';
      }
      case 'lookOpponentTopArrange': {
        // 看對手牌組上方最多 N 張：選要留下的卡，依點選順序放回上方（先點的在最上面），沒選的放到對手的休息室
        const opp = other(f.controller);
        const oppDeck = s.players[opp].deck;
        const looked = (f.tmp.looked as string[] | undefined) ?? oppDeck.slice(0, e.n);
        f.tmp.looked = looked;
        if (!looked.length) return 'done';
        const keep = ask(ctx, f, 'sel', {
          kind: 'select', player: f.controller, options: looked, min: 0, max: looked.length, shown: looked, ordered: true, button: '確定（選的放回上方，其餘進休息室）',
          prompt: `${f.label}：對手牌組上方 ${looked.length} 張。點選要放回牌組上方的卡（先點的放在最上面），沒選的放到對手的休息室`,
        }) as string[] | undefined;
        if (!keep) return 'wait';
        for (const u of looked) if (!keep.includes(u)) core.move(ctx, u, opp, 'deck', 'waiting');
        const rest = oppDeck.filter((u) => !keep.includes(u));
        oppDeck.splice(0, oppDeck.length, ...keep, ...rest);
        ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」看了對手牌組上方 ${looked.length} 張：${keep.length} 張放回上方，${looked.length - keep.length} 張放到休息室` });
        core.refreshIfNeeded(ctx, opp);
        return 'done';
      }
      case 'restAndMoveToBack': {
        const picked = pick(ctx, f, e.target, '選擇要橫置並移到後列的角色');
        if (!picked) return 'wait';
        const uid = picked[0];
        const loc = uid ? locate(s, uid) : null;
        if (!uid || loc?.zone !== 'stage') return 'done';
        const stage = s.players[loc.p].stage;
        const c = stage[loc.slot!]!;
        setState(ctx, uid, 'rest');
        if (hasRule(s, uid, 'cannotMove')) return 'done';
        const empty = ([3, 4] as Slot[]).filter((i) => !stage[i]);
        if (!empty.length) return 'done';
        const slot = empty.length === 1 ? empty[0] : (ask(ctx, f, 'slot', { kind: 'chooseSlot', player: f.controller, owner: loc.p, prompt: `${f.label}：選擇要移到的後列格子`, slots: empty }) as Slot | undefined);
        if (slot === undefined) return 'wait';
        stage[slot] = c;
        stage[loc.slot!] = null;
        ctx.ev.push({ t: 'move', uid, cardId: s.cards[uid]!.cardId, from: { p: loc.p, zone: 'stage', slot: loc.slot! }, to: { p: loc.p, zone: 'stage', slot } });
        return 'done';
      }
      case 'sourceToDeckBottom': {
        const loc = locate(s, f.src);
        if (loc && (loc.zone === 'resolution' || loc.zone === 'stage')) moveTo(ctx, f.src, 'deck');
        return 'done';
      }
      case 'sourceToMemory': {
        const loc = locate(s, f.src);
        if (loc && (loc.zone === 'resolution' || loc.zone === 'stage' || loc.zone === 'hand')) moveTo(ctx, f.src, 'memory');
        return 'done';
      }
      case 'may': {
        const ok = confirm(ctx, f, `${f.label}：${e.prompt}？`);
        if (ok === undefined) return 'wait';
        return ok ? [sub(f, e.then)] : 'done';
      }
      case 'returnTriggerCardToSlot': {
        const { target, slot } = f.ctx;
        if (target && slot !== undefined && me.waiting.includes(target) && !me.stage[slot]) moveTo(ctx, target, 'stage', { toPlayer: f.controller, slot, state: 'rest' });
        return 'done';
      }
      case 'lookTopPlace':
      case 'lookOpponentTopPlace': {
        // 看牌組上方 1 張（只有自己看得到），決定放回上方或放到下方
        const opp = e.op === 'lookTopPlace' ? f.controller : other(f.controller);
        if (e.op === 'lookTopPlace') core.refreshIfNeeded(ctx, opp);
        const top = (f.tmp.top as string | undefined) ?? s.players[opp].deck[0];
        if (!top) return 'done';
        f.tmp.top = top;
        const toWR = e.op === 'lookTopPlace' && e.dest === 'waitingRoom';
        const sel = ask(ctx, f, 'sel', {
          kind: 'select', player: f.controller, options: [top], min: 0, max: 1, shown: [top], button: '確定',
          prompt: `${f.label}：${e.op === 'lookTopPlace' ? '自己' : '對手'}牌組最上面的卡。選這張＝放到${toWR ? '休息室' : '牌組最下面'}；不選＝放回最上面`,
        }) as string[] | undefined;
        if (!sel) return 'wait';
        if (sel.length && toWR) {
          core.move(ctx, top, opp, 'deck', 'waiting');
          core.refreshIfNeeded(ctx, opp);
        } else if (sel.length) core.move(ctx, top, opp, 'deck', 'deck'); // 放到最下面
        return 'done';
      }

      // ── 選擇與流程 ──
      case 'chooseOne': {
        const i = chooseOption(ctx, f, '選擇要執行的效果', e.options.map((o) => o.label));
        if (i === undefined) return 'wait';
        const opt = e.options[i];
        if (!opt) return 'done';
        ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」選擇：${opt.label}` });
        return [sub(f, opt.effects)];
      }
      case 'eachInOrder': {
        if (e.options.length <= 1) return e.options[0] ? [sub(f, e.options[0].effects)] : 'done';
        const i = chooseOption(ctx, f, '選擇先執行哪一個效果（兩個都會執行）', e.options.map((o) => o.label));
        if (i === undefined) return 'wait';
        const first = e.options[i] ?? e.options[0]!;
        return [sub(f, [...first.effects, { op: 'eachInOrder', options: e.options.filter((o) => o !== first) }])];
      }
      case 'if':
        return condOk(s, e.condition, f.src, f.controller, f.ctx) ? [sub(f, e.then)] : e.else ? [sub(f, e.else)] : 'done';
      case 'ifBound': {
        const hit = (f.binds[e.bind] ?? []).some((u) => filterOk(s, u, e.filter, f.src, f.ctx.x));
        return hit ? [sub(f, e.then)] : e.else ? [sub(f, e.else)] : 'done';
      }
      case 'setX':
        f.ctx = { ...f.ctx, x: amountOf(s, e.amount, f.src, f.controller, f.binds, undefined, f.ctx) };
        return 'done';
      case 'repeat': {
        const n = amountOf(s, e.times, f.src, f.controller, f.binds, undefined, f.ctx);
        return n > 0 ? [sub(f, Array.from({ length: n }, () => e.effects).flat())] : 'done';
      }
      case 'shuffleDeck':
        core.shuffle(ctx, e.side === 'opponent' ? other(f.controller) : f.controller);
        return 'done';
      case 'reverse':
      case 'rest':
      case 'stand': {
        const picked = pick(ctx, f, e.target, e.op === 'rest' ? '選擇要橫置的角色' : e.op === 'stand' ? '選擇要直立的角色' : '選擇要倒置的角色');
        if (!picked) return 'wait';
        for (const u of picked) {
          if (e.op === 'reverse') reverseCard(ctx, u);
          else setState(ctx, u, e.op);
        }
        return 'done';
      }
      case 'noStandNext': {
        const picked = pick(ctx, f, e.target, '選擇角色（下次起立階段不直立）');
        if (!picked) return 'wait';
        for (const u of picked) {
          s.skipStand.push({ uid: u, turn: nextOppTurn(s, f.controller) });
          ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」：對手的「${cardOf(s, u).name.zh}」下次的起立階段不會直立` });
        }
        return 'done';
      }
      case 'swapWithWaiting': {
        // 對手的角色（等級 1 以上）↔ 對手休息室等級 X－1 以下的角色（對手選）〔交換＝放到同一個格子〕
        const picked = pick(ctx, f, e.target, '選擇對手的角色');
        if (!picked) return 'wait';
        const uid = picked[0];
        const loc = uid ? locate(s, uid) : null;
        if (!uid || loc?.zone !== 'stage') return 'done';
        const x = levelOf(s, uid) - 1;
        const opp = loc.p;
        const options = s.players[opp].waiting.filter((u) => cardOf(s, u).type === 'character' && levelOf(s, u) <= x);
        if (!options.length) {
          ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」：對手休息室沒有等級 ${x} 以下的角色，不交換` });
          return 'done';
        }
        const chosen = options.length === 1 ? options : (ask(ctx, f, 'swap', { kind: 'select', player: opp, prompt: `對手的「${f.label}」：從你的休息室選 1 張等級 ${x} 以下的角色，和「${cardOf(s, uid).name.zh}」交換`, options, min: 1, max: 1 }) as string[] | undefined);
        if (!chosen) return 'wait';
        moveTo(ctx, uid, 'waiting');
        moveTo(ctx, chosen[0]!, 'stage', { toPlayer: opp, slot: loc.slot!, state: 'stand' });
        fireFor(s, chosen[0]!, 'placedFromWaitingRoom');
        return 'done';
      }
      case 'swapLevelWithWaiting': {
        if (!me.level.length) return 'done';
        const options = me.waiting.filter((u) => filterOk(s, u, e.filter, f.src, f.ctx.x));
        if (!options.length) return 'done';
        if (e.optional) {
          const ok = confirm(ctx, f, `${f.label}：要把等級區的卡和休息室的卡交換嗎？`);
          if (ok === undefined) return 'wait';
          if (!ok) return 'done';
        }
        const lv = me.level.length === 1 ? [...me.level] : (ask(ctx, f, 'lv', { kind: 'select', player: f.controller, prompt: `${f.label}：選 1 張等級區的卡`, options: me.level, min: 1, max: 1 }) as string[] | undefined);
        if (!lv) return 'wait';
        const wr = options.length === 1 ? options : (ask(ctx, f, 'wr', { kind: 'select', player: f.controller, prompt: `${f.label}：選 1 張休息室的卡放到等級區`, options, min: 1, max: 1 }) as string[] | undefined);
        if (!wr) return 'wait';
        const i = me.level.indexOf(lv[0]!);
        me.level.splice(i, 1);
        me.waiting.splice(me.waiting.indexOf(wr[0]!), 1);
        me.level.splice(i, 0, wr[0]!);
        me.waiting.push(lv[0]!);
        ctx.ev.push({ t: 'move', uid: lv[0]!, cardId: s.cards[lv[0]!]!.cardId, from: { p: f.controller, zone: 'level' }, to: { p: f.controller, zone: 'waiting' } });
        ctx.ev.push({ t: 'move', uid: wr[0]!, cardId: s.cards[wr[0]!]!.cardId, from: { p: f.controller, zone: 'waiting' }, to: { p: f.controller, zone: 'level' } });
        return 'done';
      }
      case 'swapHandWithWaiting': {
        const hand = me.hand.filter((u) => filterOk(s, u, e.filter, f.src, f.ctx.x));
        const wr = me.waiting.filter((u) => filterOk(s, u, e.filter, f.src, f.ctx.x));
        if (!hand.length || !wr.length) return 'done';
        const h = ask(ctx, f, 'hand', { kind: 'select', player: f.controller, prompt: `${f.label}：選最多 1 張手牌公開（和休息室的卡交換）`, options: hand, min: 0, max: 1 }) as string[] | undefined;
        if (!h) return 'wait';
        if (!h.length) return 'done';
        const w = wr.length === 1 ? wr : (ask(ctx, f, 'wr', { kind: 'select', player: f.controller, prompt: `${f.label}：選 1 張休息室的卡加到手牌`, options: wr, min: 1, max: 1 }) as string[] | undefined);
        if (!w) return 'wait';
        ctx.ev.push({ t: 'reveal', uid: h[0]!, cardId: s.cards[h[0]!]!.cardId });
        moveTo(ctx, h[0]!, 'waiting');
        moveTo(ctx, w[0]!, 'hand');
        return 'done';
      }
      case 'resetStock': {
        const p = e.side === 'opponent' ? other(f.controller) : f.controller;
        const pl = s.players[p];
        const n = pl.stock.length;
        for (const u of [...pl.stock]) core.move(ctx, u, p, 'stock', e.via === 'deck' ? 'deck' : 'waiting');
        if (e.via === 'deck') core.shuffle(ctx, p);
        for (let i = 0; i < n; i++) {
          core.refreshIfNeeded(ctx, p);
          const u = pl.deck[0];
          if (!u) break;
          core.move(ctx, u, p, 'deck', 'stock');
        }
        core.refreshIfNeeded(ctx, p);
        ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」：${p === f.controller ? '自己' : '對手'}的能量區 ${n} 張${e.via === 'deck' ? '洗回牌組' : '放到休息室'}，再從牌組上方補 ${n} 張` });
        return 'done';
      }
      case 'waitingToDeck': {
        const p = e.side === 'opponent' ? other(f.controller) : f.controller;
        const pl = s.players[p];
        let keep: string[] = [];
        if (e.keepClimax) {
          const cx = pl.waiting.filter((u) => cardOf(s, u).type === 'climax');
          const k = cx.length <= 1 ? cx : (ask(ctx, f, 'keep', { kind: 'select', player: p, prompt: `${p === f.controller ? '' : '對手的'}「${f.label}」：選 1 張休息室的名場面留下（其餘放回牌組）`, options: cx, min: 1, max: 1 }) as string[] | undefined);
          if (!k) return 'wait';
          keep = k;
        }
        const back = pl.waiting.filter((u) => !keep.includes(u));
        for (const u of back) core.move(ctx, u, p, 'waiting', 'deck');
        core.shuffle(ctx, p);
        ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」：${p === f.controller ? '自己' : '對手'}休息室的 ${back.length} 張放回牌組並洗牌` });
        return 'done';
      }
      case 'lookTopKeep': {
        // 看牌組上方最多 N 張，選 1 張放回上方，其餘放到休息室
        core.refreshIfNeeded(ctx, f.controller);
        const looked = me.deck.slice(0, e.n);
        if (!looked.length) return 'done';
        const keep = ask(ctx, f, 'sel', {
          kind: 'select', player: f.controller, options: looked, min: 1, max: 1, shown: looked, button: '放回牌組上方（其餘放到休息室）',
          prompt: `${f.label}：牌組上方 ${looked.length} 張。選 1 張放回牌組上方，其餘放到休息室`,
        }) as string[] | undefined;
        if (!keep) return 'wait';
        for (const u of looked) if (!keep.includes(u)) core.move(ctx, u, f.controller, 'deck', 'waiting');
        core.refreshIfNeeded(ctx, f.controller);
        return 'done';
      }
      case 'revealUpToPick':
      case 'revealTopStockRest': {
        // 公開牌組上方 N 張（翻到牌組旁邊）
        if (!f.tmp.shown) {
          const shown: string[] = [];
          for (let i = 0; i < e.n; i++) {
            core.refreshIfNeeded(ctx, f.controller);
            const u = me.deck[0];
            if (!u) break;
            core.move(ctx, u, f.controller, 'deck', 'resolution');
            ctx.ev.push({ t: 'reveal', uid: u, cardId: s.cards[u]!.cardId });
            shown.push(u);
          }
          f.tmp.shown = shown;
        }
        const shown = f.tmp.shown as string[];
        if (!shown.length) return 'done';
        if (e.op === 'revealUpToPick') {
          const options = shown.filter((u) => filterOk(s, u, e.filter, f.src, f.ctx.x));
          const picked = ask(ctx, f, 'sel', {
            kind: 'select', player: f.controller, options, min: 0, max: Math.min(1, options.length), shown,
            prompt: `${f.label}：公開了 ${shown.length} 張，選最多 1 張加到手牌，其餘放到休息室（之後丟 1 張手牌）`,
          }) as string[] | undefined;
          if (!picked) return 'wait';
          for (const u of shown) if (me.resolution.includes(u)) core.move(ctx, u, f.controller, 'resolution', picked.includes(u) ? 'hand' : 'waiting');
          return [sub(f, [{ op: 'moveCards', from: { zone: 'hand', side: 'self', count: { exactly: 1 } }, to: { zone: 'waitingRoom', side: 'self' } }])];
        }
        const st = shown.length === 1 ? shown : (ask(ctx, f, 'sel', { kind: 'select', player: f.controller, options: shown, min: 1, max: 1, shown, prompt: `${f.label}：選 1 張放到能量區，其餘加到手牌`, button: '放到能量區' }) as string[] | undefined);
        if (!st) return 'wait';
        for (const u of shown) if (me.resolution.includes(u)) core.move(ctx, u, f.controller, 'resolution', st.includes(u) ? 'stock' : 'hand');
        return 'done';
      }
      case 'memoryAndReturn': {
        // 對手的角色放到回憶區，再由對手放到舞台上喜歡的格子（變成新的卡）
        if (!f.tmp.moved) {
          const picked = pick(ctx, f, e.target, '選擇要放到回憶區的對手角色');
          if (!picked) return 'wait';
          const uid = picked[0];
          if (!uid) return 'done';
          moveTo(ctx, uid, 'memory');
          f.tmp.moved = uid;
        }
        const uid = f.tmp.moved as string;
        const opp = s.cards[uid]!.owner;
        if (!s.players[opp].memory.includes(uid)) return 'done';
        const slot = ask(ctx, f, 'slot', { kind: 'chooseSlot', player: opp, owner: opp, prompt: `對手的「${f.label}」：選擇「${cardOf(s, uid).name.zh}」要放回的格子`, slots: ALL_SLOTS }) as Slot | undefined;
        if (slot === undefined) return 'wait';
        const old = s.players[opp].stage[slot];
        if (old) moveTo(ctx, old.uid, 'waiting');
        moveTo(ctx, uid, 'stage', { toPlayer: opp, slot, state: 'stand' });
        return 'done';
      }
      case 'addMarker': {
        const host = e.to === 'source' ? f.src : f.ctx.target;
        if (!host || !onStage(s, host)) return 'done';
        const picked = pick(ctx, f, e.from, '選擇要放到角色下面的卡');
        if (!picked) return 'wait';
        for (const u of picked) {
          const loc = locate(s, u);
          if (!loc || loc.zone === 'stage') continue;
          const arr = s.players[loc.p][loc.zone as Exclude<GameZone, 'stage'>] as string[];
          arr.splice(arr.indexOf(u), 1);
          (s.markers[host] ??= []).push({ uid: u, faceUp: e.faceUp });
          const hostLoc = locate(s, host)!;
          ctx.ev.push({ t: 'move', uid: u, cardId: e.faceUp ? s.cards[u]!.cardId : null, from: { p: loc.p, zone: loc.zone }, to: { p: hostLoc.p, zone: 'stage', slot: hostLoc.slot! } });
          ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」把${e.faceUp ? `「${cardOf(s, u).name.zh}」` : '1 張卡'}放到「${cardOf(s, host).name.zh}」下面當標記` });
          if (loc.zone === 'deck') core.refreshIfNeeded(ctx, loc.p);
        }
        return 'done';
      }
      case 'toDeckTopOrdered': {
        const cands = candidates(s, e.from, f.src, f.controller, f.ctx);
        const max = e.max !== undefined ? amountOf(s, e.max, f.src, f.controller, f.binds, undefined, f.ctx)
          : e.from.count === 'all' ? cands.length : 'upTo' in e.from.count ? e.from.count.upTo : e.from.count.exactly;
        if (!cands.length || max <= 0) return 'done';
        const order = ask(ctx, f, 'sel', {
          kind: 'select', player: f.controller, options: cands, min: 0, max: Math.min(max, cands.length), ordered: true, button: '照這個順序放到牌組上方',
          prompt: `${f.label}：選最多 ${max} 張，依點選的順序放到牌組上方（先點的在最上面）`,
        }) as string[] | undefined;
        if (!order) return 'wait';
        for (const u of [...order].reverse()) moveTo(ctx, u, 'deck', { deckTop: true });
        return 'done';
      }
      case 'shieldAutoDamage':
        s.shields.push({ p: f.controller, uid: f.src, until: nextOppTurn(s, f.controller) });
        return 'done';
      case 'swapPositions': {
        // 2 張角色都直立並交換格子（不能移動的角色不換）
        const chosen = pick(ctx, f, e.target, e.withSource ? '選擇要和此卡交換位置的角色' : '選擇要交換位置的 2 張角色');
        if (!chosen) return 'wait';
        const picked = e.withSource ? (chosen.length && onStage(s, f.src) ? [f.src, ...chosen] : []) : chosen;
        const locs = picked.map((u) => locate(s, u));
        if (picked.length !== 2 || locs.some((l) => l?.zone !== 'stage') || locs[0]!.p !== locs[1]!.p) return 'done';
        for (const u of picked) setState(ctx, u, 'stand');
        if (picked.some((u) => hasRule(s, u, 'cannotMove'))) return 'done';
        const stage = s.players[locs[0]!.p].stage;
        const [a, b] = [locs[0]!.slot!, locs[1]!.slot!];
        [stage[a], stage[b]] = [stage[b]!, stage[a]!];
        ctx.ev.push({ t: 'move', uid: picked[0]!, cardId: s.cards[picked[0]!]!.cardId, from: { p: locs[0]!.p, zone: 'stage', slot: a }, to: { p: locs[0]!.p, zone: 'stage', slot: b } });
        ctx.ev.push({ t: 'move', uid: picked[1]!, cardId: s.cards[picked[1]!]!.cardId, from: { p: locs[0]!.p, zone: 'stage', slot: b }, to: { p: locs[0]!.p, zone: 'stage', slot: a } });
        return 'done';
      }
      case 'shiftSwap': {
        // シフト：手牌的 1 張放到傷害區此卡的位置，此卡加到手牌
        const i = me.clock.indexOf(f.src);
        if (i < 0) return 'done';
        const options = me.hand.filter((u) => filterOk(s, u, e.filter, f.src));
        if (!options.length) return 'done';
        const h = ask(ctx, f, 'sel', { kind: 'select', player: f.controller, prompt: `${f.label}：選 1 張手牌和傷害區的這張卡交換`, options, min: 1, max: 1 }) as string[] | undefined;
        if (!h) return 'wait';
        me.hand.splice(me.hand.indexOf(h[0]!), 1);
        me.clock[i] = h[0]!;
        me.hand.push(f.src);
        ctx.ev.push({ t: 'move', uid: h[0]!, cardId: s.cards[h[0]!]!.cardId, from: { p: f.controller, zone: 'hand' }, to: { p: f.controller, zone: 'clock' } });
        ctx.ev.push({ t: 'move', uid: f.src, cardId: s.cards[f.src]!.cardId, from: { p: f.controller, zone: 'clock' }, to: { p: f.controller, zone: 'hand' } });
        return 'done';
      }
      case 'pickHandRestStock': {
        // 選卡 → 其中 1 張加到手牌 → 其餘依點選順序放到能量區（先點的在下面）
        const picked = pick(ctx, f, e.from, '選擇卡片（1 張加到手牌，其餘放到能量區）');
        if (!picked) return 'wait';
        if (!picked.length) return 'done';
        const h = picked.length === 1 ? picked : (ask(ctx, f, 'hand', { kind: 'select', player: f.controller, prompt: `${f.label}：選 1 張加到手牌（其餘放到能量區）`, options: picked, min: 1, max: 1 }) as string[] | undefined);
        if (!h) return 'wait';
        const rest = picked.filter((u) => !h.includes(u));
        const order = rest.length <= 1 ? rest : (ask(ctx, f, 'order', { kind: 'select', player: f.controller, prompt: `${f.label}：依序點選放到能量區的順序（先點的先放）`, options: rest, min: rest.length, max: rest.length, ordered: true }) as string[] | undefined);
        if (!order) return 'wait';
        moveTo(ctx, h[0]!, 'hand');
        for (const u of order) moveTo(ctx, u, 'stock');
        return 'done';
      }
    }
  }

  // 玩家回應效果中的提問：把答案交給正在等待的那段效果，從同一步繼續
  function answer(ctx: Ctx, pend: Pending, value: string[] | boolean | number): string | null {
    const { s } = ctx;
    const top = s.queue[s.queue.length - 1];
    if (!top || top.k !== 'frame') return '找不到等待回應的效果';
    if (pend.kind === 'select') {
      const uids = value as string[];
      if (uids.length < pend.min || uids.length > pend.max) return pend.min === pend.max ? `請選 ${pend.min} 張` : `請選 ${pend.min}～${pend.max} 張`;
      if (new Set(uids).size !== uids.length || uids.some((u) => !pend.options.includes(u))) return '只能選可選的卡';
    }
    if (pend.kind === 'chooseOption') {
      const i = optionIndex(value);
      if (!Number.isInteger(i) || i < 0 || i >= pend.options.length) return '請選 1 個選項';
      value = i;
    }
    if (pend.kind === 'chooseSlot' && !pend.slots.includes(value as Slot)) return '不能選這個格子';
    if (pend.kind === 'confirm') ctx.ev.push({ t: 'log', p: pend.player, text: confirmLog(pend.prompt, value as boolean) });
    top.f.answer = value;
    s.pending = null;
    return null;
  }

  return {
    locate, abilitiesOf, activeContinuous, hasRule, levelOf, triggersOf, condOk, candidates, power, soul, costPayable, usedUp,
    fireFor, fireGlobal, fireAlly, fireAllyFrontAttacked, fireAllyLeaves, fireUsedActivated, viable, startAbility, startPlayed, runFrame, answer,
  };
}

export type Effects = ReturnType<typeof createEffects>;

// 「是／否」的回答寫進對戰紀錄
function confirmLog(prompt: string, yes: boolean): string {
  const line = prompt.split('\n')[0]!;
  const ability = line.match(/^要發動「(.+)」的效果嗎？$/);
  if (ability) return `${yes ? '選擇發動' : '選擇不發動'}「${ability[1]}」的效果`;
  const pay = line.match(/^(.+)：要支付費用並繼續嗎？$/);
  if (pay) return `「${pay[1]}」：${yes ? '支付費用' : '不支付費用'}`;
  const draw = line.match(/^(.+)：要抽 1 張嗎？/);
  if (draw) return `「${draw[1]}」：${yes ? '抽 1 張' : '不抽'}`;
  return `${line.replace(/？$/, '')}：${yes ? '是' : '否'}`;
}

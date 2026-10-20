// 效果系統：把卡片資料（時機＋條件＋費用＋動作）實際執行出來。
// 〔 〕為總合規則編號。持續效果不儲存，每次現場計算〔8.9〕；需要玩家選擇時暫停，等回應後從同一步繼續。
import type { Ability, Amount, Card, CardFilter, Condition, Cost, Effect, Selector, Zone as SchemaZone } from '../card-schema.ts';
import type { Frame, FrameCtx, GameEvent, GameState, GameZone, InternalOp, Pending, PlayerId, Slot, StandbyAbility, Step } from './types.ts';

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

const ZONE: Record<SchemaZone, GameZone> = {
  hand: 'hand', deck: 'deck', waitingRoom: 'waiting', stage: 'stage', stock: 'stock', clock: 'clock', level: 'level', climaxZone: 'climax', memory: 'memory',
};
const ZONES: GameZone[] = ['deck', 'hand', 'waiting', 'clock', 'level', 'stock', 'climax', 'memory', 'resolution'];
const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const FRONT_OF: Record<number, Slot[]> = { 3: [0, 1], 4: [1, 2] }; // 後列的「前」〔3.6.5〕

type Done = 'done' | 'wait' | 'abort' | Step[];

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

  // 目前有效的【永】能力：舞台上的角色、名場面區的名場面〔2.12.2〕
  function activeContinuous(s: GameState): { src: string; controller: PlayerId; ability: Ability }[] {
    const out: { src: string; controller: PlayerId; ability: Ability }[] = [];
    for (const p of [0, 1] as PlayerId[]) {
      const pl = s.players[p];
      const srcs = [...pl.stage.flatMap((c, slot) => (c ? [{ uid: c.uid, slot }] : [])), ...pl.climax.map((uid) => ({ uid, slot: -1 }))];
      for (const { uid, slot } of srcs) {
        for (const ability of cardOf(s, uid).abilities) {
          if (ability.kind !== 'continuous') continue;
          if (ability.keyword?.id === 'assist' && slot < 3) continue; // 應援只在後列有效〔10.3.2〕
          if (ability.condition && !condOk(s, ability.condition, uid, p, {})) continue;
          out.push({ src: uid, controller: p, ability });
        }
      }
    }
    return out;
  }

  // ── 條件 ──
  function condOk(s: GameState, c: Condition, src: string, controller: PlayerId, fctx: FrameCtx): boolean {
    const pl = s.players[controller];
    switch (c.kind) {
      case 'all':
        return c.of.every((x) => condOk(s, x, src, controller, fctx));
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
      case 'sourceInSlot':
        return c.slots.includes(pl.stage.findIndex((x) => x?.uid === src));
      case 'opponentInFront': {
        const slot = pl.stage.findIndex((x) => x?.uid === src);
        return slot >= 0 && slot < 3 && !!s.players[other(controller)].stage[2 - slot];
      }
      case 'placedThisTurnFromHand':
        return s.placedThisTurn.includes(src) && onStage(s, src);
      case 'battleOpponentLevelAtMost': {
        const opp = battleOpponent(s, src, fctx);
        return !!opp && (cardOf(s, opp).level ?? 0) <= c.n;
      }
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

  // 等級：名場面算 0
  const levelOf = (s: GameState, uid: string) => (cardOf(s, uid).type === 'climax' ? 0 : (cardOf(s, uid).level ?? 0));

  // ── 選卡的候選 ──
  function filterOk(s: GameState, uid: string, f: CardFilter | undefined, src: string): boolean {
    if (!f) return true;
    const c = cardOf(s, uid);
    if (f.anyOf && !f.anyOf.some((x) => filterOk(s, uid, x, src))) return false;
    if (f.nameIncludes && !f.nameIncludes.some((n) => c.name.ja.includes(n))) return false;
    if (f.levelAtMostPlayerLevel) {
      const owner = locate(s, src)?.p ?? s.cards[src]!.owner;
      if ((c.level ?? 0) > s.players[owner].level.length) return false;
    }
    if (f.levelAtLeast !== undefined && (c.type === 'climax' ? 0 : (c.level ?? 0)) < f.levelAtLeast) return false;
    if (f.hasTrigger && !c.triggers.includes(f.hasTrigger)) return false;
    if (f.type && c.type !== f.type) return false;
    if (f.color && c.color !== f.color) return false;
    if (f.trait && !c.traits.some((t) => t.ja === f.trait)) return false;
    if (f.name && c.name.ja !== f.name) return false;
    if (f.costAtMost !== undefined && (c.cost ?? 0) > f.costAtMost) return false;
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
      if (sel.relation === 'frontOfSource') {
        const srcSlot = pl.stage.findIndex((c) => c?.uid === src);
        const front = FRONT_OF[srcSlot] ?? [];
        slots = slots.filter((x) => front.includes(x.i as Slot));
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
    } else {
      const zone = ZONE[sel.zone] as Exclude<GameZone, 'stage'>;
      list = [...(pl[zone] as string[])];
      if (sel.zone === 'deck' && sel.fromTop !== undefined) list = list.slice(0, sel.fromTop);
      if (sel.position === 'top' && sel.zone !== 'deck') list = list.slice(-1);
    }
    return list.filter((u) => filterOk(s, u, sel.filter, src));
  }
  const targets = candidates; // 【永】的對象一律是「全部」

  // ── 數值 ──
  function amountOf(s: GameState, amt: Amount, src: string, controller: PlayerId, binds: Record<string, string[]>, target?: string): number {
    if (typeof amt === 'number') return amt;
    if ('per' in amt) return candidates(s, amt.per, src, controller, {}).length * amt.multiplier;
    if ('perSoulOf' in amt) return candidates(s, amt.perSoulOf, src, controller, {}).reduce((n, u) => n + soul(s, u), 0) * amt.multiplier;
    if ('perSoulOfBound' in amt) return (binds[amt.perSoulOfBound] ?? []).reduce((n, u) => n + soul(s, u), 0) * amt.multiplier;
    if ('countOfBound' in amt) return (binds[amt.countOfBound] ?? []).filter((u) => filterOk(s, u, amt.filter, src)).length;
    if ('perLevelOfTarget' in amt) return target ? (cardOf(s, target).level ?? 0) * amt.multiplier : 0;
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
  function costPayable(s: GameState, costs: Cost[], src: string, controller: PlayerId): boolean {
    const pl = s.players[controller];
    let stock = 0;
    for (const c of costs) {
      if (c.kind === 'stock') stock += c.n;
      if (c.kind === 'restSource' && pl.stage.find((x) => x?.uid === src)?.state !== 'stand') return false;
      if (c.kind === 'discardSource' && !pl.hand.includes(src)) return false;
      if ((c.kind === 'sendSourceToWaitingRoom' || c.kind === 'sourceToDeckBottom') && !onStage(s, src)) return false;
      if (c.kind === 'discard' || c.kind === 'rest') {
        const need = c.selector.count === 'all' ? 0 : 'exactly' in c.selector.count ? c.selector.count.exactly : 0;
        const cands = candidates(s, c.selector, src, controller, {}).filter((u) => !(c.kind === 'discard' && u === src));
        if (cands.length < need) return false;
      }
    }
    return pl.stock.length >= stock;
  }
  const costOps = (costs: Cost[]): InternalOp[] =>
    costs.map((c): InternalOp => {
      switch (c.kind) {
        case 'stock': return { op: '_payStock', n: c.n };
        case 'restSource': return { op: '_restSource' };
        case 'discard': return { op: '_discard', selector: c.selector };
        case 'discardSource': return { op: '_discardSource' };
        case 'sendSourceToWaitingRoom': return { op: '_sendSourceToWR' };
        case 'rest': return { op: '_rest', selector: c.selector };
        case 'sourceToDeckBottom': return { op: '_sourceToDeckBottom' };
      }
    });

  // ── 誘發：把自動能力放進待機〔8.7.2〕──
  function standby(s: GameState, src: string, controller: PlayerId, ability: Ability, fctx: FrameCtx) {
    s.standby.push({ id: s.nextId++, src, controller, ability, ctx: fctx });
  }

  // 與特定一張卡有關的誘發（此卡攻擊時、此卡倒置時…）
  function fireFor(s: GameState, uid: string, event: string, fctx: FrameCtx = {}, abilities?: Ability[], controller?: PlayerId) {
    const who = controller ?? locate(s, uid)?.p ?? s.cards[uid]!.owner;
    for (const a of abilities ?? abilitiesOf(s, uid)) if (a.kind === 'auto' && a.trigger?.event === event) standby(s, uid, who, a, fctx);
  }

  // 與時點有關的誘發（階段開始時、名場面放置時…）：檢查雙方舞台上的角色
  // card：名場面放置時是那張名場面，判定時是翻出來的卡
  function fireGlobal(s: GameState, event: 'climaxPlaced' | 'encoreStepStart' | 'myClimaxPhaseStart' | 'opponentAttackPhaseStart' | 'myTriggerChecked', card?: string) {
    for (const p of [s.turnPlayer, other(s.turnPlayer)]) {
      for (const c of s.players[p].stage) {
        if (!c) continue;
        for (const a of abilitiesOf(s, c.uid)) {
          const t = a.trigger;
          if (a.kind !== 'auto' || !t || t.event !== event) continue;
          if (t.event === 'climaxPlaced') {
            const owner = locate(s, card!)?.p;
            if ((t.side === 'self') !== (owner === p)) continue;
            if (!filterOk(s, card!, t.filter, c.uid)) continue;
          }
          if (t.event === 'myTriggerChecked' && (s.turnPlayer !== p || !filterOk(s, card!, t.filter, c.uid))) continue;
          if (t.event === 'encoreStepStart' && t.side === 'self' && s.turnPlayer !== p) continue;
          if (t.event === 'encoreStepStart' && t.side === 'opponent' && s.turnPlayer === p) continue;
          if (t.event === 'myClimaxPhaseStart' && s.turnPlayer !== p) continue;
          if (t.event === 'opponentAttackPhaseStart' && s.turnPlayer === p) continue;
          standby(s, c.uid, p, a, {});
        }
      }
    }
  }

  // 「你的其他角色被正打時」：防守方舞台上其他角色的能力
  function fireAllyFrontAttacked(s: GameState, defender: string) {
    const p = locate(s, defender)?.p;
    if (p === undefined) return;
    for (const c of s.players[p].stage) {
      if (!c || c.uid === defender) continue;
      for (const a of abilitiesOf(s, c.uid)) {
        const t = a.trigger;
        if (a.kind === 'auto' && t?.event === 'allyFrontAttacked' && filterOk(s, defender, t.filter, c.uid)) standby(s, c.uid, p, a, {});
      }
    }
  }

  // ── 自動能力開始解決 ──
  const newFrame = (s: GameState, src: string, controller: PlayerId, effects: Frame['effects'], fctx: FrameCtx): Frame => ({
    src, controller, label: cardOf(s, src).name.zh, effects, i: 0, binds: {}, ctx: fctx, tmp: {},
  });

  // 這個待機的能力解決時會不會真的做事（條件、費用、安可的對象還在不在）
  function viable(s: GameState, w: StandbyAbility): boolean {
    const a = w.ability;
    // 安可：卡已經不在休息室、或原本的格子被占用，就沒有意義〔10.2.2〕
    if (a.keyword?.id === 'encore' && (!s.players[w.controller].waiting.includes(w.src) || w.ctx.slot === undefined || s.players[w.controller].stage[w.ctx.slot])) return false;
    if (a.condition && !condOk(s, a.condition, w.src, w.controller, w.ctx)) return false;
    if (a.cost && !costPayable(s, a.cost, w.src, w.controller)) return false;
    // 只有「移到前列空格」的能力：自己不在舞台上、或前列沒有空格，就沒有可以做的事，不問玩家
    if (a.effects.length > 0 && a.effects.every((e) => e.op === 'moveSourceToSlot')) {
      const stage = s.players[w.controller].stage;
      if (!stage.some((c) => c?.uid === w.src) || ([0, 1, 2] as const).every((i) => stage[i])) return false;
    }
    return true;
  }

  function startAbility(ctx: Ctx, w: StandbyAbility) {
    const { s } = ctx;
    const a = w.ability;
    if (!viable(s, w)) return;
    ctx.ev.push({ t: 'ability', uid: w.src, cardId: s.cards[w.src]!.cardId, text: a.text.zh });
    const name = cardOf(s, w.src).name.zh;
    const ops: Frame['effects'] = [];
    if (a.optional) ops.push({ op: '_confirm', prompt: `要發動「${name}」的效果嗎？\n${a.text.zh}` });
    ops.push(...costOps(a.cost ?? []), ...a.effects);
    runFrame(ctx, newFrame(s, w.src, w.controller, ops, w.ctx));
  }

  // 起動能力、事件、助太刀：先付費再執行
  function startPlayed(ctx: Ctx, src: string, controller: PlayerId, ability: Ability, extra: InternalOp[] = []) {
    const { s } = ctx;
    ctx.ev.push({ t: 'ability', uid: src, cardId: s.cards[src]!.cardId, text: ability.text.zh });
    runFrame(ctx, newFrame(s, src, controller, [...costOps(ability.cost ?? []), ...ability.effects, ...extra], {}));
  }

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
    if (sel.fromBind) return (f.tmp[key] = (f.binds[sel.fromBind] ?? []).filter((u) => locate(ctx.s, u)?.zone === ZONE[sel.zone])) as string[];
    const cands = candidates(ctx.s, sel, f.src, f.controller, f.ctx);
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
  // 「給對手確認」「公開」：讓對手看過並按確認；回傳 true＝已確認可以繼續
  const showOpponent = (ctx: Ctx, f: Frame, cards: string[], what: string) =>
    ask(ctx, f, 'ack', { kind: 'acknowledge', player: other(f.controller), prompt: `對手的「${f.label}」：${what}的卡`, cards }) !== undefined;

  function moveTo(ctx: Ctx, uid: string, to: GameZone, opts: MoveOpts = {}) {
    const loc = locate(ctx.s, uid);
    if (!loc) return;
    core.move(ctx, uid, loc.p, loc.zone, to, { fromSlot: loc.slot, ...opts });
    if (loc.zone === 'deck') core.refreshIfNeeded(ctx, loc.p);
  }

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
      case '_payStock':
        core.payStock(ctx, f.controller, e.n);
        return 'done';
      case '_discard': {
        const sel = { ...e.selector, filter: { ...e.selector.filter, excludeSource: false } };
        const picked = pick(ctx, f, sel, '選擇要放到休息室的手牌');
        if (!picked) return 'wait';
        for (const u of picked) moveTo(ctx, u, 'waiting');
        return 'done';
      }
      case '_discardSource':
        if (me.hand.includes(f.src)) moveTo(ctx, f.src, 'waiting');
        return 'done';
      case '_restSource': {
        const c = me.stage.find((x) => x?.uid === f.src);
        if (c && c.state !== 'rest') {
          c.state = 'rest';
          ctx.ev.push({ t: 'cardState', uid: c.uid, state: 'rest' });
        }
        return 'done';
      }
      case '_sendSourceToWR':
        if (onStage(s, f.src)) moveTo(ctx, f.src, 'waiting');
        return 'done';
      case '_sourceToDeckBottom':
        if (onStage(s, f.src)) moveTo(ctx, f.src, 'deck'); // 不指定上方＝放到最下面
        return 'done';
      case '_rest': {
        const picked = pick(ctx, f, e.selector, '選擇要橫置的角色');
        if (!picked) return 'wait';
        for (const u of picked) {
          const c = me.stage.find((x) => x?.uid === u);
          if (c) {
            c.state = 'rest';
            ctx.ev.push({ t: 'cardState', uid: u, state: 'rest' });
          }
        }
        return 'done';
      }
      case '_fireUsedBackup':
        fireFor(s, f.src, 'usedBackup', {}, cardOf(s, f.src).abilities, f.controller);
        return 'done';
      case '_eventDone':
        if (me.resolution.includes(f.src)) core.move(ctx, f.src, f.controller, 'resolution', 'waiting');
        return 'done';

      // ── 卡片效果 ──
      case 'modifyPower':
      case 'modifySoul': {
        if (e.duration === 'whileActive') return 'done'; // 【永】在計算時處理
        const picked = pick(ctx, f, e.target, '選擇角色');
        if (!picked) return 'wait';
        // 「到下次的對手回合結束前」：現在是自己的回合就是下一回合，是對手的回合就是下下回合
        const until = e.duration === 'untilNextOpponentTurnEnd' ? s.turn + (s.turnPlayer === f.controller ? 1 : 2) : undefined;
        for (const u of picked) {
          if (!onStage(s, u)) continue;
          const n = e.op === 'modifyPower' ? amountOf(s, e.amount, f.src, f.controller, f.binds, u) : e.amount;
          s.mods.push({ uid: u, power: e.op === 'modifyPower' ? n : 0, soul: e.op === 'modifySoul' ? n : 0, ...(until ? { until } : {}) });
        }
        return 'done';
      }
      case 'moveCards': {
        const picked = pick(ctx, f, e.from, '選擇卡片');
        if (!picked) return 'wait';
        const to = ZONE[e.to.zone];
        if (to === 'stage') {
          // 放到舞台上沒有角色的格子（一次一張）
          const uid = picked[0];
          if (!uid) return 'done';
          const p = e.to.side ? (e.to.side === 'self' ? f.controller : other(f.controller)) : s.cards[uid]!.owner;
          // slot any（舞台的好きな枠）：任何格子都可以，有角色的話原本的角色進休息室〔9.6.2〕
          const slots = ([0, 1, 2, 3, 4] as Slot[]).filter((i) => e.to.slot === 'any' || !s.players[p].stage[i]);
          if (!slots.length) return 'done';
          const slot = slots.length === 1 ? slots[0] : (ask(ctx, f, 'slot', { kind: 'chooseSlot', player: f.controller, owner: p, prompt: `${f.label}：選擇要放的格子`, slots }) as Slot | undefined);
          if (slot === undefined) return 'wait';
          const fromHand = locate(s, uid)?.zone === 'hand';
          const old = s.players[p].stage[slot];
          if (old) moveTo(ctx, old.uid, 'waiting');
          moveTo(ctx, uid, 'stage', { toPlayer: p, slot, state: e.to.state === 'rest' ? 'rest' : 'stand' });
          if (e.bind) f.binds[e.bind] = [uid];
          // 從手牌放到舞台：誘發「從手牌被放置到舞台時」〔效果放置也算〕
          if (fromHand) {
            s.placedThisTurn.push(uid);
            fireFor(s, uid, 'placedFromHandToStage');
          }
          return 'done';
        }
        for (const u of picked) {
          if (to === 'hand' && locate(s, u)?.zone === 'deck') ctx.ev.push({ t: 'reveal', uid: u, cardId: s.cards[u]!.cardId });
          const p = e.to.side ? (e.to.side === 'self' ? f.controller : other(f.controller)) : s.cards[u]!.owner;
          moveTo(ctx, u, to, { toPlayer: p, deckTop: e.to.position === 'top' });
        }
        if (e.bind) f.binds[e.bind] = picked;
        return 'done';
      }
      case 'draw': {
        // 「最多抽 N 張」：一張一張問
        const total = amountOf(s, e.upTo, f.src, f.controller, f.binds);
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
        return 'done';
      }
      case 'lookTopPick': {
        // 看牌組上方 N 張：一定把翻開的牌給玩家看（只有自己看得到），沒有符合的也要看過再放到休息室
        if (!f.tmp.done) {
          const looked = me.deck.slice(0, typeof e.look === 'number' ? e.look : amountOf(s, e.look, f.src, f.controller, f.binds));
          if (!looked.length) return 'done';
          const matches = looked.filter((u) => filterOk(s, u, e.pick.filter, f.src));
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
          const options = me.deck.filter((u) => filterOk(s, u, e.filter, f.src));
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
          const match = filterOk(s, top, e.filter, f.src);
          ctx.ev.push({ t: 'log', p: f.controller, text: `「${f.label}」公開牌組上方的「${cardOf(s, top).name.zh}」→ ${match ? '加到手牌' : '放回牌組上方'}` });
        }
        const top = f.tmp.top as string;
        const match = filterOk(s, top, e.filter, f.src);
        const name = cardOf(s, top).name.zh;
        const ok = ask(ctx, f, 'ack', {
          kind: 'acknowledge', player: f.controller, cards: [top], button: match ? '加到手牌' : '放回牌組上方',
          prompt: `${f.label}：公開了牌組上方的「${name}」。${match ? '符合條件，加到手牌' : '不符合條件，放回牌組最上面'}`,
        });
        if (ok === undefined) return 'wait';
        if (!me.resolution.includes(top)) return 'done';
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
          const x = milled.filter((u) => cardOf(s, u).type === 'climax').length;
          ctx.ev.push({
            t: 'log', p: f.controller,
            text: `「${f.label}」翻開牌組上方 ${milled.length} 張，其中 ${x} 張名場面${e.result === 'draw' ? (x ? `，抽 ${x} 張` : '，不抽牌') : (x ? `，給對手 ${x} 點傷害` : '，沒有傷害')}`,
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
            : (x ? `${f.label}：翻到 ${x} 張名場面，給對手 ${x} 點傷害` : `${f.label}：沒有翻到名場面，不造成傷害`),
          button: draw ? (x ? `抽 ${x} 張` : '放到休息室') : (x ? `給對手 ${x} 點傷害` : '放到休息室'),
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
        const n = amountOf(s, e.amount, f.src, f.controller, f.binds);
        return n > 0 ? [{ k: 'damage', p: other(f.controller), n }] : 'done';
      }
      case 'drawCards': {
        const n = amountOf(s, e.n, f.src, f.controller, f.binds);
        for (let i = 0; i < n; i++) core.drawOne(ctx, f.controller);
        return 'done';
      }
      case 'moveSourceToSlot': {
        const from = me.stage.findIndex((c) => c?.uid === f.src);
        if (from < 0) return 'done';
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
        for (const u of picked) s.grants.push({ uid: u, ability: e.ability });
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
        if (s.attack) s.attack.checks = 2;
        return 'done';
      case 'moveToOtherEmptySlot': {
        const picked = pick(ctx, f, e.target, '選擇要移動的角色');
        if (!picked) return 'wait';
        const uid = picked[0];
        const loc = uid ? locate(s, uid) : null;
        if (!uid || loc?.zone !== 'stage') return 'done';
        const stage = s.players[loc.p].stage;
        const empty = ([0, 1, 2, 3, 4] as Slot[]).filter((i) => !stage[i]);
        if (!empty.length) return 'done';
        const slot = empty.length === 1 ? empty[0] : (ask(ctx, f, 'slot', { kind: 'chooseSlot', player: f.controller, owner: loc.p, prompt: `${f.label}：選擇要移動到的格子`, slots: empty }) as Slot | undefined);
        if (slot === undefined) return 'wait';
        stage[slot] = stage[loc.slot!]!;
        stage[loc.slot!] = null;
        ctx.ev.push({ t: 'move', uid, cardId: s.cards[uid]!.cardId, from: { p: loc.p, zone: 'stage', slot: loc.slot! }, to: { p: loc.p, zone: 'stage', slot } });
        return 'done';
      }
      case 'lookTopHandAndStock': {
        // 看上方 N 張 → 選最多 2 張給對手確認 → 其中 1 張加到手牌、1 張放到能量區 → 其餘放休息室
        const looked = (f.tmp.looked as string[] | undefined) ?? me.deck.slice(0, e.look);
        f.tmp.looked = looked;
        if (!looked.length) return 'done';
        const matches = looked.filter((u) => filterOk(s, u, e.filter, f.src));
        const picked = ask(ctx, f, 'sel', {
          kind: 'select', player: f.controller, options: matches, min: 0, max: Math.min(2, matches.length), shown: looked, button: '確定（其餘放到休息室）',
          prompt: matches.length
            ? `${f.label}：牌組上方 ${looked.length} 張，選最多 2 張給對手確認（1 張加到手牌、1 張放到能量區），其餘放到休息室`
            : `${f.label}：牌組上方 ${looked.length} 張裡沒有可以拿的卡，全部放到休息室`,
        }) as string[] | undefined;
        if (!picked) return 'wait';
        if (picked.length) {
          if (!f.tmp.revealed) {
            for (const u of picked) ctx.ev.push({ t: 'reveal', uid: u, cardId: s.cards[u]!.cardId });
            f.tmp.revealed = true;
          }
          if (!showOpponent(ctx, f, picked, '選出')) return 'wait';
        }
        let toHand = picked.slice(0, 1);
        if (picked.length === 2) {
          const h = ask(ctx, f, 'hand', { kind: 'select', player: f.controller, prompt: `${f.label}：選 1 張加到手牌（另一張放到能量區）`, options: picked, min: 1, max: 1 }) as string[] | undefined;
          if (!h) return 'wait';
          toHand = h;
        }
        for (const u of toHand) core.move(ctx, u, f.controller, 'deck', 'hand');
        for (const u of picked) if (!toHand.includes(u)) core.move(ctx, u, f.controller, 'deck', 'stock');
        for (const u of looked) if (!picked.includes(u)) core.move(ctx, u, f.controller, 'deck', 'waiting');
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
        const options = me.waiting.filter((u) => cardOf(s, u).type === 'character' && (cardOf(s, u).level ?? 0) <= x);
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
        if (c.state !== 'rest') {
          c.state = 'rest';
          ctx.ev.push({ t: 'cardState', uid, state: 'rest' });
        }
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
      case 'lookOpponentTopPlace': {
        // 看對手牌組上方 1 張（只有自己看得到），決定放回上方或放到下方
        const opp = other(f.controller);
        const top = (f.tmp.top as string | undefined) ?? s.players[opp].deck[0];
        if (!top) return 'done';
        f.tmp.top = top;
        const sel = ask(ctx, f, 'sel', {
          kind: 'select', player: f.controller, options: [top], min: 0, max: 1, shown: [top], button: '確定',
          prompt: `${f.label}：對手牌組最上面的卡。選這張＝放到牌組最下面；不選＝放回最上面`,
        }) as string[] | undefined;
        if (!sel) return 'wait';
        if (sel.length) core.move(ctx, top, opp, 'deck', 'deck'); // 放到最下面
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
    if (pend.kind === 'chooseSlot' && !pend.slots.includes(value as Slot)) return '不能選這個格子';
    if (pend.kind === 'confirm') ctx.ev.push({ t: 'log', p: pend.player, text: confirmLog(pend.prompt, value as boolean) });
    top.f.answer = value;
    s.pending = null;
    return null;
  }

  return { locate, abilitiesOf, activeContinuous, condOk, candidates, power, soul, costPayable, fireFor, fireGlobal, fireAllyFrontAttacked, viable, startAbility, startPlayed, runFrame, answer };
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

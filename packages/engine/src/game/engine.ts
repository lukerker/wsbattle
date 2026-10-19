// 規則引擎核心。純函式：apply(狀態, 動作) 回傳新狀態與事件列表，不修改傳入的狀態。
// 規則依據：總合規則 ver.1.113，〔 〕內為規則編號，對照 docs/引擎規格.md。
// 卡片能力由 effects.ts 執行；這裡負責回合流程、規則處理，以及在對的時點誘發能力。
import type { Card } from '../card-schema.ts';
import { DEFAULT_ENCORE, createEffects, type Core, type Ctx, type MoveOpts } from './effects.ts';
import { nextRandom, shuffleInPlace } from './rng.ts';
import { FRONT, type Action, type ApplyResult, type AttackMode, type GameState, type GameZone, type Pending, type PlayerId, type PlayerState, type Slot, type Step } from './types.ts';

const HAND_LIMIT = 7; // 〔3.3.3.1〕
const MAX_STEPS = 10000; // 結算次數上限，防止無窮迴圈

const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);
const emptyPlayer = (): PlayerState => ({
  deck: [], hand: [], waiting: [], clock: [], level: [], stock: [], climax: [], memory: [], resolution: [], stage: [null, null, null, null, null],
});
// 我方前列格子正面的對手格子〔3.6.6〕
const facing = (slot: Slot): Slot => (2 - slot) as Slot;

export interface NewGameOptions {
  seed: number;
  decks: [string[], string[]]; // 各 50 張的卡號
}

export function createEngine(db: ReadonlyMap<string, Card>) {
  const cardOf = (s: GameState, uid: string): Card => {
    const c = db.get(s.cards[uid]!.cardId);
    if (!c) throw new Error(`找不到卡片資料：${s.cards[uid]!.cardId}`);
    return c;
  };
  const playerLevel = (s: GameState, p: PlayerId) => s.players[p].level.length;
  const isPublic = (zone: GameZone) => zone !== 'deck' && zone !== 'hand' && zone !== 'stock';

  // ── 卡片移動 ──
  function move(ctx: Ctx, uid: string, p: PlayerId, from: GameZone, to: GameZone, opts: MoveOpts = {}) {
    const { s } = ctx;
    const src = s.players[p];
    let leaving: { slot: Slot; abilities: Card['abilities'] } | null = null;
    if (from === 'stage') {
      const i = src.stage.findIndex((c) => c?.uid === uid) as Slot;
      // 離開舞台時，用在舞台上的資訊判斷要誘發哪些能力〔8.7.4.1.2〕
      leaving = { slot: i, abilities: [...fx.abilitiesOf(s, uid), DEFAULT_ENCORE] };
      src.stage[i] = null;
      // 離開舞台就是新的一張卡，原本的效果不再適用〔3.1.4〕
      s.mods = s.mods.filter((m) => m.uid !== uid);
      s.grants = s.grants.filter((g) => g.uid !== uid);
      s.placedThisTurn = s.placedThisTurn.filter((u) => u !== uid);
    } else {
      const arr = src[from];
      arr.splice(arr.indexOf(uid), 1);
    }
    const tp = opts.toPlayer ?? p;
    const dst = s.players[tp];
    if (to === 'stage') dst.stage[opts.slot!] = { uid, state: opts.state ?? 'stand' };
    else if (to === 'deck' && opts.deckTop) dst.deck.unshift(uid);
    else dst[to].push(uid);
    const shown = isPublic(from) || isPublic(to);
    ctx.ev.push({
      t: 'move', uid, cardId: shown ? s.cards[uid]!.cardId : null,
      from: { p, zone: from, ...(opts.fromSlot !== undefined ? { slot: opts.fromSlot } : {}) },
      to: { p: tp, zone: to, ...(opts.slot !== undefined ? { slot: opts.slot } : {}) },
    });
    if (leaving && to === 'waiting') fx.fireFor(s, uid, 'sourceLeavesStageToWaitingRoom', { slot: leaving.slot }, leaving.abilities, p); // 安可等
  }

  const then = (s: GameState, ...steps: Step[]) => s.queue.push(...steps.reverse());

  // ── 牌組：用完立刻重洗〔9.2〕──
  function refreshIfNeeded(ctx: Ctx, p: PlayerId) {
    const pl = ctx.s.players[p];
    if (pl.deck.length > 0 || pl.waiting.length === 0) return;
    for (const uid of [...pl.waiting]) move(ctx, uid, p, 'waiting', 'deck');
    shuffleInPlace(ctx.s, pl.deck);
    ctx.ev.push({ t: 'refresh', p }, { t: 'shuffle', p });
    // 重洗懲罰：牌組最上面 1 張放到傷害區〔9.2.2〕
    move(ctx, pl.deck[0]!, p, 'deck', 'clock');
    then(ctx.s, { k: 'levelCheck', p });
    refreshIfNeeded(ctx, p);
  }

  function drawOne(ctx: Ctx, p: PlayerId): boolean {
    const pl = ctx.s.players[p];
    refreshIfNeeded(ctx, p);
    if (pl.deck.length === 0) return false;
    move(ctx, pl.deck[0]!, p, 'deck', 'hand');
    refreshIfNeeded(ctx, p);
    return true;
  }

  function shuffle(ctx: Ctx, p: PlayerId) {
    shuffleInPlace(ctx.s, ctx.s.players[p].deck);
    ctx.ev.push({ t: 'shuffle', p });
  }

  function payStock(ctx: Ctx, p: PlayerId, n: number) {
    for (let i = 0; i < n; i++) move(ctx, ctx.s.players[p].stock.at(-1)!, p, 'stock', 'waiting');
  }

  const core: Core = { cardOf, move, then, drawOne, refreshIfNeeded, shuffle, payStock };
  const fx = createEffects(core);
  const { power, soul } = fx;

  // ── 傷害處理〔4.12〕：回傳是否被取消 ──
  function dealDamage(ctx: Ctx, p: PlayerId, n: number): 'cancel' | 'clock' | 'lose' {
    const { s } = ctx;
    const pl = s.players[p];
    ctx.ev.push({ t: 'damage', p, n });
    const revealed: string[] = [];
    while (revealed.length < n) {
      refreshIfNeeded(ctx, p);
      if (pl.deck.length === 0) {
        // 牌組與休息室都空、解決領域沒有名場面 → 立刻敗北〔9.2.2.1〕
        lose(ctx, p);
        return 'lose';
      }
      const uid = pl.deck[0]!;
      move(ctx, uid, p, 'deck', 'resolution');
      revealed.push(uid);
      if (cardOf(s, uid).type === 'climax') {
        for (const u of revealed) move(ctx, u, p, 'resolution', 'waiting');
        ctx.ev.push({ t: 'damageCancel', p });
        return 'cancel';
      }
    }
    for (const u of revealed) move(ctx, u, p, 'resolution', 'clock');
    then(s, { k: 'levelCheck', p });
    return 'clock';
  }

  function lose(ctx: Ctx, p: PlayerId) {
    ctx.s.winner = other(p);
    ctx.s.phase = 'gameOver';
    ctx.s.pending = null;
    ctx.ev.push({ t: 'gameOver', winner: ctx.s.winner });
  }

  // ── 檢查型規則處理〔9.4～9.6〕──
  function ruleCheck(ctx: Ctx) {
    const { s } = ctx;
    if (s.winner !== null) return;
    const losers = ([0, 1] as PlayerId[]).filter((p) => {
      const pl = s.players[p];
      return pl.level.length >= 4 || (pl.deck.length === 0 && pl.waiting.length === 0);
    });
    if (losers.length === 2) {
      s.winner = 'draw';
      s.phase = 'gameOver';
      s.pending = null;
      ctx.ev.push({ t: 'gameOver', winner: 'draw' });
      return;
    }
    if (losers.length === 1) return lose(ctx, losers[0]!);
    for (const p of [s.turnPlayer, other(s.turnPlayer)]) {
      const pl = s.players[p];
      pl.stage.forEach((c, i) => {
        if (c && power(s, c.uid) <= 0) move(ctx, c.uid, p, 'stage', 'waiting', { fromSlot: i as Slot }); // 攻擊力 0 以下〔9.5〕
      });
      if (pl.climax.length > 1) for (const u of pl.climax.slice(0, -1)) move(ctx, u, p, 'climax', 'waiting'); // 〔9.6.2〕
    }
  }

  // ── 出牌條件〔8.6.2.1〕──
  function colorOk(s: GameState, p: PlayerId, card: Card): boolean {
    if ((card.type === 'character' || card.type === 'event') && (card.level ?? 0) === 0) return true;
    if (card.abilities.some((a) => a.rules?.includes('ignoreColorRequirement'))) return true;
    const pl = s.players[p];
    return [...pl.level, ...pl.clock].some((u) => cardOf(s, u).color === card.color);
  }
  function playProblem(s: GameState, p: PlayerId, uid: string): string | null {
    const card = cardOf(s, uid);
    if (!s.players[p].hand.includes(uid)) return '這張卡不在你的手牌';
    if (card.type !== 'climax' && (card.level ?? 0) > playerLevel(s, p)) return `等級不足（需要 Lv${card.level}）`;
    if (!colorOk(s, p, card)) return '顏色條件不符：等級區或傷害區沒有同色的卡';
    if ((card.cost ?? 0) > s.players[p].stock.length) return `能量不足（需要 ${card.cost}）`;
    return null;
  }

  // 起動能力能不能用（主要階段）
  function activateProblem(s: GameState, p: PlayerId, uid: string, index: number): string | null {
    const slot = s.players[p].stage.findIndex((c) => c?.uid === uid);
    if (slot < 0) return '這張卡不在你的舞台上';
    const a = fx.abilitiesOf(s, uid)[index];
    if (!a || a.kind !== 'activated' || a.timing === 'counter') return '這不是可以在主要階段使用的起動能力';
    if (a.condition && !fx.condOk(s, a.condition, uid, p, {})) return '條件不符';
    if (!fx.costPayable(s, a.cost ?? [], uid, p)) return '付不起費用';
    return null;
  }

  // 助太刀能不能用（對手正打時的反擊步驟）〔10.5〕
  function backupOptions(s: GameState, p: PlayerId): string[] {
    if (s.attack?.mode !== 'front') return [];
    return s.players[p].hand.filter((u) => {
      const a = cardOf(s, u).abilities.find((x) => x.keyword?.id === 'backup');
      if (!a || a.keyword?.id !== 'backup') return false;
      return playerLevel(s, p) >= a.keyword.level && fx.costPayable(s, a.cost ?? [], u, p);
    });
  }

  const attackable = (s: GameState): Slot[] => {
    if (s.turn === 1 && s.attacksThisTurn >= 1) return []; // 先攻第 1 回合只能攻擊 1 次〔7.2.1.3.1.2〕
    return FRONT.filter((i) => s.players[s.turnPlayer].stage[i]?.state === 'stand');
  };

  // ── 步驟執行 ──
  function setPhase(ctx: Ctx, phase: GameState['phase']) {
    ctx.s.phase = phase;
    ctx.ev.push({ t: 'phase', phase, player: ctx.s.turnPlayer });
  }
  const setState = (ctx: Ctx, c: { uid: string; state: string }, state: 'stand' | 'rest' | 'reverse') => {
    c.state = state;
    ctx.ev.push({ t: 'cardState', uid: c.uid, state });
  };

  function runStep(ctx: Ctx, step: Step) {
    const { s } = ctx;
    const tp = s.turnPlayer;
    const me = s.players[tp];
    switch (step.k) {
      case 'turnStart':
        s.turn++;
        s.attacksThisTurn = 0;
        setPhase(ctx, 'stand'); // 〔6.2〕
        for (const c of me.stage) if (c && c.state !== 'stand') setState(ctx, c, 'stand');
        then(s, { k: 'drawPhase' }, { k: 'clockPhase' }, { k: 'mainPhase' }, { k: 'climaxPhase' }, { k: 'attackPhase' }, { k: 'encoreStep' }, { k: 'endPhase' });
        return;
      case 'drawPhase':
        setPhase(ctx, 'draw'); // 〔6.3〕
        drawOne(ctx, tp);
        return;
      case 'clockPhase':
        setPhase(ctx, 'clock'); // 〔6.4〕
        if (me.hand.length) s.pending = { kind: 'clock', player: tp };
        return;
      case 'mainPhase':
        setPhase(ctx, 'main'); // 〔6.5〕
        s.pending = { kind: 'main', player: tp };
        return;
      case 'mainContinue':
        s.pending = { kind: 'main', player: tp };
        return;
      case 'climaxPhase':
        setPhase(ctx, 'climax'); // 〔6.6〕
        fx.fireGlobal(s, 'myClimaxPhaseStart');
        then(s, { k: 'climaxPlay' });
        return;
      case 'climaxPlay':
        if (me.hand.some((u) => cardOf(s, u).type === 'climax' && !playProblem(s, tp, u))) s.pending = { kind: 'climax', player: tp };
        return;
      case 'attackPhase':
        setPhase(ctx, 'attack'); // 〔7.2.1.1〕「攻擊階段開始時」
        fx.fireGlobal(s, 'opponentAttackPhaseStart');
        then(s, { k: 'attackDeclare' });
        return;
      case 'attackDeclare':
        if (attackable(s).length) s.pending = { kind: 'attackDeclare', player: tp };
        return;
      case 'trigger': {
        // 判定：牌組最上面 1 張翻到解決領域，執行判定圖示，再放進能量區〔7.3.1.2〕
        refreshIfNeeded(ctx, tp);
        const uid = me.deck[0];
        if (!uid) return;
        move(ctx, uid, tp, 'deck', 'resolution');
        refreshIfNeeded(ctx, tp);
        const icons = [...cardOf(s, uid).triggers];
        ctx.ev.push({ t: 'trigger', uid, cardId: s.cards[uid]!.cardId, icons });
        then(s, ...icons.map((icon) => ({ k: 'icon' as const, icon, uid })), { k: 'toStock', uid });
        return;
      }
      case 'icon':
        return runIcon(ctx, step.icon, step.uid);
      case 'toStock':
        if (me.resolution.includes(step.uid)) move(ctx, step.uid, tp, 'resolution', 'stock');
        return;
      case 'counter': {
        // 反擊步驟〔7.4〕：防守方可以使用一次助太刀
        const options = backupOptions(s, other(tp));
        if (options.length) s.pending = { kind: 'counter', player: other(tp), options };
        return;
      }
      case 'attackDamage': {
        const a = s.attack;
        if (!a || me.stage[a.slot]?.uid !== a.attacker) return; // 攻擊角色已不在場〔7.5.1.2.2〕
        const n = soul(s, a.attacker);
        if (n <= 0) return; // 〔7.5.1.2.1〕
        const r = dealDamage(ctx, other(tp), n);
        // 「此卡的戰鬥中，你受到的傷害被取消／沒被取消時」：防禦角色的能力
        if (a.mode === 'front' && a.defender && r !== 'lose' && s.players[other(tp)].stage.some((c) => c?.uid === a.defender)) {
          fx.fireFor(s, a.defender, r === 'cancel' ? 'damageCancelledInBattle' : 'damageNotCancelledInBattle', { battleOpp: a.attacker });
        }
        return;
      }
      case 'battle': {
        // 〔7.6.1.2〕攻擊力較低的倒置；相同則雙方都倒置
        const a = s.attack;
        if (!a || a.mode !== 'front' || !a.defender) return;
        const att = me.stage[a.slot];
        const def = s.players[other(tp)].stage[facing(a.slot)];
        if (att?.uid !== a.attacker || def?.uid !== a.defender) return; // 〔7.6.1.3〕
        const pa = power(s, att.uid);
        const pd = power(s, def.uid);
        const reversed = [...(pa <= pd ? [att] : []), ...(pd <= pa ? [def] : [])];
        for (const c of reversed) setState(ctx, c, 'reverse');
        for (const c of reversed) {
          const opp = c === att ? def : att;
          fx.fireFor(s, c.uid, 'reversedInBattle', { battleOpp: opp.uid });
          fx.fireFor(s, opp.uid, 'battleOpponentReversed', { battleOpp: c.uid });
        }
        return;
      }
      case 'attackEnd':
        s.attack = null;
        return;
      case 'encoreStep':
        if (s.phase !== 'encore') setPhase(ctx, 'encore'); // 〔7.7.1.1〕
        fx.fireGlobal(s, 'encoreStepStart');
        then(s, { k: 'encoreLoop' });
        return;
      case 'encoreLoop':
        // 回合玩家先，把倒置的角色一張一張放進休息室〔7.7.1.2～7.7.1.4〕
        for (const p of [tp, other(tp)]) {
          const options = s.players[p].stage.filter((c) => c?.state === 'reverse').map((c) => c!.uid);
          if (options.length) {
            s.pending = { kind: 'encoreChoose', player: p, options };
            then(s, { k: 'encoreLoop' });
            return;
          }
        }
        return;
      case 'endPhase':
        setPhase(ctx, 'end'); // 〔6.8〕
        then(s, { k: 'endPhaseCleanup' });
        if (me.hand.length > HAND_LIMIT) s.pending = { kind: 'handLimit', player: tp, count: me.hand.length - HAND_LIMIT };
        return;
      case 'endPhaseCleanup':
        for (const u of [...me.climax]) move(ctx, u, tp, 'climax', 'waiting'); // 〔6.8.1.3〕
        // 「那個回合中」的效果消失〔6.8.1.4〕
        s.mods = [];
        s.grants = [];
        s.placedThisTurn = [];
        s.turnPlayer = other(tp);
        then(s, { k: 'turnStart' });
        return;
      case 'draw':
        for (let i = 0; i < step.n; i++) drawOne(ctx, step.p);
        return;
      case 'damage':
        dealDamage(ctx, step.p, step.n);
        return;
      case 'levelCheck': {
        // 升級〔9.3〕：傷害區 7 張以上，從最下面 7 張選 1 張到等級區
        const pl = s.players[step.p];
        if (pl.clock.length >= 7) s.pending = { kind: 'levelUp', player: step.p, options: pl.clock.slice(0, 7) };
        return;
      }
      case 'frame':
        fx.runFrame(ctx, step.f);
        return;
      case 'abilityStart':
        fx.startAbility(ctx, step.w);
        return;
    }
  }

  // 判定圖示的動作〔4.14.2〕
  function runIcon(ctx: Ctx, icon: string, uid: string) {
    const { s } = ctx;
    const tp = s.turnPlayer;
    const me = s.players[tp];
    switch (icon) {
      case 'soul':
        if (s.attack) s.mods.push({ uid: s.attack.attacker, power: 0, soul: 1 });
        return;
      case 'comeback': {
        const options = me.waiting.filter((u) => cardOf(s, u).type === 'character');
        if (options.length) s.pending = { kind: 'pick', player: tp, reason: 'comeback', options, dests: ['hand'] };
        return;
      }
      case 'gate': {
        const options = me.waiting.filter((u) => cardOf(s, u).type === 'climax');
        if (options.length) s.pending = { kind: 'pick', player: tp, reason: 'gate', options, dests: ['hand'] };
        return;
      }
      case 'choice': {
        const options = me.waiting.filter((u) => cardOf(s, u).type === 'character' && cardOf(s, u).triggers.includes('soul'));
        if (options.length) s.pending = { kind: 'pick', player: tp, reason: 'choice', options, dests: ['hand', 'stock'] };
        return;
      }
      case 'treasure':
        if (me.resolution.includes(uid)) move(ctx, uid, tp, 'resolution', 'hand'); // 強制回手〔4.14.2.8.1〕
        if (me.deck.length) s.pending = { kind: 'yesno', player: tp, reason: 'treasureStock' };
        return;
      case 'pool':
        if (me.deck.length) s.pending = { kind: 'yesno', player: tp, reason: 'pool' };
        return;
      case 'draw':
        s.pending = { kind: 'yesno', player: tp, reason: 'draw' };
        return;
      default:
        ctx.ev.push({ t: 'notice', text: `判定圖示「${icon}」尚未實作` });
    }
  }

  // ── 回應待決選擇 ──
  function resolve(ctx: Ctx, pend: Pending, a: Action): string | null {
    const { s } = ctx;
    const p = pend.player;
    const pl = s.players[p];
    const wrong = '現在不能做這個動作';

    switch (pend.kind) {
      case 'mulligan': {
        // 換牌〔5.2.1.4〕：先攻先，丟任意張再抽同樣張數
        if (a.type !== 'mulligan') return wrong;
        if (a.discard.some((u) => !pl.hand.includes(u)) || new Set(a.discard).size !== a.discard.length) return '只能丟自己手牌裡的卡';
        for (const u of a.discard) move(ctx, u, p, 'hand', 'waiting');
        for (let i = 0; i < a.discard.length; i++) drawOne(ctx, p);
        s.pending = p === s.firstPlayer ? { kind: 'mulligan', player: other(p) } : null;
        if (!s.pending) then(s, { k: 'turnStart' });
        return null;
      }
      case 'clock': {
        if (a.type !== 'clock') return wrong;
        if (a.uid !== null && !pl.hand.includes(a.uid)) return '這張卡不在你的手牌';
        s.pending = null;
        if (a.uid === null) return null;
        move(ctx, a.uid, p, 'hand', 'clock');
        then(s, { k: 'levelCheck', p }, { k: 'draw', p, n: 2 }); // 放了就抽 2 張〔6.4.1.2〕
        return null;
      }
      case 'main': {
        if (a.type === 'pass') {
          s.pending = null;
          return null;
        }
        if (a.type === 'playCharacter') {
          const err = playProblem(s, p, a.uid) ?? (cardOf(s, a.uid).type !== 'character' ? '這不是角色卡' : null);
          if (err) return err;
          s.pending = null;
          payStock(ctx, p, cardOf(s, a.uid).cost ?? 0);
          const old = pl.stage[a.slot];
          if (old) move(ctx, old.uid, p, 'stage', 'waiting', { fromSlot: a.slot }); // 原本的角色進休息室〔8.6.2.5.1、9.6.2〕
          move(ctx, a.uid, p, 'hand', 'stage', { slot: a.slot });
          s.placedThisTurn.push(a.uid);
          fx.fireFor(s, a.uid, 'placedFromHandToStage');
          then(s, { k: 'mainContinue' });
          return null;
        }
        if (a.type === 'playEvent') {
          const err = playProblem(s, p, a.uid) ?? (cardOf(s, a.uid).type !== 'event' ? '這不是事件卡' : null);
          if (err) return err;
          s.pending = null;
          payStock(ctx, p, cardOf(s, a.uid).cost ?? 0);
          move(ctx, a.uid, p, 'hand', 'resolution'); // 〔8.6.2.5.2〕
          const effect = cardOf(s, a.uid).abilities.find((x) => x.kind === 'event');
          then(s, { k: 'mainContinue' });
          if (effect) fx.startPlayed(ctx, a.uid, p, effect, [{ op: '_eventDone' }]);
          else move(ctx, a.uid, p, 'resolution', 'waiting');
          return null;
        }
        if (a.type === 'activate') {
          const err = activateProblem(s, p, a.uid, a.index);
          if (err) return err;
          s.pending = null;
          then(s, { k: 'mainContinue' });
          fx.startPlayed(ctx, a.uid, p, fx.abilitiesOf(s, a.uid)[a.index]!);
          return null;
        }
        if (a.type === 'moveStage') {
          // 交換兩格〔6.5.1.2.4〕；狀態不變〔3.6.3〕
          if (a.from === a.to) return '請選兩個不同的格子';
          const x = pl.stage[a.from] ?? null;
          const y = pl.stage[a.to] ?? null;
          if (!x && !y) return '兩格都沒有角色';
          pl.stage[a.from] = y;
          pl.stage[a.to] = x;
          if (x) ctx.ev.push({ t: 'move', uid: x.uid, cardId: s.cards[x.uid]!.cardId, from: { p, zone: 'stage', slot: a.from }, to: { p, zone: 'stage', slot: a.to } });
          if (y) ctx.ev.push({ t: 'move', uid: y.uid, cardId: s.cards[y.uid]!.cardId, from: { p, zone: 'stage', slot: a.to }, to: { p, zone: 'stage', slot: a.from } });
          return null;
        }
        return wrong;
      }
      case 'climax': {
        if (a.type === 'pass') {
          s.pending = null;
          return null;
        }
        if (a.type !== 'playClimax') return wrong;
        const err = playProblem(s, p, a.uid) ?? (cardOf(s, a.uid).type !== 'climax' ? '這不是名場面卡' : null);
        if (err) return err;
        s.pending = null;
        move(ctx, a.uid, p, 'hand', 'climax'); // 只能打 1 張〔6.6.1.2.2〕
        fx.fireGlobal(s, 'climaxPlaced', a.uid);
        return null;
      }
      case 'attackDeclare': {
        if (a.type === 'pass') {
          s.pending = null; // 攻擊結束，接著是安可步驟〔7.2.1.3.2〕
          return null;
        }
        if (a.type !== 'attack') return wrong;
        if (!attackable(s).includes(a.slot)) return '這個角色不能攻擊（要在前列且直立）';
        const defender = s.players[other(p)].stage[facing(a.slot)];
        let mode: AttackMode = a.mode;
        if (!defender) mode = 'direct'; // 正面沒有角色就是直接攻擊〔7.2.1.4.1〕
        else if (mode === 'direct') return '正面有角色，只能選正打或側打';
        const attacker = pl.stage[a.slot]!;
        if (mode === 'direct') s.mods.push({ uid: attacker.uid, power: 0, soul: 1 });
        if (mode === 'side') {
          const lv = cardOf(s, defender!.uid).level ?? 0;
          if (lv > 0) s.mods.push({ uid: attacker.uid, power: 0, soul: -lv }); // 〔7.2.1.4.2〕
        }
        ctx.ev.push({ t: 'attack', uid: attacker.uid, slot: a.slot, mode });
        setState(ctx, attacker, 'rest'); // 〔7.2.1.5.3〕
        s.attack = { attacker: attacker.uid, slot: a.slot, mode, defender: mode === 'front' ? defender!.uid : null };
        s.attacksThisTurn++;
        s.pending = null;
        fx.fireFor(s, attacker.uid, 'attacks', { battleOpp: s.attack.defender ?? undefined });
        // 判定 →（正打才有）反擊 → 傷害 →（正打才有）戰鬥 → 下一次攻擊宣告
        const steps: Step[] = [{ k: 'trigger' }];
        if (mode === 'front') steps.push({ k: 'counter' });
        steps.push({ k: 'attackDamage' });
        if (mode === 'front') steps.push({ k: 'battle' });
        steps.push({ k: 'attackEnd' }, { k: 'attackDeclare' });
        then(s, ...steps);
        return null;
      }
      case 'counter': {
        if (a.type === 'pass') {
          s.pending = null;
          return null;
        }
        if (a.type !== 'choose' || a.uids.length !== 1 || !pend.options.includes(a.uids[0]!)) return '請選 1 張可以使用助太刀的卡，或不使用';
        s.pending = null;
        const uid = a.uids[0]!;
        const backup = cardOf(s, uid).abilities.find((x) => x.keyword?.id === 'backup')!;
        fx.startPlayed(ctx, uid, p, backup, [{ op: '_fireUsedBackup' }]);
        return null;
      }
      case 'levelUp': {
        if (a.type !== 'choose') return wrong;
        const uid = a.uids[0];
        if (a.uids.length !== 1 || !uid || !pend.options.includes(uid)) return '請從傷害區最下面 7 張選 1 張';
        s.pending = null;
        move(ctx, uid, p, 'clock', 'level');
        ctx.ev.push({ t: 'levelUp', p, uid });
        for (const u of pend.options) if (u !== uid) move(ctx, u, p, 'clock', 'waiting');
        then(s, { k: 'levelCheck', p });
        return null;
      }
      case 'encoreChoose': {
        if (a.type !== 'choose') return wrong;
        const uid = a.uids[0];
        if (a.uids.length !== 1 || !uid || !pend.options.includes(uid)) return '請選 1 張倒置的角色';
        s.pending = null;
        move(ctx, uid, p, 'stage', 'waiting', { fromSlot: pl.stage.findIndex((c) => c?.uid === uid) as Slot }); // 會誘發安可
        return null;
      }
      case 'handLimit': {
        if (a.type !== 'choose') return wrong;
        if (a.uids.length !== pend.count || new Set(a.uids).size !== a.uids.length || a.uids.some((u) => !pl.hand.includes(u))) return `請從手牌選 ${pend.count} 張丟掉`;
        s.pending = null;
        for (const u of a.uids) move(ctx, u, p, 'hand', 'waiting');
        return null;
      }
      case 'pick': {
        if (a.type !== 'choose') return wrong;
        if (a.uids.length > 1 || (a.uids[0] && !pend.options.includes(a.uids[0]))) return '請從可選的卡中選 1 張，或不選';
        const dest = a.dest ?? pend.dests[0]!;
        if (!pend.dests.includes(dest)) return '不能放到那裡';
        s.pending = null;
        if (a.uids[0]) move(ctx, a.uids[0], p, 'waiting', dest);
        return null;
      }
      case 'yesno': {
        if (a.type !== 'yesno') return wrong;
        s.pending = null;
        if (!a.yes) return null;
        if (pend.reason === 'draw') drawOne(ctx, p);
        else if (pl.deck.length) {
          move(ctx, pl.deck[0]!, p, 'deck', 'stock');
          refreshIfNeeded(ctx, p);
        }
        return null;
      }
      case 'orderAbility': {
        // 同時待機的自動能力：由主人決定先解決哪一個〔8.5.1.2〕
        if (a.type !== 'choose' || a.uids.length !== 1) return '請選 1 個要先解決的能力';
        const id = Number(a.uids[0]);
        const i = s.standby.findIndex((w) => w.id === id && w.controller === p);
        if (i < 0) return '沒有這個能力';
        s.pending = null;
        then(s, { k: 'abilityStart', w: s.standby.splice(i, 1)[0]! });
        return null;
      }
      case 'select':
        if (a.type !== 'choose') return wrong;
        return fx.answer(ctx, pend, a.uids);
      case 'confirm':
        if (a.type !== 'yesno') return wrong;
        return fx.answer(ctx, pend, a.yes);
      case 'chooseSlot':
        if (a.type !== 'chooseSlot') return wrong;
        return fx.answer(ctx, pend, a.slot);
    }
  }

  // 檢查時點〔8.5.1〕：規則處理 → 回合玩家的待機能力 → 非回合玩家的待機能力
  function checkTiming(ctx: Ctx): boolean {
    const { s } = ctx;
    ruleCheck(ctx);
    if (s.winner !== null || s.pending || !s.standby.length) return false;
    for (const p of [s.turnPlayer, other(s.turnPlayer)]) {
      const mine = s.standby.filter((w) => w.controller === p);
      if (!mine.length) continue;
      if (mine.length === 1) {
        s.standby.splice(s.standby.indexOf(mine[0]!), 1);
        then(s, { k: 'abilityStart', w: mine[0]! });
      } else {
        s.pending = { kind: 'orderAbility', player: p, options: mine.map((w) => ({ id: w.id, uid: w.src, text: w.ability.text.zh })) };
      }
      return true;
    }
    return false;
  }

  // 一直執行步驟，直到需要玩家做選擇或遊戲結束
  function advance(ctx: Ctx): string | null {
    const { s } = ctx;
    for (let i = 0; i < MAX_STEPS; i++) {
      // 能力或效果解決到一半時，先把它做完，再回到檢查時點處理下一個〔8.5.1.2〕
      const next = s.queue.at(-1)?.k;
      const midEffect = next === 'frame' || next === 'abilityStart';
      if (!midEffect && checkTiming(ctx)) continue;
      ruleCheck(ctx);
      if (s.winner !== null || s.pending) return null;
      const step = s.queue.pop();
      if (!step) return null;
      runStep(ctx, step);
    }
    return '結算次數超過上限，可能出現無窮迴圈';
  }

  // ── 對外介面 ──
  function newGame(opts: NewGameOptions): ApplyResult {
    const s: GameState = {
      rng: opts.seed >>> 0 || 1, cards: {}, players: [emptyPlayer(), emptyPlayer()], firstPlayer: 0, turnPlayer: 0, turn: 0,
      phase: 'setup', attack: null, attacksThisTurn: 0, mods: [], grants: [], placedThisTurn: [], standby: [], nextId: 1, queue: [], pending: null, winner: null,
    };
    const ctx: Ctx = { s, ev: [] };
    ([0, 1] as PlayerId[]).forEach((p) => {
      opts.decks[p].forEach((cardId, i) => {
        if (!db.has(cardId)) throw new Error(`找不到卡片資料：${cardId}`);
        const uid = `${p}-${i}`;
        s.cards[uid] = { cardId, owner: p };
        s.players[p].deck.push(uid);
      });
      shuffle(ctx, p);
    });
    // 隨機決定先攻〔5.2.1.3〕
    s.firstPlayer = nextRandom(s) < 0.5 ? 0 : 1;
    s.turnPlayer = s.firstPlayer;
    for (const p of [0, 1] as PlayerId[]) for (let i = 0; i < 5; i++) drawOne(ctx, p);
    s.pending = { kind: 'mulligan', player: s.firstPlayer };
    return { state: s, events: ctx.ev };
  }

  function apply(state: GameState, action: Action): ApplyResult {
    const fail = (error: string): ApplyResult => ({ state, events: [], error });
    if (state.winner !== null) return fail('遊戲已經結束');
    const s = structuredClone(state);
    const ctx: Ctx = { s, ev: [] };
    if (action.type === 'concede') {
      lose(ctx, action.player); // 投降〔1.2.4〕
      return { state: s, events: ctx.ev };
    }
    const pend = s.pending;
    if (!pend) return fail('現在沒有在等待任何動作');
    if (action.player !== pend.player) return fail('還沒輪到你');
    const err = resolve(ctx, pend, action);
    if (err) return fail(err);
    const loopErr = advance(ctx);
    if (loopErr) return fail(loopErr);
    return { state: s, events: ctx.ev };
  }

  // 目前可以做的動作（介面用來決定按鈕、測試用來隨機對打）
  function legalActions(s: GameState): Action[] {
    const pend = s.pending;
    if (!pend || s.winner !== null) return [];
    const player = pend.player;
    const pl = s.players[player];
    const out: Action[] = [];
    const choose = (uids: string[]) => out.push({ type: 'choose', player, uids });
    switch (pend.kind) {
      case 'mulligan':
        out.push({ type: 'mulligan', player, discard: [] });
        for (const u of pl.hand) out.push({ type: 'mulligan', player, discard: [u] });
        break;
      case 'clock':
        out.push({ type: 'clock', player, uid: null });
        for (const u of pl.hand) out.push({ type: 'clock', player, uid: u });
        break;
      case 'main':
        for (const u of pl.hand) {
          if (playProblem(s, player, u)) continue;
          const t = cardOf(s, u).type;
          if (t === 'character') for (const slot of [0, 1, 2, 3, 4] as Slot[]) out.push({ type: 'playCharacter', player, uid: u, slot });
          if (t === 'event') out.push({ type: 'playEvent', player, uid: u });
        }
        for (const c of pl.stage) {
          if (!c) continue;
          fx.abilitiesOf(s, c.uid).forEach((_, index) => {
            if (!activateProblem(s, player, c.uid, index)) out.push({ type: 'activate', player, uid: c.uid, index });
          });
        }
        for (let from = 0; from < 5; from++)
          for (let to = from + 1; to < 5; to++) if (pl.stage[from] || pl.stage[to]) out.push({ type: 'moveStage', player, from: from as Slot, to: to as Slot });
        out.push({ type: 'pass', player });
        break;
      case 'climax':
        for (const u of pl.hand) if (cardOf(s, u).type === 'climax' && !playProblem(s, player, u)) out.push({ type: 'playClimax', player, uid: u });
        out.push({ type: 'pass', player });
        break;
      case 'attackDeclare':
        for (const slot of attackable(s)) {
          if (s.players[other(player)].stage[facing(slot)]) out.push({ type: 'attack', player, slot, mode: 'front' }, { type: 'attack', player, slot, mode: 'side' });
          else out.push({ type: 'attack', player, slot, mode: 'direct' });
        }
        out.push({ type: 'pass', player });
        break;
      case 'counter':
        for (const u of pend.options) choose([u]);
        out.push({ type: 'pass', player });
        break;
      case 'levelUp':
      case 'encoreChoose':
        for (const u of pend.options) choose([u]);
        break;
      case 'yesno':
      case 'confirm':
        out.push({ type: 'yesno', player, yes: true }, { type: 'yesno', player, yes: false });
        break;
      case 'handLimit':
        choose(pl.hand.slice(0, pend.count));
        choose(pl.hand.slice(-pend.count));
        break;
      case 'pick':
        out.push({ type: 'choose', player, uids: [] });
        for (const u of pend.options) for (const dest of pend.dests) out.push({ type: 'choose', player, uids: [u], dest });
        break;
      case 'select':
        if (pend.min === 0) choose([]);
        if (pend.min <= 1 && pend.max >= 1) for (const u of pend.options) choose([u]);
        if (pend.min > 1 || pend.max > 1) {
          const n = Math.min(pend.options.length, Math.max(pend.min, Math.min(pend.max, 2)));
          if (n >= pend.min) {
            choose(pend.options.slice(0, n));
            choose(pend.options.slice(-n));
          }
        }
        break;
      case 'chooseSlot':
        for (const slot of pend.slots) out.push({ type: 'chooseSlot', player, slot });
        break;
      case 'orderAbility':
        for (const o of pend.options) choose([String(o.id)]);
        break;
    }
    return out;
  }

  return { newGame, apply, legalActions, power, soul, playProblem, cardOf, abilitiesOf: fx.abilitiesOf };
}

export type Engine = ReturnType<typeof createEngine>;

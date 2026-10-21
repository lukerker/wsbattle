// 規則引擎核心。純函式：apply(狀態, 動作) 回傳新狀態與事件列表，不修改傳入的狀態。
// 規則依據：總合規則 ver.1.113，〔 〕內為規則編號，對照 docs/引擎規格.md。
// 卡片能力由 effects.ts 執行；這裡負責回合流程、規則處理，以及在對的時點誘發能力。
import type { Card } from '../card-schema.ts';
import { DEFAULT_ENCORE, createEffects, type Core, type Ctx, type MoveOpts } from './effects.ts';
import { nextRandom, shuffleInPlace } from './rng.ts';
import { FRONT, RESPONSE_SECONDS, type Action, type ApplyResult, type AttackMode, type GameOverReason, type GameState, type GameZone, type Pending, type PlayerId, type PlayerState, type Slot, type Step } from './types.ts';

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
      s.usedOnce = s.usedOnce.filter((k) => !k.startsWith(`${uid}|`));
      s.skipStand = s.skipStand.filter((x) => x.uid !== uid);
      s.shields = s.shields.filter((x) => x.uid !== uid);
      // 角色下面的標記：角色離開舞台時放到休息室
      for (const m of s.markers[uid] ?? []) {
        const owner = s.cards[m.uid]!.owner;
        s.players[owner].waiting.push(m.uid);
        ctx.ev.push({ t: 'move', uid: m.uid, cardId: s.cards[m.uid]!.cardId, from: { p, zone: 'stage', slot: i }, to: { p: owner, zone: 'waiting' } });
      }
      delete s.markers[uid];
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
    if (leaving && to === 'waiting') {
      fx.fireFor(s, uid, 'sourceLeavesStageToWaitingRoom', { slot: leaving.slot }, leaving.abilities, p); // 安可等
      fx.fireAllyLeaves(s, uid, p, leaving.slot);
    }
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
  // src：給傷害的卡（攻擊的角色、效果的發生源）；結果記在 lastDamage，誘發 src 的「給的傷害被取消／沒被取消時」
  function dealDamage(ctx: Ctx, p: PlayerId, n: number, src?: string): 'cancel' | 'clock' | 'lose' {
    const r = dealDamageCore(ctx, p, n);
    const { s } = ctx;
    s.lastDamage = r === 'lose' ? null : r;
    if (src && r !== 'lose' && s.players[other(p)].stage.some((c) => c?.uid === src)) {
      fx.fireFor(s, src, r === 'cancel' ? 'dealtDamageCancelled' : 'dealtDamageNotCancelled');
    }
    return r;
  }
  function dealDamageCore(ctx: Ctx, p: PlayerId, n: number): 'cancel' | 'clock' | 'lose' {
    const { s } = ctx;
    const pl = s.players[p];
    ctx.ev.push({ t: 'damage', p, n });
    const revealed: string[] = [];
    while (revealed.length < n) {
      refreshIfNeeded(ctx, p);
      if (pl.deck.length === 0) {
        // 牌組與休息室都空、解決領域沒有名場面 → 立刻敗北〔9.2.2.1〕
        lose(ctx, p, 'deck');
        return 'lose';
      }
      const uid = pl.deck[0]!;
      move(ctx, uid, p, 'deck', 'resolution');
      revealed.push(uid);
      // 牌組翻到 0 張：立刻重洗並受重洗懲罰（插入型規則處理〔9.2〕），翻開的卡還在解決領域，不會洗回去
      refreshIfNeeded(ctx, p);
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

  function lose(ctx: Ctx, p: PlayerId, reason: GameOverReason) {
    ctx.s.winner = other(p);
    ctx.s.phase = 'gameOver';
    ctx.s.pending = null;
    ctx.ev.push({ t: 'gameOver', winner: ctx.s.winner, reason });
  }

  // ── 檢查型規則處理〔9.4～9.6〕──
  function ruleCheck(ctx: Ctx) {
    const { s } = ctx;
    if (s.winner !== null) return;
    const reasonOf = (p: PlayerId): GameOverReason | null => {
      const pl = s.players[p];
      return pl.level.length >= 4 ? 'level' : pl.deck.length === 0 && pl.waiting.length === 0 ? 'deck' : null;
    };
    const losers = ([0, 1] as PlayerId[]).filter((p) => reasonOf(p));
    if (losers.length === 2) {
      s.winner = 'draw';
      s.phase = 'gameOver';
      s.pending = null;
      ctx.ev.push({ t: 'gameOver', winner: 'draw', reason: reasonOf(0)! });
      return;
    }
    if (losers.length === 1) return lose(ctx, losers[0]!, reasonOf(losers[0]!)!);
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
    if (card.type !== 'climax' && fx.levelOf(s, uid) > playerLevel(s, p)) return `等級不足（需要 Lv${fx.levelOf(s, uid)}）`;
    if (!colorOk(s, p, card)) return '顏色條件不符：等級區或傷害區沒有同色的卡';
    if ((card.cost ?? 0) > s.players[p].stock.length) return `能量不足（需要 ${card.cost}）`;
    if (card.playCondition && !fx.condOk(s, card.playCondition, uid, p, {})) return '不符合這張卡的出牌條件';
    return null;
  }

  // 起動能力能不能用（主要階段）
  function activateProblem(s: GameState, p: PlayerId, uid: string, index: number): string | null {
    const slot = s.players[p].stage.findIndex((c) => c?.uid === uid);
    if (slot < 0) return '這張卡不在你的舞台上';
    const a = fx.abilitiesOf(s, uid)[index];
    if (!a || a.kind !== 'activated' || a.timing === 'counter') return '這不是可以在主要階段使用的起動能力';
    if (a.condition && !fx.condOk(s, a.condition, uid, p, {})) return '條件不符';
    if (fx.usedUp(s, uid, a)) return '這個回合已經使用過了';
    if (!fx.costPayable(s, a.cost ?? [], uid, p)) return '付不起費用';
    return null;
  }

  // 反擊步驟可以用的卡：助太刀〔10.5〕、有反擊圖示的事件〔7.4.1.2.1〕
  const counterEvent = (card: Card) => card.type === 'event' ? card.abilities.find((x) => x.kind === 'event' && x.timing === 'counter') : undefined;
  function backupOptions(s: GameState, p: PlayerId): string[] {
    if (s.attack?.mode !== 'front') return [];
    const noBackup = [s.attack.attacker, s.attack.defender].some((u) => u && fx.hasRule(s, u, 'noBackupInBattle'));
    return s.players[p].hand.filter((u) => {
      if (counterEvent(cardOf(s, u))) return !playProblem(s, p, u);
      const a = cardOf(s, u).abilities.find((x) => x.keyword?.id === 'backup');
      if (!a || a.keyword?.id !== 'backup' || noBackup) return false;
      return playerLevel(s, p) >= a.keyword.level && fx.costPayable(s, a.cost ?? [], u, p);
    });
  }

  // 有效的【永】改變規則的能力（不能側打、起立階段不直立…）
  const { hasRule } = fx;
  const cannotSideAttack = (s: GameState, uid: string) => hasRule(s, uid, 'cannotSideAttack');

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
        // 「起立階段不直立」的角色留在原狀態
        for (const c of me.stage) {
          if (c && c.state !== 'stand' && !hasRule(s, c.uid, 'doesNotStand') && !s.skipStand.some((x) => x.uid === c.uid && x.turn === s.turn)) setState(ctx, c, 'stand');
        }
        s.skipStand = s.skipStand.filter((x) => x.turn > s.turn);
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
        fx.fireGlobal(s, 'myMainPhaseStart');
        then(s, { k: 'mainContinue' });
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
        fx.fireGlobal(s, 'myAttackPhaseStart');
        then(s, { k: 'attackDeclare' });
        return;
      case 'attackDeclare':
        if (attackable(s).length) s.pending = { kind: 'attackDeclare', player: tp };
        return;
      case 'trigger': {
        // 判定：牌組最上面 1 張翻到解決領域，執行判定圖示，再放進能量區〔7.3.1.2〕
        const n = step.n ?? 1;
        const total = s.attack?.checks ?? 1;
        const more: Step[] = n < total ? [{ k: 'trigger', n: n + 1 }] : []; // 「判定 2 次」的效果
        // 「2回行ったら、あなたは自分のストックの上から1枚を、控え室に置く」
        if (n === total && total > 1 && s.attack?.afterChecks === 'stockTopToWaiting') more.push({ k: 'stockTopToWaiting', p: tp });
        refreshIfNeeded(ctx, tp);
        const uid = me.deck[0];
        if (!uid) {
          then(s, ...more);
          return;
        }
        move(ctx, uid, tp, 'deck', 'resolution');
        refreshIfNeeded(ctx, tp);
        const icons = fx.triggersOf(s, uid);
        ctx.ev.push({ t: 'trigger', uid, cardId: s.cards[uid]!.cardId, icons });
        fx.fireGlobal(s, 'myTriggerChecked', uid);
        then(s, ...icons.map((icon) => ({ k: 'icon' as const, icon, uid })), { k: 'toStock', uid }, ...more);
        return;
      }
      case 'icon':
        return runIcon(ctx, step.icon, step.uid);
      case 'stockTopToWaiting': {
        const top = s.players[step.p].stock.at(-1);
        if (top) move(ctx, top, step.p, 'stock', 'waiting');
        return;
      }
      case 'toStock':
        if (me.resolution.includes(step.uid)) move(ctx, step.uid, tp, 'resolution', 'stock');
        return;
      case 'counter': {
        // 反擊步驟〔7.4〕：防守方可以使用一次助太刀
        const options = backupOptions(s, other(tp));
        if (options.length) s.pending = { kind: 'counter', player: other(tp), options, timeout: RESPONSE_SECONDS };
        return;
      }
      case 'attackDamage': {
        const a = s.attack;
        if (!a || me.stage[a.slot]?.uid !== a.attacker) return; // 攻擊角色已不在場〔7.5.1.2.2〕
        const n = soul(s, a.attacker);
        if (n <= 0) return; // 〔7.5.1.2.1〕
        const r = dealDamage(ctx, other(tp), n, a.attacker);
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
          fx.fireAlly(s, c === att ? tp : other(tp), 'allyReversed', c.uid);
        }
        return;
      }
      case 'attackEnd': {
        const a = s.attack;
        if (a && me.stage[a.slot]?.uid === a.attacker) fx.fireFor(s, a.attacker, 'attackEnd', { battleOpp: a.defender ?? undefined });
        then(s, { k: 'attackClear' });
        return;
      }
      case 'attackClear':
        s.attack = null;
        return;
      case 'encoreStep':
        if (s.phase !== 'encore') setPhase(ctx, 'encore'); // 〔7.7.1.1〕
        fx.fireGlobal(s, 'encoreStepStart');
        then(s, { k: 'encoreLoop' });
        return;
      case 'encoreLoop':
        // 回合玩家先，把倒置的角色一張一張放進休息室〔7.7.1.2～7.7.1.4〕。
        // 規則上由玩家選放的順序；本專案依使用者決定自動依格子順序放，每放一張都照樣處理安可
        for (const p of [tp, other(tp)]) {
          const pl = s.players[p];
          const slot = pl.stage.findIndex((c) => c?.state === 'reverse');
          if (slot >= 0) {
            move(ctx, pl.stage[slot]!.uid, p, 'stage', 'waiting', { fromSlot: slot as Slot }); // 會誘發安可
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
        // 「那個回合中」的效果消失〔6.8.1.4〕；「到下次的對手回合結束前」的留到那個回合
        s.mods = s.mods.filter((m) => m.until !== undefined && m.until > s.turn);
        s.grants = s.grants.filter((g) => g.until !== undefined && g.until > s.turn);
        s.shields = s.shields.filter((x) => x.until > s.turn);
        s.placedThisTurn = [];
        s.usedOnce = [];
        s.turnPlayer = other(tp);
        then(s, { k: 'turnStart' });
        return;
      case 'draw':
        for (let i = 0; i < step.n; i++) drawOne(ctx, step.p);
        return;
      case 'damage': {
        // 「相手のキャラの【自】の効果によるダメージを受けず」：受傷的玩家在防護中的角色正在戰鬥
        const a = s.attack;
        const srcIsChar = step.src && cardOf(s, step.src).type === 'character' && s.cards[step.src]!.owner !== step.p;
        const shielded = step.auto && srcIsChar && a && s.shields.some((x) => x.p === step.p && (x.uid === a.attacker || x.uid === a.defender));
        if (shielded) {
          ctx.ev.push({ t: 'log', p: step.p, text: `不受「${cardOf(s, step.src!).name.zh}」的 ${step.n} 點傷害（防護效果）` });
          return;
        }
        dealDamage(ctx, step.p, step.n, step.src);
        return;
      }
      case 'levelCheck': {
        // 升級〔9.3〕：傷害區 7 張以上，從最下面 7 張選 1 張到等級區
        const pl = s.players[step.p];
        if (pl.clock.length < 7) return;
        const options = pl.clock.slice(0, 7);
        if (pl.level.length >= 3) {
          // 已經等級 3：升到等級 4 就輸了〔9.4.1.1〕，選哪張都一樣，不用問
          move(ctx, options[0]!, step.p, 'clock', 'level');
          ctx.ev.push({ t: 'levelUp', p: step.p, uid: options[0]! });
          for (const u of options.slice(1)) move(ctx, u, step.p, 'clock', 'waiting');
          return;
        }
        s.pending = { kind: 'levelUp', player: step.p, options };
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
        // 換牌：丟任意張再抽同樣張數。規則〔5.2.1.4〕是先攻先、後攻後；
        // 本專案依使用者決定改成雙方同時進行（各自的牌組，彼此不受影響）
        if (a.type !== 'mulligan') return wrong;
        const who = a.player;
        const hand = s.players[who].hand;
        if (a.discard.some((u) => !hand.includes(u)) || new Set(a.discard).size !== a.discard.length) return '只能丟自己手牌裡的卡';
        for (const u of a.discard) move(ctx, u, who, 'hand', 'waiting');
        for (let i = 0; i < a.discard.length; i++) drawOne(ctx, who);
        const waiting = pend.waiting.filter((x) => x !== who);
        if (waiting.length) {
          s.pending = { kind: 'mulligan', player: waiting[0]!, waiting };
        } else {
          // 雙方換完牌：翻牌決定先後攻
          s.firstPick = { picks: [null, null] };
          s.pending = { kind: 'decideFirst', player: 0, waiting: [0, 1] };
        }
        return null;
      }
      case 'decideFirst': {
        // 雙方各選 1 張蓋著的卡（不能選對手已經選的）；都選好才抽哪張是先攻，翻開決定
        if (a.type !== 'pickFirst') return wrong;
        const fp = s.firstPick!;
        const who = a.player;
        if (fp.picks[who] !== null) return '你已經選好了';
        if (fp.picks[other(who)] === a.card) return '這張已經被對手選了';
        fp.picks[who] = a.card;
        const waiting = pend.waiting.filter((x) => x !== who);
        if (waiting.length) {
          s.pending = { kind: 'decideFirst', player: waiting[0]!, waiting };
          return null;
        }
        s.pending = null;
        const firstCard: 0 | 1 = nextRandom(s) < 0.5 ? 0 : 1;
        const first: PlayerId = fp.picks[0] === firstCard ? 0 : 1;
        s.firstPlayer = first;
        s.turnPlayer = first;
        ctx.ev.push({ t: 'firstDecided', first, firstCard, picks: fp.picks as [0 | 1, 0 | 1] });
        then(s, { k: 'turnStart' });
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
          fx.fireAlly(s, p, 'allyPlacedFromHand', a.uid);
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
          fx.fireUsedActivated(s, p);
          fx.startPlayed(ctx, a.uid, p, fx.abilitiesOf(s, a.uid)[a.index]!);
          return null;
        }
        if (a.type === 'moveStage') {
          // 交換兩格〔6.5.1.2.4〕；狀態不變〔3.6.3〕
          if (a.from === a.to) return '請選兩個不同的格子';
          const x = pl.stage[a.from] ?? null;
          const y = pl.stage[a.to] ?? null;
          if (!x && !y) return '兩格都沒有角色';
          if ([x, y].some((c) => c && hasRule(s, c.uid, 'cannotMove'))) return '這張角色不能移到其他格子';
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
        fx.fireFor(s, a.uid, 'placedToClimaxZone');
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
        if (mode === 'side' && cannotSideAttack(s, attacker.uid)) return '這張卡不能側打';
        if (mode === 'direct') s.mods.push({ uid: attacker.uid, power: 0, soul: 1 });
        if (mode === 'side') {
          const lv = fx.levelOf(s, defender!.uid);
          if (lv > 0) s.mods.push({ uid: attacker.uid, power: 0, soul: -lv }); // 〔7.2.1.4.2〕
        }
        ctx.ev.push({ t: 'attack', uid: attacker.uid, slot: a.slot, mode });
        setState(ctx, attacker, 'rest'); // 〔7.2.1.5.3〕
        s.attack = { attacker: attacker.uid, slot: a.slot, mode, defender: mode === 'front' ? defender!.uid : null };
        s.attacksThisTurn++;
        s.pending = null;
        fx.fireFor(s, attacker.uid, 'attacks', { battleOpp: s.attack.defender ?? undefined });
        fx.fireAlly(s, p, 'allyAttacks', attacker.uid);
        if (mode === 'front') {
          fx.fireFor(s, defender!.uid, 'frontAttacked', { battleOpp: attacker.uid });
          fx.fireAllyFrontAttacked(s, defender!.uid); // 「你的其他角色被正打時」
        }
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
          ctx.ev.push({ t: 'log', p, text: '不使用助太刀' });
          return null;
        }
        if (a.type !== 'choose' || a.uids.length !== 1 || !pend.options.includes(a.uids[0]!)) return '請選 1 張可以使用助太刀的卡，或不使用';
        s.pending = null;
        const uid = a.uids[0]!;
        const ev = counterEvent(cardOf(s, uid));
        if (ev) {
          // 反擊事件：和主要階段一樣付費、放到解決領域再結算〔8.6.2.5.2〕
          payStock(ctx, p, cardOf(s, uid).cost ?? 0);
          move(ctx, uid, p, 'hand', 'resolution');
          fx.startPlayed(ctx, uid, p, ev, [{ op: '_eventDone' }]);
          return null;
        }
        const backup = cardOf(s, uid).abilities.find((x) => x.keyword?.id === 'backup')!;
        fx.fireUsedActivated(s, p);
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
        const what = { treasureStock: '判定（金條）：牌組上方 1 張放到能量區', pool: '判定（錢袋）：牌組上方 1 張放到能量區', draw: '判定（書本）：抽 1 張' }[pend.reason];
        ctx.ev.push({ t: 'log', p, text: `${what}${a.yes ? '' : ' → 不要'}` });
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
        if (a.type !== 'choose') return wrong;
        if (a.uids.length === 0 && pend.canSkip) {
          // 都是「可以發動」的能力：全部選擇不發動〔8.7.3.2.1〕
          s.standby = s.standby.filter((w) => w.controller !== p);
          s.pending = null;
          ctx.ev.push({ t: 'log', p, text: `選擇都不發動（${pend.options.map((o) => `「${cardOf(s, o.uid).name.zh}」`).join('')}）` });
          return null;
        }
        if (a.uids.length !== 1) return '請選 1 個要先解決的能力';
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
      case 'acknowledge':
        if (a.type !== 'yesno') return wrong;
        return fx.answer(ctx, pend, true);
      case 'chooseSlot':
        if (a.type !== 'chooseSlot') return wrong;
        return fx.answer(ctx, pend, a.slot);
      case 'chooseOption':
        if (a.type !== 'choose') return wrong;
        return fx.answer(ctx, pend, a.uids);
    }
  }

  // 檢查時點〔8.5.1〕：規則處理 → 回合玩家的待機能力 → 非回合玩家的待機能力
  function checkTiming(ctx: Ctx): boolean {
    const { s } = ctx;
    ruleCheck(ctx);
    if (s.winner !== null || s.pending) return false;
    // 重洗〔9.2〕：牌組是 0 張就重洗（保險：正常情況下卡離開牌組的地方都已經處理）
    for (const p of [s.turnPlayer, other(s.turnPlayer)]) refreshIfNeeded(ctx, p);
    // 升級是規則處理〔9.3〕：不管卡是怎麼進傷害區的（傷害、效果直接放入、重洗懲罰），檢查時點都要處理
    for (const p of [s.turnPlayer, other(s.turnPlayer)]) {
      if (s.players[p].clock.length >= 7) {
        runStep(ctx, { k: 'levelCheck', p });
        return true;
      }
    }
    if (!s.standby.length) return false;
    // 條件不符、付不起、或已經沒有意義的能力（例如另一個安可已經讓角色回場）不列出來，解決時本來就會什麼都不做
    s.standby = s.standby.filter((w) => fx.viable(s, w));
    for (const p of [s.turnPlayer, other(s.turnPlayer)]) {
      const mine = s.standby.filter((w) => w.controller === p);
      if (!mine.length) continue;
      if (mine.length === 1) {
        s.standby.splice(s.standby.indexOf(mine[0]!), 1);
        then(s, { k: 'abilityStart', w: mine[0]! });
      } else {
        const canSkip = mine.every((w) => w.ability.optional);
        s.pending = { kind: 'orderAbility', player: p, canSkip, options: mine.map((w) => ({ id: w.id, uid: w.src, text: w.ability.text.zh })) };
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
      // （效果中途插入的傷害處理等步驟也算在效果裡：佇列裡還有沒做完的效果，就不插入檢查時點）
      const midEffect = s.queue.at(-1)?.k === 'abilityStart' || s.queue.some((st) => st.k === 'frame');
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
      phase: 'setup', attack: null, attacksThisTurn: 0, mods: [], grants: [], placedThisTurn: [], usedOnce: [], markers: {}, skipStand: [], shields: [], lastDamage: null, standby: [], nextId: 1, queue: [], pending: null, winner: null,
      firstPick: null,
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
    // 先後攻〔5.2.1.3〕：本專案依使用者決定，雙方換完牌後才翻牌決定（見 decideFirst）
    for (const p of [0, 1] as PlayerId[]) for (let i = 0; i < 5; i++) drawOne(ctx, p);
    s.pending = { kind: 'mulligan', player: 0, waiting: [0, 1] };
    return { state: s, events: ctx.ev };
  }

  function apply(state: GameState, action: Action): ApplyResult {
    const fail = (error: string): ApplyResult => ({ state, events: [], error });
    if (state.winner !== null) return fail('遊戲已經結束');
    const s = structuredClone(state);
    const ctx: Ctx = { s, ev: [] };
    if (action.type === 'concede') {
      lose(ctx, action.player, 'concede'); // 投降〔1.2.4〕
      return { state: s, events: ctx.ev };
    }
    const pend = s.pending;
    if (!pend) return fail('現在沒有在等待任何動作');
    const mayAct = 'waiting' in pend ? pend.waiting.includes(action.player) : action.player === pend.player;
    if (!mayAct) return fail('還沒輪到你');
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
      case 'decideFirst':
        for (const card of [0, 1] as const) if (s.firstPick?.picks[other(player)] !== card) out.push({ type: 'pickFirst', player, card });
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
        for (let from = 0; from < 5; from++) {
          for (let to = from + 1; to < 5; to++) {
            const pair = [pl.stage[from], pl.stage[to]];
            if (pair.some(Boolean) && !pair.some((c) => c && hasRule(s, c.uid, 'cannotMove'))) out.push({ type: 'moveStage', player, from: from as Slot, to: to as Slot });
          }
        }
        out.push({ type: 'pass', player });
        break;
      case 'climax':
        for (const u of pl.hand) if (cardOf(s, u).type === 'climax' && !playProblem(s, player, u)) out.push({ type: 'playClimax', player, uid: u });
        out.push({ type: 'pass', player });
        break;
      case 'attackDeclare':
        for (const slot of attackable(s)) {
          if (s.players[other(player)].stage[facing(slot)]) {
            out.push({ type: 'attack', player, slot, mode: 'front' });
            if (!cannotSideAttack(s, pl.stage[slot]!.uid)) out.push({ type: 'attack', player, slot, mode: 'side' });
          } else out.push({ type: 'attack', player, slot, mode: 'direct' });
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
      case 'acknowledge':
        out.push({ type: 'yesno', player, yes: true });
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
      case 'chooseOption':
        pend.options.forEach((_, i) => choose([String(i)]));
        break;
      case 'orderAbility':
        if (pend.canSkip) choose([]);
        for (const o of pend.options) choose([String(o.id)]);
        break;
    }
    return out;
  }

  return { newGame, apply, legalActions, power, soul, playProblem, cardOf, abilitiesOf: fx.abilitiesOf, levelOf: fx.levelOf };
}

export type Engine = ReturnType<typeof createEngine>;

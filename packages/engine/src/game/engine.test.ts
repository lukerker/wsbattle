// 規則情境測試（白板卡：卡片能力尚未接上，只驗規則）。〔 〕為總合規則編號。
import { describe, expect, it } from 'vitest';
import type { Card } from '../card-schema.ts';
import * as bd from '../cards/bd-w125.ts';
import * as btr from '../cards/btr-w107.ts';
import { createEngine } from './engine.ts';
import type { Action, GameState, PlayerId, Slot, GameZone } from './types.ts';
import { viewFor } from './view.ts';

const db = new Map<string, Card>([...btr.cards, ...bd.cards].map((c) => [c.id, c]));
const E = createEngine(db);
const list = (d: { cardId: string; count: number }[]) => d.flatMap((x) => Array<string>(x.count).fill(x.cardId));
const DECKS: [string[], string[]] = [list(btr.deck), list(bd.deck)];

function ok(s: GameState, a: Action): GameState {
  const r = E.apply(s, a);
  if (r.error) throw new Error(`${a.type}: ${r.error}`);
  return r.state;
}

// 開局並雙方不換牌，停在先攻玩家的時計階段
function start(seed = 1): GameState {
  let s = E.newGame({ seed, decks: DECKS }).state;
  s = ok(s, { type: 'mulligan', player: s.firstPlayer, discard: [] });
  s = ok(s, { type: 'mulligan', player: (1 - s.firstPlayer) as PlayerId, discard: [] });
  return s;
}
// 從時計階段略過，進入主要階段
const toMain = (s: GameState) => ok(s, { type: 'clock', player: s.turnPlayer, uid: null });

// 測試用：把指定卡號的一張卡（從任何區域）放到指定區域
function place(s: GameState, p: PlayerId, cardId: string, zone: Exclude<GameZone, 'stage'> | { slot: Slot; state?: 'stand' | 'rest' | 'reverse' }, top = false): string {
  const pl = s.players[p];
  // 已經在目標區域的卡不拿，避免同卡號重複放時拿回同一張
  const uid = take(s, p, cardId, new Set(typeof zone === 'object' || zone === 'deck' ? [] : pl[zone]));
  if (typeof zone === 'object') pl.stage[zone.slot] = { uid, state: zone.state ?? 'stand' };
  else if (zone === 'deck' && top) pl.deck.unshift(uid);
  else pl[zone].push(uid);
  return uid;
}
function take(s: GameState, p: PlayerId, cardId: string, exclude: Set<string>): string {
  const pl = s.players[p];
  for (const z of ['deck', 'hand', 'waiting', 'clock', 'level', 'stock', 'climax', 'memory', 'resolution'] as const) {
    const i = pl[z].findIndex((u) => s.cards[u]!.cardId === cardId && !exclude.has(u));
    if (i >= 0) return pl[z].splice(i, 1)[0]!;
  }
  throw new Error(`找不到 ${cardId}`);
}
// 把牌組最上面換成指定的卡（陣列第一張在最上面）
function stackDeck(s: GameState, p: PlayerId, ids: string[]) {
  const used = new Set<string>();
  const uids = ids.map((id) => {
    const u = take(s, p, id, used);
    used.add(u);
    return u;
  });
  s.players[p].deck.unshift(...uids);
}
// 對手（BD）的非名場面卡，各有 4 張
const BD_FILLER = ['BD/W125-T01', 'BD/W125-T03', 'BD/W125-T08', 'BD/W125-T11', 'BD/W125-T01', 'BD/W125-T03', 'BD/W125-T08'];
const total = (s: GameState, p: PlayerId) => {
  const pl = s.players[p];
  return pl.deck.length + pl.hand.length + pl.waiting.length + pl.clock.length + pl.level.length + pl.stock.length + pl.climax.length + pl.memory.length + pl.resolution.length + pl.stage.filter(Boolean).length;
};

const NON_CX_BTR = 'BTR/W107-T16'; // ギターボーカル 喜多郁代：Lv1 費0 5500，無判定
const NON_CX_BD = 'BD/W125-T10'; // “Veritas”ドロリス：Lv0 1500，無判定

describe('遊戲準備〔5〕', () => {
  it('各抽 5 張，先攻先換牌；同樣的種子得到同樣的牌序', () => {
    const a = E.newGame({ seed: 42, decks: DECKS }).state;
    const b = E.newGame({ seed: 42, decks: DECKS }).state;
    const c = E.newGame({ seed: 43, decks: DECKS }).state;
    expect(a.players[0].hand).toHaveLength(5);
    expect(a.players[1].deck).toHaveLength(45);
    expect(a.pending).toEqual({ kind: 'mulligan', player: a.firstPlayer, waiting: [a.firstPlayer, 1 - a.firstPlayer] });
    expect(a.players[0].deck).toEqual(b.players[0].deck);
    expect(a.players[0].deck).not.toEqual(c.players[0].deck);
  });

  it('換牌：雙方同時進行，後攻也可以先換（使用者決定，規則原本是先攻先）', () => {
    let x = E.newGame({ seed: 7, decks: DECKS }).state;
    const second = (1 - x.firstPlayer) as PlayerId;
    x = ok(x, { type: 'mulligan', player: second, discard: [] });
    expect(x.pending).toEqual({ kind: 'mulligan', player: x.firstPlayer, waiting: [x.firstPlayer] });
    x = ok(x, { type: 'mulligan', player: x.firstPlayer, discard: [] });
    expect(x.turn).toBe(1);
    expect(x.turnPlayer).toBe(x.firstPlayer);
  });

  it('換牌：丟幾張就抽幾張〔5.2.1.4〕', () => {
    let s = E.newGame({ seed: 7, decks: DECKS }).state;
    const fp = s.firstPlayer;
    const discard = s.players[fp].hand.slice(0, 2);
    s = ok(s, { type: 'mulligan', player: fp, discard });
    expect(s.players[fp].hand).toHaveLength(5);
    expect(s.players[fp].waiting).toEqual(discard);
    expect(s.pending).toEqual({ kind: 'mulligan', player: 1 - fp, waiting: [1 - fp] });
  });

  it('換牌後先攻玩家起立、抽 1 張，停在時計階段〔6.2、6.3〕', () => {
    const s = start();
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('clock');
    expect(s.players[s.firstPlayer].hand).toHaveLength(6);
  });
});

describe('時計階段〔6.4〕', () => {
  it('放 1 張到傷害區就抽 2 張', () => {
    let s = start();
    const tp = s.turnPlayer;
    const uid = s.players[tp].hand[0]!;
    s = ok(s, { type: 'clock', player: tp, uid });
    expect(s.players[tp].clock).toEqual([uid]);
    expect(s.players[tp].hand).toHaveLength(7);
    expect(s.phase).toBe('main');
  });
});

describe('出牌條件〔8.6.2.1〕', () => {
  it('等級不足不能出', () => {
    const s = toMain(start(3));
    const tp = s.turnPlayer;
    const deck = tp === 0 ? 'BTR/W107-T16' : 'BD/W125-T04';
    const uid = place(s, tp, deck, 'hand');
    expect(E.apply(s, { type: 'playCharacter', player: tp, uid, slot: 0 }).error).toMatch('等級不足');
  });

  it('Lv0 不需要顏色條件；Lv1 以上要等級區或傷害區有同色卡', () => {
    const s = toMain(start(3));
    s.turnPlayer = 0;
    s.pending = { kind: 'main', player: 0 };
    const lv0 = place(s, 0, 'BTR/W107-T01', 'hand'); // 黃 Lv0
    expect(E.apply(s, { type: 'playCharacter', player: 0, uid: lv0, slot: 0 }).error).toBeUndefined();
    place(s, 0, 'BTR/W107-T03', 'level'); // 等級區放黃色
    const red = place(s, 0, 'BTR/W107-T16', 'hand'); // 紅 Lv1
    expect(E.apply(s, { type: 'playCharacter', player: 0, uid: red, slot: 1 }).error).toMatch('顏色');
    place(s, 0, 'BTR/W107-T15', 'clock'); // 傷害區放紅色
    expect(E.apply(s, { type: 'playCharacter', player: 0, uid: red, slot: 1 }).error).toBeUndefined();
  });

  it('費用從能量區支付到休息室；付不起不能出〔2.7.2〕', () => {
    let s = toMain(start(3));
    s.turnPlayer = 0;
    s.pending = { kind: 'main', player: 0 };
    for (const id of ['BTR/W107-T03', 'BTR/W107-T05', 'BTR/W107-T08']) place(s, 0, id, 'level'); // 黃色 3 張 → Lv3
    const uid = place(s, 0, 'BTR/W107-T09', 'hand'); // Lv3 費2
    expect(E.apply(s, { type: 'playCharacter', player: 0, uid, slot: 0 }).error).toMatch('能量不足');
    place(s, 0, 'BTR/W107-T02', 'stock');
    place(s, 0, 'BTR/W107-T02', 'stock');
    const wr = s.players[0].waiting.length;
    s = ok(s, { type: 'playCharacter', player: 0, uid, slot: 0 });
    expect(s.players[0].stock).toHaveLength(0);
    expect(s.players[0].waiting).toHaveLength(wr + 2);
    expect(s.players[0].stage[0]).toEqual({ uid, state: 'stand' });
  });

  it('打到已有角色的格子，原本的角色進休息室', () => {
    let s = toMain(start(3));
    s.turnPlayer = 0;
    s.pending = { kind: 'main', player: 0 };
    const old = place(s, 0, 'BTR/W107-T01', { slot: 1 });
    const uid = place(s, 0, 'BTR/W107-T15', 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid, slot: 1 });
    expect(s.players[0].stage[1]!.uid).toBe(uid);
    expect(s.players[0].waiting).toContain(old);
  });

  it('名場面只能在名場面階段打、不看等級但要顏色條件〔6.6、8.6.2.1.2.1〕', () => {
    let s = toMain(start(3));
    s.turnPlayer = 0;
    s.pending = { kind: 'main', player: 0 };
    const cx = place(s, 0, 'BTR/W107-T20', 'hand'); // 紅 CX
    s = ok(s, { type: 'pass', player: 0 });
    // 等級區、傷害區沒有紅色：名場面階段直接略過
    expect(s.phase).not.toBe('climax');
    let t = toMain(start(3));
    t.turnPlayer = 0;
    t.pending = { kind: 'main', player: 0 };
    place(t, 0, 'BTR/W107-T20', 'hand');
    place(t, 0, 'BTR/W107-T15', 'clock');
    t = ok(t, { type: 'pass', player: 0 });
    expect(t.pending).toEqual({ kind: 'climax', player: 0 });
    const uid = t.players[0].hand.find((u) => t.cards[u]!.cardId === 'BTR/W107-T20')!;
    const r = E.apply(t, { type: 'playClimax', player: 0, uid });
    expect(r.events).toContainEqual(expect.objectContaining({ t: 'move', uid, to: { p: 0, zone: 'climax' } }));
    // 沒有角色能攻擊，回合直接結束；名場面在結束階段進休息室〔6.8.1.3〕
    expect(r.state.players[0].waiting).toContain(uid);
    expect(cx).toBeTruthy();
  });
});

// 讓玩家 0 在主要階段結束後進入攻擊：清空名場面相關條件
function toAttack(s: GameState): GameState {
  if (s.pending?.kind === 'clock') s = ok(s, { type: 'clock', player: s.turnPlayer, uid: null });
  s.turnPlayer = 0;
  s.pending = { kind: 'main', player: 0 };
  for (const u of [...s.players[0].hand]) if (s.cards[u]!.cardId.endsWith('T11') || s.cards[u]!.cardId.endsWith('T12') || s.cards[u]!.cardId.endsWith('T20')) {
    s.players[0].hand.splice(s.players[0].hand.indexOf(u), 1);
    s.players[0].waiting.push(u);
  }
  return ok(s, { type: 'pass', player: 0 });
}

describe('攻擊與戰鬥〔7〕', () => {
  it('直接攻擊：魂傷 +1〔7.2.1.4.1〕，判定卡進能量區〔7.3〕', () => {
    let s = start(5);
    s.turn = 2; // 避開先攻第 1 回合的限制
    const att = place(s, 0, 'BTR/W107-T15', { slot: 1 }); // 魂 1
    stackDeck(s, 0, [NON_CX_BTR]); // 判定卡沒有圖示
    stackDeck(s, 1, BD_FILLER.slice(0, 3));
    s = toAttack(s);
    expect(s.pending?.kind).toBe('attackDeclare');
    const clock = s.players[1].clock.length;
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(s.players[1].clock.length).toBe(clock + 2);
    expect(s.players[0].stock).toHaveLength(1);
    expect(s.players[0].stage[1]).toEqual({ uid: att, state: 'rest' });
  });

  it('側打：魂傷 −正面角色的等級〔7.2.1.4.2〕', () => {
    let s = start(5);
    s.turn = 2;
    place(s, 0, 'BTR/W107-T09', { slot: 0 }); // 魂 2
    place(s, 1, 'BD/W125-T04', { slot: 2 }); // 正面（對手前列右）Lv1
    stackDeck(s, 0, [NON_CX_BTR]);
    stackDeck(s, 1, BD_FILLER.slice(0, 3));
    s = toAttack(s);
    const clock = s.players[1].clock.length;
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'side' });
    expect(s.players[1].clock.length).toBe(clock + 1);
  });

  it('正打：攻擊力較低的倒置；相同就雙方倒置〔7.6.1.2〕', () => {
    let s = start(5);
    s.turn = 2;
    const a = place(s, 0, 'BTR/W107-T16', { slot: 1 }); // 5500
    const d = place(s, 1, 'BD/W125-T11', { slot: 1 }); // 1500（效果只加其他角色）
    stackDeck(s, 0, [NON_CX_BTR]);
    stackDeck(s, 1, BD_FILLER.slice(0, 2));
    s = toAttack(s);
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    // 對手倒置 → 安可步驟自動放進休息室（對手沒有能量可以安可）
    expect(s.players[1].stage[1]).toBeNull();
    expect(s.players[1].waiting).toContain(d);
    expect(s.players[0].stage[1]!.state).toBe('rest');
    expect(a).toBeTruthy();

    let t = start(5);
    t.turn = 2;
    place(t, 0, 'BTR/W107-T03', { slot: 1 }); // 2000
    place(t, 1, 'BD/W125-T11', { slot: 1 }); // 1500 → 改成同攻擊力
    t.players[1].stage[1] = { uid: place(t, 1, 'BD/W125-T03', 'hand'), state: 'stand' }; // 4000
    stackDeck(t, 0, [NON_CX_BTR]);
    stackDeck(t, 1, BD_FILLER.slice(0, 2));
    // 攻擊方 2000，能量 3 張以下時【永】+2000 → 4000，和防守方 4000 相同
    t = toAttack(t);
    const attacker = t.players[0].stage[1]!.uid;
    const defender = t.players[1].stage[1]!.uid;
    const r = E.apply(t, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    const reversed = r.events.filter((e) => e.t === 'cardState' && e.state === 'reverse').map((e) => (e as { uid: string }).uid);
    expect(reversed.sort()).toEqual([attacker, defender].sort());
  });

  it('傷害翻到名場面就取消，翻出的卡全進休息室〔4.12.1.2〕', () => {
    let s = start(5);
    s.turn = 2;
    place(s, 0, 'BTR/W107-T09', { slot: 1 }); // 魂 2 → 直接攻擊 3
    stackDeck(s, 0, [NON_CX_BTR]);
    stackDeck(s, 1, [NON_CX_BD, 'BD/W125-T19', NON_CX_BD]);
    s = toAttack(s);
    const clock = s.players[1].clock.length;
    const wr = s.players[1].waiting.length;
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(s.players[1].clock.length).toBe(clock);
    expect(s.players[1].waiting.length).toBe(wr + 2);
  });

  it('判定到魂圖示：攻擊角色魂傷 +1〔4.14.2.2〕', () => {
    let s = start(5);
    s.turn = 2;
    place(s, 0, 'BTR/W107-T15', { slot: 1 }); // 魂 1 → 直接 2 → 判定魂 3
    stackDeck(s, 0, ['BTR/W107-T07']); // 判定：魂
    stackDeck(s, 1, BD_FILLER.slice(0, 4));
    s = toAttack(s);
    const clock = s.players[1].clock.length;
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(s.players[1].clock.length).toBe(clock + 3);
  });

  it('先攻玩家第 1 回合只能攻擊 1 次〔7.2.1.3.1.2〕', () => {
    let s = start(5);
    s.turn = 1;
    place(s, 0, 'BTR/W107-T15', { slot: 0 });
    place(s, 0, 'BTR/W107-T15', { slot: 2 });
    stackDeck(s, 0, [NON_CX_BTR]);
    stackDeck(s, 1, BD_FILLER.slice(0, 3));
    s = toAttack(s);
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending?.kind).not.toBe('attackDeclare');
  });
});

describe('規則處理〔9〕', () => {
  it('升級：傷害區 7 張時從最下面 7 張選 1 張到等級區，其餘進休息室〔9.3〕', () => {
    let s = start(5);
    s.turn = 2;
    for (const id of BD_FILLER.slice(0, 6)) place(s, 1, id, 'clock');
    place(s, 0, 'BTR/W107-T15', { slot: 1 });
    stackDeck(s, 0, [NON_CX_BTR]);
    stackDeck(s, 1, ['BD/W125-T04', 'BD/W125-T04']);
    s = toAttack(s);
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(s.pending?.kind).toBe('levelUp');
    if (s.pending?.kind !== 'levelUp') return;
    expect(s.pending.options).toHaveLength(7);
    const pick = s.pending.options[6]!;
    const wr = s.players[1].waiting.length;
    s = ok(s, { type: 'choose', player: 1, uids: [pick] });
    expect(s.players[1].level).toEqual([pick]);
    expect(s.players[1].clock).toHaveLength(1);
    expect(s.players[1].waiting.length).toBe(wr + 6);
  });

  it('等級區 4 張就輸〔9.4.1.1〕', () => {
    let s = start(5);
    s.turn = 2;
    for (const id of ['BD/W125-T05', 'BD/W125-T06', 'BD/W125-T12']) place(s, 1, id, 'level');
    for (const id of BD_FILLER.slice(0, 6)) place(s, 1, id, 'clock');
    place(s, 0, 'BTR/W107-T15', { slot: 1 });
    stackDeck(s, 0, [NON_CX_BTR]);
    stackDeck(s, 1, ['BD/W125-T13', 'BD/W125-T14']);
    s = toAttack(s);
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    // 已經等級 3：不用選，直接升到等級 4 → 敗北
    expect(s.winner).toBe(0);
    expect(s.phase).toBe('gameOver');
  });

  it('重洗：牌組用完時休息室洗回牌組，再把 1 張放到傷害區〔9.2〕', () => {
    let s = toMain(start(5));
    const tp = s.turnPlayer;
    const pl = s.players[tp];
    // 牌組只剩 1 張，休息室有 5 張
    while (pl.deck.length > 1) pl.waiting.push(pl.deck.pop()!);
    const wr = pl.waiting.length;
    const clock = pl.clock.length;
    s.pending = { kind: 'clock', player: tp };
    s = ok(s, { type: 'clock', player: tp, uid: pl.hand[0]! }); // 抽 2：第 1 張抽完牌組空 → 重洗
    const after = s.players[tp];
    expect(after.clock.length).toBe(clock + 2); // 時計放的 1 張＋重洗懲罰 1 張
    expect(after.deck.length + after.hand.length).toBeGreaterThan(0);
    expect(after.deck.length).toBe(wr - 1 - 1); // 洗回 wr 張，懲罰 1 張，再抽 1 張
  });
});

describe('安可步驟〔7.7、10.2〕', () => {
  function reversedSetup(stock: number) {
    let s = start(5);
    s.turn = 2;
    place(s, 0, 'BTR/W107-T16', { slot: 1 }); // 5500
    const d = place(s, 1, 'BD/W125-T11', { slot: 1 }); // 1500（效果只加其他角色）
    for (const id of BD_FILLER.slice(0, stock)) place(s, 1, id, 'stock');
    stackDeck(s, 0, [NON_CX_BTR]);
    stackDeck(s, 1, BD_FILLER.slice(0, 2));
    s = toAttack(s);
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' }); // 沒有其他角色能攻擊，直接進入安可步驟
    return { s, d };
  }

  it('倒置的角色放進休息室；付 3 能量可以橫置回原位', () => {
    let { s, d } = reversedSetup(3);
    // 倒置的角色自動放進休息室，只問要不要安可（預設安可［③］）
    expect(s.players[1].waiting).toContain(d);
    expect(s.pending).toMatchObject({ kind: 'confirm', player: 1 });
    const r = E.apply(s, { type: 'yesno', player: 1, yes: true });
    expect(r.events).toContainEqual(expect.objectContaining({ t: 'move', uid: d, from: { p: 1, zone: 'waiting' }, to: { p: 1, zone: 'stage', slot: 1 } }));
    expect(r.state.players[1].stage[1]?.uid).toBe(d);
    expect(r.state.players[1].stock).toHaveLength(0);
    // 回場時是橫置；之後輪到對手的回合，起立階段才直立
    expect(r.events.findIndex((e) => e.t === 'cardState' && e.uid === d && e.state === 'stand')).toBeGreaterThan(r.events.findIndex((e) => e.t === 'phase' && e.phase === 'stand'));
    expect(r.state.turnPlayer).toBe(1);
  });

  it('能量不足 3 張就不能安可', () => {
    const { s, d } = reversedSetup(2);
    expect(s.pending?.kind).not.toBe('confirm'); // 付不起就不問
    expect(s.players[1].waiting).toContain(d);
    expect(s.players[1].stage[1]).toBeNull();
  });
});

describe('結束階段〔6.8〕', () => {
  it('手牌超過 7 張要丟到 7 張；名場面區的卡進休息室；換對手', () => {
    let s = toMain(start(5));
    const tp = s.turnPlayer;
    while (s.players[tp].hand.length < 9) s.players[tp].hand.push(s.players[tp].deck.shift()!);
    s = ok(s, { type: 'pass', player: tp });
    while (s.pending && s.pending.kind !== 'handLimit') s = ok(s, { type: 'pass', player: tp });
    expect(s.pending).toEqual({ kind: 'handLimit', player: tp, count: 2 });
    s = ok(s, { type: 'choose', player: tp, uids: s.players[tp].hand.slice(0, 2) });
    expect(s.players[tp].hand).toHaveLength(7);
    expect(s.turnPlayer).toBe(1 - tp);
    expect(s.turn).toBe(2);
  });
});

describe('資訊過濾', () => {
  it('看不到對手的手牌與任何人的牌組、能量；也拿不到亂數狀態', () => {
    const s = start(5);
    const v = viewFor(s, 0);
    expect(v.players[1].hand.every((u) => v.cards[u]!.cardId === null)).toBe(true);
    expect(v.players[0].hand.every((u) => v.cards[u]!.cardId !== null)).toBe(true);
    expect(v.players[0].deck.every((u) => v.cards[u]!.cardId === null)).toBe(true);
    expect('rng' in v).toBe(false);
    const spec = viewFor(s, 'spectator');
    expect(spec.players[0].hand.every((u) => spec.cards[u]!.cardId === null)).toBe(true);
  });
});

describe('整局對打（隨機選擇合法動作，直到分出勝負）', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])('種子 %i：能完整打完一局，且卡片總數始終是 50 張', (seed) => {
    let s = E.newGame({ seed, decks: DECKS }).state;
    const bot = { rng: seed * 7919 };
    const rand = (n: number) => {
      bot.rng = (bot.rng * 1103515245 + 12345) % 2147483648;
      return bot.rng % n;
    };
    let actions = 0;
    while (s.winner === null && actions < 20000) {
      const legal = E.legalActions(s);
      expect(legal.length, `第 ${actions} 步沒有可做的動作（pending: ${JSON.stringify(s.pending)}）`).toBeGreaterThan(0);
      // 主要階段偏向結束，避免無意義地一直換位置
      const pass = legal.find((a) => a.type === 'pass');
      const a = pass && rand(3) === 0 ? pass : legal[rand(legal.length)]!;
      const r = E.apply(s, a);
      expect(r.error, JSON.stringify(a)).toBeUndefined();
      s = r.state;
      actions++;
      expect(total(s, 0)).toBe(50);
      expect(total(s, 1)).toBe(50);
    }
    expect(s.winner).not.toBeNull();
    expect(s.players.some((p) => p.level.length >= 4 || (p.deck.length === 0 && p.waiting.length === 0))).toBe(true);
  });
});

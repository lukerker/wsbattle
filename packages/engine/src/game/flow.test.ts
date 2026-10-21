// 回合流程的整體檢查：一位玩家把整個回合跑完才換人、每回合都抽牌、先攻第 1 回合只能攻擊 1 次。
import { describe, expect, it } from 'vitest';
import * as gbfBp from '../cards/gbf-s134-bp.ts';
import * as gcrBp from '../cards/gcr-se48-bp.ts';
import { E, CS_DECK, DECKS, FT_DECK, GBF_DECK, GCR_DECK, LRC_DECK, choose, decideFirst, ok, oppTurn, order, put, scene, top, yes } from './test-utils.ts';
import type { GameState, PlayerId } from './types.ts';

const ORDER = ['stand', 'draw', 'clock', 'main', 'climax', 'attack', 'encore', 'end'];

function randomGame(seed: number, decks: [string[], string[]] = DECKS) {
  let s = E.newGame({ seed, decks }).state;
  const bot = { r: seed * 7919 };
  const rand = (n: number) => {
    bot.r = (bot.r * 1103515245 + 12345) % 2147483648;
    return bot.r % n;
  };
  const turns: { turn: number; player: PlayerId; phases: string[]; handBefore: number; handAfterDraw: number | null }[] = [];
  for (let i = 0; i < 3000 && s.winner === null; i++) {
    const legal = E.legalActions(s);
    const pass = legal.find((a) => a.type === 'pass');
    const a = pass && rand(3) === 0 ? pass : legal[rand(legal.length)]!;
    const before: GameState = s;
    const r = E.apply(s, a);
    expect(r.error, `合法動作被拒絕：${JSON.stringify(a)}`).toBeUndefined();
    s = r.state;
    for (const e of r.events) {
      if (e.t !== 'phase') continue;
      if (e.phase === 'stand') turns.push({ turn: s.turn, player: e.player, phases: [], handBefore: before.players[e.player].hand.length, handAfterDraw: null });
      const t = turns.at(-1);
      if (!t) continue;
      expect(e.player, `第 ${t.turn} 回合中途換成另一位玩家`).toBe(t.player);
      t.phases.push(e.phase);
    }
  }
  return turns;
}

describe('回合流程', () => {
  it.each([1, 2, 3, 4, 5])('種子 %i：每個回合由同一位玩家依序跑完 起立→抽牌→時計→主要→名場面→攻擊→安可→結束，才換對手', (seed) => {
    const turns = randomGame(seed);
    expect(turns.length).toBeGreaterThan(4);
    for (const t of turns.slice(0, -1)) {
      expect(t.phases).toEqual(ORDER);
    }
    for (let i = 1; i < turns.length; i++) expect(turns[i]!.player).not.toBe(turns[i - 1]!.player);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('Girls Band Cry 隨機對打（種子 %i）：每個合法動作都能執行，回合流程正確', (seed) => {
    for (const decks of [[GCR_DECK, DECKS[1]], [DECKS[0], GCR_DECK], [GBF_DECK, GCR_DECK], [DECKS[1], GBF_DECK]] as [string[], string[]][]) {
      const turns = randomGame(seed, decks);
      expect(turns.length).toBeGreaterThan(4);
      for (const t of turns.slice(0, -1)) expect(t.phases).toEqual(ORDER);
    }
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('莉可麗絲 隨機對打（種子 %i）：每個合法動作都能執行，回合流程正確', (seed) => {
    for (const decks of [[LRC_DECK, DECKS[0]], [GBF_DECK, LRC_DECK], [LRC_DECK, LRC_DECK]] as [string[], string[]][]) {
      const turns = randomGame(seed, decks);
      expect(turns.length).toBeGreaterThan(4);
      for (const t of turns.slice(0, -1)) expect(t.phases).toEqual(ORDER);
    }
  });

  it.each([1, 2, 3, 4, 5, 6])('FAIRY TAIL、蠟筆小新 隨機對打（種子 %i）：每個合法動作都能執行，回合流程正確', (seed) => {
    for (const decks of [[FT_DECK, CS_DECK], [CS_DECK, DECKS[0]], [GBF_DECK, FT_DECK]] as [string[], string[]][]) {
      const turns = randomGame(seed, decks);
      expect(turns.length).toBeGreaterThan(4);
      for (const t of turns.slice(0, -1)) expect(t.phases).toEqual(ORDER);
    }
  });

  // 補充包：每副牌從卡池裡取一段角色、事件（各 1 張），加上 8 張名場面，讓隨機對打用到盡量多的卡
  const poolDecks = (cards: { id: string; type: string }[]) => {
    const rest = cards.filter((c) => c.type !== 'climax').map((c) => c.id);
    const cx = cards.filter((c) => c.type === 'climax').map((c) => c.id);
    const out: string[][] = [];
    for (let i = 0; i < rest.length; i += 21) out.push([...Array.from({ length: 42 }, (_, k) => rest[(i + k) % rest.length]!), ...Array.from({ length: 8 }, (_, k) => cx[(i + k) % cx.length]!)]);
    return out;
  };
  it.each([1, 2, 3, 4])('補充包卡池隨機對打（種子 %i）：每個合法動作都能執行，回合流程正確', (seed) => {
    const gcr = poolDecks(gcrBp.cards);
    const gbf = poolDecks(gbfBp.cards);
    for (let i = 0; i < Math.max(gcr.length, gbf.length); i++) {
      const decks: [string[], string[]] = [gcr[i % gcr.length]!, gbf[i % gbf.length]!];
      const turns = randomGame(seed + i * 10, decks);
      expect(turns.length).toBeGreaterThan(4);
      for (const t of turns.slice(0, -1)) expect(t.phases).toEqual(ORDER);
    }
  });

  it('每個回合開始都會抽 1 張（含先攻玩家的第 1 回合）〔6.3〕', () => {
    let s = E.newGame({ seed: 9, decks: DECKS }).state;
    s = ok(s, { type: 'mulligan', player: s.firstPlayer, discard: [] });
    s = ok(s, { type: 'mulligan', player: (1 - s.firstPlayer) as PlayerId, discard: [] });
    s = decideFirst(s);
    expect(s.players[s.firstPlayer].hand).toHaveLength(6);
    // 跑到對手的回合
    const fp = s.firstPlayer;
    s = ok(s, { type: 'clock', player: fp, uid: null });
    s = ok(s, { type: 'pass', player: fp });
    while (s.turnPlayer === fp) s = ok(s, E.legalActions(s).find((a) => a.type === 'pass' || a.type === 'choose')!);
    expect(s.players[(1 - fp) as PlayerId].hand).toHaveLength(6);
    expect(s.phase).toBe('clock');
  });

  it('先攻第 1 回合：舞台可以放滿，但只能用 1 隻前列角色攻擊 1 次〔7.2.1.3.1.2〕', () => {
    let s = scene();
    s.turn = 1;
    for (const [id, slot] of [['BTR/W107-T01', 0], ['BTR/W107-T03', 1], ['BTR/W107-T15', 2], ['BTR/W107-T13', 3], ['BTR/W107-T14', 4]] as const) {
      put(s, 0, id, 'hand');
      const uid = s.players[0].hand.at(-1)!;
      s = ok(s, { type: 'playCharacter', player: 0, uid, slot });
      while (s.pending?.kind !== 'main') s = s.pending?.kind === 'confirm' ? yes(s) : s.pending?.kind === 'select' ? choose(s, []) : ok(s, E.legalActions(s)[0]!);
    }
    expect(s.players[0].stage.every(Boolean)).toBe(true);
    s = ok(s, { type: 'pass', player: 0 });
    while (s.pending?.kind !== 'attackDeclare') s = ok(s, { type: 'pass', player: 0 });
    expect(E.legalActions(s).filter((a) => a.type === 'attack').map((a) => (a as { slot: number }).slot).sort()).toEqual([0, 1, 2]);
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    // 攻擊結束後不會再出現攻擊宣告（前列另外 2 隻還是直立的）
    while (s.pending && s.turnPlayer === 0 && s.pending.kind !== 'attackDeclare' && s.phase === 'attack') s = ok(s, E.legalActions(s)[0]!);
    expect(s.pending?.kind).not.toBe('attackDeclare');
    expect(s.players[0].stage[0]!.state).toBe('stand');
  });

  it('安可步驟：倒置的角色自動放進休息室；卡上的安可和安可［③］都付得起時，可以兩個都不發動', () => {
    let s = oppTurn(scene());
    const kita = put(s, 0, 'BTR/W107-T17', { slot: 1 });
    put(s, 1, 'BD/W125-T06', { slot: 1 }); // 9500，打倒喜多
    put(s, 0, 'BTR/W107-T16', 'hand'); // 卡上安可的費用
    for (const id of ['BTR/W107-T02', 'BTR/W107-T02', 'BTR/W107-T02']) put(s, 0, id, 'stock'); // 安可［③］的費用
    top(s, 1, ['BD/W125-T01']);
    top(s, 0, ['BTR/W107-T15']);
    while (s.pending?.kind !== 'attackDeclare') s = ok(s, { type: 'pass', player: 1 });
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    expect(s.players[0].waiting).toContain(kita);
    expect(s.pending).toMatchObject({ kind: 'orderAbility', player: 0, canSkip: true });
    s = choose(s, []); // 都不發動
    expect(s.players[0].stage[1]).toBeNull();
    expect(s.players[0].stock).toHaveLength(3);
  });

  it('看牌組上方 3 張：沒有可以拿的卡，也要先翻給玩家看，按確認後才放到休息室', () => {
    let s = scene();
    const bocchi = put(s, 0, 'BTR/W107-T14', 'hand');
    const looked = top(s, 0, ['BTR/W107-T16', 'BTR/W107-T01', 'BTR/W107-T15']); // 都不是事件
    s = ok(s, { type: 'playCharacter', player: 0, uid: bocchi, slot: 1 });
    s = order(s, undefined, '事件');
    expect(s.pending).toMatchObject({ kind: 'select', player: 0, options: [], max: 0, shown: looked });
    s = choose(s, []);
    expect(s.players[0].waiting).toEqual(expect.arrayContaining(looked));
  });

  it('拿到事件時，對手要看過公開的卡並按確認', () => {
    let s = scene();
    const bocchi = put(s, 0, 'BTR/W107-T14', 'hand');
    put(s, 0, 'BTR/W107-T15', 'hand');
    const [ev] = top(s, 0, ['BTR/W107-T10', 'BTR/W107-T01', 'BTR/W107-T15']);
    s = ok(s, { type: 'playCharacter', player: 0, uid: bocchi, slot: 1 });
    s = order(s, undefined, '事件');
    s = choose(s, [ev!]);
    expect(s.pending).toMatchObject({ kind: 'acknowledge', player: 1, cards: [ev] });
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', player: 0 }); // 接著丟 1 張手牌
  });

  it('絆：休息室有指定的卡時，付完費用自動回到手牌；沒有的話，付了費用也沒事發生', () => {
    let s = oppTurn(scene());
    const d = put(s, 1, 'BD/W125-T09', 'hand');
    put(s, 1, 'BD/W125-T19', 'hand');
    const target = put(s, 1, 'BD/W125-T04', 'waiting');
    s = ok(s, { type: 'playCharacter', player: 1, uid: d, slot: 3 });
    s = yes(s);
    expect(s.players[1].hand).toEqual([target]);

    let t = oppTurn(scene());
    const d2 = put(t, 1, 'BD/W125-T09', 'hand');
    const cost = put(t, 1, 'BD/W125-T19', 'hand');
    t = ok(t, { type: 'playCharacter', player: 1, uid: d2, slot: 3 });
    t = yes(t);
    expect(t.players[1].hand).toEqual([]);
    expect(t.players[1].waiting).toEqual([cost]);
  });
});

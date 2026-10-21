// FAIRY TAIL 預組（FT/S09）每張卡的情境測試。牌組在玩家 0；對手（玩家 1）用孤獨搖滾預組。
import { describe, expect, it } from 'vitest';
import type { GameState } from './types.ts';
import { DECKS, E, FT_DECK, choose, ok, oppTurn, pass, passUntil, put, scene, top, yes } from './test-utils.ts';

const C = (n: string) => `FT/S09-${n}`;
const BTR = (n: string) => `BTR/W107-${n}`;
const sc = () => scene(11, [FT_DECK, DECKS[0]]);
const redLevels = (s: GameState, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C('T09'), 'level'); };
const stock = (s: GameState, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C(['T07', 'T07', 'T07', 'T07', '104', '104'][i]!), 'stock'); }; // 名場面：付掉後不會變成撿回的候選
const skipCounter = (s: GameState) => (s.pending?.kind === 'counter' ? pass(s) : s);

describe('FAIRY TAIL FT/S09', () => {
  it('T01 蜜拉珍：應援 +500；每回合第一次使用【起】時選 1 張角色 +500', () => {
    let s = sc();
    put(s, 0, C('T01'), { slot: 3 });
    const gray = put(s, 0, C('105'), { slot: 0 });
    expect(E.power(s, gray)).toBe(3000);
    stock(s, 4);
    s = ok(s, { type: 'activate', player: 0, uid: gray, index: 0 });
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
    s = choose(s, [gray]);
    expect(E.power(s, gray)).toBe(3000 + 5000 + 500);
    s = ok(s, { type: 'activate', player: 0, uid: gray, index: 0 });
    expect(s.pending).toMatchObject({ kind: 'main' }); // 這回合已經發動過
    expect(E.power(s, gray)).toBe(3000 + 10000 + 500);
  });

  it('T02 露西：橫置 2 張角色，1 張《鑰匙》角色 +2000', () => {
    let s = sc();
    const lucy = put(s, 0, C('T02'), { slot: 0 });
    const a = put(s, 0, C('T03'), { slot: 3 });
    const b = put(s, 0, C('T05'), { slot: 4 });
    put(s, 0, C('T09'), { slot: 1 }); // 《龍》：不是加成的對象
    s = ok(s, { type: 'activate', player: 0, uid: lucy, index: 0 });
    expect(s.pending).toMatchObject({ kind: 'select', min: 2, max: 2 });
    s = choose(s, [a, b]);
    expect([s.players[0].stage[3]?.state, s.players[0].stage[4]?.state]).toEqual(['rest', 'rest']);
    expect(s.pending).toMatchObject({ kind: 'select', options: [lucy, a, b] });
    s = choose(s, [lucy]);
    expect(E.power(s, lucy)).toBe(4000);
  });

  it('沒有效果的角色：T03、T05、T06、T09、T11、103', () => {
    const s = sc();
    const got = ['T03', 'T05', 'T06', 'T09', 'T11', '103'].map((n, i) => {
      const u = put(s, 0, C(n), { slot: (i % 5) as 0 });
      return [E.power(s, u), E.soul(s, u)];
    });
    expect(got).toEqual([[3000, 1], [5500, 1], [9000, 2], [3000, 1], [9000, 2], [7000, 1]]);
  });

  it('T04 艾爾夫曼：橫置 1 張角色，自己 +1000', () => {
    let s = sc();
    const u = put(s, 0, C('T04'), { slot: 0 });
    const back = put(s, 0, C('T03'), { slot: 3 });
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 0 });
    s = choose(s, [back]);
    expect(E.power(s, u)).toBe(5500);
    expect(s.players[0].stage[0]?.state).toBe('stand');
  });

  it('T07 DEAR KABY：攻擊力 +1000、魂傷 +1；判定翻到時回手牌，可以把牌組上方 1 張放到能量區', () => {
    let s = sc();
    const u = put(s, 0, C('T09'), { slot: 0 });
    put(s, 0, C('T07'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([4000, 2]);

    s = sc();
    put(s, 0, C('T09'), { slot: 0 });
    const [cx, next] = top(s, 0, [C('T07'), C('T03')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.players[0].hand).toContain(cx);
    expect(s.pending).toMatchObject({ kind: 'yesno', reason: 'treasureStock' });
    s = yes(s);
    expect(s.players[0].stock).toContain(next);
  });

  it('T08 哈比：付②並橫置，撿回休息室的《龍》角色', () => {
    let s = sc();
    const u = put(s, 0, C('T08'), { slot: 3 });
    stock(s, 2);
    const dragon = put(s, 0, C('T11'), 'waiting');
    put(s, 0, C('T05'), 'waiting'); // 不是《龍》
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 0 });
    expect(s.players[0].hand).toEqual([dragon]);
    expect(s.players[0].stage[3]?.state).toBe('rest');
    expect(s.players[0].stock).toHaveLength(0);
  });

  it('T10 年輕的龍 納茲：助太刀 +1500（不用付能量）', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 });
    const def = put(s, 0, C('T05'), { slot: 2 });
    redLevels(s, 1);
    const bk = put(s, 0, C('T10'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 0, mode: 'front' });
    s = passUntil(s, 'counter');
    expect(s.pending).toMatchObject({ options: [bk] });
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(5500 + 1500);
    expect(s.players[0].waiting).toContain(bk);
  });

  it('T12 火之滅龍魔導士 納茲：登場時可以回 1 血；休息室有 2 張「火龍的咆哮」+2000', () => {
    let s = sc();
    redLevels(s, 3);
    stock(s, 2);
    const hurt = put(s, 0, C('T03'), 'clock');
    const u = put(s, 0, C('T12'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    s = yes(s);
    expect(s.players[0].waiting).toContain(hurt);
    expect(E.power(s, u)).toBe(9500);
    put(s, 0, C('T14'), 'waiting');
    expect(E.power(s, u)).toBe(9500);
    put(s, 0, C('T14'), 'waiting');
    expect(E.power(s, u)).toBe(11500);
  });

  it('T13 S級任務：選最多 2 張角色，打倒對手時付①撿回 1 張角色', () => {
    let s = sc();
    redLevels(s, 1);
    stock(s, 1);
    const att = put(s, 0, C('103'), { slot: 1 });
    put(s, 1, BTR('T15'), { slot: 1 }); // 2500
    const back = put(s, 0, C('T11'), 'waiting');
    const ev = put(s, 0, C('T13'), 'hand');
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    expect(s.pending).toMatchObject({ kind: 'select', min: 0, max: 2 });
    s = choose(s, [att]);
    top(s, 0, [C('104')]); // 判定的卡（進能量區後被拿去付費，不是角色）
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    s = skipCounter(s);
    expect(s.pending).toMatchObject({ kind: 'confirm', player: 0 });
    s = yes(s);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('T14 火龍的咆哮：打出時牌組上方 1 張放到能量區，全部角色這回合魂傷 +1', () => {
    let s = sc();
    const a = put(s, 0, C('T09'), { slot: 0 });
    const b = put(s, 0, C('T03'), { slot: 1 });
    const cx = put(s, 0, C('T14'), 'hand');
    redLevels(s, 1); // 名場面也要滿足顏色條件
    const [next] = top(s, 0, [C('T05')]);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    expect(s.players[0].stock).toEqual([next]);
    expect([E.soul(s, a), E.soul(s, b), E.power(s, a)]).toEqual([2, 2, 3000]);
  });

  it('101 星靈魔導士 露西：其他《魔法》+500；付①選 1 張角色 +1500', () => {
    let s = sc();
    const lucy = put(s, 0, C('101'), { slot: 3 });
    const natsu = put(s, 0, C('T09'), { slot: 0 });
    const virgo = put(s, 0, C('T06'), { slot: 1 }); // 沒有《魔法》
    expect([E.power(s, natsu), E.power(s, virgo), E.power(s, lucy)]).toEqual([3500, 9000, 3000]);
    stock(s, 1);
    s = ok(s, { type: 'activate', player: 0, uid: lucy, index: 1 });
    s = choose(s, [virgo]);
    expect(E.power(s, virgo)).toBe(10500);
  });

  it('102 艾爾莎：安可［牌組上方 1 張放到傷害區］', () => {
    let s = sc();
    const u = put(s, 0, C('102'), { slot: 0, state: 'reverse' });
    const [hurt] = top(s, 0, [C('T03')]);
    s = passUntil(s, 'confirm');
    expect(s.pending && 'prompt' in s.pending ? s.pending.prompt : '').toContain('艾爾莎');
    s = yes(s);
    expect(s.players[0].stage[0]).toEqual({ uid: u, state: 'rest' });
    expect(s.players[0].clock).toEqual([hurt]);
  });

  it('104 哈比誕生的日子：魂傷 +2', () => {
    const s = sc();
    const u = put(s, 0, C('T09'), { slot: 0 });
    put(s, 0, C('104'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([3000, 3]);
  });

  it('105 格雷：付② +5000', () => {
    let s = sc();
    const u = put(s, 0, C('105'), { slot: 0 });
    stock(s, 2);
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 0 });
    expect(E.power(s, u)).toBe(7500);
    expect(s.players[0].stock).toEqual([]);
  });
});

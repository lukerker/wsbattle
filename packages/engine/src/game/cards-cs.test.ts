// 蠟筆小新 電影版 預組（CS/S114）每張卡的情境測試。牌組在玩家 0；對手（玩家 1）用孤獨搖滾預組。
import { describe, expect, it } from 'vitest';
import type { GameState } from './types.ts';
import { CS_DECK, DECKS, E, choose, no, ok, oppTurn, order, pass, passUntil, put, scene, top, yes } from './test-utils.ts';

const C = (n: string) => `CS/S114-${n}`;
const BTR = (n: string) => `BTR/W107-${n}`;
const sc = () => scene(11, [CS_DECK, DECKS[0]]);
const redLevels = (s: GameState, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C('T05'), 'level'); };
const blueLevels = (s: GameState, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C('T15'), 'level'); };
const stock = (s: GameState, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C(['T20', 'T20', 'T20', 'T20', 'T09', 'T09'][i]!), 'stock'); }; // 名場面：付掉後不會變成撿回的候選
const skipCounter = (s: GameState) => (s.pending?.kind === 'counter' ? pass(s) : s);
const prompt = (s: GameState) => (s.pending && 'prompt' in s.pending ? s.pending.prompt : '');

describe('蠟筆小新 CS/S114', () => {
  it('T01 寶藏獵人 小新：其他「公主 小葵」魂傷 +1；絆：付①撿回小葵', () => {
    let s = sc();
    const hima = put(s, 0, C('T04'), { slot: 0 });
    put(s, 0, C('T01'), { slot: 3 });
    expect(E.soul(s, hima)).toBe(2);

    s = sc();
    stock(s, 1);
    const back = put(s, 0, C('T04'), 'waiting');
    const u = put(s, 0, C('T01'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 3 });
    s = yes(s);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('T02 美冴＆小葵：其他「軟綿綿拳 小新」+1000；集中', () => {
    let s = sc();
    const src = put(s, 0, C('T02'), { slot: 3 });
    const puni = put(s, 0, C('T15'), { slot: 0 });
    expect(E.power(s, puni)).toBe(5500);
    stock(s, 1);
    top(s, 0, [C('T08'), C('T09'), C('T03'), C('T03'), C('T04')]);
    s = ok(s, { type: 'activate', player: 0, uid: src, index: 1 });
    expect(s.pending).toMatchObject({ kind: 'acknowledge', button: '抽 2 張' });
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(2);
  });

  it('T03 前往夢見世界！ 小新：登場丟 1 張，公開牌組上方，撿回等級 X 以下的角色', () => {
    let s = sc();
    const u = put(s, 0, C('T03'), 'hand');
    put(s, 0, C('T20'), 'hand');
    const [shown] = top(s, 0, [C('T04')]); // 等級 1
    const lv1 = put(s, 0, C('T15'), 'waiting');
    put(s, 0, C('T19'), 'waiting'); // Lv3：不能拿
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', options: [lv1] });
    s = choose(s, [lv1]);
    expect(s.players[0].hand).toEqual([lv1]);
    expect(s.players[0].deck[0]).toBe(shown);
  });

  it('T04 公主 小葵：沒有效果，Lv1 攻擊力 5500', () => {
    const s = sc();
    const u = put(s, 0, C('T04'), { slot: 0 });
    expect([E.power(s, u), E.soul(s, u)]).toEqual([5500, 1]);
  });

  it('T05 Get You成功 廣志：攻擊時選 1 張《MOVIE》或《家族》角色 +6000', () => {
    let s = sc();
    const u = put(s, 0, C('T05'), { slot: 0 });
    const mate = put(s, 0, C('T04'), { slot: 1 });
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'select', options: [u, mate] });
    s = choose(s, [mate]);
    expect(E.power(s, mate)).toBe(11500);
  });

  it('T06 家人的羈絆 小新＆小白：登場可以回 1 血；CX 連動：攻擊時付①丟 1 張，給 3 點傷害', () => {
    let s = sc();
    redLevels(s, 3);
    stock(s, 2);
    const hurt = put(s, 0, C('T04'), 'clock');
    const u = put(s, 0, C('T06'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    s = yes(s);
    expect(s.players[0].waiting).toContain(hurt);

    for (const mates of [1, 2]) {
      s = sc();
      redLevels(s, 1);
      stock(s, 1);
      put(s, 0, C('T06'), { slot: 1 });
      put(s, 0, C('T04'), { slot: 3 });
      if (mates === 2) put(s, 0, C('T15'), { slot: 4 });
      put(s, 0, C('T07'), 'hand'); // 要丟的
      const cx = put(s, 0, C('T08'), 'hand');
      const dmg = top(s, 1, [BTR('T13'), BTR('T14'), BTR('T15'), BTR('T16'), BTR('T17'), BTR('T18')]); // 沒有名場面：傷害不會被取消
      s = passUntil(s, 'climax');
      s = ok(s, { type: 'playClimax', player: 0, uid: cx });
      s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
      if (mates === 1) {
        expect(prompt(s)).not.toContain('CX連動');
        continue;
      }
      expect(prompt(s)).toContain('CX連動');
      s = yes(s);
      expect(s.players[1].clock.slice(0, 3)).toEqual(dmg.slice(0, 3)); // 先受 3 點，接著才是攻擊的傷害
    }
  });

  it('T07 英雄VS高衩魔王：休息室最多 2 張角色回手牌，再丟 1 張手牌', () => {
    let s = sc();
    redLevels(s, 2);
    stock(s, 1);
    const a = put(s, 0, C('T19'), 'waiting');
    const b = put(s, 0, C('T06'), 'waiting');
    const junk = put(s, 0, C('T08'), 'hand');
    const ev = put(s, 0, C('T07'), 'hand');
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    expect(s.pending).toMatchObject({ kind: 'select', min: 0, max: 2 });
    s = choose(s, [a, b]);
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
    s = choose(s, [junk]);
    expect(s.players[0].hand.sort()).toEqual([a, b].sort());
  });

  it('T08 歡迎回家 小新！小白！：攻擊力 +1000、魂傷 +1；判定翻到時可以撿回角色', () => {
    let s = sc();
    const u = put(s, 0, C('T04'), { slot: 0 });
    put(s, 0, C('T08'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([6500, 2]);

    s = sc();
    put(s, 0, C('T04'), { slot: 0 });
    const back = put(s, 0, C('T19'), 'waiting');
    top(s, 0, [C('T08')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'comeback', options: [back] });
  });

  it('T09 母親的愛：打出時撿回 1 張判定有魂傷的角色，最多 2 張角色魂傷 +1', () => {
    let s = sc();
    redLevels(s, 1);
    const a = put(s, 0, C('T04'), { slot: 0 });
    const b = put(s, 0, C('T10'), { slot: 1 });
    const c = put(s, 0, C('T03'), { slot: 2 });
    const soulChar = put(s, 0, C('T06'), 'waiting');
    put(s, 0, C('T04'), 'waiting'); // 判定沒有魂傷
    const cx = put(s, 0, C('T09'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    expect(s.pending).toMatchObject({ kind: 'select', options: [soulChar], min: 0, max: 1 });
    s = choose(s, [soulChar]);
    expect(s.pending).toMatchObject({ kind: 'select', min: 0, max: 2 });
    s = choose(s, [a, b]);
    expect([E.soul(s, a), E.soul(s, b), E.soul(s, c), E.power(s, a)]).toEqual([2, 2, 1, 5500]);
    expect(s.players[0].hand).toContain(soulChar);
  });

  it('T10 妮妮：登場時每有 1 張《MOVIE》或《幼稚園》角色 +1000，持續到對手回合結束', () => {
    let s = sc();
    put(s, 0, C('T11'), { slot: 3 });
    put(s, 0, C('T04'), { slot: 4 }); // 《MOVIE》
    const u = put(s, 0, C('T10'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    expect(E.power(s, u)).toBe(1000 + 3000);
    s = passUntil(s, 'clock'); // 對手的回合
    expect(E.power(s, u)).toBe(4000);
  });

  it('T11 阿呆：登場看上方 2 張排順序；付①丟名場面，換回休息室的名場面', () => {
    let s = sc();
    stock(s, 1);
    const want = put(s, 0, C('T08'), 'waiting');
    const junk = put(s, 0, C('T09'), 'hand');
    const u = put(s, 0, C('T11'), 'hand');
    const [a, b] = top(s, 0, [C('T03'), C('T04')]);
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 3 });
    s = order(s, undefined, '好きな順番');
    expect(s.pending).toMatchObject({ kind: 'select', ordered: true });
    s = choose(s, [b!, a!]);
    expect(s.players[0].deck.slice(0, 2)).toEqual([b, a]);
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', options: expect.arrayContaining([want, junk]) }); // 剛丟的也可以選
    s = choose(s, [want]);
    expect(s.players[0].hand).toEqual([want]);
  });

  it('T12 拯救世界 小新：登場 +1500；打倒對手時把其他《MOVIE》或《家族》角色橫置撤到後列', () => {
    let s = sc();
    const u = put(s, 0, C('T12'), 'hand');
    const mate = put(s, 0, C('T04'), { slot: 2 });
    put(s, 1, BTR('T15'), { slot: 1 }); // 2500
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    expect(E.power(s, u)).toBe(3500);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    s = skipCounter(s);
    expect(s.pending).toMatchObject({ kind: 'chooseSlot', slots: [3, 4] });
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 4 });
    expect(s.players[0].stage[4]).toEqual({ uid: mate, state: 'rest' });
  });

  it('T13 風間：從舞台進休息室時付②丟 1 張，看 6 張拿最多 2 張《MOVIE》或《幼稚園》角色', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 1 });
    put(s, 0, C('T13'), { slot: 1 });
    stock(s, 2);
    put(s, 0, C('T08'), 'hand');
    top(s, 1, [BTR('T16')]); // 對手的判定
    const [dmg, x, y, z] = top(s, 0, [C('T03'), C('T04'), C('T10'), C('T09'), C('T03'), C('T08'), C('T07')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    s = skipCounter(s);
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('風間');
    s = yes(s);
    expect(s.players[0].clock).toEqual([dmg]);
    expect(s.pending).toMatchObject({ kind: 'select', max: 2 });
    const opts = s.pending?.kind === 'select' ? s.pending.options : [];
    expect(opts).toEqual(expect.arrayContaining([x, y]));
    expect(opts).not.toContain(z); // 名場面
    s = choose(s, [x!, y!]);
    s = yes(s); // 對手確認
    expect(s.players[0].hand).toEqual(expect.arrayContaining([x, y]));
  });

  it('T14 肥嘟嘟左衛門：登場付①丟 1 張，看 5 張任選 1 張（不公開）', () => {
    let s = sc();
    blueLevels(s, 1);
    stock(s, 1);
    put(s, 0, C('T08'), 'hand');
    const u = put(s, 0, C('T14'), 'hand');
    const looked = top(s, 0, [C('T20'), C('T03'), C('T04'), C('T05'), C('T06')]);
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', options: looked, max: 1 });
    s = choose(s, [looked[0]!]);
    expect(s.pending).toMatchObject({ kind: 'main' }); // 不用給對手確認
    expect(s.players[0].hand).toEqual([looked[0]]);
  });

  it('T14 肥嘟嘟左衛門：倒置時公開牌組上方，Lv2 以上就可以把自己放到能量區', () => {
    for (const [revealed, hit] of [[C('T05'), true], [C('T04'), false]] as const) {
      let s = sc();
      const u = put(s, 0, C('T14'), { slot: 1 });
      put(s, 1, BTR('T16'), { slot: 1 });
      const [, r] = top(s, 0, [C('T03'), revealed]); // 第 1 張是判定
      top(s, 1, [BTR('T16')]);
      s = passUntil(s, 'attackDeclare');
      s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
      s = skipCounter(s);
      expect(s.pending).toMatchObject({ kind: 'acknowledge', cards: [r] });
      s = yes(s);
      if (!hit) {
        expect(s.players[0].stock).not.toContain(u);
        continue;
      }
      s = yes(s);
      expect(s.players[0].stock).toContain(u);
      expect(s.players[0].deck[0]).toBe(r);
    }
  });

  it('T15 軟綿綿拳 小新：登場時每有 1 張《MOVIE》或《家族》角色 +500；CX 連動：給予「打倒對手時從牌組找角色」', () => {
    let s = sc();
    blueLevels(s, 1);
    put(s, 0, C('T02'), { slot: 3 }); // +1000
    put(s, 0, C('T04'), { slot: 4 });
    const u = put(s, 0, C('T15'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    expect(E.power(s, u)).toBe(4500 + 1500 + 1000);
    put(s, 1, BTR('T15'), { slot: 1 });
    const cx = put(s, 0, C('T20'), 'hand');
    top(s, 0, [C('T03')]); // 判定
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
    s = choose(s, [u]);
    s = skipCounter(s);
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    const opts = s.pending?.kind === 'select' ? s.pending.options : [];
    expect(opts.every((o) => E.cardOf(s, o).traits.some((t) => t.ja === 'MOVIE' || t.ja === '家族'))).toBe(true);
    s = choose(s, [opts[0]!]);
    s = yes(s); // 對手確認
    expect(s.players[0].hand).toContain(opts[0]);
  });

  it('T16 正男：助太刀 +2000；使用時看牌組上方 1 張，放回上方或休息室', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 });
    const def = put(s, 0, C('T04'), { slot: 2 });
    blueLevels(s, 1);
    stock(s, 1);
    const bk = put(s, 0, C('T16'), 'hand');
    s = passUntil(s, 'attackDeclare');
    const [t] = top(s, 0, [C('T08')]);
    s = ok(s, { type: 'attack', player: 1, slot: 0, mode: 'front' });
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(5500 + 2000);
    expect(s.pending).toMatchObject({ kind: 'select', options: [t] });
    expect(prompt(s)).toContain('休息室');
    s = choose(s, [t!]);
    expect(s.players[0].waiting).toContain(t);
  });

  it('T17 忍術修行中！ 小新：應援 +等級×500；丟 2 張、橫置 2 張，把手牌的 Lv3 小新放上舞台', () => {
    let s = sc();
    const src = put(s, 0, C('T17'), { slot: 3 });
    const lv0 = put(s, 0, C('T03'), { slot: 0 });
    const lv1 = put(s, 0, C('T04'), { slot: 1 });
    expect([E.power(s, lv0), E.power(s, lv1)]).toEqual([1000, 6000]);
    const d1 = put(s, 0, C('T12'), 'hand');
    const d2 = put(s, 0, C('T15'), 'hand');
    const big = put(s, 0, C('T19'), 'hand');
    s = ok(s, { type: 'activate', player: 0, uid: src, index: 1 });
    expect(s.pending).toMatchObject({ kind: 'select', min: 2, max: 2 });
    s = choose(s, [d1, d2]);
    expect(s.pending).toMatchObject({ kind: 'select', min: 2, max: 2 });
    s = choose(s, [src, lv0]);
    s = choose(s, [big]);
    expect(s.pending).toMatchObject({ kind: 'chooseSlot', slots: [0, 1, 2, 3, 4] });
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 2 });
    expect(s.players[0].stage[2]?.uid).toBe(big);
    expect(prompt(s)).toContain('動感超人'); // Lv3 小新的登場效果
    s = no(s);
  });

  it('T18 與娜娜的互動 小新：其他後列《MOVIE》或《家族》角色每 1 張 +2500', () => {
    const s = sc();
    const u = put(s, 0, C('T18'), { slot: 1 });
    put(s, 0, C('T04'), { slot: 3 });
    expect(E.power(s, u)).toBe(7500);
    put(s, 0, C('T10'), { slot: 4 }); // 《MOVIE》
    expect(E.power(s, u)).toBe(10000);
  });

  it('T19 動感超人變身組 小新：登場時可以給對手 1 點傷害', () => {
    let s = sc();
    blueLevels(s, 3);
    stock(s, 2);
    const u = put(s, 0, C('T19'), 'hand');
    const [dmg] = top(s, 1, [BTR('T16')]);
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    s = yes(s);
    expect(s.players[1].clock).toEqual([dmg]);
  });

  it('T20 守護阿依亞鎮！：攻擊力 +1000、魂傷 +1；判定翻到時（門）可以撿回名場面', () => {
    let s = sc();
    const u = put(s, 0, C('T04'), { slot: 0 });
    put(s, 0, C('T20'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([6500, 2]);

    s = sc();
    put(s, 0, C('T04'), { slot: 0 });
    const back = put(s, 0, C('T08'), 'waiting');
    top(s, 0, [C('T20')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'gate', options: [back] });
  });
});

// 碧藍幻想預組（GBF/S134）每張卡的情境測試。牌組在玩家 0；對手（玩家 1）用孤獨搖滾預組。
import { describe, expect, it } from 'vitest';
import { DECKS, E, GBF_DECK, choose, ok, oppTurn, passUntil, put, scene, top, uidOf, yes } from './test-utils.ts';

const C = (n: string) => `GBF/S134-${n}`;
const BTR = (n: string) => `BTR/W107-${n}`;
const sc = () => scene(11, [GBF_DECK, DECKS[0]]);
const levels = (s: ReturnType<typeof sc>, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C('T08'), 'level'); };

describe('碧藍幻想 GBF/S134', () => {
  it('T01 赤之龍 碧：其他《碧藍幻想》+500；其他《碧藍幻想》被正打時付①把自己放進休息室，戰鬥中的角色 +3000', () => {
    let s = oppTurn(sc());
    const vyrn = put(s, 0, C('T01'), { slot: 3 });
    const def = put(s, 0, C('T08'), { slot: 2 });
    expect(E.power(s, def)).toBe(6000);
    put(s, 0, C('T14'), 'stock');
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 }); // 第 2 隻攻擊者：攻擊後回合還沒結束，「那個回合中」的加成還在
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 0, mode: 'front' });
    expect(s.pending).toMatchObject({ kind: 'confirm', player: 0 });
    s = yes(s);
    expect(s.players[0].waiting).toContain(vyrn);
    expect(E.power(s, def)).toBe(5500 + 3000); // 碧離場，+500 消失
  });

  it('T02 夏洛特：自己回合其他《碧藍幻想》+500；集中', () => {
    let s = sc();
    put(s, 0, C('T02'), { slot: 3 });
    const r = put(s, 0, C('T08'), { slot: 0 });
    expect(E.power(s, r)).toBe(6000);
    s.turnPlayer = 1;
    expect(E.power(s, r)).toBe(5500);
    s.turnPlayer = 0;
    const src = s.players[0].stage[3]!.uid;
    put(s, 0, C('T14'), 'stock');
    top(s, 0, [C('T15'), C('T08'), C('T08'), C('T03'), C('T03')]);
    s = ok(s, { type: 'activate', player: 0, uid: src, index: 1 });
    expect(s.pending).toMatchObject({ kind: 'acknowledge', player: 0, button: '抽 1 張' });
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('T03 維拉：登場丟 1 張，公開牌組上方，撿回等級 X 以下的角色，公開的卡放回原位', () => {
    let s = sc();
    const u = put(s, 0, C('T03'), 'hand');
    put(s, 0, C('T14'), 'hand'); // 要丟的（名場面，不會變成撿回的候選）
    const [shown] = top(s, 0, [C('T09')]); // 等級 2
    const ok1 = put(s, 0, C('T08'), 'waiting'); // Lv1
    put(s, 0, C('T11'), 'waiting'); // Lv3：不能拿
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', options: [ok1], min: 1, max: 1 });
    expect(s.players[0].resolution).toEqual([shown]);
    s = choose(s, [ok1]);
    expect(s.players[0].hand).toEqual([ok1]);
    expect(s.players[0].deck[0]).toBe(shown);
  });

  it('T04 諾亞：名場面階段開始時拉卡姆 +3000、魂傷 +1、攻擊時看 2 張排順序；絆：撿回拉卡姆', () => {
    let s = sc();
    put(s, 0, C('T04'), { slot: 3 });
    const r = put(s, 0, C('T08'), { slot: 1 });
    const [a, b] = top(s, 0, [C('T03'), C('T05')]);
    s = passUntil(s, 'attackDeclare');
    expect(E.power(s, r)).toBe(8500);
    expect(E.soul(s, r)).toBe(2);
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'select', ordered: true, min: 2, max: 2 });
    s = choose(s, [b!, a!]); // b 放到最上面
    expect(s.players[0].stock).toContain(b); // 判定翻的是 b
    expect(s.players[0].deck[0]).toBe(a);

    s = sc();
    const noa = put(s, 0, C('T04'), 'hand');
    put(s, 0, C('T14'), 'hand');
    const back = put(s, 0, C('T08'), 'waiting');
    s = ok(s, { type: 'playCharacter', player: 0, uid: noa, slot: 3 });
    s = yes(s);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('T05 卡塔莉娜：沒有其他《碧藍幻想》時起立階段不直立；登場時給予「打倒對手時把另一張角色橫置撤到後列」', () => {
    let s = oppTurn(sc());
    const k = put(s, 0, C('T05'), { slot: 0, state: 'rest' });
    s = passUntil(s, 'clock'); // 對手回合結束 → 自己的回合
    expect(s.turnPlayer).toBe(0);
    expect(s.players[0].stage[0]).toEqual({ uid: k, state: 'rest' });

    s = oppTurn(sc());
    put(s, 0, C('T05'), { slot: 0, state: 'rest' });
    put(s, 0, C('T08'), { slot: 1 });
    s = passUntil(s, 'clock');
    expect(s.players[0].stage[0]!.state).toBe('stand');

    s = sc();
    const att = put(s, 0, C('T08'), { slot: 1 });
    const retreat = put(s, 0, C('T03'), { slot: 0 });
    const kat = put(s, 0, C('T05'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: kat, slot: 2 });
    s = choose(s, [att]); // 給拉卡姆
    put(s, 1, BTR('T01'), { slot: 1 });
    top(s, 0, [C('T03')]);
    top(s, 1, [BTR('T16'), BTR('T16')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    if (s.pending?.kind === 'counter') s = ok(s, { type: 'pass', player: 1 });
    expect(s.pending).toMatchObject({ kind: 'select', player: 0 });
    s = choose(s, [retreat]);
    expect(s.pending).toMatchObject({ kind: 'chooseSlot', slots: [3, 4] });
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 3 });
    expect(s.players[0].stage[3]).toEqual({ uid: retreat, state: 'rest' });
    expect(s.players[0].stage[0]).toBeNull();
  });

  it('T06 歐根：助太刀 +1000（不用能量），場上有《碧藍幻想》再 +1000', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 });
    const def = put(s, 0, C('T08'), { slot: 2 });
    levels(s, 1);
    const bk = put(s, 0, C('T06'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 0, mode: 'front' });
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(5500 + 2000);
  });

  it('T07 主人公(男)：其他《碧藍幻想》2 張以上 +2000；CX 連動：攻擊時看 4 張拿 1 張《碧藍幻想》角色或事件', () => {
    let s = sc();
    const u = put(s, 0, C('T07'), { slot: 1 });
    put(s, 0, C('T08'), { slot: 0 });
    expect(E.power(s, u)).toBe(4000);
    put(s, 0, C('T08'), { slot: 2 });
    expect(E.power(s, u)).toBe(6000);
    put(s, 0, C('T14'), 'climax');
    const [, ch, ev, cx] = top(s, 0, [C('T03'), C('T11'), C('T13'), C('T15'), C('T09')]); // 第 1 張是判定
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    const opts = s.pending?.kind === 'select' ? s.pending.options : [];
    expect(opts).toEqual(expect.arrayContaining([ch, ev]));
    expect(opts).not.toContain(cx);
    s = choose(s, [ev!]);
    s = yes(s); // 對手確認
    expect(s.players[0].hand).toContain(ev);
  });

  it('T08 拉卡姆：沒有效果，Lv1 攻擊力 5500', () => {
    const s = sc();
    expect(E.power(s, put(s, 0, C('T08'), { slot: 0 }))).toBe(5500);
  });

  it('T09 蘿賽塔：其他《碧藍幻想》+1000；登場丟 1 張《碧藍幻想》角色，把休息室的伊歐放到喜歡的格子（有角色的格子也可以）', () => {
    let s = sc();
    levels(s, 2);
    put(s, 0, C('T14'), 'stock');
    const old = put(s, 0, C('T03'), { slot: 0 });
    const io = put(s, 0, C('T10'), 'waiting');
    put(s, 0, C('T05'), 'hand');
    const u = put(s, 0, C('T09'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 3 });
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'chooseSlot', slots: [0, 1, 2, 3, 4] });
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 0 });
    expect(s.players[0].stage[0]?.uid).toBe(io);
    expect(s.players[0].waiting).toContain(old);
    expect(E.power(s, io)).toBe(6500 + 3000 + 1000); // 後列有蘿賽塔＋蘿賽塔的 +1000
  });

  it('T10 伊歐：後列有蘿賽塔時 +3000，攻擊時可以付①判定 2 次', () => {
    let s = sc();
    const io = put(s, 0, C('T10'), { slot: 1 });
    expect(E.power(s, io)).toBe(6500);
    put(s, 0, C('T09'), { slot: 3 });
    expect(E.power(s, io)).toBe(10500);
    put(s, 0, C('T14'), 'stock');
    const checks = top(s, 0, [C('T03'), C('T05')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    s = yes(s);
    expect(s.players[0].stock).toEqual(checks);
  });

  it('T11 露莉亞：其他《碧藍幻想》+1500；登場時從手牌免費放 1 張角色 +2000；對手安可步驟開始時沒有「主人公」就進休息室', () => {
    let s = sc();
    levels(s, 3);
    put(s, 0, C('T14'), 'stock');
    put(s, 0, C('T14'), 'stock');
    const extra = put(s, 0, C('T08'), 'hand');
    const u = put(s, 0, C('T11'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    s = choose(s, [extra]);
    expect(s.pending).toMatchObject({ kind: 'chooseSlot' });
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 0 });
    expect(s.players[0].stage[0]?.uid).toBe(extra);
    expect(E.power(s, extra)).toBe(5500 + 1500 + 2000);

    s = oppTurn(sc());
    const lyria = put(s, 0, C('T11'), { slot: 0 });
    s = passUntil(s, 'clock');
    expect(s.players[0].waiting).toContain(lyria);

    s = oppTurn(sc());
    const kept = put(s, 0, C('T11'), { slot: 0 });
    put(s, 0, C('T07'), { slot: 1 }); // 主人公(男)
    s = passUntil(s, 'clock');
    expect(s.players[0].stage[0]?.uid).toBe(kept);
  });

  it('T12 主人公(女)：登場可以回 1 血；CX 連動：付①丟 1 張，1 點傷害，看對手牌組上方 2 張，留下的照順序放回、其餘進休息室', () => {
    let s = sc();
    levels(s, 3);
    put(s, 0, C('T14'), 'stock');
    put(s, 0, C('T14'), 'stock');
    const healed = put(s, 0, C('T03'), 'clock');
    const u = put(s, 0, C('T12'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    s = yes(s);
    expect(s.players[0].waiting).toContain(healed);

    s = sc();
    put(s, 0, C('T12'), { slot: 1 });
    put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('T15'), 'climax');
    put(s, 0, C('T14'), 'stock');
    put(s, 0, C('T03'), 'hand');
    top(s, 0, [C('T05')]);
    const [dmg, x, y] = top(s, 1, [BTR('T16'), BTR('T11'), BTR('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    s = yes(s);
    expect(s.players[1].clock).toContain(dmg);
    expect(s.pending).toMatchObject({ kind: 'select', options: [x, y], ordered: true });
    s = choose(s, [y!]); // x（名場面）丟掉，y 留在最上面
    expect(s.players[1].waiting).toContain(x);
    expect(s.players[1].clock).toContain(y); // 接著的攻擊傷害翻到 y
  });

  it('T13 榭洛卡特：反擊事件；反擊步驟可以用，看 4 張拿 1 張《碧藍幻想》角色，用完放到牌組最下面', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 0, C('T08'), { slot: 2 });
    levels(s, 1);
    const ev = put(s, 0, C('T13'), 'hand');
    const [, want] = top(s, 0, [C('T14'), C('T09'), C('T15'), C('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 0, mode: 'front' });
    s = passUntil(s, 'counter');
    expect(s.pending).toMatchObject({ kind: 'counter', options: [ev] });
    s = choose(s, [ev]);
    s = choose(s, [want!]);
    s = yes(s); // 對手確認
    expect(s.players[0].hand).toContain(want);
    expect(s.players[0].deck.at(-1)).toBe(ev);

    s = sc();
    levels(s, 1);
    const ev2 = put(s, 0, C('T13'), 'hand');
    expect(E.playProblem(s, 0, ev2)).toBeNull(); // 自己的主要階段也能用〔2.8.2.1〕
    s = ok(s, { type: 'playEvent', player: 0, uid: ev2 });
    expect(s.pending).toMatchObject({ kind: 'select', player: 0 });
  });

  it('T14、T15 名場面：攻擊力 +1000、魂傷 +1；判定翻到時（門）可以撿回休息室的名場面', () => {
    let s = sc();
    const u = put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('T15'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([6500, 2]);

    s = sc();
    put(s, 0, C('T08'), { slot: 0 });
    const back = put(s, 0, C('T15'), 'waiting');
    top(s, 0, [C('T14')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'gate', options: [back] });
    expect(uidOf(s, 0, C('T14'), 'resolution')).toBeDefined();
  });
});

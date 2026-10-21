// GIRLS BAND CRY 補充包（GCR/SE48-01～69、P01～P13）每張卡的情境測試。牌組在玩家 0；對手（玩家 1）用孤獨搖滾預組。
import { describe, expect, it } from 'vitest';
import * as bp from '../cards/gcr-se48-bp.ts';
import * as gcr from '../cards/gcr-se48.ts';
import type { GameState, PlayerId } from './types.ts';
import { DECKS, E, choose, no, ok, oppTurn, order, pass, passUntil, put, scene, top, yes } from './test-utils.ts';

const C = (n: string) => `GCR/SE48-${n}`;
const BTR = (n: string) => `BTR/W107-${n}`;
const ids = [...bp.cards, ...gcr.cards].map((c) => c.id);
const DECK = [...ids, ...ids, ...ids];
const sc = () => scene(11, [DECK, DECKS[0]]);
const CX = ['47', '48', '49', '50', '51', '68', '69'];
// 能量：用名場面（付掉後不會變成撿回的候選）
const stock = (s: GameState, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C(CX[i % CX.length]!), 'stock'); };
const levels = (s: GameState, n: number, id = 'T11') => { for (let i = 0; i < n; i++) put(s, 0, C(id), 'level'); };
// 前列多放 1 張直立的角色：攻擊後回合不會馬上結束（「那個回合中」的加成還在）
const spare = (s: GameState) => { const slot = ([0, 1, 2] as const).find((i) => !s.players[0].stage[i])!; return put(s, 0, C('T11'), { slot }); };
const skipCounter = (s: GameState) => (s.pending?.kind === 'counter' ? pass(s) : s);
const prompt = (s: GameState) => (s.pending && 'prompt' in s.pending ? s.pending.prompt : '');
const opts = (s: GameState) => (s.pending?.kind === 'select' ? s.pending.options : []);
const option = (s: GameState, i: number) => ok(s, { type: 'choose', player: s.pending!.player, uids: [String(i)] });
const play = (s: GameState, uid: string, slot: number) => ok(s, { type: 'playCharacter', player: 0, uid, slot: slot as 0 });
const attack = (s: GameState, slot: number, mode: 'front' | 'side' | 'direct', player: PlayerId = 0) => ok(s, { type: 'attack', player, slot: slot as 0, mode });
// 牌組上方放沒有判定圖示、不是名場面的卡（判定、傷害都不會被取消）
const plain = (s: GameState, p: PlayerId, n: number) => top(s, p, Array.from({ length: n }, (_, i) => (p === 0 ? C(['01', '02', '03', '04', '05', '06', '07', '08'][i]!) : BTR(['T13', 'T14', 'T15', 'T16', 'T03', 'T01', 'T02', 'T05'][i]!))));

describe('GIRLS BAND CRY 補充包 GCR/SE48', () => {
  it('01 奔跑在川崎 仁菜：前列中央 +3000；「奔跑在川崎 桃香」倒置時付①把它橫置', () => {
    let s = oppTurn(sc());
    const nina = put(s, 0, C('01'), { slot: 1 });
    expect(E.power(s, nina)).toBe(3500);
    const momoka = put(s, 0, C('10'), { slot: 0 });
    stock(s, 1);
    put(s, 1, BTR('T16'), { slot: 2 }); // 正面是桃香
    put(s, 1, BTR('T16'), { slot: 1 }); // 第 2 隻攻擊者
    plain(s, 1, 1);
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 2, 'front', 1);
    s = skipCounter(s);
    expect(prompt(s)).toContain('奔跑在川崎 仁菜');
    s = yes(s);
    expect(s.players[0].stage[0]).toEqual({ uid: momoka, state: 'rest' });
  });

  it('02 無刺的假日 昂：登場把其他《音樂》角色放到休息室抽 1 張；【起】把自己放到休息室，《音樂》角色魂傷 +1', () => {
    let s = sc();
    const old = put(s, 0, C('03'), { slot: 0 });
    const u = put(s, 0, C('02'), 'hand');
    s = play(s, u, 3);
    s = yes(s);
    expect(s.players[0].waiting).toContain(old);
    expect(s.players[0].hand).toHaveLength(1);
    const mate = put(s, 0, C('09'), { slot: 1 });
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    expect(E.soul(s, mate)).toBe(2);
    expect(s.players[0].waiting).toContain(u);
  });

  it('03 TOGENASHI TOGEARI 仁菜：自己回合 +2500；打倒對手時二選一（付費撿回角色）', () => {
    let s = sc();
    const u = put(s, 0, C('03'), { slot: 1 });
    expect(E.power(s, u)).toBe(3500);
    put(s, 1, BTR('T15'), { slot: 1 }); // 2500
    stock(s, 1);
    const back = put(s, 0, C('42'), 'waiting');
    plain(s, 0, 3);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    expect(s.pending).toMatchObject({ kind: 'chooseOption', options: [expect.stringContaining('後列'), expect.stringContaining('撿回')] });
    s = option(s, 1);
    s = yes(s); // 支付費用
    expect(s.pending).toMatchObject({ kind: 'select', options: expect.arrayContaining([back]) });
    s = choose(s, [back]);
    expect(s.players[0].hand).toContain(back);
    expect(s.players[0].clock).toHaveLength(1);
  });

  it('04 新川崎（暫定） 桃香：登場手牌 1 張放到傷害區，看 X 張任選 1 張；被 Lv0 打倒時可以把對手倒置', () => {
    let s = sc();
    put(s, 0, C('03'), { slot: 0 });
    put(s, 0, C('09'), { slot: 1 });
    const junk = put(s, 0, C('47'), 'hand');
    const u = put(s, 0, C('04'), 'hand');
    const looked = plain(s, 0, 3);
    s = play(s, u, 2);
    s = yes(s);
    expect(s.players[0].clock).toEqual([junk]);
    expect(s.pending).toMatchObject({ kind: 'select', shown: looked.slice(0, 2), max: 1 });
    s = choose(s, [looked[1]!]);
    expect(s.players[0].hand).toEqual([looked[1]]);

    s = oppTurn(sc());
    put(s, 0, C('04'), { slot: 0 });
    const att = put(s, 1, BTR('T15'), { slot: 2 }); // Lv0 2500
    plain(s, 1, 1);
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 2, 'front', 1);
    s = skipCounter(s);
    expect(prompt(s)).toContain('新川崎');
    s = yes(s);
    expect(s.players[1].stage[2]).toEqual({ uid: att, state: 'reverse' });
  });

  it('05 （樂團名未定） 桃香：登場排 2 張順序；後列沒有角色時攻擊，牌組上方是 Lv0 角色就放到後列', () => {
    let s = sc();
    const u = put(s, 0, C('05'), 'hand');
    const [a, b] = top(s, 0, [C('03'), C('01')]);
    s = play(s, u, 1);
    s = choose(s, [b!, a!]);
    expect(s.players[0].deck.slice(0, 2)).toEqual([b, a]);
    s = passUntil(s, 'attackDeclare');
    top(s, 0, [C('09'), C('47')]); // 攻擊時的能力先處理（09 放到後列），之後才判定
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'chooseSlot', slots: [3, 4] });
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 4 });
    expect(E.cardOf(s, s.players[0].stage[4]!.uid).id).toBe(C('09'));
  });

  it('06 "騙子" 昂：登場選《音樂》角色 +1500；【起】撿回指定的卡', () => {
    let s = sc();
    const mate = put(s, 0, C('09'), { slot: 0 });
    const u = put(s, 0, C('06'), 'hand');
    s = play(s, u, 3);
    s = choose(s, [mate]);
    expect(E.power(s, mate)).toBe(3000);
    stock(s, 1);
    const want = put(s, 0, C('42'), 'waiting');
    put(s, 0, C('41'), 'waiting');
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    expect(s.players[0].hand).toEqual([want]);
  });

  it('07 溫蒂妮？ 智：登場看 1 張放上方或休息室；集中：每張名場面「看 3 張拿 1 張、丟 1 張」', () => {
    let s = sc();
    const u = put(s, 0, C('07'), 'hand');
    const [x] = plain(s, 0, 1);
    s = play(s, u, 3);
    s = choose(s, [x!]);
    expect(s.players[0].waiting).toContain(x);
    stock(s, 1);
    put(s, 0, C('T11'), 'hand');
    top(s, 0, [C('47'), C('01'), C('02'), C('03'), C('04'), C('05'), C('06')]);
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    expect(s.pending).toMatchObject({ kind: 'acknowledge' });
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    s = choose(s, [opts(s)[0]!]);
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 }); // 丟 1 張手牌
    s = choose(s, [opts(s)[0]!]);
    expect(s.players[0].stage[3]?.state).toBe('stand'); // 不用橫置
  });

  it('08 全部攤開 智：其他《音樂》2 張以上時登場抽 1 丟 1；丟名場面撿回《音樂》角色', () => {
    let s = sc();
    put(s, 0, C('03'), { slot: 0 });
    put(s, 0, C('09'), { slot: 1 });
    put(s, 0, C('T11'), 'hand');
    const u = put(s, 0, C('08'), 'hand');
    s = play(s, u, 2);
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
    s = choose(s, [opts(s)[0]!]);
    expect(s.players[0].hand).toHaveLength(1);

    s = sc();
    const cx = put(s, 0, C('47'), 'hand');
    const back = put(s, 0, C('42'), 'waiting');
    const v = put(s, 0, C('08'), 'hand');
    s = play(s, v, 2);
    s = yes(s);
    expect(s.players[0].waiting).toContain(cx);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('09 所以，我要唱。 桃香：手牌 5 張以上 +2000；能量 4 張以下打倒對手，可以把它放到牌組下方', () => {
    let s = sc();
    const u = put(s, 0, C('09'), { slot: 1 });
    for (const n of ['01', '02', '03', '04']) put(s, 0, C(n), 'hand');
    expect(E.power(s, u)).toBe(1500);
    put(s, 0, C('05'), 'hand');
    expect(E.power(s, u)).toBe(3500);
    const def = put(s, 1, BTR('T15'), { slot: 1 });
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    s = yes(s);
    expect(s.players[1].deck.at(-1)).toBe(def);
  });

  it('10 奔跑在川崎 桃香：登場丟《音樂》角色，從牌組把「奔跑在川崎 仁菜」放上舞台 +1000；全是《音樂》時攻擊 +對手角色數×1000', () => {
    let s = sc();
    put(s, 0, C('03'), 'hand');
    const u = put(s, 0, C('10'), 'hand');
    s = play(s, u, 0);
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    s = choose(s, [opts(s)[0]!]);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 1 });
    const nina = s.players[0].stage[1]!.uid;
    expect(E.cardOf(s, nina).id).toBe(C('01'));
    expect(E.power(s, nina)).toBe(500 + 3000 + 1000);
    put(s, 1, BTR('T15'), { slot: 0 });
    put(s, 1, BTR('T15'), { slot: 1 });
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'direct');
    expect(E.power(s, u)).toBe(1500 + 2000);
  });

  it('11 騙子的真心話 昂：判定翻到木門名場面，付①丟同名卡，公開 2 張，1 張進能量、其餘加到手牌；集中撿回角色', () => {
    let s = sc();
    put(s, 0, C('11'), { slot: 3 });
    put(s, 0, C('03'), { slot: 1 });
    stock(s, 1);
    put(s, 0, C('11'), 'hand');
    const [, a, b] = top(s, 0, [C('47'), C('01'), C('02')]);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(prompt(s)).toContain('騙子的真心話');
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', options: [a, b] });
    s = choose(s, [a!]);
    expect(s.players[0].stock).toContain(a);
    expect(s.players[0].hand).toContain(b);

    s = sc();
    const v = put(s, 0, C('11'), { slot: 3 });
    stock(s, 1);
    const back = put(s, 0, C('42'), 'waiting');
    top(s, 0, [C('47'), C('48'), C('01'), C('02')]);
    s = ok(s, { type: 'activate', player: 0, uid: v, index: 1 });
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    s = choose(s, [back]);
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 }); // 第 2 張名場面
    s = choose(s, []);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('12 全部攤開 昂：登場付①丟 1 張從牌組找《音樂》角色；攻擊時《音樂》角色 +1500', () => {
    let s = sc();
    stock(s, 1);
    put(s, 0, C('47'), 'hand');
    const u = put(s, 0, C('12'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    expect(opts(s).every((o) => E.cardOf(s, o).traits.some((t) => t.ja === '音楽'))).toBe(true);
    s = choose(s, [opts(s)[0]!]);
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(1);
    plain(s, 0, 1);
    spare(s);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = choose(s, [u]);
    expect(E.power(s, u)).toBe(3000);
  });

  it('13 認真站上的舞台 智：登場 +1500；進休息室時公開 3 張，拿 1 張《音樂》角色再丟 1 張', () => {
    let s = sc();
    const u = put(s, 0, C('13'), 'hand');
    s = play(s, u, 1);
    expect(E.power(s, u)).toBe(3000);
    const v = put(s, 0, C('03'), 'hand');
    put(s, 0, C('T11'), 'hand');
    const shown = top(s, 0, [C('47'), C('01'), C('02')]);
    s = play(s, v, 1); // 把 13 擠到休息室
    expect(prompt(s)).toContain('認真站上的舞台');
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', shown, options: [shown[1], shown[2]] });
    s = choose(s, [shown[1]!]);
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
    s = choose(s, [shown[1]!]);
    expect(s.players[0].waiting).toEqual(expect.arrayContaining(shown));
  });

  it('14 beni-shouga RUPA：登場彈對手前列 Lv0；登場或進休息室時付①丟 1 張撿回角色', () => {
    let s = sc();
    const lv0 = put(s, 1, BTR('T15'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 });
    const u = put(s, 0, C('14'), 'hand');
    s = play(s, u, 1);
    s = order(s, undefined, '手札に戻してよい');
    expect(s.pending).toMatchObject({ kind: 'select', options: [lv0] });
    s = choose(s, [lv0]);
    expect(s.players[1].hand).toContain(lv0);
  });

  it('15 互相碰撞前進 RUPA：CX 連動「想賭上命運的理論」放置時收回手牌，給 1 張角色「攻擊時判定 2 次」', () => {
    let s = sc();
    levels(s, 1);
    const u = put(s, 0, C('15'), { slot: 3 });
    const att = put(s, 0, C('03'), { slot: 1 });
    const cx = put(s, 0, C('47'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    expect(prompt(s)).toContain('互相碰撞前進');
    s = yes(s);
    expect(s.players[0].hand).toContain(u);
    const [t1, t2] = plain(s, 0, 2);
    s = attack(s, 1, 'direct');
    expect(s.players[0].stock).toEqual(expect.arrayContaining([t1, t2]));
  });

  it('16 （樂團名未定） RUPA：其他《音樂》+500；放名場面時給 1 張角色「攻擊時看 2 張留 1 張」', () => {
    let s = sc();
    levels(s, 1);
    put(s, 0, C('16'), { slot: 3 });
    const att = put(s, 0, C('03'), { slot: 1 });
    expect(E.power(s, att)).toBe(1000 + 2500 + 500);
    const cx = put(s, 0, C('48'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = choose(s, [att]);
    const [a, b] = top(s, 0, [C('01'), C('02')]);
    s = attack(s, 1, 'direct');
    expect(s.pending).toMatchObject({ kind: 'select', shown: [a, b], min: 1, max: 1 });
    s = choose(s, [b!]);
    expect(s.players[0].waiting).toContain(a);
  });

  it('17 "拒絕上學" 仁菜：其他角色 1 張以下時等級 +1、攻擊力 +2500', () => {
    const s = sc();
    const u = put(s, 0, C('17'), { slot: 1 });
    put(s, 0, C('03'), { slot: 0 });
    expect([E.levelOf(s, u), E.power(s, u)]).toEqual([1, 4500]);
    put(s, 0, C('09'), { slot: 2 });
    expect([E.levelOf(s, u), E.power(s, u)]).toEqual([0, 2000]);
  });

  it('18 無刺的假日 RUPA：登場可以把牌組上方 3 張放到休息室；付①丟名場面換回名場面', () => {
    let s = sc();
    const u = put(s, 0, C('18'), 'hand');
    const milled = plain(s, 0, 3);
    s = play(s, u, 1);
    s = yes(s);
    expect(s.players[0].waiting).toEqual(milled);
  });

  it('19 所以，我要唱。 昂：其他《音樂》4 張以上時登場丟 1 張，移動對手的角色；被 Lv1 以下打倒時可以把對手倒置', () => {
    let s = sc();
    levels(s, 1);
    for (const [n, slot] of [['01', 0], ['02', 1], ['03', 3], ['09', 4]] as const) put(s, 0, C(n), { slot });
    const a = put(s, 1, BTR('T15'), { slot: 0, state: 'rest' });
    const b = put(s, 1, BTR('T16'), { slot: 3 });
    put(s, 0, C('47'), 'hand');
    const u = put(s, 0, C('19'), 'hand');
    s = play(s, u, 2);
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'chooseOption' });
    s = option(s, 1);
    expect(s.players[1].stage[0]).toEqual({ uid: b, state: 'stand' });
    expect(s.players[1].stage[3]).toEqual({ uid: a, state: 'stand' });
  });

  it('20 TOGENASHI TOGEARI RUPA：絆撿回智；共鳴：公開手牌的智，+3500 並判定 2 次，之後能量區上方 1 張放到休息室', () => {
    let s = sc();
    levels(s, 1);
    stock(s, 2);
    const tomo = put(s, 0, C('24'), 'waiting');
    const u = put(s, 0, C('20'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    expect(s.players[0].hand).toEqual([tomo]);
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('共鳴');
    s = yes(s);
    expect(s.players[0].hand).toEqual([tomo]); // 公開後留在手牌
    expect(E.power(s, u)).toBe(6000);
    const [t1, t2] = plain(s, 0, 2);
    s = passUntil(s, 'attackDeclare');
    const before = s.players[0].stock.length;
    s = attack(s, 1, 'direct');
    expect(s.players[0].stock).toContain(t1);
    expect(s.players[0].stock).not.toContain(t2); // 第 2 張判定進能量區後，能量區上方 1 張放到休息室
    expect(s.players[0].waiting).toContain(t2);
    expect(s.players[0].stock).toHaveLength(before + 1);
  });

  it('21 全部攤開 RUPA：助太刀 +《音樂》角色數×500', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 });
    const def = put(s, 0, C('09'), { slot: 2 });
    put(s, 0, C('03'), { slot: 3 });
    put(s, 0, C('01'), { slot: 4 });
    levels(s, 1);
    const bk = put(s, 0, C('21'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(1500 + 1500);
  });

  it('22 夢幻女孩？ 昂：自己回合其他《音樂》+1000；【起】上方 2 張進休息室，撿回等級合計以下的角色', () => {
    let s = sc();
    const u = put(s, 0, C('22'), { slot: 3 });
    const mate = put(s, 0, C('03'), { slot: 0 });
    expect(E.power(s, mate)).toBe(1000 + 2500 + 1000);
    stock(s, 1);
    top(s, 0, [C('40'), C('47')]); // 等級 3＋0
    const big = put(s, 0, C('42'), 'waiting');
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    expect(opts(s)).toContain(big);
    s = choose(s, [big]);
    expect(s.players[0].hand).toEqual([big]);
  });

  it('23 全部攤開 仁菜：攻擊時最多 2 張《音樂》角色 +1500', () => {
    let s = sc();
    levels(s, 1);
    const u = put(s, 0, C('23'), { slot: 1 });
    const mate = put(s, 0, C('03'), { slot: 0 });
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = choose(s, [u, mate]);
    expect([E.power(s, u), E.power(s, mate)]).toEqual([5000, 5000]);
  });

  it('24 TOGENASHI TOGEARI 智：共鳴：公開手牌的 RUPA，+3000 並得到「攻擊時看 2 張留 1 張」', () => {
    let s = sc();
    levels(s, 1);
    const u = put(s, 0, C('24'), { slot: 1 });
    put(s, 0, C('20'), 'hand');
    s = passUntil(s, 'confirm');
    s = yes(s);
    expect(E.power(s, u)).toBe(6500);
    const [a, b] = plain(s, 0, 2);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(s.pending).toMatchObject({ kind: 'select', shown: [a, b] });
  });

  it('25 用自由的方式 桃香：自己回合全是《音樂》+2000；CX 連動「空的箱子」攻擊時丟 1 張撿回 2 張《音樂》角色', () => {
    let s = sc();
    levels(s, 1);
    const u = put(s, 0, C('25'), { slot: 1 });
    put(s, 0, C('03'), { slot: 0 });
    expect(E.power(s, u)).toBe(6000);
    const cx = put(s, 0, C('48'), 'hand');
    put(s, 0, C('47'), 'hand');
    const back = [put(s, 0, C('42'), 'waiting'), put(s, 0, C('41'), 'waiting')];
    plain(s, 0, 1);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = attack(s, 1, 'direct');
    s = yes(s);
    s = choose(s, back);
    expect(s.players[0].hand.sort()).toEqual([...back].sort());
  });

  it('26 所以，我要唱。 智：進休息室時丟 1 張，看 4 張拿 1 張 Lv1 以上的卡', () => {
    let s = sc();
    put(s, 0, C('26'), { slot: 1 });
    put(s, 0, C('47'), 'hand');
    const v = put(s, 0, C('03'), 'hand');
    const looked = top(s, 0, [C('01'), C('22'), C('48'), C('40')]);
    s = play(s, v, 1);
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', options: [looked[1], looked[3]] });
    s = choose(s, [looked[3]!]);
    s = yes(s);
    expect(s.players[0].hand).toEqual([looked[3]]);
  });

  it('27 所以，我要唱。 RUPA：自己回合有其他《音樂》+1500；攻擊時正面是 Lv2 就 +6000', () => {
    let s = sc();
    levels(s, 1);
    const u = put(s, 0, C('27'), { slot: 1 });
    put(s, 0, C('03'), { slot: 0 });
    expect(E.power(s, u)).toBe(5500);
    put(s, 1, BTR('T18'), { slot: 1 }); // Lv2
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    expect(E.power(s, u)).toBe(11500);
  });

  it('28 "目標!!武道館!!" 智：應援 +等級×500；判定翻到木門時丟 1 張彈對手角色；【起】橫置 +2000', () => {
    let s = sc();
    const u = put(s, 0, C('28'), { slot: 3 });
    const lv1 = put(s, 0, C('22'), { slot: 1 });
    expect(E.power(s, lv1)).toBe(3000 + 500); // 22 自己的「其他《音樂》+1000」不含自己
    const oppChar = put(s, 1, BTR('T16'), { slot: 3 });
    put(s, 0, C('47'), 'hand');
    top(s, 0, [C('48')]);
    put(s, 0, C('03'), { slot: 0 });
    spare(s);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'direct');
    s = order(s, u);
    expect(prompt(s)).toContain('目標!!武道館!!');
    s = yes(s);
    expect(s.players[1].hand).toContain(oppChar);
  });

  it('29 beni-shouga 智：登場對手前列 -1000；被等級比對手高的角色打倒時可以把它放到牌組下方', () => {
    let s = sc();
    levels(s, 1);
    stock(s, 1);
    const target = put(s, 1, BTR('T16'), { slot: 1 });
    const u = put(s, 0, C('29'), 'hand');
    s = play(s, u, 1);
    expect(E.power(s, target)).toBe(4500);

    s = oppTurn(sc());
    put(s, 0, C('29'), { slot: 0 });
    const att = put(s, 1, BTR('T18'), { slot: 2 }); // Lv2，對手等級 0
    plain(s, 1, 1);
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 2, 'front', 1);
    s = skipCounter(s);
    s = yes(s);
    expect(s.players[1].deck.at(-1)).toBe(att);
  });

  it('30 新川崎（暫定） 仁菜：自己回合其他《音樂》2 張以上 +3500；正面費用 2 以上 +4000；打倒對手可以從休息室補能量', () => {
    let s = sc();
    levels(s, 1);
    const u = put(s, 0, C('30'), { slot: 1 });
    put(s, 0, C('03'), { slot: 0 });
    put(s, 0, C('09'), { slot: 2 });
    expect(E.power(s, u)).toBe(7500);
    put(s, 1, BTR('T19'), { slot: 1 }); // 費用 2
    const back = put(s, 0, C('42'), 'waiting');
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    expect(E.power(s, u)).toBe(11500);
    s = skipCounter(s);
    s = yes(s);
    expect(s.players[0].stock).toContain(back);
  });

  it('31 "退團" 桃香：全是《TOGENASHI TOGEARI》時自己回合 +3000 並得到安可；木門名場面放置時 +1000', () => {
    let s = sc();
    levels(s, 1);
    const u = put(s, 0, C('31'), { slot: 1 });
    expect(E.power(s, u)).toBe(8500);
    expect(E.abilitiesOf(s, u).some((a) => a.keyword?.id === 'encore' && a.text.ja.includes('手札のキャラ'))).toBe(true);
    const cx = put(s, 0, C('47'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    expect(E.power(s, u)).toBe(8500 + 1000 + 1000);
  });

  it('32 真心喜歡的事 昂：CX 連動「極私的極彩色解答」：傷害沒被取消時從牌組找卡並 +3000', () => {
    let s = sc();
    levels(s, 2);
    const u = put(s, 0, C('32'), { slot: 1 });
    const cx = put(s, 0, C('49'), 'hand');
    plain(s, 0, 1);
    plain(s, 1, 5);
    spare(s);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = attack(s, 1, 'direct');
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    s = choose(s, [opts(s)[0]!]);
    s = yes(s);
    expect(E.power(s, u)).toBe(7500 + 1000 + 3000);
  });

  it('33 全部攤開 桃香：助太刀 +3000；反過來打倒攻擊的角色時放到回憶區', () => {
    let s = oppTurn(sc());
    const att = put(s, 1, BTR('T16'), { slot: 0 }); // 5500
    put(s, 1, BTR('T16'), { slot: 1 });
    put(s, 0, C('25'), { slot: 2 }); // 4000
    levels(s, 2);
    stock(s, 1);
    const bk = put(s, 0, C('33'), 'hand');
    plain(s, 1, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    s = passUntil(s, 'attackDeclare');
    expect(s.players[1].memory).toContain(att);
  });

  it('34 新川崎（暫定） 昂：助太刀 +2500；付①丟 1 張，把等級比對手高的角色彈回手牌', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    const high = put(s, 1, BTR('T18'), { slot: 3 }); // Lv2
    const def = put(s, 0, C('25'), { slot: 2 });
    levels(s, 2);
    stock(s, 2);
    put(s, 0, C('47'), 'hand');
    const bk = put(s, 0, C('34'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(4000 + 2500);
    s = yes(s);
    s = choose(s, [high]); // 攻擊的 Lv1 角色也比對手的等級（0）高
    expect(s.players[1].hand).toContain(high);
  });

  it('35 無刺的假日 桃香：登場丟 1 張，對手的角色換成它休息室裡低 1 級的角色', () => {
    let s = sc();
    levels(s, 2);
    stock(s, 1);
    const target = put(s, 1, BTR('T18'), { slot: 1 }); // Lv2
    const low = put(s, 1, BTR('T16'), 'waiting'); // Lv1
    put(s, 1, BTR('T19'), 'waiting'); // Lv3：不能選
    put(s, 0, C('47'), 'hand');
    const u = put(s, 0, C('35'), 'hand');
    s = play(s, u, 1);
    s = yes(s); // 對手只有 1 張等級 1 以上的角色 → 自動選；休息室只有 1 張可換 → 自動
    expect(s.players[1].stage[1]).toEqual({ uid: low, state: 'stand' });
    expect(s.players[1].waiting).toContain(target);
  });

  it('36 所以，我要唱。 仁菜：登場給最多 2 張角色「被等級比對手高的角色打倒時可以把它倒置」', () => {
    let s = sc();
    levels(s, 2);
    stock(s, 1);
    const att = put(s, 0, C('03'), { slot: 1 });
    const def = put(s, 1, BTR('T19'), { slot: 1 }); // Lv3，對手等級 0
    const u = put(s, 0, C('36'), 'hand');
    s = play(s, u, 0);
    s = choose(s, [att]);
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    s = yes(s);
    expect(s.players[1].stage[1]?.uid === def ? s.players[1].stage[1].state : 'gone').not.toBe('stand');
  });

  it('37 無刺的假日 智：攻擊時其他《音樂》2 張以上 +6000；打倒對手後給《音樂》角色「被正打時可以回手牌」', () => {
    let s = sc();
    levels(s, 2);
    const u = put(s, 0, C('37'), { slot: 1 });
    const mate = put(s, 0, C('03'), { slot: 0 });
    put(s, 0, C('09'), { slot: 2 });
    put(s, 1, BTR('T16'), { slot: 1 });
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    expect(E.power(s, u)).toBe(13000);
    s = skipCounter(s);
    s = choose(s, [mate]);
    expect(s.grants.some((g) => g.uid === mate && g.until !== undefined)).toBe(true);
  });

  it('38 無刺的假日 仁菜：4 張《TOGENASHI TOGEARI》時手牌等級 -1；CX 連動：安可步驟撿回 3 張，1 張手牌其餘能量', () => {
    let s = sc();
    const u = put(s, 0, C('38'), 'hand');
    expect(E.levelOf(s, u)).toBe(2);
    for (const [n, slot] of [['01', 0], ['02', 1], ['03', 3], ['09', 4]] as const) put(s, 0, C(n), { slot });
    expect(E.levelOf(s, u)).toBe(1);

    s = sc();
    levels(s, 2);
    put(s, 0, C('38'), { slot: 1 });
    put(s, 0, C('50'), 'climax');
    const back = [put(s, 0, C('40'), 'waiting'), put(s, 0, C('41'), 'waiting'), put(s, 0, C('42'), 'waiting')];
    s = passUntil(s, 'attackDeclare');
    s = pass(s);
    expect(prompt(s)).toContain('無刺的假日 仁菜');
    s = yes(s);
    s = choose(s, back);
    s = choose(s, [back[0]!]);
    s = choose(s, [back[1]!, back[2]!]);
    expect(s.players[0].hand).toContain(back[0]);
    expect(s.players[0].stock.slice(-2)).toEqual([back[1], back[2]]);
  });

  it('39 "目標!!武道館!!" RUPA：其他《音樂》攻擊時 +X；打倒對手後付①讓對手角色下次不直立', () => {
    let s = sc();
    levels(s, 2);
    stock(s, 1);
    const u = put(s, 0, C('39'), { slot: 1 });
    put(s, 0, C('03'), { slot: 0 });
    plain(s, 0, 2);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'direct');
    expect(E.power(s, u)).toBe(8500 + 500);
    const target = put(s, 1, BTR('T15'), { slot: 1 });
    const other = put(s, 1, BTR('T16'), { slot: 3, state: 'rest' });
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    s = yes(s);
    s = choose(s, [other]);
    expect(s.skipStand).toEqual([{ uid: other, turn: s.turn + 1 }]);
    expect(target).toBeDefined();
  });

  it('40 不是一個人的舞台 RUPA：4 張《音樂》時手牌等級 -1；登場回 1 血 +3000；送 1 張《音樂》角色，翻牌撿回', () => {
    let s = sc();
    for (const [n, slot] of [['01', 0], ['02', 1], ['03', 3], ['09', 4]] as const) put(s, 0, C(n), { slot });
    const u = put(s, 0, C('40'), 'hand');
    expect(E.levelOf(s, u)).toBe(2);
    levels(s, 2);
    stock(s, 2);
    const hurt = put(s, 0, C('05'), 'clock');
    s = play(s, u, 2);
    s = order(s, undefined, 'クロック');
    s = choose(s, [hurt]);
    expect(E.power(s, u)).toBe(10500);
  });

  it('41 巧克力？ 仁菜：登場付①：這回合傷害沒被取消時，對手再把牌組上方 1 張放到傷害區', () => {
    let s = sc();
    levels(s, 3);
    stock(s, 3);
    const u = put(s, 0, C('41'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    plain(s, 0, 1);
    const dmg = plain(s, 1, 4);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(s.players[1].clock).toEqual(dmg.slice(0, 4));
  });

  it('42 沒有錯的證明 仁菜：登場抽 2 丟 1；CX 連動「空白與宣洩」放置時給 1 點傷害', () => {
    let s = sc();
    levels(s, 3);
    stock(s, 2);
    const u = put(s, 0, C('42'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
    s = choose(s, [opts(s)[0]!]);
    expect(s.players[0].hand).toHaveLength(1);
    put(s, 0, C('03'), { slot: 0 });
    const cx = put(s, 0, C('51'), 'hand');
    const [dmg] = plain(s, 1, 1);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    expect(s.players[1].clock).toEqual([dmg]);
  });

  it('43 TOGENASHI TOGEARI 桃香：登場 +4500 到對手回合結束，戰鬥中不能用助太刀；攻擊時丟 2 張把「空白與宣洩」放到名場面區', () => {
    let s = sc();
    levels(s, 3);
    stock(s, 2);
    const u = put(s, 0, C('43'), 'hand');
    s = play(s, u, 1);
    expect(E.power(s, u)).toBe(14500);
    const cx = put(s, 0, C('51'), 'waiting');
    put(s, 0, C('01'), 'hand');
    put(s, 0, C('02'), 'hand');
    plain(s, 0, 1);
    spare(s);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(s.players[0].climax).toEqual([cx]);

    // 這張卡的戰鬥中，對手不能用助太刀（對照：換成 42 就可以用）
    for (const [n, counter] of [['43', false], ['42', true]] as const) {
      s = sc();
      levels(s, 3);
      stock(s, 2);
      const v = put(s, 0, C(n), 'hand');
      s = play(s, v, 1);
      if (n === '42') s = no(s); // 不抽牌
      put(s, 1, BTR('T16'), { slot: 1 });
      for (let i = 0; i < 2; i++) put(s, 1, BTR('T13'), 'level');
      put(s, 1, BTR('T20'), 'stock');
      put(s, 1, BTR('T06'), 'hand'); // 對手的助太刀
      plain(s, 0, 1);
      s = passUntil(s, 'attackDeclare');
      s = attack(s, 1, 'front');
      expect(s.pending?.kind === 'counter', n).toBe(counter);
    }
  });

  it('44 互相碰撞前進 智：登場抽 1 +2000；CX 連動：攻擊結束時換成手牌的「不是一個人的舞台 RUPA」+4000', () => {
    let s = sc();
    levels(s, 3);
    stock(s, 2);
    const u = put(s, 0, C('44'), { slot: 1 });
    put(s, 0, C('03'), { slot: 0 });
    put(s, 0, C('09'), { slot: 2 });
    put(s, 0, C('47'), 'climax');
    put(s, 0, C('01'), 'hand');
    put(s, 0, C('02'), 'hand');
    put(s, 0, C('15'), 'hand');
    const rupa = put(s, 0, C('40'), 'hand');
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(prompt(s)).toContain('互相碰撞前進');
    s = yes(s);
    s = choose(s, [s.players[0].hand.find((x) => E.cardOf(s, x).id === C('01'))!, s.players[0].hand.find((x) => E.cardOf(s, x).id === C('02'))!]);
    s = choose(s, [rupa]);
    expect(s.players[0].hand).toContain(u);
    expect(s.players[0].stage[1]?.uid).toBe(rupa);
    s = order(s, rupa, 'クロック');
    expect(E.power(s, rupa)).toBeGreaterThanOrEqual(7500 + 1000 + 4000);
  });

  it('45 TOGENASHI TOGEARI 昂：自己回合 +2000；登場付①讓對手的能量全部換掉', () => {
    let s = sc();
    levels(s, 3);
    stock(s, 3);
    const oppStock = [put(s, 1, BTR('T01'), 'stock'), put(s, 1, BTR('T02'), 'stock')];
    const u = put(s, 0, C('45'), 'hand');
    s = play(s, u, 1);
    expect(E.power(s, u)).toBe(12500);
    s = yes(s);
    expect(s.players[1].waiting).toEqual(expect.arrayContaining(oppStock));
    expect(s.players[1].stock).toHaveLength(2);
  });

  it('46 把憤怒、喜悅、悲傷全部灌進去。：看 3 張拿 1 張，用完放到回憶區；記憶：名場面階段把手牌的木門名場面換成休息室的', () => {
    let s = sc();
    levels(s, 1);
    stock(s, 1);
    const ev = put(s, 0, C('46'), 'hand');
    const looked = top(s, 0, [C('47'), C('03'), C('46')]);
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    expect(s.pending).toMatchObject({ kind: 'select', options: [looked[1], looked[2]] });
    s = choose(s, [looked[1]!]);
    s = yes(s);
    expect(s.players[0].memory).toEqual([ev]);
    stock(s, 1);
    put(s, 0, C('03'), 'hand');
    const mine = put(s, 0, C('48'), 'hand');
    const want = put(s, 0, C('51'), 'waiting');
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('把憤怒');
    s = yes(s);
    s = choose(s, [s.players[0].hand.find((x) => E.cardOf(s, x).id === C('03'))!]);
    s = choose(s, [mine]);
    s = choose(s, [want]);
    expect(s.players[0].hand).toContain(want);
    expect(s.players[0].waiting).toContain(mine);
  });

  it('名場面 47～51、68、69：攻擊力 +1000、魂傷 +1，判定圖示正確', () => {
    const s = sc();
    const u = put(s, 0, C('03'), { slot: 0 });
    for (const n of CX) {
      const c = put(s, 0, C(n), 'climax');
      expect([E.power(s, u), E.soul(s, u)]).toEqual([1000 + 2500 + 1000, 2]);
      expect(E.cardOf(s, c).triggers).toEqual(['47', '48', '49', '50', '51'].includes(n) ? ['comeback'] : ['soul', 'gate']);
      s.players[0].climax = [];
    }
  });

  it('52 二月的細冰 琳：攻擊時其他《音樂》+2000；【起】撿回指定的卡', () => {
    let s = sc();
    const u = put(s, 0, C('52'), { slot: 1 });
    const mate = put(s, 0, C('58'), { slot: 0 });
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(E.power(s, mate)).toBe(6000);
    s = sc();
    const v = put(s, 0, C('52'), { slot: 3 });
    stock(s, 1);
    const want = put(s, 0, C('64'), 'waiting');
    s = ok(s, { type: 'activate', player: 0, uid: v, index: 1 });
    expect(s.players[0].hand).toEqual([want]);
  });

  it('53 二月的細冰 愛：其他《音樂》+500；【起】等級區和休息室交換；經驗：換成「用閃耀的方式 愛」', () => {
    let s = sc();
    const u = put(s, 0, C('53'), { slot: 3 });
    const lvCard = put(s, 0, C('47'), 'level');
    const big = put(s, 0, C('65'), 'waiting');
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    expect(s.players[0].level).toEqual([big]);
    expect(s.players[0].waiting).toContain(lvCard);

    s = sc();
    const v = put(s, 0, C('53'), { slot: 3 });
    put(s, 0, C('63'), 'level');
    put(s, 0, C('58'), 'level'); // 等級 2、合計 3
    stock(s, 1);
    const ai = put(s, 0, C('62'), 'waiting');
    put(s, 0, C('68'), 'hand');
    s = ok(s, { type: 'activate', player: 0, uid: v, index: 2 });
    expect(s.players[0].stage[3]?.uid).toBe(ai);
    expect(prompt(s)).toContain('用閃耀的方式 愛'); // 「因『二月的細冰 愛』的效果被放置」
  });

  it('54 用閃耀的方式 琳：名場面階段開始時 +500；集中：每張名場面從牌組找《音樂》角色', () => {
    let s = sc();
    const u = put(s, 0, C('54'), { slot: 1 });
    s = passUntil(s, 'attackDeclare');
    expect(E.power(s, u)).toBe(1500);
    s = sc();
    const v = put(s, 0, C('54'), { slot: 3 });
    stock(s, 1);
    top(s, 0, [C('68'), C('01'), C('02'), C('03')]);
    s = ok(s, { type: 'activate', player: 0, uid: v, index: 1 });
    s = yes(s);
    s = choose(s, [opts(s)[0]!]);
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('55 二月的細冰 奈奈：登場讓對手角色不能移動；可以讓對手角色進回憶區再放回舞台', () => {
    let s = sc();
    const target = put(s, 1, BTR('T16'), { slot: 1 });
    s.mods.push({ uid: target, power: 3000, soul: 0 });
    const u = put(s, 0, C('55'), 'hand');
    s = play(s, u, 1);
    s = order(s, undefined, '動かせない');
    s = order(s, undefined, '思い出');
    s = choose(s, [target]);
    expect(s.pending).toMatchObject({ kind: 'chooseSlot', player: 1 });
    s = ok(s, { type: 'chooseSlot', player: 1, slot: 0 });
    expect(s.players[1].stage[0]?.uid).toBe(target);
    expect(E.power(s, target)).toBe(5500); // 加成消失
  });

  it('56 偶像樂團的假日 愛：登場可以交換等級區和休息室的卡；【起】丟 1 張撿回《音樂》角色', () => {
    let s = sc();
    const lvCard = put(s, 0, C('47'), 'level');
    const w = put(s, 0, C('68'), 'waiting');
    const u = put(s, 0, C('56'), 'hand');
    s = play(s, u, 3);
    s = yes(s);
    expect(s.players[0].level).toEqual([w]);
    expect(s.players[0].waiting).toContain(lvCard);
    put(s, 0, C('01'), 'hand');
    const back = put(s, 0, C('58'), 'waiting');
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    s = choose(s, [back]); // 丟掉的 01 也是《音樂》角色
    expect(s.players[0].hand).toEqual([back]);
  });

  it('57 偶像樂團的假日 雛：攻擊時付①並把牌組上方 1 張放到傷害區，從牌組找 Lv1 以下的角色', () => {
    let s = sc();
    stock(s, 1);
    put(s, 0, C('57'), { slot: 1 });
    plain(s, 0, 2);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(opts(s).every((o) => E.cardOf(s, o).type === 'character' && (E.cardOf(s, o).level ?? 0) <= 1)).toBe(true);
    s = choose(s, [opts(s)[0]!]);
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.players[0].clock).toHaveLength(1);
  });

  it('58 二月的細冰 雛：經驗（合計 2 以上）自己回合 +2000；攻擊結束時付①丟 1 張找《音樂》角色', () => {
    let s = sc();
    const u = put(s, 0, C('58'), { slot: 1 });
    expect(E.power(s, u)).toBe(4000);
    put(s, 0, C('63'), 'level');
    expect(E.power(s, u)).toBe(6000);
    stock(s, 1);
    put(s, 0, C('68'), 'hand');
    plain(s, 0, 3);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = choose(s, [s.pending?.kind === 'select' ? s.pending.options[0]! : '']); // 看 2 張留 1 張
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select' });
  });

  it('59 用閃耀的方式 奈奈：經驗 +2000；CX 連動「Cycle Of Sorrow」攻擊結束時看 4 張，1 張手牌 1 張能量', () => {
    let s = sc();
    put(s, 0, C('63'), 'level');
    const u = put(s, 0, C('59'), { slot: 1 });
    expect(E.power(s, u)).toBe(6000);
    stock(s, 1);
    const cx = put(s, 0, C('68'), 'hand');
    plain(s, 0, 1);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    const looked = top(s, 0, [C('01'), C('02'), C('47'), C('03')]);
    top(s, 0, [C('04')]); // 判定
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', max: 2 });
    s = choose(s, [looked[0]!, looked[1]!]);
    s = yes(s);
    s = choose(s, [looked[0]!]);
    expect(s.players[0].hand).toContain(looked[0]);
    expect(s.players[0].stock).toContain(looked[1]);
  });

  it('60 偶像樂團的假日 琳：經驗 +3500 並得到安可；其他《音樂》4 張以上時登場，休息室《音樂》角色放到能量區', () => {
    let s = sc();
    const u = put(s, 0, C('60'), { slot: 1 });
    put(s, 0, C('63'), 'level');
    expect(E.power(s, u)).toBe(7000);
    expect(E.abilitiesOf(s, u).some((a) => a.keyword?.id === 'encore' && a.text.ja.includes('手札のキャラ'))).toBe(true);
  });

  it('61 偶像樂團的假日 奈奈：助太刀 +2500；付②把休息室全部洗回牌組', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    const def = put(s, 0, C('58'), { slot: 2 });
    levels(s, 2, '68');
    stock(s, 3);
    const w = put(s, 0, C('01'), 'waiting');
    const bk = put(s, 0, C('61'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(6500);
    s = yes(s);
    expect(s.players[0].deck).toContain(w);
    expect(s.players[0].waiting).toEqual([]);
  });

  it('62 用閃耀的方式 愛：其他《音樂》+1000；登場丟 1 張撿回《音樂》角色', () => {
    let s = sc();
    levels(s, 2, '68');
    stock(s, 1);
    const mate = put(s, 0, C('58'), { slot: 0 });
    put(s, 0, C('47'), 'hand');
    const back = put(s, 0, C('65'), 'waiting');
    const u = put(s, 0, C('62'), 'hand');
    s = play(s, u, 1);
    expect(E.power(s, mate)).toBe(5000);
    s = yes(s);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('63 Diamond Dust 雛：經驗（合計 4）自己回合 +5000；判定翻到門名場面時付①，上方 1 張進能量並抽 1 丟 1', () => {
    let s = sc();
    const u = put(s, 0, C('63'), { slot: 1 });
    put(s, 0, C('65'), 'level');
    put(s, 0, C('58'), 'level');
    expect(E.power(s, u)).toBe(11500);
    stock(s, 1);
    put(s, 0, C('T11'), 'hand');
    top(s, 0, [C('69'), C('01'), C('02')]);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = order(s, u);
    expect(prompt(s)).toContain('Diamond Dust 雛');
    s = yes(s);
    s = yes(s); // 抽 1 張
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
  });

  it('64 Diamond Dust 愛：休息室名場面 2 張以下時手牌等級 -1；經驗 +500 並得到安可；登場丟 1 張，傷害區上方 1 張進能量', () => {
    let s = sc();
    const u = put(s, 0, C('64'), 'hand');
    expect(E.levelOf(s, u)).toBe(2);
    for (const n of ['47', '48', '49']) put(s, 0, C(n), 'waiting');
    expect(E.levelOf(s, u)).toBe(3);
    s = sc();
    levels(s, 2, '68');
    stock(s, 2);
    const hurt = put(s, 0, C('01'), 'clock');
    put(s, 0, C('02'), 'hand');
    const v = put(s, 0, C('64'), 'hand');
    s = play(s, v, 1);
    s = yes(s);
    expect(s.players[0].stock).toContain(hurt);
  });

  it('65 Diamond Dust 琳：經驗（合計 6）打倒對手後丟 1 張，正面的角色魂傷 -2', () => {
    let s = sc();
    for (const n of ['65', '63', '58']) put(s, 0, C(n), 'level'); // 3+2+1
    const u = put(s, 0, C('65'), { slot: 1 });
    put(s, 0, C('47'), 'hand');
    put(s, 1, BTR('T16'), { slot: 1 });
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    s = yes(s);
    const next = put(s, 1, BTR('T18'), { slot: 1 }); // 魂傷 2
    expect(E.soul(s, next)).toBe(0);
    expect(u).toBeDefined();
  });

  it('66 正確的證明 雛：登場送 1 張《音樂》角色，看 3 張 1 張手牌 1 張能量；CX 連動經驗 6：給 2 點傷害 +2000', () => {
    let s = sc();
    for (const n of ['65', '63', '58']) put(s, 0, C(n), 'level');
    stock(s, 3);
    put(s, 0, C('01'), { slot: 0 });
    const u = put(s, 0, C('66'), 'hand');
    const looked = top(s, 0, [C('02'), C('03'), C('04')]);
    s = play(s, u, 1);
    s = yes(s);
    s = choose(s, [looked[0]!, looked[1]!]);
    s = choose(s, [looked[0]!]);
    expect(s.players[0].hand).toContain(looked[0]);
    expect(s.players[0].stock).toContain(looked[1]);
    const cx = put(s, 0, C('69'), 'hand');
    const junk = put(s, 0, C('47'), 'hand');
    plain(s, 0, 1);
    const dmg = plain(s, 1, 6);
    spare(s);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = attack(s, 1, 'direct');
    s = yes(s);
    s = choose(s, [junk]);
    expect(s.players[1].clock.slice(0, 2)).toEqual(dmg.slice(0, 2));
    expect(E.power(s, u)).toBe(10500 + 1000 + 2000);
  });

  it('67 Diamond Dust 奈奈：登場從手牌放 1 張角色上場，自己 +2000；經驗 4：打倒對手後把它放到傷害區', () => {
    let s = sc();
    for (const n of ['65', '58']) put(s, 0, C(n), 'level');
    put(s, 0, C('68'), 'level');
    stock(s, 3);
    const extra = put(s, 0, C('58'), 'hand');
    const u = put(s, 0, C('67'), 'hand');
    s = play(s, u, 1);
    s = choose(s, [extra]);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 0 });
    expect(s.players[0].stage[0]?.uid).toBe(extra);
    expect(E.power(s, u)).toBe(12500);
    const def = put(s, 1, BTR('T16'), { slot: 1 });
    put(s, 0, C('47'), 'hand');
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    s = yes(s);
    expect(s.players[1].clock).toContain(def);
  });

  it('P01 就這樣不正確下去：登場可以手牌 1 張放到能量區；【起】看 4 張拿《音樂》角色', () => {
    let s = sc();
    const card = put(s, 0, C('01'), 'hand');
    const u = put(s, 0, C('P01'), 'hand');
    s = play(s, u, 3);
    s = yes(s);
    expect(s.players[0].stock).toEqual([card]);
    const looked = top(s, 0, [C('47'), C('03'), C('48'), C('49')]);
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    s = choose(s, [looked[1]!]);
    s = yes(s);
    expect(s.players[0].hand).toEqual([looked[1]]);
  });

  it('P03 "Avoid Note" 仁菜：攻擊時付①判定 2 次；進休息室時手牌 1 張放到能量區', () => {
    let s = sc();
    levels(s, 1);
    stock(s, 1);
    put(s, 0, C('P03'), { slot: 1 });
    const [t1, t2] = plain(s, 0, 2);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(s.players[0].stock).toEqual(expect.arrayContaining([t1, t2]));
  });

  it('P04 "Avoid Note" 桃香：登場付①丟 1 張看 3 張任選 1 張', () => {
    let s = sc();
    stock(s, 1);
    put(s, 0, C('47'), 'hand');
    const u = put(s, 0, C('P04'), 'hand');
    const looked = top(s, 0, [C('48'), C('01'), C('02')]);
    s = play(s, u, 1);
    s = yes(s);
    s = choose(s, [looked[0]!]);
    expect(s.players[0].hand).toEqual([looked[0]]);
  });

  it('P05 "Avoid Note" 昂：其他《音樂》登場時 +1000（每回合 2 次）；其他《音樂》被正打時付①讓它回手牌', () => {
    let s = sc();
    const u = put(s, 0, C('P05'), { slot: 3 });
    for (const n of ['01', '09', '17']) {
      const x = put(s, 0, C(n), 'hand');
      s = play(s, x, ['01', '09', '17'].indexOf(n));
    }
    expect(E.power(s, u)).toBe(4000);

    s = oppTurn(sc());
    put(s, 0, C('P05'), { slot: 3 });
    const def = put(s, 0, C('09'), { slot: 2 });
    stock(s, 1);
    put(s, 1, BTR('T16'), { slot: 0 });
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = yes(s);
    expect(s.players[0].hand).toContain(def);
  });

  it('P06 "Avoid Note" 智：登場彈 1 張，再丟 1 張可以再彈 1 張；警報：在傷害區最上面時名場面階段換掉對手角色', () => {
    let s = sc();
    levels(s, 3);
    stock(s, 2);
    const a = put(s, 1, BTR('T16'), { slot: 0 });
    const b = put(s, 1, BTR('T18'), { slot: 1 });
    put(s, 0, C('01'), 'hand');
    const u = put(s, 0, C('P06'), 'hand');
    s = play(s, u, 1);
    s = choose(s, [a]);
    s = yes(s);
    expect(s.players[1].hand).toEqual(expect.arrayContaining([a, b]));

    s = sc();
    put(s, 0, C('P06'), 'clock');
    put(s, 0, C('01'), 'hand');
    const t = put(s, 1, BTR('T18'), { slot: 1 });
    const low = put(s, 1, BTR('T16'), 'waiting');
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('Avoid Note');
    s = yes(s);
    expect(s.players[1].stage[1]?.uid).toBe(low);
    expect(t).toBeDefined();
  });

  it('P07 "Avoid Note" RUPA：登場讓對手後列等級比對手高的角色下次不直立', () => {
    let s = sc();
    const t = put(s, 1, BTR('T18'), { slot: 3 });
    const u = put(s, 0, C('P07'), 'hand');
    s = play(s, u, 1);
    expect(s.skipStand).toEqual([{ uid: t, turn: s.turn + 1 }]);
  });

  it('P08～P12 一輩子的樂團：登場選 1 張角色魂傷 +1；【起】把自己放到休息室，彈對手 1 張角色', () => {
    for (const n of ['P08', 'P09', 'P10', 'P11', 'P12']) {
      let s = sc();
      levels(s, 2);
      stock(s, 1);
      const target = put(s, 1, BTR('T16'), { slot: 1 });
      const u = put(s, 0, C(n), 'hand');
      s = play(s, u, 3);
      expect(E.soul(s, u)).toBe(2);
      s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
      expect(s.players[1].hand).toContain(target);
    }
  });

  it('P13 我們的歌 桃香：登場公開上方，是《TOGENASHI TOGEARI》角色就選 1 張角色 +2000；【起】撿回角色', () => {
    let s = sc();
    const u = put(s, 0, C('P13'), 'hand');
    const [r] = top(s, 0, [C('03')]);
    s = play(s, u, 1);
    s = yes(s);
    expect(E.power(s, u)).toBe(3500);
    expect(s.players[0].deck[0]).toBe(r);
    put(s, 0, C('01'), 'hand');
    const back = put(s, 0, C('09'), 'waiting');
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    s = choose(s, [back]);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('官方卡號 P02 是 36 的另一個卡號，不另外收錄', () => {
    expect(bp.duplicates['GCR/SE48-P02']).toBe('GCR/SE48-36');
    expect(bp.cards.some((c) => c.id === 'GCR/SE48-P02')).toBe(false);
    expect(no).toBeDefined();
  });
});

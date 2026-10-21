// 碧藍幻想 補充包（GBF/S134-001～116、P01～P03）每張卡的情境測試。牌組在玩家 0；對手（玩家 1）用孤獨搖滾預組。
import { describe, expect, it } from 'vitest';
import { cardDb } from '../cards/index.ts';
import * as bp from '../cards/gbf-s134-bp.ts';
import * as gbf from '../cards/gbf-s134.ts';
import { addProblem } from '../deck-rules.ts';
import type { GameState, PlayerId } from './types.ts';
import { DECKS, E, choose, no, ok, oppTurn, order, pass, passUntil, put, scene, top, yes } from './test-utils.ts';

const C = (n: string) => `GBF/S134-${n}`;
const BTR = (n: string) => `BTR/W107-${n}`;
const ids = [...bp.cards, ...gbf.cards].map((c) => c.id);
const DECK = [...ids, ...ids, ...ids, ...ids, ...ids];
const sc = () => scene(11, [DECK, DECKS[0]]);
// 能量：名場面（付掉後不會變成撿回的候選）；等級區：各色的名場面（和能量用的不重複）
const STOCK = ['022', '023', '024', '052', '053', '054', '085', '086', '114', '116'];
const LEVEL = { yellow: '021', green: '051', red: '084', blue: '113' } as const;
const stock = (s: GameState, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C(STOCK[i % STOCK.length]!), 'stock'); };
const levels = (s: GameState, n: number, color: keyof typeof LEVEL) => { for (let i = 0; i < n; i++) put(s, 0, C(LEVEL[color]), 'level'); };
const skipCounter = (s: GameState) => (s.pending?.kind === 'counter' ? pass(s) : s);
const prompt = (s: GameState) => (s.pending && 'prompt' in s.pending ? s.pending.prompt : '');
const opts = (s: GameState) => (s.pending?.kind === 'select' ? s.pending.options : []);
const option = (s: GameState, i: number) => ok(s, { type: 'choose', player: s.pending!.player, uids: [String(i)] });
const play = (s: GameState, uid: string, slot: number) => ok(s, { type: 'playCharacter', player: 0, uid, slot: slot as 0 });
const attack = (s: GameState, slot: number, mode: 'front' | 'side' | 'direct', player: PlayerId = 0) => ok(s, { type: 'attack', player, slot: slot as 0, mode });
const activate = (s: GameState, uid: string, index: number) => ok(s, { type: 'activate', player: 0, uid, index });
// 沒有判定圖示、不是名場面的卡（判定、傷害都不會被取消）
const plain = (s: GameState, p: PlayerId, n: number) => top(s, p, Array.from({ length: n }, (_, i) => (p === 0 ? C(['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08'][i]!) : BTR(['T14', 'T16', 'T03', 'T13', 'T14', 'T16', 'T03', 'T13'][i]!))));
// 前列多放 1 張直立的角色：攻擊後回合不會馬上結束
const spare = (s: GameState) => { const slot = ([0, 1, 2] as const).find((i) => !s.players[0].stage[i])!; return put(s, 0, C('T08'), { slot }); };
const gbOthers = (s: GameState, n: number, from = 3) => { for (let i = 0; i < n; i++) put(s, 0, C('T08'), { slot: (from + i) as 0 }); };
// 進到下一次「自己的主要階段開始時」：把主要階段放回待執行的步驟，再略過時計
const toMainStart = (s: GameState) => {
  s.queue.push({ k: 'mainPhase' });
  s.pending = { kind: 'clock', player: 0 };
  return ok(s, { type: 'clock', player: 0, uid: null });
};

describe('碧藍幻想 補充包 GBF/S134', () => {
  it('001 六龍之『金』 加雷翁：不會被對手選；集中撿回角色；等級 2 以上集中翻到名場面時把自己放到牌組下方給 1 點傷害', () => {
    let s = sc();
    levels(s, 2, 'yellow');
    stock(s, 2);
    const u = put(s, 0, C('001'), { slot: 3 });
    const back = put(s, 0, C('T08'), 'waiting');
    top(s, 0, [C('022'), C('T01'), C('T02'), C('T03')]);
    const [dmg] = plain(s, 1, 1);
    s = activate(s, u, 2);
    s = yes(s);
    s = choose(s, [back]);
    expect(s.players[0].hand).toEqual([back]);
    expect(prompt(s)).toContain('加雷翁');
    s = yes(s);
    expect(s.players[0].deck.at(-1)).toBe(u);
    expect(s.players[1].clock).toEqual([dmg]);

    // 對手的效果選不到她
    s = oppTurn(sc());
    const g = put(s, 0, C('001'), { slot: 0 });
    put(s, 0, C('T08'), { slot: 1 });
    expect(E.abilitiesOf(s, g).some((a) => a.rules?.includes('untargetable'))).toBe(true);
  });

  it('002 莊重的十二枚羽 聖德芬：登場回 1 血 +3000；CX 連動「三零」：攻擊結束時把對手休息室 X 張放到上方再給 4 點傷害', () => {
    let s = sc();
    levels(s, 3, 'yellow');
    stock(s, 3);
    const hurt = put(s, 0, C('T01'), 'clock');
    const u = put(s, 0, C('002'), 'hand');
    s = play(s, u, 1);
    s = choose(s, [hurt]);
    expect(E.power(s, u)).toBe(11500);
    // 下面放 2 張不同名的標記
    s.markers[u] = [{ uid: put(s, 0, C('004'), 'memory'), faceUp: true }, { uid: put(s, 0, C('016'), 'memory'), faceUp: true }];
    s.players[0].memory = [];
    gbOthers(s, 2);
    put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('023'), 'climax');
    put(s, 0, C('T01'), 'hand');
    const w = [put(s, 1, BTR('T14'), 'waiting'), put(s, 1, BTR('T16'), 'waiting'), put(s, 1, BTR('T03'), 'waiting')];
    plain(s, 0, 1);
    top(s, 1, ['T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T17', 'T18'].map(BTR)); // 沒有名場面：攻擊的傷害、效果的傷害都不會被取消
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(prompt(s)).toContain('莊重的十二枚羽');
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', max: 2, ordered: true }); // X＝2 種不同卡名的標記
    s = choose(s, [w[0]!, w[1]!]);
    expect(s.players[1].clock).toEqual(expect.arrayContaining([w[0], w[1]])); // 放到上方後被 4 點傷害翻進傷害區
  });

  it('003 六龍之『白』 路·歐：登場付①丟 1 張從牌組找《碧藍幻想》角色', () => {
    let s = sc();
    stock(s, 1);
    put(s, 0, C('T01'), 'hand');
    const u = put(s, 0, C('003'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    s = choose(s, [opts(s)[0]!]);
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('004 進化的天司 路西菲爾：自己回合其他 2 張 +4000；記憶：聖德芬攻擊時放到下面當標記', () => {
    let s = sc();
    const u = put(s, 0, C('004'), { slot: 0 });
    gbOthers(s, 2);
    expect(E.power(s, u)).toBe(6500);

    s = sc();
    levels(s, 3, 'yellow');
    const mem = put(s, 0, C('004'), 'memory');
    const sand = put(s, 0, C('002'), { slot: 1 });
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(prompt(s)).toContain('記憶');
    s = yes(s);
    expect(s.markers[sand]).toEqual([{ uid: mem, faceUp: true }]);
    expect(s.players[0].memory).toEqual([]);
  });

  it('005 曉之裁定者 盧西歐：4 張《碧藍幻想》時手牌等級 -1；其他 2 張 +2000 並在進休息室時可以放到回憶區', () => {
    let s = sc();
    const u = put(s, 0, C('005'), 'hand');
    expect(E.levelOf(s, u)).toBe(3);
    gbOthers(s, 2);
    put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('T08'), { slot: 1 });
    expect(E.levelOf(s, u)).toBe(2);
    const v = put(s, 0, C('005'), { slot: 2 });
    expect(E.power(s, v)).toBe(10000);
    const w = put(s, 0, C('T01'), 'hand');
    s = play(s, w, 2); // 把盧西歐擠掉
    s = order(s, v);
    s = yes(s);
    expect(s.players[0].memory).toContain(v);
  });

  it('006 神秘的天司 拉吉爾：丟選擇名場面換回另一張', () => {
    let s = sc();
    const junk = put(s, 0, C('021'), 'hand');
    const want = put(s, 0, C('023'), 'waiting');
    const u = put(s, 0, C('006'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    s = choose(s, [want]);
    expect(s.players[0].hand).toEqual([want]);
    expect(s.players[0].waiting).toContain(junk);
  });

  it('007 十天眾 索恩：對手後列等級比對手高的角色下次不直立；對手 1 張角色不能移動', () => {
    let s = sc();
    const back = put(s, 1, BTR('T16'), { slot: 3 }); // Lv1 > 0
    const front = put(s, 1, BTR('T14'), { slot: 1 });
    const u = put(s, 0, C('007'), 'hand');
    s = play(s, u, 1);
    s = order(s, undefined, 'スタンド');
    expect(s.skipStand).toEqual([{ uid: back, turn: s.turn + 1 }]);
    s = choose(s, [front]);
    expect(E.abilitiesOf(s, front).some((a) => a.rules?.includes('cannotMove'))).toBe(true);
  });

  it('008 十天眾 奧克托：被 Lv0 打倒時把它放到對手能量區，對手能量最下面 1 張進休息室', () => {
    let s = oppTurn(sc());
    put(s, 0, C('008'), { slot: 0 });
    const att = put(s, 1, BTR('T14'), { slot: 2 });
    put(s, 1, BTR('T16'), { slot: 1 });
    const bottom = put(s, 1, BTR('T01'), 'stock');
    put(s, 1, BTR('T02'), 'stock');
    plain(s, 1, 1);
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 2, 'front', 1);
    s = skipCounter(s);
    s = yes(s);
    expect(s.players[1].stock).toContain(att);
    expect(s.players[1].waiting).toContain(bottom);
  });

  it('009 怒濤的戰車 蓋森博加：不能側打；在休息室時名場面階段丟 1 張回到前列，自己回合 +4000', () => {
    let s = sc();
    const u = put(s, 0, C('009'), 'waiting');
    put(s, 0, C('T08'), { slot: 3 });
    put(s, 0, C('T01'), 'hand');
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('蓋森博加');
    s = yes(s);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 1 });
    expect(s.players[0].stage[1]?.uid).toBe(u);
    expect(E.power(s, u)).toBe(5500);
  });

  it('010 十天眾 馮芙：自己回合其他 +1000；【起】付②橫置回 1 血', () => {
    let s = sc();
    const u = put(s, 0, C('010'), { slot: 3 });
    const mate = put(s, 0, C('T08'), { slot: 0 });
    expect(E.power(s, mate)).toBe(6500);
    stock(s, 2);
    const hurt = put(s, 0, C('T01'), 'clock');
    s = activate(s, u, 1);
    expect(s.players[0].waiting).toContain(hurt);
  });

  it('011 忘卻的愚者 凱姆：全是《碧藍幻想》時自己回合 +5000；在休息室時名場面階段付①丟 1 張回到前列', () => {
    let s = sc();
    const u = put(s, 0, C('011'), { slot: 1 });
    expect(E.power(s, u)).toBe(8500);
    s = sc();
    levels(s, 1, 'yellow');
    stock(s, 1);
    const v = put(s, 0, C('011'), 'waiting');
    put(s, 0, C('T01'), 'hand');
    s = passUntil(s, 'confirm');
    s = yes(s);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 0 });
    expect(s.players[0].stage[0]?.uid).toBe(v);
  });

  it('012 禍殃的魔術師 洛貝莉亞：在休息室時主要階段丟 1 張回到舞台；【起】換掉對手角色', () => {
    let s = sc();
    levels(s, 2, 'yellow');
    const u = put(s, 0, C('012'), 'waiting');
    put(s, 0, C('T01'), 'hand');
    s = toMainStart(s);
    s = yes(s);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 3 });
    expect(s.players[0].stage[3]?.uid).toBe(u);
    const t = put(s, 1, BTR('T08'), { slot: 1 }); // Lv2
    const low = put(s, 1, BTR('T16'), 'waiting');
    s = activate(s, u, 1);
    expect(s.players[1].stage[1]?.uid).toBe(low);
    expect(s.players[1].waiting).toContain(t);
  });

  it('013 十天眾 莎拉莎：休息室名場面 2 張以下時手牌等級 -1；攻擊時付①判定 3 次', () => {
    let s = sc();
    const h = put(s, 0, C('013'), 'hand');
    expect(E.levelOf(s, h)).toBe(2);
    for (const n of ['022', '023', '024']) put(s, 0, C(n), 'waiting');
    expect(E.levelOf(s, h)).toBe(3);
    s = sc();
    levels(s, 3, 'yellow');
    stock(s, 1);
    const u = put(s, 0, C('013'), { slot: 1 });
    gbOthers(s, 2);
    expect(E.power(s, u)).toBe(12000);
    const checks = plain(s, 0, 3);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(s.players[0].stock).toEqual(expect.arrayContaining(checks));
  });

  it('014 原初的星晶獸 路西菲爾：聖德芬或路西菲爾被打倒時放到回憶區；集中：選擇名場面每張看 3 張拿 1 張', () => {
    let s = oppTurn(sc());
    put(s, 0, C('014'), { slot: 3 });
    const sand = put(s, 0, C('016'), { slot: 0 }); // 對手回合 3000
    put(s, 1, BTR('T16'), { slot: 2 });
    put(s, 1, BTR('T16'), { slot: 1 });
    plain(s, 1, 1);
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 2, 'front', 1);
    s = skipCounter(s);
    s = yes(s);
    expect(s.players[0].memory).toEqual([sand]);
  });

  it('015 天司的郵差：助太刀 +2000；全是《碧藍幻想》時牌組上方 1 張放到能量區', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 });
    const def = put(s, 0, C('T08'), { slot: 2 });
    levels(s, 1, 'yellow');
    stock(s, 1);
    const bk = put(s, 0, C('015'), 'hand');
    plain(s, 1, 1);
    const [next] = plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(7500);
    s = yes(s);
    expect(s.players[0].stock).toContain(next);
  });

  it('016 復讐的天司 聖德芬：自己回合 +6000；CX 連動「我出門了！」撿回角色並把同名卡放到回憶區', () => {
    let s = sc();
    levels(s, 2, 'yellow');
    const u = put(s, 0, C('016'), { slot: 1 });
    expect(E.power(s, u)).toBe(9000);
    const cx = put(s, 0, C('021'), 'hand');
    const back = put(s, 0, C('T08'), 'waiting');
    const mem = put(s, 0, C('004'), 'waiting');
    plain(s, 0, 1);
    spare(s);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = attack(s, 1, 'direct');
    s = choose(s, [back]);
    s = choose(s, [mem]);
    expect(s.players[0].hand).toContain(back);
    expect(s.players[0].memory).toEqual([mem]);
  });

  it('017 指教的天司：助太刀 +3000；警報：在傷害區最上面時名場面階段換掉對手角色', () => {
    let s = sc();
    put(s, 0, C('017'), 'clock');
    put(s, 0, C('T01'), 'hand');
    put(s, 1, BTR('T08'), { slot: 1 });
    const low = put(s, 1, BTR('T16'), 'waiting');
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('指教的天司');
    s = yes(s);
    expect(s.players[1].stage[1]?.uid).toBe(low);
  });

  it('018 『金』之爛夏 加雷翁：其他 2 張 +4000；CX 連動「蒼空之楔」：對手前列清空時安可步驟找 4 張', () => {
    let s = sc();
    levels(s, 2, 'yellow');
    const u = put(s, 0, C('018'), { slot: 1 });
    gbOthers(s, 2);
    expect(E.power(s, u)).toBe(10000);
    put(s, 0, C('024'), 'climax');
    put(s, 0, C('T01'), 'hand');
    put(s, 0, C('T02'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = pass(s);
    expect(prompt(s)).toContain('加雷翁');
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', max: 4 });
    s = choose(s, opts(s).slice(0, 4));
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(4);
  });

  it('019 『白』之澄夏 路·歐：登場 +4500；對手前列清空時安可步驟付②丟 2 張角色回 3 血', () => {
    let s = sc();
    levels(s, 2, 'yellow');
    stock(s, 3);
    const u = put(s, 0, C('019'), 'hand');
    s = play(s, u, 1);
    expect(E.power(s, u)).toBe(11500);
    put(s, 0, C('T01'), 'hand');
    put(s, 0, C('T02'), 'hand');
    const hurt = [put(s, 0, C('T03'), 'clock'), put(s, 0, C('T04'), 'clock'), put(s, 0, C('T05'), 'clock')];
    s = passUntil(s, 'attackDeclare');
    s = pass(s);
    s = yes(s);
    s = choose(s, hurt);
    expect(s.players[0].waiting).toEqual(expect.arrayContaining(hurt));
  });

  it('020 000 天空為何蔚藍 Part.Ⅲ：3 張《天司》等角色時二選一（撿回連動名場面）', () => {
    let s = sc();
    levels(s, 1, 'yellow');
    stock(s, 1);
    for (const [n, slot] of [['004', 0], ['016', 1], ['014', 3]] as const) put(s, 0, C(n), { slot });
    const want = put(s, 0, C('023'), 'waiting');
    const ev = put(s, 0, C('020'), 'hand');
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    s = option(s, 0);
    s = choose(s, [want]);
    expect(s.players[0].hand).toEqual([want]);
  });

  it('名場面：選擇 021～024、金條 051～054、木門 084～086、門 113／114／116、書本 112／115', () => {
    const s = sc();
    const u = put(s, 0, C('T08'), { slot: 0 });
    const want: Record<string, string[]> = {
      '021': ['choice'], '051': ['treasure'], '084': ['comeback'], '113': ['soul', 'gate'], '114': ['soul', 'gate'], '116': ['soul', 'gate'],
    };
    for (const [n, tr] of Object.entries(want)) {
      const c = put(s, 0, C(n), 'climax');
      expect([E.power(s, u), E.soul(s, u)]).toEqual([6500, 2]);
      expect(E.cardOf(s, c).triggers).toEqual(tr);
      s.players[0].climax = [];
    }
  });

  it('112／115 書本名場面：打出時抽最多 1 張，最多 2 張角色魂傷 +1', () => {
    let s = sc();
    levels(s, 1, 'blue');
    const a = put(s, 0, C('T08'), { slot: 0 });
    const cx = put(s, 0, C('112'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = yes(s);
    s = choose(s, [a]);
    expect(E.soul(s, a)).toBe(2);
    expect(E.power(s, a)).toBe(5500);
  });

  it('025 南南西的守護神 安妮拉：登場丟角色抽 1；進休息室時丟 1 張看 4 張拿角色', () => {
    let s = sc();
    put(s, 0, C('T01'), 'hand');
    const u = put(s, 0, C('025'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('026 北之守護神 比卡拉：其他 2 張 +5000；CX 連動「水上露營」：安可步驟兩個效果都做', () => {
    let s = sc();
    levels(s, 2, 'green');
    const u = put(s, 0, C('026'), { slot: 1 });
    gbOthers(s, 2);
    expect(E.power(s, u)).toBe(9000);
    put(s, 0, C('053'), 'climax');
    const milled = plain(s, 0, 3);
    s = passUntil(s, 'attackDeclare');
    s = pass(s);
    expect(s.pending).toMatchObject({ kind: 'chooseOption' });
    s = option(s, 0);
    s = yes(s);
    expect(s.players[0].waiting).toEqual(expect.arrayContaining(milled));
    expect(s.pending).toMatchObject({ kind: 'select' }); // 接著找《十二神將》
  });

  it('027 十天眾 西艾特：登場把「守護天空之人」放到能量區；【起】吃 1 點抽 1，觸發 CX 連動給 3 點傷害', () => {
    let s = sc();
    levels(s, 3, 'green');
    stock(s, 2);
    const cx = put(s, 0, C('051'), 'waiting');
    const u = put(s, 0, C('027'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    s = option(s, 1);
    expect(s.players[0].stock).toContain(cx);
    gbOthers(s, 2);
    put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('051'), 'hand');
    put(s, 0, C('T01'), 'hand');
    const dmg = plain(s, 1, 3);
    s = activate(s, u, 2);
    expect(prompt(s)).toContain('西艾特');
    s = yes(s);
    s = choose(s, [s.players[0].hand.find((x) => E.cardOf(s, x).id === C('T01'))!]); // 費用：再丟 1 張手牌
    expect(s.players[1].clock).toEqual(dmg);
  });

  it('028 最高密度的純心 亞奇瑪：進休息室時付①吃 1 點，看 2 張拿《碧藍幻想》角色', () => {
    let s = sc();
    stock(s, 1);
    put(s, 0, C('028'), { slot: 1 });
    const v = put(s, 0, C('T01'), 'hand');
    const [, a, b] = top(s, 0, [C('T02'), C('T03'), C('T04')]);
    s = play(s, v, 1);
    s = yes(s);
    s = choose(s, [a!, b!]);
    s = yes(s);
    expect(s.players[0].hand).toEqual(expect.arrayContaining([a, b]));
  });

  it('029 東之守護神 瑪可拉：登場翻到角色可以背面放到下面當標記，自己回合 +2000', () => {
    let s = sc();
    const u = put(s, 0, C('029'), 'hand');
    const [m] = plain(s, 0, 1);
    s = play(s, u, 1);
    s = yes(s);
    s = yes(s);
    expect(s.markers[u]).toEqual([{ uid: m, faceUp: false }]);
    expect(E.power(s, u)).toBe(4000);
  });

  it('030 南之守護神 珊奇拉：手牌 1 張放到傷害區，從牌組找《十二神將》', () => {
    let s = sc();
    put(s, 0, C('T01'), 'hand');
    const u = put(s, 0, C('030'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    expect(opts(s).every((o) => E.cardOf(s, o).traits.some((t) => t.ja === '十二神将'))).toBe(true);
    expect(s.players[0].clock).toHaveLength(1);
  });

  it('031 西北西的守護神 瓦吉拉：其他《十二神將》2 張時自己回合 +5000', () => {
    const s = sc();
    const u = put(s, 0, C('031'), { slot: 1 });
    put(s, 0, C('025'), { slot: 3 });
    put(s, 0, C('029'), { slot: 4 });
    expect(E.power(s, u)).toBe(8500);
  });

  it('032 六龍之『翠』 伊薇雅：其他每張 +500；對手攻擊階段開始時付①和另 1 張交換位置並直立', () => {
    let s = oppTurn(sc());
    const u = put(s, 0, C('032'), { slot: 3 });
    const mate = put(s, 0, C('T08'), { slot: 0, state: 'rest' });
    expect(E.power(s, u)).toBe(6000);
    stock(s, 1);
    s = passUntil(s, 'confirm');
    s = yes(s);
    expect(s.players[0].stage[0]).toEqual({ uid: u, state: 'stand' });
    expect(s.players[0].stage[3]).toEqual({ uid: mate, state: 'stand' });
  });

  it('033 西之守護神 瑪奇拉：【起】把自己放到休息室，彈對手 1 張角色', () => {
    let s = sc();
    const u = put(s, 0, C('033'), { slot: 1 });
    const t = put(s, 1, BTR('T16'), { slot: 1 });
    s = activate(s, u, 1);
    expect(s.players[1].hand).toContain(t);
  });

  it('034 北北東的守護神 夏特拉：休息室 3 張金條名場面時手牌等級 -1；其他《十二神將》2 張 +3000', () => {
    const s = sc();
    const h = put(s, 0, C('034'), 'hand');
    for (const n of ['052', '053', '054']) put(s, 0, C(n), 'waiting');
    expect(E.levelOf(s, h)).toBe(2);
    const u = put(s, 0, C('034'), { slot: 1 });
    put(s, 0, C('025'), { slot: 3 });
    put(s, 0, C('029'), { slot: 4 });
    expect(E.power(s, u)).toBe(11000);
  });

  it('035 自月歸來者 卡西烏斯：CX 連動「旅程的終點」：給 2 點，被取消就可以再給 2 點', () => {
    let s = sc();
    levels(s, 3, 'green');
    stock(s, 2);
    put(s, 0, C('035'), { slot: 1 });
    put(s, 0, C('052'), 'climax');
    put(s, 0, C('T01'), 'hand');
    plain(s, 0, 1);
    top(s, 1, [BTR('T14'), BTR('T20'), BTR('T14'), BTR('T16')]); // 第 1 次被取消
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(prompt(s)).toContain('再給對手2點傷害');
    s = yes(s);
    expect(s.players[1].clock.slice(0, 2)).toHaveLength(2);
  });

  it('036 颯仙 拉莫拉克：對手前列全部 -500', () => {
    let s = sc();
    put(s, 0, C('T08'), { slot: 0 });
    const a = put(s, 1, BTR('T16'), { slot: 0 });
    const u = put(s, 0, C('036'), 'hand');
    s = play(s, u, 1);
    s = order(s, undefined, '－500');
    s = order(s);
    if (s.pending?.kind === 'select') s = choose(s, []);
    expect(E.power(s, a)).toBe(5000);
  });

  it('037 止水的隱者：【起】付①把自己放到休息室看 4 張；在休息室時主要階段丟角色回到舞台', () => {
    let s = sc();
    stock(s, 1);
    const u = put(s, 0, C('037'), { slot: 3 });
    const looked = top(s, 0, [C('022'), C('T08'), C('T01'), C('T02')]);
    s = activate(s, u, 1);
    s = choose(s, [looked[1]!]);
    s = yes(s);
    expect(s.players[0].hand).toEqual([looked[1]]);
    expect(s.players[0].waiting).toContain(u);
  });

  it('038 管線工程師 艾薩克：登場手牌 1 張放到能量區', () => {
    let s = sc();
    const card = put(s, 0, C('T01'), 'hand');
    const u = put(s, 0, C('038'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    expect(s.players[0].stock).toEqual([card]);
  });

  it('039 斷罪的皇帝 卡策麗菈：從休息室回到舞台時把牌組的哈澤莉菈放到休息室；【起】撿回「十賢者」', () => {
    let s = sc();
    levels(s, 2, 'green');
    put(s, 0, C('039'), 'waiting');
    put(s, 0, C('T01'), 'hand');
    s = toMainStart(s);
    s = yes(s);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 3 });
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    s = choose(s, [opts(s)[0]!]);
    expect(s.players[0].waiting.some((u) => E.cardOf(s, u).id === C('102'))).toBe(true);
    const cx = put(s, 0, C('113'), 'waiting');
    s = activate(s, s.players[0].stage[3]!.uid, 2);
    expect(s.players[0].hand).toContain(cx);
  });

  it('040 十天眾 妮歐：應援 Lv3 以上 +2000；【起】丟名場面橫置撿回角色', () => {
    let s = sc();
    const u = put(s, 0, C('040'), { slot: 3 });
    const big = put(s, 0, C('035'), { slot: 0 });
    expect(E.power(s, big)).toBe(12000);
    put(s, 0, C('022'), 'hand');
    const back = put(s, 0, C('T08'), 'waiting');
    s = activate(s, u, 1);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('041 東南東的守護神 海拉：【起】丟 1 張並把自己放到休息室，抽 1 張', () => {
    let s = sc();
    const u = put(s, 0, C('041'), { slot: 3 });
    put(s, 0, C('T01'), 'hand');
    s = activate(s, u, 1);
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('042 北北西的守護神 庫比拉：自己回合 +1500；打倒對手撿回 1 張丟 1 張', () => {
    let s = sc();
    const u = put(s, 0, C('042'), { slot: 1 });
    put(s, 0, C('T08'), { slot: 3 });
    expect(E.power(s, u)).toBe(3500);
    put(s, 1, BTR('T14'), { slot: 1 });
    put(s, 0, C('T01'), 'hand');
    const back = put(s, 0, C('T08'), 'waiting');
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    expect(s.players[0].hand).toContain(back);
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 }); // 丟 1 張手牌
  });

  it('043 南南東的守護神 因達拉：應援自己回合 Lv1 以上 +500', () => {
    const s = sc();
    put(s, 0, C('043'), { slot: 3 });
    const a = put(s, 0, C('T08'), { slot: 0 });
    const b = put(s, 0, C('T03'), { slot: 1 }); // Lv0
    expect([E.power(s, a), E.power(s, b)]).toEqual([6000, 1000]);
  });

  it('044 『翠』之化貓 伊薇雅：其他 2 張自己回合 +2000；登場付①丟 1 張撿回角色', () => {
    let s = sc();
    levels(s, 1, 'green');
    stock(s, 1);
    gbOthers(s, 2);
    put(s, 0, C('T01'), 'hand');
    const back = put(s, 0, C('T08'), 'waiting');
    const u = put(s, 0, C('044'), 'hand');
    s = play(s, u, 1);
    expect(E.power(s, u)).toBe(6000);
    s = yes(s);
    s = choose(s, [back]);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('045 全空最弱的子神 比卡拉：交替：等級 2 以上名場面階段換成 Lv2 比卡拉', () => {
    let s = sc();
    levels(s, 2, 'green');
    put(s, 0, C('045'), { slot: 1 });
    const big = put(s, 0, C('026'), 'waiting');
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('交替');
    s = yes(s);
    expect(s.players[0].stage[1]?.uid).toBe(big);
  });

  it('046 西南西的守護神 安琪拉：【起】把手牌《十二神將》放到牌組下方並橫置，回 1 血', () => {
    let s = sc();
    const u = put(s, 0, C('046'), { slot: 3 });
    const card = put(s, 0, C('025'), 'hand');
    const hurt = put(s, 0, C('T01'), 'clock');
    s = activate(s, u, 2);
    expect(s.players[0].deck.at(-1)).toBe(card);
    expect(s.players[0].waiting).toContain(hurt);
  });

  it('047 衷心的巧克力師 卡西烏斯：助太刀 +3000，反過來打倒攻擊的角色時放到回憶區', () => {
    let s = oppTurn(sc());
    const att = put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 });
    put(s, 0, C('T08'), { slot: 2 });
    levels(s, 2, 'green');
    stock(s, 1);
    const bk = put(s, 0, C('047'), 'hand');
    plain(s, 1, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    s = passUntil(s, 'attackDeclare');
    expect(s.players[1].memory).toContain(att);
  });

  it('048 東北東的守護神 辛達拉：其他每張《十二神將》+1000；CX 連動攻擊結束付②給 2 點', () => {
    let s = sc();
    levels(s, 3, 'green');
    stock(s, 2);
    const u = put(s, 0, C('048'), { slot: 1 });
    put(s, 0, C('025'), { slot: 3 });
    expect(E.power(s, u)).toBe(9000);
    put(s, 0, C('054'), 'climax');
    plain(s, 0, 1);
    const dmg = plain(s, 1, 4);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(s.players[1].clock.slice(-2)).toEqual(dmg.slice(-2).reverse().reverse());
  });

  it('049 初代鬥神 巴薩拉：登場牌組上方 1 張進能量，最多 2 張 +2000', () => {
    let s = sc();
    levels(s, 3, 'green');
    stock(s, 2);
    const u = put(s, 0, C('049'), 'hand');
    const [x] = plain(s, 0, 1);
    s = play(s, u, 1);
    s = choose(s, [x!]);
    s = choose(s, [u]);
    expect(s.players[0].stock).toContain(x);
    expect(E.power(s, u)).toBe(12500);
  });

  it('050 十二神將演義：3 張《十二神將》才能用；撿回 2 張丟 1 張', () => {
    let s = sc();
    levels(s, 1, 'green');
    stock(s, 1);
    const ev = put(s, 0, C('050'), 'hand');
    put(s, 0, C('025'), { slot: 0 });
    put(s, 0, C('029'), { slot: 1 });
    expect(E.playProblem(s, 0, ev)).toBeTruthy();
    put(s, 0, C('030'), { slot: 2 });
    expect(E.playProblem(s, 0, ev)).toBeNull();
    const back = [put(s, 0, C('T08'), 'waiting'), put(s, 0, C('T07'), 'waiting')];
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    s = choose(s, back);
    s = choose(s, [back[0]!]);
    expect(s.players[0].hand).toEqual([back[1]]);
  });

  it('055 原初的星晶獸 貝利亞爾：自己回合 +2000；登場付①吃 1 點二選一', () => {
    let s = sc();
    stock(s, 1);
    const back = put(s, 0, C('T08'), 'waiting');
    const u = put(s, 0, C('055'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    s = option(s, 1);
    expect(s.players[0].hand).toEqual([back]);
    expect(E.power(s, u)).toBe(3500);
  });

  it('056 無窮的群青 碧翠克絲：全是《碧藍幻想》+2000；使用【起】時 +1000', () => {
    let s = sc();
    levels(s, 1, 'red');
    const u = put(s, 0, C('056'), { slot: 1 });
    expect(E.power(s, u)).toBe(5500);
    const g = put(s, 0, C('068'), { slot: 3 });
    put(s, 1, BTR('T16'), { slot: 1 });
    s = activate(s, g, 1);
    expect(E.power(s, u)).toBe(6500);
  });

  it('057 真紅的覺醒 傑塔：使用【起】時 +3000', () => {
    let s = sc();
    levels(s, 1, 'red');
    const u = put(s, 0, C('057'), { slot: 1 });
    const g = put(s, 0, C('068'), { slot: 3 });
    put(s, 1, BTR('T16'), { slot: 1 });
    s = activate(s, g, 1);
    expect(E.power(s, u)).toBe(7000);
  });

  it('058 高潔的燦炎 帕西瓦爾：登場二選一（重洗對手能量 +1000）', () => {
    let s = sc();
    levels(s, 3, 'red');
    stock(s, 2);
    const os = [put(s, 1, BTR('T01'), 'stock'), put(s, 1, BTR('T02'), 'stock')];
    const u = put(s, 0, C('058'), 'hand');
    s = play(s, u, 1);
    s = option(s, 1);
    expect(E.power(s, u)).toBe(11000);
    expect(s.players[1].stock).toHaveLength(2);
    expect(os).toBeDefined();
  });

  it('059 漆黑的兇刃 巴薩拉加：【起】丟 1 張並把自己放到休息室，撿回角色', () => {
    let s = sc();
    const u = put(s, 0, C('059'), { slot: 3 });
    put(s, 0, C('022'), 'hand');
    const back = put(s, 0, C('T08'), 'waiting');
    s = activate(s, u, 1);
    s = choose(s, [back]);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('060 六龍之『朱』 威爾納斯：攻擊結束時付③丟 2 張給 4 點傷害', () => {
    let s = sc();
    stock(s, 3);
    put(s, 0, C('060'), { slot: 1 });
    put(s, 0, C('T01'), 'hand');
    put(s, 0, C('T02'), 'hand');
    plain(s, 0, 1);
    const dmg = plain(s, 1, 6);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(s.players[1].clock).toHaveLength(6);
    expect(dmg).toBeDefined();
  });

  it('061 星之民 別西卜：【起】放到牌組下方，對手牌組上方 4 張進休息室，自己 1 張角色 +4000', () => {
    let s = sc();
    const u = put(s, 0, C('061'), { slot: 3 });
    const mate = put(s, 0, C('T08'), { slot: 0 });
    const milled = plain(s, 1, 4);
    s = activate(s, u, 1);
    expect(s.players[1].waiting).toEqual(expect.arrayContaining(milled));
    expect(E.power(s, mate)).toBe(9500);
  });

  it('062 宵之審問者：助太刀 +2500；付費把等級比對手高的角色丟進休息室', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    const high = put(s, 1, BTR('T08'), { slot: 3 });
    put(s, 0, C('T08'), { slot: 2 });
    put(s, 0, C('T07'), { slot: 3 });
    levels(s, 2, 'red');
    stock(s, 2);
    put(s, 0, C('T01'), 'hand');
    const bk = put(s, 0, C('062'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    s = yes(s);
    s = choose(s, [s.players[0].stage[3]!.uid]);
    s = choose(s, [high]);
    expect(s.players[1].waiting).toContain(high);
  });

  it('063 嚴峻的魔鬼教官 伊爾莎：其他 2 張時自己回合 +3000 並得到安可', () => {
    const s = sc();
    const u = put(s, 0, C('063'), { slot: 1 });
    gbOthers(s, 2);
    expect(E.power(s, u)).toBe(10500);
    expect(E.abilitiesOf(s, u).some((a) => a.keyword?.id === 'encore' && a.text.ja.includes('グラブル'))).toBe(true);
  });

  it('064 拂曉的忠騎士 齊格飛：CX 連動「龍騎士團」：把帕西瓦爾、蘭斯洛特、韋恩放上舞台', () => {
    let s = sc();
    levels(s, 3, 'red');
    stock(s, 1);
    put(s, 0, C('064'), { slot: 1 });
    put(s, 0, C('T01'), 'hand');
    put(s, 0, C('T02'), 'hand');
    const knights = [put(s, 0, C('058'), 'waiting'), put(s, 0, C('109'), 'waiting'), put(s, 0, C('108'), 'waiting')];
    const cx = put(s, 0, C('085'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = yes(s);
    for (const [k, slot] of [[knights[0]!, 0], [knights[1]!, 2], [knights[2]!, 3]] as const) {
      s = choose(s, [k]);
      expect(s.pending).toMatchObject({ kind: 'chooseSlot' });
      if (slot === 2) expect(s.pending?.kind === 'chooseSlot' && s.pending.slots).not.toContain(0); // 別々の枠
      s = ok(s, { type: 'chooseSlot', player: 0, slot });
    }
    expect([0, 2, 3].map((i) => s.players[0].stage[i]?.uid)).toEqual(knights);
    expect(s.pending).toMatchObject({ kind: 'orderAbility' }); // 帕西瓦爾、蘭斯洛特「因齊格飛的效果被放置」
  });

  it('065 再臨的墮天之王 路西法：登場把回憶區的路西菲爾、盧西歐放到下面當標記', () => {
    let s = sc();
    levels(s, 3, 'red');
    stock(s, 2);
    const a = put(s, 0, C('004'), 'memory');
    const b = put(s, 0, C('005'), 'memory');
    const u = put(s, 0, C('065'), 'hand');
    s = play(s, u, 1);
    s = choose(s, [a]);
    s = choose(s, [b]);
    expect(s.markers[u]?.map((m) => m.uid)).toEqual([a, b]);
  });

  it('066 暗躍的震狼 尤斯塔斯：【起】送 1 張其他角色進休息室，+1 能量', () => {
    let s = sc();
    const u = put(s, 0, C('066'), { slot: 1 });
    put(s, 0, C('T08'), { slot: 3 });
    const [x] = plain(s, 0, 1);
    s = activate(s, u, 1);
    expect(s.players[0].stock).toEqual([x]);
  });

  it('067 在月與空之間 格溫：應援 +500；【起】讓角色打倒對手時撿回角色', () => {
    let s = sc();
    put(s, 0, C('067'), { slot: 3 });
    const a = put(s, 0, C('T08'), { slot: 0 });
    expect(E.power(s, a)).toBe(6000);
  });

  it('068 十天眾 艾賽爾：【起】橫置對手前列 -1000', () => {
    let s = sc();
    const u = put(s, 0, C('068'), { slot: 3 });
    const t = put(s, 1, BTR('T16'), { slot: 1 });
    s = activate(s, u, 1);
    expect(E.power(s, t)).toBe(4500);
  });

  it('069 虹橋的墮天司 沙利葉：對手角色得到安可［②］；攻擊時送 1 張角色 +3500 判定 2 次', () => {
    let s = sc();
    const u = put(s, 0, C('069'), { slot: 1 });
    const t = put(s, 1, BTR('T16'), { slot: 1 });
    expect(E.abilitiesOf(s, t).some((a) => a.text.ja === '【自】アンコール［②］')).toBe(true);
    put(s, 0, C('T08'), { slot: 3 });
    stock(s, 1);
    spare(s);
    plain(s, 0, 2);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = yes(s);
    s = choose(s, [s.players[0].stage[3]!.uid]);
    expect(E.power(s, u)).toBe(6500);
  });

  it('070 破天荒的教皇 阿拉南：攻擊時其他 2 張以上，紅色角色 +3500', () => {
    let s = sc();
    levels(s, 1, 'red');
    const u = put(s, 0, C('070'), { slot: 1 });
    gbOthers(s, 2);
    plain(s, 0, 1);
    spare(s);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(E.power(s, u)).toBe(5500);
  });

  it('071 鮮烈之力 芙勞：其他 4 張以上時攻擊付①丟角色給 2 點傷害', () => {
    let s = sc();
    levels(s, 3, 'red');
    stock(s, 1);
    put(s, 0, C('071'), { slot: 1 });
    gbOthers(s, 2);
    put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('T08'), { slot: 2 });
    put(s, 0, C('T01'), 'hand');
    plain(s, 0, 1);
    const dmg = plain(s, 1, 5);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(s.players[1].clock.slice(0, 2)).toEqual(dmg.slice(0, 2));
  });

  it('072 炎帝 帕西瓦爾：自己回合其他每張 +1000', () => {
    const s = sc();
    const u = put(s, 0, C('072'), { slot: 1 });
    gbOthers(s, 2);
    expect(E.power(s, u)).toBe(3000);
  });

  it('073 銀雪月影 伊爾莎：其他 3 張以上時【起】橫置抽 1 丟 1', () => {
    let s = sc();
    const u = put(s, 0, C('073'), { slot: 1 });
    gbOthers(s, 2);
    put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('T01'), 'hand');
    s = activate(s, u, 0);
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
  });

  it('074 閒暇的猛刃 巴薩拉加：自己回合全是《碧藍幻想》+8000 魂傷 +1；倒置時吃 1 點並改成橫置', () => {
    let s = sc();
    const u = put(s, 0, C('074'), { slot: 1 });
    expect([E.power(s, u), E.soul(s, u)]).toEqual([9500, 2]);
    s = oppTurn(sc());
    const v = put(s, 0, C('074'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 2 });
    put(s, 1, BTR('T16'), { slot: 1 });
    plain(s, 1, 1);
    plain(s, 0, 2);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 2, 'front', 1);
    s = skipCounter(s);
    expect(s.players[0].stage[0]).toEqual({ uid: v, state: 'rest' });
  });

  it('075 無盡的鬥爭 別西卜：直接攻擊時魂傷 +1', () => {
    let s = sc();
    const u = put(s, 0, C('075'), { slot: 1 });
    plain(s, 0, 1);
    spare(s);
    s = passUntil(s, 'attackDeclare');
    const before = E.soul(s, u);
    s = attack(s, 1, 'direct');
    expect(E.soul(s, u)).toBe(before + 2); // 直接攻擊 +1、效果 +1
  });

  it('076 寒空中顫抖的群青 碧翠克絲：【起】給角色「攻擊時付①判定 2 次」；使用【起】時抽 1 丟 1', () => {
    let s = sc();
    const u = put(s, 0, C('076'), { slot: 3 });
    const a = put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('T01'), 'hand');
    s = activate(s, u, 1);
    s = choose(s, [a]);
    expect(prompt(s)).toContain('碧翠克絲');
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'select', min: 1, max: 1 });
  });

  it('077 屠龍騎士 齊格飛：等級 3 時【起】換成手牌的「拂曉的忠騎士 齊格飛」', () => {
    let s = sc();
    levels(s, 3, 'red');
    const u = put(s, 0, C('077'), { slot: 1 });
    const big = put(s, 0, C('064'), 'hand');
    s = activate(s, u, 1);
    s = choose(s, [big]);
    expect(s.players[0].stage[1]?.uid).toBe(big);
  });

  it('078 狡知的墮天司 貝利亞爾：後列有「星之民 路西法」+3500；登場丟角色把路西法放上舞台', () => {
    let s = sc();
    levels(s, 1, 'red');
    put(s, 0, C('T01'), 'hand');
    const luc = put(s, 0, C('080'), 'waiting');
    const u = put(s, 0, C('078'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 3 });
    expect(s.players[0].stage[3]?.uid).toBe(luc);
    expect(E.power(s, u)).toBe(2500 + 3500 + 1000);
  });

  it('079 逢光的清狼 尤斯塔斯：助太刀 +2000；對手有名場面時再 +2000', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 });
    put(s, 1, BTR('T20'), 'climax');
    const def = put(s, 0, C('T08'), { slot: 2 });
    levels(s, 1, 'red');
    stock(s, 1);
    const bk = put(s, 0, C('079'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(5500 + 2000 + 2000);
  });

  it('080 星之民 路西法：自己回合其他 +1000；打出選擇名場面時把聖德芬等放到回憶區', () => {
    let s = sc();
    levels(s, 1, 'yellow');
    put(s, 0, C('080'), { slot: 3 });
    gbOthers(s, 1, 4);
    put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('T08'), { slot: 1 });
    const mem = put(s, 0, C('016'), 'waiting');
    const cx = put(s, 0, C('021'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = yes(s);
    expect(s.players[0].memory).toEqual([mem]);
  });

  it('081 盛夏的穿光 傑塔：任一方休息室名場面 2 張以下時手牌等級 -1；使用【起】時 +3000', () => {
    const s = sc();
    const h = put(s, 0, C('081'), 'hand');
    expect(E.levelOf(s, h)).toBe(2);
  });

  it('082 『朱』之慈溫 威爾納斯：登場的回合把對手前列清空後，把它們放到對手的傷害區', () => {
    let s = sc();
    levels(s, 3, 'red');
    stock(s, 5);
    for (const n of ['T01', 'T02', 'T03']) put(s, 0, C(n), 'hand');
    const t = put(s, 1, BTR('T16'), { slot: 1 });
    const u = put(s, 0, C('082'), 'hand');
    s = play(s, u, 1);
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('威爾納斯');
    s = yes(s);
    expect(s.players[1].clock).toContain(t);
  });

  it('083 STAY MOON：選 2 次角色 +1000，正面的角色魂傷 -1', () => {
    let s = sc();
    levels(s, 3, 'red');
    stock(s, 2);
    const a = put(s, 0, C('T08'), { slot: 1 });
    const f = put(s, 1, BTR('T16'), { slot: 1 });
    const ev = put(s, 0, C('083'), 'hand');
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    expect(E.power(s, a)).toBe(5500 + 2000);
    expect(E.soul(s, f)).toBe(-1);
    expect(s.players[0].memory).toEqual([ev]);
  });

  it('087 忠誓的騎士團長 蘭斯洛特：自己回合全是《碧藍幻想》+4000', () => {
    const s = sc();
    const u = put(s, 0, C('087'), { slot: 1 });
    expect(E.power(s, u)).toBe(7000);
  });

  it('088 六龍之『黑』 菲迪耶爾：登場二選一：對手休息室只留 1 張名場面，其餘洗回牌組', () => {
    let s = sc();
    levels(s, 3, 'blue');
    stock(s, 2);
    const keep = put(s, 1, BTR('T20'), 'waiting');
    const back = put(s, 1, BTR('T16'), 'waiting');
    const u = put(s, 0, C('088'), 'hand');
    s = play(s, u, 1);
    s = option(s, 1);
    expect(s.players[1].waiting).toEqual([keep]);
    expect(s.players[1].deck).toContain(back);
    expect(E.power(s, u)).toBe(11000);
  });

  it('089 嘆息的戀人 妮雅：CX 連動「秘密的嗜好」：給 4 點傷害或回 2 血，並不受對手【自】的傷害', () => {
    let s = sc();
    levels(s, 3, 'blue');
    stock(s, 1);
    const u = put(s, 0, C('089'), { slot: 1 });
    put(s, 0, C('116'), 'climax');
    plain(s, 0, 1);
    const dmg = plain(s, 1, 8);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    s = option(s, 1);
    expect(s.players[1].clock.slice(0, 4)).toEqual(dmg.slice(0, 4));
    expect(s.shields).toEqual([{ p: 0, uid: u, until: s.turn + 1 }]);
  });

  it('090 六龍之『碧』 瓦姆迪斯：轉移：在傷害區時主要階段和手牌藍色卡交換', () => {
    let s = sc();
    const u = put(s, 0, C('090'), 'clock');
    const blue = put(s, 0, C('T08'), 'hand');
    s = toMainStart(s);
    expect(prompt(s)).toContain('轉移');
    s = yes(s);
    s = choose(s, [blue]);
    expect(s.players[0].hand).toContain(u);
    expect(s.players[0].clock).toContain(blue);
  });

  it('091 不退轉的守護騎士 韋恩：名場面區有「龍騎士團」時，判定翻到這張也有木門圖示', () => {
    let s = sc();
    levels(s, 1, 'red');
    put(s, 0, C('T08'), { slot: 0 });
    const back = put(s, 0, C('T07'), 'waiting');
    const cx = put(s, 0, C('085'), 'hand');
    top(s, 0, [C('091')]);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = attack(s, 0, 'direct');
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'comeback', options: expect.arrayContaining([back]) });
  });

  it('092 純真之花 露莉亞：登場丟角色，從牌組把 Lv0 主人公放上舞台', () => {
    let s = sc();
    put(s, 0, C('T01'), 'hand');
    const u = put(s, 0, C('092'), 'hand');
    s = play(s, u, 1);
    s = yes(s);
    expect(opts(s).every((o) => E.cardOf(s, o).name.ja.includes('主人公'))).toBe(true);
    s = choose(s, [opts(s)[0]!]);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 0 });
    expect(E.cardOf(s, s.players[0].stage[0]!.uid).name.ja).toContain('主人公');
  });

  it('093 時龍 奧羅洛加亞（Lv0）：登場排 2 張、丟角色抽 1', () => {
    let s = sc();
    const u = put(s, 0, C('093'), 'hand');
    const [a, b] = plain(s, 0, 2);
    s = play(s, u, 1);
    s = order(s, undefined, '好きな順番');
    s = choose(s, [b!, a!]);
    expect(s.players[0].deck.slice(0, 2)).toEqual([b, a]);
  });

  it('094 輪轉追尋者·蝕 主人公(男)：自己回合全是《碧藍幻想》等級 +1 攻擊 +1500', () => {
    const s = sc();
    const u = put(s, 0, C('094'), { slot: 1 });
    expect([E.levelOf(s, u), E.power(s, u)]).toEqual([1, 3500]);
  });

  it('095 輪轉追尋者·蝕 主人公(女)：攻擊時判定 2 次，之後能量區上方 1 張放到休息室', () => {
    let s = sc();
    put(s, 0, C('095'), { slot: 1 });
    const [t1, t2] = plain(s, 0, 2);
    spare(s);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    expect(s.players[0].stock).toEqual([t1]);
    expect(s.players[0].waiting).toContain(t2);
  });

  it('096 時龍 奧羅洛加亞（Lv3）：CX 連動：自己休息室 2 張洗回牌組', () => {
    let s = sc();
    levels(s, 3, 'blue');
    stock(s, 3);
    const u = put(s, 0, C('096'), 'hand');
    s = play(s, u, 1);
    s = choose(s, [opts(s)[0]!]);
    s = yes(s);
    put(s, 0, C('115'), 'climax');
    put(s, 0, C('T01'), 'hand');
    const w = [put(s, 0, C('113'), 'waiting'), put(s, 0, C('114'), 'waiting')];
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    s = choose(s, [s.players[0].hand[s.players[0].hand.length - 1]!]);
    s = option(s, 0);
    s = choose(s, w);
    expect(w.every((u) => s.players[0].deck.includes(u) || s.players[0].stock.includes(u))).toBe(true); // 洗回牌組（判定可能翻到）
  });

  it('097 十天眾 卡托爾：自己回合 +3000；進休息室時翻 2 張有名場面就能拿回手牌', () => {
    let s = sc();
    const u = put(s, 0, C('097'), { slot: 1 });
    expect(E.power(s, u)).toBe(3500);
    put(s, 0, C('T08'), { slot: 3 });
    const v = put(s, 0, C('T01'), 'hand');
    top(s, 0, [C('022'), C('T02')]);
    s = play(s, v, 1);
    s = option(s, 0);
    expect(s.players[0].hand).toContain(u);
  });

  it('098 冰皇 阿格羅瓦爾：攻擊時翻到角色全隊 +2000', () => {
    let s = sc();
    levels(s, 1, 'blue');
    const u = put(s, 0, C('098'), { slot: 1 });
    const mate = put(s, 0, C('T08'), { slot: 0 });
    top(s, 0, [C('T01'), C('T02')]);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = order(s, undefined, '公開');
    s = yes(s);
    expect(E.power(s, mate)).toBe(7500);
    expect(u).toBeDefined();
  });

  it('099 十天眾 西斯：自己回合其他 2 張 +3000', () => {
    const s = sc();
    const u = put(s, 0, C('099'), { slot: 1 });
    gbOthers(s, 2);
    expect(E.power(s, u)).toBe(7000);
  });

  it('100 義憤的女帝 瑪麗亞·泰瑞莎：應援 +等級×500；【起】最多 2 張 +1500', () => {
    let s = sc();
    const u = put(s, 0, C('100'), { slot: 3 });
    const a = put(s, 0, C('T08'), { slot: 0 });
    expect(E.power(s, a)).toBe(6000);
    s = activate(s, u, 2);
    s = choose(s, [a]);
    expect(E.power(s, a)).toBe(7500);
  });

  it('101 十天眾 烏諾：助太刀 +2500；付④把對手角色橫置', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    const other = put(s, 1, BTR('T16'), { slot: 1 });
    put(s, 0, C('T08'), { slot: 2 });
    levels(s, 2, 'blue');
    stock(s, 5);
    put(s, 0, C('T01'), 'hand');
    const bk = put(s, 0, C('101'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 0, 'front', 1);
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    s = yes(s);
    s = choose(s, [other]);
    expect(s.players[1].stage[1]?.state).toBe('rest');
  });

  it('102 欺瞞的女教皇 哈澤莉菈：自己回合藍色角色 +2000；在休息室時打出「十賢者」付①回到舞台', () => {
    let s = sc();
    levels(s, 2, 'blue');
    stock(s, 1);
    const a = put(s, 0, C('T08'), { slot: 0 });
    const u = put(s, 0, C('102'), 'waiting');
    const cx = put(s, 0, C('113'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = yes(s);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 1 });
    expect(s.players[0].stage[1]?.uid).toBe(u);
    expect(E.power(s, a)).toBe(5500 + 2000 + 1000);
  });

  it('103 小雞班 亞瑟＆莫德雷德：【起】放到牌組下方，對手角色 -3000', () => {
    let s = sc();
    const u = put(s, 0, C('103'), { slot: 3 });
    const t = put(s, 1, BTR('T16'), { slot: 1 });
    s = activate(s, u, 1);
    expect(E.power(s, t)).toBe(2500);
  });

  it('104 鬥士 主人公(女)：攻擊時翻到角色全隊 +2000', () => {
    let s = sc();
    put(s, 0, C('104'), { slot: 1 });
    const mate = put(s, 0, C('T08'), { slot: 0 });
    top(s, 0, [C('T01'), C('T02')]);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'direct');
    s = yes(s);
    expect(E.power(s, mate)).toBe(7500);
  });

  it('105 鬥士 主人公(男)：Lv0 4000，對手角色得到安可［②］', () => {
    const s = sc();
    const u = put(s, 0, C('105'), { slot: 1 });
    const t = put(s, 1, BTR('T16'), { slot: 1 });
    expect(E.power(s, u)).toBe(4000);
    expect(E.abilitiesOf(s, t).some((a) => a.text.ja === '【自】アンコール［②］')).toBe(true);
  });

  it('106 『碧』之聖贈 瓦姆迪斯：【起】放到牌組下方，從牌組找名場面', () => {
    let s = sc();
    const u = put(s, 0, C('106'), { slot: 3 });
    s = activate(s, u, 1);
    expect(opts(s).every((o) => E.cardOf(s, o).type === 'climax')).toBe(true);
  });

  it('107 『黑』之燦夏 菲迪耶爾：給予的能力：被等級比對手高的角色打倒時把它放到牌組下方', () => {
    let s = sc();
    levels(s, 2, 'blue');
    stock(s, 1);
    const att = put(s, 0, C('T01'), { slot: 1 });
    const def = put(s, 1, BTR('T09'), { slot: 1 }); // Lv3
    const u = put(s, 0, C('107'), 'hand');
    s = play(s, u, 0);
    s = choose(s, [att]);
    plain(s, 0, 1);
    s = passUntil(s, 'attackDeclare');
    s = attack(s, 1, 'front');
    s = skipCounter(s);
    s = yes(s);
    expect(s.players[1].deck.at(-1)).toBe(def);
  });

  it('108 不撓不屈的騎士 韋恩：其他 +1500；四騎士都在時攻擊階段開始給 4 點傷害', () => {
    let s = sc();
    levels(s, 3, 'blue');
    stock(s, 1);
    put(s, 0, C('108'), { slot: 3 });
    const a = put(s, 0, C('064'), { slot: 0 });
    put(s, 0, C('058'), { slot: 1 });
    put(s, 0, C('109'), { slot: 2 });
    expect(E.power(s, a)).toBe(11500);
    put(s, 0, C('T01'), 'hand');
    const dmg = plain(s, 1, 4);
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('韋恩');
    s = yes(s);
    expect(s.players[1].clock).toEqual(dmg);
  });

  it('109 俊英的雙劍士 蘭斯洛特：登場看 3 張拿最多 2 張', () => {
    let s = sc();
    levels(s, 3, 'blue');
    stock(s, 2);
    const u = put(s, 0, C('109'), 'hand');
    const looked = top(s, 0, [C('T01'), C('111'), C('022')]);
    s = play(s, u, 1);
    s = choose(s, [looked[0]!, looked[1]!]);
    s = yes(s);
    expect(s.players[0].hand).toEqual(expect.arrayContaining([looked[0], looked[1]]));
  });

  it('110 ...and you.：丟角色撿回角色，給角色「進休息室時可以回手牌」', () => {
    let s = sc();
    levels(s, 1, 'blue');
    const a = put(s, 0, C('T08'), { slot: 1 });
    put(s, 0, C('T01'), 'hand');
    const back = put(s, 0, C('T07'), 'waiting');
    const ev = put(s, 0, C('110'), 'hand');
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    s = yes(s);
    s = choose(s, [back]);
    expect(s.players[0].hand).toEqual([back]);
    expect(s.grants.some((g) => g.uid === a)).toBe(true);
  });

  it('111 四騎士：有《菲德拉赫》角色時四選一（撿回齊格飛）', () => {
    let s = sc();
    levels(s, 2, 'blue');
    put(s, 0, C('087'), { slot: 1 });
    const want = put(s, 0, C('064'), 'waiting');
    const ev = put(s, 0, C('111'), 'hand');
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    s = option(s, 1);
    expect(s.players[0].hand).toEqual([want]);
  });

  it('P01 搖曳的斬姬 娜露梅亞：不需滿足顏色條件；【起】橫置 +1000 到對手回合結束', () => {
    let s = sc();
    levels(s, 1, 'yellow');
    const u = put(s, 0, C('P01'), 'hand');
    expect(E.playProblem(s, 0, u)).toBeNull();
    s = play(s, u, 3);
    const a = put(s, 0, C('T08'), { slot: 0 });
    s = activate(s, u, 2);
    s = choose(s, [a]);
    expect(s.mods.find((m) => m.uid === a)).toMatchObject({ power: 1000, until: s.turn + 1 });
  });

  it('P02／P03：和原本的卡效果相同，構築時合計最多 4 張', () => {
    const db = cardDb();
    const deck = [C('026'), C('026'), C('026'), C('P02')];
    expect(addProblem(db, deck, C('P02'))).toContain('同名');
    expect(addProblem(db, deck.slice(0, 3), C('P02'))).toBeNull();
    expect(addProblem(db, [C('001'), C('P03'), C('P03'), C('001')], C('001'))).toContain('同名');
    expect(E.cardOf({ cards: { x: { cardId: C('P02'), owner: 0 } } } as never, 'x').abilities.slice(1)).toEqual(E.cardOf({ cards: { x: { cardId: C('026'), owner: 0 } } } as never, 'x').abilities);
  });

  it('117～144 是重複的卡號，不另外收錄', () => {
    expect(Object.keys(bp.duplicates)).toHaveLength(28);
    for (const id of Object.keys(bp.duplicates)) expect(bp.cards.some((c) => c.id === id)).toBe(false);
    expect(no).toBeDefined();
  });
});

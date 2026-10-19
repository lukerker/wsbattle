// GIRLS BAND CRY 預組（GCR/SE48）每張卡的情境測試。牌組在玩家 0；對手（玩家 1）用孤獨搖滾預組。
import { describe, expect, it } from 'vitest';
import { DECKS, E, GCR_DECK, choose, ok, oppTurn, order, passUntil, put, scene, top, uidOf, yes } from './test-utils.ts';

const C = (n: string) => `GCR/SE48-${n}`;
const BTR = (n: string) => `BTR/W107-${n}`;
const sc = () => scene(11, [GCR_DECK, DECKS[0]]);
const ack = yes; // 對手確認公開的卡

describe('Girls Band Cry GCR/SE48', () => {
  it('T01 開戰的信號 RUPA：打出名場面時翻 1 張，《音樂》角色就拿 1 丟 1；集中：翻 5 張，每張名場面抽 1', () => {
    let s = sc();
    put(s, 0, C('T01'), { slot: 3 });
    put(s, 0, C('T13'), 'clock'); // 紅色，名場面的顏色條件
    const cx = put(s, 0, C('T17'), 'hand');
    const junk = put(s, 0, C('T19'), 'hand');
    const [got] = top(s, 0, [C('T11')]);
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    expect(s.pending).toMatchObject({ kind: 'acknowledge', player: 1 });
    s = ack(s);
    s = choose(s, [junk]); // 拿 1 丟 1
    expect(s.players[0].hand).toEqual([got]);

    s = sc();
    const src = put(s, 0, C('T01'), { slot: 3 });
    put(s, 0, C('T13'), 'stock');
    top(s, 0, [C('T17'), C('T18'), C('T11'), C('T03'), C('T03')]);
    s = ok(s, { type: 'activate', player: 0, uid: src, index: 1 });
    s = yes(s);
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(2);
    expect(s.players[0].stage[3]!.state).toBe('rest');
  });

  it('T02 告白 仁菜：「告白 桃香」+1500 並給予安可（丟手牌角色）；絆：撿回「告白 桃香」', () => {
    let s = sc();
    put(s, 0, C('T02'), { slot: 3 });
    const momoka = put(s, 0, C('T11'), { slot: 1, state: 'reverse' });
    expect(E.power(s, momoka)).toBe(8500);
    put(s, 0, C('T03'), 'hand'); // 安可的費用
    s = passUntil(s, 'confirm'); // 安可步驟：桃香進休息室 → 給予的安可
    s = yes(s);
    expect(s.players[0].stage[1]).toEqual({ uid: momoka, state: 'rest' });

    s = sc();
    const nina = put(s, 0, C('T02'), 'hand');
    put(s, 0, C('T19'), 'hand');
    const back = put(s, 0, C('T11'), 'waiting');
    s = ok(s, { type: 'playCharacter', player: 0, uid: nina, slot: 3 });
    s = yes(s);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('T03 第一次的演奏 昂：自己回合有其他《音樂》角色 +3000；攻擊時付①判定 2 次', () => {
    let s = sc();
    const u = put(s, 0, C('T03'), { slot: 0 });
    expect(E.power(s, u)).toBe(1000);
    put(s, 0, C('T01'), { slot: 3 });
    expect(E.power(s, u)).toBe(4000);
    s.turnPlayer = 1;
    expect(E.power(s, u)).toBe(1000);
    s.turnPlayer = 0;

    put(s, 0, C('T19'), 'stock');
    const checks = top(s, 0, [C('T02'), C('T04')]); // 沒有判定圖示
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    s = yes(s);
    expect(s.players[0].stock).toEqual(checks); // 付掉 1 張，判定的 2 張進能量區
  });

  it('T04 給初始的目擊者 智：登場翻 1 張，《音樂》角色或事件就拿 1 丟 1；可丟《音樂》角色抽 1', () => {
    let s = sc();
    const u = put(s, 0, C('T04'), 'hand');
    const keep = put(s, 0, C('T11'), 'hand');
    const [ev, drawn] = top(s, 0, [C('T16'), C('T01')]);
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    s = order(s, u, '公開');
    s = ack(s);
    s = choose(s, [ev!]); // 拿到事件，再丟掉它
    expect(s.players[0].waiting).toContain(ev);
    s = yes(s); // 第二個能力：丟《音樂》角色（只有 1 張）→ 抽 1
    expect(s.players[0].waiting).toContain(keep);
    expect(s.players[0].hand).toEqual([drawn]);

    s = sc();
    const u2 = put(s, 0, C('T04'), 'hand');
    const [cx] = top(s, 0, [C('T17')]);
    s = ok(s, { type: 'playCharacter', player: 0, uid: u2, slot: 0 }); // 手牌沒有《音樂》角色 → 第二個能力付不起
    s = ack(s);
    expect(s.players[0].deck[0]).toBe(cx); // 名場面放回原位
  });

  it('T05 回去的地方 智：其他《音樂》角色 +500；判定翻到木門名場面時選 1 張角色 +1000 到下次對手回合結束', () => {
    let s = sc();
    put(s, 0, C('T05'), { slot: 3 });
    const target = put(s, 0, C('T11'), { slot: 0 });
    expect(E.power(s, target)).toBe(7500);
    top(s, 0, [C('T17')]); // 判定：木門名場面
    top(s, 1, [BTR('T16'), BTR('T16')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'select', player: 0 });
    s = choose(s, [target]);
    expect(E.power(s, target)).toBe(8500);

    s = passUntil(s, 'clock'); // 結束回合 → 對手的回合
    expect(s.turnPlayer).toBe(1);
    expect(E.power(s, target)).toBe(8500); // 對手回合還在
    s = ok(s, { type: 'clock', player: 1, uid: null });
    s = passUntil(s, 'clock'); // 對手回合結束 → 回到自己
    expect(s.turnPlayer).toBe(0);
    expect(E.power(s, target)).toBe(7500);
  });

  it('T06 開戰的信號 仁菜：登場付①丟 1，撿回《音樂》角色、另一位 +1000；對手打出名場面時可以把自己放進能量區', () => {
    let s = sc();
    put(s, 0, C('T18'), 'stock');
    put(s, 0, C('T19'), 'hand');
    const back = put(s, 0, C('T07'), 'waiting');
    const mate = put(s, 0, C('T11'), { slot: 1 });
    const u = put(s, 0, C('T06'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    s = yes(s);
    expect(s.players[0].hand).toEqual([back]);
    expect(E.power(s, mate)).toBe(8000);

    s = oppTurn(sc());
    const nina = put(s, 0, C('T06'), { slot: 0 });
    put(s, 1, BTR('T03'), 'clock'); // 黃色
    const cx = put(s, 1, BTR('T11'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 1, uid: cx });
    expect(s.pending).toMatchObject({ kind: 'confirm', player: 0 });
    s = yes(s);
    expect(s.players[0].stock).toEqual([nina]);
  });

  it('T07 給初始的目擊者 桃香：攻擊時另一位《音樂》角色 +其他《音樂》×500；正面有對手時可以移到前列空格', () => {
    let s = sc();
    put(s, 0, C('T07'), { slot: 0 });
    const t = put(s, 0, C('T11'), { slot: 1 });
    put(s, 0, C('T01'), { slot: 3 });
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    s = choose(s, [t]);
    expect(E.power(s, t)).toBe(7000 + 1000);

    s = oppTurn(sc());
    const u = put(s, 0, C('T07'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 2 }); // 桃香的正面
    s = passUntil(s, 'confirm');
    s = yes(s);
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 1 });
    expect(s.players[0].stage[1]?.uid).toBe(u);

    s = oppTurn(sc());
    put(s, 0, C('T07'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 0 }); // 不在桃香的正面
    s = passUntil(s, 'attackDeclare');
    expect(s.pending).toMatchObject({ kind: 'attackDeclare', player: 1 });
  });

  it('T08 給初始的目擊者 昂：在前列中央 +2500；打倒對手時名場面區有名場面就可以把牌組上方 1 張放進能量區', () => {
    let s = sc();
    const side = put(s, 0, C('T08'), { slot: 0 });
    expect(E.power(s, side)).toBe(4000);
    const u = put(s, 0, C('T08'), { slot: 1 });
    expect(E.power(s, u)).toBe(6500);

    put(s, 0, C('T19'), 'climax');
    put(s, 1, BTR('T01'), { slot: 1 });
    top(s, 0, [C('T02'), C('T04')]); // 判定（沒有圖示）、之後放進能量區的 1 張
    top(s, 1, [BTR('T16'), BTR('T16'), BTR('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    s = yes(s);
    expect(s.players[0].stock).toHaveLength(2);
  });

  it('T09 開戰的信號 桃香：不能側打；CX 連動：打倒對手時看 4 張，Lv1 以上 1 張進手牌、1 張進能量', () => {
    let s = sc();
    put(s, 0, C('T09'), { slot: 1 });
    put(s, 1, BTR('T01'), { slot: 1 });
    s = passUntil(s, 'attackDeclare');
    const modes = E.legalActions(s).filter((a) => a.type === 'attack').map((a) => a.type === 'attack' && a.mode);
    expect(modes).toEqual(['front']);
    expect(E.apply(s, { type: 'attack', player: 0, slot: 1, mode: 'side' }).error).toBe('這張卡不能側打');

    put(s, 0, C('T17'), 'climax');
    const [, a, b, c, d] = top(s, 0, [C('T01'), C('T11'), C('T12'), C('T03'), C('T18')]);
    top(s, 1, [BTR('T16'), BTR('T16'), BTR('T15')]);
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    expect(s.pending).toMatchObject({ kind: 'select', max: 2, options: [a, b] }); // Lv0 與名場面不能選
    s = choose(s, [a!, b!]);
    s = ack(s);
    s = choose(s, [a!]); // 加到手牌
    expect(s.players[0].hand).toEqual([a]);
    expect(s.players[0].stock).toContain(b);
    expect(s.players[0].waiting).toEqual(expect.arrayContaining([c, d]));
  });

  it('T10 粉絲福利 RUPA：助太刀 +2000；使用時翻 1 張，《音樂》角色就拿 1 丟 1', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    const def = put(s, 0, C('T11'), { slot: 2 });
    put(s, 0, C('T13'), 'level');
    put(s, 0, C('T19'), 'stock');
    const bk = put(s, 0, C('T10'), 'hand');
    const junk = put(s, 0, C('T18'), 'hand');
    const [got] = top(s, 0, [C('T03')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 0, mode: 'front' });
    s = passUntil(s, 'counter');
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(9000);
    s = ack(s);
    s = choose(s, [junk]);
    expect(s.players[0].hand).toContain(got); // 攻擊結束後回合交給玩家 0，已經多抽了 1 張
    expect(s.players[0].waiting).toEqual(expect.arrayContaining([bk, junk]));
  });

  it('T11 告白 桃香：沒有效果，Lv1 攻擊力 7000', () => {
    const s = sc();
    expect(E.power(s, put(s, 0, C('T11'), { slot: 0 }))).toBe(7000);
  });

  it('T12 開戰的信號 智：其他後列《音樂》角色每張 +2500；登場時其他《音樂》4 張以上可以把休息室的《音樂》角色放進能量區', () => {
    let s = sc();
    const u = put(s, 0, C('T12'), { slot: 0 });
    put(s, 0, C('T01'), { slot: 3 });
    put(s, 0, C('T05'), { slot: 4 });
    expect(E.power(s, u)).toBe(5500 + 5000 + 500); // 後列 2 張＋智的 +500

    s = sc();
    for (const [i, id] of [C('T03'), C('T11'), C('T01'), C('T05')].entries()) put(s, 0, id, { slot: ([0, 1, 3, 4] as const)[i]! });
    put(s, 0, C('T13'), 'level');
    put(s, 0, C('T13'), 'level');
    put(s, 0, C('T19'), 'stock');
    const back = put(s, 0, C('T07'), 'waiting');
    const v = put(s, 0, C('T12'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: v, slot: 2 });
    s = yes(s);
    expect(s.players[0].stock).toEqual([back]);
  });

  it('T13 開戰的信號 昂：應援 前面的《TOGENASHI TOGEARI》+1500；起動：放到牌組下方，移動對手 1 張角色到空格', () => {
    let s = sc();
    const u = put(s, 0, C('T13'), { slot: 3 });
    const f = put(s, 0, C('T11'), { slot: 0 });
    expect(E.power(s, f)).toBe(8500);

    const victim = put(s, 1, BTR('T16'), { slot: 0 });
    s = ok(s, { type: 'activate', player: 0, uid: u, index: 1 });
    expect(s.pending).toMatchObject({ kind: 'chooseSlot', owner: 1, slots: [1, 2, 3, 4] });
    s = ok(s, { type: 'chooseSlot', player: 0, slot: 3 });
    expect(s.players[1].stage[3]?.uid).toBe(victim);
    expect(s.players[1].stage[0]).toBeNull();
    expect(s.players[0].deck.at(-1)).toBe(u);
  });

  it('T14 給初始的目擊者 仁菜：登場回 1 血並 +1500；CX 連動：付①把戰鬥對手放進傷害區，看對手牌組上方 1 張放上或下', () => {
    let s = sc();
    for (let i = 0; i < 3; i++) put(s, 0, C('T12'), 'level');
    put(s, 0, C('T19'), 'stock');
    put(s, 0, C('T19'), 'stock');
    const healed = put(s, 0, C('T02'), 'clock');
    const u = put(s, 0, C('T14'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    s = choose(s, [healed]);
    expect(s.players[0].waiting).toContain(healed);
    expect(E.power(s, u)).toBe(11000);

    s = sc();
    put(s, 0, C('T14'), { slot: 1 });
    put(s, 0, C('T18'), 'climax');
    put(s, 0, C('T19'), 'stock');
    const victim = put(s, 1, BTR('T01'), { slot: 1 });
    top(s, 0, [C('T02')]);
    const [, , , peek] = top(s, 1, [BTR('T16'), BTR('T16'), BTR('T15'), BTR('T11')]); // 魂傷 3，第 4 張是名場面
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    s = yes(s);
    expect(s.players[1].clock).toContain(victim);
    expect(s.pending).toMatchObject({ kind: 'select', player: 0, options: [peek] });
    s = choose(s, [peek!]); // 選＝放到最下面
    expect(s.players[1].deck.at(-1)).toBe(peek);
  });

  it('T15 給初始的目擊者 RUPA：登場看 X 張拿 1 張（不公開）；攻擊時丟 2 張，翻 7 張，每張名場面 1 點傷害', () => {
    let s = sc();
    for (let i = 0; i < 3; i++) put(s, 0, C('T12'), 'level');
    put(s, 0, C('T19'), 'stock');
    put(s, 0, C('T19'), 'stock');
    put(s, 0, C('T11'), { slot: 0 });
    put(s, 0, C('T03'), { slot: 1 });
    const looked = top(s, 0, [C('T01'), C('T04'), C('T06')]);
    const u = put(s, 0, C('T15'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 2 });
    expect(s.pending).toMatchObject({ kind: 'select', max: 1, shown: looked }); // X＝3（含她自己）
    s = choose(s, [looked[1]!]);
    expect(s.pending).toMatchObject({ kind: 'main', player: 0 }); // 不用給對手確認
    expect(s.players[0].hand).toEqual([looked[1]]);
    expect(s.players[0].waiting).toEqual(expect.arrayContaining([looked[0], looked[2]]));

    s = sc();
    put(s, 0, C('T15'), { slot: 0 });
    put(s, 0, C('T01'), 'hand');
    put(s, 0, C('T01'), 'hand');
    top(s, 0, [C('T17'), C('T03'), C('T18'), C('T03'), C('T04'), C('T04'), C('T05'), C('T02')]); // 7 張裡 2 張名場面；第 8 張是判定
    top(s, 1, [BTR('T16'), BTR('T16'), BTR('T15'), BTR('T15'), BTR('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(0);
    expect(s.players[1].clock).toHaveLength(2 + 3); // 效果 2 點＋直接攻擊魂傷 3
  });

  it('T16 竪起中指吧！：從牌組選 1 張名場面給對手確認後加到手牌', () => {
    let s = sc();
    put(s, 0, C('T13'), 'level');
    put(s, 0, C('T19'), 'stock');
    const ev = put(s, 0, C('T16'), 'hand');
    const cx = uidOf(s, 0, C('T18'), 'deck')!;
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    s = choose(s, [cx]);
    s = ack(s);
    expect(s.players[0].hand).toEqual([cx]);
    expect(s.players[0].waiting).toContain(ev);
  });

  it('T17～T19 名場面：攻擊力 +1000 魂傷 +1（木門）／魂傷 +2；木門判定可以撿回角色', () => {
    let s = sc();
    const u = put(s, 0, C('T11'), { slot: 0 });
    put(s, 0, C('T17'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([8000, 2]);
    s.players[0].climax = [];
    put(s, 0, C('T19'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([7000, 3]);

    s = sc();
    put(s, 0, C('T11'), { slot: 0 });
    const back = put(s, 0, C('T03'), 'waiting');
    top(s, 0, [C('T18')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'comeback', options: [back] });
  });
});

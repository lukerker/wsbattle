// 孤獨搖滾預組（BTR/W107）每張卡的情境測試：擺好場面 → 發動效果 → 檢查結果。
import { describe, expect, it } from 'vitest';
import { E, choose, ids, no, ok, oppTurn, order, pass, passUntil, put, scene, top, uidOf, yes } from './test-utils.ts';

const C = (n: string) => `BTR/W107-${n}`;
const BD = (n: string) => `BD/W125-${n}`;

describe('孤獨搖滾 BTR/W107', () => {
  it('T01 伊地知虹夏：應援（後列）前面的角色 +500；起動：付①丟名場面，休息室角色回手牌', () => {
    let s = scene();
    put(s, 0, C('T01'), { slot: 3 }); // 後列左 → 前列左、中
    const a = put(s, 0, C('T16'), { slot: 0 });
    const b = put(s, 0, C('T16'), { slot: 2 });
    expect(E.power(s, a)).toBe(6000);
    expect(E.power(s, b)).toBe(5500);

    s = scene();
    const src = put(s, 0, C('T01'), { slot: 3 });
    put(s, 0, C('T12'), 'stock'); // 付費用的能量（名場面，不會被當成角色撿回）
    put(s, 0, C('T11'), 'hand');
    const back = put(s, 0, C('T16'), 'waiting');
    s = ok(s, { type: 'activate', player: 0, uid: src, index: 1 });
    expect(s.players[0].hand).toEqual([back]);
    expect(s.players[0].stock).toHaveLength(0);
  });

  it('T02 樂團的領導者：黃色名場面放置時選 1 張角色 +1500；集中：翻 5 張，每有 1 張名場面可抽 1 張', () => {
    let s = scene();
    put(s, 0, C('T02'), { slot: 0 });
    const target = put(s, 0, C('T16'), { slot: 1 });
    put(s, 0, C('T03'), 'clock'); // 黃色，名場面的顏色條件
    const cx = put(s, 0, C('T11'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    expect(s.pending?.kind).toBe('select');
    s = choose(s, [target]);
    expect(E.power(s, target)).toBe(5500 + 1500 + 1000); // 名場面【永】+1000

    s = scene();
    const src = put(s, 0, C('T02'), { slot: 3 });
    put(s, 0, C('T03'), 'stock');
    top(s, 0, [C('T11'), C('T12'), C('T16'), C('T15'), C('T15')]);
    s = ok(s, { type: 'activate', player: 0, uid: src, index: 1 });
    expect(s.players[0].waiting).toHaveLength(6); // 能量 1＋翻開的 5 張
    s = yes(s);
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(2);
    expect(s.players[0].stage[3]!.state).toBe('rest');
  });

  it('T03 特別準備的道具：能量 3 張以下攻擊力 +2000', () => {
    const s = scene();
    const u = put(s, 0, C('T03'), { slot: 0 });
    for (const id of [C('T02'), C('T02'), C('T02')]) put(s, 0, id, 'stock');
    expect(E.power(s, u)).toBe(4000);
    put(s, 0, C('T02'), 'stock');
    expect(E.power(s, u)).toBe(2000);
  });

  it('T04 主奏吉他手：登場時每有 1 張《音樂》+500；CX 連動：攻擊時看 4 張拿 1 張《音樂》角色', () => {
    let s = scene();
    put(s, 0, C('T16'), { slot: 0 });
    put(s, 0, C('T01'), { slot: 3 });
    put(s, 0, C('T03'), 'level');
    const u = put(s, 0, C('T04'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    expect(E.power(s, u)).toBe(4500 + 3 * 500 + 500); // 3 張《音樂》＋後列虹夏應援 +500

    put(s, 0, C('T11'), 'climax');
    const [, pickMe] = top(s, 0, [C('T12'), C('T16'), C('T15'), C('T20'), C('T07')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    s = choose(s, [pickMe!]);
    expect(s.players[0].hand).toContain(pickMe);
  });

  it('T05 貝斯 山田涼：攻擊時其他《音樂》角色 +魂傷×1000；戰鬥中傷害被取消時可以回手牌', () => {
    let s = scene();
    const other = put(s, 0, C('T16'), { slot: 0 });
    put(s, 0, C('T05'), { slot: 1 });
    top(s, 0, [C('T15')]);
    top(s, 1, [BD('T01'), BD('T01'), BD('T01')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(E.power(s, other)).toBe(5500 + 1000);

    s = oppTurn(scene());
    const ryo = put(s, 0, C('T05'), { slot: 1 });
    put(s, 1, BD('T04'), { slot: 1 });
    top(s, 1, [BD('T01')]); // 判定
    top(s, 0, [C('T11')]); // 傷害翻到名場面 → 取消
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    expect(s.pending).toMatchObject({ kind: 'confirm', player: 0 });
    s = yes(s);
    expect(s.players[0].hand).toContain(ryo);
  });

  it('T06 音樂話題～：助太刀 2000（等級 1）；使用時公開牌組最上面，《音樂》角色就加到手牌再丟 1 張', () => {
    let s = oppTurn(scene());
    const def = put(s, 0, C('T16'), { slot: 1 });
    const att = put(s, 1, BD('T04'), { slot: 1 }); // 6000
    put(s, 0, C('T03'), 'level');
    put(s, 0, C('T12'), 'stock');
    const backup = put(s, 0, C('T06'), 'hand');
    top(s, 1, [BD('T01')]);
    top(s, 0, [C('T16'), C('T15')]); // 公開的那張：《音樂》角色
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    expect(s.pending).toEqual({ kind: 'counter', player: 0, options: [backup] });
    s = choose(s, [backup]);
    // 公開的卡加到手牌後，手牌只剩那張 → 自動丟掉
    expect(E.power(s, def)).toBe(7500);
    expect(s.players[0].waiting).toContain(backup);
    // 戰鬥：7500 對 6000，攻擊方倒置
    expect(s.players[1].stage[1]?.state ?? 'gone').not.toBe('stand');
    expect(att).toBeTruthy();
  });

  it('T07 鼓手 伊地知虹夏：應援 +1000', () => {
    const s = scene();
    put(s, 0, C('T07'), { slot: 4 }); // 後列右 → 前列中、右
    const a = put(s, 0, C('T16'), { slot: 2 });
    const b = put(s, 0, C('T16'), { slot: 0 });
    expect(E.power(s, a)).toBe(6500);
    expect(E.power(s, b)).toBe(5500);
  });

  it('T08 冷酷且孤高：自己的回合，其他《音樂》角色每有 1 張 +1500', () => {
    const s = scene();
    const u = put(s, 0, C('T08'), { slot: 0 });
    put(s, 0, C('T16'), { slot: 1 });
    put(s, 0, C('T15'), { slot: 2 });
    expect(E.power(s, u)).toBe(7000 + 3000);
    s.turnPlayer = 1;
    expect(E.power(s, u)).toBe(7000);
  });

  it('T09 山田涼：登場時可以丟 1 張手牌，從休息室撿回最多 2 張角色', () => {
    let s = scene();
    for (const id of [C('T02'), C('T03'), C('T05')]) put(s, 0, id, 'level');
    put(s, 0, C('T12'), 'stock');
    put(s, 0, C('T20'), 'stock');
    const u = put(s, 0, C('T09'), 'hand');
    put(s, 0, C('T15'), 'hand');
    const w1 = put(s, 0, C('T16'), 'waiting');
    const w2 = put(s, 0, C('T01'), 'waiting');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    s = yes(s); // 支付：手牌只剩 1 張 → 自動丟掉
    expect(s.pending).toMatchObject({ kind: 'select', max: 2 });
    s = choose(s, [w1, w2]);
    expect(s.players[0].hand.sort()).toEqual([w1, w2].sort());
  });

  it('T10 樂團名「團結Band」：從牌組選 1 張名場面加到手牌，然後洗牌', () => {
    let s = scene();
    put(s, 0, C('T03'), 'level');
    put(s, 0, C('T15'), 'stock');
    const ev = put(s, 0, C('T10'), 'hand');
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    expect(s.pending?.kind).toBe('select');
    if (s.pending?.kind !== 'select') return;
    const cx = s.pending.options[0]!;
    s = choose(s, [cx]);
    s = yes(s); // 對手確認公開的卡
    expect(ids(s, s.players[0].hand)).toEqual([E.cardOf(s, cx).id]);
    expect(E.cardOf(s, cx).type).toBe('climax');
    expect(s.players[0].waiting).toContain(ev);
  });

  it('T11 憧憬的樂團活動：全體 +1000、魂傷 +1；判定「選擇」：休息室有魂圖示的角色回手牌或能量區', () => {
    let s = scene();
    const u = put(s, 0, C('T16'), { slot: 1 });
    put(s, 0, C('T11'), 'climax');
    expect(E.power(s, u)).toBe(6500);
    expect(E.soul(s, u)).toBe(2);

    s = scene();
    put(s, 0, C('T16'), { slot: 1 });
    const soulChar = put(s, 0, C('T07'), 'waiting'); // 判定圖示：魂
    put(s, 0, C('T16'), 'waiting'); // 沒有判定圖示，不能選
    top(s, 0, [C('T11')]);
    top(s, 1, [BD('T01'), BD('T01'), BD('T01')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'choice', options: [soulChar] });
    s = ok(s, { type: 'choose', player: 0, uids: [soulChar], dest: 'stock' });
    expect(s.players[0].stock).toContain(soulChar);
  });

  it('T12 第一張的大合照／T20 史上最糟的藝人照：全體魂傷 +2', () => {
    for (const id of ['T12', 'T20']) {
      const s = scene();
      const u = put(s, 0, C('T16'), { slot: 1 });
      put(s, 0, C(id), 'climax');
      expect(E.soul(s, u)).toBe(3);
      expect(E.power(s, u)).toBe(5500);
    }
  });

  it('T13 樂團女子？：其他「主唱吉他手 喜多郁代」+1000、魂傷 +1；絆：丟 1 張手牌撿回郁代', () => {
    let s = scene();
    put(s, 0, C('T13'), { slot: 3 });
    const kita = put(s, 0, C('T16'), { slot: 0 });
    expect(E.power(s, kita)).toBe(6500);
    expect(E.soul(s, kita)).toBe(2);

    s = scene();
    const bocchi = put(s, 0, C('T13'), 'hand');
    put(s, 0, C('T15'), 'hand');
    const k = put(s, 0, C('T16'), 'waiting');
    s = ok(s, { type: 'playCharacter', player: 0, uid: bocchi, slot: 3 });
    s = yes(s);
    expect(s.players[0].hand).toEqual([k]);
  });

  it('T14 後藤一里：登場時看 3 張拿事件並丟 1 張；對手前列 1 張以下時，可以把費用 0 的前列角色送進休息室', () => {
    let s = scene();
    const bocchi = put(s, 0, C('T14'), 'hand');
    const keep = put(s, 0, C('T15'), 'hand');
    const [ev] = top(s, 0, [C('T10'), C('T16'), C('T01')]);
    const victim = put(s, 1, BD('T11'), { slot: 0 }); // 費用 0
    s = ok(s, { type: 'playCharacter', player: 0, uid: bocchi, slot: 1 });
    s = order(s, undefined, '事件'); // 兩個能力同時待機：先解決「看 3 張找事件」
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    s = choose(s, [ev!]);
    s = yes(s); // 對手確認
    s = choose(s, [keep]); // 加到手牌後要丟 1 張
    expect(s.players[0].hand).toEqual([ev]);
    expect(s.pending?.kind).toBe('confirm');
    s = yes(s);
    expect(s.players[1].waiting).toContain(victim);
  });

  it('T15 陽角 喜多郁代：戰鬥中倒置時，看 3 張拿 1 張名場面，再丟 1 張手牌', () => {
    let s = scene();
    put(s, 0, C('T15'), { slot: 1 }); // 2500
    put(s, 1, BD('T04'), { slot: 1 }); // 6000
    top(s, 1, [BD('T01')]);
    s = passUntil(s, 'attackDeclare');
    // 判定翻掉最上面 1 張後，接下來的 3 張裡放 1 張名場面
    const looked = top(s, 0, [C('T15'), C('T12'), C('T01')]);
    top(s, 0, [C('T16')]); // 判定用
    const extra = put(s, 0, C('T02'), 'hand');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    expect(s.pending).toMatchObject({ kind: 'select', options: [looked[1]] });
    s = choose(s, [looked[1]!]);
    s = yes(s); // 對手確認
    s = choose(s, [extra]);
    expect(s.players[0].hand).toEqual([looked[1]]);
  });

  it('T16 主唱吉他手 喜多郁代：沒有效果，Lv1 費用 0 攻擊 5500', () => {
    const s = scene();
    const u = put(s, 0, C('T16'), { slot: 0 });
    expect(E.power(s, u)).toBe(5500);
    expect(E.abilitiesOf(s, u).filter((a) => a.kind !== 'auto' || a.keyword?.id !== 'encore')).toHaveLength(0);
  });

  it('T17 高人氣 喜多郁代：其他角色 3 張以上 +2000；安可：丟 1 張手牌角色，橫置回原位', () => {
    let s = scene();
    const kita = put(s, 0, C('T17'), { slot: 1 });
    put(s, 0, C('T16'), { slot: 0 });
    put(s, 0, C('T01'), { slot: 3 });
    expect(E.power(s, kita)).toBe(5500 + 500); // 後列虹夏應援
    put(s, 0, C('T15'), { slot: 4 });
    expect(E.power(s, kita)).toBe(5500 + 500 + 2000);

    s = scene();
    const k = put(s, 0, C('T17'), { slot: 1 });
    put(s, 1, BD('T09'), { slot: 1 }); // 讓她被打倒：先放對手角色，再改成對手攻擊
    s = oppTurn(s);
    s.players[1].stage[1] = null;
    put(s, 1, BD('T06'), { slot: 1 }); // 9500
    put(s, 0, C('T16'), 'hand'); // 安可的費用
    top(s, 1, [BD('T01')]);
    top(s, 0, [C('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    // 倒置後自動放進休息室；能量不足 3 張，預設安可不列出 → 直接問卡上的安可
    expect(s.pending).toMatchObject({ kind: 'confirm', player: 0 });
    s = yes(s); // 卡上的安可：手牌角色只有 1 張 → 自動丟
    expect(s.players[0].stage[1]).toMatchObject({ uid: k });
  });

  it('T18 喜多郁代：其他角色 3 張以上 +3000；安可只能丟《音樂》角色', () => {
    const s = scene();
    const u = put(s, 0, C('T18'), { slot: 1 });
    for (const [id, slot] of [[C('T16'), 0], [C('T15'), 2], [C('T03'), 3]] as const) put(s, 0, id, { slot });
    expect(E.power(s, u)).toBe(10000);
    const encore = E.abilitiesOf(s, u).find((a) => a.keyword?.id === 'encore')!;
    expect(encore.cost?.[0]).toMatchObject({ kind: 'discard', selector: { filter: { trait: '音楽' } } });
  });

  it('T19 新的綽號 後藤一里：登場時可以回 1 血；攻擊時付①把對手休息室 1 張放到對手牌組最上面', () => {
    let s = scene();
    for (const id of [C('T15'), C('T17'), C('T18')]) put(s, 0, id, 'level');
    put(s, 0, C('T12'), 'stock');
    put(s, 0, C('T20'), 'stock');
    put(s, 0, C('T03'), 'stock');
    const healed = put(s, 0, C('T02'), 'clock');
    const u = put(s, 0, C('T19'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    s = yes(s);
    expect(s.players[0].waiting).toContain(healed);
    expect(s.players[0].clock).toHaveLength(0);

    const card = put(s, 1, BD('T19'), 'waiting');
    top(s, 0, [C('T16')]);
    top(s, 1, [BD('T01'), BD('T01'), BD('T01')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    s = yes(s); // 付①；對手休息室只有 1 張 → 自動選
    // 放到最上面之後，傷害第 1 張就是它（名場面 → 取消）
    expect(s.players[1].waiting).toContain(card);
    expect(s.players[1].clock).toHaveLength(0);
    void no;
    void pass;
    void uidOf;
  });
});

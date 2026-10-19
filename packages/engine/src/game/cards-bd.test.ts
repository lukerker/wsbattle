// Ave Mujica 預組（BD/W125）每張卡的情境測試。牌組在玩家 1，所以大多用 oppTurn() 讓玩家 1 當回合玩家。
import { describe, expect, it } from 'vitest';
import { E, choose, ok, oppTurn, order, passUntil, put, scene, top, yes } from './test-utils.ts';

const C = (n: string) => `BD/W125-${n}`;
const BTR = (n: string) => `BTR/W107-${n}`;
const GREEN = [C('T01'), C('T02'), C('T03')]; // 綠色，用來滿足顏色條件與等級

describe('Ave Mujica BD/W125', () => {
  it('T01 “Quaerere Lumina”Mortis：自己的回合 +3000；安可步驟開始時，其他前列沒有橫置的角色就可以付①把自己橫置', () => {
    let s = oppTurn(scene());
    const u = put(s, 1, C('T01'), { slot: 0 });
    expect(E.power(s, u)).toBe(4000);
    s.turnPlayer = 0;
    expect(E.power(s, u)).toBe(1000);
    s.turnPlayer = 1;
    put(s, 1, C('T04'), 'stock');
    s = passUntil(s, 'attackDeclare');
    s = passUntil(s, 'confirm');
    s = yes(s);
    expect(s.players[1].stock).toHaveLength(0);
    expect(s.players[1].stage[0]?.state).toBe('rest'); // 回合結束後輪到玩家 0，起立階段只讓玩家 0 的角色直立
  });

  it('T02 “Perdere Omnia”Oblivionis：登場時付①丟名場面撿回名場面；被 Lv0 打倒時對手回 1 血、打倒她的角色進傷害區', () => {
    let s = oppTurn(scene());
    const u = put(s, 1, C('T02'), 'hand');
    put(s, 1, C('T19'), 'hand');
    put(s, 1, C('T04'), 'stock');
    const want = put(s, 1, C('T07'), 'waiting');
    s = ok(s, { type: 'playCharacter', player: 1, uid: u, slot: 1 });
    s = yes(s);
    expect(s.pending?.kind).toBe('select'); // 休息室有 2 張名場面
    s = choose(s, [want]);
    expect(s.players[1].hand).toEqual([want]);

    s = scene(); // 玩家 0（孤獨搖滾）用 Lv0 角色正打
    put(s, 1, C('T02'), { slot: 1 });
    const att = put(s, 0, BTR('T15'), { slot: 1 }); // Lv0 2500
    const healed = put(s, 0, BTR('T02'), 'clock');
    top(s, 0, [BTR('T16')]);
    top(s, 1, [C('T01')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    s = yes(s); // 玩家 1 選擇發動
    expect(s.players[0].waiting).toContain(healed);
    expect(s.players[0].clock).toContain(att);
  });

  it('T03 “Perdere Omnia”Mortis：登場那回合 +3000；CX 連動：打倒對手時從牌組拿 1 張《音樂》角色，再選 1 張角色 +2000', () => {
    let s = oppTurn(scene());
    put(s, 1, C('T04'), 'level');
    const u = put(s, 1, C('T03'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 1, uid: u, slot: 1 });
    expect(E.power(s, u)).toBe(7000);

    put(s, 1, C('T07'), 'climax');
    const ally = put(s, 1, C('T10'), { slot: 0 });
    put(s, 1, C('T11'), { slot: 3 });
    put(s, 0, BTR('T15'), { slot: 1 }); // 2500，會被打倒
    top(s, 1, [C('T01')]);
    top(s, 0, [BTR('T16')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    if (s.pending?.kind === 'counter') s = ok(s, { type: 'pass', player: 0 });
    expect(s.pending).toMatchObject({ kind: 'select', player: 1, max: 1 }); // 從牌組選《音樂》角色
    if (s.pending?.kind !== 'select') return;
    const picked = s.pending.options[0]!;
    s = choose(s, [picked]);
    s = yes(s); // 對手確認
    expect(s.players[1].hand).toContain(picked);
    s = choose(s, [ally]);
    expect(E.power(s, ally)).toBe(1500 + 1000 + 500 + 1000 + 2000); // 能量 3 張以下、後列 Timoris、Choir、這次 +2000
  });

  it('T04 “Quaerere Lumina”Oblivionis：沒有效果，Lv1 攻擊 6000', () => {
    const s = scene();
    expect(E.power(s, put(s, 1, C('T04'), { slot: 0 }))).toBe(6000);
  });

  it('T05 “Veritas”Mortis：其他《音樂》角色每有 1 張 +1000；打倒對手時撿回 1 張《音樂》角色再丟 1 張', () => {
    let s = oppTurn(scene());
    const u = put(s, 1, C('T05'), { slot: 1 });
    put(s, 1, C('T01'), { slot: 0 });
    put(s, 1, C('T04'), { slot: 2 });
    expect(E.power(s, u)).toBe(8000);

    put(s, 0, BTR('T15'), { slot: 1 });
    const back = put(s, 1, C('T08'), 'waiting');
    top(s, 1, [C('T01')]);
    top(s, 0, [BTR('T16')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    if (s.pending?.kind === 'counter') s = ok(s, { type: 'pass', player: 0 });
    // 休息室只有 1 張《音樂》角色 → 自動；手牌只有那 1 張 → 自動丟
    expect(s.players[1].waiting).toContain(back);
    expect(s.players[1].hand).toHaveLength(0);
  });

  it('T06 “Veritas”Oblivionis：登場時《音樂》角色 +1500；登場那回合的安可步驟開始時付②給對手 2 點傷害', () => {
    let s = oppTurn(scene());
    for (const id of GREEN) put(s, 1, id, 'level');
    for (const id of [C('T08'), C('T08'), C('T08'), C('T08')]) put(s, 1, id, 'stock');
    put(s, 1, C('T11'), { slot: 3 });
    const u = put(s, 1, C('T06'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 1, uid: u, slot: 1 });
    s = choose(s, [u]);
    expect(E.power(s, u)).toBe(9500 + 500 + 1500);
    top(s, 0, [BTR('T15'), BTR('T16'), BTR('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'pass', player: 1 });
    const clock = s.players[0].clock.length;
    s = yes(s); // 付② → 2 點傷害
    expect(s.players[0].clock.length).toBe(clock + 2);
  });

  it('T07 Choir \'S\' Choir：全體 +1000、魂傷 +1；判定「寶」：此卡回手牌，可以把牌組最上面放進能量區', () => {
    let s = oppTurn(scene());
    const u = put(s, 1, C('T04'), { slot: 1 });
    put(s, 1, C('T07'), 'climax');
    expect(E.power(s, u)).toBe(7000);
    expect(E.soul(s, u)).toBe(2);

    s.players[1].climax = [];
    const [trig] = top(s, 1, [C('T07')]);
    top(s, 0, [BTR('T16'), BTR('T16'), BTR('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'yesno', reason: 'treasureStock' });
    s = yes(s);
    expect(s.players[1].hand).toContain(trig);
    expect(s.players[1].stock).toHaveLength(1);
  });

  it('T08 “Quaerere Lumina”Amoris：把自己放進休息室，讓《音樂》角色 +2000；集中', () => {
    let s = oppTurn(scene());
    const src = put(s, 1, C('T08'), { slot: 3 });
    const t = put(s, 1, C('T04'), { slot: 0 });
    s = ok(s, { type: 'activate', player: 1, uid: src, index: 0 });
    expect(E.power(s, t)).toBe(8000);
    expect(s.players[1].waiting).toContain(src);

    s = oppTurn(scene());
    const c = put(s, 1, C('T08'), { slot: 3 });
    put(s, 1, C('T04'), 'stock');
    top(s, 1, [C('T07'), C('T01'), C('T01'), C('T03'), C('T03')]);
    s = ok(s, { type: 'activate', player: 1, uid: c, index: 1 });
    s = yes(s);
    expect(s.players[1].hand).toHaveLength(1);
  });

  it('T09 “Quaerere Lumina”Doloris：「“Quaerere Lumina”Oblivionis」+1500 並得到安可；絆撿回 Oblivionis', () => {
    let s = oppTurn(scene());
    put(s, 1, C('T09'), { slot: 3 });
    const ob = put(s, 1, C('T04'), { slot: 0 });
    expect(E.power(s, ob)).toBe(7500);
    expect(E.abilitiesOf(s, ob).some((a) => a.keyword?.id === 'encore' && a.cost?.[0]?.kind === 'discard')).toBe(true);

    s = oppTurn(scene());
    const d = put(s, 1, C('T09'), 'hand');
    put(s, 1, C('T19'), 'hand');
    const back = put(s, 1, C('T04'), 'waiting');
    s = ok(s, { type: 'playCharacter', player: 1, uid: d, slot: 3 });
    s = yes(s);
    expect(s.players[1].hand).toEqual([back]);
  });

  it('T10 “Veritas”Doloris：能量 3 張以下 +1000；對手攻擊階段開始時可以移到前列空格', () => {
    let s = scene();
    const u = put(s, 1, C('T10'), { slot: 3 });
    expect(E.power(s, u)).toBe(2500);
    put(s, 0, BTR('T16'), { slot: 0 });
    s = passUntil(s, 'confirm');
    s = yes(s);
    expect(s.pending).toMatchObject({ kind: 'chooseSlot', player: 1 });
    s = ok(s, { type: 'chooseSlot', player: 1, slot: 2 });
    expect(s.players[1].stage[2]?.uid).toBe(u); // 移到我方前列左的正面
  });

  it('T10 “Veritas”Doloris：前列沒有空格時不問要不要發動', () => {
    let s = scene();
    put(s, 1, C('T10'), { slot: 3 });
    for (const [i, id] of [C('T01'), C('T02'), C('T03')].entries()) put(s, 1, id, { slot: i as 0 | 1 | 2 });
    put(s, 0, BTR('T16'), { slot: 0 });
    s = passUntil(s, 'attackDeclare');
    expect(s.pending).toMatchObject({ kind: 'attackDeclare', player: 0 });
  });

  it('T11 “Perdere Omnia”Timoris：其他《音樂》角色 +500；起動：付①丟 1 張、橫置，從牌組拿 1 張《音樂》角色', () => {
    let s = oppTurn(scene());
    const src = put(s, 1, C('T11'), { slot: 3 });
    const o = put(s, 1, C('T04'), { slot: 0 });
    expect(E.power(s, o)).toBe(6500);
    expect(E.power(s, src)).toBe(1500);
    put(s, 1, C('T19'), 'stock');
    put(s, 1, C('T18'), 'hand');
    s = ok(s, { type: 'activate', player: 1, uid: src, index: 1 });
    expect(s.pending?.kind).toBe('select');
    if (s.pending?.kind !== 'select') return;
    const card = s.pending.options[0]!;
    s = choose(s, [card]);
    expect(s.players[1].hand).toEqual([card]);
    expect(s.players[1].stage[3]?.state).toBe('rest');
  });

  it('T12 “Veritas”Amoris：自己回合 +1000；戰鬥中傷害沒被取消時可以放進能量區', () => {
    let s = scene();
    const u = put(s, 1, C('T12'), { slot: 1 });
    expect(E.power(s, u)).toBe(3500);
    put(s, 0, BTR('T16'), { slot: 1 });
    top(s, 0, [BTR('T15')]);
    top(s, 1, [C('T01')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    s = yes(s);
    expect(s.players[1].stock).toContain(u);
  });

  it('T13 “Perdere Omnia”Amoris：應援（前面角色的等級×500）；名場面階段開始時最多 2 張《音樂》角色 +1500', () => {
    let s = oppTurn(scene());
    put(s, 1, C('T13'), { slot: 3 });
    const lv1 = put(s, 1, C('T04'), { slot: 0 });
    const lv0 = put(s, 1, C('T01'), { slot: 1 });
    expect(E.power(s, lv1)).toBe(6500);
    expect(E.power(s, lv0)).toBe(4000);
    s = passUntil(s, 'select');
    s = choose(s, [lv1, lv0]);
    expect(E.power(s, lv1)).toBe(8000);
  });

  it('T14 “Veritas”Timoris：助太刀 3000（等級 2）；使用時，被打倒的攻擊角色改放進回憶區', () => {
    let s = scene();
    const def = put(s, 1, C('T04'), { slot: 1 }); // 6000
    const att = put(s, 0, BTR('T09'), { slot: 1 }); // 10000 → 6000+3000 擋不住…改用 7000 的
    s.players[0].stage[1] = null;
    s.players[0].deck.push(att);
    const att2 = put(s, 0, BTR('T08'), { slot: 1 }); // 7000（自己回合：其他《音樂》每張 +1500，這裡沒有）
    put(s, 1, C('T01'), 'level');
    put(s, 1, C('T02'), 'level');
    put(s, 1, C('T19'), 'stock');
    const backup = put(s, 1, C('T14'), 'hand');
    top(s, 0, [BTR('T16')]);
    top(s, 1, [C('T01')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    s = choose(s, [backup]); // 6000+3000 擋下 7000 → 攻擊角色倒置 → 放進回憶區
    expect(s.players[1].stage[1]?.uid).toBe(def);
    expect(s.players[0].memory).toContain(att2);
  });

  it('T15 “Quaerere Lumina”Timoris：登場那回合 +6000；打倒對手時橫置其他直立的《音樂》角色，牌組最上面放進能量區', () => {
    let s = oppTurn(scene());
    put(s, 1, C('T08'), 'level'); // 紅色
    put(s, 1, C('T09'), 'level');
    put(s, 1, C('T19'), 'stock');
    const back = put(s, 1, C('T11'), { slot: 3 });
    const u = put(s, 1, C('T15'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 1, uid: u, slot: 1 });
    expect(E.power(s, u)).toBe(5000 + 6000 + 500);
    put(s, 0, BTR('T16'), { slot: 1 });
    top(s, 1, [C('T01')]);
    top(s, 0, [BTR('T15'), BTR('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    if (s.pending?.kind === 'counter') s = ok(s, { type: 'pass', player: 0 });
    const stock = s.players[1].stock.length;
    s = yes(s); // 只有後列 Timoris 可以橫置 → 自動
    expect(s.players[1].stage[3]).toMatchObject({ uid: back, state: 'rest' });
    expect(s.players[1].stock.length).toBe(stock + 1);
  });

  it('T16 “Perdere Omnia”Doloris：登場時回 1 血、可付①把對手休息室的角色放到對手空格；CX 連動：付①丟 1 張，1 點傷害並把戰鬥對手放進傷害區', () => {
    let s = oppTurn(scene());
    for (const id of [C('T08'), C('T09'), C('T10')]) put(s, 1, id, 'level'); // 紅色
    for (const id of [C('T01'), C('T01'), C('T01'), C('T01')]) put(s, 1, id, 'stock');
    const healed = put(s, 1, C('T03'), 'clock');
    const victim = put(s, 0, BTR('T15'), 'waiting');
    const u = put(s, 1, C('T16'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 1, uid: u, slot: 1 });
    s = choose(s, [healed]); // 傷害區上方「最多」1 張 → 由玩家決定
    expect(s.players[1].waiting).toContain(healed);
    s = yes(s); // 付①；對手休息室只有 1 張角色 → 自動
    expect(s.pending).toMatchObject({ kind: 'chooseSlot' });
    s = ok(s, { type: 'chooseSlot', player: 1, slot: 1 });
    expect(s.players[0].stage[1]?.uid).toBe(victim);

    put(s, 1, C('T18'), 'climax');
    put(s, 1, C('T11'), { slot: 3 });
    put(s, 1, C('T12'), { slot: 0 });
    put(s, 1, C('T05'), 'hand');
    top(s, 1, [C('T02')]); // 判定：沒有圖示
    top(s, 0, [BTR('T16'), BTR('T16'), BTR('T15'), BTR('T01')]); // 魂傷 3 的傷害＋連動的 1 點，都不是名場面
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    if (s.pending?.kind === 'counter') s = ok(s, { type: 'pass', player: 0 });
    const clock = s.players[0].clock.length;
    s = yes(s); // 付①、丟手牌（只有 1 張）→ 1 點傷害 → 戰鬥對手進傷害區
    expect(s.players[0].clock).toContain(victim);
    expect(s.players[0].clock.length).toBe(clock + 2);
  });

  it('T16 CX 連動：傷害被取消，但戰鬥對手放進傷害區剛好 7 張 → 對手要升級', () => {
    let s = oppTurn(scene());
    for (const id of [C('T08'), C('T09'), C('T10')]) put(s, 1, id, 'level');
    for (const id of [C('T01'), C('T01'), C('T01'), C('T01')]) put(s, 1, id, 'stock');
    put(s, 1, C('T16'), { slot: 1 });
    const victim = put(s, 0, BTR('T15'), { slot: 1 });
    for (const id of [BTR('T03'), BTR('T04'), BTR('T05')]) put(s, 0, id, 'clock');
    put(s, 1, C('T18'), 'climax');
    put(s, 1, C('T11'), { slot: 3 });
    put(s, 1, C('T12'), { slot: 0 });
    put(s, 1, C('T05'), 'hand');
    top(s, 1, [C('T02')]);
    top(s, 0, [BTR('T16'), BTR('T16'), BTR('T18'), BTR('T11')]); // 魂傷 3 進傷害區（共 6 張），連動的 1 點翻到名場面 → 取消
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    if (s.pending?.kind === 'counter') s = ok(s, { type: 'pass', player: 0 });
    expect(s.players[0].clock.length).toBe(6);
    s = yes(s);
    expect(s.players[0].clock.length).toBe(7);
    expect(s.pending).toMatchObject({ kind: 'levelUp', player: 0 });
    expect(s.pending?.kind === 'levelUp' && s.pending.options).toContain(victim);
  });

  it('T17 雙月 ~Deep Into The Forest~：不需滿足顏色條件；給予「打倒對手時看 2 張拿最多 2 張《音樂》角色」', () => {
    let s = oppTurn(scene());
    put(s, 1, C('T01'), 'level'); // 綠色：紅色事件本來不能打
    const ev = put(s, 1, C('T17'), 'hand');
    const att = put(s, 1, C('T04'), { slot: 1 });
    expect(E.playProblem(s, 1, ev)).toBeNull();
    s = ok(s, { type: 'playEvent', player: 1, uid: ev });
    expect(s.players[1].waiting).toContain(ev);

    put(s, 0, BTR('T15'), { slot: 1 });
    top(s, 1, [C('T01')]);
    s = passUntil(s, 'attackDeclare');
    const looked = top(s, 1, [C('T03'), C('T05')]);
    top(s, 1, [C('T01')]);
    top(s, 0, [BTR('T16')]);
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    if (s.pending?.kind === 'counter') s = ok(s, { type: 'pass', player: 0 });
    s = order(s, att);
    expect(s.pending).toMatchObject({ kind: 'select', max: 2 });
    s = choose(s, looked);
    expect(s.players[1].hand.sort()).toEqual([...looked].sort());
  });

  it('T18 黑色生日：全體 +1000、魂傷 +1；判定「歸」：從休息室撿回 1 張角色', () => {
    let s = oppTurn(scene());
    put(s, 1, C('T04'), { slot: 1 });
    const back = put(s, 1, C('T05'), 'waiting');
    top(s, 1, [C('T18')]);
    top(s, 0, [BTR('T16'), BTR('T16'), BTR('T15')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'comeback' });
    s = ok(s, { type: 'choose', player: 1, uids: [back] });
    expect(s.players[1].hand).toContain(back);
  });

  it('T19 神明，笨蛋：全體魂傷 +2', () => {
    const s = scene();
    const u = put(s, 1, C('T04'), { slot: 1 });
    put(s, 1, C('T19'), 'climax');
    expect(E.soul(s, u)).toBe(3);
  });
});

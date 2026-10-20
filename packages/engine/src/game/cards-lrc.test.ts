// 莉可麗絲預組（LRC/W105）每張卡的情境測試。牌組在玩家 0；對手（玩家 1）用孤獨搖滾預組。
import { describe, expect, it } from 'vitest';
import type { GameState } from './types.ts';
import { DECKS, E, LRC_DECK, choose, no, ok, oppTurn, order, pass, passUntil, put, scene, top, uidOf, yes } from './test-utils.ts';

const C = (n: string) => `LRC/W105-${n}`;
const BTR = (n: string) => `BTR/W107-${n}`;
const sc = () => scene(11, [LRC_DECK, DECKS[0]]);
const levels = (s: GameState, n: number) => { for (let i = 0; i < n; i++) put(s, 0, C(['T03', 'T05', 'T07'][i]!), 'level'); }; // 紅色，順便滿足顏色條件
const blueClock = (s: GameState) => put(s, 0, C('T13'), 'clock');
const skipCounter = (s: GameState) => (s.pending?.kind === 'counter' ? pass(s) : s);
const prompt = (s: GameState) => (s.pending && 'prompt' in s.pending ? s.pending.prompt : '');

describe('莉可麗絲 LRC/W105', () => {
  it('T01 一起去玩吧 千束：對手攻擊階段開始時可以移到前列空格', () => {
    let s = oppTurn(sc());
    const u = put(s, 0, C('T01'), { slot: 3 });
    put(s, 0, C('T06'), { slot: 1 });
    put(s, 0, C('T06'), { slot: 2 });
    put(s, 1, BTR('T16'), { slot: 0 });
    s = passUntil(s, 'confirm');
    expect(s.pending).toMatchObject({ player: 0 });
    s = yes(s); // 只有前列左一個空格 → 直接移過去
    expect(s.players[0].stage[0]?.uid).toBe(u);
    expect(s.players[0].stage[3]).toBeNull();
  });

  it('T01 一起去玩吧 千束：進休息室時付①並把牌組上方 1 張放到傷害區，撿回 1 張角色', () => {
    let s = oppTurn(sc());
    const u = put(s, 0, C('T01'), { slot: 1 });
    put(s, 0, C('T10'), 'stock'); // 付掉後進休息室的是名場面，不會變成候選
    const back = put(s, 0, C('T06'), 'waiting');
    put(s, 1, BTR('T16'), { slot: 1 });
    top(s, 1, [BTR('T16')]); // 對手的判定
    const [dmg, cost] = top(s, 0, [C('T13'), C('T14')]); // 第 1 張是攻擊傷害，第 2 張是費用
    s = passUntil(s, 'confirm');
    s = no(s); // 不移動（前列已經有她）
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    s = skipCounter(s);
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('一起去玩吧 千束');
    s = yes(s);
    expect(s.players[0].clock).toEqual([dmg, cost]);
    expect(s.pending).toMatchObject({ kind: 'select', options: expect.arrayContaining([u, back]) });
    s = choose(s, [back]);
    expect(s.players[0].hand).toContain(back);
  });

  it('T02 接送 瑞希：登場時付①丟 1 張，從牌組找 1 張《莉可莉可》角色', () => {
    let s = sc();
    put(s, 0, C('T10'), 'stock');
    const u = put(s, 0, C('T02'), 'hand');
    const junk = put(s, 0, C('T19'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 0 });
    s = yes(s);
    expect(s.players[0].waiting).toContain(junk);
    expect(s.pending).toMatchObject({ kind: 'select', max: 1 });
    const opts = s.pending?.kind === 'select' ? s.pending.options : [];
    expect(opts.every((o) => E.cardOf(s, o).type === 'character')).toBe(true);
    const want = opts.find((o) => s.cards[o]!.cardId === C('T17'))!;
    s = choose(s, [want]);
    expect(s.pending).toMatchObject({ kind: 'acknowledge', player: 1, timeout: 10 }); // 給對手確認：10 秒沒按就自動確認
    s = yes(s); // 對手確認
    expect(s.players[0].hand).toEqual([want]);
  });

  it('T03 瑞希（夏威夷）：登場丟 1 張名場面＋其他 1 張舞台角色，撿回名場面；被送走的接送 瑞希會觸發「進休息室時」', () => {
    let s = sc();
    const mizuki = put(s, 0, C('T02'), { slot: 0 });
    put(s, 0, C('T10'), 'stock');
    put(s, 0, C('T13'), 'hand'); // 給接送 瑞希丟的
    const cx = put(s, 0, C('T10'), 'hand');
    const want = put(s, 0, C('T19'), 'waiting');
    const u = put(s, 0, C('T03'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    s = yes(s); // 費用：名場面只有 1 張、其他角色只有接送 瑞希 → 自動
    expect(s.players[0].waiting).toEqual(expect.arrayContaining([cx, mizuki]));
    expect(s.players[0].stage[1]?.uid).toBe(u); // 自己不會被當成費用
    expect(s.pending).toMatchObject({ kind: 'select', options: expect.arrayContaining([cx, want]) });
    s = choose(s, [want]);
    expect(s.players[0].hand).toContain(want);
    expect(prompt(s)).toContain('接送 瑞希'); // 接送 瑞希「從舞台被放到休息室時」
  });

  it('T04 我的生存方式 千束：放名場面時選 1 張角色 +1500', () => {
    let s = sc();
    put(s, 0, C('T04'), { slot: 0 });
    const target = put(s, 0, C('T06'), { slot: 1 });
    blueClock(s);
    const cx = put(s, 0, C('T20'), 'hand');
    s = passUntil(s, 'climax');
    s = ok(s, { type: 'playClimax', player: 0, uid: cx });
    s = choose(s, [target]);
    expect(E.power(s, target)).toBe(6000 + 1500);
  });

  it('T04 我的生存方式 千束：CX 連動「不會響起的心跳」：在前列且能量 4 張以下，撿回 1 張角色', () => {
    for (const [stock, fires] of [[4, true], [5, false]] as const) {
      let s = sc();
      const u = put(s, 0, C('T04'), { slot: 0 });
      for (let i = 0; i < stock; i++) put(s, 0, C(i < 4 ? 'T13' : 'T11'), 'stock');
      const back = put(s, 0, C('T07'), 'waiting');
      put(s, 0, C('T06'), 'clock');
      const cx = put(s, 0, C('T10'), 'hand');
      s = passUntil(s, 'climax');
      s = ok(s, { type: 'playClimax', player: 0, uid: cx });
      s = order(s, undefined, 'CX連動');
      if (!fires) {
        expect(prompt(s)).not.toContain('CX連動');
        continue;
      }
      expect(prompt(s)).toContain('CX連動');
      s = yes(s); // 休息室只有 1 張角色 → 自動選
      expect(s.players[0].hand).toContain(back);
      expect(s.players[0].stage[0]?.uid).toBe(u);
    }
  });

  it('T05 講究的咖啡 米卡：助太刀 +2500，用完放到回憶區', () => {
    let s = oppTurn(sc());
    put(s, 1, BTR('T16'), { slot: 0 });
    put(s, 1, BTR('T16'), { slot: 1 }); // 第 2 隻攻擊者：回合還沒結束，「那個回合中」的加成還在
    const def = put(s, 0, C('T06'), { slot: 2 });
    levels(s, 1);
    put(s, 0, C('T13'), 'stock');
    const bk = put(s, 0, C('T05'), 'hand');
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 0, mode: 'front' });
    s = passUntil(s, 'counter');
    expect(s.pending).toMatchObject({ options: [bk] });
    s = choose(s, [bk]);
    expect(E.power(s, def)).toBe(6000 + 2500);
    expect(s.players[0].memory).toEqual([bk]);
  });

  it('T06 一起生活 千束：沒有效果，Lv1 攻擊力 6000、魂傷 2', () => {
    const s = sc();
    const u = put(s, 0, C('T06'), { slot: 0 });
    expect([E.power(s, u), E.soul(s, u)]).toEqual([6000, 2]);
  });

  it('T07 美味又開心 千束：其他《莉可莉可》角色每 1 張 +1000；安可丟 1 張手牌角色', () => {
    const s = sc();
    const u = put(s, 0, C('T07'), { slot: 1 });
    expect(E.power(s, u)).toBe(6000);
    put(s, 0, C('T13'), { slot: 0 });
    put(s, 0, C('T02'), { slot: 4 });
    expect(E.power(s, u)).toBe(8000);
    const encore = E.abilitiesOf(s, u).find((a) => a.keyword?.id === 'encore')!;
    expect(encore.cost?.[0]).toMatchObject({ kind: 'discard', selector: { zone: 'hand', filter: { type: 'character' } } });
  });

  it('T08 夏威夷的迷彩服 千束：登場公開牌組上方 1 張，是角色或事件就可以給 1 點傷害，公開的卡放回原位', () => {
    for (const [revealed, hit] of [[C('T06'), true], [C('T09'), true], [C('T10'), false]] as const) {
      let s = sc();
      levels(s, 3);
      put(s, 0, C('T13'), 'stock');
      put(s, 0, C('T13'), 'stock');
      const [shown] = top(s, 0, [revealed]);
      const [dmg] = top(s, 1, [BTR('T16')]);
      const u = put(s, 0, C('T08'), 'hand');
      s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
      expect(s.pending).toMatchObject({ kind: 'acknowledge', cards: [shown], button: '放回牌組上方' });
      expect(s.pending).not.toHaveProperty('timeout'); // 自己看的公開結果不限時
      s = yes(s);
      expect(s.players[0].deck[0]).toBe(shown);
      if (!hit) {
        expect(s.pending?.kind).toBe('main');
        continue;
      }
      expect(prompt(s)).toContain('1 點傷害');
      s = yes(s);
      expect(s.players[1].clock).toEqual([dmg]);
    }
  });

  it('T08 夏威夷的迷彩服 千束：攻擊時把回憶區的「艾倫之子的證明」放到休息室，對手休息室 1 張放到對手牌組上方', () => {
    let s = sc();
    put(s, 0, C('T08'), { slot: 1 });
    const proof = put(s, 0, C('T09'), 'memory');
    const target = put(s, 1, BTR('T16'), 'waiting');
    top(s, 0, [C('T13')]); // 自己的判定
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    s = yes(s);
    expect(s.players[0].waiting).toContain(proof);
    expect(s.players[0].memory).toEqual([]);
    expect(s.players[1].clock[0]).toBe(target); // 放到上方的卡被直接攻擊的傷害翻到
  });

  it('T09 艾倫之子的證明：場上沒有《莉可莉可》角色不能用；從牌組拿 1 張名場面，用完放到回憶區', () => {
    let s = sc();
    levels(s, 1);
    put(s, 0, C('T13'), 'stock');
    const ev = put(s, 0, C('T09'), 'hand');
    expect(E.playProblem(s, 0, ev)).not.toBeNull();
    put(s, 0, C('T13'), { slot: 0 });
    expect(E.playProblem(s, 0, ev)).toBeNull();
    s = ok(s, { type: 'playEvent', player: 0, uid: ev });
    const opts = s.pending?.kind === 'select' ? s.pending.options : [];
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => E.cardOf(s, o).type === 'climax')).toBe(true);
    s = choose(s, [opts[0]!]);
    s = yes(s); // 對手確認
    expect(s.players[0].hand).toEqual([opts[0]]);
    expect(s.players[0].memory).toEqual([ev]);
    expect(s.players[0].waiting).not.toContain(ev);
  });

  it('T10 不會響起的心跳：攻擊力 +1000、魂傷 +1；判定翻到時可以撿回休息室的角色', () => {
    let s = sc();
    const u = put(s, 0, C('T06'), { slot: 0 });
    put(s, 0, C('T10'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([7000, 3]);

    s = sc();
    put(s, 0, C('T06'), { slot: 0 });
    const back = put(s, 0, C('T13'), 'waiting');
    top(s, 0, [C('T10')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'comeback', options: [back] });
  });

  it('T11 良好的變化 瀧奈：後列時，其他角色進休息室可以讓她自己進休息室，把那張角色橫置放回原位', () => {
    let s = oppTurn(sc());
    const chisato = put(s, 0, C('T06'), { slot: 1 });
    const takina = put(s, 0, C('T11'), { slot: 3 });
    put(s, 1, BTR('T09'), { slot: 1 }); // 10000
    top(s, 1, [BTR('T16')]);
    top(s, 0, [C('T13'), C('T13')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    s = skipCounter(s);
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('良好的變化 瀧奈');
    s = yes(s);
    expect(s.players[0].stage[1]?.uid).toBe(chisato); // 橫置放回；之後回到自己的回合起立階段又直立了
    expect(s.players[0].waiting).toContain(takina);
    expect(s.players[0].stage[3]).toBeNull();
  });

  it('T11 良好的變化 瀧奈：前列時不會發動', () => {
    let s = oppTurn(sc());
    put(s, 0, C('T06'), { slot: 1 });
    put(s, 0, C('T11'), { slot: 2 });
    put(s, 1, BTR('T09'), { slot: 1 });
    top(s, 1, [BTR('T16')]);
    top(s, 0, [C('T13'), C('T13')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    s = skipCounter(s);
    for (let i = 0; i < 10 && s.turnPlayer === 1; i++) {
      expect(prompt(s)).not.toContain('良好的變化 瀧奈');
      s = pass(s);
    }
  });

  it('T11 良好的變化 瀧奈：集中', () => {
    let s = sc();
    const src = put(s, 0, C('T11'), { slot: 3 });
    put(s, 0, C('T13'), 'stock');
    top(s, 0, [C('T10'), C('T06'), C('T06'), C('T13'), C('T19')]);
    s = ok(s, { type: 'activate', player: 0, uid: src, index: 1 });
    expect(s.pending).toMatchObject({ kind: 'acknowledge', player: 0, button: '抽 2 張' });
    s = yes(s);
    expect(s.players[0].hand).toHaveLength(2);
  });

  it('T12 共同生活 瀧奈：其他「一起生活 千束」+1500 並得到安可；絆：撿回「一起生活 千束」', () => {
    let s = sc();
    const chisato = put(s, 0, C('T06'), { slot: 0 });
    expect(E.abilitiesOf(s, chisato).some((a) => a.keyword?.id === 'encore')).toBe(false);
    put(s, 0, C('T12'), { slot: 1 }); // 前列也有效
    expect(E.power(s, chisato)).toBe(7500);
    expect(E.abilitiesOf(s, chisato).find((a) => a.keyword?.id === 'encore')?.cost?.[0]).toMatchObject({ kind: 'discard', selector: { filter: { type: 'character' } } });

    s = sc();
    put(s, 0, C('T19'), 'hand');
    const back = put(s, 0, C('T06'), 'waiting');
    const u = put(s, 0, C('T12'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 3 });
    s = yes(s);
    expect(s.players[0].hand).toEqual([back]);
  });

  it('T12 共同生活 瀧奈：被打倒的「一起生活 千束」可以用給予的安可回到原位', () => {
    let s = oppTurn(sc());
    const chisato = put(s, 0, C('T06'), { slot: 1 });
    put(s, 0, C('T12'), { slot: 3 });
    put(s, 0, C('T13'), 'hand'); // 安可的費用
    put(s, 1, BTR('T09'), { slot: 1 }); // 10000 > 7500
    top(s, 1, [BTR('T16')]);
    top(s, 0, [C('T13'), C('T13')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 1, slot: 1, mode: 'front' });
    s = skipCounter(s);
    s = passUntil(s, 'confirm');
    expect(prompt(s)).toContain('安可');
    s = yes(s);
    expect(s.players[0].stage[1]?.uid).toBe(chisato);
  });

  it('T13 謎團重重的駭客 胡桃：能量 2 張以下 +1500', () => {
    const s = sc();
    const u = put(s, 0, C('T13'), { slot: 0 });
    put(s, 0, C('T10'), 'stock');
    put(s, 0, C('T10'), 'stock');
    expect(E.power(s, u)).toBe(4000);
    put(s, 0, C('T10'), 'stock');
    expect(E.power(s, u)).toBe(2500);
  });

  it('T14 一起去玩吧 瀧奈：登場時每有 1 張角色 +500；攻擊時正面是 Lv2 就 +6000', () => {
    let s = sc();
    levels(s, 1);
    blueClock(s);
    put(s, 0, C('T13'), { slot: 0 });
    put(s, 0, C('T06'), { slot: 1 });
    const u = put(s, 0, C('T14'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 2 });
    expect(E.power(s, u)).toBe(4000 + 3 * 500);

    for (const [opp, bonus] of [[BTR('T07'), 6000], [BTR('T16'), 0]] as const) {
      s = sc();
      const t = put(s, 0, C('T14'), { slot: 1 });
      put(s, 0, C('T13'), { slot: 0 }); // 第 2 隻攻擊者：讓回合不會馬上結束
      put(s, 1, opp, { slot: 1 });
      top(s, 0, [C('T13')]);
      s = passUntil(s, 'attackDeclare');
      s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
      expect(E.power(s, t)).toBe(4000 + bonus);
    }
  });

  it('T15 為了拯救夥伴 胡桃：應援 +等級×500；起動：看自己牌組上方 1 張，放上方或下方', () => {
    let s = sc();
    const src = put(s, 0, C('T15'), { slot: 3 });
    const lv0 = put(s, 0, C('T11'), { slot: 0 });
    const lv1 = put(s, 0, C('T06'), { slot: 1 });
    expect([E.power(s, lv0), E.power(s, lv1)]).toEqual([500, 6500]);

    const [t] = top(s, 0, [C('T10')]);
    s = ok(s, { type: 'activate', player: 0, uid: src, index: 1 });
    expect(s.pending).toMatchObject({ kind: 'select', options: [t], shown: [t] });
    expect(prompt(s)).toContain('自己牌組');
    s = choose(s, [t!]);
    expect(s.players[0].deck.at(-1)).toBe(t);
    expect(s.players[0].stage[3]?.state).toBe('rest');
  });

  it('T16 為了拯救夥伴 瀧奈：攻擊時對手每有 1 張角色 +2000', () => {
    let s = sc();
    const u = put(s, 0, C('T16'), { slot: 1 });
    put(s, 0, C('T13'), { slot: 0 }); // 第 2 隻攻擊者
    put(s, 1, BTR('T01'), { slot: 1 });
    put(s, 1, BTR('T01'), { slot: 3 });
    put(s, 1, BTR('T13'), { slot: 4 });
    top(s, 0, [C('T13')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'front' });
    expect(E.power(s, u)).toBe(4500 + 3 * 2000);
  });

  it('T17 莉可麗絲 瀧奈＆千束：登場丟 1 張，傷害區上方 1 張放到能量區；CX 連動：攻擊時付②給 2 點傷害', () => {
    let s = sc();
    levels(s, 3);
    put(s, 0, C('T10'), 'stock');
    put(s, 0, C('T10'), 'stock');
    put(s, 0, C('T13'), 'clock');
    const healed = put(s, 0, C('T16'), 'clock');
    put(s, 0, C('T19'), 'hand');
    const u = put(s, 0, C('T17'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    s = yes(s);
    expect(s.players[0].stock).toEqual([healed]);

    s = sc();
    put(s, 0, C('T17'), { slot: 1 });
    put(s, 0, C('T19'), 'climax');
    put(s, 0, C('T10'), 'stock');
    put(s, 0, C('T10'), 'stock');
    const [chk] = top(s, 0, [C('T13')]);
    const [a, b] = top(s, 1, [BTR('T16'), BTR('T16')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    expect(prompt(s)).toContain('CX連動');
    s = yes(s);
    expect(s.players[0].stock).toEqual([chk]); // 付掉 2 張；剩下的是判定翻到後放進能量區的卡
    expect(s.players[1].clock.slice(0, 2)).toEqual([a, b]);
  });

  it('T18 久違的重逢 瀧奈：登場看上方 X 張（X＝角色數）任選 1 張加到手牌（不用給對手看）；攻擊時丟 2 張給 1 點傷害', () => {
    let s = sc();
    levels(s, 3);
    blueClock(s);
    put(s, 0, C('T10'), 'stock');
    put(s, 0, C('T10'), 'stock');
    put(s, 0, C('T13'), { slot: 0 });
    put(s, 0, C('T06'), { slot: 2 });
    const looked = top(s, 0, [C('T19'), C('T07'), C('T09'), C('T20')]);
    const u = put(s, 0, C('T18'), 'hand');
    s = ok(s, { type: 'playCharacter', player: 0, uid: u, slot: 1 });
    expect(s.pending).toMatchObject({ kind: 'select', shown: looked.slice(0, 3), options: looked.slice(0, 3), max: 1 });
    s = choose(s, [looked[0]!]); // 名場面也可以拿
    expect(s.players[0].hand).toEqual([looked[0]]);
    expect(s.pending?.kind).toBe('main'); // 不用對手確認
    expect(s.players[0].waiting).toEqual(expect.arrayContaining(looked.slice(1, 3)));
    expect(s.players[0].deck[0]).toBe(looked[3]);

    s = sc();
    put(s, 0, C('T18'), { slot: 1 });
    put(s, 0, C('T13'), 'hand');
    put(s, 0, C('T13'), 'hand');
    top(s, 0, [C('T13')]);
    const [dmg] = top(s, 1, [BTR('T16')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 1, mode: 'direct' });
    s = yes(s); // 手牌剛好 2 張 → 自動丟
    expect(s.players[0].hand).toEqual([]);
    expect(s.players[1].clock[0]).toBe(dmg);
  });

  it('T19 齊心協力：攻擊力 +1000、魂傷 +1；判定翻到時（門）可以撿回休息室的名場面', () => {
    let s = sc();
    const u = put(s, 0, C('T06'), { slot: 0 });
    put(s, 0, C('T19'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([7000, 3]);

    s = sc();
    put(s, 0, C('T06'), { slot: 0 });
    const back = put(s, 0, C('T20'), 'waiting');
    top(s, 0, [C('T19')]);
    s = passUntil(s, 'attackDeclare');
    s = ok(s, { type: 'attack', player: 0, slot: 0, mode: 'direct' });
    expect(s.pending).toMatchObject({ kind: 'pick', reason: 'gate', options: [back] });
    expect(uidOf(s, 0, C('T19'), 'resolution')).toBeDefined();
  });

  it('T20 幫助有困難的人的工作：魂傷 +2', () => {
    const s = sc();
    const u = put(s, 0, C('T06'), { slot: 0 });
    put(s, 0, C('T20'), 'climax');
    expect([E.power(s, u), E.soul(s, u)]).toEqual([6000, 4]);
  });
});

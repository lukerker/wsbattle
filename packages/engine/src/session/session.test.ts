// 房間與大廳：建立、加入、觀戰、斷線重連、資訊過濾。用假連線測，不需要網路。
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Card } from '../card-schema.ts';
import * as bd from '../cards/bd-w125.ts';
import * as btr from '../cards/btr-w107.ts';
import type { Action, PlayerId } from '../game/types.ts';
import { RoomManager, type Conn } from './manager.ts';
import type { ClientMsg, ClientState, RoomInfo, ServerMsg } from './protocol.ts';
import { validateDeck } from './room.ts';
import { oppTurn, passUntil, put, scene } from '../game/test-utils.ts';

const db = new Map<string, Card>([...btr.cards, ...bd.cards].map((c) => [c.id, c]));
const list = (d: { cardId: string; count: number }[]) => d.flatMap((x) => Array<string>(x.count).fill(x.cardId));
const BTR_DECK = list(btr.deck);
const BD_DECK = list(bd.deck);

class FakeConn implements Conn {
  log: ServerMsg[] = [];
  closed = false;
  send(m: ServerMsg) { this.log.push(m); }
  close() { this.closed = true; }
  last<T extends ServerMsg['t']>(t: T) {
    for (let i = this.log.length - 1; i >= 0; i--) if (this.log[i]!.t === t) return this.log[i] as Extract<ServerMsg, { t: T }>;
    return undefined;
  }
  get state(): ClientState | undefined { return this.last('state')?.state; }
  get room(): RoomInfo | undefined { return this.last('room')?.info; }
  get error(): string | undefined { return this.last('error')?.message; }
}

// devId 只允許英數字，所以中文名字要轉成固定的英數字識別碼（同名＝同一個帳號）
const idFor = (name: string) => 'u' + [...name].map((c) => c.charCodeAt(0).toString(36)).join('');
async function login(m: RoomManager, name: string, devId = idFor(name)) {
  const c = new FakeConn();
  m.connect(c);
  await m.message(c, { t: 'hello', name, devId });
  return c;
}
const send = (m: RoomManager, c: Conn, msg: ClientMsg) => m.message(c, msg);

// 兩個玩家進房（還沒開始）
async function seatBoth(m = new RoomManager(db)) {
  const a = await login(m, '路可');
  const b = await login(m, '小祥');
  await send(m, a, { t: 'create', deck: BTR_DECK, deckName: '孤獨搖滾預組', allowSpectators: true, maxSpectators: 2 });
  const code = a.room!.code;
  await send(m, b, { t: 'join', code, role: 'player', deck: BD_DECK, deckName: 'Ave Mujica 預組' });
  return { m, a, b, code };
}
// 兩個玩家進房、加入者準備、房主按開始
async function startGame(m = new RoomManager(db)) {
  const r = await seatBoth(m);
  await send(m, r.b, { t: 'ready', ready: true });
  await send(m, r.a, { t: 'start' });
  return r;
}

describe('牌組驗證', () => {
  it('預組可以用；張數、同名上限、名場面上限、不存在的卡都會被擋', () => {
    expect(validateDeck(db, BTR_DECK)).toBeNull();
    expect(validateDeck(db, BD_DECK)).toBeNull();
    expect(validateDeck(db, BTR_DECK.slice(1))).toMatch('50 張');
    expect(validateDeck(db, [...BTR_DECK.slice(1), 'BTR/W107-T01'])).toBeNull(); // 換成同樣的卡，張數不變
    expect(validateDeck(db, [...BTR_DECK.slice(0, 49), 'XXX/000'])).toMatch('找不到');
    const fiveSame = [...Array(5).fill('BTR/W107-T16'), ...BTR_DECK.filter((id) => id !== 'BTR/W107-T16').slice(0, 45)];
    expect(validateDeck(db, fiveSame)).toMatch('最多 4 張');
    const nineCx = [...Array(4).fill('BTR/W107-T11'), ...Array(4).fill('BTR/W107-T12'), ...Array(2).fill('BTR/W107-T20'), ...BTR_DECK.filter((id) => !id.match(/T1[12]|T20/)).slice(0, 40)];
    expect(validateDeck(db, nineCx)).toMatch('名場面最多 8 張');
  });
});

describe('登入', () => {
  it('測試登入要有識別碼；設定了驗證就一定要 token', async () => {
    const m = new RoomManager(db);
    const c = new FakeConn();
    m.connect(c);
    await m.message(c, { t: 'hello', name: 'x' });
    expect(c.error).toMatch('識別碼');
    await m.message(c, { t: 'hello', name: '路可', devId: 'u1' });
    expect(c.last('welcome')).toMatchObject({ name: '路可', dev: true });

    const m2 = new RoomManager(db, { verifyToken: async (t) => { if (t !== 'good') throw new Error('bad'); return { id: 'uid-1', name: '帳號名' }; } });
    const d = new FakeConn();
    m2.connect(d);
    await m2.message(d, { t: 'hello', devId: 'u1', name: '偽造' });
    expect(d.error).toMatch('登入');
    await m2.message(d, { t: 'hello', token: 'bad' });
    expect(d.error).toMatch('過期');
    await m2.message(d, { t: 'hello', token: 'good' });
    expect(d.last('welcome')).toMatchObject({ userId: 'uid-1', name: '帳號名', dev: false });
  });

  it('同一個帳號在別處登入，舊的連線被踢掉並把房間交給新連線', async () => {
    const { m, a, code } = await startGame();
    const a2 = new FakeConn();
    m.connect(a2);
    await m.message(a2, { t: 'hello', name: '路可', devId: idFor('路可') });
    expect(a.closed).toBe(true);
    expect(a.error).toMatch('其他地方');
    await send(m, a2, { t: 'rejoin', code });
    expect(a2.room?.you).toBe(0);
    expect(a2.state?.viewer).toBe(0);
  });
});

describe('建立與加入房間', () => {
  it('建立：6 位數字代碼；等第二位玩家時還沒有牌局', async () => {
    const m = new RoomManager(db);
    const a = await login(m, '路可');
    await send(m, a, { t: 'create', deck: BTR_DECK, deckName: '孤獨搖滾預組', allowSpectators: true, maxSpectators: 6 });
    expect(a.room).toMatchObject({ status: 'waiting', you: 0 });
    expect(a.room!.code).toMatch(/^\d{6}$/);
    expect(a.room!.seats[0]).toMatchObject({ name: '路可', series: 'BTR', online: true });
    expect(a.room!.seats[1]).toBeNull();
    expect(a.state).toBeUndefined();
  });

  it('加入後不會馬上開局：加入者按準備、房主按開始才開始', async () => {
    const { m, a, b } = await seatBoth();
    expect(a.room).toMatchObject({ status: 'waiting' });
    expect(a.room!.seats[0]).toMatchObject({ host: true, ready: false });
    expect(a.room!.seats[1]).toMatchObject({ host: false, ready: false });
    expect(a.state).toBeUndefined();
    await send(m, b, { t: 'start' });
    expect(b.error).toMatch('只有房主');
    await send(m, a, { t: 'start' });
    expect(a.error).toMatch('還沒準備');
    await send(m, a, { t: 'ready', ready: true });
    expect(a.error).toMatch('房主不用準備');
    await send(m, b, { t: 'ready', ready: true });
    expect(a.room!.seats[1]).toMatchObject({ ready: true });
    // 加入者換牌組：要重新準備
    await send(m, b, { t: 'changeDeck', deck: BTR_DECK, deckName: '換成孤獨搖滾' });
    expect(a.room!.seats[1]).toMatchObject({ ready: false, series: 'BTR', deckName: '換成孤獨搖滾' });
    await send(m, b, { t: 'changeDeck', deck: BTR_DECK.slice(1), deckName: 'x' });
    expect(b.error).toMatch('50 張');
    await send(m, b, { t: 'ready', ready: true });
    await send(m, a, { t: 'start' });
    expect(a.room).toMatchObject({ status: 'playing' });
    expect(a.state!.viewer).toBe(0);
    await send(m, b, { t: 'changeDeck', deck: BD_DECK, deckName: 'x' });
    expect(b.error).toMatch('已經開始');
  });

  it('房主在開局前離開：留下的玩家變成房主', async () => {
    const { m, a, b } = await seatBoth();
    await send(m, b, { t: 'ready', ready: true });
    await send(m, a, { t: 'leave' });
    expect(b.room!.seats.find((x) => x)).toMatchObject({ name: '小祥', host: true, ready: false });
  });

  it('開局後雙方各收到自己的視角', async () => {
    const { a, b } = await startGame();
    expect(a.room).toMatchObject({ status: 'playing', you: 0 });
    expect(b.room).toMatchObject({ status: 'playing', you: 1 });
    expect(a.room!.seats[1]).toMatchObject({ name: '小祥', series: 'BD' });
    expect(a.state!.viewer).toBe(0);
    expect(b.state!.viewer).toBe(1);
  });

  it('錯誤：代碼不存在、座位已滿、牌組不合格、已經在房間裡', async () => {
    const { m, a, code } = await startGame();
    const c = await login(m, '小夜');
    await send(m, c, { t: 'join', code: '000000', role: 'player', deck: BD_DECK, deckName: 'x' });
    expect(c.error).toMatch('找不到');
    await send(m, c, { t: 'join', code, role: 'player', deck: BD_DECK, deckName: 'x' });
    expect(c.error).toMatch('座位已經滿了');
    await send(m, a, { t: 'create', deck: BTR_DECK, deckName: 'x', allowSpectators: false, maxSpectators: 0 });
    expect(a.error).toMatch('已經在一個房間');
    const d = await login(m, '祥子');
    await send(m, d, { t: 'create', deck: BTR_DECK.slice(1), deckName: 'x', allowSpectators: false, maxSpectators: 0 });
    expect(d.error).toMatch('50 張');
  });

  it('peek：加入前先看房間狀況', async () => {
    const { m, code } = await startGame();
    const c = await login(m, '小夜');
    await send(m, c, { t: 'peek', code });
    expect(c.last('peeked')).toMatchObject({ exists: true, info: { seatFree: false, spectatorsAllowed: true, hostName: '路可' } });
    await send(m, c, { t: 'peek', code: '999999' });
    expect(c.last('peeked')).toMatchObject({ exists: false });
  });
});

describe('觀戰', () => {
  it('同一組代碼可以觀戰；人數上限；關閉觀戰的房間不能進', async () => {
    const { m, a, code } = await startGame();
    const s1 = await login(m, '觀眾1');
    const s2 = await login(m, '觀眾2');
    const s3 = await login(m, '觀眾3');
    await send(m, s1, { t: 'join', code, role: 'spectator' });
    await send(m, s2, { t: 'join', code, role: 'spectator' });
    await send(m, s3, { t: 'join', code, role: 'spectator' });
    expect(s1.room?.you).toBe('spectator');
    expect(s3.error).toMatch('已滿');
    expect(a.room!.spectators.map((x) => x.name)).toEqual(['觀眾1', '觀眾2']);

    const m2 = new RoomManager(db);
    const h = await login(m2, '路可');
    await send(m2, h, { t: 'create', deck: BTR_DECK, deckName: 'x', allowSpectators: false, maxSpectators: 0 });
    const w = await login(m2, '觀眾');
    await send(m2, w, { t: 'join', code: h.room!.code, role: 'spectator' });
    expect(w.error).toMatch('不開放觀戰');
  });

  it('可以中途加入觀戰：進來就收到目前的盤面', async () => {
    const { m, a, b, code } = await startGame();
    await send(m, a, { t: 'action', action: { type: 'mulligan', player: 0, discard: [] } });
    await send(m, b, { t: 'action', action: { type: 'mulligan', player: 1, discard: [] } });
    const s = await login(m, '晚到的觀眾');
    await send(m, s, { t: 'join', code, role: 'spectator' });
    expect(s.room).toMatchObject({ you: 'spectator', status: 'playing' });
    expect(s.state!.viewer).toBe('spectator');
    expect(s.state!.waiting).toMatchObject({ kind: 'decideFirst' });
  });

  it('觀戰者看不到任何手牌，也不能操作', async () => {
    const { m, code } = await startGame();
    const s = await login(m, '觀眾');
    await send(m, s, { t: 'join', code, role: 'spectator' });
    const st = s.state!;
    expect(st.viewer).toBe('spectator');
    for (const p of [0, 1] as PlayerId[]) for (const u of st.view.players[p].hand) expect(st.view.cards[u]!.cardId).toBeNull();
    expect(st.mine).toBeNull();
    expect(st.legal).toEqual([]);
    await send(m, s, { t: 'action', action: { type: 'pass', player: 0 } });
    expect(s.error).toMatch('觀戰者不能操作');
  });
});

describe('操作與資訊過濾', () => {
  it('不能替對手操作；換牌雙方同時進行', async () => {
    const { m, a, b } = await startGame();
    expect(a.state!.mine).toMatchObject({ kind: 'mulligan' });
    expect(b.state!.mine).toMatchObject({ kind: 'mulligan' });
    await send(m, a, { t: 'action', action: { type: 'mulligan', player: 1, discard: [] } });
    expect(a.error).toMatch('不是你的動作');
    await send(m, b, { t: 'action', action: { type: 'mulligan', player: 1, discard: [] } });
    expect(a.state!.mine).toMatchObject({ kind: 'mulligan' }); // 對手換完了，我還沒
    expect(b.state!.mine).toBeNull();
    expect(b.state!.waiting).toMatchObject({ kind: 'mulligan', players: [0] });
    await send(m, a, { t: 'action', action: { type: 'mulligan', player: 0, discard: [] } });
    expect(b.state!.mine).toMatchObject({ kind: 'decideFirst' }); // 換完牌：雙方同時選先後攻的卡
    await send(m, a, { t: 'action', action: { type: 'pickFirst', player: 0, card: 1 } });
    expect(b.state!.view.firstPick).toEqual({ picks: [1, null] }); // 對手選了哪張，大家都看得到
    await send(m, b, { t: 'action', action: { type: 'pickFirst', player: 1, card: 1 } });
    expect(b.error).toBe('這張已經被對手選了');
    await send(m, b, { t: 'action', action: { type: 'pickFirst', player: 1, card: 0 } });
    expect(a.state!.view.turn).toBe(1);
  });

  it('自己的手牌看得到，對手的手牌、雙方的牌組與能量都是 null；收不到亂數狀態', async () => {
    const { a, b } = await startGame();
    for (const [c, me] of [[a, 0], [b, 1]] as [FakeConn, PlayerId][]) {
      const v = c.state!.view;
      const you = (1 - me) as PlayerId;
      expect(v.players[me].hand.every((u) => v.cards[u]!.cardId !== null)).toBe(true);
      expect(v.players[you].hand.every((u) => v.cards[u]!.cardId === null)).toBe(true);
      for (const p of [0, 1] as PlayerId[]) expect(v.players[p].deck.every((u) => v.cards[u]!.cardId === null)).toBe(true);
      expect(JSON.stringify(c.log)).not.toContain('"rng"');
      expect(JSON.stringify(c.log)).not.toContain('"queue"');
    }
  });
});

describe('限時的選擇', () => {
  afterEach(() => vi.useRealTimers());

  it('反擊步驟（助太刀）10 秒沒選就自動不使用；雙方都看得到剩餘時間', async () => {
    vi.useFakeTimers();
    const { m, a, b, code } = await startGame();
    const room = m.rooms.get(code)!;
    // 換成指定的局面：對手（玩家 1）正打，我（玩家 0）手上有助太刀
    let s = oppTurn(scene());
    put(s, 1, 'BD/W125-T06', { slot: 0 });
    put(s, 0, 'BTR/W107-T16', { slot: 2 });
    put(s, 0, 'BTR/W107-T01', 'level');
    put(s, 0, 'BTR/W107-T16', 'stock');
    put(s, 0, 'BTR/W107-T06', 'hand');
    s = passUntil(s, 'attackDeclare');
    room.game = s;
    await send(m, b, { t: 'action', action: { type: 'attack', player: 1, slot: 0, mode: 'front' } });
    expect(a.state!.mine).toMatchObject({ kind: 'counter', timeout: 10 });
    expect(a.state!.timerMs).toBe(10000);
    expect(b.state!.timerMs).toBe(10000);
    vi.advanceTimersByTime(9000);
    expect(room.game!.pending?.kind).toBe('counter');
    vi.advanceTimersByTime(1000);
    expect(room.game!.pending?.kind).not.toBe('counter');
    expect(a.state!.timerMs).toBeNull();
  });

  it('自己按了就取消計時，不會再代為執行', async () => {
    vi.useFakeTimers();
    const { m, a, b, code } = await startGame();
    const room = m.rooms.get(code)!;
    let s = oppTurn(scene());
    put(s, 1, 'BD/W125-T06', { slot: 0 });
    put(s, 0, 'BTR/W107-T16', { slot: 2 });
    put(s, 0, 'BTR/W107-T01', 'level');
    put(s, 0, 'BTR/W107-T16', 'stock');
    const backup = put(s, 0, 'BTR/W107-T06', 'hand');
    s = passUntil(s, 'attackDeclare');
    room.game = s;
    await send(m, b, { t: 'action', action: { type: 'attack', player: 1, slot: 0, mode: 'front' } });
    await send(m, a, { t: 'action', action: { type: 'choose', player: 0, uids: [backup] } });
    const n = room.record!.actions.length;
    vi.advanceTimersByTime(20000);
    expect(room.record!.actions.length).toBe(n);
  });
});

// 讓兩邊的伺服器連線一直做合法動作到分出勝負，並檢查每一則訊息都沒有洩漏隱藏資訊
async function playRandom(seed: number, spectator: boolean) {
  const { m, a, b, code } = await startGame();
  const conns: Record<PlayerId, FakeConn> = { 0: a, 1: b };
  const s = await login(m, '觀眾');
  if (spectator) await send(m, s, { t: 'join', code, role: 'spectator' });
  const room = m.rooms.get(code)!;
  let r = seed * 7919;
  const rand = (n: number) => { r = (r * 1103515245 + 12345) % 2147483648; return r % n; };
  let steps = 0;
  while (room.status === 'playing' && steps++ < 4000) {
    const g = room.game!;
    const pend = g.pending!;
    const seats: PlayerId[] = 'waiting' in pend ? pend.waiting : [pend.player];
    const seat = seats[rand(seats.length)]!;
    let action: Action;
    if (pend.kind === 'mulligan') action = { type: 'mulligan', player: seat, discard: [] };
    else if (pend.kind === 'decideFirst') action = { type: 'pickFirst', player: seat, card: g.firstPick!.picks[(1 - seat) as PlayerId] === 0 ? 1 : 0 };
    else {
      const legal = conns[seat].state!.legal; // 伺服器給這位玩家的合法動作
      expect(legal.length, `第 ${steps} 步沒有合法動作`).toBeGreaterThan(0);
      const pass = legal.find((x) => x.type === 'pass');
      action = (pass && rand(3) === 0 ? pass : legal[rand(legal.length)])!;
    }
    await send(m, conns[seat], { t: 'action', action });
    expect(conns[seat].error, JSON.stringify(action)).toBeUndefined();
    // 洩漏檢查：每個人收到的狀態裡，隱藏的卡一律是 null
    for (const [c, viewer] of [[a, 0], [b, 1], [s, 'spectator']] as [FakeConn, PlayerId | 'spectator'][]) {
      if (viewer === 'spectator' && !spectator) continue;
      const st = c.state!;
      for (const p of [0, 1] as PlayerId[]) {
        const pl = st.view.players[p];
        const mustHide = [...pl.deck, ...pl.stock, ...(viewer === p ? [] : pl.hand)];
        // 效果要他選的牌（看牌組上方 N 張）才可以揭露給本人
        const allowed = new Set<string>();
        if (st.mine?.kind === 'select') [...st.mine.options, ...(st.mine.shown ?? [])].forEach((u) => allowed.add(u));
        const now = room.game!.pending; // 動作之後的最新狀態
        if (now?.kind === 'acknowledge') now.cards.forEach((u) => allowed.add(u));
        for (const u of mustHide) if (!allowed.has(u)) expect(st.view.cards[u]!.cardId, `${viewer} 看到了 ${u}`).toBeNull();
      }
      if (viewer !== 'spectator') expect(st.mine === null || ('waiting' in st.mine ? st.mine.waiting.includes(viewer) : st.mine.player === viewer)).toBe(true);
    }
  }
  return { room, a, b, s };
}

describe('整局連線對打（隨機合法動作）', () => {
  it.each([1, 2, 3, 4, 5])('種子 %i：兩人加觀戰者打到分出勝負，全程沒有洩漏隱藏資訊', async (seed) => {
    const { room, a, b, s } = await playRandom(seed, true);
    expect(room.status).toBe('ended');
    expect(room.game!.winner).not.toBeNull();
    expect(a.state!.view.winner).toBe(room.game!.winner);
    expect(s.state!.view.winner).toBe(room.game!.winner);
    expect(a.room!.status).toBe('ended');
    expect(room.record!.actions.length).toBeGreaterThan(50);
    void b;
  });
});

describe('斷線與離開', () => {
  it('斷線：對手看到離線；重新連上同一個帳號就接回原局', async () => {
    const { m, a, b, code } = await startGame();
    m.disconnect(a);
    expect(b.room!.seats[0]!.online).toBe(false);
    const a2 = await login(m, '路可');
    await send(m, a2, { t: 'rejoin', code });
    expect(a2.room).toMatchObject({ you: 0, status: 'playing' });
    expect(a2.state!.viewer).toBe(0);
    expect(b.room!.seats[0]!.online).toBe(true);
  });

  it('等待中離開：座位空出來、沒人了房間就刪掉；對局中離開視為投降', async () => {
    const m = new RoomManager(db);
    const a = await login(m, '路可');
    await send(m, a, { t: 'create', deck: BTR_DECK, deckName: 'x', allowSpectators: true, maxSpectators: 4 });
    const code = a.room!.code;
    await send(m, a, { t: 'leave' });
    expect(a.last('left')).toBeDefined();
    expect(m.rooms.has(code)).toBe(false);

    const { m: m2, a: a2, b: b2 } = await startGame();
    await send(m2, a2, { t: 'leave' });
    expect(b2.state!.view.winner).toBe(1);
    expect(b2.room!.status).toBe('ended');
  });

  it('沒人連線超過 30 分鐘的房間會被清掉', async () => {
    const { m, a, b, code } = await startGame();
    m.disconnect(a);
    m.disconnect(b);
    m.sweep(Date.now() + 29 * 60 * 1000);
    expect(m.rooms.has(code)).toBe(true);
    m.sweep(Date.now() + 31 * 60 * 1000);
    expect(m.rooms.has(code)).toBe(false);
  });
});

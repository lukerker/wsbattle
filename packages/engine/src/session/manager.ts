// 大廳與房間管理：不碰網路，用抽象的連線（Conn）收發訊息。伺服器把 WebSocket 包成 Conn，測試用假連線。
import type { Card } from '../card-schema.ts';
import { createEngine } from '../game/engine.ts';
import type { GameEvent } from '../game/types.ts';
import type { ClientMsg, RoomConfig, ServerMsg } from './protocol.ts';
import { GameRoom, type User } from './room.ts';

export interface Conn {
  send(msg: ServerMsg): void;
  close(): void;
}

interface Session {
  conn: Conn;
  user: User | null;
  code: string | null; // 目前所在的房間
}

const IDLE_ROOM_MS = 30 * 60 * 1000; // 房間沒人連線超過這麼久就作廢（待定）
const MAX_NAME = 16;

export interface ManagerOptions {
  // 驗證登入：回傳使用者，或丟出錯誤。沒設定就用測試登入（devId＋名稱）
  verifyToken?: (token: string) => Promise<User>;
}

export class RoomManager {
  readonly rooms = new Map<string, GameRoom>();
  private readonly sessions = new Map<Conn, Session>();
  private readonly byUser = new Map<string, Conn>(); // 每個使用者同時只有一條連線，新的取代舊的
  private readonly engine;
  private readonly db: ReadonlyMap<string, Card>;
  private readonly opts: ManagerOptions;

  constructor(db: ReadonlyMap<string, Card>, opts: ManagerOptions = {}) {
    this.db = db;
    this.opts = opts;
    this.engine = createEngine(db);
  }

  connect(conn: Conn) {
    this.sessions.set(conn, { conn, user: null, code: null });
  }

  disconnect(conn: Conn) {
    const s = this.sessions.get(conn);
    this.sessions.delete(conn);
    if (!s?.user) return;
    if (this.byUser.get(s.user.id) === conn) this.byUser.delete(s.user.id);
    const room = s.code ? this.rooms.get(s.code) : undefined;
    if (room && this.byUser.get(s.user.id) === undefined) {
      room.online.delete(s.user.id);
      room.touch();
      this.pushRoom(room); // 讓對手看到「斷線中」
    }
  }

  async message(conn: Conn, msg: ClientMsg) {
    const s = this.sessions.get(conn);
    if (!s) return;
    const fail = (message: string) => conn.send({ t: 'error', message });
    try {
      if (msg.t === 'ping') return conn.send({ t: 'pong' });
      if (msg.t === 'hello') return await this.hello(s, msg);
      if (!s.user) return fail('請先登入');
      const user = s.user;

      switch (msg.t) {
        case 'peek': {
          const room = this.rooms.get(String(msg.code));
          if (!room) return conn.send({ t: 'peeked', code: String(msg.code), exists: false });
          return conn.send({
            t: 'peeked', code: room.code, exists: true,
            info: {
              status: room.status, hostName: room.hostName(), seatFree: !room.seats[0] || !room.seats[1],
              spectatorsAllowed: room.config.allowSpectators, spectatorsFull: room.spectators.size >= room.config.maxSpectators,
            },
          });
        }
        case 'create': {
          if (s.code && this.rooms.has(s.code)) return fail('你已經在一個房間裡了，請先離開');
          const config: RoomConfig = {
            allowSpectators: !!msg.allowSpectators,
            maxSpectators: Math.max(0, Math.min(8, Math.floor(Number(msg.maxSpectators) || 0))),
          };
          const room = new GameRoom(this.db, this.newCode(), config, this.engine);
          const r = room.joinPlayer(user, msg.deck, String(msg.deckName ?? '').slice(0, 24));
          if ('error' in r) return fail(r.error);
          this.rooms.set(room.code, room);
          return this.enter(s, room);
        }
        case 'join': {
          if (s.code && this.rooms.has(s.code) && s.code !== String(msg.code)) return fail('你已經在一個房間裡了，請先離開');
          const room = this.rooms.get(String(msg.code));
          if (!room) return fail('找不到這個房間，請確認代碼');
          if (msg.role === 'spectator') {
            const r = room.joinSpectator(user);
            if ('error' in r) return fail(r.error);
          } else {
            const r = room.joinPlayer(user, msg.deck, String(msg.deckName ?? '').slice(0, 24));
            if ('error' in r) return fail(r.error);
          }
          return this.enter(s, room);
        }
        case 'rejoin': {
          const room = this.rooms.get(String(msg.code));
          if (!room || room.viewerOf(user.id) === null) return fail('房間已經不存在');
          return this.enter(s, room);
        }
        case 'leave': {
          const room = s.code ? this.rooms.get(s.code) : undefined;
          s.code = null;
          if (room) {
            const { events } = room.leave(user.id);
            if (room.isEmpty()) this.rooms.delete(room.code);
            else {
              this.pushRoom(room);
              if (events.length || room.game) this.pushState(room, events);
            }
          }
          return conn.send({ t: 'left' });
        }
        case 'action': {
          const room = s.code ? this.rooms.get(s.code) : undefined;
          if (!room) return fail('你不在任何房間裡');
          const r = room.apply(user.id, msg.action);
          if ('error' in r) return fail(r.error);
          this.pushState(room, r.events);
          if (room.status === 'ended') this.pushRoom(room);
          return;
        }
      }
    } catch (e) {
      console.error('處理訊息時發生錯誤', e);
      fail('伺服器發生錯誤');
    }
  }

  // 定期清掉沒人的房間
  sweep(now = Date.now()) {
    for (const [code, room] of this.rooms) {
      const anyone = [...room.online].length > 0;
      if (!anyone && now - room.lastActive > IDLE_ROOM_MS) this.rooms.delete(code);
    }
  }

  // ── 內部 ──
  private async hello(s: Session, msg: Extract<ClientMsg, { t: 'hello' }>) {
    let user: User;
    if (this.opts.verifyToken) {
      if (!msg.token) return s.conn.send({ t: 'error', message: '請先登入' });
      try {
        user = await this.opts.verifyToken(msg.token);
      } catch {
        return s.conn.send({ t: 'error', message: '登入已過期，請重新登入' });
      }
    } else {
      // 測試登入：沒有設定 Firebase 時才開放
      const id = String(msg.devId ?? '').replace(/[^\w-]/g, '').slice(0, 40);
      if (!id) return s.conn.send({ t: 'error', message: '缺少測試登入的識別碼' });
      user = { id: `dev:${id}`, name: String(msg.name ?? '').trim().slice(0, MAX_NAME) || '玩家' };
    }
    if (msg.name && this.opts.verifyToken) user = { ...user, name: String(msg.name).trim().slice(0, MAX_NAME) || user.name };
    const old = this.byUser.get(user.id);
    if (old && old !== s.conn) {
      old.send({ t: 'error', message: '你的帳號在其他地方登入了' });
      const os = this.sessions.get(old);
      if (os) s.code = os.code; // 接手原本所在的房間
      this.sessions.delete(old);
      old.close();
    }
    s.user = user;
    this.byUser.set(user.id, s.conn);
    s.conn.send({ t: 'welcome', userId: user.id, name: user.name, dev: !this.opts.verifyToken });
  }

  private enter(s: Session, room: GameRoom) {
    const user = s.user!;
    s.code = room.code;
    room.online.add(user.id);
    room.touch();
    const events = room.startIfReady();
    this.pushRoom(room);
    if (events) this.pushState(room, events);
    else if (room.game) s.conn.send({ t: 'state', state: room.clientState(room.viewerOf(user.id)!)!, events: [] }); // 重新連線：只補目前的狀態
  }

  private connsOf(room: GameRoom): { conn: Conn; user: User }[] {
    const out: { conn: Conn; user: User }[] = [];
    for (const s of this.sessions.values()) if (s.user && s.code === room.code) out.push({ conn: s.conn, user: s.user });
    return out;
  }

  private pushRoom(room: GameRoom) {
    for (const { conn, user } of this.connsOf(room)) conn.send({ t: 'room', info: room.info(user.id) });
  }

  private pushState(room: GameRoom, events: GameEvent[]) {
    for (const { conn, user } of this.connsOf(room)) {
      const state = room.clientState(room.viewerOf(user.id) ?? 'spectator');
      if (state) conn.send({ t: 'state', state, events });
    }
  }

  private newCode(): string {
    for (;;) {
      const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
      if (!this.rooms.has(code)) return code;
    }
  }
}

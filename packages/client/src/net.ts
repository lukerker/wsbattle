// 連線層：WebSocket 連到對戰伺服器，斷線自動重連（回到原本的房間），定期 ping 避免伺服器休眠。
import { useSyncExternalStore } from 'react';
import type { Action, ClientMsg, ClientState, GameEvent, RoomInfo, ServerMsg } from '@ws/engine';
import type { Auth } from './auth.ts';
import { SERVER_HTTP, SERVER_WS } from './config.ts';

export interface NetSnapshot {
  status: 'idle' | 'waking' | 'connecting' | 'online' | 'offline' | 'kicked'; // kicked：同帳號在別的裝置登入，這裡停止連線
  user: { userId: string; name: string; dev: boolean } | null;
  room: RoomInfo | null;
  peek: Extract<ServerMsg, { t: 'peeked' }> | null;
  error: string | null;
  wakeSeconds: number; // 伺服器喚醒中：已經等了幾秒
}

type StateHandler = (state: ClientState, events: GameEvent[]) => void;

const ROOM_KEY = 'ws-room-code';

class Net {
  private ws: WebSocket | null = null;
  private auth: Auth | null = null;
  private snap: NetSnapshot = { status: 'idle', user: null, room: null, peek: null, error: null, wakeSeconds: 0 };
  private subs = new Set<() => void>();
  private stateHandlers = new Set<StateHandler>();
  private pingTimer = 0;
  private retry = 0;
  private wanted = false;
  private lastState: { state: ClientState; events: GameEvent[] } | null = null;

  // ── 給 React 用 ──
  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  };
  getSnapshot = () => this.snap;
  private set(patch: Partial<NetSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.subs.forEach((f) => f());
  }

  // 對局畫面註冊；註冊時如果已經有狀態，立刻補給它（頁面剛切換過來的時候）
  onState(h: StateHandler) {
    this.stateHandlers.add(h);
    if (this.lastState) h(this.lastState.state, []);
    return () => {
      this.stateHandlers.delete(h);
    };
  }

  // ── 連線 ──
  async start(auth: Auth) {
    this.auth = auth;
    this.wanted = true;
    this.retry = 0;
    await this.wake();
    this.open();
  }

  // 被別的裝置擠掉之後，使用者按「在這裡繼續」：重新連線（換成把另一台擠掉）
  resume() {
    if (this.auth) void this.start(this.auth);
  }

  stop() {
    this.wanted = false;
    window.clearInterval(this.pingTimer);
    this.ws?.close();
    this.ws = null;
    sessionStorage.removeItem(ROOM_KEY);
    this.lastState = null;
    this.set({ status: 'idle', user: null, room: null, peek: null, error: null });
  }

  // Render 免費方案閒置會休眠，先打健康檢查把它叫醒（約 1 分鐘），期間畫面顯示等待中
  private async wake() {
    this.set({ status: 'waking', wakeSeconds: 0 });
    const t0 = Date.now();
    const tick = window.setInterval(() => this.set({ wakeSeconds: Math.round((Date.now() - t0) / 1000) }), 1000);
    try {
      for (let i = 0; i < 40 && this.wanted; i++) {
        try {
          const r = await fetch(`${SERVER_HTTP}/health`, { cache: 'no-store' });
          if (r.ok) return;
        } catch { /* 還沒醒 */ }
        await new Promise((r) => setTimeout(r, 3000));
      }
    } finally {
      window.clearInterval(tick);
    }
  }

  private open() {
    if (!this.wanted) return;
    this.set({ status: 'connecting' });
    const ws = new WebSocket(SERVER_WS);
    this.ws = ws;
    ws.onopen = async () => {
      this.retry = 0;
      const hello = await this.auth!.hello();
      this.send({ t: 'hello', ...hello });
      window.clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => this.send({ t: 'ping' }), 25_000);
    };
    ws.onmessage = (ev) => this.handle(JSON.parse(ev.data as string) as ServerMsg);
    ws.onclose = () => {
      window.clearInterval(this.pingTimer);
      if (this.ws !== ws || !this.wanted) return;
      this.set({ status: 'offline' });
      const delay = Math.min(10_000, 800 * 2 ** this.retry++);
      window.setTimeout(() => this.open(), delay);
    };
  }

  private handle(m: ServerMsg) {
    switch (m.t) {
      case 'welcome': {
        this.set({ status: 'online', user: { userId: m.userId, name: m.name, dev: m.dev }, error: null });
        const code = sessionStorage.getItem(ROOM_KEY);
        if (code && !this.snap.room) this.send({ t: 'rejoin', code }); // 重連後回到原本的房間
        return;
      }
      case 'room':
        sessionStorage.setItem(ROOM_KEY, m.info.code);
        this.set({ room: m.info });
        return;
      case 'state':
        this.lastState = { state: m.state, events: m.events };
        this.stateHandlers.forEach((h) => h(m.state, m.events));
        return;
      case 'left':
        sessionStorage.removeItem(ROOM_KEY);
        this.lastState = null;
        this.set({ room: null });
        return;
      case 'kicked':
        // 不再自動重連，不然兩台裝置會一直互相擠掉。記住的房間代碼留著，按「在這裡繼續」時回到原本的房間
        this.wanted = false;
        window.clearInterval(this.pingTimer);
        this.ws?.close();
        this.ws = null;
        this.lastState = null;
        this.set({ status: 'kicked', room: null, peek: null, error: null });
        return;
      case 'peeked':
        this.set({ peek: m });
        return;
      case 'error':
        // 房間已經不在了：清掉記住的房間代碼，回到大廳
        if (m.message.includes('房間已經不存在')) {
          sessionStorage.removeItem(ROOM_KEY);
          this.lastState = null;
          this.set({ room: null });
          return;
        }
        this.set({ error: m.message });
        return;
      case 'pong':
        return;
    }
  }

  // ── 送出 ──
  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }
  action(action: Action) {
    this.send({ t: 'action', action });
  }
  clearError() {
    if (this.snap.error) this.set({ error: null });
  }
  clearPeek() {
    this.set({ peek: null });
  }
}

export const net = new Net();
export const useNet = () => useSyncExternalStore(net.subscribe, net.getSnapshot);

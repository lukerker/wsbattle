// 對戰伺服器：WebSocket 收操作 → 呼叫引擎 → 依每個人的權限過濾後廣播。
// 環境變數：
//   PORT                 監聽的埠（Render 會自動設定）
//   FIREBASE_PROJECT_ID  設了就要求 Firebase 登入；沒設就開放「測試登入」（只能在自己電腦開發用）
//   ALLOWED_ORIGINS      允許連線的網站網址，用逗號分隔；沒設就不限制（只適合開發）
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { RoomManager, bdW125, btrW107, type ClientMsg, type Conn, type ServerMsg } from '@ws/engine';
import { firebaseVerifier } from './auth.ts';

const PORT = Number(process.env.PORT ?? 8787);
const PROJECT = process.env.FIREBASE_PROJECT_ID;
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const db = new Map([...btrW107.cards, ...bdW125.cards].map((c) => [c.id, c]));
const manager = new RoomManager(db, PROJECT ? { verifyToken: firebaseVerifier(PROJECT) } : {});

const originOk = (origin: string | undefined) => ORIGINS.length === 0 || (!!origin && ORIGINS.includes(origin));

const http = createServer((req, res) => {
  // 健康檢查：前端進網頁時先打一下，把休眠中的伺服器叫醒
  const origin = req.headers.origin;
  if (origin && originOk(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return void res.end(JSON.stringify({ ok: true, rooms: manager.rooms.size, auth: PROJECT ? 'firebase' : 'dev' }));
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server: http, maxPayload: 100 * 1024 });

wss.on('connection', (ws: WebSocket, req) => {
  if (!originOk(req.headers.origin)) return void ws.close(1008, 'origin not allowed');
  const conn: Conn = {
    send: (msg: ServerMsg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); },
    close: () => ws.close(),
  };
  manager.connect(conn);
  let alive = true;
  ws.on('pong', () => { alive = true; });
  (ws as WebSocket & { _alive: () => boolean; _setDead: () => void })._alive = () => alive;
  (ws as WebSocket & { _setDead: () => void })._setDead = () => { alive = false; };
  ws.on('message', (data) => {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return conn.send({ t: 'error', message: '訊息格式錯誤' });
    }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    void manager.message(conn, msg);
  });
  ws.on('close', () => manager.disconnect(conn));
  ws.on('error', () => manager.disconnect(conn));
});

// 每 30 秒：清掉沒人的房間、踢掉已經死掉的連線
setInterval(() => {
  manager.sweep();
  for (const ws of wss.clients) {
    const w = ws as WebSocket & { _alive?: () => boolean; _setDead?: () => void };
    if (w._alive && !w._alive()) {
      ws.terminate();
      continue;
    }
    w._setDead?.();
    ws.ping();
  }
}, 30_000);

http.listen(PORT, () => {
  console.log(`對戰伺服器已啟動：埠 ${PORT}，登入方式：${PROJECT ? `Firebase（${PROJECT}）` : '測試登入（不要用在正式環境）'}`);
  if (ORIGINS.length === 0) console.log('提醒：沒有設定 ALLOWED_ORIGINS，任何網站都能連線');
});

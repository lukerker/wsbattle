// 伺服器與前端之間的訊息格式（JSON，經 WebSocket 傳送）。
import type { GameEvent, PlayerId, Pending, Action } from '../game/types.ts';
import type { GameView, Viewer } from '../game/view.ts';

export type { Viewer } from '../game/view.ts';

export interface RoomConfig {
  allowSpectators: boolean;
  maxSpectators: number; // 暫定 6～8
}

export interface SeatInfo {
  name: string;
  series: string; // 牌組的系列代碼，畫面用來決定主題色
  deckName: string;
  online: boolean;
}

export interface RoomInfo {
  code: string;
  status: 'waiting' | 'playing' | 'ended';
  seats: [SeatInfo | null, SeatInfo | null];
  config: RoomConfig;
  spectators: { name: string }[];
  you: Viewer; // 你在這個房間的身分
}

// 要在一個房間裡看到的、只屬於這位觀看者的狀態
export interface ClientState {
  view: GameView; // 已依觀看者過濾（含效果要他看的牌）
  viewer: Viewer;
  mine: Pending | null; // 需要你回應的待決選擇（完整內容）
  waiting: { kind: Pending['kind']; players: PlayerId[] } | null; // 目前在等誰（所有人都看得到）
  legal: Action[]; // 你現在可以做的動作（不是你要回應時是空的）
  power: Record<string, number>; // 舞台上每張角色現在的攻擊力（現場計算）
  soul: Record<string, number>;
  problems: Record<string, string | null>; // 你手牌裡每張卡現在打不出去的原因；null＝可以打
  abilityText: Record<string, string>; // 你舞台上起動能力的文字，key＝「卡片:第幾個能力」
}

export type ClientMsg =
  | { t: 'hello'; name?: string; token?: string; devId?: string }
  | { t: 'ping' }
  | { t: 'peek'; code: string }
  | { t: 'create'; deck: string[]; deckName: string; allowSpectators: boolean; maxSpectators: number }
  | { t: 'join'; code: string; role: 'player' | 'spectator'; deck?: string[]; deckName?: string }
  | { t: 'rejoin'; code: string }
  | { t: 'leave' }
  | { t: 'action'; action: Action };

export type ServerMsg =
  | { t: 'welcome'; userId: string; name: string; dev: boolean }
  | { t: 'pong' }
  | { t: 'peeked'; code: string; exists: boolean; info?: { status: RoomInfo['status']; hostName: string; seatFree: boolean; spectatorsAllowed: boolean; spectatorsFull: boolean } }
  | { t: 'room'; info: RoomInfo }
  | { t: 'state'; state: ClientState; events: GameEvent[] }
  | { t: 'left' }
  | { t: 'error'; message: string };

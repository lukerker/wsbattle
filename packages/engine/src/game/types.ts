import type { Ability, Effect, Selector } from '../card-schema.ts';

// 對局狀態、玩家動作、事件列表的型別。
// 狀態是純資料（可序列化、可存進 Firestore），引擎是純函式：(狀態, 動作) → (新狀態, 事件列表)。

export type PlayerId = 0 | 1;
export type Phase = 'setup' | 'stand' | 'draw' | 'clock' | 'main' | 'climax' | 'attack' | 'encore' | 'end' | 'gameOver';
export type AttackMode = 'front' | 'side' | 'direct';
export type GameZone = 'deck' | 'hand' | 'waiting' | 'clock' | 'level' | 'stock' | 'climax' | 'memory' | 'resolution' | 'stage';

// 舞台格子：0～2＝前列左、中、右；3～4＝後列左、右〔3.6.4〕
export type Slot = 0 | 1 | 2 | 3 | 4;
export const FRONT: Slot[] = [0, 1, 2];

export interface StageCard {
  uid: string;
  state: 'stand' | 'rest' | 'reverse';
}

// 各區的陣列順序：deck[0]＝牌組最上面；其餘區域最後一個＝最上面
export interface PlayerState {
  deck: string[];
  hand: string[];
  waiting: string[];
  clock: string[];
  level: string[];
  stock: string[];
  climax: string[];
  memory: string[];
  resolution: string[];
  stage: (StageCard | null)[];
}

// 「那個回合中」的加成：對象是卡本身（uid），回合結束或離開舞台時消失
export interface TurnMod {
  uid: string;
  power: number;
  soul: number;
  until?: number; // 持續到第幾回合結束（沒給＝這個回合）
}

export interface AttackInfo {
  attacker: string;
  slot: Slot;
  mode: AttackMode;
  defender: string | null;
  checks?: number; // 判定步驟要做幾次判定（預設 1）
  afterChecks?: 'stockTopToWaiting'; // 判定做滿 checks 次之後：能量區上方 1 張放到休息室
}

// 引擎內部待執行的步驟（堆疊，最後一個先執行）
export type Step =
  | { k: 'turnStart' }
  | { k: 'drawPhase' }
  | { k: 'clockPhase' }
  | { k: 'mainPhase' }
  | { k: 'climaxPhase' }
  | { k: 'attackDeclare' }
  | { k: 'trigger'; n?: number } // 第幾次判定（1 開始）
  | { k: 'icon'; icon: string; uid: string }
  | { k: 'toStock'; uid: string }
  | { k: 'counter' }
  | { k: 'attackDamage' }
  | { k: 'battle' }
  | { k: 'attackEnd' } // 攻擊的終わり：誘發「アタックの終わりに」
  | { k: 'attackClear' }
  | { k: 'stockTopToWaiting'; p: PlayerId }
  | { k: 'encoreStep' }
  | { k: 'endPhase' }
  | { k: 'endPhaseCleanup' }
  | { k: 'draw'; p: PlayerId; n: number }
  | { k: 'damage'; p: PlayerId; n: number; src?: string; auto?: boolean } // src＝給傷害的卡（效果傷害）；auto＝來自【自】的效果
  | { k: 'levelCheck'; p: PlayerId }
  | { k: 'frame'; f: Frame } // 執行一段效果
  | { k: 'abilityStart'; w: StandbyAbility } // 自動能力開始解決（檢查條件、費用、是否發動）
  | { k: 'mainContinue' } // 主要階段：做完一個動作後再給玩家行動機會
  | { k: 'climaxPlay' }
  | { k: 'attackPhase' }
  | { k: 'encoreLoop' };

// 效果解決中的上下文
export interface FrameCtx {
  battleOpp?: string; // 誘發時的戰鬥對手（最終情報〔8.11.2〕）
  slot?: Slot; // 離開舞台時原本的格子（安可用）
  target?: string; // 誘發這個能力的其他卡（「其他角色被放到休息室時」的那張角色）
  x?: number; // setX 決定的 X
}

// 效果之外，用來表達費用與流程的內部動作
export type InternalOp =
  | { op: '_confirm'; prompt: string }
  | { op: '_payStock'; n: number }
  | { op: '_discardSource' }
  | { op: '_restSource' }
  | { op: '_sendSourceToWR' }
  | { op: '_rest'; selector: Selector }
  | { op: '_sourceToDeckBottom' }
  | { op: '_deckTopToClock' }
  | { op: '_fireUsedBackup' }
  | { op: '_eventDone' }
  | { op: '_markOnce'; key: string } // 記下「1 回合 N 次」的能力已經發動
  | { op: '_discard'; selector: Selector; bind?: string }
  | { op: '_handToClock' }
  | { op: '_reveal'; selector: Selector }
  | { op: '_handToDeckBottom'; selector: Selector }
  | { op: '_returnSourceToHand' }
  | { op: '_ifCancelled'; then: Effect[] } // 剛才的傷害被取消的話
  | { op: '_fireConcentrate' }; // 集中結算完：名場面進了休息室就誘發「使用集中時」

export interface Frame {
  src: string; // 發生源（能力所屬的卡）
  controller: PlayerId; // 效果的主人
  label: string; // 顯示用：卡名
  effects: (Effect | InternalOp)[];
  i: number;
  binds: Record<string, string[]>;
  ctx: FrameCtx;
  tmp: Record<string, unknown>; // 目前這個動作的暫存（已選的卡等）
  answer?: string[] | boolean | number;
  auto?: boolean; // 這段效果來自【自】（「相手のキャラの【自】の効果によるダメージ」）
}

// 待機中的自動能力〔8.7.2〕
export interface StandbyAbility {
  id: number;
  src: string;
  controller: PlayerId;
  ability: Ability;
  ctx: FrameCtx;
}

// 等待玩家回應的選擇（待決選擇）
// 反擊步驟（助太刀）、給對手確認公開的卡：幾秒內沒回應就自動「不使用」／「確認」，避免卡住
export const RESPONSE_SECONDS = 10;

export type Pending =
  | { kind: 'mulligan'; player: PlayerId; waiting: PlayerId[] } // 雙方同時換牌：waiting 裡的玩家都可以送出
  | { kind: 'decideFirst'; player: PlayerId; waiting: PlayerId[] } // 決定先後攻：雙方各選 1 張蓋著的卡（同時進行）
  | { kind: 'clock'; player: PlayerId }
  | { kind: 'main'; player: PlayerId }
  | { kind: 'climax'; player: PlayerId }
  | { kind: 'attackDeclare'; player: PlayerId }
  | { kind: 'levelUp'; player: PlayerId; options: string[] }
  | { kind: 'encoreChoose'; player: PlayerId; options: string[] }
  | { kind: 'select'; player: PlayerId; prompt: string; options: string[]; min: number; max: number; shown?: string[]; ordered?: boolean; button?: string } // ordered：點選的順序有意義（例如放回牌組上方的順序） // shown：一起顯示的卡（例如看牌組上方 N 張時，全部翻開的牌）
  | { kind: 'acknowledge'; player: PlayerId; prompt: string; cards: string[]; button?: string; timeout?: number } // 公開的卡：看過按確認（button：按鈕文字；timeout：給對手確認時，幾秒後自動確認）
  | { kind: 'confirm'; player: PlayerId; prompt: string }
  | { kind: 'chooseSlot'; player: PlayerId; prompt: string; slots: Slot[]; owner?: PlayerId } // owner：格子是誰的舞台（沒給＝選擇的人自己）
  | { kind: 'orderAbility'; player: PlayerId; options: { id: number; uid: string; text: string }[]; canSkip: boolean } // canSkip：全部都是可以不發動的能力
  | { kind: 'counter'; player: PlayerId; options: string[]; timeout?: number } // timeout：幾秒內沒回應就由伺服器自動略過
  | { kind: 'handLimit'; player: PlayerId; count: number }
  | { kind: 'pick'; player: PlayerId; reason: 'comeback' | 'gate' | 'choice'; options: string[]; dests: ('hand' | 'stock')[] }
  | { kind: 'yesno'; player: PlayerId; reason: 'treasureStock' | 'pool' | 'draw' }
  | { kind: 'chooseOption'; player: PlayerId; prompt: string; options: string[] }; // 選 1 個效果（回答 choose，uids＝[選項的序號]）

export type Action =
  | { type: 'mulligan'; player: PlayerId; discard: string[] }
  | { type: 'pickFirst'; player: PlayerId; card: 0 | 1 } // 決定先後攻：選左邊（0）或右邊（1）的卡
  | { type: 'clock'; player: PlayerId; uid: string | null }
  | { type: 'playCharacter'; player: PlayerId; uid: string; slot: Slot }
  | { type: 'playEvent'; player: PlayerId; uid: string }
  | { type: 'playClimax'; player: PlayerId; uid: string }
  | { type: 'moveStage'; player: PlayerId; from: Slot; to: Slot }
  | { type: 'pass'; player: PlayerId }
  | { type: 'attack'; player: PlayerId; slot: Slot; mode: AttackMode }
  | { type: 'choose'; player: PlayerId; uids: string[]; dest?: 'hand' | 'stock' }
  | { type: 'yesno'; player: PlayerId; yes: boolean }
  | { type: 'activate'; player: PlayerId; uid: string; index: number } // 起動能力：舞台上的卡、第幾個能力
  | { type: 'chooseSlot'; player: PlayerId; slot: Slot }
  | { type: 'concede'; player: PlayerId };

export interface Place {
  p: PlayerId;
  zone: GameZone;
  slot?: Slot;
}

// 事件列表：畫面照這個播放動畫，規則和動畫完全分開
export type GameEvent =
  | { t: 'move'; uid: string; cardId: string | null; from: Place; to: Place }
  | { t: 'cardState'; uid: string; state: StageCard['state'] }
  | { t: 'phase'; phase: Phase; player: PlayerId }
  | { t: 'shuffle'; p: PlayerId }
  | { t: 'refresh'; p: PlayerId }
  | { t: 'attack'; uid: string; slot: Slot; mode: AttackMode }
  | { t: 'trigger'; uid: string; cardId: string; icons: string[] }
  | { t: 'damage'; p: PlayerId; n: number }
  | { t: 'damageCancel'; p: PlayerId }
  | { t: 'levelUp'; p: PlayerId; uid: string }
  | { t: 'gameOver'; winner: PlayerId | 'draw' }
  | { t: 'ability'; uid: string; cardId: string; text: string } // 能力開始解決
  | { t: 'reveal'; uid: string; cardId: string } // 公開
  | { t: 'notice'; text: string } // 例：尚未實作的卡片效果
  | { t: 'log'; p: PlayerId; text: string } // 給對戰紀錄的說明（只含公開資訊）
  | { t: 'firstDecided'; first: PlayerId; firstCard: 0 | 1; picks: [0 | 1, 0 | 1] }; // 先後攻翻牌結果：picks[玩家]＝他選的卡

export interface GameState {
  rng: number; // 亂數狀態（固定種子，可重播）
  cards: Record<string, { cardId: string; owner: PlayerId }>;
  players: [PlayerState, PlayerState];
  firstPlayer: PlayerId;
  turnPlayer: PlayerId;
  turn: number; // 第幾回合（雙方合計，從 1 開始）
  phase: Phase;
  attack: AttackInfo | null;
  attacksThisTurn: number;
  mods: TurnMod[];
  grants: { uid: string; ability: Ability; until?: number }[]; // 「那個回合中」給予的能力（until＝持續到第幾回合結束）
  placedThisTurn: string[]; // 這個回合從手牌放到舞台的卡
  markers: Record<string, { uid: string; faceUp: boolean }[]>; // 角色下面的標記（角色離開舞台時一起放到休息室）
  skipStand: { uid: string; turn: number }[]; // 第 turn 回合的起立階段不【直立】
  shields: { p: PlayerId; uid: string; until: number }[]; // p 在 uid 的戰鬥中不受對手角色【自】效果的傷害，到第 until 回合結束
  lastDamage: 'cancel' | 'clock' | null; // 最近一次傷害處理的結果
  usedOnce: string[]; // 這個回合已經發動過的「1 回合 1 次」能力（卡 uid＋能力原文）
  standby: StandbyAbility[];
  nextId: number;
  queue: Step[];
  pending: Pending | null;
  winner: PlayerId | 'draw' | null;
  // 決定先後攻：雙方選的卡（null＝還沒選）。哪張是先攻在雙方都選好時才抽，所以這裡沒有祕密
  firstPick: { picks: [0 | 1 | null, 0 | 1 | null] } | null;
}

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
  error?: string;
}

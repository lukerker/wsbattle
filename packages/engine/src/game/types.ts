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
  | { k: 'attackEnd' }
  | { k: 'encoreStep' }
  | { k: 'endPhase' }
  | { k: 'endPhaseCleanup' }
  | { k: 'draw'; p: PlayerId; n: number }
  | { k: 'damage'; p: PlayerId; n: number }
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
}

// 效果之外，用來表達費用與流程的內部動作
export type InternalOp =
  | { op: '_confirm'; prompt: string }
  | { op: '_payStock'; n: number }
  | { op: '_discard'; selector: Selector }
  | { op: '_discardSource' }
  | { op: '_restSource' }
  | { op: '_sendSourceToWR' }
  | { op: '_rest'; selector: Selector }
  | { op: '_sourceToDeckBottom' }
  | { op: '_fireUsedBackup' }
  | { op: '_eventDone' };

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
export type Pending =
  | { kind: 'mulligan'; player: PlayerId; waiting: PlayerId[] } // 雙方同時換牌：waiting 裡的玩家都可以送出
  | { kind: 'clock'; player: PlayerId }
  | { kind: 'main'; player: PlayerId }
  | { kind: 'climax'; player: PlayerId }
  | { kind: 'attackDeclare'; player: PlayerId }
  | { kind: 'levelUp'; player: PlayerId; options: string[] }
  | { kind: 'encoreChoose'; player: PlayerId; options: string[] }
  | { kind: 'select'; player: PlayerId; prompt: string; options: string[]; min: number; max: number; shown?: string[] } // shown：一起顯示的卡（例如看牌組上方 N 張時，全部翻開的牌）
  | { kind: 'acknowledge'; player: PlayerId; prompt: string; cards: string[] } // 對手公開的卡：看過按確認
  | { kind: 'confirm'; player: PlayerId; prompt: string }
  | { kind: 'chooseSlot'; player: PlayerId; prompt: string; slots: Slot[]; owner?: PlayerId } // owner：格子是誰的舞台（沒給＝選擇的人自己）
  | { kind: 'orderAbility'; player: PlayerId; options: { id: number; uid: string; text: string }[]; canSkip: boolean } // canSkip：全部都是可以不發動的能力
  | { kind: 'counter'; player: PlayerId; options: string[] }
  | { kind: 'handLimit'; player: PlayerId; count: number }
  | { kind: 'pick'; player: PlayerId; reason: 'comeback' | 'gate' | 'choice'; options: string[]; dests: ('hand' | 'stock')[] }
  | { kind: 'yesno'; player: PlayerId; reason: 'treasureStock' | 'pool' | 'draw' };

export type Action =
  | { type: 'mulligan'; player: PlayerId; discard: string[] }
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
  | { t: 'notice'; text: string }; // 例：尚未實作的卡片效果

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
  grants: { uid: string; ability: Ability }[]; // 「那個回合中」給予的能力
  placedThisTurn: string[]; // 這個回合從手牌放到舞台的卡
  standby: StandbyAbility[];
  nextId: number;
  queue: Step[];
  pending: Pending | null;
  winner: PlayerId | 'draw' | null;
}

export interface ApplyResult {
  state: GameState;
  events: GameEvent[];
  error?: string;
}

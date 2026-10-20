// 卡片資料格式（效果積木 v0）。引擎遇到新效果時再擴充。
// 效果寫成「時機＋條件＋費用＋動作」；卡片只填資料，不寫邏輯。

export type Color = 'yellow' | 'red' | 'blue' | 'green' | 'purple' | 'colorless';
export type CardType = 'character' | 'event' | 'climax';
// 判定圖示，依總合規則 4.14.2
export type TriggerIcon =
  | 'soul' // ソウル：攻擊角色魂傷 +1
  | 'return' // リターン：對手角色回手
  | 'pool' // プール：牌組頂 → 能量
  | 'comeback' // カムバック（門形）：休息室角色 → 手牌
  | 'draw' // ドロー：抽 1
  | 'shot' // ショット
  | 'treasure' // トレジャー：此卡回手，可牌組頂 → 能量
  | 'gate' // ゲート：休息室名場面 → 手牌
  | 'standby' // スタンバイ
  | 'choice' // チョイス：休息室有魂圖示的角色 → 手牌或能量
  | 'chance' // チャンス
  | 'discovery' // ディスカバリー
  | 'focus'; // フォーカス

export interface Text {
  ja: string;
  zh: string;
}

export type Zone = 'hand' | 'deck' | 'waitingRoom' | 'stage' | 'stock' | 'clock' | 'level' | 'climaxZone' | 'memory';
export type Side = 'self' | 'opponent';

export interface CardFilter {
  type?: CardType;
  color?: Color;
  trait?: string; // 特徵，例如「音楽」
  name?: string; // 精確卡名比對
  costAtMost?: number;
  row?: 'front' | 'back';
  excludeSource?: boolean; // 「其他的」＝不含發動這個能力的卡本身
  levelAtLeast?: number; // 等級 N 以上（名場面視為等級 0）
  hasTrigger?: TriggerIcon; // 有這個判定圖示
  anyOf?: CardFilter[]; // 符合其中一個即可（例：《音樂》的角色或事件）
  nameIncludes?: string[]; // 卡名包含其中一個字串
  levelAtMostPlayerLevel?: true; // 等級在你的等級以下
}

export type Count = { exactly: number } | { upTo: number } | 'all';

export interface Selector {
  zone: Zone;
  side: Side;
  filter?: CardFilter;
  count: Count;
  chooser?: Side; // 誰來選；預設發動者
  relation?: 'source' | 'frontOfSource' | 'inBattleWithSource' | 'battleOpponentOfSource';
  state?: 'stand' | 'rest'; // 只選正置／橫置的卡
  slot?: 'empty'; // 只選舞台上沒有角色的格子（用於放置）
  fromTop?: number; // 只看牌組上方 N 張
  position?: 'top' | 'bottom'; // 要選的是上方或下方
  as?: string; // 把這次選到的卡命名，同一效果的後續步驟可引用（選一次、算一次）
  fromBind?: string; // 直接用前面步驟命名的卡（as／bind），不再選
}

// 數值的結算時機：atResolution＝效果結算當下算定，之後不再變；live＝每次使用時現場算（【永】）
export type Evaluate = 'atResolution' | 'live';

export type Amount =
  | number
  | { per: Selector; multiplier: number; evaluate: Evaluate } // 每有 1 張 × 倍率
  | { perSoulOf: Selector; multiplier: number; evaluate: Evaluate } // 那張卡的魂傷 × 倍率
  | { perSoulOfBound: string; multiplier: number; evaluate: Evaluate } // 引用先前以 as 命名的卡
  | { countOfBound: string; filter?: CardFilter } // 前一步驟綁定的卡裡符合條件的張數
  | { perLevelOfTarget: true; multiplier: number }; // 每個受影響的卡各自的等級 × 倍率（應援用）

export type Condition =
  | { kind: 'all'; of: Condition[] }
  | { kind: 'placedThisTurnFromHand' } // 此卡是這個回合從手牌放置到舞台的
  | { kind: 'battleOpponentLevelAtMost'; n: number }
  | { kind: 'noOthers'; selector: Selector } // 沒有符合的其他卡存在
  | { kind: 'stockAtMost'; n: number }
  | { kind: 'countAtLeast'; selector: Selector; n: number }
  | { kind: 'countAtMost'; selector: Selector; n: number }
  | { kind: 'climaxInZone'; name?: string } // 沒給名稱＝名場面區有任何名場面
  | { kind: 'sourceInSlot'; slots: number[] } // 此卡在指定的格子（0～2 前列左中右、3～4 後列）
  | { kind: 'opponentInFront' } // 此卡的正面有對手的角色
  | { kind: 'myTurn' };

export type Cost =
  | { kind: 'stock'; n: number }
  | { kind: 'restSource' }
  | { kind: 'discard'; selector: Selector }
  | { kind: 'discardSource' } // 助太刀：手牌的此卡放到休息室
  | { kind: 'sendSourceToWaitingRoom' } // 從舞台把此卡放到休息室
  | { kind: 'rest'; selector: Selector } // 把其他卡橫置
  | { kind: 'sourceToDeckBottom' }; // 把舞台上的此卡放到牌組下方

export type Duration = 'whileActive' | 'thisTurn' | 'untilNextOpponentTurnEnd'; // 最後一個：到下次的對手回合結束前

export type Effect =
  | { op: 'modifyPower'; target: Selector; amount: Amount; duration: Duration }
  | { op: 'modifySoul'; target: Selector; amount: number; duration: Duration }
  | {
      op: 'moveCards';
      from: Selector;
      to: { zone: Zone; side?: Side; position?: 'top' | 'bottom'; state?: 'stand' | 'rest'; slot?: 'empty' | 'any' }; // slot any＝舞台的好きな枠（有角色的格子，原本的角色進休息室）
      bind?: string; // 把移動的卡綁成名稱，供後續步驟使用
    }
  | { op: 'draw'; upTo: Amount } // 最多抽 N 張（每張都問）
  | { op: 'drawCards'; n: Amount } // 抽 N 張（一定要抽）
  | {
      // 看牌組上方 N 張，選符合條件的至多 M 張（公開）加入手牌，其餘放休息室
      op: 'lookTopPick';
      look: number | Amount;
      pick: { filter: CardFilter; upTo: number };
      rest: 'waitingRoom' | 'back';
      secret?: true; // 卡面沒寫「給對手確認」：拿的卡不公開
      then?: Effect[]; // 有加入手牌時才執行
    }
  | { op: 'searchDeck'; filter: CardFilter; upTo: number; reveal: true; shuffle: boolean }
  | { op: 'revealTopCheck'; filter: CardFilter; ifMatch: Effect[] } // 公開牌組上方1張（翻到牌組旁邊給玩家看）：符合條件就加到手牌並執行 ifMatch，否則放回原位
  | { op: 'revealMill'; n: number; bind: string; result: 'draw' | 'damage' } // 把牌組上方 N 張翻開給玩家看，再放到休息室（集中、翻牌造成傷害）；result 決定提示文字
  | { op: 'returnSourceToHand' }
  | { op: 'returnSourceToSlot'; state: 'rest' } // 安可：橫置放回原位
  | { op: 'putCardOnDeckTop'; from: Selector }
  | { op: 'restSource' } // 把此卡橫置（效果，非費用）
  | { op: 'dealDamage'; amount: Amount; cancelable: boolean }
  | { op: 'moveSourceToSlot'; row: 'front'; emptyOnly: true }
  | { op: 'grantAbility'; target: Selector; ability: Ability; duration: Duration }
  | { op: 'sendToMemory'; from: Selector } // 放到回憶區（思い出）
  | { op: 'payThen'; cost: Cost[]; then: Effect[] } // 效果中途的「可以支付代價，支付了的話…」（先問、再付、再結算 then）
  | { op: 'extraTriggerCheck' } // 這次攻擊的判定步驟做 2 次判定
  | { op: 'moveToOtherEmptySlot'; target: Selector } // 選 1 張角色，移到它主人舞台上其他沒有角色的格子
  | { op: 'lookTopHandAndStock'; look: number; filter: CardFilter } // 看牌組上方 N 張，選符合條件的最多 2 張給對手確認，1 張加到手牌、1 張放到能量區，其餘放休息室
  | { op: 'lookOpponentTopPlace' } // 看對手牌組上方 1 張，放回上方或下方
  | { op: 'revealTopLevelRecover' } // 公開牌組上方 1 張（之後放回），從休息室選 1 張等級 X 以下的角色回手牌（X＝公開的卡的等級，名場面算 0）
  | { op: 'lookTopReorder'; n: number } // 看自己牌組上方最多 N 張，照喜歡的順序放回上方
  | { op: 'lookOpponentTopArrange'; n: number } // 看對手牌組上方最多 N 張，選最多 N 張照喜歡的順序放回上方，其餘放到休息室
  | { op: 'restAndMoveToBack'; target: Selector } // 選 1 張角色，橫置並移到後列沒有角色的格子
  | { op: 'sourceToDeckBottom' }; // 把此卡（事件在解決領域、或在舞台上）放到牌組最下面

export type TriggerEvent =
  | { event: 'placedFromHandToStage' } // 此卡從手牌放置到舞台時
  | { event: 'attacks' } // 此卡攻擊時
  | { event: 'reversedInBattle' } // 戰鬥中的此卡倒置時
  | { event: 'climaxPlaced'; side: Side; filter?: CardFilter }
  | { event: 'damageCancelledInBattle' } // 此卡的戰鬥中，己方受到的傷害被取消時
  | { event: 'sourceLeavesStageToWaitingRoom' } // 安可
  | { event: 'usedBackup' } // 此卡的助太刀被使用時
  | { event: 'battleOpponentReversed' } // 此卡的戰鬥對手倒置時
  | { event: 'damageNotCancelledInBattle' } // 此卡的戰鬥中，己方受到的傷害沒有被取消時
  | { event: 'encoreStepStart'; side: Side }
  | { event: 'myClimaxPhaseStart' }
  | { event: 'opponentAttackPhaseStart' }
  | { event: 'myTriggerChecked'; filter?: CardFilter } // 你的判定翻出符合條件的卡時
  | { event: 'allyFrontAttacked'; filter?: CardFilter }; // 你的其他角色（符合條件）被正打時

export type Keyword =
  | { id: 'assist' } // 應援（【永】，效果本身用 modifyPower 描述）
  | { id: 'backup'; power: number; level: number }
  | { id: 'encore' }
  | { id: 'bond'; targetName: string }
  | { id: 'concentrate' } // 集中
  | { id: 'cxCombo'; climaxName: string };

export interface Ability {
  kind: 'continuous' | 'auto' | 'activated' | 'event'; // event＝事件卡打出時結算的效果
  keyword?: Keyword;
  trigger?: TriggerEvent; // auto 才有
  timing?: 'counter'; // 助太刀
  condition?: Condition;
  cost?: Cost[];
  optional?: boolean; // 「可以」類：先檢查付不付得起，再問玩家
  rules?: ('ignoreColorRequirement' | 'cannotSideAttack' | 'doesNotStand')[]; // 改變規則的能力：不需滿足顏色條件、不能側打、起立階段不直立
  effects: Effect[];
  text: Text;
  review?: string[]; // 需要使用者核對的疑點
}

export interface Card {
  id: string; // 例：BTR/W107-T01
  series: string;
  name: Text;
  type: CardType;
  color: Color;
  level?: number;
  cost?: number;
  power?: number;
  soul?: number;
  triggers: TriggerIcon[];
  traits: Text[];
  abilities: Ability[];
  note?: string; // 白話效果說明（實戰拆解）
  status: { translated: boolean; coded: boolean; verified: boolean; tested: boolean };
}

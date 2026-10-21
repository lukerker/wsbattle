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

export type Zone = 'hand' | 'deck' | 'waitingRoom' | 'stage' | 'stock' | 'clock' | 'level' | 'climaxZone' | 'memory' | 'marker'; // marker＝此卡下面的標記
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
  levelAtMost?: number; // 等級 N 以下（名場面視為等級 0）
  levelAtMostX?: true; // 等級 X 以下（X 由同一效果前面的 setX 決定）
  levelAboveOwnerLevel?: true; // 「レベルが相手のレベルより高い」：卡的等級比它主人的等級高
  costAtLeast?: number;
  names?: string[]; // 卡名是其中一個（「A」か「B」）
}

export type Count = { exactly: number } | { upTo: number } | 'all';

export interface Selector {
  zone: Zone;
  side: Side;
  filter?: CardFilter;
  count: Count;
  chooser?: Side; // 誰來選；預設發動者
  relation?: 'source' | 'frontOfSource' | 'inBattleWithSource' | 'battleOpponentOfSource' | 'facingSource' | 'triggerTarget'; // facingSource＝此卡正面的對手角色；triggerTarget＝誘發這個能力的那張卡（被正打的角色、倒置的角色…）
  state?: 'stand' | 'rest'; // 只選正置／橫置的卡
  slot?: 'empty'; // 只選舞台上沒有角色的格子（用於放置）
  fromTop?: number; // 只看牌組上方 N 張（傷害區等其他區域：上面 N 張）
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
  | { countOfBound: string; filter?: CardFilter; divideBy?: number } // 前一步驟綁定的卡裡符合條件的張數（divideBy＝每 N 張算 1）
  | { perLevelOfTarget: true; multiplier: number } // 每個受影響的卡各自的等級 × 倍率（應援用）
  | { x: true; multiplier?: number } // 同一效果前面 setX 決定的 X（× 倍率）
  | { levelSumOfBound: string } // 綁定的卡的等級合計（名場面算 0）
  | { distinctMarkerNames: true }; // 此卡下面的標記有幾種不同卡名

export type Condition =
  | { kind: 'all'; of: Condition[] }
  | { kind: 'placedThisTurnFromHand' } // 此卡是這個回合從手牌放置到舞台的
  | { kind: 'noOthers'; selector: Selector } // 沒有符合的其他卡存在
  | { kind: 'stockAtMost'; n: number }
  | { kind: 'countAtLeast'; selector: Selector; n: number }
  | { kind: 'countAtMost'; selector: Selector; n: number }
  | { kind: 'climaxInZone'; name?: string } // 沒給名稱＝名場面區有任何名場面
  | { kind: 'sourceInSlot'; slots: number[] } // 此卡在指定的格子（0～2 前列左中右、3～4 後列）
  | { kind: 'opponentInFront' } // 此卡的正面有對手的角色
  | { kind: 'opponentInFrontLevel'; level: number } // 此卡的正面的對手角色等級是 N
  | { kind: 'myTurn' }
  | { kind: 'any'; of: Condition[] } // 符合其中一個
  | { kind: 'not'; of: Condition }
  | { kind: 'levelAtLeast'; n: number } // 你的等級 N 以上
  | { kind: 'handAtLeast'; n: number }
  | { kind: 'handAtMost'; n: number }
  | { kind: 'allMine'; filter: CardFilter } // 你的角色全部符合（「あなたのキャラすべてが《X》なら」）
  | { kind: 'levelZoneSumAtLeast'; n: number } // 經驗：你等級區的卡的等級合計 N 以上
  | { kind: 'opponentFrontClear' } // 對手前列沒有角色，或前列角色全部倒置
  | { kind: 'attackMode'; mode: 'front' | 'side' | 'direct' } // 這次攻擊的方式
  | { kind: 'battleOpponentLevelAtMost'; n: number }
  | { kind: 'battleOpponentAboveItsLevel' } // 此卡的戰鬥對手的等級比對手的等級高
  | { kind: 'opponentInFrontCostAtLeast'; n: number }
  | { kind: 'frontAbsentOrReversed' } // 此卡正面沒有角色，或正面的角色倒置
  | { kind: 'hasMarker' } // 此卡下面有標記
  | { kind: 'opponentClimaxInZone' } // 對手的名場面區有名場面
  | { kind: 'phase'; phase: 'climax' | 'main' | 'attack' }
  | { kind: 'xAtLeast'; n: number };

export type Cost =
  | { kind: 'stock'; n: number }
  | { kind: 'restSource' }
  | { kind: 'discard'; selector: Selector; bind?: string } // 放到休息室（手牌、舞台、能量區、名場面區…）；bind＝記下放掉的卡
  | { kind: 'discardSource' } // 助太刀：手牌的此卡放到休息室
  | { kind: 'sendSourceToWaitingRoom' } // 從舞台把此卡放到休息室
  | { kind: 'rest'; selector: Selector } // 把其他卡橫置
  | { kind: 'sourceToDeckBottom' } // 把舞台上的此卡放到牌組下方
  | { kind: 'sourceToMemory' } // 把此卡（助太刀：手牌的此卡）放到回憶區
  | { kind: 'deckTopToClock' } // 把自己牌組上方 1 張放到傷害區
  | { kind: 'handToClock' } // 手牌 1 張放到傷害區
  | { kind: 'reveal'; selector: Selector } // 共鳴：公開手牌的卡（給對手看，留在手牌）
  | { kind: 'handToDeckBottom'; selector: Selector } // 公開手牌的卡，放到牌組下方
  | { kind: 'returnSourceToHand' }; // 把舞台上的此卡放回手牌

export type Duration = 'whileActive' | 'thisTurn' | 'untilNextOpponentTurnEnd'; // 最後一個：到下次的對手回合結束前

export type Effect =
  | { op: 'modifyPower'; target: Selector; amount: Amount; duration: Duration }
  | { op: 'modifySoul'; target: Selector; amount: number; duration: Duration }
  | {
      op: 'moveCards';
      from: Selector;
      // slot any＝舞台的好きな枠（有角色的格子，原本的角色進休息室）；sourceSlot＝此卡原本的格子；anyNew＝這個效果還沒放過的格子（「別々の枠」）
      // row＝只能放前列／後列；slotChooser opponent＝由對手選格子；position bottom（能量區）＝放到最下面
      to: { zone: Zone; side?: Side; position?: 'top' | 'bottom'; state?: 'stand' | 'rest'; slot?: 'empty' | 'any' | 'sourceSlot' | 'anyNew'; row?: 'front' | 'back'; slotChooser?: Side };
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
  | { op: 'revealTopCheck'; filter: CardFilter; ifMatch: Effect[]; matchTo?: 'hand' | 'deckTop' } // 公開牌組上方1張（翻到牌組旁邊給玩家看）：符合條件就加到手牌並執行 ifMatch，否則放回原位；matchTo deckTop＝不論結果都放回原位，符合才執行 ifMatch
  | { op: 'revealMill'; n: number; bind: string; result: 'draw' | 'damage' | 'count' } // 把牌組上方 N 張翻開給玩家看，再放到休息室（集中、翻牌造成傷害）；result 決定提示文字（count＝只說翻到幾張名場面）
  | { op: 'returnSourceToHand' }
  | { op: 'returnSourceToSlot'; state: 'rest' } // 安可：橫置放回原位
  | { op: 'putCardOnDeckTop'; from: Selector }
  | { op: 'restSource' } // 把此卡橫置（效果，非費用）
  | { op: 'dealDamage'; amount: Amount; cancelable: boolean; times?: number; ifCancelled?: Effect[] } // times＝「N ダメージを M 回」；ifCancelled＝這次傷害被取消時接著做
  | { op: 'moveSourceToSlot'; row: 'front'; emptyOnly: true }
  | { op: 'grantAbility'; target: Selector; ability: Ability; duration: Duration }
  | { op: 'sendToMemory'; from: Selector } // 放到回憶區（思い出）
  | { op: 'payThen'; cost: Cost[]; then: Effect[] } // 效果中途的「可以支付代價，支付了的話…」（先問、再付、再結算 then）
  | { op: 'extraTriggerCheck'; n?: number; thenStockTopToWaiting?: true } // 這次攻擊的判定步驟做 n 次（預設 2）判定；做滿後能量區上方 1 張放到休息室
  | { op: 'moveToOtherEmptySlot'; target: Selector } // 選 1 張角色，移到它主人舞台上其他沒有角色的格子
  | { op: 'lookTopHandAndStock'; look: number; filter: CardFilter; secret?: true; search?: true; max?: number } // 看牌組上方 N 張（search＝看整個牌組，之後洗牌），選符合條件的最多 max（預設 2）張給對手確認，1 張加到手牌、1 張放到能量區，其餘放休息室
  | { op: 'lookOpponentTopPlace' } // 看對手牌組上方 1 張，放回上方或下方
  | { op: 'revealTopLevelRecover'; filter?: CardFilter } // 公開牌組上方 1 張（之後放回），從休息室選 1 張等級 X 以下的角色（符合 filter）回手牌（X＝公開的卡的等級，名場面算 0）
  | { op: 'lookTopReorder'; n: number } // 看自己牌組上方最多 N 張，照喜歡的順序放回上方
  | { op: 'lookOpponentTopArrange'; n: number } // 看對手牌組上方最多 N 張，選最多 N 張照喜歡的順序放回上方，其餘放到休息室
  | { op: 'restAndMoveToBack'; target: Selector } // 選 1 張角色，橫置並移到後列沒有角色的格子
  | { op: 'sourceToDeckBottom' } // 把此卡（事件在解決領域、或在舞台上）放到牌組最下面
  | { op: 'sourceToMemory' } // 把此卡（事件在解決領域、舞台上、或助太刀時在手牌）放到回憶區（「このカードを思い出にする」）
  | { op: 'lookTopPlace'; dest?: 'bottom' | 'waitingRoom' } // 看自己牌組上方 1 張，放回上方或下方（dest waitingRoom＝上方或休息室）
  | { op: 'may'; prompt: string; then: Effect[] } // 效果中途的「…してよい」：問玩家要不要做
  | { op: 'returnTriggerCardToSlot' } // 把誘發這個能力的角色（剛從舞台放到休息室）【橫置】放回原本的格子
  | { op: 'chooseOne'; options: { label: string; effects: Effect[] }[] } // 「次の N つの効果のうちあなたが選んだ1つを行う」
  | { op: 'eachInOrder'; options: { label: string; effects: Effect[] }[] } // 「次の2つの効果を好きな順番で1回ずつ行う」
  | { op: 'reverse'; target: Selector } // 把角色【倒置】
  | { op: 'rest'; target: Selector } // 把角色【橫置】
  | { op: 'stand'; target: Selector } // 把角色【直立】
  | { op: 'setX'; amount: Amount } // 決定 X，之後的 levelAtMostX、{ x } 會用到
  | { op: 'ifBound'; bind: string; filter?: CardFilter; then: Effect[]; else?: Effect[] } // 綁定的卡裡有符合條件的就做 then
  | { op: 'if'; condition: Condition; then: Effect[]; else?: Effect[] }
  | { op: 'shuffleDeck'; side?: Side }
  | { op: 'repeat'; times: Amount; effects: Effect[] } // 「…1枚につき、次の行動を行う」「次の行動を2回行う」
  | { op: 'swapWithWaiting'; target: Selector } // 選對手等級 1 以上的角色，對手從自己休息室選等級 X－1 以下的角色交換（X＝選的角色的等級）
  | { op: 'swapLevelWithWaiting'; filter?: CardFilter; optional?: true } // 等級區的卡和休息室的卡各選 1 張交換
  | { op: 'swapHandWithWaiting'; filter: CardFilter } // 選手牌最多 1 張公開，和休息室符合條件的 1 張交換
  | { op: 'resetStock'; side: Side; via: 'waitingRoom' | 'deck' } // 能量區全部放到休息室（或洗回牌組），再從牌組上方放同樣張數到能量區
  | { op: 'waitingToDeck'; side: Side; keepClimax?: true } // 休息室全部放回牌組並洗牌（keepClimax＝對手先選 1 張名場面留下）
  | { op: 'noStandNext'; target: Selector } // 那張角色在下次的對手起立階段不【直立】
  | { op: 'lookTopKeep'; n: number } // 看牌組上方最多 N 張，選 1 張放回上方，其餘放到休息室
  | { op: 'revealUpToPick'; n: number; filter: CardFilter } // 公開牌組上方最多 N 張，選符合條件的最多 1 張加到手牌，其餘放休息室，再丟 1 張手牌
  | { op: 'revealTopStockRest'; n: number } // 公開牌組上方最多 N 張，選 1 張放到能量區，其餘加到手牌
  | { op: 'memoryAndReturn'; target: Selector } // 對手的角色放到回憶區，對手再把它放到舞台上喜歡的格子
  | { op: 'addMarker'; from: Selector; to: 'source' | 'triggerTarget'; faceUp: boolean } // 把卡放到角色下面當標記
  | { op: 'toDeckTopOrdered'; from: Selector; max?: Amount } // 選卡依喜歡的順序放到（卡主人的）牌組上方；max＝最多幾張（例：X 枚まで）
  | { op: 'shieldAutoDamage' } // 到下次的對手回合結束前，此卡的戰鬥中，你不受對手角色【自】效果造成的傷害
  | { op: 'modifyLevel'; target: Selector; amount: number; duration: 'whileActive' } // 【永】等級＋N（手牌中的此卡要配合 activeIn hand）
  | { op: 'gainTrigger'; icon: TriggerIcon } // 【永】此卡得到判定圖示
  | { op: 'swapPositions'; target: Selector; withSource?: true } // 選 2 張角色（withSource＝此卡和另外選的 1 張），都【直立】並交換格子
  | { op: 'shiftSwap'; filter: CardFilter } // シフト：手牌符合條件的 1 張和傷害區的此卡交換
  | { op: 'pickHandRestStock'; from: Selector }; // 選卡，其中 1 張加到手牌，其餘依喜歡的順序放到能量區

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
  | { event: 'allyFrontAttacked'; filter?: CardFilter } // 你的其他角色（符合條件）被正打時
  | { event: 'allyLeavesStageToWaitingRoom'; filter?: CardFilter } // 你的其他角色（符合條件）從舞台被放到休息室時
  | { event: 'placedToClimaxZone' } // 名場面：此卡從手牌被放置到名場面區時
  | { event: 'usedActivated' } // 你使用【起】時（含助太刀）
  | { event: 'attackEnd' } // 此卡的攻擊結束時（アタックの終わりに）
  | { event: 'dealtDamageCancelled' } // 此卡給的傷害被取消時
  | { event: 'dealtDamageNotCancelled' } // 此卡給的傷害沒有被取消時
  | { event: 'allyAttacks'; filter?: CardFilter } // 你的其他角色（符合條件）攻擊時（記憶：回憶區的此卡也算）
  | { event: 'allyPlacedFromHand'; filter?: CardFilter } // 你的其他角色（符合條件）從手牌被放置到舞台時
  | { event: 'allyReversed'; filter?: CardFilter } // 你的其他角色（符合條件）倒置時
  | { event: 'frontAttacked' } // 此卡被正打時
  | { event: 'placedFromWaitingRoom' } // 此卡從休息室被放置到舞台時
  | { event: 'placedByEffectOf'; name: string } // 此卡因「X」的效果被放置到舞台時
  | { event: 'myMainPhaseStart' }
  | { event: 'myAttackPhaseStart' }
  | { event: 'concentrateHitClimax' }; // 你使用『集中』、那個效果讓名場面進休息室時

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
  alsoOn?: TriggerEvent; // 「…時か…時」：另一個誘發時機
  timing?: 'counter'; // 助太刀
  condition?: Condition;
  cost?: Cost[];
  optional?: boolean; // 「可以」類：先檢查付不付得起，再問玩家
  perTurn?: number; // 【ターン1】／「この能力は1ターンにつきN回まで発動する」
  activeIn?: 'waitingRoom' | 'memory' | 'clockTop' | 'clock' | 'hand'; // 在舞台以外的區域生效（控え室にこのカードがあるなら、記憶、アラーム、シフト、手牌的等級－1）
  // 改變規則的能力：不需滿足顏色條件、不能側打、起立階段不直立、不能移到其他格子、不會被對手的效果選擇、這張卡的戰鬥中不能使用助太刀
  rules?: ('ignoreColorRequirement' | 'cannotSideAttack' | 'doesNotStand' | 'cannotMove' | 'untargetable' | 'noBackupInBattle')[];
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
  playCondition?: Condition; // 「…がいないなら、手札からプレイできない」：出牌的額外條件
  sameNameAs?: string[]; // 構築時和這些卡名合計最多 4 張（「このカードと同じカード名のカードと、「X」は、デッキに合計4枚まで」）
  note?: string; // 白話效果說明（實戰拆解）
  status: { translated: boolean; coded: boolean; verified: boolean; tested: boolean };
}

// 教學內容：章節 → 頁。每頁左邊是示範畫面（卡片、場地動畫、作品一覽），右邊是說明文字。
// 規則依官方總合規則（docs/引擎規格.md），用語和對戰畫面一致。
// 場地示範用「格」描述：我方用孤獨搖滾預組（BTR/W107），對手用 Ave Mujica 預組（BD/W125）。
import type { AttackMode, PlayerId } from '@ws/engine';

// 一個區域的卡：'T08'＝卡號 T08；'T08@a'＝帶識別名稱 a（同一張卡在不同畫格間移動才有動畫）；
// '@s1'＝蓋著的卡（能量）；':rest' 橫置、':rev' 倒置（只用在舞台）
export interface SideSpec {
  deck?: number; // 牌組張數（含 deckTop）
  deckTop?: string[]; // 牌組最上面的幾張（之後的畫格會翻開）
  hand?: string[]; // 只有我方的手牌會畫出來
  stage?: (string | null)[]; // 0～2 前列左中右，3～4 後列左右
  waiting?: string[];
  clock?: string[];
  level?: string[];
  stock?: number | string[];
  climax?: string[];
  memory?: string[];
  resolution?: string[];
}

export interface Frame {
  me?: SideSpec; // 和前一格合併：有寫的區域才換掉
  opp?: SideSpec;
  hl?: string[]; // 發光的區域：'stage-0'（我方整個舞台）、'slot-0-1'、'clock-1'、'hand'…
  caption?: string; // 場地上方的小字幕
  ms?: number; // 這一格停多久（預設 1700）
  turn?: PlayerId; // 誰的回合（那半邊發光），預設我方
  power?: Record<string, number>; // 識別名稱 → 現場攻擊力（沿用到之後的畫格，直到另外指定）
  soul?: Record<string, number>;
  attack?: { tag: string; slot: number; mode: AttackMode; p?: PlayerId }; // 播攻擊動畫
  shuffle?: { p: PlayerId; refresh: boolean }; // 播洗牌動畫
}

export type Spot = 'level' | 'cost' | 'trigger' | 'power' | 'soul' | 'name' | 'traits' | 'text' | 'color';

export type Visual =
  | { kind: 'hero' } // Logo＋各作品主視覺輪播
  | { kind: 'series' } // 各作品一覽
  | { kind: 'card'; id: string; spots?: Spot[]; landscape?: boolean } // 一張大卡，標出各部位
  | { kind: 'cards'; cards: { id: string; label: string }[] }
  | { kind: 'board'; frames: Frame[]; hand?: boolean } // 場地示範（只有一格就是靜態）
  | { kind: 'phases' } // 8 個階段依序亮起
  | { kind: 'turnCards' }; // 先攻／後攻卡

export interface Slide {
  title: string;
  body: string[]; // 一段一行；**粗體**；開頭「・」是條列
  visual: Visual;
}

export interface Chapter {
  title: string;
  slides: Slide[];
}

// ───── 常用的場地 ─────
// 對局中段的一般場面（認識場地、攻擊示範的底）
const MID_ME: SideSpec = {
  deck: 30, hand: ['T08', 'T17', 'T11'], stage: ['T04', 'T16', 'T05', 'T06', null],
  waiting: ['T02', 'T14', 'T03'], clock: ['T13', 'T01'], level: ['T07'], stock: ['@s1', '@s2', '@s3', '@s4'],
};
const MID_OPP: SideSpec = {
  deck: 28, stage: ['T12', null, 'T03', null, 'T14'], waiting: ['T01', 'T02'], clock: ['T08', 'T09', 'T10'], level: ['T05'], stock: 3,
};
const mid = (f: Frame = {}): Frame => ({ me: MID_ME, opp: MID_OPP, ...f });

export const CHAPTERS: Chapter[] = [
  {
    title: '什麼是 Weiß Schwarz',
    slides: [
      {
        title: '歡迎來到 Weiß Schwarz！',
        visual: { kind: 'hero' },
        body: [
          '**Weiß Schwarz**（ヴァイスシュヴァルツ，中文叫「黑白雙翼」，玩家常簡稱 **WS**）是日本 Bushiroad（武士道）推出的集換式卡牌遊戲，2008 年開始到現在。',
          '名字是德文：Weiß 是「白」，Schwarz 是「黑」。',
          '這是兩個人對戰的遊戲：各自拿一副牌組，輪流派出角色攻擊對手。',
        ],
      },
      {
        title: '用你喜歡的作品來打',
        visual: { kind: 'series' },
        body: [
          'WS 最大的特色：**卡片上都是動畫、漫畫、遊戲裡的角色**。每部作品都有一整套自己的卡，同一部作品的角色效果會互相配合。',
          '所以第一步很簡單：**挑一部你喜歡的作品**。喜歡哪些角色，就讓他們上場！',
          '這裡是目前可以玩的作品，之後會陸續增加。',
        ],
      },
      {
        title: '一副牌組 50 張',
        visual: { kind: 'cards', cards: [{ id: 'BTR/W107-T04', label: '角色' }, { id: 'BTR/W107-T10', label: '事件' }, { id: 'BTR/W107-T11', label: '名場面' }] },
        body: [
          '一副牌組**剛好 50 張**：同名的卡最多 4 張，名場面合計最多 8 張。',
          '通常一副牌組只用同一部作品的卡，角色之間的效果才接得起來。',
          '還沒有自己的牌組也沒關係：大廳的「我的牌組」裡有每部作品的**系統預組**，是組好的 50 張，選了就能直接開打。',
        ],
      },
      {
        title: '怎麼樣算贏？',
        visual: { kind: 'board', frames: [mid({ opp: { ...MID_OPP, level: ['T05', 'T12', 'T04'], clock: ['T08', 'T09', 'T10', 'T01', 'T02', 'T11'] }, hl: ['level-1'] })] },
        body: [
          '雙方輪流攻擊，攻擊打中，對手就會受到**傷害**。',
          '傷害每累積 7 點，等級就升 1 級。',
          '**讓對手升到 4 級，你就贏了！**',
          '接下來會從認識卡片開始，一步一步說明。',
        ],
      },
    ],
  },
  {
    title: '認識卡片',
    slides: [
      {
        title: '三種卡片',
        visual: { kind: 'cards', cards: [{ id: 'BTR/W107-T08', label: '角色' }, { id: 'BTR/W107-T10', label: '事件' }, { id: 'BTR/W107-T11', label: '名場面' }] },
        body: [
          '卡片分成三種：',
          '・**角色**：放到場上戰鬥的主力，牌組裡大部分是角色。',
          '・**事件**：打出來執行一次效果，用完就放進休息室。',
          '・**名場面**：作品裡的經典畫面，是橫向的卡。打出來後整個回合都有效果；它還有一個很重要的用途：**取消傷害**（後面會說）。',
        ],
      },
      {
        title: '等級與費用',
        visual: { kind: 'card', id: 'BTR/W107-T08', spots: ['level', 'cost'] },
        body: [
          '左上角的大數字是**等級**：自己的等級要大於或等於卡片的等級，才能打出這張卡。一開始大家都是 0 級，只能打 0 級的卡。',
          '下面的小數字是**費用**：打出時要從「能量」付這麼多張卡。0 就是免費。',
          '這張是 2 級、費用 1。',
        ],
      },
      {
        title: '攻擊力與魂傷',
        visual: { kind: 'card', id: 'BTR/W107-T08', spots: ['power', 'soul'] },
        body: [
          '左下角的數字是**攻擊力**：兩個角色正面對打時，攻擊力低的一方會被打倒。',
          '旁邊的圖示是**魂傷**：這個角色攻擊時，對手會受到幾點傷害。',
          '這張攻擊力 7000、魂傷 1。',
        ],
      },
      {
        title: '判定圖示',
        visual: { kind: 'card', id: 'BTR/W107-T08', spots: ['trigger'] },
        body: [
          '右上角的圖示叫**判定圖示**。每次攻擊時會翻開自己牌組最上面 1 張「判定」，翻到的卡有圖示，就會觸發額外的效果。',
          '這張是「魂」：這次攻擊的魂傷 +1。',
          '各種圖示的效果在「攻擊與傷害」章節說明。',
        ],
      },
      {
        title: '卡名、特徵與效果',
        visual: { kind: 'card', id: 'BTR/W107-T08', spots: ['name', 'traits', 'text'] },
        body: [
          '下方是**卡名**和**特徵**（例如《音樂》），有些效果會指定卡名或特徵。',
          '中間的框是這張卡的**效果**。',
          '卡面是日文也不用擔心：對戰時點一下任何一張卡，左邊的預覽就會顯示**中文效果和白話說明**。',
        ],
      },
      {
        title: '顏色',
        visual: { kind: 'card', id: 'BTR/W107-T08', spots: ['color'] },
        body: [
          '卡片的**顏色**有黃、綠、紅、藍（少數作品還有紫），看卡框的顏色就知道。',
          '1 級以上的卡，要自己的**等級區或傷害區**有同顏色的卡才能打出（0 級的角色和事件不用）。',
          '所以一副牌組通常只用 1～2 種顏色。',
        ],
      },
      {
        title: '名場面卡',
        visual: { kind: 'card', id: 'BTR/W107-T11', landscape: true },
        body: [
          '名場面是橫向的卡，**沒有等級和費用**，但要符合顏色條件。',
          '每回合最多打 1 張，效果持續到回合結束。像這張：你的角色全部攻擊力 +1000、魂傷 +1。',
          '名場面的判定圖示通常也比較強（這張是「選擇」）。',
        ],
      },
    ],
  },
  {
    title: '認識場地',
    slides: [
      {
        title: '場地全貌',
        visual: { kind: 'board', frames: [mid()], hand: true },
        body: [
          '這是對戰時的場地。**下半部是你的**，上半部是對手的（左右相反，像兩個人面對面坐）。',
          '最下面一排是你的**手牌**，對手看不到。',
          '接下來一區一區介紹。',
        ],
      },
      {
        title: '舞台',
        visual: { kind: 'board', frames: [mid({ hl: ['stage-0'] })] },
        body: [
          '中間的 5 格是**舞台**，角色就放在這裡。',
          '・**前列** 3 格：可以攻擊。',
          '・**後列** 2 格：不能攻擊，但很多角色在後列能幫前面的角色加攻擊力（「應援」）。',
          '對手的前列和你的前列一格對一格，「正面」就是對面那一格。',
        ],
      },
      {
        title: '牌組與休息室',
        visual: { kind: 'board', frames: [mid({ hl: ['deck-0', 'waiting-0'] })] },
        body: [
          '右邊的牌背是**牌組**，從這裡抽牌。',
          '下面是**休息室**（棄牌區）：用過的事件、被打倒的角色、付費用的卡都會放到這裡。休息室是公開的，雙方都可以點開來看。',
        ],
      },
      {
        title: '能量區',
        visual: { kind: 'board', frames: [mid({ hl: ['stock-0'] })] },
        body: [
          '左邊蓋著的一疊是**能量**，用來付費用。',
          '每次攻擊「判定」翻開的卡，最後都會蓋著放到這裡，所以攻擊越多次，能量越多。',
        ],
      },
      {
        title: '傷害區與等級區',
        visual: { kind: 'board', frames: [mid({ hl: ['clock-0', 'level-0'] })] },
        body: [
          '下面橫排的是**傷害區**：受到的傷害放在這裡，滿 7 張就升 1 級。',
          '左邊橫放的是**等級區**：升級時選的卡放在這裡，**張數就是你的等級**。',
        ],
      },
      {
        title: '名場面區與回憶區',
        visual: { kind: 'board', frames: [mid({ me: { ...MID_ME, climax: ['T11'] }, hl: ['climax-0', 'memory-0'] })] },
        body: [
          '後列左邊是**名場面區**，打出的名場面放這裡，回合結束時放進休息室。',
          '右上角是**回憶區**：有些卡的效果會把卡放到這裡，平常用不太到。',
        ],
      },
    ],
  },
  {
    title: '升級與勝負',
    slides: [
      {
        title: '傷害滿 7 張就升級',
        visual: {
          kind: 'board',
          frames: [
            { me: { deck: 20, deckTop: ['T17@c7'], clock: ['T13@c1', 'T01@c2', 'T14@c3', 'T05@c4', 'T02@c5', 'T15@c6'], level: [], waiting: ['T03'], stock: 2, stage: ['T04', 'T16', null, null, null] }, opp: MID_OPP, caption: '傷害區已經有 6 張…', hl: ['clock-0'] },
            { me: { resolution: ['T17@c7'] }, caption: '受到 1 點傷害：翻開牌組最上面 1 張', ms: 1400 },
            { me: { resolution: [], clock: ['T13@c1', 'T01@c2', 'T14@c3', 'T05@c4', 'T02@c5', 'T15@c6', 'T17@c7'] }, caption: '傷害區滿 7 張了！', hl: ['clock-0'] },
            { me: { clock: [], level: ['T05@c4'], waiting: ['T03', 'T13@c1', 'T01@c2', 'T14@c3', 'T02@c5', 'T15@c6', 'T17@c7'] }, caption: '選 1 張放到等級區，其餘 6 張放進休息室', hl: ['level-0'], ms: 2600 },
          ],
        },
        body: [
          '受到傷害時，卡會一張一張放進**傷害區**。',
          '滿 7 張就**升級**：從這 7 張裡選 1 張放到等級區，其他 6 張放進休息室，傷害區清空重新累積。',
          '等級區有幾張，你就是幾級。升級之後就能打出更高等級的卡，所以升級不全是壞事。',
        ],
      },
      {
        title: '升到 4 級就輸了',
        visual: { kind: 'board', frames: [mid({ opp: { ...MID_OPP, level: ['T05', 'T12', 'T04'], clock: ['T08', 'T09', 'T10', 'T01', 'T02', 'T11'] }, hl: ['level-1', 'clock-1'] })] },
        body: [
          '**等級區滿 4 張（升到 4 級）的玩家就輸了。**',
          '圖上的對手已經 3 級、傷害區 6 張：再受 1 點傷害就會輸！',
          '從 0 級打到 4 級，一共要讓對手受到 28 點左右的傷害。但傷害有機會被「取消」，所以勝負常常到最後一刻才知道。',
          '（另外，牌組和休息室都沒有卡時也算輸，不過很少發生。）',
        ],
      },
    ],
  },
  {
    title: '開始一局',
    slides: [
      {
        title: '抽 5 張',
        visual: {
          kind: 'board',
          hand: true,
          frames: [
            { me: { deck: 50, deckTop: ['T09@h1', 'T19@h2', 'T11@h3', 'T01@h4', 'T04@h5'], hand: [] }, opp: { deck: 50 }, caption: '雙方把牌組洗好…' },
            { me: { deck: 45, hand: ['T09@h1', 'T19@h2', 'T11@h3', 'T01@h4', 'T04@h5'] }, opp: { deck: 45 }, caption: '…各抽 5 張當手牌', ms: 2600 },
          ],
        },
        body: [
          '雙方把 50 張牌組洗好，各抽 5 張當手牌。',
          '牌組裡的卡誰都不能看，也不能改順序。',
        ],
      },
      {
        title: '換牌',
        visual: {
          kind: 'board',
          hand: true,
          frames: [
            { me: { deck: 45, deckTop: ['T02@h6', 'T15@h7'], hand: ['T09@h1', 'T19@h2', 'T11@h3', 'T01@h4', 'T04@h5'], waiting: [] }, opp: { deck: 45 }, caption: '一開始手上有 2 張 3 級卡…', hl: ['hand'] },
            { me: { hand: ['T11@h3', 'T01@h4', 'T04@h5'], waiting: ['T09@h1', 'T19@h2'] }, caption: '把不要的丟進休息室', hl: ['waiting-0'] },
            { me: { deck: 43, hand: ['T11@h3', 'T01@h4', 'T04@h5', 'T02@h6', 'T15@h7'] }, caption: '丟幾張就重抽幾張', hl: ['hand'], ms: 2600 },
          ],
        },
        body: [
          '接著可以**換牌**一次：把不想要的手牌丟進休息室，丟幾張就重抽幾張（也可以不換）。',
          '新手訣竅：一開始只能打 0 級的卡，所以通常會丟掉**高等級的角色**，留下 0 級角色。',
          '在這裡是雙方同時換牌：用滑鼠時指著卡就能看效果，點一下是選要丟的卡。',
        ],
      },
      {
        title: '決定先後攻',
        visual: { kind: 'turnCards' },
        body: [
          '換好牌後決定先後攻：畫面中央有兩張蓋著的卡，雙方各選一張，翻開是「先攻」的人先開始。',
          '注意：**先攻玩家的第 1 回合只能攻擊 1 次**，避免先攻太有利。',
        ],
      },
    ],
  },
  {
    title: '回合流程',
    slides: [
      {
        title: '8 個階段',
        visual: { kind: 'phases' },
        body: [
          '每個回合依序有 8 個階段：',
          '**起立 → 抽牌 → 時計 → 主要 → 名場面 → 攻擊 → 安可 → 結束**',
          '然後換對手的回合。對戰時畫面上方會顯示現在在哪個階段，也會提示你現在可以做什麼。',
        ],
      },
      {
        title: '起立、抽牌',
        visual: {
          kind: 'board',
          hand: true,
          frames: [
            { me: { deck: 30, deckTop: ['T17@d1'], hand: ['T08', 'T11'], stage: ['T04@a:rest', 'T16@b:rest', 'T05@c', 'T06', null], stock: 4, clock: ['T13'], level: ['T07'], waiting: ['T02'] }, opp: MID_OPP, caption: '上回合攻擊過的角色是橫置的', hl: ['stage-0'] },
            { me: { stage: ['T04@a', 'T16@b', 'T05@c', 'T06', null] }, caption: '起立：全部轉回直立', hl: ['stage-0'] },
            { me: { deck: 29, hand: ['T08', 'T11', 'T17@d1'] }, caption: '抽牌：抽 1 張', hl: ['hand'], ms: 2400 },
          ],
        },
        body: [
          '**起立**：上回合攻擊過而橫置的角色，全部轉回直立。',
          '**抽牌**：從牌組抽 1 張。',
          '這兩個階段都是自動的。',
        ],
      },
      {
        title: '時計',
        visual: {
          kind: 'board',
          hand: true,
          frames: [
            { me: { deck: 29, deckTop: ['T18@d2', 'T06@d3'], hand: ['T09@x', 'T08', 'T11', 'T17'], stage: ['T04', 'T16', 'T05', 'T06', null], stock: 4, clock: ['T13'], level: ['T07'], waiting: ['T02'] }, opp: MID_OPP, caption: '選 1 張手牌…', hl: ['hand'] },
            { me: { hand: ['T08', 'T11', 'T17'], clock: ['T13', 'T09@x'] }, caption: '…放到傷害區', hl: ['clock-0'] },
            { me: { deck: 27, hand: ['T08', 'T11', 'T17', 'T18@d2', 'T06@d3'] }, caption: '然後抽 2 張', hl: ['hand'], ms: 2400 },
          ],
        },
        body: [
          '**時計**：可以選 1 張手牌放到自己的傷害區，然後抽 2 張。等於「自己受 1 點傷害，換 2 張牌」。',
          '也可以略過。前期通常會時計，讓手牌更充足；傷害快滿的時候就要小心。',
          '放進傷害區的卡也算「傷害區有這個顏色」，可以拿來滿足顏色條件。',
        ],
      },
      {
        title: '主要：打出角色',
        visual: {
          kind: 'board',
          hand: true,
          frames: [
            { me: { deck: 27, hand: ['T16@p', 'T17@q', 'T08'], stage: ['T04', null, null, 'T06', null], stock: ['@s1', '@s2', '@s3'], clock: ['T13', 'T09'], level: ['T07'], waiting: ['T02'] }, opp: MID_OPP, caption: '你現在 1 級，等級區、傷害區有黃色和紅色', hl: ['level-0', 'clock-0'] },
            { me: { hand: ['T17@q', 'T08'], stage: ['T04', 'T16@p', null, 'T06', null] }, caption: '把角色拖到舞台的格子（費用 0）', hl: ['slot-0-1'] },
            { me: { hand: ['T08'], stage: ['T04', 'T16@p', 'T17@q', 'T06', null], stock: ['@s1', '@s2'], waiting: ['T02', 'T05@s3'] }, caption: '費用 1：從能量付 1 張到休息室', hl: ['stock-0', 'slot-0-2'], ms: 2600 },
          ],
        },
        body: [
          '**主要階段**是你最自由的時候，以下的事可以做很多次：',
          '・打出角色：把手牌拖到舞台的格子。要符合**等級、顏色**條件，並從能量付**費用**（付掉的卡放進休息室）。',
          '・打出事件、使用角色的【起】能力。',
          '・交換舞台上兩格角色的位置。',
          '格子裡已經有角色時打出新角色，舊的會放進休息室。',
        ],
      },
      {
        title: '名場面',
        visual: {
          kind: 'board',
          hand: true,
          frames: [
            { me: { deck: 27, hand: ['T11@cx', 'T08'], stage: ['T04@a', 'T16@b', 'T05@c', 'T06', null], stock: 3, clock: ['T13', 'T09'], level: ['T07'], waiting: ['T02'], climax: [] }, opp: MID_OPP, caption: '手上有名場面…' },
            { me: { hand: ['T08'], climax: ['T11@cx'] }, power: { a: 5500, b: 6500, c: 5500 }, soul: { a: 2, b: 2, c: 2 }, caption: '打出後，角色全部攻擊力 +1000、魂傷 +1', hl: ['climax-0', 'stage-0'], ms: 2800 },
          ],
        },
        body: [
          '**名場面階段**：可以打出 1 張名場面到名場面區（只能 1 張），效果持續到回合結束。',
          '很多角色有「**CX 連動**」：場上有指定的名場面時攻擊，會發動強力的效果。組牌時會把角色和它連動的名場面一起放。',
        ],
      },
      {
        title: '攻擊',
        visual: { kind: 'board', frames: [mid({ hl: ['slot-0-0', 'slot-0-1', 'slot-0-2'] })] },
        body: [
          '**攻擊階段**：用前列直立的角色，一個一個攻擊對手。',
          '這是整個遊戲的重點，下一章會詳細說明。',
        ],
      },
      {
        title: '安可',
        visual: {
          kind: 'board',
          frames: [
            { me: { deck: 25, stage: ['T04:rest', 'T16@b:rev', 'T05:rest', 'T06', null], stock: ['@s1', '@s2', '@s3', '@s4'], clock: ['T13', 'T09'], level: ['T07'], waiting: ['T02'] }, opp: MID_OPP, caption: '戰鬥中被打倒的角色是倒置的', hl: ['slot-0-1'] },
            { me: { stage: ['T04:rest', null, 'T05:rest', 'T06', null], waiting: ['T02', 'T16@b'] }, caption: '倒置的角色放進休息室…', hl: ['waiting-0'] },
            { me: { stage: ['T04:rest', 'T16@b:rest', 'T05:rest', 'T06', null], stock: ['@s1'], waiting: ['T02', 'T01@s4', 'T14@s3', 'T03@s2'] }, caption: '…這時可以付 3 張能量「安可」，橫置回到原本的格子', hl: ['slot-0-1', 'stock-0'], ms: 3000 },
          ],
        },
        body: [
          '攻擊結束後是**安可**：被打倒（倒置）的角色都要放進休息室。',
          '但每個角色都可以**安可**：付 3 張能量，讓它以橫置狀態回到原本的格子。',
          '有些卡上還寫了別的安可方式（例如丟 1 張手牌），比付 3 張能量便宜。',
        ],
      },
      {
        title: '結束',
        visual: {
          kind: 'board',
          frames: [
            { me: { deck: 25, stage: ['T04:rest', 'T16:rest', 'T05:rest', 'T06', null], stock: 2, clock: ['T13', 'T09'], level: ['T07'], waiting: ['T02'], climax: ['T11@cx'] }, opp: MID_OPP, hl: ['climax-0'] },
            { me: { climax: [], waiting: ['T02', 'T11@cx'] }, caption: '名場面放進休息室，換對手的回合', hl: ['waiting-0'], ms: 2400 },
          ],
        },
        body: [
          '**結束階段**：手牌超過 7 張要丟到剩 7 張，名場面放進休息室，然後換對手的回合。',
          '下一章來看最重要的攻擊。',
        ],
      },
    ],
  },
  {
    title: '攻擊與傷害',
    slides: [
      {
        title: '三種攻擊方式',
        visual: {
          kind: 'board',
          frames: [
            mid({ caption: '前列的角色，看正面有沒有對手的角色', hl: ['stage-0', 'stage-1'] }),
            { me: { stage: ['T04', 'T16@b:rest', 'T05', 'T06', null] }, attack: { tag: 'b', slot: 1, mode: 'direct' }, soul: { b: 2 }, caption: '正面沒有角色：直接攻擊（魂傷 +1）', ms: 2600 },
          ],
        },
        body: [
          '用**前列直立**的角色攻擊，宣告攻擊後角色會橫置。看正面（對面那格）有沒有對手的角色，有三種打法：',
          '・正面沒有角色 → **直接攻擊**：這次魂傷 +1。',
          '・正面有角色 → **正打**：之後會和對方比攻擊力。',
          '・正面有角色 → **側打**：不比攻擊力，但魂傷要減掉對方角色的等級。',
          '對戰時點一下前列的角色，旁邊就會出現攻擊方式的按鈕。',
        ],
      },
      {
        title: '判定',
        visual: {
          kind: 'board',
          frames: [
            { me: { deck: 25, deckTop: ['T18@t'], stage: ['T04@a', 'T16', 'T05', 'T06', null], stock: ['@s1', '@s2'], clock: ['T13'], level: ['T07'], waiting: ['T02'] }, opp: MID_OPP, caption: '宣告攻擊' },
            { me: { stage: ['T04@a:rest', 'T16', 'T05', 'T06', null] }, attack: { tag: 'a', slot: 0, mode: 'front' }, caption: '正打！', ms: 1400 },
            { me: { deck: 24, resolution: ['T18@t'] }, caption: '判定：翻開自己牌組最上面 1 張', hl: ['deck-0'], ms: 1800 },
            { soul: { a: 2 }, caption: '有「魂」圖示：這次攻擊魂傷 +1', ms: 2000 },
            { me: { resolution: [], stock: ['@s1', '@s2', '@t'] }, caption: '判定的卡蓋著放進能量區', hl: ['stock-0'], ms: 2400 },
          ],
        },
        body: [
          '宣告攻擊後是**判定**：翻開自己牌組最上面 1 張。如果有判定圖示就觸發效果，然後這張卡蓋著放進**能量區**。',
          '這就是能量的主要來源：每攻擊一次，能量就多 1 張。',
        ],
      },
      {
        title: '傷害',
        visual: {
          kind: 'board',
          frames: [
            { me: { deck: 24, stage: ['T04@a:rest', 'T16', 'T05', 'T06', null], stock: 3, clock: ['T13'], level: ['T07'], waiting: ['T02'] }, opp: { ...MID_OPP, deckTop: ['T08@d1', 'T10@d2'] }, soul: { a: 2 }, caption: '魂傷 2：對手翻開 2 張' },
            { opp: { deck: 27, resolution: ['T08@d1'] }, caption: '第 1 張…', hl: ['deck-1'], ms: 1300 },
            { opp: { deck: 26, resolution: ['T08@d1', 'T10@d2'] }, caption: '第 2 張…都不是名場面', ms: 1600 },
            { opp: { resolution: [], clock: ['T08', 'T09', 'T10', 'T08@d1', 'T10@d2'] }, caption: '放進對手的傷害區：受到 2 點傷害！', hl: ['clock-1'], ms: 2600 },
          ],
        },
        body: [
          '接著對手受到**傷害**：魂傷是幾，對手就從自己的牌組一張一張翻開幾張。',
          '全部都不是名場面，這些卡就放進對手的傷害區。',
        ],
      },
      {
        title: '取消傷害',
        visual: {
          kind: 'board',
          frames: [
            { me: { deck: 24, stage: ['T04@a:rest', 'T16', 'T05', 'T06', null], stock: 3, clock: ['T13'], level: ['T07'], waiting: ['T02'] }, opp: { ...MID_OPP, deckTop: ['T09@e1', 'T19@e2'] }, soul: { a: 2 }, caption: '魂傷 2：對手翻開 2 張' },
            { opp: { deck: 27, resolution: ['T09@e1'] }, caption: '第 1 張…', hl: ['deck-1'], ms: 1300 },
            { opp: { deck: 26, resolution: ['T09@e1', 'T19@e2'] }, caption: '翻到名場面！', ms: 1700 },
            { opp: { resolution: [], waiting: ['T01', 'T02', 'T09@e1', 'T19@e2'] }, caption: '傷害取消：翻開的卡全部放進休息室，一點傷害都沒受', hl: ['waiting-1'], ms: 3000 },
          ],
        },
        body: [
          '但只要翻到**名場面**，這次的傷害就**全部取消**：翻開的卡放進休息室，一點傷害都不受！',
          '這是 WS 最刺激的地方：攻擊不一定會中。牌組裡的名場面就是你的「盾牌」。',
          '魂傷越高，一次造成的傷害越多，但翻開的張數也越多。',
        ],
      },
      {
        title: '戰鬥',
        visual: {
          kind: 'board',
          frames: [
            { me: { deck: 24, stage: ['T04@a:rest', 'T16', 'T05', 'T06', null], stock: 3, clock: ['T13'], level: ['T07'], waiting: ['T02'] }, opp: { ...MID_OPP, stage: ['T12', null, 'T03@y', null, 'T14'] }, caption: '傷害之後，正打還要比攻擊力', hl: ['slot-0-0', 'slot-1-2'] },
            { opp: { stage: ['T12', null, 'T03@y:rev', null, 'T14'] }, caption: '4500 對 4000：攻擊力低的一方倒置', hl: ['slot-1-2'], ms: 2800 },
          ],
        },
        body: [
          '如果是**正打**，傷害之後還有**戰鬥**：比較兩個角色的攻擊力，低的一方**倒置**（被打倒）；一樣高就兩邊都倒置。',
          '倒置的角色會在安可階段放進休息室（除非付費安可）。',
          '側打和直接攻擊沒有戰鬥，傷害之後就結束了。',
        ],
      },
      {
        title: '反擊：助太刀',
        visual: { kind: 'card', id: 'BTR/W107-T06', spots: ['text'] },
        body: [
          '被**正打**的時候，防守方在判定之後可以使用一次**反擊**。最常見的是「**助太刀**」：從手牌把這張卡放進休息室，讓被攻擊的角色攻擊力增加，反過來打倒對方。',
          '這張的助太刀：付 1 張能量，攻擊力 +2000（自己要 1 級以上才能用）。',
          '對戰中有可以用的反擊時，畫面會跳出來問你，10 秒內沒回應就當作不使用。',
        ],
      },
      {
        title: '判定圖示一覽',
        visual: {
          kind: 'cards',
          cards: [
            { id: 'BTR/W107-T08', label: '魂' },
            { id: 'BTR/W107-T11', label: '選擇' },
            { id: 'BD/W125-T07', label: '金條' },
            { id: 'BD/W125-T18', label: '木門' },
          ],
        },
        body: [
          '・**魂**：這次攻擊魂傷 +1（名場面常有 2 個）。',
          '・**選擇**：可以從休息室選 1 張有「魂」圖示的角色，放到手牌或能量。',
          '・**金條**：這張卡回到手牌，之後可以把牌組最上面 1 張放進能量。',
          '・**木門**：可以從休息室選 1 張角色回到手牌。',
          '・**門**：可以從休息室選 1 張名場面回到手牌。',
          '・**錢袋**：可以把牌組最上面 1 張放進能量；**書本**：可以抽 1 張；**旋風**：可以讓對手 1 個角色回到手牌。',
          '圖示的意思對戰時也會在提示和紀錄裡寫出來，不用背。',
        ],
      },
    ],
  },
  {
    title: '重洗',
    slides: [
      {
        title: '牌組用完了怎麼辦？',
        visual: {
          kind: 'board',
          frames: [
            { me: { deck: 1, deckTop: ['T08@z'], hand: [], stage: ['T04', 'T16', 'T05', 'T06', null], stock: 3, clock: ['T13', 'T09'], level: ['T07', 'T18'], waiting: ['T02', 'T14', 'T03', 'T11', 'T12', 'T01'] }, opp: MID_OPP, caption: '牌組只剩 1 張…', hl: ['deck-0'] },
            { me: { deck: 0, hand: ['T08@z'] }, caption: '抽完了！', ms: 1200 },
            { me: { deck: 6, deckTop: ['T20@pen'], waiting: [] }, shuffle: { p: 0, refresh: true }, caption: '重洗：休息室全部洗回牌組', ms: 2200 },
            { me: { deck: 5, clock: ['T13', 'T09', 'T20@pen'] }, caption: '重洗懲罰：牌組最上面 1 張放進傷害區', hl: ['clock-0'], ms: 2800 },
          ],
          hand: true,
        },
        body: [
          '牌組沒有卡時要**重洗**：把休息室的卡全部洗回牌組，然後把牌組最上面 1 張放進傷害區（重洗的懲罰，等於受 1 點傷害）。',
          '小知識：取消傷害時翻到的名場面、用過的名場面都在休息室，重洗後會回到牌組。所以休息室的名場面越多，重洗後的牌組越容易取消傷害。',
        ],
      },
    ],
  },
  {
    title: '看懂卡片效果',
    slides: [
      {
        title: '【永】【自】【起】',
        visual: { kind: 'card', id: 'BTR/W107-T08', spots: ['text'] },
        body: [
          '卡片效果的開頭有一個標記，告訴你這個效果什麼時候有效：',
          '・**【永】**：一直有效。例：「你的回合中，這張攻擊力 +1500」。',
          '・**【自】**：條件達成時自動發動。例：「這張攻擊時，…」。',
          '・**【起】**：自己選時機使用，通常要付費用。例：「［① 這張橫置］…」。',
          '這張是【永】：你的回合中，你的其他《音樂》角色每有 1 張，這張攻擊力 +1500。',
        ],
      },
      {
        title: '常見關鍵字',
        visual: {
          kind: 'cards',
          cards: [
            { id: 'BTR/W107-T07', label: '應援' },
            { id: 'BTR/W107-T13', label: '絆' },
            { id: 'BTR/W107-T02', label: '集中' },
            { id: 'BTR/W107-T04', label: 'CX 連動' },
          ],
        },
        body: [
          '・**應援**：放在後列時，幫它前面的角色加攻擊力。',
          '・**絆**：從手牌打出時，可以付費用把指定卡名的卡從休息室拿回手牌。',
          '・**助太刀**：對手正打時從手牌使用，讓被攻擊的角色攻擊力增加。',
          '・**集中**：翻開牌組上面幾張放進休息室，每翻到 1 張名場面就有額外效果。',
          '・**CX 連動**：名場面區有指定的名場面時，這張攻擊就會發動效果。',
          '對戰時點卡片，預覽下方會列出相關的卡（例如 CX 連動的名場面），找搭配很方便。',
        ],
      },
    ],
  },
  {
    title: '開始對戰吧！',
    slides: [
      {
        title: '和朋友開一局',
        visual: { kind: 'hero' },
        body: [
          '・大廳按「**建立遊戲**」，選好牌組，會拿到一組 **6 位數代碼**。',
          '・把代碼傳給朋友，朋友按「**加入遊戲／觀戰**」輸入代碼。',
          '・朋友按「準備」，你按「遊戲開始」。',
          '其他朋友也可以用同一組代碼來觀戰（看不到任何一方的手牌）。',
        ],
      },
      {
        title: '對戰操作',
        visual: { kind: 'board', frames: [mid({ hl: ['hand', 'stage-0'] })], hand: true },
        body: [
          '・**拖曳**手牌到舞台出牌；時計階段拖到傷害區。',
          '・**點一下**卡片，左邊會顯示大圖和中文效果。',
          '・**點前列角色**選攻擊方式。',
          '・右側的對戰紀錄寫著雙方做了什麼；不知道下一步時，看畫面上方的提示。',
          '就這樣！剩下的在實戰中慢慢熟悉，祝你玩得開心！',
        ],
      },
    ],
  },
];

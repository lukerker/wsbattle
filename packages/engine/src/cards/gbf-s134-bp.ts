// 碧藍幻想 補充包 GBF/S134-001～116、PR 卡 P01～P03。
// 117～132、133S～144S 是同一張卡的其他卡號（PR、再錄），效果完全相同，只收錄原本的卡號（見 duplicates）。
// 093 和 096 同名「時竜 オロロジャイア」但效果不同，兩張都收錄。
// 日文原文取自官方卡表（data/cards/GBF-S134.json）。角色與特徵譯名暫用，之後可能統一調整。
import type { Ability, Card, CardFilter, Condition, Cost, Effect, Selector, Text } from '../card-schema.ts';

const SERIES = 'GBF';
export const source = '官方卡表';
const t = (ja: string, zh: string): Text => ({ ja, zh });

const GB = 'グラブル';
const gb: CardFilter = { type: 'character', trait: GB };
const chara: CardFilter = { type: 'character' };
const traitChar = (trait: string): CardFilter => ({ type: 'character', trait });
const jyuuni = traitChar('十二神将');

const self: Selector = { zone: 'stage', side: 'self', count: 'all', relation: 'source' };
const selfInWR: Selector = { zone: 'waitingRoom', side: 'self', count: { exactly: 1 }, relation: 'source' };
const stage = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: 'all' });
const others = (filter?: CardFilter): Selector => stage({ ...filter, excludeSource: true });
const mine = (filter?: CardFilter, n = 1): Selector => ({ zone: 'stage', side: 'self', filter, count: { exactly: n } });
const mineUpTo = (n: number, filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: { upTo: n } });
const opp = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'opponent', filter, count: { exactly: 1 } });
const battleOpp: Selector = { zone: 'stage', side: 'opponent', count: { exactly: 1 }, relation: 'battleOpponentOfSource' };
const inBattle = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: { exactly: 1 }, relation: 'inBattleWithSource' });
const target: Selector = { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'triggerTarget' };
const wr = (filter?: CardFilter): Selector => ({ zone: 'waitingRoom', side: 'self', filter, count: { exactly: 1 } });
const wrUpTo = (n: number, filter?: CardFilter): Selector => ({ zone: 'waitingRoom', side: 'self', filter, count: { upTo: n } });
const hand = (filter?: CardFilter, n = 1): Selector => ({ zone: 'hand', side: 'self', filter, count: { exactly: n } });
const deckTop = (n: number): Selector => ({ zone: 'deck', side: 'self', count: { exactly: n }, fromTop: n });
const deckTopUpTo = (n: number): Selector => ({ zone: 'deck', side: 'self', count: { upTo: n }, fromTop: n });
const clockTop = (n = 1, upTo = false): Selector => ({ zone: 'clock', side: 'self', count: upTo ? { upTo: n } : { exactly: n }, fromTop: n });
const cxZone = (name: string): Selector => ({ zone: 'climaxZone', side: 'self', filter: { name }, count: { exactly: 1 } });
const toHand = { zone: 'hand' as const, side: 'self' as const };
const toWR = { zone: 'waitingRoom' as const, side: 'self' as const };
const toStock = { zone: 'stock' as const, side: 'self' as const };
const toMemory = { zone: 'memory' as const, side: 'self' as const };
const toOwnerHand = { zone: 'hand' as const };
const toOwnerWR = { zone: 'waitingRoom' as const };
const toOwnerStock = { zone: 'stock' as const };
const toOwnerDeckBottom = { zone: 'deck' as const };
const anySlot = { zone: 'stage' as const, side: 'self' as const, slot: 'any' as const };
const emptyFront = { zone: 'stage' as const, side: 'self' as const, row: 'front' as const };
const emptySlot = { zone: 'stage' as const, side: 'self' as const };

const power = (tg: Selector, amount: Extract<Effect, { op: 'modifyPower' }>['amount'], duration: 'thisTurn' | 'whileActive' | 'untilNextOpponentTurnEnd' = 'thisTurn'): Effect => ({ op: 'modifyPower', target: tg, amount, duration });
const move = (from: Selector, to: Extract<Effect, { op: 'moveCards' }>['to'], bind?: string): Effect => ({ op: 'moveCards', from, to, ...(bind ? { bind } : {}) });
const discardHand = (filter?: CardFilter, n = 1): Cost => ({ kind: 'discard', selector: hand(filter, n) });
const stock = (n: number): Cost => ({ kind: 'stock', n });
const placed = { event: 'placedFromHandToStage' as const };
const attacks = { event: 'attacks' as const };
const leaves = { event: 'sourceLeavesStageToWaitingRoom' as const };
const attackEnd = { event: 'attackEnd' as const };
const oppReversed = { event: 'battleOpponentReversed' as const };
const cxPhase = { event: 'myClimaxPhaseStart' as const };
const mainStart = { event: 'myMainPhaseStart' as const };
const encoreSelf = { event: 'encoreStepStart' as const, side: 'self' as const };
const usedActivated = { event: 'usedActivated' as const };
const myTurn: Condition = { kind: 'myTurn' };
const levelAtLeast = (n: number): Condition => ({ kind: 'levelAtLeast', n });
const othersAtLeast = (n: number, filter: CardFilter = gb): Condition => ({ kind: 'countAtLeast', selector: others(filter), n });
const countAtLeast = (n: number, filter: CardFilter): Condition => ({ kind: 'countAtLeast', selector: stage(filter), n });
const allGb: Condition = { kind: 'allMine', filter: { trait: GB } };
const inFront: Condition = { kind: 'sourceInSlot', slots: [0, 1, 2] };
const all = (...of: Condition[]): Condition => ({ kind: 'all', of });
const cxIn = (name: string): Condition => ({ kind: 'climaxInZone', name });
const handLevelDown = (condition: Condition, ja: string, zh: string): Ability => ({
  kind: 'continuous', activeIn: 'hand', condition, effects: [{ op: 'modifyLevel', target: self, amount: -1, duration: 'whileActive' }], text: t(ja, zh),
});
const heal = (optional: boolean): Ability => ({
  kind: 'auto', trigger: placed, optional, effects: [move(clockTop(), toWR)],
  text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚を、控え室に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以將自己的傷害區上方1張，放到休息室。'),
});
const encore = (cost: Cost[], ja: string, zh: string): Ability => ({
  kind: 'auto', keyword: { id: 'encore' }, trigger: leaves, optional: true, cost, effects: [{ op: 'returnSourceToSlot', state: 'rest' }], text: t(ja, zh),
});
const ENCORE_CHAR = encore([discardHand(chara)], '【自】アンコール［手札のキャラを1枚控え室に置く］', '【自】安可［手牌的角色1張放到休息室］');
const ENCORE_GB = encore([discardHand(gb)], '【自】アンコール［手札の《グラブル》のキャラを1枚控え室に置く］', '【自】安可［手牌的《碧藍幻想》的角色1張放到休息室］');
const ENCORE_STAGE = encore([stock(1), { kind: 'discard', selector: mine(chara) }], '【自】アンコール［① あなたの舞台のキャラを1枚控え室に置く］', '【自】安可［① 將你的舞台的角色1張放到休息室］');
const ENCORE_2: Ability = encore([stock(2)], '【自】アンコール［②］', '【自】安可［②］');
const myTurnPower = (n: number): Ability => ({
  kind: 'continuous', condition: myTurn, effects: [power(self, n, 'whileActive')],
  text: t(`【永】あなたのターン中、このカードのパワーを＋${n}。`, `【永】在你的回合中，此卡的攻擊力+${n}。`),
});
const backup = (pw: number, level: number, ja: string, zh: string): Ability => ({
  kind: 'activated', keyword: { id: 'backup', power: pw, level }, timing: 'counter',
  cost: [stock(1), { kind: 'discardSource' }], effects: [power(inBattle(), pw)], text: t(ja, zh),
});
const backupText = (pw: number, level: number) => [
  `【起】【カウンター】助太刀${pw} レベル${level}［① 手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋${pw}）`,
  `【起】【反擊】助太刀${pw} 等級${level}［① 手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+${pw})`,
] as const;
const DOUBLE_CHECK: Ability = {
  kind: 'auto', trigger: attacks, optional: true, cost: [stock(1)], effects: [{ op: 'extraTriggerCheck' }],
  text: t('【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。', '【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行2次判定。'),
};
const DOUBLE_CHECK_PAY: Ability = {
  kind: 'auto', trigger: attacks, effects: [{ op: 'extraTriggerCheck', thenStockTopToWaiting: true }],
  text: t('【自】このカードがアタックした時、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。2回行ったら、あなたは自分のストックの上から1枚を、控え室に置く。',
    '【自】此卡攻擊時，在那次攻擊中，你在判定階段執行2次判定。執行了2次的話，你將自己的能量區上方1張，放到休息室。'),
};
const ruleText = (text: [string, string]): Ability => ({
  kind: 'continuous', effects: [], text: t(...text), // 構築規則（sameNameAs），遊戲中沒有效果
});
// 戰鬥對手放到它主人的能量區，再把對手能量區最下面 1 張放到休息室
const toStockThenBottom: Effect[] = [
  move(battleOpp, toOwnerStock),
  move({ zone: 'stock', side: 'opponent', count: { exactly: 1 }, position: 'bottom' }, toOwnerWR),
];
const recoverSelf = (to: typeof emptyFront | typeof emptySlot): Effect => move(selfInWR, to);
const facingSoulDown = (n: number): Ability => ({
  kind: 'continuous', effects: [{ op: 'modifySoul', target: { zone: 'stage', side: 'opponent', count: 'all', relation: 'facingSource' }, amount: -n, duration: 'whileActive' }],
  text: t(`【永】このカードの正面のキャラのソウルを－${n}。`, `【永】此卡的正面的角色的魂傷-${n}。`),
});
const climax = (trigger: 'choice' | 'treasure' | 'comeback' | 'gate'): Ability => ({
  kind: 'continuous',
  effects: [
    { op: 'modifyPower', target: stage(), amount: 1000, duration: 'whileActive' },
    { op: 'modifySoul', target: stage(), amount: 1, duration: 'whileActive' },
  ],
  text: {
    choice: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【チョイス】：このカードがトリガーした時、あなたは自分の控え室のトリガーアイコンに【ソウル】があるキャラを1枚選び、手札に戻すかストック置場に置いてよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(選擇：當你判定出此卡時，你可以選擇自己休息室的判定標誌有魂傷的角色1張，回到手牌或放到能量區)'),
    treasure: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【トレジャー】：このカードがトリガーした時、あなたはこのカードを手札に戻す。あなたは自分の山札の上から1枚を、ストック置場に置いてよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(金條：當你判定出此卡時，你將此卡回到手牌。你可以將自己的牌組上方1張，放到能量區)'),
    comeback: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【カムバック】：このカードがトリガーした時、あなたは自分の控え室のキャラを1枚選び、手札に戻してよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(木門：當你判定出此卡時，你可以選擇自己休息室的1張角色，回到手牌)'),
    gate: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【ゲート】：このカードがトリガーした時、あなたは自分の控え室のCXを1枚選び、手札に戻してよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(門：當你判定出此卡時，你可以選擇自己休息室的1張名場面，回到手牌)'),
  }[trigger],
});
const drawClimax: Ability[] = [{
  kind: 'auto', trigger: { event: 'placedToClimaxZone' },
  effects: [{ op: 'draw', upTo: 1 }, { op: 'modifySoul', target: mineUpTo(2), amount: 1, duration: 'thisTurn' }],
  text: t('【自】このカードが手札からCX置場に置かれた時、あなたは1枚まで引き、自分のキャラを2枚まで選び、そのターン中、ソウルを＋1。（【ドロー】：このカードがトリガーした時、あなたは1枚引いてよい）',
    '【自】此卡從手牌被放置到名場面區時，你抽最多1張牌，選擇自己的角色最多2張，在那個回合中，魂傷+1。(書本：當你判定出此卡時，你可以抽1張牌)'),
}];

const T = {
  gb: t(GB, '碧藍幻想'),
  rokuryu: t('六竜', '六龍'),
  tenshi: t('天司', '天司'),
  jyuuten: t('十天衆', '十天眾'),
  jyukken: t('十賢者', '十賢者'),
  jyuuni: t('十二神将', '十二神將'),
  moon: t('月', '月'),
  wales: t('ウェールズ', '威爾斯'),
  datenshi: t('堕天司', '墮天司'),
  soshiki: t('組織', '組織'),
  hoshi: t('星の民', '星之民'),
  feendrache: t('フェードラッヘ', '菲德拉赫'),
  grancypher: t('グランサイファー', '古蘭賽法'),
};

const N = {
  sandalphonL3: '荘重たる十二枚羽 サンダルフォン',
  sandalphon: '復讐の天司 サンダルフォン',
  lucifel: '進化の天司 ルシフェル',
  lucio: '暁の裁定者 ルシオ',
  bikaraN: '北の守護神 ビカラ',
  bikaraP: '祭夜の子神 ビカラ',
  galleon: '六竜の『金』 ガレヲン',
  siegfried: '払暁の忠騎士 ジークフリート',
  percival: '高潔なる燦炎 パーシヴァル',
  lancelotL3: '俊英の双剣士 ランスロット',
  lancelotL1: '忠誓の騎士団長 ランスロット',
  vane: '不撓不屈の騎士 ヴェイン',
  lucifer: '星の民 ルシファー',
  haseliera: '欺瞞の女教皇 ハーゼリーラ',
  cxItteki: 'いってきます！',
  cxItterasshai: 'いってらっしゃい。',
  cxTriple: 'トリプルゼロ',
  cxKusabi: '蒼空の楔',
  cxSoraMamoru: '空を守らんとする者達',
  cxTabi: '旅の終わり',
  cxMizu: 'みずキャン',
  cxNekogami: '猫神の因縁の巻',
  cxJyuuten: '空の安寧を守りし十天衆',
  cxDragon: 'ドラゴンナイツ',
  cxTatakai: '戦いの後に',
  cxKimito: '君と紡ぐ、空の物語',
  cxJyukken: '十賢者',
  cxFeendrache: 'フェードラッヘの騎士達',
  cxOrolo: 'オロロジャイア',
  cxHimitsu: '秘密の趣味',
  shikishi: '四騎士',
};

const pending = { translated: true, coded: true, verified: false, tested: true }; // 情境測試：game/cards-gbf-bp.test.ts

export const duplicates: Record<string, string> = {
  ...Object.fromEntries([
    ['117', '021'], ['118', '022'], ['119', '023'], ['120', '024'], ['121', '051'], ['122', '052'], ['123', '053'], ['124', '054'],
    ['125', '084'], ['126', '085'], ['127', '086'], ['128', '112'], ['129', '113'], ['130', '114'], ['131', '115'], ['132', '116'],
    ['133', '001'], ['134', '002'], ['135', '025'], ['136', '026'], ['137', '027'], ['138', '055'], ['139', '056'], ['140', '057'],
    ['141', '058'], ['142', '087'], ['143', '088'], ['144', '089'],
  ].map(([a, b]) => [`GBF/S134-${a}`, `GBF/S134-${b}`])),
};

type Color = Card['color'];
const char = (n: string, color: Color, name: [string, string], level: number, cost: number, pw: number, soul: number, triggers: Card['triggers'], traits: Text[], abilities: Ability[], note: string, extra: Partial<Card> = {}): Card => ({
  id: `GBF/S134-${n}`, series: SERIES, name: t(...name), type: 'character', color, level, cost, power: pw, soul, triggers, traits, abilities, note, status: pending, ...extra,
});
const cx = (n: string, name: [string, string], color: Color, triggers: Card['triggers'], abilities: Ability[], note: string): Card => ({
  id: `GBF/S134-${n}`, series: SERIES, name: t(...name), type: 'climax', color, triggers, traits: [], abilities, note, status: pending,
});
const ev = (n: string, name: [string, string], color: Color, level: number, cost: number, abilities: Ability[], note: string, extra: Partial<Card> = {}): Card => ({
  id: `GBF/S134-${n}`, series: SERIES, name: t(...name), type: 'event', color, level, cost, triggers: [], traits: [], abilities, note, status: pending, ...extra,
});

// 001 / P03 共通
const galleonAbilities: Ability[] = [
  { kind: 'continuous', rules: ['untargetable'], effects: [], text: t('【永】このカードは相手の効果に選ばれない。', '【永】此卡不會被對手的效果選擇。') },
  {
    kind: 'auto', trigger: { event: 'concentrateHitClimax' }, perTurn: 1, optional: true, condition: levelAtLeast(2),
    cost: [stock(1), { kind: 'sourceToDeckBottom' }], effects: [{ op: 'dealDamage', amount: 1, cancelable: true }],
    text: t('【自】【ターン1】［① このカードを山札の下に置く］あなたのレベルが2以上で、あなたが『集中』を使った時、その効果でCXが控え室に置かれたなら、あなたはコストを払ってよい。そうしたら、相手に1ダメージを与える。（ダメージキャンセルは発生する）',
      '【自】【每回合1次】［① 將此卡放到牌組下方］你的等級在2以上，當你使用『集中』時，那個效果讓名場面放到休息室的話，你可以支付代價。支付代價的話，給對手1點傷害。(會發生傷害取消)'),
  },
  {
    kind: 'activated', keyword: { id: 'concentrate' }, cost: [stock(1), { kind: 'restSource' }],
    effects: [
      { op: 'revealMill', n: 4, bind: 'milled', result: 'count' },
      { op: 'repeat', times: { countOfBound: 'milled', filter: { type: 'climax' } }, effects: [move(wrUpTo(1, chara), toHand)] },
    ],
    text: t('【起】集中［① このカードを【レスト】する］あなたは自分の山札の上から4枚をめくり、控え室に置く。それらのカードのCX1枚につき、あなたは自分の控え室のキャラを1枚まで選び、手札に戻す。',
      '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻4張，放到休息室。那些卡片中每有1張名場面，你選擇自己休息室的角色最多1張，回到手牌。'),
  },
];
// 026 / P02 共通
const bikaraAbilities: Ability[] = [
  {
    kind: 'continuous', condition: othersAtLeast(2), effects: [power(self, 5000, 'whileActive')],
    text: t('【永】他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋5000。', '【永】其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+5000。'),
  },
  {
    kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxMizu }, trigger: encoreSelf, condition: all(cxIn(N.cxMizu), inFront, othersAtLeast(1)),
    effects: [{
      op: 'eachInOrder', options: [
        { label: '可以把牌組上方3張放到休息室', effects: [{ op: 'may', prompt: '要把牌組上方3張放到休息室嗎', then: [move(deckTop(3), toWR)] }] },
        { label: '從牌組找《十二神將》角色最多1張', effects: [{ op: 'searchDeck', filter: jyuuni, upTo: 1, reveal: true, shuffle: true }] },
      ],
    }],
    text: t('【自】【CXコンボ】あなたのアンコールステップの始めに、CX置場に「みずキャン」があり、前列にこのカードがいて、他のあなたの《グラブル》のキャラがいるなら、次の2つの効果を好きな順番で1回ずつ行う。『あなたは自分の山札の上から3枚を、控え室に置いてよい。』『あなたは自分の山札を見て《十二神将》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。』',
      '【自】【CX連動】在你的安可步驟開始時，名場面區有「水上露營」，此卡在前列，有其他的你的《碧藍幻想》的角色存在的話，以喜歡的順序各執行1次以下2個效果。『你可以將自己的牌組上方3張，放到休息室。』『你從自己的牌組選擇《十二神將》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。』'),
  },
];
// 004 / 016 的記憶
const memoryMarker: Ability = {
  kind: 'auto', activeIn: 'memory', trigger: { event: 'allyAttacks', filter: { name: N.sandalphonL3 } }, optional: true,
  effects: [{ op: 'addMarker', from: { zone: 'memory', side: 'self', count: { exactly: 1 }, relation: 'source' }, to: 'triggerTarget', faceUp: true }],
  text: t('【自】記憶 思い出置場にこのカードがあるなら、あなたの「荘重たる十二枚羽 サンダルフォン」がアタックした時、あなたはこのカードをそのキャラの下にマーカーとして表向きに置いてよい。',
    '【自】記憶 此卡在回憶區的話，當你的「莊重的十二枚羽 聖德芬」攻擊時，你可以將此卡正面朝上放到那張角色下面當標記。'),
};
// 「控え室にこのカードがあるなら、…始めに、…このカードを…枠に置く」
const fromWaitingRoom = (trigger: Ability['trigger'], condition: Condition | undefined, cost: Cost[], to: typeof emptyFront | typeof emptySlot, then: Effect[], ja: string, zh: string): Ability => ({
  kind: 'auto', activeIn: 'waitingRoom', trigger, optional: true, ...(condition ? { condition } : {}), cost, effects: [recoverSelf(to), ...then], text: t(ja, zh),
});

export const cards: Card[] = [
  char('001', 'yellow', [N.galleon, '六龍之『金』 加雷翁'], 0, 0, 500, 1, [], [T.gb, T.rokuryu], galleonAbilities,
    '不會被對手的效果選擇。集中：翻4張，每張名場面撿回1張角色。等級2以上時，用集中翻到名場面，就能付1能量把她放到牌組最下面，給對手1點傷害（每回合1次）。'),
  char('002', 'yellow', [N.sandalphonL3, '莊重的十二枚羽 聖德芬'], 3, 2, 8500, 2, ['soul'], [T.gb, T.tenshi], [
    {
      kind: 'auto', trigger: placed, effects: [move(clockTop(1, true), toWR), power(self, 3000)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚までを、控え室に置き、そのターン中、このカードのパワーを＋3000。', '【自】此卡從手牌被放置到舞台時，你將自己的傷害區上方最多1張，放到休息室，在那個回合中，此卡的攻擊力+3000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxTriple }, trigger: attackEnd, optional: true,
      condition: all(cxIn(N.cxTriple), othersAtLeast(3)), cost: [stock(1), discardHand(gb)],
      effects: [
        { op: 'toDeckTopOrdered', from: { zone: 'waitingRoom', side: 'opponent', count: 'all' }, max: { distinctMarkerNames: true } },
        { op: 'dealDamage', amount: 4, cancelable: true },
      ],
      text: t('【自】【CXコンボ】［① 手札の《グラブル》のキャラを1枚控え室に置く］このカードのアタックの終わりに、CX置場に「トリプルゼロ」があり、他のあなたの《グラブル》のキャラが3枚以上なら、あなたはコストを払ってよい。そうしたら、あなたは相手の控え室のカードをＸ枚まで選び、山札の上に好きな順番で置き、相手に4ダメージを与える。Ｘはこのカードの下の異なるカード名のマーカーの枚数に等しい。（ダメージキャンセルは発生する）',
        '【自】【CX連動】［① 手牌的《碧藍幻想》的角色1張放到休息室］此卡的攻擊結束時，名場面區有「三零」，其他的你的《碧藍幻想》的角色存在3張以上的話，你可以支付代價。支付代價的話，你選擇對手休息室的卡片最多X張，以喜歡的順序放到牌組上方，給對手4點傷害。X等於此卡下面的不同卡名的標記張數。(會發生傷害取消)'),
    },
  ], '登場回1血、這回合11500。連動名場面「三零」：攻擊完付1能量丟1張，先把對手休息室最多X張（X＝她下面不同卡名的標記數，靠「進化的天司 路西菲爾」「復讐的天司 聖德芬」的記憶放）排到對手牌組上方（例如非名場面），再給4點傷害。'),
  char('003', 'yellow', ['六竜の『白』 ル・オー', '六龍之『白』 路·歐'], 0, 0, 2000, 1, [], [T.gb, T.rokuryu], [{
    kind: 'auto', trigger: placed, alsoOn: leaves, optional: true, cost: [stock(1), discardHand()],
    effects: [{ op: 'searchDeck', filter: gb, upTo: 1, reveal: true, shuffle: true }],
    text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時か舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
      '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時或從舞台被放到休息室時，你可以支付代價。支付代價的話，你從自己的牌組選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
  }], '登場、進休息室時各可以付1能量丟1張，從牌組找1張《碧藍幻想》角色。'),
  char('004', 'yellow', [N.lucifel, '進化的天司 路西菲爾'], 1, 0, 2500, 1, ['soul'], [T.gb, T.tenshi], [
    {
      kind: 'continuous', condition: all(myTurn, othersAtLeast(2)), effects: [power(self, 4000, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋4000。', '【永】在你的回合中，其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+4000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxItterasshai }, trigger: attacks, condition: all(cxIn(N.cxItterasshai), allGb),
      effects: [{ op: 'lookTopPick', look: 6, pick: { filter: gb, upTo: 1 }, rest: 'waitingRoom' }],
      text: t('【自】【CXコンボ】このカードがアタックした時、CX置場に「いってらっしゃい。」があり、あなたのキャラすべてが《グラブル》なら、あなたは自分の山札を上から6枚まで見て、《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
        '【自】【CX連動】此卡攻擊時，名場面區有「路上小心。」，你的角色全部是《碧藍幻想》的話，你從自己的牌組上方看最多6張，選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      review: ['「6枚まで見て」：目前固定看 6 張。'],
    },
    memoryMarker,
  ], '自己回合有2張以上其他《碧藍幻想》角色時是6500。連動名場面「路上小心。」：攻擊時看6張拿1張。記憶：在回憶區時，「莊重的十二枚羽 聖德芬」攻擊時可以把她放到聖德芬下面當標記。'),
  char('005', 'yellow', [N.lucio, '曉之裁定者 盧西歐'], 3, 2, 8000, 2, ['soul'], [T.gb], [
    handLevelDown(countAtLeast(4, gb), '【永】あなたの《グラブル》のキャラが4枚以上なら、あなたの手札のこのカードのレベルを－1。', '【永】你的《碧藍幻想》的角色存在4張以上的話，你的手牌的此卡的等級-1。'),
    {
      kind: 'continuous', condition: othersAtLeast(2),
      effects: [
        power(self, 2000, 'whileActive'),
        {
          op: 'grantAbility', target: self, duration: 'whileActive',
          ability: {
            kind: 'auto', trigger: leaves, optional: true, effects: [move(selfInWR, toMemory)],
            text: t('【自】このカードが舞台から控え室に置かれた時、あなたはこのカードを思い出にしてよい。', '【自】此卡從舞台被放到休息室時，你可以將此卡放到回憶區。'),
          },
        },
      ],
      text: t('【永】他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋2000し、このカードは次の能力を得る。『【自】このカードが舞台から控え室に置かれた時、あなたはこのカードを思い出にしてよい。』',
        '【永】其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+2000，此卡獲得以下能力。『【自】此卡從舞台被放到休息室時，你可以將此卡放到回憶區。』'),
    },
    heal(true),
  ], '場上有4張以上《碧藍幻想》角色時，手牌的他算Lv2。其他2張以上時是10000，進休息室時可以放到回憶區（給「再臨的墮天之王 路西法」當標記用）。登場回1血。'),
  char('006', 'yellow', ['神秘の天司 ラジエル', '神秘的天司 拉吉爾'], 0, 0, 500, 1, [], [T.gb, T.tenshi], [{
    kind: 'auto', trigger: placed, optional: true, cost: [discardHand({ type: 'climax', hasTrigger: 'choice' })],
    effects: [move(wr({ type: 'climax', hasTrigger: 'choice' }), toHand)],
    text: t('【自】［手札のトリガーアイコンが【チョイス】のCXを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のトリガーアイコンが【チョイス】のCXを1枚選び、手札に戻す。',
      '【自】［手牌的判定標誌是選擇的名場面1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的判定標誌是選擇的名場面1張，回到手牌。'),
  }], '登場時丟1張選擇名場面，換回休息室的另一張選擇名場面（換成需要的連動名場面）。'),
  char('007', 'yellow', ['十天衆 ソーン', '十天眾 索恩'], 0, 0, 1000, 1, [], [T.gb, T.jyuuten], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'noStandNext', target: opp({ row: 'back', levelAboveOwnerLevel: true }) }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手の後列の、レベルが相手のレベルより高いキャラを1枚選ぶ。そのキャラは次の相手のスタンドフェイズに【スタンド】しない。', '【自】此卡從手牌被放置到舞台時，你選擇對手的後列的等級比對手的等級高的角色1張。那張角色在下次的對手的起立階段不【直立】。'),
    },
    {
      kind: 'auto', trigger: placed,
      effects: [{ op: 'grantAbility', target: opp(), duration: 'untilNextOpponentTurnEnd', ability: { kind: 'continuous', rules: ['cannotMove'], effects: [], text: t('【永】このカードは他の枠に動かせない。', '【永】此卡不能移動到其他格子。') } }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手のキャラを1枚選び、次の相手のターンの終わりまで、次の能力を与える。『【永】このカードは他の枠に動かせない。』', '【自】此卡從手牌被放置到舞台時，你選擇對手的角色1張，到下次的對手回合結束前，給予以下能力。『【永】此卡不能移動到其他格子。』'),
    },
  ], '登場時讓對手後列1張「等級比對手玩家等級高」的角色下回合不能直立，另外讓對手1張角色到對手回合結束都不能換位置。'),
  char('008', 'yellow', ['十天衆 オクトー', '十天眾 奧克托'], 0, 0, 1000, 1, [], [T.gb, T.jyuuten], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1), discardHand({ type: 'climax' })], effects: [move(wr({ type: 'climax' }), toHand)],
      text: t('【自】［① 手札のCXを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のCXを1枚選び、手札に戻す。', '【自】［① 手牌的名場面1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的名場面1張，回到手牌。'),
    },
    {
      kind: 'auto', trigger: { event: 'reversedInBattle' }, optional: true, condition: { kind: 'battleOpponentLevelAtMost', n: 0 }, effects: toStockThenBottom,
      text: t('【自】このカードが【リバース】した時、このカードのバトル相手のレベルが0以下なら、あなたはそのキャラをストック置場に置いてよい。そうしたら、あなたは相手のストックの下から1枚を、控え室に置く。', '【自】此卡【倒置】時，此卡的戰鬥對手的等級在0以下的話，你可以將那張角色放到能量區。這麼做的話，你將對手的能量區下方1張，放到休息室。'),
      review: ['「ストック置場に置く」：放到那張角色主人（對手）的能量區。'],
    },
  ], '登場付1能量丟1張名場面，換回休息室的名場面。被Lv0角色打倒時，把它放到對手的能量區，再把對手能量區最下面1張丟掉（對手能量裡的名場面會跑到上面）。'),
  char('009', 'yellow', ['怒涛の戦車 ガイゼンボーガ', '怒濤的戰車 蓋森博加'], 0, 0, 1500, 1, [], [T.gb, T.jyukken], [
    { kind: 'continuous', rules: ['cannotSideAttack'], effects: [], text: t('【永】このカードはサイドアタックできない。', '【永】此卡不能側打。') },
    fromWaitingRoom(cxPhase, undefined, [discardHand(gb)], emptyFront, [],
      '【自】［手札の《グラブル》のキャラを1枚控え室に置く］控え室にこのカードがあるなら、あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを前列のキャラのいない枠に置く。',
      '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡在休息室的話，在你的名場面階段開始時，你可以支付代價。支付代價的話，你將此卡放到前列的沒有角色的格子。'),
    {
      kind: 'auto', trigger: { event: 'placedFromWaitingRoom' }, condition: all(myTurn, othersAtLeast(1)), effects: [power(self, 4000)],
      text: t('【自】あなたのターン中、このカードが控え室から舞台に置かれた時、他のあなたの《グラブル》のキャラがいるなら、そのターン中、このカードのパワーを＋4000。', '【自】在你的回合中，此卡從休息室被放置到舞台時，有其他的你的《碧藍幻想》的角色存在的話，在那個回合中，此卡的攻擊力+4000。'),
    },
  ], '不能側打。在休息室時，名場面階段開始時丟1張《碧藍幻想》角色就能自己回到前列空格，這回合5500。'),
  char('010', 'yellow', ['十天衆 フュンフ', '十天眾 馮芙'], 1, 0, 2500, 1, ['soul'], [T.gb, T.jyuuten], [
    {
      kind: 'continuous', condition: myTurn, effects: [power(others(gb), 1000, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラすべてに、パワーを＋1000。', '【永】在你的回合中，其他的你的《碧藍幻想》的角色全部，攻擊力+1000。'),
    },
    {
      kind: 'activated', cost: [stock(2), { kind: 'restSource' }], effects: [move(clockTop(), toWR)],
      text: t('【起】［② このカードを【レスト】する］あなたは自分のクロックの上から1枚を、控え室に置く。', '【起】［② 將此卡【橫置】］你將自己的傷害區上方1張，放到休息室。'),
    },
  ], '自己回合其他《碧藍幻想》角色+1000。【起】：付2能量並橫置，回1血。'),
  char('011', 'yellow', ['忘却の愚者 カイム', '忘卻的愚者 凱姆'], 1, 1, 3500, 1, [], [T.gb, T.jyukken], [
    {
      kind: 'continuous', condition: allGb,
      effects: [{ op: 'grantAbility', target: self, duration: 'whileActive', ability: myTurnPower(5000) }, { op: 'grantAbility', target: self, duration: 'whileActive', ability: ENCORE_CHAR }],
      text: t('【永】あなたのキャラすべてが《グラブル》なら、このカードは次の2つの能力を得る。『【永】あなたのターン中、このカードのパワーを＋5000。』『【自】アンコール［手札のキャラを1枚控え室に置く］』', '【永】你的角色全部是《碧藍幻想》的話，此卡獲得以下2個能力。『【永】在你的回合中，此卡的攻擊力+5000。』『【自】安可［手牌的角色1張放到休息室］』'),
    },
    fromWaitingRoom(cxPhase, levelAtLeast(1), [stock(1), discardHand()], emptyFront, [],
      '【自】［① 手札を1枚控え室に置く］控え室にこのカードがあり、あなたのレベルが1以上なら、あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを前列のキャラのいない枠に置く。',
      '【自】［① 手牌1張放到休息室］此卡在休息室，你的等級在1以上的話，在你的名場面階段開始時，你可以支付代價。支付代價的話，你將此卡放到前列的沒有角色的格子。'),
  ], '全隊都是《碧藍幻想》時：自己回合8500，還能丟1張手牌角色安可。在休息室時，名場面階段開始時付1能量丟1張就能回到前列空格。'),
  char('012', 'yellow', ['禍殃なる魔術師 ロベリア', '禍殃的魔術師 洛貝莉亞'], 2, 0, 5500, 1, [], [T.gb, T.jyukken], [
    fromWaitingRoom(mainStart, levelAtLeast(2), [discardHand()], emptySlot, [],
      '【自】［手札を1枚控え室に置く］控え室にこのカードがあり、あなたのレベルが2以上なら、あなたのメインフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを舞台のキャラのいない枠に置く。',
      '【自】［手牌1張放到休息室］此卡在休息室，你的等級在2以上的話，在你的主要階段開始時，你可以支付代價。支付代價的話，你將此卡放到舞台的沒有角色的格子。'),
    {
      kind: 'activated', cost: [{ kind: 'sendSourceToWaitingRoom' }], effects: [{ op: 'swapWithWaiting', target: opp({ levelAtLeast: 1 }) }],
      text: t('【起】［このカードを控え室に置く］あなたは相手のレベル1以上のキャラを1枚選び、相手は自分の控え室のレベルＸ以下のキャラを1枚選び、入れ替える。Ｘはあなたが選んだキャラのレベル－1に等しい。', '【起】［將此卡放到休息室］你選擇對手的等級1以上的角色1張，對手選擇自己休息室的等級X以下的角色1張，交換。X等於你選擇的角色的等級-1。'),
    },
  ], '在休息室時，主要階段開始時丟1張就能回到舞台空格（等級2以上）。【起】：把自己送進休息室，把對手1張角色換成它休息室低1級的角色——下回合又能自己回來。'),
  char('013', 'yellow', ['十天衆 サラーサ', '十天眾 莎拉莎'], 3, 2, 8500, 2, ['soul'], [T.gb, T.jyuuten], [
    handLevelDown({ kind: 'any', of: [
      { kind: 'countAtMost', selector: { zone: 'waitingRoom', side: 'self', filter: { type: 'climax' }, count: 'all' }, n: 2 },
      { kind: 'countAtLeast', selector: { zone: 'waitingRoom', side: 'self', filter: { type: 'climax' }, count: 'all' }, n: 6 },
    ] }, '【永】あなたの控え室のCXが2枚以下か6枚以上なら、あなたの手札のこのカードのレベルを－1。', '【永】你的休息室的名場面在2張以下或6張以上的話，你的手牌的此卡的等級-1。'),
    {
      kind: 'continuous', condition: all(myTurn, othersAtLeast(2)),
      effects: [
        power(self, 3500, 'whileActive'),
        {
          op: 'grantAbility', target: self, duration: 'whileActive',
          ability: {
            kind: 'auto', trigger: oppReversed, optional: true, effects: toStockThenBottom,
            text: t('【自】このカードのバトル相手が【リバース】した時、あなたはそのキャラをストック置場に置いてよい。そうしたら、あなたは相手のストックの下から1枚を、控え室に置く。', '【自】此卡的戰鬥對手【倒置】時，你可以將那張角色放到能量區。這麼做的話，你將對手的能量區下方1張，放到休息室。'),
          },
        },
      ],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋3500し、このカードは次の能力を得る。『【自】このカードのバトル相手が【リバース】した時、あなたはそのキャラをストック置場に置いてよい。そうしたら、あなたは相手のストックの下から1枚を、控え室に置く。』',
        '【永】在你的回合中，其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+3500，此卡獲得以下能力。『【自】此卡的戰鬥對手【倒置】時，你可以將那張角色放到能量區。這麼做的話，你將對手的能量區下方1張，放到休息室。』'),
    },
    {
      kind: 'auto', trigger: attacks, optional: true, cost: [stock(1)], effects: [{ op: 'extraTriggerCheck', n: 3 }],
      text: t('【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを3回行う。', '【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行3次判定。'),
    },
  ], '休息室名場面2張以下或6張以上時，手牌的她算Lv2。自己回合12000，打倒對手可以把它放到對手能量區並丟掉對手能量最下面1張。攻擊時付1能量判定3次。'),
  char('014', 'yellow', ['原初の星晶獣 ルシフェル', '原初的星晶獸 路西菲爾'], 0, 0, 500, 1, [], [T.gb, T.tenshi], [
    {
      kind: 'auto', trigger: { event: 'allyReversed', filter: { names: [N.sandalphon, N.lucifel] } }, perTurn: 1, optional: true,
      effects: [{ op: 'sendToMemory', from: target }],
      text: t('【自】【ターン1】他のあなたの、「復讐の天司 サンダルフォン」か「進化の天司 ルシフェル」が【リバース】した時、あなたはそのキャラを思い出にしてよい。', '【自】【每回合1次】其他的你的「復讐的天司 聖德芬」或「進化的天司 路西菲爾」【倒置】時，你可以將那張角色放到回憶區。'),
    },
    {
      kind: 'activated', keyword: { id: 'concentrate' }, cost: [stock(1), { kind: 'restSource' }],
      effects: [
        { op: 'revealMill', n: 4, bind: 'milled', result: 'count' },
        { op: 'repeat', times: { countOfBound: 'milled', filter: { type: 'climax', hasTrigger: 'choice' } }, effects: [{ op: 'lookTopPick', look: 3, pick: { filter: {}, upTo: 1 }, rest: 'waitingRoom', secret: true }] },
      ],
      text: t('【起】集中［① このカードを【レスト】する］あなたは自分の山札の上から4枚をめくり、控え室に置く。それらのカードのトリガーアイコンが【チョイス】のCX1枚につき、次の行動を行う。『あなたは自分の山札を上から3枚まで見て、カードを1枚まで選び、手札に加え、残りのカードを控え室に置く。』',
        '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻4張，放到休息室。那些卡片中判定標誌是選擇的名場面每有1張，執行以下動作。『你從自己的牌組上方看最多3張，選擇卡片最多1張，加到手牌，剩下的卡片放到休息室。』'),
      review: ['「3枚まで見て」：目前固定看 3 張。'],
    },
  ], '「復讐的天司 聖德芬」或「進化的天司 路西菲爾」被打倒時，可以把它放進回憶區（每回合1次）。集中：每翻到1張選擇名場面，就看3張任選1張。'),
  char('015', 'yellow', ['天司の郵便屋さん ハールート・マールート', '天司的郵差 哈魯特·馬魯特'], 1, 1, 1000, 1, ['soul'], [T.gb, T.tenshi], [
    {
      kind: 'auto', trigger: { event: 'usedBackup' }, optional: true, condition: allGb, effects: [move(deckTop(1), toStock)],
      text: t('【自】あなたがこのカードの『助太刀』を使った時、あなたのキャラすべてが《グラブル》なら、あなたは自分の山札の上から1枚を、ストック置場に置いてよい。', '【自】當你使用此卡的『助太刀』時，你的角色全部是《碧藍幻想》的話，你可以將自己的牌組上方1張，放到能量區。'),
    },
    backup(2000, 1, ...backupText(2000, 1)),
  ], '助太刀+2000。全隊都是《碧藍幻想》時，用了還能把牌組上方1張放進能量區（付1拿回1）。'),
  char('016', 'yellow', [N.sandalphon, '復讐的天司 聖德芬'], 2, 0, 3000, 1, ['soul'], [T.gb, T.tenshi], [
    myTurnPower(6000),
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxItteki }, trigger: attacks, condition: all(cxIn(N.cxItteki), allGb),
      effects: [move(wrUpTo(1, gb), toHand), move(wrUpTo(1, { names: [N.sandalphon, N.lucifel] }), toMemory)],
      text: t('【自】【CXコンボ】このカードがアタックした時、CX置場に「いってきます！」があり、あなたのキャラすべてが《グラブル》なら、あなたは自分の控え室の《グラブル》のキャラを1枚まで選び、手札に戻し、自分の控え室の、「復讐の天司 サンダルフォン」か「進化の天司 ルシフェル」を1枚まで選び、思い出にする。',
        '【自】【CX連動】此卡攻擊時，名場面區有「我出門了！」，你的角色全部是《碧藍幻想》的話，你選擇自己休息室的《碧藍幻想》的角色最多1張，回到手牌，選擇自己休息室的「復讐的天司 聖德芬」或「進化的天司 路西菲爾」最多1張，放到回憶區。'),
    },
    memoryMarker,
  ], '自己回合9000（Lv2、費用0）。連動名場面「我出門了！」：攻擊時撿回1張角色，再把休息室的聖德芬或路西菲爾放進回憶區。記憶：在回憶區時，「莊重的十二枚羽 聖德芬」攻擊時可以把她放到下面當標記。'),
  char('017', 'yellow', ['指教の天司 アズラエル・イスラフィル', '指教的天司 阿茲拉爾·伊斯拉菲爾'], 2, 1, 1500, 1, ['soul'], [T.gb, T.tenshi], [
    {
      kind: 'auto', activeIn: 'clockTop', trigger: cxPhase, optional: true, cost: [discardHand()], effects: [{ op: 'swapWithWaiting', target: opp({ levelAtLeast: 1 }) }],
      text: t('【自】【クロック】アラーム［手札を1枚控え室に置く］このカードがクロックの1番上にあるなら、あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたは相手のレベル1以上のキャラを1枚選び、相手は自分の控え室のレベルＸ以下のキャラを1枚選び、入れ替える。Ｘはあなたが選んだキャラのレベル－1に等しい。',
        '【自】【傷害區】警報［手牌1張放到休息室］此卡在傷害區最上面的話，在你的名場面階段開始時，你可以支付代價。支付代價的話，你選擇對手的等級1以上的角色1張，對手選擇自己休息室的等級X以下的角色1張，交換。X等於你選擇的角色的等級-1。'),
    },
    backup(3000, 2, ...backupText(3000, 2)),
  ], '助太刀+3000。警報：這張在傷害區最上面時，名場面階段開始時丟1張，把對手1張角色換成低1級的。'),
  char('018', 'yellow', ['『金』の爛夏 ガレヲン', '『金』之爛夏 加雷翁'], 2, 1, 6000, 1, ['soul'], [T.gb, T.rokuryu], [
    {
      kind: 'continuous', condition: othersAtLeast(2), effects: [power(self, 4000, 'whileActive')],
      text: t('【永】他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋4000。', '【永】其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+4000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxKusabi }, trigger: encoreSelf, optional: true,
      condition: all(inFront, othersAtLeast(1), { kind: 'opponentFrontClear' }), cost: [discardHand(undefined, 2), { kind: 'discard', selector: cxZone(N.cxKusabi) }],
      effects: [{ op: 'searchDeck', filter: gb, upTo: 4, reveal: true, shuffle: true }],
      text: t('【自】【CXコンボ】［手札を2枚控え室に置き、あなたのCX置場の「蒼空の楔」を1枚控え室に置く］あなたのアンコールステップの始めに、前列にこのカードがいて、他のあなたの《グラブル》のキャラがいて、相手の前列のキャラがいないか相手の前列のキャラすべてが【リバース】しているなら、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て《グラブル》のキャラを4枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '【自】【CX連動】［手牌2張放到休息室，並將你的名場面區的「蒼空之楔」1張放到休息室］在你的安可步驟開始時，此卡在前列，有其他的你的《碧藍幻想》的角色存在，對手的前列沒有角色或對手的前列的角色全部【倒置】的話，你可以支付代價。支付代價的話，你從自己的牌組選擇《碧藍幻想》的角色最多4張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
  ], '其他2張以上時10000。連動名場面「蒼空之楔」：把對手前列全部打倒後，安可步驟開始時丟2張＋名場面，從牌組找4張《碧藍幻想》角色。'),
  char('019', 'yellow', ['『白』の澄夏 ル・オー', '『白』之澄夏 路·歐'], 2, 1, 7000, 1, [], [T.gb, T.rokuryu], [
    {
      kind: 'auto', trigger: placed, effects: [power(self, 4500)],
      text: t('【自】このカードが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋4500。', '【自】此卡從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+4500。'),
    },
    {
      kind: 'auto', trigger: encoreSelf, optional: true, condition: all(inFront, { kind: 'opponentFrontClear' }), cost: [stock(2), discardHand(gb, 2)],
      effects: [move(clockTop(3, true), toWR)],
      text: t('【自】［② 手札の《グラブル》のキャラを2枚控え室に置く］あなたのアンコールステップの始めに、前列にこのカードがいて、相手の前列のキャラがいないか相手の前列のキャラすべてが【リバース】しているなら、あなたはコストを払ってよい。そうしたら、あなたは自分のクロックの上から3枚までを、控え室に置く。',
        '【自】［② 手牌的《碧藍幻想》的角色2張放到休息室］在你的安可步驟開始時，此卡在前列，對手的前列沒有角色或對手的前列的角色全部【倒置】的話，你可以支付代價。支付代價的話，你將自己的傷害區上方最多3張，放到休息室。'),
    },
  ], '登場的回合11500。把對手前列全部打倒後，安可步驟開始時付2能量丟2張角色，回最多3血。'),
  ev('020', ['000 どうして空は蒼いのか Part.Ⅲ', '000 天空為何蔚藍 Part.Ⅲ'], 'yellow', 1, 1, [{
    kind: 'event', keyword: { id: 'cxCombo', climaxName: N.cxItteki },
    effects: [{
      op: 'if', condition: countAtLeast(3, { anyOf: [traitChar('天司'), traitChar('堕天司'), traitChar('星の民')] }),
      then: [{
        op: 'chooseOne', options: [
          { label: '從休息室撿回「我出門了！」「路上小心。」「三零」其中1張', effects: [move(wr({ names: [N.cxItteki, N.cxItterasshai, N.cxTriple] }), toHand)] },
          {
            label: '撿回《碧藍幻想》角色最多1張，公開牌組上方：Lv2以下角色就能把聖德芬或路西菲爾放到回憶區',
            effects: [
              move(wrUpTo(1, gb), toHand),
              { op: 'revealTopCheck', filter: { type: 'character', levelAtMost: 2 }, matchTo: 'deckTop', ifMatch: [{ op: 'may', prompt: '要把休息室的「復讐的天司 聖德芬」或「進化的天司 路西菲爾」放到回憶區嗎', then: [move(wr({ names: [N.sandalphon, N.lucifel] }), toMemory)] }] },
            ],
          },
        ],
      }],
    }],
    text: t('【CXコンボ】あなたの、《天司》か《堕天司》か《星の民》のキャラが3枚以上なら、次の2つの効果のうちあなたが選んだ1つを行う。『あなたは自分の控え室の、「いってきます！」か「いってらっしゃい。」か「トリプルゼロ」を1枚選び、手札に戻す。』『あなたは自分の控え室の《グラブル》のキャラを1枚まで選び、手札に戻し、自分の山札の上から1枚を公開する。そのカードがレベル2以下のキャラなら、あなたは自分の控え室の、「復讐の天司 サンダルフォン」か「進化の天司 ルシフェル」を1枚選び、思い出にしてよい。』（公開したカードは元に戻す）',
      '【CX連動】你的《天司》或《墮天司》或《星之民》的角色存在3張以上的話，從以下2個效果中選擇1個執行。『你選擇自己休息室的「我出門了！」或「路上小心。」或「三零」1張，回到手牌。』『你選擇自己休息室的《碧藍幻想》的角色最多1張，回到手牌，將自己的牌組上方1張公開。那張卡片是等級2以下的角色的話，你可以選擇自己休息室的「復讐的天司 聖德芬」或「進化的天司 路西菲爾」1張，放到回憶區。』(公開的卡片放回原位)'),
    review: ['場上《天司》《墮天司》《星之民》角色不到 3 張時，用了什麼都不會發生。'],
  }], '場上有3張以上《天司》《墮天司》《星之民》角色時二選一：撿回連動名場面，或撿回1張角色並（翻到Lv2以下角色時）把聖德芬或路西菲爾放進回憶區。'),
  cx('021', [N.cxItteki, '我出門了！'], 'yellow', ['choice'], [climax('choice')], '全部角色+1000、魂傷+1。連動：「復讐的天司 聖德芬」。判定翻到時：從休息室把1張判定有魂傷的角色拿回手牌或放進能量區。'),
  cx('022', [N.cxItterasshai, '路上小心。'], 'yellow', ['choice'], [climax('choice')], '全部角色+1000、魂傷+1。連動：「進化的天司 路西菲爾」。判定翻到時：從休息室把1張判定有魂傷的角色拿回手牌或放進能量區。'),
  cx('023', [N.cxTriple, '三零'], 'yellow', ['choice'], [climax('choice')], '全部角色+1000、魂傷+1。連動：「莊重的十二枚羽 聖德芬」「再臨的墮天之王 路西法」。判定翻到時：從休息室把1張判定有魂傷的角色拿回手牌或放進能量區。'),
  cx('024', [N.cxKusabi, '蒼空之楔'], 'yellow', ['choice'], [climax('choice')], '全部角色+1000、魂傷+1。連動：「『金』之爛夏 加雷翁」。判定翻到時：從休息室把1張判定有魂傷的角色拿回手牌或放進能量區。'),
  char('025', 'green', ['南南西の守護神 アニラ', '南南西的守護神 安妮拉'], 0, 0, 1500, 1, [], [T.gb, T.jyuuni], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand(gb)], effects: [{ op: 'drawCards', n: 1 }],
      text: t('【自】［手札の《グラブル》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは1枚引く。', '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你抽1張牌。'),
    },
    {
      kind: 'auto', trigger: leaves, optional: true, cost: [discardHand()], effects: [{ op: 'lookTopPick', look: 4, pick: { filter: gb, upTo: 1 }, rest: 'waitingRoom' }],
      text: t('【自】［手札を1枚控え室に置く］このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から4枚まで見て、《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
        '【自】［手牌1張放到休息室］此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多4張，選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      review: ['「4枚まで見て」：目前固定看 4 張。'],
    },
  ], '登場丟1張角色抽1張。進休息室時丟1張，看4張拿1張《碧藍幻想》角色。'),
  char('026', 'green', [N.bikaraN, '北之守護神 比卡拉'], 2, 0, 4000, 1, ['soul'], [T.gb, T.jyuuni], bikaraAbilities,
    '其他2張以上時9000（Lv2、費用0）。連動名場面「水上露營」：安可步驟開始時，可以丟牌組上方3張，再從牌組找1張《十二神將》角色（順序自己決定）。'),
  char('027', 'green', ['十天衆 シエテ', '十天眾 西艾特'], 3, 2, 9500, 2, ['soul'], [T.gb, T.jyuuten], [
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxSoraMamoru }, trigger: placed, optional: true,
      effects: [{
        op: 'chooseOne', options: [
          { label: '把休息室的「守護天空之人」加到手牌', effects: [move(wr({ name: N.cxSoraMamoru }), toHand)] },
          { label: '把休息室的「守護天空之人」放到能量區', effects: [move(wr({ name: N.cxSoraMamoru }), toStock)] },
        ],
      }],
      text: t('【自】【CXコンボ】このカードが手札から舞台に置かれた時、あなたは自分の控え室の「空を守らんとする者達」を1枚選び、手札に戻すかストック置場に置いてよい。', '【自】【CX連動】此卡從手牌被放置到舞台時，你可以選擇自己休息室的「守護天空之人」1張，回到手牌或放到能量區。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxSoraMamoru }, trigger: usedActivated, perTurn: 1, optional: true,
      condition: all(myTurn, othersAtLeast(3)), cost: [discardHand({ name: N.cxSoraMamoru }), discardHand()],
      effects: [{ op: 'dealDamage', amount: 3, cancelable: true }],
      text: t('【自】【CXコンボ】【ターン1】［手札の「空を守らんとする者達」を1枚控え室に置き、手札を1枚控え室に置く］あなたのターン中、あなたが【起】を使った時、他のあなたの《グラブル》のキャラが3枚以上なら、あなたはコストを払ってよい。そうしたら、相手に3ダメージを与える。（ダメージキャンセルは発生する）',
        '【自】【CX連動】【每回合1次】［手牌的「守護天空之人」1張放到休息室，並將手牌1張放到休息室］在你的回合中，當你使用【起】時，其他的你的《碧藍幻想》的角色存在3張以上的話，你可以支付代價。支付代價的話，給對手3點傷害。(會發生傷害取消)'),
    },
    {
      kind: 'activated', perTurn: 1, cost: [{ kind: 'deckTopToClock' }], effects: [{ op: 'drawCards', n: 1 }],
      text: t('【起】【ターン1】［あなたの山札の上から1枚をクロック置場に置く］あなたは1枚引く。', '【起】【每回合1次】［將你的牌組上方1張放到傷害區］你抽1張牌。'),
    },
  ], '登場時把休息室的「守護天空之人」拿回手牌或放進能量區。自己回合使用【起】時（例如他自己的【起】：吃1點傷害抽1張），丟「守護天空之人」＋1張手牌，給對手3點傷害（每回合1次）。'),
  char('028', 'green', ['最高密度の純心 ヤチマ', '最高密度的純心 亞奇瑪'], 0, 0, 2000, 1, [], [T.gb, T.moon], [{
    kind: 'auto', trigger: leaves, optional: true, cost: [stock(1), { kind: 'deckTopToClock' }], effects: [{ op: 'lookTopPick', look: 2, pick: { filter: gb, upTo: 2 }, rest: 'waitingRoom' }],
    text: t('【自】［① あなたの山札の上から1枚をクロック置場に置く］このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から2枚まで見て、《グラブル》のキャラを2枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
      '【自】［① 將你的牌組上方1張放到傷害區］此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多2張，選擇《碧藍幻想》的角色最多2張給對手確認，加到手牌，剩下的卡片放到休息室。'),
  }], '進休息室時付1能量並自己吃1點，看2張，《碧藍幻想》角色全部拿走。'),
  char('029', 'green', ['東の守護神 マコラ', '東之守護神 瑪可拉'], 0, 0, 2000, 1, [], [T.gb, T.jyuuni], [
    {
      kind: 'continuous', condition: all(myTurn, { kind: 'hasMarker' }), effects: [power(self, 2000, 'whileActive')],
      text: t('【永】あなたのターン中、このカードの下にマーカーがあるなら、このカードのパワーを＋2000。', '【永】在你的回合中，此卡下面有標記的話，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', trigger: placed,
      effects: [{ op: 'revealTopCheck', filter: gb, matchTo: 'deckTop', ifMatch: [{ op: 'may', prompt: '要把這張卡背面朝上放到此卡下面當標記嗎', then: [{ op: 'addMarker', from: deckTop(1), to: 'source', faceUp: false }] }] }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札の上から1枚を公開する。そのカードが《グラブル》のキャラならこのカードの下にマーカーとして裏向きに置いてよい。（そうしないなら元に戻す）',
        '【自】此卡從手牌被放置到舞台時，你將自己的牌組上方1張公開。那張卡片是《碧藍幻想》的角色的話，你可以將它背面朝上放到此卡下面當標記。(不這麼做的話放回原位)'),
    },
    {
      kind: 'auto', trigger: oppReversed, optional: true, condition: { kind: 'climaxInZone' }, effects: [move(deckTop(1), toStock)],
      text: t('【自】このカードのバトル相手が【リバース】した時、あなたのCX置場にCXがあるなら、あなたは自分の山札の上から1枚を、ストック置場に置いてよい。', '【自】此卡的戰鬥對手【倒置】時，你的名場面區有名場面的話，你可以將自己的牌組上方1張，放到能量區。'),
    },
  ], '登場翻牌組最上面1張，是《碧藍幻想》角色就可以放到她下面當標記，之後自己回合4000。打倒對手且有名場面時，+1能量。'),
  char('030', 'green', ['南の守護神 サンチラ', '南之守護神 珊奇拉'], 0, 0, 2500, 1, [], [T.gb, T.jyuuni], [{
    kind: 'auto', trigger: placed, optional: true, cost: [{ kind: 'handToClock' }], effects: [{ op: 'searchDeck', filter: jyuuni, upTo: 1, reveal: true, shuffle: true }],
    text: t('【自】［手札を1枚クロック置場に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て《十二神将》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
      '【自】［手牌1張放到傷害區］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組選擇《十二神將》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
  }], 'Lv0就有2500。登場時把1張手牌放進傷害區（自己吃1點），從牌組找1張《十二神將》角色。'),
  char('031', 'green', ['西北西の守護神 ヴァジラ', '西北西的守護神 瓦吉拉'], 1, 1, 3500, 1, ['soul'], [T.gb, T.jyuuni], [
    {
      kind: 'continuous', condition: othersAtLeast(2, jyuuni),
      effects: [{ op: 'grantAbility', target: self, duration: 'whileActive', ability: myTurnPower(5000) }, { op: 'grantAbility', target: self, duration: 'whileActive', ability: ENCORE_STAGE }],
      text: t('【永】他のあなたの《十二神将》のキャラが2枚以上なら、このカードは次の2つの能力を得る。『【永】あなたのターン中、このカードのパワーを＋5000。』『【自】アンコール［① あなたの舞台のキャラを1枚控え室に置く］』',
        '【永】其他的你的《十二神將》的角色存在2張以上的話，此卡獲得以下2個能力。『【永】在你的回合中，此卡的攻擊力+5000。』『【自】安可［① 將你的舞台的角色1張放到休息室］』'),
    },
    {
      kind: 'auto', trigger: encoreSelf, optional: true, condition: othersAtLeast(1, jyuuni),
      cost: [{ kind: 'discard', selector: { zone: 'climaxZone', side: 'self', filter: { type: 'climax', hasTrigger: 'treasure' }, count: { exactly: 1 } } }],
      effects: [{ op: 'lookTopPick', look: 4, pick: { filter: jyuuni, upTo: 1 }, rest: 'waitingRoom' }],
      text: t('【自】［あなたのCX置場のトリガーアイコンが【トレジャー】のCXを1枚控え室に置く］あなたのアンコールステップの始めに、他のあなたの《十二神将》のキャラがいるなら、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から4枚まで見て、《十二神将》のキャラを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
        '【自】［將你的名場面區的判定標誌是金條的名場面1張放到休息室］在你的安可步驟開始時，有其他的你的《十二神將》的角色存在的話，你可以支付代價。支付代價的話，你從自己的牌組上方看最多4張，選擇《十二神將》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      review: ['「4枚まで見て」：目前固定看 4 張。'],
    },
  ], '其他《十二神將》2張以上時：自己回合8500，還能付1能量＋送1張舞台角色安可。安可步驟開始時把金條名場面丟掉，看4張拿1張《十二神將》角色。'),
  char('032', 'green', ['六竜の『翠』 イーウィヤ', '六龍之『翠』 伊薇雅'], 2, 0, 5500, 1, [], [T.gb, T.rokuryu], [
    handLevelDown(countAtLeast(4, gb), '【永】あなたの《グラブル》のキャラが4枚以上なら、あなたの手札のこのカードのレベルを－1。', '【永】你的《碧藍幻想》的角色存在4張以上的話，你的手牌的此卡的等級-1。'),
    {
      kind: 'continuous', effects: [power(self, { per: others(gb), multiplier: 500, evaluate: 'live' }, 'whileActive')],
      text: t('【永】他のあなたの《グラブル》のキャラ1枚につき、このカードのパワーを＋500。', '【永】其他的你的《碧藍幻想》的角色每有1張，此卡的攻擊力+500。'),
    },
    {
      kind: 'auto', trigger: { event: 'opponentAttackPhaseStart' }, optional: true, cost: [stock(1)],
      effects: [{ op: 'swapPositions', target: mine({ ...gb, excludeSource: true }), withSource: true }],
      text: t('【自】［①］相手のアタックフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたは自分の《グラブル》のキャラを1枚とこのカードを選び、それぞれを【スタンド】して入れ替える。', '【自】［①］在對手的攻擊階段開始時，你可以支付代價。支付代價的話，你選擇自己的《碧藍幻想》的角色1張和此卡，將各自【直立】並交換位置。'),
    },
  ], '場上有4張以上《碧藍幻想》時，手牌的她算Lv1。其他每1張+500（最多7500）。對手攻擊階段開始時付1能量，和另1張角色交換位置並直立（把後列的她換到前面擋）。'),
  char('033', 'green', ['西の守護神 マキラ', '西之守護神 瑪奇拉'], 2, 1, 5000, 1, ['soul'], [T.gb, T.jyuuni], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand()], effects: [move(wr(gb), toHand)],
      text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《グラブル》のキャラを1枚選び、手札に戻す。', '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的《碧藍幻想》的角色1張，回到手牌。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'sendSourceToWaitingRoom' }], effects: [move(opp(), toOwnerHand)],
      text: t('【起】［このカードを控え室に置く］あなたは相手のキャラを1枚選び、手札に戻す。', '【起】［將此卡放到休息室］你選擇對手的角色1張，回到手牌。'),
    },
  ], '登場丟1張撿回1張角色。【起】：把自己送進休息室，彈對手1張角色回手牌。'),
  char('034', 'green', ['北北東の守護神 シャトラ', '北北東的守護神 夏特拉'], 3, 2, 8000, 2, ['soul'], [T.gb, T.jyuuni], [
    handLevelDown({ kind: 'countAtLeast', selector: { zone: 'waitingRoom', side: 'self', filter: { type: 'climax', hasTrigger: 'treasure' }, count: 'all' }, n: 3 },
      '【永】あなたの控え室のトリガーアイコンが【トレジャー】のCXが3枚以上なら、あなたの手札のこのカードのレベルを－1。', '【永】你的休息室的判定標誌是金條的名場面在3張以上的話，你的手牌的此卡的等級-1。'),
    {
      kind: 'continuous', condition: othersAtLeast(2, jyuuni), effects: [power(self, 3000, 'whileActive')],
      text: t('【永】他のあなたの《十二神将》のキャラが2枚以上なら、このカードのパワーを＋3000。', '【永】其他的你的《十二神將》的角色存在2張以上的話，此卡的攻擊力+3000。'),
    },
    heal(true),
  ], '休息室有3張以上金條名場面時，手牌的她算Lv2。其他《十二神將》2張以上時11000。登場回1血。'),
  char('035', 'green', ['月よりの帰還者 カシウス', '自月歸來者 卡西烏斯'], 3, 2, 10000, 2, ['soul'], [T.gb, T.moon], [
    {
      kind: 'auto', trigger: usedActivated, perTurn: 1, condition: myTurn, effects: [move(deckTopUpTo(1), toStock), power(self, 1500)],
      text: t('【自】この能力は1ターンにつき1回まで発動する。あなたのターン中、あなたが【起】を使った時、あなたは自分の山札の上から1枚までを、ストック置場に置き、そのターン中、このカードのパワーを＋1500。', '【自】此能力每回合最多發動1次。在你的回合中，當你使用【起】時，你將自己的牌組上方最多1張放到能量區，在那個回合中，此卡的攻擊力+1500。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxTabi }, trigger: attacks, optional: true, condition: cxIn(N.cxTabi), cost: [stock(2), discardHand()],
      effects: [{ op: 'dealDamage', amount: 2, cancelable: true, ifCancelled: [{ op: 'may', prompt: '傷害被取消了，要再給對手2點傷害嗎', then: [{ op: 'dealDamage', amount: 2, cancelable: true }] }] }],
      text: t('【自】【CXコンボ】［② 手札を1枚控え室に置く］このカードがアタックした時、CX置場に「旅の終わり」があるなら、あなたはコストを払ってよい。そうしたら、相手に2ダメージを与える。このダメージがキャンセルされたなら、あなたは相手に2ダメージを与えてよい。（ダメージキャンセルは発生する）',
        '【自】【CX連動】［② 手牌1張放到休息室］此卡攻擊時，名場面區有「旅程的終點」的話，你可以支付代價。支付代價的話，給對手2點傷害。這個傷害被取消的話，你可以再給對手2點傷害。(會發生傷害取消)'),
    },
  ], '自己回合使用【起】時，牌組上方1張進能量、這回合+1500（每回合1次）。連動名場面「旅程的終點」：攻擊時付2能量丟1張，給2點傷害，被取消就再給2點。'),
  char('036', 'green', ['颯仙 ラモラック', '颯仙 拉莫拉克'], 0, 0, 500, 1, [], [T.gb, T.wales], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'memoryAndReturn', target: { zone: 'stage', side: 'opponent', count: { upTo: 1 } } }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手のキャラを1枚まで選び、思い出にし、相手は自分の思い出置場のそのキャラを、舞台の好きな枠に置く。', '【自】此卡從手牌被放置到舞台時，你選擇對手的角色最多1張，放到回憶區，對手將自己回憶區的那張角色，放到舞台上喜歡的格子。'),
    },
    {
      kind: 'auto', trigger: placed, condition: othersAtLeast(1), effects: [power({ zone: 'stage', side: 'opponent', filter: { row: 'front' }, count: 'all' }, -500)],
      text: t('【自】このカードが手札から舞台に置かれた時、他のあなたの《グラブル》のキャラがいるなら、相手の前列のキャラすべてに、そのターン中、パワーを－500。', '【自】此卡從手牌被放置到舞台時，有其他的你的《碧藍幻想》的角色存在的話，對手的前列的角色全部，在那個回合中，攻擊力-500。'),
    },
  ], '登場時讓對手1張角色進回憶區再回舞台（清掉加成），還讓對手前列全部-500。'),
  char('037', 'green', ['止水の隠者 エスタリオラ', '止水的隱者 埃斯塔里奧拉'], 0, 0, 1500, 1, [], [T.gb, T.jyukken], [
    fromWaitingRoom(mainStart, undefined, [discardHand(gb)], emptySlot, [],
      '【自】［手札の《グラブル》のキャラを1枚控え室に置く］控え室にこのカードがあるなら、あなたのメインフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを舞台のキャラのいない枠に置く。',
      '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡在休息室的話，在你的主要階段開始時，你可以支付代價。支付代價的話，你將此卡放到舞台的沒有角色的格子。'),
    {
      kind: 'activated', cost: [stock(1), { kind: 'sendSourceToWaitingRoom' }], effects: [{ op: 'lookTopPick', look: 4, pick: { filter: gb, upTo: 1 }, rest: 'waitingRoom' }],
      text: t('【起】［① このカードを控え室に置く］あなたは自分の山札を上から4枚まで見て、《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。', '【起】［① 將此卡放到休息室］你從自己的牌組上方看最多4張，選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      review: ['「4枚まで見て」：目前固定看 4 張。'],
    },
  ], '【起】：付1能量把自己送進休息室，看4張拿1張。在休息室時，主要階段開始時丟1張角色就能回到舞台空格，可以重複使用。'),
  char('038', 'green', ['ダクトなエンジニア アイザック', '管線工程師 艾薩克'], 0, 0, 1500, 1, [], [T.gb, T.moon], [
    {
      kind: 'auto', trigger: placed, optional: true, effects: [move(hand(), toStock)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の手札を1枚選び、ストック置場に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以選擇自己的手牌1張，放到能量區。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand({ type: 'climax' })], effects: [move(wr(gb), toHand)],
      text: t('【自】［手札のCXを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《グラブル》のキャラを1枚選び、手札に戻す。', '【自】［手牌的名場面1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的《碧藍幻想》的角色1張，回到手牌。'),
    },
  ], '登場時可以把1張手牌放進能量區；也可以丟1張名場面撿回1張角色。'),
  char('039', 'green', ['断罪の皇帝 カッツェリーラ', '斷罪的皇帝 卡策麗菈'], 2, 0, 5000, 1, [], [T.gb, T.jyukken], [
    fromWaitingRoom(mainStart, levelAtLeast(2), [discardHand()], emptySlot, [],
      '【自】［手札を1枚控え室に置く］控え室にこのカードがあり、あなたのレベルが2以上なら、あなたのメインフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを舞台のキャラのいない枠に置く。',
      '【自】［手牌1張放到休息室］此卡在休息室，你的等級在2以上的話，在你的主要階段開始時，你可以支付代價。支付代價的話，你將此卡放到舞台的沒有角色的格子。'),
    {
      kind: 'auto', trigger: { event: 'placedFromWaitingRoom' }, condition: myTurn,
      effects: [move({ zone: 'deck', side: 'self', filter: { name: N.haseliera }, count: { upTo: 1 } }, toWR), { op: 'shuffleDeck' }],
      text: t('【自】あなたのターン中、このカードが控え室から舞台に置かれた時、あなたは自分の山札を見て「欺瞞の女教皇 ハーゼリーラ」を1枚まで選び、控え室に置き、その山札をシャッフルする。', '【自】在你的回合中，此卡從休息室被放置到舞台時，你從自己的牌組選擇「欺瞞的女教皇 哈澤莉菈」最多1張，放到休息室，將那個牌組洗牌。'),
    },
    {
      kind: 'activated', keyword: { id: 'cxCombo', climaxName: N.cxJyukken }, condition: countAtLeast(1, gb), cost: [{ kind: 'sourceToDeckBottom' }], effects: [move(wr({ name: N.cxJyukken }), toHand)],
      text: t('【起】【CXコンボ】［このカードを山札の下に置く］あなたの《グラブル》のキャラがいるなら、あなたは自分の控え室の「十賢者」を1枚選び、手札に戻す。', '【起】【CX連動】［將此卡放到牌組下方］有你的《碧藍幻想》的角色存在的話，你選擇自己休息室的「十賢者」1張，回到手牌。'),
      review: ['「十賢者」是名場面的卡名（不是特徵）。'],
    },
  ], '在休息室時，主要階段開始時丟1張就能回到舞台（等級2以上），回來時把牌組的「欺瞞的女教皇 哈澤莉菈」丟進休息室（讓她也能從休息室回來）。【起】：把自己放到牌組下方，撿回名場面「十賢者」。'),
  char('040', 'green', ['十天衆 ニオ', '十天眾 妮歐'], 2, 1, 6000, 1, ['soul'], [T.gb, T.jyuuten], [
    {
      kind: 'continuous', keyword: { id: 'assist' }, effects: [power({ zone: 'stage', side: 'self', filter: { levelAtLeast: 3 }, count: 'all', relation: 'frontOfSource' }, 2000, 'whileActive')],
      text: t('【永】応援 このカードの前のあなたのレベル3以上のキャラすべてに、パワーを＋2000。', '【永】應援 此卡前面的你的等級3以上的角色全部，攻擊力+2000。'),
    },
    {
      kind: 'activated', cost: [discardHand({ type: 'climax' }), { kind: 'restSource' }], effects: [move(wr(gb), toHand)],
      text: t('【起】［手札のCXを1枚控え室に置き、このカードを【レスト】する］あなたは自分の控え室の《グラブル》のキャラを1枚選び、手札に戻す。', '【起】［手牌的名場面1張放到休息室，並將此卡【橫置】］你選擇自己休息室的《碧藍幻想》的角色1張，回到手牌。'),
    },
  ], '放後列：斜前方的Lv3角色+2000。【起】：丟1張名場面並橫置，撿回1張角色。'),
  char('041', 'green', ['東南東の守護神 ハイラ', '東南東的守護神 海拉'], 0, 0, 1000, 1, [], [T.gb, T.jyuuni], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1), discardHand(jyuuni)],
      effects: [{ op: 'searchDeck', filter: jyuuni, upTo: 1, reveal: true, shuffle: true }, { op: 'lookTopReorder', n: 2 }],
      text: t('【自】［① 手札の《十二神将》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て《十二神将》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルし、自分の山札を上から2枚まで見て、山札の上に好きな順番で置く。',
        '【自】［① 手牌的《十二神將》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組選擇《十二神將》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌，從自己的牌組上方看最多2張，以喜歡的順序放回牌組上方。'),
    },
    {
      kind: 'activated', cost: [discardHand(), { kind: 'sendSourceToWaitingRoom' }], effects: [{ op: 'drawCards', n: 1 }],
      text: t('【起】［手札を1枚控え室に置き、このカードを控え室に置く］あなたは1枚引く。', '【起】［手牌1張放到休息室，並將此卡放到休息室］你抽1張牌。'),
    },
  ], '登場付1能量丟1張《十二神將》：從牌組找1張《十二神將》，再排牌組上方2張的順序。【起】：丟1張並把自己送進休息室，抽1張。'),
  char('042', 'green', ['北北西の守護神 クビラ', '北北西的守護神 庫比拉'], 0, 0, 2000, 1, [], [T.gb, T.jyuuni], [
    {
      kind: 'continuous', condition: all(myTurn, othersAtLeast(1)), effects: [power(self, 1500, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラがいるなら、このカードのパワーを＋1500。', '【永】在你的回合中，有其他的你的《碧藍幻想》的角色存在的話，此卡的攻擊力+1500。'),
    },
    {
      kind: 'auto', trigger: oppReversed, effects: [move(wr(gb), toHand), move(hand(), toWR)],
      text: t('【自】このカードのバトル相手が【リバース】した時、あなたは自分の控え室の《グラブル》のキャラを1枚選び、手札に戻し、自分の手札を1枚選び、控え室に置く。', '【自】此卡的戰鬥對手【倒置】時，你選擇自己休息室的《碧藍幻想》的角色1張，回到手牌，選擇自己的手牌1張，放到休息室。'),
    },
  ], '自己回合有其他《碧藍幻想》時3500。打倒對手時撿回1張角色、丟1張手牌（換牌）。'),
  char('043', 'green', ['南南東の守護神 インダラ', '南南東的守護神 因達拉'], 0, 0, 2000, 1, [], [T.gb, T.jyuuni], [
    {
      kind: 'continuous', keyword: { id: 'assist' }, condition: myTurn, effects: [power({ zone: 'stage', side: 'self', filter: { levelAtLeast: 1 }, count: 'all', relation: 'frontOfSource' }, 500, 'whileActive')],
      text: t('【永】応援 あなたのターン中、このカードの前のあなたのレベル1以上のキャラすべてに、パワーを＋500。', '【永】應援 在你的回合中，此卡前面的你的等級1以上的角色全部，攻擊力+500。'),
    },
    {
      kind: 'activated', condition: othersAtLeast(2, jyuuni), cost: [stock(1), { kind: 'restSource' }], effects: [{ op: 'lookTopPick', look: 3, pick: { filter: jyuuni, upTo: 1 }, rest: 'waitingRoom' }],
      text: t('【起】［① このカードを【レスト】する］他のあなたの《十二神将》のキャラが2枚以上なら、あなたは自分の山札を上から3枚まで見て、《十二神将》のキャラを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。', '【起】［① 將此卡【橫置】］其他的你的《十二神將》的角色存在2張以上的話，你從自己的牌組上方看最多3張，選擇《十二神將》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      review: ['「3枚まで見て」：目前固定看 3 張。'],
    },
  ], '放後列：自己回合斜前方Lv1以上的角色+500。【起】：其他《十二神將》2張以上時，付1能量並橫置，看3張拿1張《十二神將》。'),
  char('044', 'green', ['『翠』の化猫 イーウィヤ', '『翠』之化貓 伊薇雅'], 1, 0, 4000, 1, [], [T.gb, T.rokuryu], [
    {
      kind: 'continuous', condition: all(myTurn, othersAtLeast(2)), effects: [power(self, 2000, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋2000。', '【永】在你的回合中，其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', trigger: placed, alsoOn: leaves, optional: true, cost: [stock(1), discardHand()], effects: [move(wr(chara), toHand)],
      text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時か舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のキャラを1枚選び、手札に戻す。', '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時或從舞台被放到休息室時，你可以支付代價。支付代價的話，你選擇自己休息室的角色1張，回到手牌。'),
    },
  ], '自己回合有2張以上其他《碧藍幻想》時6000。登場、進休息室時各可以付1能量丟1張，撿回1張角色。'),
  char('045', 'green', ['全空最弱の子神 ビカラ', '全空最弱的子神 比卡拉'], 1, 0, 4000, 1, [], [T.gb, T.jyuuni], [
    {
      kind: 'continuous', condition: all(myTurn, othersAtLeast(2)),
      effects: [power(self, 2000, 'whileActive'), { op: 'grantAbility', target: self, duration: 'whileActive', ability: DOUBLE_CHECK }],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋2000し、このカードは次の能力を得る。『【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。』',
        '【永】在你的回合中，其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+2000，此卡獲得以下能力。『【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行2次判定。』'),
    },
    {
      kind: 'auto', trigger: cxPhase, optional: true, condition: levelAtLeast(2), cost: [{ kind: 'sendSourceToWaitingRoom' }],
      effects: [move(wr({ names: [N.bikaraN, N.bikaraP] }), { zone: 'stage', side: 'self', slot: 'sourceSlot' })],
      text: t('【自】チェンジ［このカードを控え室に置く］あなたのCXフェイズの始めに、あなたのレベルが2以上なら、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の、「北の守護神 ビカラ」か「祭夜の子神 ビカラ」を1枚選び、このカードがいた枠に置く。',
        '【自】交替［將此卡放到休息室］在你的名場面階段開始時，你的等級在2以上的話，你可以支付代價。支付代價的話，你選擇自己休息室的「北之守護神 比卡拉」或「祭夜的子神 比卡拉」1張，放到此卡原本的格子。'),
    },
  ], '自己回合有2張以上其他《碧藍幻想》時6000，攻擊時付1能量判定2次。交替：等級2以上時，名場面階段開始時換成休息室的Lv2比卡拉。'),
  char('046', 'green', ['西南西の守護神 アンチラ', '西南西的守護神 安琪拉'], 1, 1, 2500, 1, ['soul'], [T.gb, T.jyuuni], [
    {
      kind: 'continuous', condition: myTurn, effects: [power(others(jyuuni), 1000, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《十二神将》のキャラすべてに、パワーを＋1000。', '【永】在你的回合中，其他的你的《十二神將》的角色全部，攻擊力+1000。'),
    },
    {
      kind: 'auto', trigger: { event: 'myTriggerChecked', filter: { type: 'climax', hasTrigger: 'treasure' } }, optional: true, cost: [discardHand()], effects: [move(wr(chara), toHand)],
      text: t('【自】［手札を1枚控え室に置く］あなたのトリガーアイコンが【トレジャー】のCXがトリガーした時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のキャラを1枚選び、手札に戻す。', '【自】［手牌1張放到休息室］當你判定出判定標誌是金條的名場面時，你可以支付代價。支付代價的話，你選擇自己休息室的角色1張，回到手牌。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'handToDeckBottom', selector: hand(jyuuni) }, { kind: 'restSource' }], effects: [move(clockTop(), toWR)],
      text: t('【起】［手札の《十二神将》のキャラを1枚公開し、山札の下に置き、このカードを【レスト】する］あなたは自分のクロックの上から1枚を、控え室に置く。', '【起】［公開手牌的《十二神將》的角色1張，放到牌組下方，並將此卡【橫置】］你將自己的傷害區上方1張，放到休息室。'),
    },
  ], '自己回合其他《十二神將》+1000。判定翻到金條名場面時丟1張撿回1張角色。【起】：把手牌1張《十二神將》放到牌組下方並橫置，回1血。'),
  char('047', 'green', ['衷心のショコラティエ カシウス', '衷心的巧克力師 卡西烏斯'], 2, 1, 2500, 1, ['soul'], [T.gb, T.moon], [
    {
      kind: 'auto', trigger: { event: 'usedBackup' },
      effects: [{
        op: 'grantAbility', target: inBattle(), duration: 'thisTurn',
        ability: { kind: 'auto', trigger: oppReversed, effects: [{ op: 'sendToMemory', from: battleOpp }], text: t('【自】このカードのバトル相手が【リバース】した時、あなたはそのキャラを思い出にする。', '【自】此卡的戰鬥對手【倒置】時，你將那張角色放到回憶區。') },
      }],
      text: t('【自】あなたがこのカードの『助太刀』を使った時、あなたは自分のバトル中のキャラを1枚選び、そのターン中、次の能力を与える。『【自】このカードのバトル相手が【リバース】した時、あなたはそのキャラを思い出にする。』',
        '【自】當你使用此卡的『助太刀』時，你選擇自己戰鬥中的角色1張，在那個回合中，給予以下能力。『【自】此卡的戰鬥對手【倒置】時，你將那張角色放到回憶區。』'),
    },
    backup(3000, 2, ...backupText(3000, 2)),
  ], '助太刀+3000。如果反過來打倒攻擊的角色，就把它放進回憶區。'),
  char('048', 'green', ['東北東の守護神 シンダラ', '東北東的守護神 辛達拉'], 3, 2, 8000, 2, ['soul'], [T.gb, T.jyuuni], [
    {
      kind: 'continuous', effects: [power(self, { per: others(jyuuni), multiplier: 1000, evaluate: 'live' }, 'whileActive')],
      text: t('【永】他のあなたの《十二神将》のキャラ1枚につき、このカードのパワーを＋1000。', '【永】其他的你的《十二神將》的角色每有1張，此卡的攻擊力+1000。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [{ kind: 'discard', selector: mine(jyuuni) }], effects: [move(clockTop(), toStock)],
      text: t('【自】［他のあなたの舞台の《十二神将》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分のクロックの上から1枚を、ストック置場に置く。', '【自】［將其他的你的舞台的《十二神將》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你將自己的傷害區上方1張，放到能量區。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxNekogami }, trigger: attackEnd, optional: true, condition: cxIn(N.cxNekogami), cost: [stock(2)],
      effects: [{ op: 'dealDamage', amount: 2, cancelable: true }],
      text: t('【自】【CXコンボ】［②］このカードのアタックの終わりに、CX置場に「猫神の因縁の巻」があるなら、あなたはコストを払ってよい。そうしたら、相手に2ダメージを与える。（ダメージキャンセルは発生する）', '【自】【CX連動】［②］此卡的攻擊結束時，名場面區有「貓神的因緣之卷」的話，你可以支付代價。支付代價的話，給對手2點傷害。(會發生傷害取消)'),
    },
  ], '其他每1張《十二神將》+1000。登場送1張《十二神將》進休息室：傷害區上方1張進能量。連動名場面「貓神的因緣之卷」：攻擊完付2能量給2點傷害。'),
  char('049', 'green', ['初代闘神 バサラ', '初代鬥神 巴薩拉'], 3, 2, 10500, 2, ['soul'], [T.gb, T.jyuuni], [
    {
      kind: 'auto', trigger: placed, effects: [move(deckTopUpTo(1), toStock), power(mineUpTo(2), 2000)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札の上から1枚までを、ストック置場に置き、自分のキャラを2枚まで選び、そのターン中、パワーを＋2000。', '【自】此卡從手牌被放置到舞台時，你將自己的牌組上方最多1張放到能量區，選擇自己的角色最多2張，在那個回合中，攻擊力+2000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxNekogami }, trigger: { event: 'climaxPlaced', side: 'self', filter: { name: N.cxNekogami } }, optional: true,
      condition: othersAtLeast(2, jyuuni), cost: [discardHand()],
      effects: [{
        op: 'grantAbility', target: mine(), duration: 'thisTurn',
        ability: {
          kind: 'auto', trigger: { event: 'dealtDamageCancelled' }, perTurn: 1, optional: true, effects: [{ op: 'dealDamage', amount: 2, cancelable: true }],
          text: t('【自】【ターン1】このカードの与えたダメージがキャンセルされた時、あなたは相手に2ダメージを与えてよい。', '【自】【每回合1次】此卡給予的傷害被取消時，你可以給對手2點傷害。'),
        },
      }],
      text: t('【自】【CXコンボ】［手札を1枚控え室に置く］あなたのCX置場に「猫神の因縁の巻」が置かれた時、他のあなたの《十二神将》のキャラが2枚以上なら、あなたはコストを払ってよい。そうしたら、あなたは自分のキャラを1枚選び、そのターン中、次の能力を与える。『【自】【ターン1】このカードの与えたダメージがキャンセルされた時、あなたは相手に2ダメージを与えてよい。』（ダメージキャンセルは発生する）',
        '【自】【CX連動】［手牌1張放到休息室］當「貓神的因緣之卷」被放置到你的名場面區時，其他的你的《十二神將》的角色存在2張以上的話，你可以支付代價。支付代價的話，你選擇自己的角色1張，在那個回合中，給予以下能力。『【自】【每回合1次】此卡給予的傷害被取消時，你可以給對手2點傷害。』(會發生傷害取消)'),
    },
  ], '登場牌組上方1張進能量，最多2張角色+2000。連動名場面「貓神的因緣之卷」：丟1張，讓1張角色這回合傷害被取消時，可以再給2點傷害。'),
  ev('050', ['十二神将演義', '十二神將演義'], 'green', 1, 1, [
    { kind: 'continuous', effects: [], text: t('このカードは、あなたの《十二神将》のキャラが2枚以下なら、手札からプレイできない。', '你的《十二神將》的角色在2張以下的話，此卡不能從手牌使用。') },
    {
      kind: 'event', effects: [move(wrUpTo(2, chara), toHand), move(hand(), toWR)],
      text: t('あなたは自分の控え室のキャラを2枚まで選び、手札に戻し、自分の手札を1枚選び、控え室に置く。', '你選擇自己休息室的角色最多2張，回到手牌，選擇自己的手牌1張，放到休息室。'),
    },
  ], '場上有3張以上《十二神將》角色才能用：撿回最多2張角色，再丟1張手牌。', { playCondition: countAtLeast(3, jyuuni) }),
  cx('051', [N.cxSoraMamoru, '守護天空之人'], 'green', ['treasure'], [climax('treasure')], '全部角色+1000、魂傷+1。連動：「十天眾 西艾特」。判定翻到時回到手牌，還能把牌組上方1張放進能量區。'),
  cx('052', [N.cxTabi, '旅程的終點'], 'green', ['treasure'], [climax('treasure')], '全部角色+1000、魂傷+1。連動：「自月歸來者 卡西烏斯」。判定翻到時回到手牌，還能把牌組上方1張放進能量區。'),
  cx('053', [N.cxMizu, '水上露營'], 'green', ['treasure'], [climax('treasure')], '全部角色+1000、魂傷+1。連動：「北之守護神 比卡拉」「祭夜的子神 比卡拉」。判定翻到時回到手牌，還能把牌組上方1張放進能量區。'),
  cx('054', [N.cxNekogami, '貓神的因緣之卷'], 'green', ['treasure'], [climax('treasure')], '全部角色+1000、魂傷+1。連動：「東北東的守護神 辛達拉」「初代鬥神 巴薩拉」。判定翻到時回到手牌，還能把牌組上方1張放進能量區。'),
  char('055', 'red', ['原初の星晶獣 ベリアル', '原初的星晶獸 貝利亞爾'], 0, 0, 500, 1, [], [T.gb, T.datenshi], [
    myTurnPower(2000),
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1), { kind: 'deckTopToClock' }],
      effects: [{
        op: 'chooseOne', options: [
          { label: '從牌組找Lv1以下的角色最多1張', effects: [{ op: 'searchDeck', filter: { type: 'character', levelAtMost: 1 }, upTo: 1, reveal: true, shuffle: true }] },
          { label: '撿回1張《碧藍幻想》角色，此卡+1000', effects: [move(wr(gb), toHand), power(self, 1000)] },
        ],
      }],
      text: t('【自】［① あなたの山札の上から1枚をクロック置場に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、次の2つの効果のうちあなたが選んだ1つを行う。『あなたは自分の山札を見てレベル1以下のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。』『あなたは自分の控え室の《グラブル》のキャラを1枚選び、手札に戻し、そのターン中、このカードのパワーを＋1000。』',
        '【自】［① 將你的牌組上方1張放到傷害區］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，從以下2個效果中選擇1個執行。『你從自己的牌組選擇等級1以下的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。』『你選擇自己休息室的《碧藍幻想》的角色1張，回到手牌，在那個回合中，此卡的攻擊力+1000。』'),
    },
  ], '自己回合2500。登場付1能量並自己吃1點：從牌組找Lv1以下的角色，或撿回1張角色並+1000。'),
  char('056', 'red', ['無窮の群青 ベアトリクス', '無窮的群青 碧翠克絲'], 1, 0, 3500, 1, [], [T.gb, T.soshiki], [
    {
      kind: 'continuous', condition: allGb, effects: [power(self, 2000, 'whileActive')],
      text: t('【永】あなたのキャラすべてが《グラブル》なら、このカードのパワーを＋2000。', '【永】你的角色全部是《碧藍幻想》的話，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', trigger: usedActivated, perTurn: 1,
      effects: [
        power(self, 1000),
        {
          op: 'grantAbility', target: self, duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: attackEnd, condition: { kind: 'frontAbsentOrReversed' }, effects: [{ op: 'revealTopCheck', filter: gb, ifMatch: [] }],
            text: t('【自】このカードのアタックの終わりに、このカードの正面のキャラがいないか【リバース】しているなら、あなたは自分の山札の上から1枚を公開する。そのカードが《グラブル》のキャラなら手札に加える。（そうでないなら元に戻す）',
              '【自】此卡的攻擊結束時，此卡的正面沒有角色或正面的角色【倒置】的話，你將自己的牌組上方1張公開。那張卡片是《碧藍幻想》的角色的話加到手牌。(如果不是的話放回原位)'),
          },
        },
      ],
      text: t('【自】この能力は1ターンにつき1回まで発動する。あなたが【起】を使った時、そのターン中、このカードのパワーを＋1000し、このカードは次の能力を得る。『【自】このカードのアタックの終わりに、このカードの正面のキャラがいないか【リバース】しているなら、あなたは自分の山札の上から1枚を公開する。そのカードが《グラブル》のキャラなら手札に加える。』（そうでないなら元に戻す）',
        '【自】此能力每回合最多發動1次。當你使用【起】時，在那個回合中，此卡的攻擊力+1000，此卡獲得以下能力。『【自】此卡的攻擊結束時，此卡的正面沒有角色或正面的角色【倒置】的話，你將自己的牌組上方1張公開。那張卡片是《碧藍幻想》的角色的話加到手牌。』(如果不是的話放回原位)'),
    },
  ], '全隊都是《碧藍幻想》時5500。使用【起】時+1000，這回合攻擊後正面沒角色（或被打倒），翻牌組最上面1張，是角色就拿走。'),
  char('057', 'red', ['真紅の覚醒 ゼタ', '真紅的覺醒 傑塔'], 1, 0, 4000, 1, [], [T.gb, T.soshiki], [
    {
      kind: 'auto', trigger: usedActivated, perTurn: 1, effects: [power(self, 3000)],
      text: t('【自】この能力は1ターンにつき1回まで発動する。あなたが【起】を使った時、そのターン中、このカードのパワーを＋3000。', '【自】此能力每回合最多發動1次。當你使用【起】時，在那個回合中，此卡的攻擊力+3000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxTatakai }, trigger: attacks, condition: all(cxIn(N.cxTatakai), othersAtLeast(3)),
      effects: [
        move(deckTop(3), toWR, 'milled'),
        { op: 'setX', amount: { countOfBound: 'milled', filter: gb } },
        move(wrUpTo(1, { ...gb, levelAtMostX: true }), toHand),
        power(opp({ row: 'front' }), -500),
      ],
      text: t('【自】【CXコンボ】このカードがアタックした時、CX置場に「戦いの後に」があり、他のあなたの《グラブル》のキャラが3枚以上なら、あなたは自分の山札の上から3枚までを、控え室に置き、自分の控え室のレベルＸ以下の《グラブル》のキャラを1枚まで選び、手札に戻し、相手の前列のキャラを1枚選び、そのターン中、パワーを－500。Ｘはこの効果で控え室に置かれた《グラブル》のキャラの枚数に等しい。',
        '【自】【CX連動】此卡攻擊時，名場面區有「戰鬥之後」，其他的你的《碧藍幻想》的角色存在3張以上的話，你將自己的牌組上方最多3張放到休息室，選擇自己休息室的等級X以下的《碧藍幻想》的角色最多1張，回到手牌，選擇對手的前列的角色1張，在那個回合中，攻擊力-500。X等於這個效果放到休息室的《碧藍幻想》的角色張數。'),
      review: ['「3枚までを、控え室に置き」：目前固定放 3 張。'],
    },
  ], '使用【起】時+3000（每回合1次）。連動名場面「戰鬥之後」：攻擊時丟牌組上方3張，撿回等級不超過其中角色數的角色，對手前列1張-500。'),
  char('058', 'red', [N.percival, '高潔的燦炎 帕西瓦爾'], 3, 2, 10000, 2, ['soul'], [T.gb, T.wales], [
    {
      kind: 'auto', trigger: placed, alsoOn: { event: 'placedByEffectOf', name: N.siegfried },
      effects: [{
        op: 'chooseOne', options: [
          { label: '可以撿回1張角色', effects: [move(wrUpTo(1, chara), toHand)] },
          { label: '對手的能量全部洗回牌組再補同樣張數，此卡+1000', effects: [{ op: 'resetStock', side: 'opponent', via: 'deck' }, power(self, 1000)] },
        ],
      }],
      text: t('【自】このカードが手札から舞台に置かれた時か「払暁の忠騎士 ジークフリート」の【自】の効果で舞台に置かれた時、次の2つの効果のうちあなたが選んだ1つを行う。『あなたは自分の控え室のキャラを1枚選び、手札に戻してよい。』『相手は自分のストックすべてを、山札に戻し、その山札をシャッフルし、自分の山札の上から同じ枚数をストック置場に置き、そのターン中、このカードのパワーを＋1000。』',
        '【自】此卡從手牌被放置到舞台時或因「拂曉的忠騎士 齊格飛」的【自】的效果被放置到舞台時，從以下2個效果中選擇1個執行。『你可以選擇自己休息室的角色1張，回到手牌。』『對手將自己的能量全部放回牌組，將那個牌組洗牌，從自己的牌組上方放同樣張數到能量區，在那個回合中，此卡的攻擊力+1000。』'),
    },
    {
      kind: 'auto', trigger: oppReversed, optional: true, cost: [stock(1), discardHand(undefined, 2)],
      effects: [move(deckTop(4), toWR, 'milled'), { op: 'repeat', times: { countOfBound: 'milled', filter: { type: 'climax' } }, effects: [{ op: 'dealDamage', amount: 2, cancelable: true }] }],
      text: t('【自】［① 手札を2枚控え室に置く］このカードのバトル相手が【リバース】した時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札の上から4枚を、控え室に置き、相手に2ダメージをＸ回与える。ＸはそれらのカードのCXの枚数に等しい。（ダメージキャンセルは発生する）',
        '【自】［① 手牌2張放到休息室］此卡的戰鬥對手【倒置】時，你可以支付代價。支付代價的話，你將自己的牌組上方4張放到休息室，給對手X次2點傷害。X等於那些卡片中的名場面張數。(會發生傷害取消)'),
    },
  ], '登場（或被齊格飛放上場）時二選一：撿回角色，或重洗對手的能量並+1000。打倒對手時付1能量丟2張，翻4張，每張名場面給2點傷害。'),
  char('059', 'red', ['漆黒の兇刃 バザラガ', '漆黑的兇刃 巴薩拉加'], 0, 0, 1500, 1, [], [T.gb, T.soshiki], [
    {
      kind: 'auto', trigger: placed,
      effects: [{ op: 'grantAbility', target: opp(), duration: 'untilNextOpponentTurnEnd', ability: { kind: 'continuous', rules: ['cannotMove'], effects: [], text: t('【永】このカードは他の枠に動かせない。', '【永】此卡不能移動到其他格子。') } }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手のキャラを1枚選び、次の相手のターンの終わりまで、次の能力を与える。『【永】このカードは他の枠に動かせない。』', '【自】此卡從手牌被放置到舞台時，你選擇對手的角色1張，到下次的對手回合結束前，給予以下能力。『【永】此卡不能移動到其他格子。』'),
    },
    {
      kind: 'activated', cost: [discardHand(), { kind: 'sendSourceToWaitingRoom' }], effects: [move(wr(gb), toHand)],
      text: t('【起】［手札を1枚控え室に置き、このカードを控え室に置く］あなたは自分の控え室の《グラブル》のキャラを1枚選び、手札に戻す。', '【起】［手牌1張放到休息室，並將此卡放到休息室］你選擇自己休息室的《碧藍幻想》的角色1張，回到手牌。'),
    },
  ], '登場讓對手1張角色到對手回合結束都不能換位置。【起】：丟1張並把自己送進休息室，撿回1張角色。'),
  char('060', 'red', ['六竜の『朱』 ウィルナス', '六龍之『朱』 威爾納斯'], 0, 0, 2500, 1, [], [T.gb, T.rokuryu], [{
    kind: 'auto', trigger: attackEnd, optional: true, cost: [stock(3), discardHand(undefined, 2)], effects: [{ op: 'dealDamage', amount: 4, cancelable: true }],
    text: t('【自】［③ 手札を2枚控え室に置く］このカードのアタックの終わりに、あなたはコストを払ってよい。そうしたら、相手に4ダメージを与える。（ダメージキャンセルは発生する）', '【自】［③ 手牌2張放到休息室］此卡的攻擊結束時，你可以支付代價。支付代價的話，給對手4點傷害。(會發生傷害取消)'),
  }], 'Lv0就有2500。攻擊完付3能量丟2張，給4點傷害（終盤收尾）。'),
  char('061', 'red', ['星の民 ベルゼバブ', '星之民 別西卜'], 1, 1, 6000, 1, [], [T.gb, T.hoshi], [
    encore([stock(1), { kind: 'discard', selector: mine(chara) }], '【自】アンコール［① あなたの舞台のキャラを1枚控え室に置く］（このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、このカードがいた枠に【レスト】して置く）',
      '【自】安可［① 將你的舞台的角色1張放到休息室］(此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，將此卡【橫置】放到原本的格子)'),
    {
      kind: 'activated', cost: [{ kind: 'sourceToDeckBottom' }],
      effects: [move({ zone: 'deck', side: 'opponent', count: { exactly: 4 }, fromTop: 4 }, toOwnerWR), power(mine(), 4000)],
      text: t('【起】［このカードを山札の下に置く］相手は自分の山札の上から4枚を、控え室に置き、あなたは自分のキャラを1枚選び、そのターン中、パワーを＋4000。', '【起】［將此卡放到牌組下方］對手將自己的牌組上方4張放到休息室，你選擇自己的角色1張，在那個回合中，攻擊力+4000。'),
    },
  ], 'Lv1就有6000，能付1能量＋送1張舞台角色安可。【起】：把自己放到牌組下方，對手牌組上方4張丟掉、自己1張角色+4000。'),
  char('062', 'red', ['宵の審問者 ヘレル・ベン・シャレム', '宵之審問者 赫雷爾·班·沙勒姆'], 2, 1, 3000, 1, ['soul'], [T.gb], [
    {
      kind: 'auto', trigger: { event: 'usedBackup' }, optional: true, cost: [stock(1), discardHand(), { kind: 'discard', selector: mine(chara) }],
      effects: [move(opp({ levelAboveOwnerLevel: true }), toOwnerWR)],
      text: t('【自】［① 手札を1枚控え室に置き、あなたの舞台のキャラを1枚控え室に置く］あなたがこのカードの『助太刀』を使った時、あなたはコストを払ってよい。そうしたら、あなたは相手の、レベルが相手のレベルより高いキャラを1枚選び、控え室に置く。',
        '【自】［① 手牌1張放到休息室，並將你的舞台的角色1張放到休息室］當你使用此卡的『助太刀』時，你可以支付代價。支付代價的話，你選擇對手的等級比對手的等級高的角色1張，放到休息室。'),
    },
    backup(2500, 2, ...backupText(2500, 2)),
  ], '助太刀+2500。再付1能量丟1張、送1張自己的角色，可以把對手「等級比對手玩家等級高」的角色直接丟進休息室。'),
  char('063', 'red', ['峻厳な鬼教官 イルザ', '嚴峻的魔鬼教官 伊爾莎'], 2, 1, 7500, 1, [], [T.gb, T.soshiki], [
    {
      kind: 'continuous', condition: othersAtLeast(2),
      effects: [{ op: 'grantAbility', target: self, duration: 'whileActive', ability: myTurnPower(3000) }, { op: 'grantAbility', target: self, duration: 'whileActive', ability: ENCORE_GB }],
      text: t('【永】他のあなたの《グラブル》のキャラが2枚以上なら、このカードは次の2つの能力を得る。『【永】あなたのターン中、このカードのパワーを＋3000。』『【自】アンコール［手札の《グラブル》のキャラを1枚控え室に置く］』',
        '【永】其他的你的《碧藍幻想》的角色存在2張以上的話，此卡獲得以下2個能力。『【永】在你的回合中，此卡的攻擊力+3000。』『【自】安可［手牌的《碧藍幻想》的角色1張放到休息室］』'),
    },
    {
      kind: 'activated', perTurn: 1, cost: [discardHand(gb)],
      effects: [{
        op: 'grantAbility', target: self, duration: 'thisTurn',
        ability: { kind: 'auto', trigger: oppReversed, optional: true, effects: [move(clockTop(), toWR)], text: t('【自】このカードのバトル相手が【リバース】した時、あなたは自分のクロックの上から1枚を、控え室に置いてよい。', '【自】此卡的戰鬥對手【倒置】時，你可以將自己的傷害區上方1張，放到休息室。') },
      }],
      text: t('【起】【ターン1】［手札の《グラブル》のキャラを1枚控え室に置く］そのターン中、このカードは次の能力を得る。『【自】このカードのバトル相手が【リバース】した時、あなたは自分のクロックの上から1枚を、控え室に置いてよい。』', '【起】【每回合1次】［手牌的《碧藍幻想》的角色1張放到休息室］在那個回合中，此卡獲得以下能力。『【自】此卡的戰鬥對手【倒置】時，你可以將自己的傷害區上方1張，放到休息室。』'),
    },
  ], '其他2張以上時：自己回合10500，還能丟1張角色安可。【起】：丟1張角色，這回合打倒對手就回1血。'),
  char('064', 'red', [N.siegfried, '拂曉的忠騎士 齊格飛'], 3, 2, 10000, 2, ['soul'], [T.gb, T.feendrache], [
    {
      kind: 'auto', trigger: placed,
      effects: [move({ zone: 'deck', side: 'self', filter: gb, count: { upTo: 2 } }, toWR), { op: 'shuffleDeck' }, move(deckTopUpTo(1), toStock)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を見て《グラブル》のキャラを2枚まで選び、控え室に置き、その山札をシャッフルし、自分の山札の上から1枚までを、ストック置場に置く。', '【自】此卡從手牌被放置到舞台時，你從自己的牌組選擇《碧藍幻想》的角色最多2張，放到休息室，將那個牌組洗牌，將自己的牌組上方最多1張放到能量區。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxDragon }, trigger: { event: 'climaxPlaced', side: 'self', filter: { name: N.cxDragon } }, optional: true,
      condition: all({ kind: 'phase', phase: 'climax' }, inFront, allGb), cost: [stock(1), discardHand(gb, 2)],
      effects: [N.percival, N.lancelotL3, N.vane].map((name) => move(wrUpTo(1, { name }), { zone: 'stage', side: 'self', slot: 'anyNew' })),
      text: t('【自】【CXコンボ】［① 手札の《グラブル》のキャラを2枚控え室に置く］あなたのCXフェイズ中、CX置場に「ドラゴンナイツ」が置かれた時、前列にこのカードがいて、あなたのキャラすべてが《グラブル》なら、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の、「高潔なる燦炎 パーシヴァル」を1枚までと「俊英の双剣士 ランスロット」を1枚までと「不撓不屈の騎士 ヴェイン」を1枚まで選び、舞台の別々の枠に置く。',
        '【自】【CX連動】［① 手牌的《碧藍幻想》的角色2張放到休息室］在你的名場面階段中，當「龍騎士團」被放置到名場面區時，此卡在前列，你的角色全部是《碧藍幻想》的話，你可以支付代價。支付代價的話，你選擇自己休息室的「高潔的燦炎 帕西瓦爾」最多1張、「俊英的雙劍士 蘭斯洛特」最多1張、「不撓不屈的騎士 韋恩」最多1張，放到舞台上不同的格子。'),
      review: ['「舞台の別々の枠」：可以放到有角色的格子（原本的角色進休息室），但這 3 張不能放同一格；此卡也可能被蓋掉。'],
    },
  ], '登場從牌組丟最多2張《碧藍幻想》角色進休息室（準備連動），牌組上方1張進能量。連動名場面「龍騎士團」：付1能量丟2張角色，從休息室把帕西瓦爾、蘭斯洛特、韋恩一次放上舞台。'),
  char('065', 'red', ['再臨せし堕天の王 ルシファー', '再臨的墮天之王 路西法'], 3, 2, 10000, 2, ['soul'], [T.gb, T.hoshi], [
    {
      kind: 'auto', trigger: placed,
      effects: [
        { op: 'addMarker', from: { zone: 'memory', side: 'self', filter: { name: N.lucifel }, count: { upTo: 1 } }, to: 'source', faceUp: true },
        { op: 'addMarker', from: { zone: 'memory', side: 'self', filter: { name: N.lucio }, count: { upTo: 1 } }, to: 'source', faceUp: true },
      ],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の思い出置場の、「進化の天司 ルシフェル」を1枚までと「暁の裁定者 ルシオ」を1枚まで選び、このカードの下にマーカーとして好きな順番で表向きに置く。',
        '【自】此卡從手牌被放置到舞台時，你選擇自己回憶區的「進化的天司 路西菲爾」最多1張和「曉之裁定者 盧西歐」最多1張，以喜歡的順序正面朝上放到此卡下面當標記。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxTriple }, trigger: encoreSelf, optional: true, condition: inFront,
      cost: [stock(2), { kind: 'discard', selector: { zone: 'marker', side: 'self', count: { exactly: 2 } } }, { kind: 'discard', selector: cxZone(N.cxTriple) }],
      effects: [{ op: 'dealDamage', amount: 6, cancelable: true, times: 2 }],
      text: t('【自】【CXコンボ】［② このカードの下のマーカーを2枚控え室に置き、あなたのCX置場の「トリプルゼロ」を1枚控え室に置く］あなたのアンコールステップの始めに、前列にこのカードがいるなら、あなたはコストを払ってよい。そうしたら、相手に6ダメージを2回与える。（ダメージキャンセルは発生する）',
        '【自】【CX連動】［② 將此卡下面的標記2張放到休息室，並將你的名場面區的「三零」1張放到休息室］在你的安可步驟開始時，此卡在前列的話，你可以支付代價。支付代價的話，給對手2次6點傷害。(會發生傷害取消)'),
    },
  ], '登場把回憶區的路西菲爾、盧西歐放到下面當標記。連動名場面「三零」：安可步驟開始時付2能量、丟2張標記和名場面，給對手2次6點傷害（一擊必殺級）。'),
  char('066', 'red', ['暗躍の震狼 ユーステス', '暗躍的震狼 尤斯塔斯'], 3, 2, 10500, 2, ['soul'], [T.gb, T.soshiki], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'draw', upTo: 2 }, move(hand(undefined, 2), toWR), move(deckTopUpTo(1), toStock)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは2枚まで引き、自分の手札を2枚選び、控え室に置き、自分の山札の上から1枚までを、ストック置場に置く。', '【自】此卡從手牌被放置到舞台時，你抽最多2張牌，選擇自己的手牌2張，放到休息室，將自己的牌組上方最多1張放到能量區。'),
    },
    {
      kind: 'activated', perTurn: 1, cost: [{ kind: 'discard', selector: mine(gb) }], effects: [move(deckTop(1), toStock)],
      text: t('【起】【ターン1】［他のあなたの舞台の《グラブル》のキャラを1枚控え室に置く］あなたは自分の山札の上から1枚を、ストック置場に置く。', '【起】【每回合1次】［將其他的你的舞台的《碧藍幻想》的角色1張放到休息室］你將自己的牌組上方1張放到能量區。'),
    },
  ], '登場抽2丟2、牌組上方1張進能量。【起】：送1張其他角色進休息室，+1能量（每回合1次）。'),
  char('067', 'red', ['月と空のあいだで グウィン', '在月與空之間 格溫'], 0, 0, 500, 1, [], [T.gb, T.soshiki], [
    {
      kind: 'continuous', keyword: { id: 'assist' }, effects: [power({ zone: 'stage', side: 'self', count: 'all', relation: 'frontOfSource' }, 500, 'whileActive')],
      text: t('【永】応援 このカードの前のあなたのキャラすべてに、パワーを＋500。', '【永】應援 此卡前面的你的角色全部，攻擊力+500。'),
    },
    {
      kind: 'activated', cost: [stock(1), { kind: 'restSource' }],
      effects: [{
        op: 'grantAbility', target: mine(gb), duration: 'thisTurn',
        ability: { kind: 'auto', trigger: oppReversed, optional: true, effects: [move(wr(chara), toHand)], text: t('【自】このカードのバトル相手が【リバース】した時、あなたは自分の控え室のキャラを1枚選び、手札に戻してよい。', '【自】此卡的戰鬥對手【倒置】時，你可以選擇自己休息室的角色1張，回到手牌。') },
      }],
      text: t('【起】［① このカードを【レスト】する］あなたは自分の《グラブル》のキャラを1枚選び、そのターン中、次の能力を与える。『【自】このカードのバトル相手が【リバース】した時、あなたは自分の控え室のキャラを1枚選び、手札に戻してよい。』',
        '【起】［① 將此卡【橫置】］你選擇自己的《碧藍幻想》的角色1張，在那個回合中，給予以下能力。『【自】此卡的戰鬥對手【倒置】時，你可以選擇自己休息室的角色1張，回到手牌。』'),
    },
  ], '放後列：斜前方角色+500。【起】：付1能量並橫置，讓1張角色這回合打倒對手時撿回1張角色。'),
  char('068', 'red', ['十天衆 エッセル', '十天眾 艾賽爾'], 0, 0, 1000, 1, [], [T.gb, T.jyuuten], [
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxJyuuten }, trigger: encoreSelf, optional: true, cost: [discardHand(), { kind: 'discard', selector: cxZone(N.cxJyuuten) }],
      effects: [{ op: 'lookTopPick', look: 3, pick: { filter: gb, upTo: 3 }, rest: 'waitingRoom' }],
      text: t('【自】【CXコンボ】［手札を1枚控え室に置き、あなたのCX置場の「空の安寧を守りし十天衆」を1枚控え室に置く］あなたのアンコールステップの始めに、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から3枚まで見て、《グラブル》のキャラを3枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
        '【自】【CX連動】［手牌1張放到休息室，並將你的名場面區的「守護天空安寧的十天眾」1張放到休息室］在你的安可步驟開始時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多3張，選擇《碧藍幻想》的角色最多3張給對手確認，加到手牌，剩下的卡片放到休息室。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'restSource' }], effects: [power(opp({ row: 'front' }), -1000)],
      text: t('【起】［このカードを【レスト】する］あなたは相手の前列のキャラを1枚選び、そのターン中、パワーを－1000。', '【起】［將此卡【橫置】］你選擇對手的前列的角色1張，在那個回合中，攻擊力-1000。'),
    },
  ], '連動名場面「守護天空安寧的十天眾」：安可步驟開始時丟1張＋名場面，看3張，《碧藍幻想》角色全部拿走。【起】：橫置讓對手前列1張-1000。'),
  char('069', 'red', ['虹橋の堕天司 サリエル', '虹橋的墮天司 沙利葉'], 0, 0, 3000, 1, [], [T.gb, T.datenshi], [
    {
      kind: 'continuous', effects: [{ op: 'grantAbility', target: { zone: 'stage', side: 'opponent', count: 'all' }, duration: 'whileActive', ability: ENCORE_2 }],
      text: t('【永】相手のキャラすべてに、『【自】アンコール［②］』を与える。', '【永】對手的角色全部，給予『【自】安可［②］』。'),
    },
    {
      kind: 'auto', trigger: attacks, optional: true, cost: [{ kind: 'discard', selector: mine(gb) }],
      effects: [power(self, 3500), { op: 'extraTriggerCheck', thenStockTopToWaiting: true }],
      text: t('【自】［他のあなたの舞台の《グラブル》のキャラを1枚控え室に置く］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、このカードのパワーを＋3500し、あなたはトリガーステップにトリガーチェックを2回行う。2回行ったら、あなたは自分のストックの上から1枚を、控え室に置く。',
        '【自】［將其他的你的舞台的《碧藍幻想》的角色1張放到休息室］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，此卡的攻擊力+3500，你在判定階段執行2次判定。執行了2次的話，你將自己的能量區上方1張，放到休息室。'),
      review: ['「そのアタック中」的+3500：目前算到那個回合結束。'],
    },
  ], 'Lv0就有3000，但對手的角色都能付2能量安可（比預設的3便宜）。攻擊時送1張其他角色進休息室：+3500並判定2次。'),
  char('070', 'red', ['破天荒なる教皇 アラナン', '破天荒的教皇 阿拉南'], 1, 0, 2000, 1, [], [T.gb, T.jyukken], [
    fromWaitingRoom(cxPhase, levelAtLeast(1), [stock(2), { kind: 'discard', selector: mine(gb) }], emptyFront, [move(clockTop(1, true), toWR)],
      '【自】［② あなたの舞台の《グラブル》のキャラを1枚控え室に置く］控え室にこのカードがあり、あなたのレベルが1以上なら、あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを前列のキャラのいない枠に置き、自分のクロックの上から1枚までを、控え室に置く。',
      '【自】［② 將你的舞台的《碧藍幻想》的角色1張放到休息室］此卡在休息室，你的等級在1以上的話，在你的名場面階段開始時，你可以支付代價。支付代價的話，你將此卡放到前列的沒有角色的格子，將自己的傷害區上方最多1張放到休息室。'),
    {
      kind: 'auto', trigger: attacks, condition: othersAtLeast(2), effects: [power(mine({ color: 'red' }), 3500)],
      text: t('【自】このカードがアタックした時、他のあなたの《グラブル》のキャラが2枚以上なら、あなたは自分の赤のキャラを1枚選び、そのターン中、パワーを＋3500。', '【自】此卡攻擊時，其他的你的《碧藍幻想》的角色存在2張以上的話，你選擇自己的紅色的角色1張，在那個回合中，攻擊力+3500。'),
    },
  ], '在休息室時，名場面階段開始時付2能量＋送1張角色，就能回到前列並回1血。攻擊時讓1張紅色角色+3500。'),
  char('071', 'red', ['鮮烈なる力 フラウ', '鮮烈之力 芙勞'], 3, 2, 10000, 2, ['soul'], [T.gb, T.jyukken], [
    fromWaitingRoom(cxPhase, all(levelAtLeast(3), countAtLeast(4, gb)), [discardHand(undefined, 2)], emptySlot, [],
      '【自】［手札を2枚控え室に置く］控え室にこのカードがあり、あなたのレベルが3以上で、あなたの《グラブル》のキャラが4枚以上なら、あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを舞台のキャラのいない枠に置く。',
      '【自】［手牌2張放到休息室］此卡在休息室，你的等級在3以上，你的《碧藍幻想》的角色存在4張以上的話，在你的名場面階段開始時，你可以支付代價。支付代價的話，你將此卡放到舞台的沒有角色的格子。'),
    {
      kind: 'auto', trigger: attacks, optional: true, condition: othersAtLeast(4), cost: [stock(1), discardHand(gb)], effects: [{ op: 'dealDamage', amount: 2, cancelable: true }],
      text: t('【自】［① 手札の《グラブル》のキャラを1枚控え室に置く］このカードがアタックした時、他のあなたの《グラブル》のキャラが4枚以上なら、あなたはコストを払ってよい。そうしたら、相手に2ダメージを与える。（ダメージキャンセルは発生する）', '【自】［① 手牌的《碧藍幻想》的角色1張放到休息室］此卡攻擊時，其他的你的《碧藍幻想》的角色存在4張以上的話，你可以支付代價。支付代價的話，給對手2點傷害。(會發生傷害取消)'),
    },
  ], '在休息室時（等級3、場上4張《碧藍幻想》），名場面階段開始時丟2張就能免費回到舞台空格。場上放滿時攻擊付1能量丟1張給2點傷害。'),
  char('072', 'red', ['炎帝 パーシヴァル', '炎帝 帕西瓦爾'], 0, 0, 1000, 1, [], [T.gb, T.wales], [
    {
      kind: 'continuous', condition: myTurn, effects: [power(self, { per: others(gb), multiplier: 1000, evaluate: 'live' }, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラ1枚につき、このカードのパワーを＋1000。', '【永】在你的回合中，其他的你的《碧藍幻想》的角色每有1張，此卡的攻擊力+1000。'),
    },
    DOUBLE_CHECK,
  ], '自己回合其他每1張《碧藍幻想》+1000（最多5000）。攻擊時付1能量判定2次。'),
  char('073', 'red', ['銀雪に月影 イルザ', '銀雪月影 伊爾莎'], 0, 0, 1000, 1, [], [T.gb, T.soshiki], [
    {
      kind: 'activated', condition: othersAtLeast(3), cost: [{ kind: 'restSource' }], effects: [{ op: 'drawCards', n: 1 }, move(hand(), toWR)],
      text: t('【起】［このカードを【レスト】する］他のあなたの《グラブル》のキャラが3枚以上なら、あなたは1枚引き、自分の手札を1枚選び、控え室に置く。', '【起】［將此卡【橫置】］其他的你的《碧藍幻想》的角色存在3張以上的話，你抽1張牌，選擇自己的手牌1張，放到休息室。'),
    },
    {
      kind: 'activated', keyword: { id: 'concentrate' }, cost: [stock(1), { kind: 'restSource' }],
      effects: [
        { op: 'revealMill', n: 4, bind: 'milled', result: 'count' },
        { op: 'repeat', times: { countOfBound: 'milled', filter: { type: 'climax' } }, effects: [{ op: 'searchDeck', filter: gb, upTo: 1, reveal: true, shuffle: true }] },
      ],
      text: t('【起】集中［① このカードを【レスト】する］あなたは自分の山札の上から4枚をめくり、控え室に置く。それらのカードのCX1枚につき、あなたは自分の山札を見て《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻4張，放到休息室。那些卡片中每有1張名場面，你從自己的牌組選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
  ], '【起】橫置抽1丟1（場上其他3張以上時）。集中：每張名場面從牌組找1張角色。'),
  char('074', 'red', ['余暇の猛刃 バザラガ', '閒暇的猛刃 巴薩拉加'], 0, 0, 1500, 1, [], [T.gb, T.soshiki], [
    {
      kind: 'continuous', condition: all(myTurn, allGb), effects: [power(self, 8000, 'whileActive'), { op: 'modifySoul', target: self, amount: 1, duration: 'whileActive' }],
      text: t('【永】あなたのターン中、あなたのキャラすべてが《グラブル》なら、このカードのパワーを＋8000し、ソウルを＋1。', '【永】在你的回合中，你的角色全部是《碧藍幻想》的話，此卡的攻擊力+8000，魂傷+1。'),
    },
    {
      kind: 'auto', trigger: { event: 'reversedInBattle' }, effects: [move(deckTop(1), { zone: 'clock', side: 'self' }), { op: 'restSource' }],
      text: t('【自】このカードが【リバース】した時、あなたは自分の山札の上から1枚を、クロック置場に置き、このカードを【レスト】する。', '【自】此卡【倒置】時，你將自己的牌組上方1張放到傷害區，將此卡【橫置】。'),
    },
  ], '全隊都是《碧藍幻想》時，自己回合Lv0就有9500、魂傷2。被打倒時自己吃1點傷害，但他會變成橫置留在場上。'),
  char('075', 'red', ['終わりなき闘争 ベルゼバブ', '無盡的鬥爭 別西卜'], 0, 0, 2000, 1, [], [T.gb, T.hoshi], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1), { kind: 'discard', selector: mine(gb) }], effects: [move(opp(), toOwnerHand)],
      text: t('【自】［① 他のあなたの舞台の《グラブル》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは相手のキャラを1枚選び、手札に戻す。', '【自】［① 將其他的你的舞台的《碧藍幻想》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇對手的角色1張，回到手牌。'),
    },
    {
      kind: 'auto', trigger: attacks, condition: { kind: 'attackMode', mode: 'direct' }, effects: [{ op: 'modifySoul', target: self, amount: 1, duration: 'thisTurn' }],
      text: t('【自】このカードがダイレクトアタックした時、そのターン中、このカードのソウルを＋1。', '【自】此卡直接攻擊時，在那個回合中，此卡的魂傷+1。'),
    },
  ], '登場付1能量送1張角色，彈對手1張角色回手牌。直接攻擊時魂傷再+1（共3點）。'),
  char('076', 'red', ['寒空に震える群青 ベアトリクス', '寒空中顫抖的群青 碧翠克絲'], 1, 0, 1500, 1, ['soul'], [T.gb, T.soshiki], [
    {
      kind: 'auto', trigger: usedActivated, perTurn: 1, optional: true, condition: allGb, effects: [{ op: 'drawCards', n: 1 }, move(hand(), toWR)],
      text: t('【自】【ターン1】あなたが【起】を使った時、あなたのキャラすべてが《グラブル》なら、あなたは1枚引いてよい。そうしたら、あなたは自分の手札を1枚選び、控え室に置く。', '【自】【每回合1次】當你使用【起】時，你的角色全部是《碧藍幻想》的話，你可以抽1張牌。抽了的話，你選擇自己的手牌1張，放到休息室。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'restSource' }], effects: [{ op: 'grantAbility', target: mine(), duration: 'thisTurn', ability: DOUBLE_CHECK }],
      text: t('【起】［このカードを【レスト】する］あなたは自分のキャラを1枚選び、そのターン中、次の能力を与える。『【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。』',
        '【起】［將此卡【橫置】］你選擇自己的角色1張，在那個回合中，給予以下能力。『【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行2次判定。』'),
    },
  ], '【起】橫置：給1張角色「攻擊時付1能量判定2次」。使用【起】時可以抽1丟1（每回合1次）。'),
  char('077', 'red', ['竜殺しの騎士 ジークフリート', '屠龍騎士 齊格飛'], 1, 0, 2500, 1, ['soul'], [T.gb, T.feendrache], [
    {
      kind: 'continuous', condition: myTurn, effects: [power(others(gb), 1000, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラすべてに、パワーを＋1000。', '【永】在你的回合中，其他的你的《碧藍幻想》的角色全部，攻擊力+1000。'),
    },
    {
      kind: 'activated', condition: levelAtLeast(3), cost: [{ kind: 'sendSourceToWaitingRoom' }],
      effects: [move({ zone: 'hand', side: 'self', filter: { name: N.siegfried }, count: { upTo: 1 } }, { zone: 'stage', side: 'self', slot: 'sourceSlot' })],
      text: t('【起】［このカードを控え室に置く］あなたのレベルが3以上なら、あなたは自分の手札の「払暁の忠騎士 ジークフリート」を1枚まで選び、このカードがいた枠に置く。', '【起】［將此卡放到休息室］你的等級在3以上的話，你選擇自己手牌的「拂曉的忠騎士 齊格飛」最多1張，放到此卡原本的格子。'),
    },
  ], '自己回合其他《碧藍幻想》+1000。等級3時【起】：把自己換成手牌的「拂曉的忠騎士 齊格飛」（不用付費，登場效果會發動）。'),
  char('078', 'red', ['狡知の堕天司 ベリアル', '狡知的墮天司 貝利亞爾'], 1, 0, 2500, 1, ['soul'], [T.gb, T.datenshi], [
    {
      kind: 'continuous', condition: { kind: 'countAtLeast', selector: others({ name: N.lucifer, row: 'back' }), n: 1 },
      effects: [power(self, 3500, 'whileActive'), { op: 'grantAbility', target: self, duration: 'whileActive', ability: DOUBLE_CHECK_PAY }],
      text: t('【永】他のあなたの後列の「星の民 ルシファー」がいるなら、このカードのパワーを＋3500し、このカードは次の能力を得る。『【自】このカードがアタックした時、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。2回行ったら、あなたは自分のストックの上から1枚を、控え室に置く。』',
        '【永】有其他的你的後列的「星之民 路西法」存在的話，此卡的攻擊力+3500，此卡獲得以下能力。『【自】此卡攻擊時，在那次攻擊中，你在判定階段執行2次判定。執行了2次的話，你將自己的能量區上方1張，放到休息室。』'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand(gb)], effects: [move(wr({ name: N.lucifer }), anySlot)],
      text: t('【自】［手札の《グラブル》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「星の民 ルシファー」を1枚選び、舞台の好きな枠に置く。', '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「星之民 路西法」1張，放到舞台上喜歡的格子。'),
    },
  ], '後列有「星之民 路西法」時6000，攻擊時判定2次。登場丟1張角色，從休息室把路西法直接放上舞台。'),
  char('079', 'red', ['逢光の清狼 ユーステス', '逢光的清狼 尤斯塔斯'], 1, 1, 1000, 1, ['soul'], [T.gb, T.soshiki], [
    {
      kind: 'auto', trigger: { event: 'usedBackup' }, condition: { kind: 'opponentClimaxInZone' }, effects: [power(inBattle(gb), 2000)],
      text: t('【自】あなたがこのカードの『助太刀』を使った時、相手のCX置場にCXがあるなら、あなたは自分のバトル中の《グラブル》のキャラを1枚選び、そのターン中、パワーを＋2000。', '【自】當你使用此卡的『助太刀』時，對手的名場面區有名場面的話，你選擇自己戰鬥中的《碧藍幻想》的角色1張，在那個回合中，攻擊力+2000。'),
    },
    backup(2000, 1, ...backupText(2000, 1)),
  ], '助太刀+2000；對手有打名場面的回合再+2000。'),
  char('080', 'red', [N.lucifer, '星之民 路西法'], 1, 1, 4500, 1, ['soul'], [T.gb, T.hoshi], [
    {
      kind: 'continuous', condition: myTurn, effects: [power(others(gb), 1000, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラすべてに、パワーを＋1000。', '【永】在你的回合中，其他的你的《碧藍幻想》的角色全部，攻擊力+1000。'),
    },
    {
      kind: 'auto', trigger: { event: 'climaxPlaced', side: 'self', filter: { type: 'climax', hasTrigger: 'choice' } }, optional: true, condition: othersAtLeast(3),
      effects: [move(wr({ names: [N.sandalphon, N.lucifel, N.lucio] }), toMemory)],
      text: t('【自】あなたのトリガーアイコンが【チョイス】のCXがCX置場に置かれた時、他のあなたの《グラブル》のキャラが3枚以上なら、あなたは自分の控え室の、「復讐の天司 サンダルフォン」か「進化の天司 ルシフェル」か「暁の裁定者 ルシオ」を1枚選び、思い出にしてよい。',
        '【自】當判定標誌是選擇的你的名場面被放置到名場面區時，其他的你的《碧藍幻想》的角色存在3張以上的話，你可以選擇自己休息室的「復讐的天司 聖德芬」或「進化的天司 路西菲爾」或「曉之裁定者 盧西歐」1張，放到回憶區。'),
    },
  ], '自己回合其他《碧藍幻想》+1000。打出選擇名場面時，可以把休息室的聖德芬、路西菲爾或盧西歐放進回憶區（給記憶、標記用）。'),
  char('081', 'red', ['真夏の穿光 ゼタ', '盛夏的穿光 傑塔'], 3, 2, 8500, 2, ['soul'], [T.gb, T.soshiki], [
    handLevelDown({ kind: 'any', of: [
      { kind: 'countAtMost', selector: { zone: 'waitingRoom', side: 'self', filter: { type: 'climax' }, count: 'all' }, n: 2 },
      { kind: 'countAtMost', selector: { zone: 'waitingRoom', side: 'opponent', filter: { type: 'climax' }, count: 'all' }, n: 2 },
    ] }, '【永】あなたか相手の、控え室のCXが2枚以下なら、あなたの手札のこのカードのレベルを－1。', '【永】你或對手的休息室的名場面在2張以下的話，你的手牌的此卡的等級-1。'),
    heal(true),
    {
      kind: 'auto', trigger: usedActivated, perTurn: 1, condition: othersAtLeast(1), effects: [power(self, 3000)],
      text: t('【自】この能力は1ターンにつき1回まで発動する。あなたが【起】を使った時、他のあなたの《グラブル》のキャラがいるなら、そのターン中、このカードのパワーを＋3000。', '【自】此能力每回合最多發動1次。當你使用【起】時，有其他的你的《碧藍幻想》的角色存在的話，在那個回合中，此卡的攻擊力+3000。'),
    },
  ], '雙方任一方休息室名場面2張以下時，手牌的她算Lv2。登場回1血。使用【起】時+3000（每回合1次）。'),
  char('082', 'red', ['『朱』の慈温 ウィルナス', '『朱』之慈溫 威爾納斯'], 3, 2, 9500, 2, ['soul'], [T.gb, T.rokuryu], [
    {
      kind: 'auto', trigger: placed, effects: [power(self, 3000)],
      text: t('【自】このカードが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋3000。', '【自】此卡從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+3000。'),
    },
    {
      kind: 'auto', trigger: encoreSelf, optional: true, condition: all({ kind: 'placedThisTurnFromHand' }, inFront, { kind: 'opponentFrontClear' }), cost: [stock(3), discardHand(undefined, 3)],
      effects: [move({ zone: 'stage', side: 'opponent', filter: { row: 'front' }, count: 'all' }, { zone: 'clock' })],
      text: t('【自】［③ 手札を3枚控え室に置く］このカードが手札から舞台に置かれたターン中、あなたのアンコールステップの始めに、前列にこのカードがいて、相手の前列のキャラがいないか相手の前列のキャラすべてが【リバース】しているなら、あなたはコストを払ってよい。そうしたら、あなたは相手の前列のキャラすべてを、クロック置場に好きな順番で置く。',
        '【自】［③ 手牌3張放到休息室］此卡從手牌被放置到舞台的回合中，在你的安可步驟開始時，此卡在前列，對手的前列沒有角色或對手的前列的角色全部【倒置】的話，你可以支付代價。支付代價的話，你將對手的前列的角色全部，以喜歡的順序放到傷害區。'),
      review: ['「好きな順番で」：目前依前列格子的順序（左、中、右）放到傷害區。'],
    },
  ], '登場回合12500。登場的回合把對手前列全部打倒後，安可步驟開始時付3能量丟3張，把那些角色全部放進對手的傷害區（最多3點不能取消的傷害）。'),
  ev('083', ['STAY MOON', 'STAY MOON'], 'red', 3, 2, [{
    kind: 'event', timing: 'counter',
    effects: [
      {
        op: 'repeat', times: 2, effects: [
          power({ ...mine(), as: 'staymoon' }, 1000),
          { op: 'grantAbility', target: { zone: 'stage', side: 'self', count: 'all', fromBind: 'staymoon' }, duration: 'thisTurn', ability: facingSoulDown(1) },
        ],
      },
      { op: 'sourceToMemory' },
    ],
    text: t('【カウンター】このカードは、あなたの《グラブル》のキャラがいないなら、手札からプレイできない。次の行動を2回行う。『あなたは自分のキャラを1枚選び、そのターン中、パワーを＋1000し、次の能力を与える。『【永】このカードの正面のキャラのソウルを－1。』』このカードを思い出にする。',
      '【反擊】沒有你的《碧藍幻想》的角色存在的話，此卡不能從手牌使用。執行以下動作2次。『你選擇自己的角色1張，在那個回合中，攻擊力+1000，給予以下能力。『【永】此卡的正面的角色的魂傷-1。』』將此卡放到回憶區。'),
    review: ['同一張角色可以選 2 次（+2000、正面魂傷-2）。'],
  }], '反擊步驟也能用：選2次角色，每次+1000並讓它正面的角色魂傷-1。用完放進回憶區。', { playCondition: countAtLeast(1, gb) }),
  cx('084', [N.cxJyuuten, '守護天空安寧的十天眾'], 'red', ['comeback'], [climax('comeback')], '全部角色+1000、魂傷+1。連動：「十天眾 艾賽爾」。判定翻到時可以撿回1張角色。'),
  cx('085', [N.cxDragon, '龍騎士團'], 'red', ['comeback'], [climax('comeback')], '全部角色+1000、魂傷+1。連動：「拂曉的忠騎士 齊格飛」「不退轉的守護騎士 韋恩」。判定翻到時可以撿回1張角色。'),
  cx('086', [N.cxTatakai, '戰鬥之後'], 'red', ['comeback'], [climax('comeback')], '全部角色+1000、魂傷+1。連動：「真紅的覺醒 傑塔」。判定翻到時可以撿回1張角色。'),
  char('087', 'blue', [N.lancelotL1, '忠誓的騎士團長 蘭斯洛特'], 1, 0, 3000, 1, ['soul'], [T.gb, T.feendrache], [
    {
      kind: 'continuous', condition: all(myTurn, allGb), effects: [power(self, 4000, 'whileActive')],
      text: t('【永】あなたのターン中、あなたのキャラすべてが《グラブル》なら、このカードのパワーを＋4000。', '【永】在你的回合中，你的角色全部是《碧藍幻想》的話，此卡的攻擊力+4000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxFeendrache }, trigger: oppReversed, optional: true, condition: all(cxIn(N.cxFeendrache), othersAtLeast(2)), cost: [stock(1)],
      effects: [{ op: 'lookTopReorder', n: 3 }, { op: 'draw', upTo: 1 }, move(deckTopUpTo(1), { zone: 'stock', side: 'self', position: 'bottom' })],
      text: t('【自】【CXコンボ】［①］このカードのバトル相手が【リバース】した時、あなたのCX置場に「フェードラッヘの騎士達」があり、他のあなたの《グラブル》のキャラが2枚以上なら、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から3枚まで見て、山札の上に好きな順番で置き、1枚まで引き、自分の山札の上から1枚までを、ストック置場の下に置く。',
        '【自】【CX連動】［①］此卡的戰鬥對手【倒置】時，你的名場面區有「菲德拉赫的騎士們」，其他的你的《碧藍幻想》的角色存在2張以上的話，你可以支付代價。支付代價的話，你從自己的牌組上方看最多3張，以喜歡的順序放回牌組上方，抽最多1張牌，將自己的牌組上方最多1張放到能量區下方。'),
      review: ['「3枚まで見て」：目前固定看 3 張。'],
    },
  ], '自己回合全隊《碧藍幻想》時7000。連動名場面「菲德拉赫的騎士們」：打倒對手付1能量，看3張排順序，抽1張，再把1張放到能量區最下面。'),
  char('088', 'blue', ['六竜の『黒』 フェディエル', '六龍之『黑』 菲迪耶爾'], 3, 2, 10000, 1, ['soul'], [T.gb, T.rokuryu], [
    handLevelDown(countAtLeast(4, gb), '【永】あなたの《グラブル》のキャラが4枚以上なら、あなたの手札のこのカードのレベルを－1。', '【永】你的《碧藍幻想》的角色存在4張以上的話，你的手牌的此卡的等級-1。'),
    {
      kind: 'auto', trigger: placed,
      effects: [{
        op: 'chooseOne', options: [
          { label: '可以回1血（傷害區上方1張放到休息室）', effects: [{ op: 'may', prompt: '要把傷害區上方1張放到休息室嗎', then: [move(clockTop(), toWR)] }] },
          { label: '對手留1張休息室的名場面，其餘洗回牌組；此卡+1000', effects: [{ op: 'waitingToDeck', side: 'opponent', keepClimax: true }, power(self, 1000)] },
        ],
      }],
      text: t('【自】このカードが手札から舞台に置かれた時、次の2つの効果のうちあなたが選んだ1つを行う。『あなたは自分のクロックの上から1枚を、控え室に置いてよい。』『相手は自分の控え室のCXを1枚選び、そのカード以外の控え室のカードすべてを、山札に戻し、その山札をシャッフルし、そのターン中、このカードのパワーを＋1000。』',
        '【自】此卡從手牌被放置到舞台時，從以下2個效果中選擇1個執行。『你可以將自己的傷害區上方1張，放到休息室。』『對手選擇自己休息室的名場面1張，那張以外的休息室的卡片全部放回牌組，將那個牌組洗牌，在那個回合中，此卡的攻擊力+1000。』'),
    },
  ], '場上有4張以上《碧藍幻想》時，手牌的她算Lv2。登場二選一：回1血；或讓對手休息室只留1張名場面、其餘洗回牌組（對手牌組名場面變少，比較難取消傷害）並+1000。'),
  char('089', 'blue', ['嘆きの恋人 ニーア', '嘆息的戀人 妮雅'], 3, 2, 10500, 2, [], [T.gb, T.jyukken], [
    fromWaitingRoom(cxPhase, all(levelAtLeast(3), allGb), [stock(2), discardHand()], emptySlot, [],
      '【自】［② 手札を1枚控え室に置く］控え室にこのカードがあり、あなたのレベルが3以上で、あなたのキャラすべてが《グラブル》なら、あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを舞台のキャラのいない枠に置く。',
      '【自】［② 手牌1張放到休息室］此卡在休息室，你的等級在3以上，你的角色全部是《碧藍幻想》的話，在你的名場面階段開始時，你可以支付代價。支付代價的話，你將此卡放到舞台的沒有角色的格子。'),
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxHimitsu }, trigger: attacks, optional: true, condition: cxIn(N.cxHimitsu), cost: [stock(1)],
      effects: [
        { op: 'shieldAutoDamage' },
        {
          op: 'chooseOne', options: [
            { label: '回最多2血（傷害區上方最多2張放到休息室）', effects: [move(clockTop(2, true), toWR)] },
            { label: '給對手4點傷害', effects: [{ op: 'dealDamage', amount: 4, cancelable: true }] },
          ],
        },
      ],
      text: t('【自】【CXコンボ】［①］このカードがアタックした時、CX置場に「秘密の趣味」があるなら、あなたはコストを払ってよい。そうしたら、次の相手のターンの終わりまで、このカードのバトル中、あなたは相手のキャラの【自】の効果によるダメージを受けず、あなたは自分のクロックの上から2枚までを、控え室に置くか、相手に4ダメージを与える。（ダメージキャンセルは発生する）',
        '【自】【CX連動】［①］此卡攻擊時，名場面區有「秘密的嗜好」的話，你可以支付代價。支付代價的話，到下次的對手回合結束前，此卡的戰鬥中，你不受對手角色的【自】的效果造成的傷害，你將自己的傷害區上方最多2張放到休息室，或給對手4點傷害。(會發生傷害取消)'),
    },
  ], '在休息室時（等級3、全隊《碧藍幻想》），名場面階段開始時付2能量丟1張就能回到舞台。連動名場面「秘密的嗜好」：攻擊時付1能量，回2血或給4點傷害；到對手回合結束，她的戰鬥中不受對手角色【自】的傷害。'),
  char('090', 'blue', ['六竜の『碧』 ワムデュス', '六龍之『碧』 瓦姆迪斯'], 0, 0, 500, 1, [], [T.gb, T.rokuryu], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand(gb)], effects: [{ op: 'noStandNext', target: opp({ levelAtMost: 3 }) }],
      text: t('【自】［手札の《グラブル》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは相手のレベル3以下のキャラを1枚選ぶ。そのキャラは次の相手のスタンドフェイズに【スタンド】しない。', '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇對手的等級3以下的角色1張。那張角色在下次的對手的起立階段不【直立】。'),
    },
    {
      kind: 'auto', activeIn: 'clock', trigger: mainStart, optional: true, condition: levelAtLeast(0), effects: [{ op: 'shiftSwap', filter: { color: 'blue' } }],
      text: t('【自】【クロック】シフト レベル0（あなたのメインフェイズの始めに、あなたは自分の手札の青のカードを1枚とクロック置場のこのカードを選び、入れ替えてよい）', '【自】【傷害區】轉移 等級0（在你的主要階段開始時，你可以選擇自己手牌的藍色卡片1張和傷害區的此卡，交換）'),
    },
  ], '登場丟1張角色，讓對手1張Lv3以下的角色下回合不能直立。轉移：在傷害區時，主要階段開始時可以和手牌1張藍色卡交換（把它拿回手牌）。'),
  char('091', 'blue', ['不退転の守護騎士 ヴェイン', '不退轉的守護騎士 韋恩'], 0, 0, 1000, 1, [], [T.gb, T.feendrache], [
    {
      kind: 'continuous', keyword: { id: 'cxCombo', climaxName: N.cxDragon }, condition: { kind: 'any', of: [cxIn(N.cxDragon), cxIn(N.cxFeendrache)] }, effects: [{ op: 'gainTrigger', icon: 'comeback' }],
      text: t('【永】【CXコンボ】あなたのCX置場に、「ドラゴンナイツ」か「フェードラッヘの騎士達」があるなら、すべての領域にあるこのカードはトリガーアイコンに【カムバック】を得る。', '【永】【CX連動】你的名場面區有「龍騎士團」或「菲德拉赫的騎士們」的話，在所有區域的此卡的判定標誌得到木門。'),
    },
    {
      kind: 'activated', keyword: { id: 'concentrate' }, cost: [stock(1), { kind: 'restSource' }],
      effects: [
        { op: 'revealMill', n: 4, bind: 'milled', result: 'count' },
        { op: 'repeat', times: { countOfBound: 'milled', filter: { names: [N.cxDragon, N.cxFeendrache] } }, effects: [move(wrUpTo(1, chara), toHand), power(mine(), 1000)] },
      ],
      text: t('【起】【CXコンボ】集中［① このカードを【レスト】する］あなたは自分の山札の上から4枚をめくり、控え室に置く。それらのカードの「ドラゴンナイツ」か「フェードラッヘの騎士達」1枚につき、あなたは自分の控え室のキャラを1枚まで選び、手札に戻し、自分のキャラを1枚選び、そのターン中、パワーを＋1000。',
        '【起】【CX連動】集中［① 將此卡【橫置】］你從自己的牌組上方翻4張，放到休息室。那些卡片中的「龍騎士團」或「菲德拉赫的騎士們」每有1張，你選擇自己休息室的角色最多1張，回到手牌，選擇自己的角色1張，在那個回合中，攻擊力+1000。'),
    },
  ], '名場面區有「龍騎士團」或「菲德拉赫的騎士們」時，這張卡（判定翻到時也算）有木門圖示。集中：每翻到1張那兩種名場面，撿回1張角色並讓1張角色+1000。'),
  char('092', 'blue', ['イノセンスフラワー ルリア', '純真之花 露莉亞'], 0, 0, 1500, 1, [], [T.gb, T.grancypher], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand(gb)],
      effects: [move({ zone: 'deck', side: 'self', filter: { type: 'character', levelAtMost: 0, nameIncludes: ['主人公(男)', '主人公(女)'] }, count: { upTo: 1 } }, anySlot), { op: 'shuffleDeck' }],
      text: t('【自】［手札の《グラブル》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見てレベル0以下のカード名に「主人公(男)」か「主人公(女)」を含むキャラを1枚まで選び、舞台の好きな枠に置き、その山札をシャッフルする。',
        '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組選擇等級0以下的卡名包含「主人公(男)」或「主人公(女)」的角色最多1張，放到舞台上喜歡的格子，將那個牌組洗牌。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxKimito }, trigger: { event: 'myAttackPhaseStart' }, optional: true, condition: othersAtLeast(2), cost: [discardHand(), { kind: 'discard', selector: cxZone(N.cxKimito) }],
      effects: [move(wrUpTo(2, gb), toHand)],
      text: t('【自】【CXコンボ】［手札を1枚控え室に置き、あなたのCX置場の「君と紡ぐ、空の物語」を1枚控え室に置く］あなたのアタックフェイズの始めに、他のあなたの《グラブル》のキャラが2枚以上なら、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《グラブル》のキャラを2枚まで選び、手札に戻す。',
        '【自】【CX連動】［手牌1張放到休息室，並將你的名場面區的「與你編織的天空故事」1張放到休息室］在你的攻擊階段開始時，其他的你的《碧藍幻想》的角色存在2張以上的話，你可以支付代價。支付代價的話，你選擇自己休息室的《碧藍幻想》的角色最多2張，回到手牌。'),
    },
  ], '登場丟1張角色：從牌組把Lv0的主人公直接放上舞台。連動名場面「與你編織的天空故事」：攻擊階段開始時丟1張＋名場面，撿回2張角色。'),
  char('093', 'blue', ['時竜 オロロジャイア', '時龍 奧羅洛加亞'], 0, 0, 1500, 1, [], [T.gb], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'lookTopReorder', n: 2 }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を上から2枚まで見て、山札の上に好きな順番で置く。', '【自】此卡從手牌被放置到舞台時，你從自己的牌組上方看最多2張，以喜歡的順序放回牌組上方。'),
      review: ['「2枚まで見て」：目前固定看 2 張。'],
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand(gb)], effects: [{ op: 'drawCards', n: 1 }],
      text: t('【自】［手札の《グラブル》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは1枚引く。', '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你抽1張牌。'),
    },
  ], '登場看2張排順序；丟1張角色抽1張。（和Lv3的「時龍 奧羅洛加亞」同名，構築時合計最多4張）'),
  char('094', 'blue', ['リヴォルヴシーカー・イクリプス 主人公(男)', '輪轉追尋者·蝕 主人公(男)'], 0, 0, 2000, 1, [], [T.gb, T.grancypher], [
    {
      kind: 'continuous', condition: all(myTurn, allGb), effects: [{ op: 'modifyLevel', target: self, amount: 1, duration: 'whileActive' }, power(self, 1500, 'whileActive')],
      text: t('【永】あなたのターン中、あなたのキャラすべてが《グラブル》なら、このカードのレベルを＋1し、パワーを＋1500。', '【永】在你的回合中，你的角色全部是《碧藍幻想》的話，此卡的等級+1，攻擊力+1500。'),
    },
    {
      kind: 'auto', trigger: { event: 'allyFrontAttacked', filter: gb }, optional: true, cost: [stock(1), { kind: 'sendSourceToWaitingRoom' }], effects: [move(target, toHand)],
      text: t('【自】［① このカードを控え室に置く］他のあなたの《グラブル》のキャラがフロントアタックされた時、あなたはコストを払ってよい。そうしたら、そのキャラを手札に戻す。', '【自】［① 將此卡放到休息室］其他的你的《碧藍幻想》的角色被正打時，你可以支付代價。支付代價的話，將那張角色回到手牌。'),
    },
  ], '自己回合全隊《碧藍幻想》時Lv1、3500。其他角色被正打時，付1能量把自己送進休息室，讓被打的角色回手牌（不會被打倒）。'),
  char('095', 'blue', ['リヴォルヴシーカー・イクリプス 主人公(女)', '輪轉追尋者·蝕 主人公(女)'], 0, 0, 2000, 1, [], [T.gb, T.grancypher], [
    DOUBLE_CHECK_PAY,
    {
      kind: 'auto', trigger: attackEnd, optional: true, cost: [stock(1), discardHand()], effects: [{ op: 'searchDeck', filter: gb, upTo: 1, reveal: true, shuffle: true }],
      text: t('【自】［① 手札を1枚控え室に置く］このカードのアタックの終わりに、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。', '【自】［① 手牌1張放到休息室］此卡的攻擊結束時，你可以支付代價。支付代價的話，你從自己的牌組選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
  ], '攻擊時一定判定2次（之後能量區上方1張丟掉）。攻擊完付1能量丟1張，從牌組找1張角色。'),
  char('096', 'blue', ['時竜 オロロジャイア', '時龍 奧羅洛加亞'], 3, 2, 9500, 2, ['soul'], [T.gb], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'searchDeck', filter: gb, upTo: 1, reveal: true, shuffle: true }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を見て《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。', '【自】此卡從手牌被放置到舞台時，你從自己的牌組選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxOrolo }, trigger: attacks, optional: true, condition: cxIn(N.cxOrolo), cost: [stock(1), discardHand()],
      effects: [{
        op: 'chooseOne', options: [
          { label: '自己休息室最多2張洗回牌組', effects: [move(wrUpTo(2), { zone: 'deck', side: 'self' }), { op: 'shuffleDeck' }] },
          { label: '對手休息室最多3張洗回對手牌組，給對手1點傷害', effects: [move({ zone: 'waitingRoom', side: 'opponent', count: { upTo: 3 } }, { zone: 'deck', side: 'opponent' }), { op: 'shuffleDeck', side: 'opponent' }, { op: 'dealDamage', amount: 1, cancelable: true }] },
        ],
      }],
      text: t('【自】【CXコンボ】［① 手札を1枚控え室に置く］このカードがアタックした時、CX置場に「オロロジャイア」があるなら、あなたはコストを払ってよい。そうしたら、次の2つの効果のうちあなたが選んだ1つを行う。『あなたは自分の控え室のカードを2枚まで選び、山札に戻し、その山札をシャッフルする。』『あなたは相手の控え室のカードを3枚まで選び、山札に戻し、相手はその山札をシャッフルし、あなたは相手に1ダメージを与える。』（ダメージキャンセルは発生する）',
        '【自】【CX連動】［① 手牌1張放到休息室］此卡攻擊時，名場面區有「奧羅洛加亞」的話，你可以支付代價。支付代價的話，從以下2個效果中選擇1個執行。『你選擇自己休息室的卡片最多2張，放回牌組，將那個牌組洗牌。』『你選擇對手休息室的卡片最多3張，放回牌組，對手將那個牌組洗牌，你給對手1點傷害。』(會發生傷害取消)'),
    },
  ], '登場從牌組找1張角色。連動名場面「奧羅洛加亞」：攻擊時付1能量丟1張，把自己休息室2張（例如名場面）洗回牌組，或把對手休息室3張（例如非名場面）洗回對手牌組並給1點傷害。'),
  char('097', 'blue', ['十天衆 カトル', '十天眾 卡托爾'], 0, 0, 500, 1, [], [T.gb, T.jyuuten], [
    myTurnPower(3000),
    {
      kind: 'auto', trigger: leaves, condition: countAtLeast(1, gb),
      effects: [
        move(deckTop(2), toWR, 'milled'),
        {
          op: 'ifBound', bind: 'milled', filter: { type: 'climax' }, then: [{
            op: 'chooseOne', options: [
              { label: '此卡回到手牌', effects: [move(selfInWR, toHand)] },
              { label: '此卡放到能量區', effects: [move(selfInWR, toStock)] },
              { label: '不移動', effects: [] },
            ],
          }],
        },
      ],
      text: t('【自】このカードが舞台から控え室に置かれた時、あなたの《グラブル》のキャラがいるなら、あなたは自分の山札の上から2枚を、控え室に置く。それらのカードにCXがあるなら、あなたはこのカードを手札に戻すかストック置場に置いてよい。',
        '【自】此卡從舞台被放到休息室時，有你的《碧藍幻想》的角色存在的話，你將自己的牌組上方2張放到休息室。那些卡片中有名場面的話，你可以將此卡回到手牌或放到能量區。'),
    },
  ], '自己回合Lv0就有3500。進休息室時丟牌組上方2張，其中有名場面就能把自己拿回手牌或放進能量區。'),
  char('098', 'blue', ['氷皇 アグロヴァル', '冰皇 阿格羅瓦爾'], 1, 0, 2500, 1, [], [T.gb, T.wales], [
    {
      kind: 'auto', trigger: attacks, effects: [{ op: 'revealTopCheck', filter: gb, matchTo: 'deckTop', ifMatch: [power(stage(), 2000)] }],
      text: t('【自】このカードがアタックした時、あなたは自分の山札の上から1枚を公開する。そのカードが《グラブル》のキャラなら、あなたのキャラすべてに、そのターン中、パワーを＋2000。（公開したカードは元に戻す）', '【自】此卡攻擊時，你將自己的牌組上方1張公開。那張卡片是《碧藍幻想》的角色的話，你的角色全部，在那個回合中，攻擊力+2000。(公開的卡片放回原位)'),
    },
    {
      kind: 'auto', trigger: attacks, condition: { kind: 'opponentInFrontLevel', level: 2 }, effects: [power(self, 6000)],
      text: t('【自】このカードがアタックした時、このカードの正面のキャラのレベルが2なら、そのターン中、このカードのパワーを＋6000。', '【自】此卡攻擊時，此卡的正面的角色的等級是2的話，在那個回合中，此卡的攻擊力+6000。'),
    },
  ], '攻擊時翻牌組最上面1張：是角色就全隊+2000（翻完放回）。正面是Lv2角色就再+6000。'),
  char('099', 'blue', ['十天衆 シス', '十天眾 西斯'], 1, 0, 4000, 1, [], [T.gb, T.jyuuten], [
    {
      kind: 'continuous', condition: all(myTurn, othersAtLeast(2)),
      effects: [
        power(self, 3000, 'whileActive'),
        { op: 'grantAbility', target: self, duration: 'whileActive', ability: { kind: 'auto', trigger: oppReversed, optional: true, effects: [move(deckTop(6), toWR)], text: t('【自】このカードのバトル相手が【リバース】した時、あなたは自分の山札の上から6枚を、控え室に置いてよい。', '【自】此卡的戰鬥對手【倒置】時，你可以將自己的牌組上方6張放到休息室。') } },
      ],
      text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋3000し、このカードは次の能力を得る。『【自】このカードのバトル相手が【リバース】した時、あなたは自分の山札の上から6枚を、控え室に置いてよい。』',
        '【永】在你的回合中，其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+3000，此卡獲得以下能力。『【自】此卡的戰鬥對手【倒置】時，你可以將自己的牌組上方6張放到休息室。』'),
    },
    {
      kind: 'auto', trigger: attackEnd, optional: true, condition: othersAtLeast(4), cost: [stock(4), discardHand(undefined, 2)], effects: [{ op: 'stand', target: self }],
      text: t('【自】［④ 手札を2枚控え室に置く］このカードのアタックの終わりに、他のあなたの《グラブル》のキャラが4枚以上なら、あなたはコストを払ってよい。そうしたら、このカードを【スタンド】する。', '【自】［④ 手牌2張放到休息室］此卡的攻擊結束時，其他的你的《碧藍幻想》的角色存在4張以上的話，你可以支付代價。支付代價的話，將此卡【直立】。'),
    },
  ], '自己回合有2張以上其他角色時7000，打倒對手可以丟牌組6張（加快重洗、調整牌組）。場上放滿時，攻擊完付4能量丟2張就能直立再攻擊一次。'),
  char('100', 'blue', ['義憤の女帝 マリア・テレサ', '義憤的女帝 瑪麗亞·泰瑞莎'], 1, 1, 1000, 1, [], [T.gb, T.jyukken], [
    {
      kind: 'continuous', keyword: { id: 'assist' }, effects: [power({ zone: 'stage', side: 'self', filter: { trait: GB }, count: 'all', relation: 'frontOfSource' }, { perLevelOfTarget: true, multiplier: 500 }, 'whileActive')],
      text: t('【永】応援 このカードの前のあなたの《グラブル》のキャラすべてに、パワーを＋Ｘ。Ｘはそのキャラのレベル×500に等しい。', '【永】應援 此卡前面的你的《碧藍幻想》的角色全部，攻擊力+X。X等於那張角色的等級×500。'),
    },
    fromWaitingRoom(mainStart, levelAtLeast(1), [stock(1), discardHand()], emptySlot, [],
      '【自】［① 手札を1枚控え室に置く］控え室にこのカードがあり、あなたのレベルが1以上なら、あなたのメインフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたはこのカードを舞台のキャラのいない枠に置く。',
      '【自】［① 手牌1張放到休息室］此卡在休息室，你的等級在1以上的話，在你的主要階段開始時，你可以支付代價。支付代價的話，你將此卡放到舞台的沒有角色的格子。'),
    {
      kind: 'activated', cost: [{ kind: 'restSource' }], effects: [power(mineUpTo(2), 1500)],
      text: t('【起】［このカードを【レスト】する］あなたは自分のキャラを2枚まで選び、そのターン中、パワーを＋1500。', '【起】［將此卡【橫置】］你選擇自己的角色最多2張，在那個回合中，攻擊力+1500。'),
    },
  ], '放後列：斜前方角色加「等級×500」。【起】：橫置讓最多2張角色+1500。在休息室時，主要階段開始時付1能量丟1張就能回到舞台空格。'),
  char('101', 'blue', ['十天衆 ウーノ', '十天眾 烏諾'], 2, 1, 2500, 1, ['soul'], [T.gb, T.jyuuten], [
    {
      kind: 'auto', trigger: { event: 'usedBackup' }, optional: true, cost: [stock(4), discardHand(gb)], effects: [{ op: 'rest', target: opp() }],
      text: t('【自】［④ 手札の《グラブル》のキャラを1枚控え室に置く］あなたがこのカードの『助太刀』を使った時、あなたはコストを払ってよい。そうしたら、あなたは相手のキャラを1枚選び、【レスト】する。', '【自】［④ 手牌的《碧藍幻想》的角色1張放到休息室］當你使用此卡的『助太刀』時，你可以支付代價。支付代價的話，你選擇對手的角色1張，【橫置】。'),
    },
    backup(2500, 2, ...backupText(2500, 2)),
  ], '助太刀+2500。再付4能量丟1張角色，可以把對手1張還沒攻擊的角色橫置（不能攻擊）。'),
  char('102', 'blue', [N.haseliera, '欺瞞的女教皇 哈澤莉菈'], 2, 1, 5000, 1, [], [T.gb, T.jyukken], [
    {
      kind: 'continuous', condition: myTurn, effects: [power(stage({ color: 'blue' }), 2000, 'whileActive')],
      text: t('【永】あなたのターン中、あなたの青のキャラすべてに、パワーを＋2000。', '【永】在你的回合中，你的藍色的角色全部，攻擊力+2000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxJyukken }, activeIn: 'waitingRoom', trigger: { event: 'climaxPlaced', side: 'self', filter: { name: N.cxJyukken } }, optional: true,
      condition: all(levelAtLeast(2), { kind: 'phase', phase: 'climax' }), cost: [stock(1)], effects: [recoverSelf(emptySlot)],
      text: t('【自】【CXコンボ】［①］控え室にこのカードがあり、あなたのレベルが2以上なら、あなたのCXフェイズ中、CX置場に「十賢者」が置かれた時、あなたはコストを払ってよい。そうしたら、あなたはこのカードを舞台のキャラのいない枠に置く。',
        '【自】【CX連動】［①］此卡在休息室，你的等級在2以上的話，在你的名場面階段中，當「十賢者」被放置到名場面區時，你可以支付代價。支付代價的話，你將此卡放到舞台的沒有角色的格子。'),
    },
    {
      kind: 'auto', trigger: oppReversed, condition: all(myTurn, othersAtLeast(3)),
      effects: [{ op: 'grantAbility', target: self, duration: 'untilNextOpponentTurnEnd', ability: facingSoulDown(1) }],
      text: t('【自】あなたのターン中、このカードのバトル相手が【リバース】した時、他のあなたの《グラブル》のキャラが3枚以上なら、次の相手のターンの終わりまで、このカードは次の能力を得る。『【永】このカードの正面のキャラのソウルを－1。』',
        '【自】在你的回合中，此卡的戰鬥對手【倒置】時，其他的你的《碧藍幻想》的角色存在3張以上的話，到下次的對手回合結束前，此卡獲得以下能力。『【永】此卡的正面的角色的魂傷-1。』'),
    },
  ], '自己回合藍色角色全部+2000（含自己）。在休息室時，打出名場面「十賢者」就能付1能量回到舞台。打倒對手後，到對手回合結束她正面的角色魂傷-1。'),
  char('103', 'blue', ['獅竜の絆 ひよこ班 アーサー＆モルドレッド', '獅龍的羈絆 小雞班 亞瑟＆莫德雷德'], 2, 1, 5000, 1, [], [T.gb, T.feendrache], [
    {
      kind: 'auto', trigger: placed, effects: [power(mine(), 3000)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のキャラを1枚選び、そのターン中、パワーを＋3000。', '【自】此卡從手牌被放置到舞台時，你選擇自己的角色1張，在那個回合中，攻擊力+3000。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'sourceToDeckBottom' }], effects: [power(opp(), -3000)],
      text: t('【起】［このカードを山札の下に置く］あなたは相手のキャラを1枚選び、そのターン中、パワーを－3000。', '【起】［將此卡放到牌組下方］你選擇對手的角色1張，在那個回合中，攻擊力-3000。'),
    },
  ], '登場讓1張角色+3000。【起】：把自己放到牌組下方，對手1張角色-3000。'),
  char('104', 'blue', ['ファイター 主人公(女)', '鬥士 主人公(女)'], 0, 0, 1000, 1, [], [T.gb, T.grancypher], [{
    kind: 'auto', trigger: attacks, effects: [{ op: 'revealTopCheck', filter: gb, matchTo: 'deckTop', ifMatch: [power(stage(), 2000)] }],
    text: t('【自】このカードがアタックした時、あなたは自分の山札の上から1枚を公開する。そのカードが《グラブル》のキャラなら、あなたのキャラすべてに、そのターン中、パワーを＋2000。（公開したカードは元に戻す）', '【自】此卡攻擊時，你將自己的牌組上方1張公開。那張卡片是《碧藍幻想》的角色的話，你的角色全部，在那個回合中，攻擊力+2000。(公開的卡片放回原位)'),
  }], '攻擊時翻牌組最上面1張（看完放回）：是《碧藍幻想》角色就全隊+2000。'),
  char('105', 'blue', ['ファイター 主人公(男)', '鬥士 主人公(男)'], 0, 0, 4000, 1, [], [T.gb, T.grancypher], [{
    kind: 'continuous', effects: [{ op: 'grantAbility', target: { zone: 'stage', side: 'opponent', count: 'all' }, duration: 'whileActive', ability: ENCORE_2 }],
    text: t('【永】相手のキャラすべてに、『【自】アンコール［②］』を与える。', '【永】對手的角色全部，給予『【自】安可［②］』。'),
  }], 'Lv0就有4000，代價是對手的角色都能付2能量安可。'),
  char('106', 'blue', ['『碧』の聖贈 ワムデュス', '『碧』之聖贈 瓦姆迪斯'], 1, 2, 4000, 1, ['soul'], [T.gb, T.rokuryu], [
    {
      kind: 'auto', trigger: placed, effects: [power(mine(), 3000)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のキャラを1枚選び、そのターン中、パワーを＋3000。', '【自】此卡從手牌被放置到舞台時，你選擇自己的角色1張，在那個回合中，攻擊力+3000。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'sourceToDeckBottom' }], effects: [{ op: 'searchDeck', filter: { type: 'climax' }, upTo: 1, reveal: true, shuffle: true }],
      text: t('【起】［このカードを山札の下に置く］あなたは自分の山札を見てCXを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。', '【起】［將此卡放到牌組下方］你從自己的牌組選擇名場面最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
  ], '登場讓1張角色+3000。【起】：把自己放到牌組下方，從牌組找1張名場面。'),
  char('107', 'blue', ['『黒』の燦夏 フェディエル', '『黑』之燦夏 菲迪耶爾'], 2, 1, 4500, 1, ['soul'], [T.gb, T.rokuryu], [{
    kind: 'auto', trigger: placed,
    effects: [{
      op: 'grantAbility', target: mineUpTo(2), duration: 'thisTurn',
      ability: {
        kind: 'auto', trigger: { event: 'reversedInBattle' }, optional: true, condition: { kind: 'battleOpponentAboveItsLevel' }, effects: [move(battleOpp, toOwnerDeckBottom)],
        text: t('【自】このカードが【リバース】した時、このカードのバトル相手のレベルが相手のレベルより高いなら、あなたはそのキャラを山札の下に置いてよい。', '【自】此卡【倒置】時，此卡的戰鬥對手的等級比對手的等級高的話，你可以將那張角色放到牌組下方。'),
      },
    }],
    text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のキャラを2枚まで選び、そのターン中、次の能力を与える。『【自】このカードが【リバース】した時、このカードのバトル相手のレベルが相手のレベルより高いなら、あなたはそのキャラを山札の下に置いてよい。』',
      '【自】此卡從手牌被放置到舞台時，你選擇自己的角色最多2張，在那個回合中，給予以下能力。『【自】此卡【倒置】時，此卡的戰鬥對手的等級比對手的等級高的話，你可以將那張角色放到牌組下方。』'),
  }], '登場選最多2張角色：這回合它們攻擊被「等級比對手玩家等級高」的角色打倒時，可以把那張角色放到對手牌組下方。'),
  char('108', 'blue', [N.vane, '不撓不屈的騎士 韋恩'], 3, 2, 7500, 2, ['soul'], [T.gb, T.feendrache], [
    {
      kind: 'continuous', effects: [power(others(gb), 1500, 'whileActive')],
      text: t('【永】他のあなたの《グラブル》のキャラすべてに、パワーを＋1500。', '【永】其他的你的《碧藍幻想》的角色全部，攻擊力+1500。'),
    },
    {
      kind: 'auto', trigger: { event: 'myAttackPhaseStart' }, optional: true,
      condition: all(...[N.siegfried, N.percival, N.lancelotL3].map((name) => othersAtLeast(1, { name }))), cost: [stock(1), discardHand(), { kind: 'restSource' }],
      effects: [{ op: 'dealDamage', amount: 4, cancelable: true }],
      text: t('【自】［① 手札を1枚控え室に置き、このカードを【レスト】する］あなたのアタックフェイズの始めに、他のあなたの、「払暁の忠騎士 ジークフリート」と「高潔なる燦炎 パーシヴァル」と「俊英の双剣士 ランスロット」がいるなら、あなたはコストを払ってよい。そうしたら、相手に4ダメージを与える。（ダメージキャンセルは発生する）',
        '【自】［① 手牌1張放到休息室，並將此卡【橫置】］在你的攻擊階段開始時，有其他的你的「拂曉的忠騎士 齊格飛」和「高潔的燦炎 帕西瓦爾」和「俊英的雙劍士 蘭斯洛特」存在的話，你可以支付代價。支付代價的話，給對手4點傷害。(會發生傷害取消)'),
    },
  ], '其他《碧藍幻想》角色全部+1500。四騎士都在場時，攻擊階段開始付1能量丟1張並橫置，給4點傷害。'),
  char('109', 'blue', [N.lancelotL3, '俊英的雙劍士 蘭斯洛特'], 3, 2, 10500, 2, ['soul'], [T.gb, T.feendrache], [
    {
      kind: 'auto', trigger: placed, alsoOn: { event: 'placedByEffectOf', name: N.siegfried },
      effects: [{ op: 'lookTopPick', look: 3, pick: { filter: { anyOf: [gb, { name: N.shikishi }] }, upTo: 2 }, rest: 'waitingRoom' }],
      text: t('【自】このカードが手札から舞台に置かれた時か「払暁の忠騎士 ジークフリート」の【自】の効果で舞台に置かれた時、あなたは自分の山札を上から3枚まで見て、《グラブル》のキャラか「四騎士」を2枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
        '【自】此卡從手牌被放置到舞台時或因「拂曉的忠騎士 齊格飛」的【自】的效果被放置到舞台時，你從自己的牌組上方看最多3張，選擇《碧藍幻想》的角色或「四騎士」最多2張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      review: ['「3枚まで見て」：目前固定看 3 張。'],
    },
    {
      kind: 'auto', trigger: oppReversed, optional: true, condition: all(...[N.siegfried, N.percival, N.vane].map((name) => othersAtLeast(1, { name }))), cost: [stock(3)],
      effects: [{ op: 'dealDamage', amount: 1, cancelable: true, times: 2 }],
      text: t('【自】［③］このカードのバトル相手が【リバース】した時、他のあなたの、「払暁の忠騎士 ジークフリート」と「高潔なる燦炎 パーシヴァル」と「不撓不屈の騎士 ヴェイン」がいるなら、あなたはコストを払ってよい。そうしたら、相手に1ダメージを2回与える。（ダメージキャンセルは発生する）',
        '【自】［③］此卡的戰鬥對手【倒置】時，有其他的你的「拂曉的忠騎士 齊格飛」和「高潔的燦炎 帕西瓦爾」和「不撓不屈的騎士 韋恩」存在的話，你可以支付代價。支付代價的話，給對手2次1點傷害。(會發生傷害取消)'),
    },
  ], '登場（或被齊格飛放上場）時看3張，拿最多2張角色或「四騎士」。四騎士都在場時，打倒對手付3能量給2次1點傷害。'),
  ev('110', ['...and you.', '...and you.'], 'blue', 1, 0, [{
    kind: 'event', timing: 'counter',
    effects: [{
      op: 'payThen', cost: [discardHand(gb)],
      then: [
        move(wrUpTo(1, gb), toHand),
        {
          op: 'grantAbility', target: mine(), duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: leaves, optional: true, effects: [move(selfInWR, toHand)],
            text: t('【自】このカードが舞台から控え室に置かれた時、あなたはこのカードを手札に戻してよい。', '【自】此卡從舞台被放到休息室時，你可以將此卡回到手牌。'),
          },
        },
      ],
    }],
    text: t('【カウンター】［手札の《グラブル》のキャラを1枚控え室に置く］あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《グラブル》のキャラを1枚まで選び、手札に戻し、自分のキャラを1枚選び、そのターン中、次の能力を与える。『【自】このカードが舞台から控え室に置かれた時、あなたはこのカードを手札に戻してよい。』',
      '【反擊】［手牌的《碧藍幻想》的角色1張放到休息室］你可以支付代價。支付代價的話，你選擇自己休息室的《碧藍幻想》的角色最多1張，回到手牌，選擇自己的角色1張，在那個回合中，給予以下能力。『【自】此卡從舞台被放到休息室時，你可以將此卡回到手牌。』'),
  }], '0費反擊事件：丟1張角色、撿回1張角色，再讓被打的角色這回合進休息室時可以回到手牌。'),
  ev('111', [N.shikishi, '四騎士'], 'blue', 2, 0, [{
    kind: 'event', keyword: { id: 'cxCombo', climaxName: N.cxDragon },
    effects: [{
      op: 'if', condition: countAtLeast(1, { anyOf: [traitChar('フェードラッヘ'), traitChar('ウェールズ')] }),
      then: [{
        op: 'chooseOne', options: [
          { label: '看牌組上方4張，拿《碧藍幻想》角色最多1張', effects: [{ op: 'lookTopPick', look: 4, pick: { filter: gb, upTo: 1 }, rest: 'waitingRoom' }] },
          { label: '從休息室撿回「拂曉的忠騎士 齊格飛」', effects: [move(wr({ name: N.siegfried }), toHand)] },
          { label: '把休息室的「忠誓的騎士團長 蘭斯洛特」放上舞台並+2000', effects: [move(wr({ name: N.lancelotL1 }), anySlot, 'lance'), power({ zone: 'stage', side: 'self', count: 'all', fromBind: 'lance' }, 2000)] },
          { label: '付①，從休息室撿回「龍騎士團」', effects: [{ op: 'payThen', cost: [stock(1)], then: [move(wr({ name: N.cxDragon }), toHand)] }] },
        ],
      }],
    }],
    text: t('【CXコンボ】あなたの、《フェードラッヘ》か《ウェールズ》のキャラがいるなら、次の4つの効果のうちあなたが選んだ1つを行う。『あなたは自分の山札を上から4枚まで見て、《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。』『あなたは自分の控え室の「払暁の忠騎士 ジークフリート」を1枚選び、手札に戻す。』『あなたは自分の控え室の「忠誓の騎士団長 ランスロット」を1枚選び、舞台の好きな枠に置き、そのターン中、そのキャラのパワーを＋2000。』『［①］あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「ドラゴンナイツ」を1枚選び、手札に戻す。』',
      '【CX連動】有你的《菲德拉赫》或《威爾斯》的角色存在的話，從以下4個效果中選擇1個執行。『你從自己的牌組上方看最多4張，選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。』『你選擇自己休息室的「拂曉的忠騎士 齊格飛」1張，回到手牌。』『你選擇自己休息室的「忠誓的騎士團長 蘭斯洛特」1張，放到舞台上喜歡的格子，在那個回合中，那張角色的攻擊力+2000。』『［①］你可以支付代價。支付代價的話，你選擇自己休息室的「龍騎士團」1張，回到手牌。』'),
    review: ['場上沒有《菲德拉赫》或《威爾斯》角色時，用了什麼都不會發生。'],
  }], '場上有《菲德拉赫》或《威爾斯》角色時四選一：找角色、撿回齊格飛、把蘭斯洛特從休息室放上場、或付1能量撿回「龍騎士團」。'),
  cx('112', [N.cxKimito, '與你編織的天空故事'], 'blue', ['draw'], drawClimax, '打出時：抽最多1張，最多2張角色這回合魂傷+1（沒有+1000）。連動：「純真之花 露莉亞」。判定翻到時可以抽1張。'),
  cx('113', [N.cxJyukken, '十賢者'], 'blue', ['soul', 'gate'], [climax('gate')], '全部角色+1000、魂傷+1。連動：「欺瞞的女教皇 哈澤莉菈」「斷罪的皇帝 卡策麗菈」。判定翻到時：魂傷+1，還可以從休息室撿回1張名場面。'),
  cx('114', [N.cxFeendrache, '菲德拉赫的騎士們'], 'blue', ['soul', 'gate'], [climax('gate')], '全部角色+1000、魂傷+1。連動：「忠誓的騎士團長 蘭斯洛特」「不退轉的守護騎士 韋恩」。判定翻到時：魂傷+1，還可以從休息室撿回1張名場面。'),
  cx('115', [N.cxOrolo, '奧羅洛加亞'], 'blue', ['draw'], drawClimax, '打出時：抽最多1張，最多2張角色這回合魂傷+1（沒有+1000）。連動：「時龍 奧羅洛加亞」（Lv3）。判定翻到時可以抽1張。'),
  cx('116', [N.cxHimitsu, '秘密的嗜好'], 'blue', ['soul', 'gate'], [climax('gate')], '全部角色+1000、魂傷+1。連動：「嘆息的戀人 妮雅」。判定翻到時：魂傷+1，還可以從休息室撿回1張名場面。'),
  char('P01', 'blue', ['揺らぎの斬姫 ナルメア', '搖曳的斬姬 娜露梅亞'], 1, 0, 1500, 1, [], [T.gb], [
    { kind: 'continuous', rules: ['ignoreColorRequirement'], effects: [], text: t('【永】このカードは、色条件を満たさずに手札からプレイできる。', '【永】此卡不需滿足顏色條件就能從手牌使用。') },
    {
      kind: 'activated', cost: [discardHand(), { kind: 'sendSourceToWaitingRoom' }], effects: [move(wr(chara), toHand)],
      text: t('【起】［手札を1枚控え室に置き、このカードを控え室に置く］あなたは自分の控え室のキャラを1枚選び、手札に戻す。', '【起】［手牌1張放到休息室，並將此卡放到休息室］你選擇自己休息室的角色1張，回到手牌。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'restSource' }], effects: [power(mine(), 1000, 'untilNextOpponentTurnEnd')],
      text: t('【起】［このカードを【レスト】する］あなたは自分のキャラを1枚選び、次の相手のターンの終わりまで、パワーを＋1000。', '【起】［將此卡【橫置】］你選擇自己的角色1張，到下次的對手回合結束前，攻擊力+1000。'),
    },
  ], '不需要同色就能出（任何顏色的牌組都能放）。【起】：丟1張並把自己送進休息室撿回角色；或橫置讓1張角色到對手回合結束+1000。'),
  char('P02', 'green', [N.bikaraP, '祭夜的子神 比卡拉'], 2, 0, 4000, 1, ['soul'], [T.gb, T.jyuuni], [
    ruleText(['【永】このカードと同じカード名のカードと、「北の守護神 ビカラ」は、デッキに合計4枚まで入れることができる。', '【永】此卡和同名的卡、「北之守護神 比卡拉」，牌組合計最多放4張。']),
    ...bikaraAbilities,
  ], '和「北之守護神 比卡拉」效果相同，構築時兩種合計最多4張。', { sameNameAs: [N.bikaraN] }),
  char('P03', 'yellow', ['一切衆生慈恵嘱目装 ガレヲン', '一切眾生慈惠囑目裝 加雷翁'], 0, 0, 500, 1, [], [T.gb, T.rokuryu], [
    ruleText(['【永】このカードと同じカード名のカードと、「六竜の『金』 ガレヲン」は、デッキに合計4枚まで入れることができる。', '【永】此卡和同名的卡、「六龍之『金』 加雷翁」，牌組合計最多放4張。']),
    ...galleonAbilities,
  ], '和「六龍之『金』 加雷翁」效果相同，構築時兩種合計最多4張。', { sameNameAs: [N.galleon] }),
];

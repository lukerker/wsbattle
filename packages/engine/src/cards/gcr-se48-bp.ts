// GIRLS BAND CRY 補充包 GCR/SE48-01～69、PR 卡 P01～P13（P02 和 36 是同一張卡，只收錄 36）。
// 日文原文取自官方卡表（data/cards/GCR-SE48.json）。紅色＝TOGENASHI TOGEARI，藍色＝Diamond Dust。
// 角色、歌名與 Diamond Dust 成員的譯名暫用，之後可能統一調整。
import type { Ability, Card, CardFilter, Effect, Selector, Text } from '../card-schema.ts';

const SERIES = 'GCR';
export const source = '官方卡表';
const t = (ja: string, zh: string): Text => ({ ja, zh });

const MUSIC = '音楽';
const TOGE = 'トゲナシトゲアリ';
const music: CardFilter = { type: 'character', trait: MUSIC };
const toge: CardFilter = { type: 'character', trait: TOGE };
const chara: CardFilter = { type: 'character' };

const self: Selector = { zone: 'stage', side: 'self', count: 'all', relation: 'source' };
const selfOne: Selector = { ...self, count: { exactly: 1 } };
const stage = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: 'all' });
const others = (filter?: CardFilter): Selector => stage({ ...filter, excludeSource: true });
const mine = (filter?: CardFilter, n = 1): Selector => ({ zone: 'stage', side: 'self', filter, count: { exactly: n } });
const mineUpTo = (n: number, filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: { upTo: n } });
const opp = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'opponent', filter, count: { exactly: 1 } });
const battleOpp: Selector = { zone: 'stage', side: 'opponent', count: { exactly: 1 }, relation: 'battleOpponentOfSource' };
const inBattle: Selector = { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'inBattleWithSource' };
const wr = (filter?: CardFilter, n = 1): Selector => ({ zone: 'waitingRoom', side: 'self', filter, count: { exactly: n } });
const wrUpTo = (n: number, filter?: CardFilter): Selector => ({ zone: 'waitingRoom', side: 'self', filter, count: { upTo: n } });
const hand = (filter?: CardFilter, n = 1): Selector => ({ zone: 'hand', side: 'self', filter, count: { exactly: n } });
const deckTop = (n: number): Selector => ({ zone: 'deck', side: 'self', count: { exactly: n }, fromTop: n });
const clockTop: Selector = { zone: 'clock', side: 'self', count: { exactly: 1 }, position: 'top' };
const toHand = { zone: 'hand' as const, side: 'self' as const };
const toWR = { zone: 'waitingRoom' as const, side: 'self' as const };
const toStock = { zone: 'stock' as const, side: 'self' as const };
const toOwnerHand = { zone: 'hand' as const };
const toOwnerWR = { zone: 'waitingRoom' as const };
const toOwnerDeckBottom = { zone: 'deck' as const };
const anySlot = { zone: 'stage' as const, side: 'self' as const, slot: 'any' as const };

const power = (target: Selector, amount: Extract<Effect, { op: 'modifyPower' }>['amount'], duration: 'thisTurn' | 'whileActive' | 'untilNextOpponentTurnEnd' = 'thisTurn'): Effect => ({ op: 'modifyPower', target, amount, duration });
const move = (from: Selector, to: Extract<Effect, { op: 'moveCards' }>['to'], bind?: string): Effect => ({ op: 'moveCards', from, to, ...(bind ? { bind } : {}) });
const discardHand = (filter?: CardFilter, n = 1) => ({ kind: 'discard' as const, selector: hand(filter, n) });
const stock = (n: number) => ({ kind: 'stock' as const, n });
const placed = { event: 'placedFromHandToStage' as const };
const attacks = { event: 'attacks' as const };
const leaves = { event: 'sourceLeavesStageToWaitingRoom' as const };
const comebackChecked = { event: 'myTriggerChecked' as const, filter: { type: 'climax' as const, hasTrigger: 'comeback' as const } };
const levelSum = (n: number) => ({ kind: 'levelZoneSumAtLeast' as const, n });
const allMusic = { kind: 'allMine' as const, filter: { trait: MUSIC } };
const othersMusicAtLeast = (n: number) => ({ kind: 'countAtLeast' as const, selector: others(music), n });
const handLevelDown = (condition: Ability['condition'], ja: string, zh: string): Ability => ({
  kind: 'continuous', activeIn: 'hand', condition, effects: [{ op: 'modifyLevel', target: self, amount: -1, duration: 'whileActive' }], text: t(ja, zh),
});
const encore = (filter: CardFilter): Ability => ({
  kind: 'auto', keyword: { id: 'encore' }, trigger: leaves, optional: true,
  cost: [{ kind: 'discard', selector: hand(filter) }],
  effects: [{ op: 'returnSourceToSlot', state: 'rest' }],
  text: filter.trait ? t('【自】アンコール［手札の《音楽》のキャラを1枚控え室に置く］', '【自】安可［手牌的《音樂》的角色1張放到休息室］') : t('【自】アンコール［手札のキャラを1枚控え室に置く］', '【自】安可［手牌的角色1張放到休息室］'),
});
const backup = (pw: number, level: number, cost: number, ja: string, zh: string): Ability => ({
  kind: 'activated', keyword: { id: 'backup', power: pw, level }, timing: 'counter',
  cost: [...(cost ? [stock(cost)] : []), { kind: 'discardSource' }],
  effects: [power(inBattle, pw)],
  text: t(ja, zh),
});
const doubleCheck = (ja: string, zh: string): Ability => ({
  kind: 'auto', trigger: attacks, optional: true, cost: [stock(1)], effects: [{ op: 'extraTriggerCheck' }], text: t(ja, zh),
});
const DOUBLE_CHECK_JA = '【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。';
const DOUBLE_CHECK_ZH = '【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行2次判定。';
const lookKeep2: Ability = {
  kind: 'auto', trigger: attacks, effects: [{ op: 'lookTopKeep', n: 2 }],
  text: t('【自】このカードがアタックした時、あなたは自分の山札を上から2枚まで見て、カードを1枚選び、山札の上に置き、残りのカードを控え室に置く。', '【自】此卡攻擊時，你從自己的牌組上方看最多2張，選擇卡片1張，放回牌組上方，剩下的卡片放到休息室。'),
  review: ['「2枚まで見て」：目前固定看 2 張。'],
};
const climax = (trigger: 'comeback' | 'gate'): Ability => ({
  kind: 'continuous',
  effects: [
    { op: 'modifyPower', target: stage(), amount: 1000, duration: 'whileActive' },
    { op: 'modifySoul', target: stage(), amount: 1, duration: 'whileActive' },
  ],
  text: trigger === 'comeback'
    ? t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【カムバック】：このカードがトリガーした時、あなたは自分の控え室のキャラを1枚選び、手札に戻してよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(木門：當你判定出此卡時，你可以選擇自己休息室的1張角色，回到手牌)')
    : t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【ゲート】：このカードがトリガーした時、あなたは自分の控え室のCXを1枚選び、手札に戻してよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(門：當你判定出此卡時，你可以選擇自己休息室的1張名場面，回到手牌)'),
});

const TRAIT_MUSIC = t(MUSIC, '音樂');
const TOGE_TRAITS = [TRAIT_MUSIC, t(TOGE, 'TOGENASHI TOGEARI')];
const DD_TRAITS = [TRAIT_MUSIC, t('ダイヤモンドダスト', 'Diamond Dust')];

const N = {
  kawasakiMomoka: '川崎を走って 桃香',
  kawasakiNina: '川崎を走って 仁菜',
  tomoToge: 'トゲナシトゲアリ 智',
  rupaToge: 'トゲナシトゲアリ ルパ',
  rupaButsukari: 'ぶつかり合って進む ルパ',
  rupaHitori: '一人じゃないステージ ルパ',
  event46: '怒りも喜びも哀しさも全部ぶちこめ。',
  cxUnmei: '運命に賭けたい論理',
  cxKara: '空の箱',
  cxGokushi: '極私的極彩色アンサー',
  cxDaremo: '誰にもなれない私だから',
  cxKuuhaku: '空白とカタルシス',
  cxCycle: 'Cycle Of Sorrow',
  cxEternal: 'ETERNAL FLAME 〜空の箱〜',
  aiFeb: '２月の細氷 アイ',
  aiKagayake: '輝けるやり方で アイ',
};

const pending = { translated: true, coded: true, verified: false, tested: true }; // 情境測試：game/cards-gcr-bp.test.ts

export const duplicates: Record<string, string> = { 'GCR/SE48-P02': 'GCR/SE48-36' };

const red = (n: string, name: [string, string], level: number, cost: number, pw: number, soul: number, triggers: Card['triggers'], abilities: Ability[], note: string, traits = TOGE_TRAITS): Card => ({
  id: `GCR/SE48-${n}`, series: SERIES, name: t(...name), type: 'character', color: 'red', level, cost, power: pw, soul, triggers, traits, abilities, note, status: pending,
});
const blue = (n: string, name: [string, string], level: number, cost: number, pw: number, soul: number, triggers: Card['triggers'], abilities: Ability[], note: string): Card => ({
  ...red(n, name, level, cost, pw, soul, triggers, abilities, note, DD_TRAITS), color: 'blue',
});
const cx = (n: string, name: [string, string], color: 'red' | 'blue', trigger: 'comeback' | 'gate', note: string): Card => ({
  id: `GCR/SE48-${n}`, series: SERIES, name: t(...name), type: 'climax', color, triggers: trigger === 'gate' ? ['soul', 'gate'] : ['comeback'], traits: [], abilities: [climax(trigger)], note, status: pending,
});

export const cards: Card[] = [
  red('01', [N.kawasakiNina, '奔跑在川崎 仁菜'], 0, 0, 500, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'sourceInSlot', slots: [1] },
      effects: [power(self, 3000, 'whileActive')],
      text: t('【永】前列の中央の枠にこのカードがいるなら、このカードのパワーを＋3000。', '【永】此卡存在前列中央的格子的話，此卡的攻擊力+3000。'),
    },
    {
      kind: 'auto', trigger: { event: 'allyReversed', filter: { name: N.kawasakiMomoka } }, perTurn: 1, optional: true,
      cost: [stock(1)],
      effects: [{ op: 'rest', target: { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'triggerTarget' } }],
      text: t('【自】［①］この能力は1ターンにつき1回まで発動する。他のあなたの「川崎を走って 桃香」が【リバース】した時、あなたはコストを払ってよい。そうしたら、あなたはそのキャラを【レスト】する。',
        '【自】［①］此能力每回合最多發動1次。其他的你的「奔跑在川崎 桃香」【倒置】時，你可以支付代價。支付代價的話，你將那張角色【橫置】。'),
    },
  ], '放前列正中間就是3500。「奔跑在川崎 桃香」被打倒時，付1能量把她改成橫置，就不會在安可步驟進休息室（每回合1次）。'),
  red('02', ['棘ナシの休日 すばる', '無刺的假日 昂'], 0, 0, 500, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true,
      cost: [{ kind: 'discard', selector: mine(music) }],
      effects: [{ op: 'drawCards', n: 1 }],
      text: t('【自】［他のあなたの舞台の《音楽》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは1枚引く。',
        '【自】［將其他的你的舞台的《音樂》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你抽1張牌。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'sendSourceToWaitingRoom' }],
      effects: [{ op: 'modifySoul', target: mine(music), amount: 1, duration: 'thisTurn' }],
      text: t('【起】［このカードを控え室に置く］あなたは自分の《音楽》のキャラを1枚選び、そのターン中、ソウルを＋1。', '【起】［將此卡放到休息室］你選擇自己的《音樂》的角色1張，在那個回合中，魂傷+1。'),
    },
  ], '登場時可以把場上另1張《音樂》角色送進休息室抽1張（換掉打完的角色）。【起】：把自己送進休息室，讓1張《音樂》角色這回合魂傷+1。'),
  red('03', ['トゲナシトゲアリ 仁菜', 'TOGENASHI TOGEARI 仁菜'], 0, 0, 1000, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'myTurn' }, effects: [power(self, 2500, 'whileActive')],
      text: t('【永】あなたのターン中、このカードのパワーを＋2500。', '【永】在你的回合中，此卡的攻擊力+2500。'),
    },
    {
      kind: 'auto', trigger: { event: 'battleOpponentReversed' },
      effects: [{
        op: 'chooseOne', options: [
          { label: '其他的自己的《音樂》角色1張橫置，移到後列空格', effects: [{ op: 'restAndMoveToBack', target: mine({ ...music, excludeSource: true }) }] },
          { label: '付①並把牌組上方1張放到傷害區，從休息室撿回1張角色', effects: [{ op: 'payThen', cost: [stock(1), { kind: 'deckTopToClock' }], then: [move(wr(chara), toHand)] }] },
        ],
      }],
      text: t('【自】このカードのバトル相手が【リバース】した時、次の2つの効果のうちあなたが選んだ1つを行う。『あなたは他の自分の《音楽》のキャラを1枚選び、【レスト】し、後列のキャラのいない枠に動かす。』『［① あなたの山札の上から1枚をクロック置場に置く］あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のキャラを1枚選び、手札に戻す。』',
        '【自】此卡的戰鬥對手【倒置】時，從以下2個效果中選擇1個執行。『你選擇其他的自己的《音樂》的角色1張，【橫置】，移動到後列的沒有角色的格子。』『［① 將你的牌組上方1張放到傷害區］你可以支付代價。支付代價的話，你選擇自己休息室的角色1張，回到手牌。』'),
    },
  ], '自己回合是3500。打倒對手時二選一：把其他《音樂》角色撤到後列保護起來，或付1能量並自己吃1點傷害，從休息室撿回1張角色。'),
  red('04', ['新川崎（仮） 桃香', '新川崎（暫定） 桃香'], 0, 0, 1000, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [{ kind: 'handToClock' }],
      effects: [{ op: 'lookTopPick', look: { per: others(music), multiplier: 1, evaluate: 'atResolution' }, pick: { filter: {}, upTo: 1 }, rest: 'waitingRoom', secret: true }],
      text: t('【自】［手札を1枚クロック置場に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上からＸ枚まで見て、カードを1枚まで選び、手札に加え、残りのカードを控え室に置く。Ｘは他のあなたの《音楽》のキャラの枚数に等しい。',
        '【自】［手牌1張放到傷害區］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多X張，選擇卡片最多1張，加到手牌，剩下的卡片放到休息室。X等於其他的你的《音樂》的角色張數。'),
      review: ['「Ｘ枚まで見て」：目前固定看 X 張。卡面沒寫「相手に見せ」，拿的卡不公開。'],
    },
    {
      kind: 'auto', trigger: { event: 'reversedInBattle' }, optional: true, condition: { kind: 'battleOpponentLevelAtMost', n: 0 },
      effects: [{ op: 'reverse', target: battleOpp }],
      text: t('【自】このカードが【リバース】した時、このカードのバトル相手のレベルが0以下なら、あなたはそのキャラを【リバース】してよい。', '【自】此卡【倒置】時，此卡的戰鬥對手的等級在0以下的話，你可以將那張角色【倒置】。'),
    },
  ], '登場時把1張手牌放進傷害區（自己吃1點），看X張任選1張（X＝其他《音樂》角色數）。被Lv0角色打倒時，可以同歸於盡。'),
  red('05', ['（バンド名未定） 桃香', '（樂團名未定） 桃香'], 0, 0, 1000, 1, [], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'lookTopReorder', n: 2 }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を上から2枚まで見て、山札の上に好きな順番で置く。', '【自】此卡從手牌被放置到舞台時，你從自己的牌組上方看最多2張，以喜歡的順序放回牌組上方。'),
      review: ['「2枚まで見て」：目前固定看 2 張。'],
    },
    {
      kind: 'auto', trigger: attacks, optional: true, condition: { kind: 'noOthers', selector: others({ row: 'back' }) },
      effects: [
        move(deckTop(1), toWR, 'milled'),
        { op: 'ifBound', bind: 'milled', filter: { type: 'character', levelAtMost: 0 }, then: [move({ zone: 'waitingRoom', side: 'self', count: { exactly: 1 }, fromBind: 'milled' }, { zone: 'stage', side: 'self', row: 'back', slot: 'any' })] },
      ],
      text: t('【自】このカードがアタックした時、他のあなたの後列のキャラがいないなら、あなたは自分の山札の上から1枚を、控え室に置いてよい。そのカードがレベル0以下のキャラなら、あなたはそのキャラを後列の好きな枠に置く。',
        '【自】此卡攻擊時，沒有其他的你的後列的角色存在的話，你可以將自己的牌組上方1張，放到休息室。那張卡片是等級0以下的角色的話，你將那張角色放到後列喜歡的格子。'),
    },
  ], '登場看2張排順序。後列沒有角色時攻擊，可以把牌組最上面1張丟進休息室，是Lv0角色就直接放到後列（等於免費多1張角色）。'),
  red('06', ['“嘘つき”すばる', '"騙子" 昂'], 0, 0, 1000, 1, [], [
    {
      kind: 'auto', trigger: placed, effects: [power(mine(music), 1500)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋1500。', '【自】此卡從手牌被放置到舞台時，你選擇自己的《音樂》的角色1張，在那個回合中，攻擊力+1500。'),
    },
    {
      kind: 'activated', cost: [stock(1), { kind: 'sendSourceToWaitingRoom' }],
      effects: [move(wr({ names: ['間違ってない証明 仁菜', '自由なやり方で 桃香'] }), toHand)],
      text: t('【起】［① このカードを控え室に置く］あなたは自分の控え室の、「間違ってない証明 仁菜」か「自由なやり方で 桃香」を1枚選び、手札に戻す。',
        '【起】［① 將此卡放到休息室］你選擇自己休息室的「沒有錯的證明 仁菜」或「用自由的方式 桃香」1張，回到手牌。'),
    },
  ], '登場時讓1張《音樂》角色+1500。【起】：付1能量把自己送進休息室，從休息室撿回「沒有錯的證明 仁菜」或「用自由的方式 桃香」。'),
  red('07', ['ウンディーネ？ 智', '溫蒂妮？ 智'], 0, 0, 1000, 1, [], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'lookTopPlace', dest: 'waitingRoom' }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を上から1枚見て、山札の上か控え室に置く。', '【自】此卡從手牌被放置到舞台時，你看自己的牌組上方1張，放到牌組上方或休息室。'),
    },
    {
      kind: 'activated', keyword: { id: 'concentrate' }, cost: [stock(1)],
      effects: [
        { op: 'revealMill', n: 4, bind: 'milled', result: 'count' },
        {
          op: 'repeat', times: { countOfBound: 'milled', filter: { type: 'climax' } },
          effects: [
            { op: 'lookTopPick', look: 3, pick: { filter: {}, upTo: 1 }, rest: 'waitingRoom', secret: true },
            move(hand(), toWR),
          ],
        },
      ],
      text: t('【起】集中［①］あなたは自分の山札の上から4枚をめくり、控え室に置く。それらのカードのCX1枚につき、次の行動を行う。『あなたは自分の山札を上から3枚まで見て、カードを1枚まで選び、手札に加え、残りのカードを控え室に置き、自分の手札を1枚選び、控え室に置く。』',
        '【起】集中［①］你從自己的牌組上方翻4張，放到休息室。那些卡片中每有1張名場面，執行以下動作。『你從自己的牌組上方看最多3張，選擇卡片最多1張，加到手牌，剩下的卡片放到休息室，選擇自己的手牌1張，放到休息室。』'),
      review: ['這個集中不用把自己橫置（費用只有①），可以用好幾次。', '「3枚まで見て」：目前固定看 3 張。'],
    },
  ], '登場看牌組最上面1張，不要的丟掉。集中（只要付1能量、不用橫置）：翻4張，每張名場面就「看3張拿1張，再丟1張手牌」，用來換牌、挖牌組。'),
  red('08', ['全てさらけ出す 智', '全部攤開 智'], 0, 0, 1000, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true, condition: othersMusicAtLeast(2),
      effects: [{ op: 'drawCards', n: 1 }, move(hand(), toWR)],
      text: t('【自】このカードが手札から舞台に置かれた時、他のあなたの《音楽》のキャラが2枚以上なら、あなたは1枚引いてよい。そうしたら、あなたは自分の手札を1枚選び、控え室に置く。',
        '【自】此卡從手牌被放置到舞台時，其他的你的《音樂》的角色存在2張以上的話，你可以抽1張牌。抽了的話，你選擇自己的手牌1張，放到休息室。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand({ type: 'climax' })],
      effects: [move(wr(music), toHand)],
      text: t('【自】［手札のCXを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《音楽》のキャラを1枚選び、手札に戻す。',
        '【自】［手牌的名場面1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的《音樂》的角色1張，回到手牌。'),
    },
  ], '場上有2張以上其他《音樂》角色時登場，可以抽1丟1。另外可以丟1張名場面，從休息室撿回1張《音樂》角色。'),
  red('09', ['だから、歌う。 桃香', '所以，我要唱。 桃香'], 0, 0, 1500, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'handAtLeast', n: 5 }, effects: [power(self, 2000, 'whileActive')],
      text: t('【永】あなたの手札が5枚以上なら、このカードのパワーを＋2000。', '【永】你的手牌在5張以上的話，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', trigger: { event: 'battleOpponentReversed' }, optional: true, condition: { kind: 'stockAtMost', n: 4 },
      effects: [move(battleOpp, toOwnerDeckBottom)],
      text: t('【自】このカードのバトル相手が【リバース】した時、あなたのストックが4枚以下なら、あなたはそのキャラを山札の下に置いてよい。', '【自】此卡的戰鬥對手【倒置】時，你的能量在4張以下的話，你可以將那張角色放到牌組下方。'),
    },
  ], '手牌5張以上時是3500。能量4張以下時打倒對手，可以把那張角色放到對手牌組最下面（對手不能安可）。'),
  red('10', [N.kawasakiMomoka, '奔跑在川崎 桃香'], 0, 0, 1500, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand(music)],
      effects: [
        move({ zone: 'deck', side: 'self', filter: { name: N.kawasakiNina }, count: { upTo: 1 } }, anySlot, 'nina'),
        { op: 'shuffleDeck' },
        power({ zone: 'stage', side: 'self', count: 'all', fromBind: 'nina' }, 1000),
      ],
      text: t('【自】［手札の《音楽》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て「川崎を走って 仁菜」を1枚まで選び、舞台の好きな枠に置き、その山札をシャッフルし、そのターン中、そのキャラのパワーを＋1000。',
        '【自】［手牌的《音樂》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組選擇「奔跑在川崎 仁菜」最多1張，放到舞台上喜歡的格子，將那個牌組洗牌，在那個回合中，那張角色的攻擊力+1000。'),
      review: ['「舞台の好きな枠」：可以放到有角色的格子，原本的角色會進休息室。'],
    },
    {
      kind: 'auto', trigger: attacks, condition: allMusic,
      effects: [power(self, { per: { zone: 'stage', side: 'opponent', count: 'all' }, multiplier: 1000, evaluate: 'atResolution' })],
      text: t('【自】このカードがアタックした時、あなたのキャラすべてが《音楽》なら、そのターン中、このカードのパワーを＋Ｘ。Ｘは相手のキャラの枚数×1000に等しい。',
        '【自】此卡攻擊時，你的角色全部是《音樂》的話，在那個回合中，此卡的攻擊力+X。X等於對手的角色張數×1000。'),
    },
  ], '登場丟1張《音樂》角色，從牌組把「奔跑在川崎 仁菜」直接放上舞台（放中間就是3500再+1000）。攻擊時對手每有1張角色+1000。'),
  red('11', ['嘘つきの本音 すばる', '騙子的真心話 昂'], 0, 0, 1500, 1, [], [
    {
      kind: 'auto', trigger: comebackChecked, optional: true,
      cost: [stock(1), discardHand({ name: '嘘つきの本音 すばる' })],
      effects: [{ op: 'revealTopStockRest', n: 2 }],
      text: t('【自】［① 手札の「嘘つきの本音 すばる」を1枚控え室に置く］あなたのトリガーアイコンが【カムバック】のCXがトリガーした時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から2枚まで公開し、カードを1枚選び、ストック置場に置き、残りのカードを手札に加える。',
        '【自】［① 手牌的「騙子的真心話 昂」1張放到休息室］當你判定出判定標誌是木門的名場面時，你可以支付代價。支付代價的話，你將自己的牌組上方最多2張公開，選擇卡片1張，放到能量區，剩下的卡片加到手牌。'),
      review: ['「2枚まで公開」：目前固定公開 2 張。'],
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
  ], '判定翻到木門名場面時，付1能量並丟1張同名卡：公開2張，1張進能量、1張進手牌。集中：翻4張，每張名場面撿回1張角色。'),
  red('12', ['全てさらけ出す すばる', '全部攤開 昂'], 0, 0, 1500, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1), discardHand()],
      effects: [{ op: 'searchDeck', filter: music, upTo: 1, reveal: true, shuffle: true }],
      text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て《音楽》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組選擇《音樂》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
    {
      kind: 'auto', trigger: attacks, effects: [power(mine(music), 1500)],
      text: t('【自】このカードがアタックした時、あなたは自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋1500。', '【自】此卡攻擊時，你選擇自己的《音樂》的角色1張，在那個回合中，攻擊力+1500。'),
    },
  ], '登場付1能量丟1張，從牌組找1張《音樂》角色。攻擊時讓1張《音樂》角色+1500（可以選自己）。'),
  red('13', ['本気で立てるステージ 智', '認真站上的舞台 智'], 0, 0, 1500, 1, [], [
    {
      kind: 'auto', trigger: placed, effects: [power(mine(music), 1500)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋1500。', '【自】此卡從手牌被放置到舞台時，你選擇自己的《音樂》的角色1張，在那個回合中，攻擊力+1500。'),
    },
    {
      kind: 'auto', trigger: leaves, optional: true,
      effects: [{ op: 'revealUpToPick', n: 3, filter: music }],
      text: t('【自】このカードが舞台から控え室に置かれた時、あなたは自分の山札の上から3枚までを、公開してよい。1枚以上公開したなら、あなたはそれらのカードの《音楽》のキャラを1枚まで選び、手札に加え、残りのカードを控え室に置き、自分の手札を1枚選び、控え室に置く。',
        '【自】此卡從舞台被放到休息室時，你可以將自己的牌組上方最多3張公開。公開了1張以上的話，你選擇那些卡片中的《音樂》的角色最多1張，加到手牌，剩下的卡片放到休息室，選擇自己的手牌1張，放到休息室。'),
      review: ['「3枚までを、公開してよい」：選擇發動就固定公開 3 張。'],
    },
  ], '登場時讓1張《音樂》角色+1500。進休息室時可以公開3張，拿1張《音樂》角色再丟1張手牌（換牌）。'),
  red('14', ['beni-shouga ルパ', 'beni-shouga RUPA'], 0, 0, 1500, 1, [], [
    {
      kind: 'auto', trigger: placed,
      effects: [move({ zone: 'stage', side: 'opponent', filter: { row: 'front', levelAtMost: 0 }, count: { upTo: 1 } }, toOwnerHand)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手の前列のレベル0以下のキャラを1枚選び、手札に戻してよい。', '【自】此卡從手牌被放置到舞台時，你可以選擇對手的前列的等級0以下的角色1張，回到手牌。'),
    },
    {
      kind: 'auto', trigger: placed, alsoOn: leaves, optional: true, cost: [stock(1), discardHand()],
      effects: [move(wr(chara), toHand)],
      text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時か舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のキャラを1枚選び、手札に戻す。',
        '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時或從舞台被放到休息室時，你可以支付代價。支付代價的話，你選擇自己休息室的角色1張，回到手牌。'),
    },
  ], '登場時可以把對手前列1張Lv0角色彈回手牌。登場、進休息室時各可以付1能量丟1張，撿回1張角色。'),
  red('15', [N.rupaButsukari, '互相碰撞前進 RUPA'], 0, 0, 1500, 1, [], [
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxUnmei }, trigger: { event: 'climaxPlaced', side: 'self', filter: { name: N.cxUnmei } }, optional: true,
      condition: othersMusicAtLeast(1), cost: [{ kind: 'returnSourceToHand' }],
      effects: [{
        op: 'grantAbility', target: mine(), duration: 'thisTurn',
        ability: {
          kind: 'auto', trigger: attacks, effects: [{ op: 'extraTriggerCheck' }],
          text: t('【自】このカードがアタックした時、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。', '【自】此卡攻擊時，在那次攻擊中，你在判定階段執行2次判定。'),
        },
      }],
      text: t('【自】【CXコンボ】［このカードを手札に戻す］あなたのCX置場に「運命に賭けたい論理」が置かれた時、他のあなたの《音楽》のキャラがいるなら、あなたはコストを払ってよい。そうしたら、あなたは自分のキャラを1枚選び、そのターン中、次の能力を与える。『【自】このカードがアタックした時、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。』',
        '【自】【CX連動】［將此卡回到手牌］當「想賭上命運的理論」被放置到你的名場面區時，有其他的你的《音樂》的角色存在的話，你可以支付代價。支付代價的話，你選擇自己的角色1張，在那個回合中，給予以下能力。『【自】此卡攻擊時，在那次攻擊中，你在判定階段執行2次判定。』'),
    },
    {
      kind: 'activated', cost: [{ kind: 'restSource' }], effects: [power(mine(music), 1500)],
      text: t('【起】［このカードを【レスト】する］あなたは自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋1500。', '【起】［將此卡【橫置】］你選擇自己的《音樂》的角色1張，在那個回合中，攻擊力+1500。'),
    },
  ], '連動名場面「想賭上命運的理論」：打出時把她收回手牌，讓1張角色這回合攻擊時判定2次。【起】：橫置讓《音樂》角色+1500。'),
  red('16', ['（バンド名未定） ルパ', '（樂團名未定） RUPA'], 0, 0, 1500, 1, [], [
    {
      kind: 'continuous', effects: [power(others(music), 500, 'whileActive')],
      text: t('【永】他のあなたの《音楽》のキャラすべてに、パワーを＋500。', '【永】其他的你的《音樂》的角色全部，攻擊力+500。'),
    },
    {
      kind: 'auto', trigger: { event: 'climaxPlaced', side: 'self' },
      effects: [{ op: 'grantAbility', target: mine(), duration: 'thisTurn', ability: lookKeep2 }],
      text: t('【自】あなたのCXがCX置場に置かれた時、あなたは自分のキャラを1枚選び、そのターン中、次の能力を与える。『【自】このカードがアタックした時、あなたは自分の山札を上から2枚まで見て、カードを1枚選び、山札の上に置き、残りのカードを控え室に置く。』',
        '【自】當你的名場面被放置到名場面區時，你選擇自己的角色1張，在那個回合中，給予以下能力。『【自】此卡攻擊時，你從自己的牌組上方看最多2張，選擇卡片1張，放回牌組上方，剩下的卡片放到休息室。』'),
    },
  ], '其他《音樂》角色+500。打出名場面時，選1張角色：它攻擊時看牌組上方2張留1張（把名場面留在上面，讓對手難取消傷害，或過濾判定）。'),
  red('17', ['“不登校”仁菜', '"拒絕上學" 仁菜'], 0, 0, 2000, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'countAtMost', selector: others(), n: 1 },
      effects: [{ op: 'modifyLevel', target: self, amount: 1, duration: 'whileActive' }, power(self, 2500, 'whileActive')],
      text: t('【永】他のあなたのキャラが1枚以下なら、このカードのレベルを＋1し、パワーを＋2500。', '【永】其他的你的角色在1張以下的話，此卡的等級+1，攻擊力+2500。'),
    },
  ], '場上其他角色在1張以下時，她是Lv1、4500（等級變高，被側打時對手魂傷減少更多）。'),
  red('18', ['棘ナシの休日 ルパ', '無刺的假日 RUPA'], 0, 0, 2000, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true, effects: [move(deckTop(3), toWR)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札の上から3枚を、控え室に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以將自己的牌組上方3張，放到休息室。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1), discardHand({ type: 'climax' })],
      effects: [move(wr({ type: 'climax' }), toHand)],
      text: t('【自】［① 手札のCXを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のCXを1枚選び、手札に戻す。',
        '【自】［① 手牌的名場面1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的名場面1張，回到手牌。'),
    },
  ], '登場可以把牌組上方3張丟進休息室（讓想撿的牌進休息室，或加快重洗）。還能付1能量丟1張名場面，換回休息室的名場面。'),
  red('19', ['だから、歌う。 すばる', '所以，我要唱。 昂'], 1, 0, 2500, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true, condition: othersMusicAtLeast(4), cost: [discardHand()],
      effects: [{
        op: 'chooseOne', options: [
          { label: '選對手1張角色，直立並移到對手舞台的其他空格', effects: [{ op: 'stand', target: { ...opp(), as: 'moved' } }, { op: 'moveToOtherEmptySlot', target: { ...opp(), fromBind: 'moved' } }] },
          { label: '選對手2張角色，都直立並交換位置', effects: [{ op: 'swapPositions', target: { zone: 'stage', side: 'opponent', count: { exactly: 2 } } }] },
        ],
      }],
      text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、他のあなたの《音楽》のキャラが4枚以上なら、あなたはコストを払ってよい。そうしたら、あなたは相手のキャラを1枚選び、【スタンド】して相手の舞台のキャラのいない他の枠に動かすか、他の相手のキャラを1枚選び、それぞれを【スタンド】して入れ替える。',
        '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時，其他的你的《音樂》的角色存在4張以上的話，你可以支付代價。支付代價的話，你選擇對手的角色1張，【直立】並移動到對手的舞台的沒有角色的其他格子，或選擇其他的對手的角色1張，將各自【直立】並交換位置。'),
    },
    {
      kind: 'auto', trigger: { event: 'reversedInBattle' }, optional: true, condition: { kind: 'battleOpponentLevelAtMost', n: 1 },
      effects: [{ op: 'reverse', target: battleOpp }],
      text: t('【自】このカードが【リバース】した時、このカードのバトル相手のレベルが1以下なら、あなたはそのキャラを【リバース】してよい。', '【自】此卡【倒置】時，此卡的戰鬥對手的等級在1以下的話，你可以將那張角色【倒置】。'),
    },
  ], '場上5格放滿時登場，丟1張手牌就能移動對手的角色（例如把後列的輔助角色換到前列，或讓前列空出來直接攻擊）。被Lv1以下的角色打倒時可以同歸於盡。'),
  red('20', [N.rupaToge, 'TOGENASHI TOGEARI RUPA'], 1, 0, 2500, 1, [], [
    {
      kind: 'auto', keyword: { id: 'bond', targetName: N.tomoToge }, trigger: placed, optional: true, cost: [stock(1)],
      effects: [move(wr({ name: N.tomoToge }), toHand)],
      text: t('【自】絆／「トゲナシトゲアリ 智」［①］（このカードがプレイされて舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「トゲナシトゲアリ 智」を1枚選び、手札に戻す）',
        '【自】絆／「TOGENASHI TOGEARI 智」［①］(此卡被使用被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「TOGENASHI TOGEARI 智」1張，回到手牌)'),
    },
    {
      kind: 'auto', trigger: { event: 'myClimaxPhaseStart' }, optional: true,
      cost: [{ kind: 'reveal', selector: hand({ name: N.tomoToge }) }],
      effects: [
        power(self, 3500),
        {
          op: 'grantAbility', target: self, duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: attacks, effects: [{ op: 'extraTriggerCheck', thenStockTopToWaiting: true }],
            text: t('【自】このカードがアタックした時、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。2回行ったら、あなたは自分のストックの上から1枚を、控え室に置く。',
              '【自】此卡攻擊時，在那次攻擊中，你在判定階段執行2次判定。執行了2次的話，你將自己的能量區上方1張，放到休息室。'),
          },
        },
      ],
      text: t('【自】共鳴［手札の「トゲナシトゲアリ 智」を1枚公開する］あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、そのターン中、このカードのパワーを＋3500し、このカードは次の能力を得る。『【自】このカードがアタックした時、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。2回行ったら、あなたは自分のストックの上から1枚を、控え室に置く。』',
        '【自】共鳴［公開手牌的「TOGENASHI TOGEARI 智」1張］在你的名場面階段開始時，你可以支付代價。支付代價的話，在那個回合中，此卡的攻擊力+3500，此卡獲得以下能力。『【自】此卡攻擊時，在那次攻擊中，你在判定階段執行2次判定。執行了2次的話，你將自己的能量區上方1張，放到休息室。』'),
    },
  ], '絆：登場付1能量撿回「TOGENASHI TOGEARI 智」。共鳴：手牌有智就公開（給對手看，留在手牌），這回合變成6000，攻擊時判定2次（之後能量區上方1張丟掉）。'),
  red('21', ['全てさらけ出す ルパ', '全部攤開 RUPA'], 1, 0, 2500, 1, [], [
    {
      kind: 'activated', keyword: { id: 'backup', power: 0, level: 1 }, timing: 'counter', cost: [{ kind: 'discardSource' }],
      effects: [power(inBattle, { per: stage(music), multiplier: 500, evaluate: 'atResolution' })],
      text: t('【起】【カウンター】助太刀Ｘ レベル1［手札のこのカードを控え室に置く］Ｘはあなたの《音楽》のキャラの枚数×500に等しい。（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋Ｘ）',
        '【起】【反擊】助太刀X 等級1［手牌的此卡放到休息室］X等於你的《音樂》的角色張數×500。(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+X)'),
    },
  ], '免費的助太刀：被正打的角色+（場上《音樂》角色數×500），5格都是《音樂》就是+2500。'),
  red('22', ['ドリームガール？ すばる', '夢幻女孩？ 昂'], 1, 0, 3000, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'myTurn' }, effects: [power(others(music), 1000, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《音楽》のキャラすべてに、パワーを＋1000。', '【永】在你的回合中，其他的你的《音樂》的角色全部，攻擊力+1000。'),
    },
    {
      kind: 'activated', cost: [stock(1), { kind: 'sendSourceToWaitingRoom' }],
      effects: [
        move(deckTop(2), toWR, 'milled'),
        { op: 'setX', amount: { levelSumOfBound: 'milled' } },
        move(wr({ type: 'character', levelAtMostX: true }), toHand),
      ],
      text: t('【起】［① このカードを控え室に置く］あなたは自分の山札の上から2枚を、控え室に置き、自分の控え室のレベルＸ以下のキャラを1枚選び、手札に戻す。Ｘはそれらのカードのレベルの合計に等しい。（CXのレベルは0として扱う）',
        '【起】［① 將此卡放到休息室］你將自己的牌組上方2張放到休息室，選擇自己休息室的等級X以下的角色1張，回到手牌。X等於那些卡片的等級合計。(名場面視為等級0)'),
    },
  ], '自己回合其他《音樂》角色+1000。【起】：付1能量把自己送進休息室，牌組上方2張丟掉，撿回等級不超過那2張等級合計的角色（可以撿她自己）。'),
  red('23', ['全てさらけ出す 仁菜', '全部攤開 仁菜'], 1, 0, 3500, 1, [], [
    {
      kind: 'auto', trigger: attacks, effects: [power(mineUpTo(2, music), 1500)],
      text: t('【自】このカードがアタックした時、あなたは自分の《音楽》のキャラを2枚まで選び、そのターン中、パワーを＋1500。', '【自】此卡攻擊時，你選擇自己的《音樂》的角色最多2張，在那個回合中，攻擊力+1500。'),
    },
  ], '攻擊時最多2張《音樂》角色+1500（可以選自己），先攻擊的話可以幫後面的隊友加攻。'),
  red('24', [N.tomoToge, 'TOGENASHI TOGEARI 智'], 1, 0, 3500, 1, [], [
    {
      kind: 'auto', keyword: { id: 'bond', targetName: N.rupaToge }, trigger: placed, optional: true, cost: [discardHand()],
      effects: [move(wr({ name: N.rupaToge }), toHand)],
      text: t('【自】絆／「トゲナシトゲアリ ルパ」［手札を1枚控え室に置く］（このカードがプレイされて舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「トゲナシトゲアリ ルパ」を1枚選び、手札に戻す）',
        '【自】絆／「TOGENASHI TOGEARI RUPA」［手牌1張放到休息室］(此卡被使用被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「TOGENASHI TOGEARI RUPA」1張，回到手牌)'),
    },
    {
      kind: 'auto', trigger: { event: 'myClimaxPhaseStart' }, optional: true,
      cost: [{ kind: 'reveal', selector: hand({ name: N.rupaToge }) }],
      effects: [power(self, 3000), { op: 'grantAbility', target: self, duration: 'thisTurn', ability: lookKeep2 }],
      text: t('【自】共鳴［手札の「トゲナシトゲアリ ルパ」を1枚公開する］あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、そのターン中、このカードのパワーを＋3000し、このカードは次の能力を得る。『【自】このカードがアタックした時、あなたは自分の山札を上から2枚まで見て、カードを1枚選び、山札の上に置き、残りのカードを控え室に置く。』',
        '【自】共鳴［公開手牌的「TOGENASHI TOGEARI RUPA」1張］在你的名場面階段開始時，你可以支付代價。支付代價的話，在那個回合中，此卡的攻擊力+3000，此卡獲得以下能力。『【自】此卡攻擊時，你從自己的牌組上方看最多2張，選擇卡片1張，放回牌組上方，剩下的卡片放到休息室。』'),
    },
  ], '絆：登場丟1張撿回「TOGENASHI TOGEARI RUPA」。共鳴：手牌有RUPA就公開，這回合變成6500，攻擊時看2張留1張。'),
  red('25', ['自由なやり方で 桃香', '用自由的方式 桃香'], 1, 0, 4000, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'all', of: [{ kind: 'myTurn' }, allMusic] }, effects: [power(self, 2000, 'whileActive')],
      text: t('【永】あなたのターン中、あなたのキャラすべてが《音楽》なら、このカードのパワーを＋2000。', '【永】在你的回合中，你的角色全部是《音樂》的話，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxKara }, trigger: attacks, optional: true,
      condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: N.cxKara }, othersMusicAtLeast(1)] }, cost: [discardHand()],
      effects: [move(wrUpTo(2, music), toHand)],
      text: t('【自】【CXコンボ】［手札を1枚控え室に置く］このカードがアタックした時、CX置場に「空の箱」があり、他のあなたの《音楽》のキャラがいるなら、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《音楽》のキャラを2枚まで選び、手札に戻す。',
        '【自】【CX連動】［手牌1張放到休息室］此卡攻擊時，名場面區有「空的箱子」，有其他的你的《音樂》的角色存在的話，你可以支付代價。支付代價的話，你選擇自己休息室的《音樂》的角色最多2張，回到手牌。'),
    },
  ], '自己回合全隊都是《音樂》時是6000。連動名場面「空的箱子」：攻擊時丟1張，撿回2張《音樂》角色（手牌+1）。'),
  red('26', ['だから、歌う。 智', '所以，我要唱。 智'], 1, 0, 4000, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'all', of: [{ kind: 'myTurn' }, allMusic] }, effects: [power(self, 2000, 'whileActive')],
      text: t('【永】あなたのターン中、あなたのキャラすべてが《音楽》なら、このカードのパワーを＋2000。', '【永】在你的回合中，你的角色全部是《音樂》的話，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', trigger: leaves, optional: true, cost: [discardHand()],
      effects: [{ op: 'lookTopPick', look: 4, pick: { filter: { levelAtLeast: 1 }, upTo: 1 }, rest: 'waitingRoom' }],
      text: t('【自】［手札を1枚控え室に置く］このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から4枚まで見て、レベル1以上のカードを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。（CXのレベルは0として扱う）',
        '【自】［手牌1張放到休息室］此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多4張，選擇等級1以上的卡片最多1張給對手確認，加到手牌，剩下的卡片放到休息室。(名場面視為等級0)'),
      review: ['「4枚まで見て」：目前固定看 4 張。'],
    },
  ], '自己回合全隊都是《音樂》時是6000。進休息室時丟1張，看4張拿1張Lv1以上的卡。'),
  red('27', ['だから、歌う。 ルパ', '所以，我要唱。 RUPA'], 1, 0, 4000, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'all', of: [{ kind: 'myTurn' }, othersMusicAtLeast(1)] }, effects: [power(self, 1500, 'whileActive')],
      text: t('【永】あなたのターン中、他のあなたの《音楽》のキャラがいるなら、このカードのパワーを＋1500。', '【永】在你的回合中，有其他的你的《音樂》的角色存在的話，此卡的攻擊力+1500。'),
    },
    {
      kind: 'auto', trigger: attacks, condition: { kind: 'opponentInFrontLevel', level: 2 }, effects: [power(self, 6000)],
      text: t('【自】このカードがアタックした時、このカードの正面のキャラのレベルが2なら、そのターン中、このカードのパワーを＋6000。', '【自】此卡攻擊時，此卡的正面的角色的等級是2的話，在那個回合中，此卡的攻擊力+6000。'),
    },
  ], '自己回合是5500。攻擊時正面是Lv2角色就再+6000（11500），專門打倒Lv2。'),
  red('28', ['“目標!!武道館!!”智', '"目標!!武道館!!" 智'], 1, 1, 2500, 1, ['soul'], [
    {
      kind: 'continuous', keyword: { id: 'assist' },
      effects: [power({ zone: 'stage', side: 'self', filter: { trait: MUSIC }, count: 'all', relation: 'frontOfSource' }, { perLevelOfTarget: true, multiplier: 500 }, 'whileActive')],
      text: t('【永】応援 このカードの前のあなたの《音楽》のキャラすべてに、パワーを＋Ｘ。Ｘはそのキャラのレベル×500に等しい。', '【永】應援 此卡前面的你的《音樂》的角色全部，攻擊力+X。X等於那張角色的等級×500。'),
    },
    {
      kind: 'auto', trigger: comebackChecked, optional: true, cost: [discardHand()],
      effects: [move(opp(), toOwnerHand)],
      text: t('【自】［手札を1枚控え室に置く］あなたのトリガーアイコンが【カムバック】のCXがトリガーした時、あなたはコストを払ってよい。そうしたら、あなたは相手のキャラを1枚選び、手札に戻す。',
        '【自】［手牌1張放到休息室］當你判定出判定標誌是木門的名場面時，你可以支付代價。支付代價的話，你選擇對手的角色1張，回到手牌。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'restSource' }], effects: [power(mine(), 2000)],
      text: t('【起】［このカードを【レスト】する］あなたは自分のキャラを1枚選び、そのターン中、パワーを＋2000。', '【起】［將此卡【橫置】］你選擇自己的角色1張，在那個回合中，攻擊力+2000。'),
    },
  ], '放後列：斜前方的《音樂》角色加「等級×500」。判定翻到木門名場面時，丟1張手牌就能把對手1張角色彈回手牌。【起】：橫置讓1張角色+2000。'),
  red('29', ['beni-shouga 智', 'beni-shouga 智'], 1, 1, 2500, 1, ['soul'], [
    {
      kind: 'auto', trigger: placed, effects: [power(opp({ row: 'front' }), -1000)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手の前列のキャラを1枚選び、そのターン中、パワーを－1000。', '【自】此卡從手牌被放置到舞台時，你選擇對手的前列的角色1張，在那個回合中，攻擊力-1000。'),
    },
    {
      kind: 'auto', trigger: { event: 'reversedInBattle' }, optional: true, condition: { kind: 'battleOpponentAboveItsLevel' },
      effects: [move(battleOpp, toOwnerDeckBottom)],
      text: t('【自】このカードが【リバース】した時、このカードのバトル相手のレベルが相手のレベルより高いなら、あなたはそのキャラを山札の下に置いてよい。', '【自】此卡【倒置】時，此卡的戰鬥對手的等級比對手的等級高的話，你可以將那張角色放到牌組下方。'),
    },
  ], '登場時對手前列1張-1000。被「等級比對手玩家等級高」的角色（例如提早登場的Lv3）打倒時，可以把它放到對手牌組最下面。'),
  red('30', ['新川崎（仮） 仁菜', '新川崎（暫定） 仁菜'], 1, 1, 4000, 1, ['soul'], [
    {
      kind: 'continuous', condition: { kind: 'all', of: [{ kind: 'myTurn' }, othersMusicAtLeast(2)] },
      effects: [
        power(self, 3500, 'whileActive'),
        {
          op: 'grantAbility', target: self, duration: 'whileActive',
          ability: {
            kind: 'auto', trigger: attacks, condition: { kind: 'opponentInFrontCostAtLeast', n: 2 }, effects: [power(self, 4000)],
            text: t('【自】このカードがアタックした時、このカードの正面のキャラのコストが2以上なら、そのターン中、このカードのパワーを＋4000。', '【自】此卡攻擊時，此卡的正面的角色的費用在2以上的話，在那個回合中，此卡的攻擊力+4000。'),
          },
        },
        {
          op: 'grantAbility', target: self, duration: 'whileActive',
          ability: {
            kind: 'auto', trigger: { event: 'battleOpponentReversed' }, optional: true, effects: [move(wr(music), toStock)],
            text: t('【自】このカードのバトル相手が【リバース】した時、あなたは自分の控え室の《音楽》のキャラを1枚選び、ストック置場に置いてよい。', '【自】此卡的戰鬥對手【倒置】時，你可以選擇自己休息室的《音樂》的角色1張，放到能量區。'),
          },
        },
      ],
      text: t('【永】あなたのターン中、他のあなたの《音楽》のキャラが2枚以上なら、このカードのパワーを＋3500し、このカードは次の2つの能力を得る。『【自】このカードがアタックした時、このカードの正面のキャラのコストが2以上なら、そのターン中、このカードのパワーを＋4000。』『【自】このカードのバトル相手が【リバース】した時、あなたは自分の控え室の《音楽》のキャラを1枚選び、ストック置場に置いてよい。』',
        '【永】在你的回合中，其他的你的《音樂》的角色存在2張以上的話，此卡的攻擊力+3500，此卡獲得以下2個能力。『【自】此卡攻擊時，此卡的正面的角色的費用在2以上的話，在那個回合中，此卡的攻擊力+4000。』『【自】此卡的戰鬥對手【倒置】時，你可以選擇自己休息室的《音樂》的角色1張，放到能量區。』'),
    },
  ], '自己回合有2張以上其他《音樂》角色時是7500；正面是費用2以上的角色（通常是Lv3）再+4000。打倒對手時可以從休息室補1能量。'),
  red('31', ['“脱退”桃香', '"退團" 桃香'], 1, 1, 5500, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'allMine', filter: { trait: TOGE } },
      effects: [
        {
          op: 'grantAbility', target: self, duration: 'whileActive',
          ability: { kind: 'continuous', condition: { kind: 'myTurn' }, effects: [power(self, 3000, 'whileActive')], text: t('【永】あなたのターン中、このカードのパワーを＋3000。', '【永】在你的回合中，此卡的攻擊力+3000。') },
        },
        { op: 'grantAbility', target: self, duration: 'whileActive', ability: encore(chara) },
      ],
      text: t('【永】あなたのキャラすべてが《トゲナシトゲアリ》なら、このカードは次の2つの能力を得る。『【永】あなたのターン中、このカードのパワーを＋3000。』『【自】アンコール［手札のキャラを1枚控え室に置く］』',
        '【永】你的角色全部是《TOGENASHI TOGEARI》的話，此卡獲得以下2個能力。『【永】在你的回合中，此卡的攻擊力+3000。』『【自】安可［手牌的角色1張放到休息室］』'),
    },
    {
      kind: 'auto', trigger: { event: 'climaxPlaced', side: 'self', filter: { type: 'climax', hasTrigger: 'comeback' } },
      effects: [power(self, 1000), { op: 'grantAbility', target: self, duration: 'thisTurn', ability: doubleCheck(DOUBLE_CHECK_JA, DOUBLE_CHECK_ZH) }],
      text: t('【自】あなたのトリガーアイコンが【カムバック】のCXがCX置場に置かれた時、そのターン中、このカードのパワーを＋1000し、このカードは次の能力を得る。『【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。』',
        '【自】當判定標誌是木門的你的名場面被放置到名場面區時，在那個回合中，此卡的攻擊力+1000，此卡獲得以下能力。『【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行2次判定。』'),
    },
  ], '全隊都是《TOGENASHI TOGEARI》時：自己回合8500，還能丟1張手牌角色安可。打出木門名場面的回合+1000，攻擊時付1能量判定2次。'),
  red('32', ['本気で好きなこと すばる', '真心喜歡的事 昂'], 2, 0, 7500, 1, [], [
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxGokushi }, trigger: { event: 'climaxPlaced', side: 'self', filter: { name: N.cxGokushi } },
      condition: { kind: 'all', of: [{ kind: 'handAtMost', n: 5 }, allMusic] },
      effects: [
        {
          op: 'grantAbility', target: self, duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: { event: 'dealtDamageCancelled' }, perTurn: 1,
            effects: [move({ zone: 'stage', side: 'opponent', filter: { row: 'back', levelAtMost: 2 }, count: { upTo: 1 } }, toOwnerWR)],
            text: t('【自】この能力は1ターンにつき1回まで発動する。このカードの与えたダメージがキャンセルされた時、あなたは相手の後列のレベル2以下のキャラを1枚選び、控え室に置いてよい。',
              '【自】此能力每回合最多發動1次。此卡給予的傷害被取消時，你可以選擇對手的後列的等級2以下的角色1張，放到休息室。'),
          },
        },
        {
          op: 'grantAbility', target: self, duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: { event: 'dealtDamageNotCancelled' }, perTurn: 1,
            effects: [{ op: 'searchDeck', filter: { anyOf: [music, { name: N.event46 }] }, upTo: 1, reveal: true, shuffle: true }, power(self, 3000)],
            text: t('【自】この能力は1ターンにつき1回まで発動する。このカードの与えたダメージがキャンセルされなかった時、あなたは自分の山札を見て《音楽》のキャラか「怒りも喜びも哀しさも全部ぶちこめ。」を1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルし、そのターン中、このカードのパワーを＋3000。',
              '【自】此能力每回合最多發動1次。此卡給予的傷害沒有被取消時，你從自己的牌組選擇《音樂》的角色或「把憤怒、喜悅、悲傷全部灌進去。」最多1張給對手確認，加到手牌，將那個牌組洗牌，在那個回合中，此卡的攻擊力+3000。'),
          },
        },
      ],
      text: t('【自】【CXコンボ】あなたのCX置場に「極私的極彩色アンサー」が置かれた時、あなたの手札が5枚以下で、あなたのキャラすべてが《音楽》なら、そのターン中、このカードは次の2つの能力を得る。『【自】この能力は1ターンにつき1回まで発動する。このカードの与えたダメージがキャンセルされた時、あなたは相手の後列のレベル2以下のキャラを1枚選び、控え室に置いてよい。』『【自】この能力は1ターンにつき1回まで発動する。このカードの与えたダメージがキャンセルされなかった時、あなたは自分の山札を見て《音楽》のキャラか「怒りも喜びも哀しさも全部ぶちこめ。」を1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルし、そのターン中、このカードのパワーを＋3000。』',
        '【自】【CX連動】當「極私的極彩色解答」被放置到你的名場面區時，你的手牌在5張以下，你的角色全部是《音樂》的話，在那個回合中，此卡獲得以下2個能力。『【自】此能力每回合最多發動1次。此卡給予的傷害被取消時，你可以選擇對手的後列的等級2以下的角色1張，放到休息室。』『【自】此能力每回合最多發動1次。此卡給予的傷害沒有被取消時，你從自己的牌組選擇《音樂》的角色或「把憤怒、喜悅、悲傷全部灌進去。」最多1張給對手確認，加到手牌，將那個牌組洗牌，在那個回合中，此卡的攻擊力+3000。』'),
    },
  ], 'Lv2、費用0就有7500。連動名場面「極私的極彩色解答」：傷害被取消→把對手後列Lv2以下的角色丟掉；傷害沒被取消→從牌組找1張《音樂》角色或事件，這回合+3000。'),
  red('33', ['全てさらけ出す 桃香', '全部攤開 桃香'], 2, 1, 2500, 1, ['soul'], [
    {
      kind: 'auto', trigger: { event: 'usedBackup' },
      effects: [{
        op: 'grantAbility', target: inBattle, duration: 'thisTurn',
        ability: {
          kind: 'auto', trigger: { event: 'battleOpponentReversed' }, effects: [{ op: 'sendToMemory', from: battleOpp }],
          text: t('【自】このカードのバトル相手が【リバース】した時、あなたはそのキャラを思い出にする。', '【自】此卡的戰鬥對手【倒置】時，你將那張角色放到回憶區。'),
        },
      }],
      text: t('【自】あなたがこのカードの『助太刀』を使った時、あなたは自分のバトル中のキャラを1枚選び、そのターン中、次の能力を与える。『【自】このカードのバトル相手が【リバース】した時、あなたはそのキャラを思い出にする。』',
        '【自】當你使用此卡的『助太刀』時，你選擇自己戰鬥中的角色1張，在那個回合中，給予以下能力。『【自】此卡的戰鬥對手【倒置】時，你將那張角色放到回憶區。』'),
    },
    backup(3000, 2, 1, '【起】【カウンター】助太刀3000 レベル2［① 手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋3000）',
      '【起】【反擊】助太刀3000 等級2［① 手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+3000)'),
  ], '助太刀+3000。用了之後，如果反過來打倒對手的攻擊角色，就把它放進回憶區（對手不能安可、也回不來）。'),
  red('34', ['新川崎（仮） すばる', '新川崎（暫定） 昂'], 2, 1, 3000, 1, ['soul'], [
    {
      kind: 'auto', trigger: { event: 'usedBackup' }, optional: true, cost: [stock(1), discardHand()],
      effects: [move(opp({ levelAboveOwnerLevel: true }), toOwnerHand)],
      text: t('【自】［① 手札を1枚控え室に置く］あなたがこのカードの『助太刀』を使った時、あなたはコストを払ってよい。そうしたら、あなたは相手の、レベルが相手のレベルより高いキャラを1枚選び、手札に戻す。',
        '【自】［① 手牌1張放到休息室］當你使用此卡的『助太刀』時，你可以支付代價。支付代價的話，你選擇對手的等級比對手的等級高的角色1張，回到手牌。'),
    },
    backup(2500, 2, 1, '【起】【カウンター】助太刀2500 レベル2［① 手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋2500）',
      '【起】【反擊】助太刀2500 等級2［① 手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+2500)'),
  ], '助太刀+2500。再付1能量丟1張，可以把對手「等級比對手玩家等級高」的角色彈回手牌。'),
  red('35', ['棘ナシの休日 桃香', '無刺的假日 桃香'], 2, 1, 4500, 1, ['soul'], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand()],
      effects: [{ op: 'swapWithWaiting', target: opp({ levelAtLeast: 1 }) }],
      text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは相手のレベル1以上のキャラを1枚選び、相手は自分の控え室のレベルＸ以下のキャラを1枚選び、入れ替える。Ｘはあなたが選んだキャラのレベル－1に等しい。',
        '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇對手的等級1以上的角色1張，對手選擇自己休息室的等級X以下的角色1張，交換。X等於你選擇的角色的等級-1。'),
      review: ['對手休息室沒有等級 X 以下的角色時，不會交換。'],
    },
    {
      kind: 'auto', trigger: { event: 'reversedInBattle' }, optional: true, condition: { kind: 'battleOpponentLevelAtMost', n: 2 },
      effects: [{ op: 'reverse', target: battleOpp }],
      text: t('【自】このカードが【リバース】した時、このカードのバトル相手のレベルが2以下なら、あなたはそのキャラを【リバース】してよい。', '【自】此卡【倒置】時，此卡的戰鬥對手的等級在2以下的話，你可以將那張角色【倒置】。'),
    },
  ], '登場丟1張：把對手1張Lv1以上的角色換成它休息室裡低1級的角色（變弱）。被Lv2以下的角色打倒時可以同歸於盡。'),
  red('36', ['だから、歌う。 仁菜', '所以，我要唱。 仁菜'], 2, 1, 6500, 1, ['soul'], [
    {
      kind: 'auto', trigger: placed,
      effects: [{
        op: 'grantAbility', target: mineUpTo(2), duration: 'thisTurn',
        ability: {
          kind: 'auto', trigger: { event: 'reversedInBattle' }, optional: true, condition: { kind: 'battleOpponentAboveItsLevel' },
          effects: [{ op: 'reverse', target: battleOpp }],
          text: t('【自】このカードが【リバース】した時、このカードのバトル相手のレベルが相手のレベルより高いなら、あなたはそのキャラを【リバース】してよい。', '【自】此卡【倒置】時，此卡的戰鬥對手的等級比對手的等級高的話，你可以將那張角色【倒置】。'),
        },
      }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のキャラを2枚まで選び、そのターン中、次の能力を与える。『【自】このカードが【リバース】した時、このカードのバトル相手のレベルが相手のレベルより高いなら、あなたはそのキャラを【リバース】してよい。』',
        '【自】此卡從手牌被放置到舞台時，你選擇自己的角色最多2張，在那個回合中，給予以下能力。『【自】此卡【倒置】時，此卡的戰鬥對手的等級比對手的等級高的話，你可以將那張角色【倒置】。』'),
      review: ['給予的能力只到「那個回合」結束，通常是在自己回合攻擊被打倒時才有用。'],
    },
  ], '登場時選最多2張角色：這回合它們攻擊被「等級比對手玩家等級高」的角色打倒時，可以同歸於盡。'),
  red('37', ['棘ナシの休日 智', '無刺的假日 智'], 2, 1, 7000, 1, [], [
    {
      kind: 'auto', trigger: attacks, condition: othersMusicAtLeast(2), effects: [power(self, 6000)],
      text: t('【自】このカードがアタックした時、他のあなたの《音楽》のキャラが2枚以上なら、そのターン中、このカードのパワーを＋6000。', '【自】此卡攻擊時，其他的你的《音樂》的角色存在2張以上的話，在那個回合中，此卡的攻擊力+6000。'),
    },
    {
      kind: 'auto', trigger: { event: 'battleOpponentReversed' }, condition: { kind: 'myTurn' },
      effects: [{
        op: 'grantAbility', target: mine(music), duration: 'untilNextOpponentTurnEnd',
        ability: {
          kind: 'auto', trigger: { event: 'frontAttacked' }, optional: true, effects: [{ op: 'returnSourceToHand' }],
          text: t('【自】このカードがフロントアタックされた時、あなたはこのカードを手札に戻してよい。', '【自】此卡被正打時，你可以將此卡回到手牌。'),
        },
      }],
      text: t('【自】あなたのターン中、このカードのバトル相手が【リバース】した時、あなたは自分の《音楽》のキャラを1枚選び、次の相手のターンの終わりまで、次の能力を与える。『【自】このカードがフロントアタックされた時、あなたはこのカードを手札に戻してよい。』',
        '【自】在你的回合中，此卡的戰鬥對手【倒置】時，你選擇自己的《音樂》的角色1張，到下次的對手回合結束前，給予以下能力。『【自】此卡被正打時，你可以將此卡回到手牌。』'),
    },
  ], '攻擊時有2張以上其他《音樂》角色就是13000。打倒對手後，選1張《音樂》角色：對手回合它被正打時可以收回手牌（不會被打倒）。'),
  red('38', ['棘ナシの休日 仁菜', '無刺的假日 仁菜'], 2, 1, 8000, 1, [], [
    handLevelDown({ kind: 'countAtLeast', selector: stage({ trait: TOGE }), n: 4 },
      '【永】あなたの《トゲナシトゲアリ》のキャラが4枚以上なら、あなたの手札のこのカードのレベルを－1。', '【永】你的《TOGENASHI TOGEARI》的角色存在4張以上的話，你的手牌的此卡的等級-1。'),
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxDaremo }, trigger: { event: 'encoreStepStart', side: 'self' }, optional: true,
      condition: { kind: 'all', of: [{ kind: 'sourceInSlot', slots: [0, 1, 2] }, { kind: 'allMine', filter: { trait: TOGE } }] },
      cost: [{ kind: 'discard', selector: { zone: 'climaxZone', side: 'self', filter: { name: N.cxDaremo }, count: { exactly: 1 } } }],
      effects: [{ op: 'pickHandRestStock', from: wrUpTo(3, toge) }],
      text: t('【自】【CXコンボ】［あなたのCX置場の「誰にもなれない私だから」を1枚控え室に置く］あなたのアンコールステップの始めに、前列にこのカードがいて、あなたのキャラすべてが《トゲナシトゲアリ》なら、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《トゲナシトゲアリ》のキャラを3枚まで選び、1枚手札に戻し、残りのカードをストック置場に好きな順番で置く。',
        '【自】【CX連動】［將你的名場面區的「因為我是誰也成為不了的我」1張放到休息室］在你的安可步驟開始時，此卡在前列，你的角色全部是《TOGENASHI TOGEARI》的話，你可以支付代價。支付代價的話，你選擇自己休息室的《TOGENASHI TOGEARI》的角色最多3張，1張回到手牌，剩下的卡片以喜歡的順序放到能量區。'),
    },
  ], '場上有4張以上《TOGENASHI TOGEARI》角色時，手牌的她算Lv1（可以提早出）。連動名場面「因為我是誰也成為不了的我」：安可步驟開始時把名場面丟掉，撿回3張角色：1張進手牌、2張進能量區。'),
  red('39', ['“目標!!武道館!!”ルパ', '"目標!!武道館!!" RUPA'], 2, 1, 8500, 1, [], [
    {
      kind: 'auto', trigger: { event: 'allyAttacks', filter: music },
      effects: [power(self, { per: others(music), multiplier: 500, evaluate: 'atResolution' })],
      text: t('【自】他のあなたの《音楽》のキャラがアタックした時、そのターン中、このカードのパワーを＋Ｘ。Ｘは他のあなたの《音楽》のキャラの枚数×500に等しい。', '【自】其他的你的《音樂》的角色攻擊時，在那個回合中，此卡的攻擊力+X。X等於其他的你的《音樂》的角色張數×500。'),
    },
    {
      kind: 'auto', trigger: { event: 'battleOpponentReversed' }, optional: true, condition: { kind: 'myTurn' }, cost: [stock(1)],
      effects: [{ op: 'noStandNext', target: opp({ levelAtMost: 3 }) }],
      text: t('【自】［①］あなたのターン中、このカードのバトル相手が【リバース】した時、あなたはコストを払ってよい。そうしたら、あなたは相手のレベル3以下のキャラを1枚選ぶ。そのキャラは次の相手のスタンドフェイズに【スタンド】しない。',
        '【自】［①］在你的回合中，此卡的戰鬥對手【倒置】時，你可以支付代價。支付代價的話，你選擇對手的等級3以下的角色1張。那張角色在下次的對手的起立階段不【直立】。'),
    },
  ], '其他《音樂》角色每攻擊1次，她就+（其他《音樂》角色數×500）。打倒對手後付1能量，讓對手1張角色下回合不能直立（不能攻擊）。'),
  red('40', [N.rupaHitori, '不是一個人的舞台 RUPA'], 3, 2, 7500, 2, ['soul'], [
    handLevelDown({ kind: 'countAtLeast', selector: stage(music), n: 4 },
      '【永】あなたの《音楽》のキャラが4枚以上なら、あなたの手札のこのカードのレベルを－1。', '【永】你的《音樂》的角色存在4張以上的話，你的手牌的此卡的等級-1。'),
    {
      kind: 'auto', trigger: placed, effects: [move({ ...clockTop, count: { upTo: 1 } }, toWR), power(self, 3000)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚までを、控え室に置き、そのターン中、このカードのパワーを＋3000。', '【自】此卡從手牌被放置到舞台時，你將自己的傷害區上方最多1張，放到休息室，在那個回合中，此卡的攻擊力+3000。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [{ kind: 'discard', selector: mine(music) }],
      effects: [{ op: 'revealTopLevelRecover', filter: music }],
      text: t('【自】［他のあなたの舞台の《音楽》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札の上から1枚を公開し、自分の控え室のレベルＸ以下の《音楽》のキャラを1枚選び、手札に戻す。Ｘは公開されたカードのレベルに等しい。（CXのレベルは0として扱う。公開したカードは元に戻す）',
        '【自】［將其他的你的舞台的《音樂》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你將自己的牌組上方1張公開，選擇自己休息室的等級X以下的《音樂》的角色1張，回到手牌。X等於公開的卡片的等級。(名場面視為等級0。公開的卡片放回原位)'),
    },
  ], '場上有4張以上《音樂》角色時，手牌的她算Lv2（可以提早出）。登場回1血、這回合10500。還能把場上另1張《音樂》角色送進休息室，翻牌撿回角色。'),
  red('41', ['ちょこれーと？ 仁菜', '巧克力？ 仁菜'], 3, 2, 10000, 2, ['soul'], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1)],
      effects: [
        {
          op: 'grantAbility', target: self, duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: { event: 'dealtDamageCancelled' }, perTurn: 1,
            effects: [{ op: 'lookTopHandAndStock', look: 0, search: true, max: 3, filter: music }],
            text: t('【自】この能力は1ターンにつき1回まで発動する。このカードの与えたダメージがキャンセルされた時、あなたは自分の山札を見て《音楽》のキャラを3枚まで選び、公開し、1枚選び、手札に加え、1枚選び、ストック置場に置き、残りのカードを控え室に置き、その山札をシャッフルする。',
              '【自】此能力每回合最多發動1次。此卡給予的傷害被取消時，你從自己的牌組選擇《音樂》的角色最多3張，公開，選擇1張，加到手牌，選擇1張，放到能量區，剩下的卡片放到休息室，將那個牌組洗牌。'),
          },
        },
        {
          op: 'grantAbility', target: self, duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: { event: 'dealtDamageNotCancelled' }, perTurn: 1,
            effects: [move({ zone: 'deck', side: 'opponent', count: { exactly: 1 }, fromTop: 1 }, { zone: 'clock', side: 'opponent' })],
            text: t('【自】この能力は1ターンにつき1回まで発動する。このカードの与えたダメージがキャンセルされなかった時、相手は自分の山札の上から1枚を、クロック置場に置く。',
              '【自】此能力每回合最多發動1次。此卡給予的傷害沒有被取消時，對手將自己的牌組上方1張，放到傷害區。'),
          },
        },
      ],
      text: t('【自】［①］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、そのターン中、このカードは次の2つの能力を得る。『【自】この能力は1ターンにつき1回まで発動する。このカードの与えたダメージがキャンセルされた時、あなたは自分の山札を見て《音楽》のキャラを3枚まで選び、公開し、1枚選び、手札に加え、1枚選び、ストック置場に置き、残りのカードを控え室に置き、その山札をシャッフルする。』『【自】この能力は1ターンにつき1回まで発動する。このカードの与えたダメージがキャンセルされなかった時、相手は自分の山札の上から1枚を、クロック置場に置く。』',
        '【自】［①］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，在那個回合中，此卡獲得以下2個能力。『【自】此能力每回合最多發動1次。此卡給予的傷害被取消時，你從自己的牌組選擇《音樂》的角色最多3張，公開，選擇1張，加到手牌，選擇1張，放到能量區，剩下的卡片放到休息室，將那個牌組洗牌。』『【自】此能力每回合最多發動1次。此卡給予的傷害沒有被取消時，對手將自己的牌組上方1張，放到傷害區。』'),
    },
  ], '登場付1能量：這回合她的傷害被取消→從牌組找3張《音樂》角色（1張手牌、1張能量、1張休息室）；沒被取消→對手再吃1點（不能取消）。'),
  red('42', ['間違ってない証明 仁菜', '沒有錯的證明 仁菜'], 3, 2, 10000, 2, ['soul'], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'draw', upTo: 2 }, move(hand(), toWR)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは2枚まで引き、自分の手札を1枚選び、控え室に置く。', '【自】此卡從手牌被放置到舞台時，你抽最多2張牌，選擇自己的手牌1張，放到休息室。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxKuuhaku }, trigger: { event: 'climaxPlaced', side: 'self', filter: { name: N.cxKuuhaku } },
      condition: { kind: 'all', of: [{ kind: 'sourceInSlot', slots: [0, 1, 2] }, othersMusicAtLeast(1)] },
      effects: [
        { op: 'dealDamage', amount: 1, cancelable: true },
        {
          op: 'grantAbility', target: self, duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: { event: 'encoreStepStart', side: 'self' }, optional: true,
            cost: [{ kind: 'discard', selector: { zone: 'hand', side: 'self', count: 'all' }, bind: 'paid' }, { kind: 'discard', selector: { zone: 'stock', side: 'self', count: 'all' }, bind: 'paid' }],
            effects: [{ op: 'repeat', times: { countOfBound: 'paid', divideBy: 5 }, effects: [{ op: 'dealDamage', amount: 2, cancelable: true }] }],
            text: t('【自】［あなたの、手札とストックすべてを控え室に置く］あなたのアンコールステップの始めに、あなたはコストを払ってよい。この能力のコストで控え室に置かれたカード5枚につき、相手に2ダメージを与える。',
              '【自】［將你的手牌和能量全部放到休息室］在你的安可步驟開始時，你可以支付代價。這個能力的代價放到休息室的卡片每有5張，給對手2點傷害。'),
            review: ['讀成「每 5 張就給 1 次 2 點傷害」（每次可以分別被取消）。'],
          },
        },
      ],
      text: t('【自】【CXコンボ】あなたのCX置場に「空白とカタルシス」が置かれた時、前列にこのカードがいて、他のあなたの《音楽》のキャラがいるなら、相手に1ダメージを与え、そのターン中、このカードは次の能力を得る。『【自】［あなたの、手札とストックすべてを控え室に置く］あなたのアンコールステップの始めに、あなたはコストを払ってよい。この能力のコストで控え室に置かれたカード5枚につき、相手に2ダメージを与える。』（ダメージキャンセルは発生する）',
        '【自】【CX連動】當「空白與宣洩」被放置到你的名場面區時，此卡在前列，有其他的你的《音樂》的角色存在的話，給對手1點傷害，在那個回合中，此卡獲得以下能力。『【自】［將你的手牌和能量全部放到休息室］在你的安可步驟開始時，你可以支付代價。這個能力的代價放到休息室的卡片每有5張，給對手2點傷害。』(會發生傷害取消)'),
    },
  ], '登場抽2丟1。連動名場面「空白與宣洩」：打出時給1點傷害；安可步驟開始時可以把手牌和能量全部丟掉，每5張給2點傷害（終盤收尾用）。'),
  red('43', ['トゲナシトゲアリ 桃香', 'TOGENASHI TOGEARI 桃香'], 3, 2, 10000, 2, ['soul'], [
    {
      kind: 'auto', trigger: placed,
      effects: [
        power(self, 4500, 'untilNextOpponentTurnEnd'),
        {
          op: 'grantAbility', target: self, duration: 'untilNextOpponentTurnEnd',
          ability: { kind: 'continuous', rules: ['noBackupInBattle'], effects: [], text: t('【永】このカードのバトル中、すべてのプレイヤーは『助太刀』を手札からプレイできない。', '【永】此卡的戰鬥中，所有玩家都不能從手牌使用『助太刀』。') },
        },
      ],
      text: t('【自】このカードが手札から舞台に置かれた時、次の相手のターンの終わりまで、このカードのパワーを＋4500し、このカードは次の能力を得る。『【永】このカードのバトル中、すべてのプレイヤーは『助太刀』を手札からプレイできない。』',
        '【自】此卡從手牌被放置到舞台時，到下次的對手回合結束前，此卡的攻擊力+4500，此卡獲得以下能力。『【永】此卡的戰鬥中，所有玩家都不能從手牌使用『助太刀』。』'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxKuuhaku }, trigger: attacks, optional: true, cost: [discardHand(undefined, 2)],
      effects: [move(wr({ name: N.cxKuuhaku }), { zone: 'climaxZone', side: 'self' })],
      text: t('【自】【CXコンボ】［手札を2枚控え室に置く］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「空白とカタルシス」を1枚選び、CX置場に置く。',
        '【自】【CX連動】［手牌2張放到休息室］此卡攻擊時，你可以支付代價。支付代價的話，你選擇自己休息室的「空白與宣洩」1張，放到名場面區。'),
      review: ['用效果放到名場面區也算「名場面被放置」，「沒有錯的證明 仁菜」的連動會發動；原本在名場面區的名場面會進休息室。'],
    },
  ], '登場後到對手回合結束都是14500，而且她的戰鬥中雙方都不能用助太刀。攻擊時丟2張，把休息室的「空白與宣洩」直接放到名場面區（觸發「沒有錯的證明 仁菜」的連動）。'),
  red('44', ['ぶつかり合って進む 智', '互相碰撞前進 智'], 3, 2, 10000, 2, ['soul'], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'draw', upTo: 1 }, power(self, 2000)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは1枚まで引き、そのターン中、このカードのパワーを＋2000。', '【自】此卡從手牌被放置到舞台時，你抽最多1張牌，在那個回合中，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxUnmei }, trigger: { event: 'attackEnd' }, optional: true,
      condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: N.cxUnmei }, othersMusicAtLeast(2)] },
      cost: [stock(2), discardHand(undefined, 2), { kind: 'reveal', selector: hand({ name: N.rupaButsukari }) }, { kind: 'returnSourceToHand' }],
      effects: [
        move({ zone: 'hand', side: 'self', filter: { name: N.rupaHitori }, count: { upTo: 1 } }, { zone: 'stage', side: 'self', slot: 'sourceSlot' }, 'rupa'),
        power({ zone: 'stage', side: 'self', count: 'all', fromBind: 'rupa' }, 4000),
      ],
      text: t('【自】【CXコンボ】共鳴［② 手札を2枚控え室に置き、手札の「ぶつかり合って進む ルパ」を1枚公開し、このカードを手札に戻す］このカードのアタックの終わりに、CX置場に「運命に賭けたい論理」があり、他のあなたの《音楽》のキャラが2枚以上なら、あなたはコストを払ってよい。そうしたら、あなたは自分の手札の「一人じゃないステージ ルパ」を1枚まで選び、このカードがいた枠に置き、そのターン中、そのキャラのパワーを＋4000。',
        '【自】【CX連動】共鳴［② 手牌2張放到休息室，公開手牌的「互相碰撞前進 RUPA」1張，將此卡回到手牌］此卡的攻擊結束時，名場面區有「想賭上命運的理論」，其他的你的《音樂》的角色存在2張以上的話，你可以支付代價。支付代價的話，你選擇自己手牌的「不是一個人的舞台 RUPA」最多1張，放到此卡原本的格子，在那個回合中，那張角色的攻擊力+4000。'),
      review: ['放上去的「不是一個人的舞台 RUPA」算「從手牌被放置到舞台」，它的登場效果會發動；它是直立的，還可以再攻擊。'],
    },
  ], '登場抽1張、這回合12000。連動名場面「想賭上命運的理論」：攻擊完付2能量丟2張、公開手牌的「互相碰撞前進 RUPA」，把自己收回手牌，換上「不是一個人的舞台 RUPA」（+4000，還能再攻擊一次）。'),
  red('45', ['トゲナシトゲアリ すばる', 'TOGENASHI TOGEARI 昂'], 3, 2, 10500, 2, [], [
    {
      kind: 'continuous', condition: { kind: 'myTurn' }, effects: [power(self, 2000, 'whileActive')],
      text: t('【永】あなたのターン中、このカードのパワーを＋2000。', '【永】在你的回合中，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1)],
      effects: [{ op: 'resetStock', side: 'opponent', via: 'waitingRoom' }],
      text: t('【自】［①］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、相手は自分のストックすべてを、控え室に置き、自分の山札の上から同じ枚数をストック置場に置く。',
        '【自】［①］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，對手將自己的能量全部放到休息室，從自己的牌組上方放同樣張數到能量區。'),
    },
  ], '自己回合12500。登場付1能量：對手的能量全部換掉（牌組裡的名場面可能被翻到能量區，對手更難取消傷害；也會讓對手牌組變少）。'),
  {
    id: 'GCR/SE48-46', series: SERIES, name: t(N.event46, '把憤怒、喜悅、悲傷全部灌進去。'),
    type: 'event', color: 'red', level: 1, cost: 1, triggers: [], traits: [],
    abilities: [
      {
        kind: 'event', timing: 'counter',
        effects: [{ op: 'lookTopPick', look: 3, pick: { filter: { anyOf: [music, { name: N.event46 }] }, upTo: 1 }, rest: 'waitingRoom' }, { op: 'sourceToMemory' }],
        text: t('【カウンター】あなたは自分の山札を上から3枚まで見て、《音楽》のキャラか「怒りも喜びも哀しさも全部ぶちこめ。」を1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。このカードを思い出にする。',
          '【反擊】你從自己的牌組上方看最多3張，選擇《音樂》的角色或「把憤怒、喜悅、悲傷全部灌進去。」最多1張給對手確認，加到手牌，剩下的卡片放到休息室。將此卡放到回憶區。'),
        review: ['有反擊圖示的事件：自己的主要階段、對手正打你時的反擊步驟都可以用。'],
      },
      {
        kind: 'auto', activeIn: 'memory', trigger: { event: 'myClimaxPhaseStart' }, optional: true, cost: [stock(1), discardHand()],
        effects: [{ op: 'swapHandWithWaiting', filter: { type: 'climax', hasTrigger: 'comeback' } }],
        text: t('【自】記憶［① 手札を1枚控え室に置く］思い出置場にこのカードがあるなら、あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたは自分の手札のトリガーアイコンが【カムバック】のCXを1枚まで選び公開し、自分の控え室のトリガーアイコンが【カムバック】のCXを1枚選び、入れ替える。',
          '【自】記憶［① 手牌1張放到休息室］此卡在回憶區的話，在你的名場面階段開始時，你可以支付代價。支付代價的話，你選擇自己手牌的判定標誌是木門的名場面最多1張公開，和自己休息室的判定標誌是木門的名場面1張交換。'),
      },
    ],
    note: '看3張拿1張《音樂》角色（或另一張同名事件），用完放進回憶區。之後每回合名場面階段開始時，可以付1能量丟1張，把手牌的木門名場面換成休息室的另一張木門名場面（換成需要的連動名場面）。',
    status: pending,
  },
  cx('47', [N.cxUnmei, '想賭上命運的理論'], 'red', 'comeback', '全部角色+1000、魂傷+1。連動：「互相碰撞前進 RUPA」「互相碰撞前進 智」。判定翻到時可以撿回1張角色。'),
  cx('48', [N.cxKara, '空的箱子'], 'red', 'comeback', '全部角色+1000、魂傷+1。連動：「用自由的方式 桃香」。判定翻到時可以撿回1張角色。'),
  cx('49', [N.cxGokushi, '極私的極彩色解答'], 'red', 'comeback', '全部角色+1000、魂傷+1。連動：「真心喜歡的事 昂」。判定翻到時可以撿回1張角色。'),
  cx('50', [N.cxDaremo, '因為我是誰也成為不了的我'], 'red', 'comeback', '全部角色+1000、魂傷+1。連動：「無刺的假日 仁菜」。判定翻到時可以撿回1張角色。'),
  cx('51', [N.cxKuuhaku, '空白與宣洩'], 'red', 'comeback', '全部角色+1000、魂傷+1。連動：「沒有錯的證明 仁菜」「TOGENASHI TOGEARI 桃香」。判定翻到時可以撿回1張角色。'),
  blue('52', ['２月の細氷 リン', '二月的細冰 琳'], 0, 0, 500, 1, [], [
    {
      kind: 'auto', trigger: attacks, effects: [power(mine({ ...music, excludeSource: true }), 2000)],
      text: t('【自】このカードがアタックした時、あなたは他の自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋2000。', '【自】此卡攻擊時，你選擇其他的自己的《音樂》的角色1張，在那個回合中，攻擊力+2000。'),
    },
    {
      kind: 'activated', cost: [stock(1), { kind: 'sendSourceToWaitingRoom' }],
      effects: [move(wr({ names: ['正しさの証明 ヒナ', '輝けるやり方で ナナ', 'ダイヤモンドダスト アイ'] }), toHand)],
      text: t('【起】［① このカードを控え室に置く］あなたは自分の控え室の、「正しさの証明 ヒナ」か「輝けるやり方で ナナ」か「ダイヤモンドダスト アイ」を1枚選び、手札に戻す。',
        '【起】［① 將此卡放到休息室］你選擇自己休息室的「正確的證明 雛」或「用閃耀的方式 奈奈」或「Diamond Dust 愛」1張，回到手牌。'),
    },
  ], '攻擊時讓另1張《音樂》角色+2000。【起】：付1能量把自己送進休息室，撿回3種主力角色之一。'),
  blue('53', [N.aiFeb, '二月的細冰 愛'], 0, 0, 500, 1, [], [
    {
      kind: 'continuous', effects: [power(others(music), 500, 'whileActive')],
      text: t('【永】他のあなたの《音楽》のキャラすべてに、パワーを＋500。', '【永】其他的你的《音樂》的角色全部，攻擊力+500。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'restSource' }], effects: [{ op: 'swapLevelWithWaiting', filter: music }],
      text: t('【起】［このカードを【レスト】する］あなたは自分のレベル置場のカードと控え室の《音楽》のキャラを1枚ずつ選び、入れ替える。', '【起】［將此卡【橫置】］你選擇自己等級區的卡片和休息室的《音樂》的角色各1張，交換。'),
    },
    {
      kind: 'activated', condition: { kind: 'all', of: [{ kind: 'levelAtLeast', n: 2 }, levelSum(3)] }, cost: [stock(1), { kind: 'sendSourceToWaitingRoom' }],
      effects: [move(wr({ name: N.aiKagayake }), { zone: 'stage', side: 'self', slot: 'sourceSlot' })],
      text: t('【起】経験［① このカードを控え室に置く］あなたのレベルが2以上で、あなたのレベル置場のカードのレベルの合計が3以上なら、あなたは自分の控え室の「輝けるやり方で アイ」を1枚選び、このカードがいた枠に置く。',
        '【起】經驗［① 將此卡放到休息室］你的等級在2以上，你的等級區的卡片的等級合計在3以上的話，你選擇自己休息室的「用閃耀的方式 愛」1張，放到此卡原本的格子。'),
    },
  ], '其他《音樂》角色+500。【起】橫置：把等級區的卡換成休息室的《音樂》角色（讓「經驗」的等級合計變高）。經驗：等級2以上、等級區合計3以上時，付1能量把自己換成休息室的「用閃耀的方式 愛」。'),
  blue('54', ['輝けるやり方で リン', '用閃耀的方式 琳'], 0, 0, 1000, 1, [], [
    {
      kind: 'auto', trigger: { event: 'myClimaxPhaseStart' }, effects: [power(mine(), 500)],
      text: t('【自】あなたのCXフェイズの始めに、あなたは自分のキャラを1枚選び、そのターン中、パワーを＋500。', '【自】在你的名場面階段開始時，你選擇自己的角色1張，在那個回合中，攻擊力+500。'),
    },
    {
      kind: 'activated', keyword: { id: 'concentrate' }, cost: [stock(1), { kind: 'restSource' }],
      effects: [
        { op: 'revealMill', n: 4, bind: 'milled', result: 'count' },
        { op: 'repeat', times: { countOfBound: 'milled', filter: { type: 'climax' } }, effects: [{ op: 'searchDeck', filter: music, upTo: 1, reveal: true, shuffle: true }] },
      ],
      text: t('【起】集中［① このカードを【レスト】する］あなたは自分の山札の上から4枚をめくり、控え室に置く。それらのカードのCX1枚につき、あなたは自分の山札を見て《音楽》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻4張，放到休息室。那些卡片中每有1張名場面，你從自己的牌組選擇《音樂》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
  ], '名場面階段開始時讓1張角色+500。集中：翻4張，每張名場面就從牌組找1張《音樂》角色。'),
  blue('55', ['２月の細氷 ナナ', '二月的細冰 奈奈'], 0, 0, 1000, 1, [], [
    {
      kind: 'auto', trigger: placed,
      effects: [{
        op: 'grantAbility', target: opp(), duration: 'untilNextOpponentTurnEnd',
        ability: { kind: 'continuous', rules: ['cannotMove'], effects: [], text: t('【永】このカードは他の枠に動かせない。', '【永】此卡不能移動到其他格子。') },
      }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手のキャラを1枚選び、次の相手のターンの終わりまで、次の能力を与える。『【永】このカードは他の枠に動かせない。』', '【自】此卡從手牌被放置到舞台時，你選擇對手的角色1張，到下次的對手回合結束前，給予以下能力。『【永】此卡不能移動到其他格子。』'),
    },
    {
      kind: 'auto', trigger: placed,
      effects: [{ op: 'memoryAndReturn', target: { zone: 'stage', side: 'opponent', count: { upTo: 1 } } }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手のキャラを1枚まで選び、思い出にし、相手は自分の思い出置場のそのキャラを、舞台の好きな枠に置く。', '【自】此卡從手牌被放置到舞台時，你選擇對手的角色最多1張，放到回憶區，對手將自己回憶區的那張角色，放到舞台上喜歡的格子。'),
      review: ['回到舞台的角色是「新的卡」：之前得到的加成、給予的能力都會消失。'],
    },
  ], '登場時讓對手1張角色到對手回合結束都不能換位置。另外可以讓對手1張角色進回憶區再回舞台（清掉它身上的加成）。'),
  blue('56', ['アイドルバンドの休日 アイ', '偶像樂團的假日 愛'], 0, 0, 1000, 1, [], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'swapLevelWithWaiting', optional: true }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のレベル置場のカードと控え室のカードを1枚ずつ選び、入れ替えてよい。', '【自】此卡從手牌被放置到舞台時，你可以選擇自己等級區的卡片和休息室的卡片各1張，交換。'),
    },
    {
      kind: 'activated', cost: [discardHand(), { kind: 'sendSourceToWaitingRoom' }],
      effects: [move(wr(music), toHand)],
      text: t('【起】［手札を1枚控え室に置き、このカードを控え室に置く］あなたは自分の控え室の《音楽》のキャラを1枚選び、手札に戻す。', '【起】［手牌1張放到休息室，並將此卡放到休息室］你選擇自己休息室的《音樂》的角色1張，回到手牌。'),
    },
  ], '登場時可以把等級區的卡和休息室的任意卡交換（調整「經驗」的等級合計、換回顏色）。【起】：丟1張並把自己送進休息室，撿回1張《音樂》角色。'),
  blue('57', ['アイドルバンドの休日 ヒナ', '偶像樂團的假日 雛'], 0, 0, 2000, 1, [], [
    {
      kind: 'auto', trigger: attacks, optional: true, cost: [stock(1), { kind: 'deckTopToClock' }],
      effects: [{ op: 'searchDeck', filter: { type: 'character', levelAtMost: 1 }, upTo: 1, reveal: true, shuffle: true }],
      text: t('【自】［① あなたの山札の上から1枚をクロック置場に置く］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見てレベル1以下のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '【自】［① 將你的牌組上方1張放到傷害區］此卡攻擊時，你可以支付代價。支付代價的話，你從自己的牌組選擇等級1以下的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
  ], '攻擊時付1能量並自己吃1點傷害，從牌組找1張Lv1以下的角色。'),
  blue('58', ['２月の細氷 ヒナ', '二月的細冰 雛'], 1, 0, 4000, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'all', of: [{ kind: 'myTurn' }, levelSum(2)] },
      effects: [power(self, 2000, 'whileActive'), { op: 'grantAbility', target: self, duration: 'whileActive', ability: lookKeep2 }],
      text: t('【永】経験 あなたのターン中、あなたのレベル置場のカードのレベルの合計が2以上なら、このカードのパワーを＋2000し、このカードは次の能力を得る。『【自】このカードがアタックした時、あなたは自分の山札を上から2枚まで見て、カードを1枚選び、山札の上に置き、残りのカードを控え室に置く。』',
        '【永】經驗 在你的回合中，你的等級區的卡片的等級合計在2以上的話，此卡的攻擊力+2000，此卡獲得以下能力。『【自】此卡攻擊時，你從自己的牌組上方看最多2張，選擇卡片1張，放回牌組上方，剩下的卡片放到休息室。』'),
    },
    {
      kind: 'auto', trigger: { event: 'attackEnd' }, optional: true, cost: [stock(1), discardHand()],
      effects: [{ op: 'searchDeck', filter: music, upTo: 1, reveal: true, shuffle: true }],
      text: t('【自】［① 手札を1枚控え室に置く］このカードのアタックの終わりに、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て《音楽》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '【自】［① 手牌1張放到休息室］此卡的攻擊結束時，你可以支付代價。支付代價的話，你從自己的牌組選擇《音樂》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    },
  ], '經驗（等級區合計2以上）：自己回合6000，攻擊時看2張留1張。攻擊完付1能量丟1張，從牌組找1張《音樂》角色。'),
  blue('59', ['輝けるやり方で ナナ', '用閃耀的方式 奈奈'], 1, 0, 4000, 1, [], [
    {
      kind: 'continuous', condition: levelSum(2), effects: [power(self, 2000, 'whileActive')],
      text: t('【永】経験 あなたのレベル置場のカードのレベルの合計が2以上なら、このカードのパワーを＋2000。', '【永】經驗 你的等級區的卡片的等級合計在2以上的話，此卡的攻擊力+2000。'),
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxCycle }, trigger: { event: 'attackEnd' }, optional: true,
      condition: { kind: 'climaxInZone', name: N.cxCycle }, cost: [stock(1)],
      effects: [{ op: 'lookTopHandAndStock', look: 4, filter: music }],
      text: t('【自】【CXコンボ】［①］このカードのアタックの終わりに、CX置場に「Cycle Of Sorrow」があるなら、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から4枚まで見て、《音楽》のキャラを2枚まで選んで相手に見せ、1枚選び、手札に加え、1枚選び、ストック置場に置き、残りのカードを控え室に置く。',
        '【自】【CX連動】［①］此卡的攻擊結束時，名場面區有「Cycle Of Sorrow」的話，你可以支付代價。支付代價的話，你從自己的牌組上方看最多4張，選擇《音樂》的角色最多2張給對手確認，選擇1張，加到手牌，選擇1張，放到能量區，剩下的卡片放到休息室。'),
      review: ['「4枚まで見て」：目前固定看 4 張。'],
    },
  ], '經驗（等級區合計2以上）：6000。連動名場面「Cycle Of Sorrow」：攻擊完付1能量，看4張：1張《音樂》角色進手牌、1張進能量。'),
  blue('60', ['アイドルバンドの休日 リン', '偶像樂團的假日 琳'], 1, 1, 3500, 1, ['soul'], [
    {
      kind: 'continuous', condition: levelSum(2),
      effects: [power(self, 3500, 'whileActive'), { op: 'grantAbility', target: self, duration: 'whileActive', ability: encore(chara) }],
      text: t('【永】経験 あなたのレベル置場のカードのレベルの合計が2以上なら、このカードのパワーを＋3500し、このカードは『【自】アンコール［手札のキャラを1枚控え室に置く］』を得る。',
        '【永】經驗 你的等級區的卡片的等級合計在2以上的話，此卡的攻擊力+3500，此卡獲得『【自】安可［手牌的角色1張放到休息室］』。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, condition: othersMusicAtLeast(4), effects: [move(wr(music), toStock)],
      text: t('【自】このカードが手札から舞台に置かれた時、他のあなたの《音楽》のキャラが4枚以上なら、あなたは自分の控え室の《音楽》のキャラを1枚選び、ストック置場に置いてよい。', '【自】此卡從手牌被放置到舞台時，其他的你的《音樂》的角色存在4張以上的話，你可以選擇自己休息室的《音樂》的角色1張，放到能量區。'),
    },
  ], '經驗（等級區合計2以上）：7000，還能丟1張手牌角色安可。場上5格都放滿時登場，可以從休息室補1能量。'),
  blue('61', ['アイドルバンドの休日 ナナ', '偶像樂團的假日 奈奈'], 2, 1, 2500, 1, ['soul'], [
    {
      kind: 'auto', trigger: { event: 'usedBackup' }, optional: true, cost: [stock(2)],
      effects: [{ op: 'waitingToDeck', side: 'self' }],
      text: t('【自】［②］あなたがこのカードの『助太刀』を使った時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のカードすべてを、山札に戻し、その山札をシャッフルする。', '【自】［②］當你使用此卡的『助太刀』時，你可以支付代價。支付代價的話，你將自己休息室的卡片全部放回牌組，將那個牌組洗牌。'),
    },
    backup(2500, 2, 1, '【起】【カウンター】助太刀2500 レベル2［① 手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋2500）',
      '【起】【反擊】助太刀2500 等級2［① 手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+2500)'),
  ], '助太刀+2500。再付2能量，把休息室全部洗回牌組（牌組裡的名場面變多，比較容易取消傷害，也不用重洗吃傷害）。'),
  blue('62', [N.aiKagayake, '用閃耀的方式 愛'], 2, 1, 5500, 1, [], [
    {
      kind: 'continuous', effects: [power(others(music), 1000, 'whileActive')],
      text: t('【永】他のあなたの《音楽》のキャラすべてに、パワーを＋1000。', '【永】其他的你的《音樂》的角色全部，攻擊力+1000。'),
    },
    {
      kind: 'auto', trigger: placed, alsoOn: { event: 'placedByEffectOf', name: N.aiFeb }, optional: true, cost: [discardHand()],
      effects: [move(wr(music), toHand)],
      text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時か「２月の細氷 アイ」の【起】の効果で舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《音楽》のキャラを1枚選び、手札に戻す。',
        '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時或因「二月的細冰 愛」的【起】的效果被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的《音樂》的角色1張，回到手牌。'),
    },
  ], '其他《音樂》角色+1000。登場時（或被「二月的細冰 愛」換上場時）丟1張，撿回1張《音樂》角色。'),
  blue('63', ['ダイヤモンドダスト ヒナ', 'Diamond Dust 雛'], 2, 1, 6500, 1, [], [
    {
      kind: 'continuous', condition: { kind: 'all', of: [{ kind: 'myTurn' }, levelSum(4)] }, effects: [power(self, 5000, 'whileActive')],
      text: t('【永】経験 あなたのターン中、あなたのレベル置場のカードのレベルの合計が4以上なら、このカードのパワーを＋5000。', '【永】經驗 在你的回合中，你的等級區的卡片的等級合計在4以上的話，此卡的攻擊力+5000。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, condition: othersMusicAtLeast(4), effects: [move(wr(music), toStock)],
      text: t('【自】このカードが手札から舞台に置かれた時、他のあなたの《音楽》のキャラが4枚以上なら、あなたは自分の控え室の《音楽》のキャラを1枚選び、ストック置場に置いてよい。', '【自】此卡從手牌被放置到舞台時，其他的你的《音樂》的角色存在4張以上的話，你可以選擇自己休息室的《音樂》的角色1張，放到能量區。'),
    },
    {
      kind: 'auto', trigger: { event: 'myTriggerChecked', filter: { type: 'climax', hasTrigger: 'gate' } }, optional: true, cost: [stock(1)],
      effects: [move(deckTop(1), toStock), { op: 'draw', upTo: 1 }, { op: 'ifBound', bind: '_drawn', then: [move(hand(), toWR)] }],
      text: t('【自】［①］あなたのトリガーアイコンが【ゲート】のCXがトリガーした時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札の上から1枚を、ストック置場に置き、1枚まで引く。1枚引いたなら、あなたは自分の手札を1枚選び、控え室に置く。',
        '【自】［①］當你判定出判定標誌是門的名場面時，你可以支付代價。支付代價的話，你將自己的牌組上方1張放到能量區，抽最多1張牌。抽了1張的話，你選擇自己的手牌1張，放到休息室。'),
    },
  ], '經驗（等級區合計4以上）：自己回合11500。場上放滿時登場可以從休息室補1能量。判定翻到門名場面時付1能量：牌組上方1張進能量（付1拿回1），再抽1丟1。'),
  blue('64', ['ダイヤモンドダスト アイ', 'Diamond Dust 愛'], 3, 2, 9500, 2, ['soul'], [
    handLevelDown({ kind: 'countAtMost', selector: { zone: 'waitingRoom', side: 'self', filter: { type: 'climax' }, count: 'all' }, n: 2 },
      '【永】あなたの控え室のCXが2枚以下なら、あなたの手札のこのカードのレベルを－1。', '【永】你的休息室的名場面在2張以下的話，你的手牌的此卡的等級-1。'),
    {
      kind: 'continuous', condition: levelSum(4),
      effects: [power(self, 500, 'whileActive'), { op: 'grantAbility', target: self, duration: 'whileActive', ability: encore(music) }],
      text: t('【永】経験 あなたのレベル置場のカードのレベルの合計が4以上なら、このカードのパワーを＋500し、このカードは『【自】アンコール［手札の《音楽》のキャラを1枚控え室に置く］』を得る。',
        '【永】經驗 你的等級區的卡片的等級合計在4以上的話，此卡的攻擊力+500，此卡獲得『【自】安可［手牌的《音樂》的角色1張放到休息室］』。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand()], effects: [move(clockTop, toStock)],
      text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分のクロックの上から1枚を、ストック置場に置く。', '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你將自己的傷害區上方1張放到能量區。'),
    },
  ], '休息室的名場面在2張以下時，手牌的她算Lv2（可以提早出）。經驗（等級區合計4以上）：10000並能丟手牌《音樂》角色安可。登場丟1張：傷害區上方1張進能量（回1血又多1能量）。'),
  blue('65', ['ダイヤモンドダスト リン', 'Diamond Dust 琳'], 3, 2, 10000, 2, ['soul'], [
    {
      kind: 'auto', trigger: placed, optional: true, effects: [move(clockTop, toWR)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚を、控え室に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以將自己的傷害區上方1張，放到休息室。'),
    },
    {
      kind: 'auto', trigger: { event: 'battleOpponentReversed' }, optional: true, condition: { kind: 'all', of: [{ kind: 'myTurn' }, levelSum(6)] }, cost: [discardHand()],
      effects: [{
        op: 'grantAbility', target: self, duration: 'untilNextOpponentTurnEnd',
        ability: {
          kind: 'continuous', effects: [{ op: 'modifySoul', target: { zone: 'stage', side: 'opponent', count: 'all', relation: 'facingSource' }, amount: -2, duration: 'whileActive' }],
          text: t('【永】このカードの正面のキャラのソウルを－2。', '【永】此卡的正面的角色的魂傷-2。'),
        },
      }],
      text: t('【自】経験［手札を1枚控え室に置く］あなたのターン中、このカードのバトル相手が【リバース】した時、あなたのレベル置場のカードのレベルの合計が6以上なら、あなたはコストを払ってよい。そうしたら、次の相手のターンの終わりまで、このカードは次の能力を得る。『【永】このカードの正面のキャラのソウルを－2。』',
        '【自】經驗［手牌1張放到休息室］在你的回合中，此卡的戰鬥對手【倒置】時，你的等級區的卡片的等級合計在6以上的話，你可以支付代價。支付代價的話，到下次的對手回合結束前，此卡獲得以下能力。『【永】此卡的正面的角色的魂傷-2。』'),
    },
  ], '登場回1血。經驗（等級區合計6以上）：打倒對手後丟1張，到對手回合結束，她正面的角色魂傷-2（保護自己）。'),
  blue('66', ['正しさの証明 ヒナ', '正確的證明 雛'], 3, 2, 10500, 2, ['soul'], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [{ kind: 'discard', selector: mine(music) }],
      effects: [{ op: 'lookTopHandAndStock', look: 3, filter: {}, secret: true }],
      text: t('【自】［他のあなたの舞台の《音楽》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から3枚まで見て、カードを1枚まで選び、手札に加え、カードを1枚まで選び、ストック置場に置き、残りのカードを控え室に置く。',
        '【自】［將其他的你的舞台的《音樂》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多3張，選擇卡片最多1張，加到手牌，選擇卡片最多1張，放到能量區，剩下的卡片放到休息室。'),
      review: ['「3枚まで見て」：目前固定看 3 張。只選 1 張時，那張加到手牌。'],
    },
    {
      kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxEternal }, trigger: attacks, optional: true,
      condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: N.cxEternal }, levelSum(6)] }, cost: [stock(1), discardHand()],
      effects: [{ op: 'dealDamage', amount: 2, cancelable: true }, power(self, 2000, 'untilNextOpponentTurnEnd')],
      text: t('【自】【CXコンボ】経験［① 手札を1枚控え室に置く］このカードがアタックした時、CX置場に「ETERNAL FLAME 〜空の箱〜」があり、あなたのレベル置場のカードのレベルの合計が6以上なら、あなたはコストを払ってよい。そうしたら、相手に2ダメージを与え、次の相手のターンの終わりまで、このカードのパワーを＋2000。（ダメージキャンセルは発生する）',
        '【自】【CX連動】經驗［① 手牌1張放到休息室］此卡攻擊時，名場面區有「ETERNAL FLAME ～空之箱～」，你的等級區的卡片的等級合計在6以上的話，你可以支付代價。支付代價的話，給對手2點傷害，到下次的對手回合結束前，此卡的攻擊力+2000。(會發生傷害取消)'),
    },
  ], '登場把場上另1張《音樂》角色送進休息室：看3張，1張進手牌、1張進能量。連動名場面「ETERNAL FLAME ～空之箱～」＋經驗（等級區合計6以上）：攻擊時付1能量丟1張，給2點傷害，到對手回合結束+2000。'),
  blue('67', ['ダイヤモンドダスト ナナ', 'Diamond Dust 奈奈'], 3, 2, 10500, 2, ['soul'], [
    {
      kind: 'auto', trigger: placed,
      effects: [move({ zone: 'hand', side: 'self', filter: { type: 'character', levelAtMostPlayerLevel: true }, count: { upTo: 1 } }, anySlot), power(self, 2000)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の手札の自分のレベル以下のレベルのキャラを1枚まで選び、舞台の好きな枠に置き、そのターン中、このカードのパワーを＋2000。',
        '【自】此卡從手牌被放置到舞台時，你選擇自己手牌中等級在自己等級以下的角色最多1張，放到舞台上喜歡的格子，在那個回合中，此卡的攻擊力+2000。'),
      review: ['用這個效果放到舞台的角色，也算「從手牌被放置到舞台」，它自己的登場效果會發動。'],
    },
    {
      kind: 'auto', trigger: { event: 'battleOpponentReversed' }, optional: true, condition: { kind: 'all', of: [{ kind: 'myTurn' }, levelSum(4)] }, cost: [stock(1), discardHand()],
      effects: [move(battleOpp, { zone: 'clock', side: 'opponent' })],
      text: t('【自】経験［① 手札を1枚控え室に置く］あなたのターン中、このカードのバトル相手が【リバース】した時、あなたのレベル置場のカードのレベルの合計が4以上なら、あなたはコストを払ってよい。そうしたら、あなたはそのキャラをクロック置場に置く。',
        '【自】經驗［① 手牌1張放到休息室］在你的回合中，此卡的戰鬥對手【倒置】時，你的等級區的卡片的等級合計在4以上的話，你可以支付代價。支付代價的話，你將那張角色放到傷害區。'),
    },
  ], '登場時從手牌免費再放1張角色上場，她這回合12500。經驗（等級區合計4以上）：打倒對手後付1能量丟1張，把那張角色放進對手的傷害區（等於1點不能取消的傷害）。'),
  cx('68', [N.cxCycle, 'Cycle Of Sorrow'], 'blue', 'gate', '全部角色+1000、魂傷+1。連動：「用閃耀的方式 奈奈」。判定翻到時：魂傷+1，還可以從休息室撿回1張名場面。'),
  cx('69', [N.cxEternal, 'ETERNAL FLAME ～空之箱～'], 'blue', 'gate', '全部角色+1000、魂傷+1。連動：「正確的證明 雛」。判定翻到時：魂傷+1，還可以從休息室撿回1張名場面。'),
  red('P01', ['正しくないままで トゲナシトゲアリ', '就這樣不正確下去 TOGENASHI TOGEARI'], 0, 0, 2000, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true, effects: [move(hand(), toStock)],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の手札を1枚選び、ストック置場に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以選擇自己的手牌1張，放到能量區。'),
    },
    {
      kind: 'activated', cost: [stock(1), { kind: 'sendSourceToWaitingRoom' }],
      effects: [{ op: 'lookTopPick', look: 4, pick: { filter: music, upTo: 1 }, rest: 'waitingRoom' }],
      text: t('【起】［① このカードを控え室に置く］あなたは自分の山札を上から4枚まで見て、《音楽》のキャラを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
        '【起】［① 將此卡放到休息室］你從自己的牌組上方看最多4張，選擇《音樂》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      review: ['「4枚まで見て」：目前固定看 4 張。'],
    },
  ], '登場時可以把1張手牌放進能量區。【起】：付1能量把自己送進休息室，看4張拿1張《音樂》角色。'),
  red('P03', ['“Avoid Note”仁菜', '"Avoid Note" 仁菜'], 1, 0, 4000, 1, [], [
    doubleCheck(DOUBLE_CHECK_JA, DOUBLE_CHECK_ZH),
    {
      kind: 'auto', trigger: leaves, optional: true, effects: [move(hand(), toStock)],
      text: t('【自】このカードが舞台から控え室に置かれた時、あなたは自分の手札を1枚選び、ストック置場に置いてよい。', '【自】此卡從舞台被放到休息室時，你可以選擇自己的手牌1張，放到能量區。'),
    },
  ], '攻擊時付1能量判定2次。進休息室時可以把1張手牌放進能量區。'),
  red('P04', ['“Avoid Note”桃香', '"Avoid Note" 桃香'], 0, 0, 500, 1, [], [
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1), discardHand()],
      effects: [{ op: 'lookTopPick', look: 3, pick: { filter: {}, upTo: 1 }, rest: 'waitingRoom', secret: true }],
      text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から3枚まで見て、カードを1枚まで選び、手札に加え、残りのカードを控え室に置く。',
        '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多3張，選擇卡片最多1張，加到手牌，剩下的卡片放到休息室。'),
      review: ['「3枚まで見て」：目前固定看 3 張。卡面沒寫「相手に見せ」，拿的卡不公開。'],
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [discardHand(music)], effects: [{ op: 'drawCards', n: 1 }],
      text: t('【自】［手札の《音楽》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは1枚引く。', '【自】［手牌的《音樂》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你抽1張牌。'),
    },
  ], '登場時兩個效果：付1能量丟1張，看3張任選1張；丟1張《音樂》角色抽1張。都是換牌用。'),
  red('P05', ['“Avoid Note”すばる', '"Avoid Note" 昂'], 0, 0, 2000, 1, [], [
    {
      kind: 'auto', trigger: { event: 'allyPlacedFromHand', filter: music }, perTurn: 2, effects: [power(self, 1000)],
      text: t('【自】この能力は1ターンにつき2回まで発動する。他のあなたの《音楽》のキャラが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋1000。', '【自】此能力每回合最多發動2次。其他的你的《音樂》的角色從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+1000。'),
    },
    {
      kind: 'auto', trigger: { event: 'allyFrontAttacked', filter: music }, optional: true, cost: [stock(1), { kind: 'sendSourceToWaitingRoom' }],
      effects: [move({ zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'triggerTarget' }, toHand)],
      text: t('【自】［① このカードを控え室に置く］他のあなたの《音楽》のキャラがフロントアタックされた時、あなたはコストを払ってよい。そうしたら、そのキャラを手札に戻す。', '【自】［① 將此卡放到休息室］其他的你的《音樂》的角色被正打時，你可以支付代價。支付代價的話，將那張角色回到手牌。'),
    },
  ], '其他《音樂》角色登場時+1000（每回合最多2次）。其他《音樂》角色被正打時，付1能量把自己送進休息室，讓被打的角色回手牌（不會被打倒）。'),
  red('P06', ['“Avoid Note”智', '"Avoid Note" 智'], 3, 2, 9500, 2, ['soul'], [
    {
      kind: 'auto', trigger: placed,
      effects: [
        move({ zone: 'stage', side: 'opponent', count: { upTo: 1 } }, toOwnerHand),
        { op: 'payThen', cost: [discardHand()], then: [move(opp(), toOwnerHand)] },
      ],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手のキャラを1枚まで選び、手札に戻す。あなたは自分の手札を1枚選び、控え室に置いてよい。そうしたら、あなたは相手のキャラを1枚選び、手札に戻す。',
        '【自】此卡從手牌被放置到舞台時，你選擇對手的角色最多1張，回到手牌。你可以選擇自己的手牌1張，放到休息室。這麼做的話，你選擇對手的角色1張，回到手牌。'),
    },
    {
      kind: 'auto', activeIn: 'clockTop', trigger: { event: 'myClimaxPhaseStart' }, optional: true, cost: [discardHand()],
      effects: [{ op: 'swapWithWaiting', target: opp({ levelAtLeast: 1 }) }],
      text: t('【自】【クロック】アラーム［手札を1枚控え室に置く］このカードがクロックの1番上にあるなら、あなたのCXフェイズの始めに、あなたはコストを払ってよい。そうしたら、あなたは相手のレベル1以上のキャラを1枚選び、相手は自分の控え室のレベルＸ以下のキャラを1枚選び、入れ替える。Ｘはあなたが選んだキャラのレベル－1に等しい。',
        '【自】【傷害區】警報［手牌1張放到休息室］此卡在傷害區最上面的話，在你的名場面階段開始時，你可以支付代價。支付代價的話，你選擇對手的等級1以上的角色1張，對手選擇自己休息室的等級X以下的角色1張，交換。X等於你選擇的角色的等級-1。'),
    },
  ], '登場彈1張對手角色回手牌；再丟1張手牌，可以再彈1張。警報：這張在傷害區最上面時，名場面階段開始時丟1張，把對手1張角色換成低1級的。'),
  red('P07', ['“Avoid Note”ルパ', '"Avoid Note" RUPA'], 0, 0, 1500, 1, [], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'noStandNext', target: opp({ row: 'back', levelAboveOwnerLevel: true }) }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手の後列の、レベルが相手のレベルより高いキャラを1枚選ぶ。そのキャラは次の相手のスタンドフェイズに【スタンド】しない。',
        '【自】此卡從手牌被放置到舞台時，你選擇對手的後列的等級比對手的等級高的角色1張。那張角色在下次的對手的起立階段不【直立】。'),
    },
    {
      kind: 'auto', trigger: placed, optional: true, cost: [stock(1), discardHand()],
      effects: [move(wr(music), toHand), power(mine({ ...music, excludeSource: true }), 1000)],
      text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《音楽》のキャラを1枚選び、手札に戻し、他の自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋1000。',
        '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的《音樂》的角色1張，回到手牌，選擇其他的自己的《音樂》的角色1張，在那個回合中，攻擊力+1000。'),
    },
  ], '登場時讓對手後列1張「等級比對手玩家等級高」的角色下回合不能直立（它的【起】要橫置的就不能用）。另外付1能量丟1張，撿回1張《音樂》角色、另1張+1000。'),
  ...([['P08', '仁菜', '仁菜'], ['P09', '桃香', '桃香'], ['P10', 'すばる', '昂'], ['P11', '智', '智'], ['P12', 'ルパ', 'RUPA']] as const).map(([n, ja, zh]) => red(n, [`一生のバンド ${ja}`, `一輩子的樂團 ${zh}`], 2, 1, 5000, 1, ['soul'], [
    {
      kind: 'auto', trigger: placed, effects: [{ op: 'modifySoul', target: mine(), amount: 1, duration: 'thisTurn' }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のキャラを1枚選び、そのターン中、ソウルを＋1。', '【自】此卡從手牌被放置到舞台時，你選擇自己的角色1張，在那個回合中，魂傷+1。'),
    },
    {
      kind: 'activated', cost: [{ kind: 'sendSourceToWaitingRoom' }], effects: [move(opp(), toOwnerHand)],
      text: t('【起】［このカードを控え室に置く］あなたは相手のキャラを1枚選び、手札に戻す。', '【起】［將此卡放到休息室］你選擇對手的角色1張，回到手牌。'),
    },
  ], '登場時讓1張角色這回合魂傷+1。【起】：把自己送進休息室，彈1張對手角色回手牌（清出空格直接攻擊）。')),
  red('P13', ['私たちの歌 桃香', '我們的歌 桃香'], 0, 0, 1500, 1, [], [
    {
      kind: 'auto', trigger: placed,
      effects: [{ op: 'revealTopCheck', filter: { anyOf: [toge, { name: N.event46 }] }, matchTo: 'deckTop', ifMatch: [power(mine(), 2000)] }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札の上から1枚を公開する。そのカードが《トゲナシトゲアリ》のキャラか「怒りも喜びも哀しさも全部ぶちこめ。」なら、あなたは自分のキャラを1枚選び、そのターン中、パワーを＋2000。（公開したカードは元に戻す）',
        '【自】此卡從手牌被放置到舞台時，你將自己的牌組上方1張公開。那張卡片是《TOGENASHI TOGEARI》的角色或「把憤怒、喜悅、悲傷全部灌進去。」的話，你選擇自己的角色1張，在那個回合中，攻擊力+2000。(公開的卡片放回原位)'),
    },
    {
      kind: 'activated', cost: [discardHand(), { kind: 'sendSourceToWaitingRoom' }], effects: [move(wr(toge), toHand)],
      text: t('【起】［手札を1枚控え室に置き、このカードを控え室に置く］あなたは自分の控え室の《トゲナシトゲアリ》のキャラを1枚選び、手札に戻す。', '【起】［手牌1張放到休息室，並將此卡放到休息室］你選擇自己休息室的《TOGENASHI TOGEARI》的角色1張，回到手牌。'),
    },
  ], '登場翻牌組最上面1張（看完放回），是《TOGENASHI TOGEARI》角色或事件就讓1張角色+2000。【起】：丟1張並把自己送進休息室，撿回1張角色。'),
];

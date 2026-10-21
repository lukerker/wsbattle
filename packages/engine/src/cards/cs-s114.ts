// 蠟筆小新 電影版 預組 CS/S114（20 種、50 張）。紅、藍兩色。
// 日文原文取自官方卡表（data/cards/CS-S114.json）。角色、電影與特徵譯名暫用。
import type { Ability, Card, CardFilter, Selector, Text } from '../card-schema.ts';

const SERIES = 'CS';
export const source = '官方卡表';
const t = (ja: string, zh: string): Text => ({ ja, zh });

const anyTrait = (...traits: string[]): CardFilter => ({ anyOf: traits.map((trait) => ({ type: 'character' as const, trait })) });
const movieFamily = anyTrait('MOVIE', '家族'); // 「《MOVIE》か《家族》のキャラ」
const movieKinder = anyTrait('MOVIE', '幼稚園'); // 「《MOVIE》か《幼稚園》のキャラ」

const self: Selector = { zone: 'stage', side: 'self', count: 'all', relation: 'source' };
const selfStage = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: 'all' });
const oneOfMine = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: { exactly: 1 } });
const handDiscard = (filter?: CardFilter, n = 1): Selector => ({ zone: 'hand', side: 'self', filter, count: { exactly: n } });
const fromWaiting = (filter: CardFilter): Selector => ({ zone: 'waitingRoom', side: 'self', filter, count: { exactly: 1 } });
const toHand = { zone: 'hand' as const, side: 'self' as const };
const toWaitingRoom = { zone: 'waitingRoom' as const, side: 'self' as const };

const T = {
  movie: t('MOVIE', 'MOVIE'),
  family: t('家族', '家族'),
  kinder: t('幼稚園', '幼稚園'),
};
const SHIN = [T.movie, T.family, T.kinder];

const N = {
  himawari: 'プリンセス ひまわり',
  puni: 'ぷにぷに拳 しんのすけ',
  okaeri: 'おかえり しんのすけ！シロ！',
  aiya: 'アイヤータウンを守れ！',
  henshin: 'アクション仮面変身セット しんのすけ',
};

const climax = (ja: string, zh: string): Ability => ({
  kind: 'continuous',
  effects: [
    { op: 'modifyPower', target: selfStage(), amount: 1000, duration: 'whileActive' },
    { op: 'modifySoul', target: selfStage(), amount: 1, duration: 'whileActive' },
  ],
  text: t(ja, zh),
});
const concentrate: Ability = {
  kind: 'activated', keyword: { id: 'concentrate' },
  cost: [{ kind: 'stock', n: 1 }, { kind: 'restSource' }],
  effects: [
    { op: 'revealMill', n: 5, bind: 'milled', result: 'draw' },
    { op: 'drawCards', n: { countOfBound: 'milled', filter: { type: 'climax' } } },
  ],
  text: t('【起】集中［① このカードを【レスト】する］あなたは自分の山札の上から5枚をめくり、控え室に置く。それらのカードのCX1枚につき、あなたは1枚まで引く。',
    '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻5張，放到休息室。那些卡片中每有1張名場面，你抽最多1張牌。'),
};

const pending = { translated: true, coded: true, verified: false, tested: true }; // 情境測試：game/cards-cs.test.ts

export const cards: Card[] = [
  {
    id: 'CS/S114-T01', series: SERIES, name: t('トレジャーハンター しんのすけ', '寶藏獵人 小新'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 500, soul: 1, triggers: [], traits: SHIN,
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifySoul', target: selfStage({ name: N.himawari, excludeSource: true }), amount: 1, duration: 'whileActive' }],
        text: t('【永】他のあなたの「プリンセス ひまわり」すべてに、ソウルを＋1。', '【永】其他的你的「公主 小葵」全部，魂傷+1。'),
      },
      {
        kind: 'auto', keyword: { id: 'bond', targetName: N.himawari }, trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'stock', n: 1 }],
        effects: [{ op: 'moveCards', from: fromWaiting({ name: N.himawari }), to: toHand }],
        text: t('【自】絆／「プリンセス ひまわり」［①］（このカードがプレイされて舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「プリンセス ひまわり」を1枚選び、手札に戻す）',
          '【自】絆／「公主 小葵」［①］(此卡被使用被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「公主 小葵」1張，回到手牌)'),
      },
    ],
    note: '專門搭配「公主 小葵」（Lv1 攻擊5500）。小新在場時，小葵魂傷+1。絆：小新從手牌登場時付1能量，從休息室撿回1張小葵。',
    status: pending,
  },
  {
    id: 'CS/S114-T02', series: SERIES, name: t('宇宙人との遭遇 みさえ＆ひまわり', '遭遇外星人 美冴＆小葵'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 500, soul: 1, triggers: [], traits: [T.movie, T.family, t('主婦', '主婦')],
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: selfStage({ name: N.puni, excludeSource: true }), amount: 1000, duration: 'whileActive' }],
        text: t('【永】他のあなたの「ぷにぷに拳 しんのすけ」すべてに、パワーを＋1000。', '【永】其他的你的「軟綿綿拳 小新」全部，攻擊力+1000。'),
      },
      concentrate,
    ],
    note: '「軟綿綿拳 小新」全部+1000。集中：付1能量並把她橫置，翻5張進休息室，每翻到1張名場面就抽1張。放後列使用。',
    status: pending,
  },
  {
    id: 'CS/S114-T03', series: SERIES, name: t('いざユメミーワールドへ！ しんのすけ', '前往夢見世界！ 小新'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: SHIN,
    abilities: [{
      kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
      cost: [{ kind: 'discard', selector: handDiscard() }],
      effects: [{ op: 'revealTopLevelRecover' }],
      text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札の上から1枚を公開し、自分の控え室のレベルＸ以下のキャラを1枚選び、手札に戻す。Ｘは公開されたカードのレベルに等しい。（CXのレベルは0として扱う。公開したカードは元に戻す）',
        '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你將自己的牌組上方1張公開，選擇自己休息室的等級X以下的角色1張，回到手牌。X等於公開的卡片的等級。(名場面視為等級0。公開的卡片放回原位)'),
    }],
    note: '登場時丟1張手牌：翻開牌組最上面1張看等級（看完放回），再從休息室撿回1張等級不超過它的角色。',
    status: pending,
  },
  {
    id: 'CS/S114-T04', series: SERIES, name: t(N.himawari, '公主 小葵'),
    type: 'character', color: 'red', level: 1, cost: 0, power: 5500, soul: 1, triggers: [], traits: [T.movie, T.family, t('宝石', '寶石')], abilities: [],
    note: '沒有效果，但是Lv1、費用0就有5500。搭配「寶藏獵人 小新」魂傷+1。',
    status: pending,
  },
  {
    id: 'CS/S114-T05', series: SERIES, name: t('ゲッチュー成功 ひろし', 'Get You成功 廣志'),
    type: 'character', color: 'red', level: 2, cost: 1, power: 4500, soul: 1, triggers: ['soul'], traits: [T.movie, T.family, t('サラリーマン', '上班族')],
    abilities: [{
      kind: 'auto', trigger: { event: 'attacks' },
      effects: [{ op: 'modifyPower', target: oneOfMine(movieFamily), amount: 6000, duration: 'thisTurn' }],
      text: t('【自】このカードがアタックした時、あなたは自分の、《MOVIE》か《家族》のキャラを1枚選び、そのターン中、パワーを＋6000。',
        '【自】此卡攻擊時，你選擇自己的《MOVIE》或《家族》的角色1張，在那個回合中，攻擊力+6000。'),
    }],
    note: '攻擊時選1張《MOVIE》或《家族》角色+6000，可以選他自己（變成10500），也可以給還沒攻擊的隊友。',
    status: pending,
  },
  {
    id: 'CS/S114-T06', series: SERIES, name: t('家族の絆 しんのすけ＆シロ', '家人的羈絆 小新＆小白'),
    type: 'character', color: 'red', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'], traits: SHIN,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        effects: [{ op: 'moveCards', from: { zone: 'clock', side: 'self', count: { exactly: 1 }, position: 'top' }, to: toWaitingRoom }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚を、控え室に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以將自己的傷害區上方1張，放到休息室。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.okaeri }, trigger: { event: 'attacks' }, optional: true,
        condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: N.okaeri }, { kind: 'countAtLeast', selector: selfStage({ ...movieFamily, excludeSource: true }), n: 2 }] },
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard() }],
        effects: [{ op: 'dealDamage', amount: 3, cancelable: true }],
        text: t('【自】【CXコンボ】［① 手札を1枚控え室に置く］このカードがアタックした時、CX置場に「おかえり しんのすけ！シロ！」があり、他のあなたの、《MOVIE》か《家族》のキャラが2枚以上なら、あなたはコストを払ってよい。そうしたら、相手に3ダメージを与える。（ダメージキャンセルは発生する）',
          '【自】【CX連動】［① 手牌1張放到休息室］此卡攻擊時，名場面區有「歡迎回家 小新！小白！」，其他的你的《MOVIE》或《家族》的角色存在2張以上的話，你可以支付代價。支付代價的話，給對手3點傷害。(會發生傷害取消)'),
      },
    ],
    note: '登場時回1血。連動名場面「歡迎回家 小新！小白！」：場上有其他2張以上《MOVIE》或《家族》角色時，攻擊時付1能量並丟1張，先給對手3點傷害（可能被取消），再進行攻擊。',
    status: pending,
  },
  {
    id: 'CS/S114-T07', series: SERIES, name: t('ヒーローVSハイグレ魔王', '英雄VS高衩魔王'),
    type: 'event', color: 'red', level: 2, cost: 1, triggers: [], traits: [],
    abilities: [{
      kind: 'event',
      effects: [
        { op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { type: 'character' }, count: { upTo: 2 } }, to: toHand },
        { op: 'moveCards', from: handDiscard(), to: toWaitingRoom },
      ],
      text: t('あなたは自分の控え室のキャラを2枚まで選び、手札に戻し、自分の手札を1枚選び、控え室に置く。', '你選擇自己休息室的角色最多2張，回到手牌，選擇自己的手牌1張，放到休息室。'),
    }],
    note: '從休息室撿回最多2張角色，再丟1張手牌。等於手牌+1，還能換成想要的角色。',
    status: pending,
  },
  {
    id: 'CS/S114-T08', series: SERIES, name: t(N.okaeri, '歡迎回家 小新！小白！'),
    type: 'climax', color: 'red', triggers: ['comeback'], traits: [],
    abilities: [climax(
      '【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【カムバック】：このカードがトリガーした時、あなたは自分の控え室のキャラを1枚選び、手札に戻してよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(木門：當你判定出此卡時，你可以選擇自己休息室的1張角色，回到手牌)',
    )],
    note: '在名場面階段從手牌打出，效果持續到這回合結束：全部角色攻擊力+1000、魂傷+1。連動：「家人的羈絆 小新＆小白」（Lv3）。判定翻到這張時：可以從休息室撿回1張角色。',
    status: pending,
  },
  {
    id: 'CS/S114-T09', series: SERIES, name: t('母の愛情', '母親的愛'),
    type: 'climax', color: 'red', triggers: ['soul', 'soul'], traits: [],
    abilities: [{
      kind: 'auto', trigger: { event: 'placedToClimaxZone' },
      effects: [
        { op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { type: 'character', hasTrigger: 'soul' }, count: { upTo: 1 } }, to: toHand },
        { op: 'modifySoul', target: { zone: 'stage', side: 'self', count: { upTo: 2 } }, amount: 1, duration: 'thisTurn' },
      ],
      text: t('【自】このカードが手札からCX置場に置かれた時、あなたは自分の控え室のトリガーアイコンに【ソウル】があるキャラを1枚まで選び、手札に戻し、自分のキャラを2枚まで選び、そのターン中、ソウルを＋1。',
        '【自】此卡從手牌被放置到名場面區時，你選擇自己休息室的判定標誌有魂傷的角色最多1張，回到手牌，選擇自己的角色最多2張，在那個回合中，魂傷+1。'),
    }],
    note: '打出時：從休息室撿回1張判定標誌有魂傷的角色（通常是Lv2、Lv3），再選2張角色這回合魂傷+1。這張沒有+1000攻擊力。',
    status: pending,
  },
  {
    id: 'CS/S114-T10', series: SERIES, name: t('忍術修行中！ ネネちゃん', '忍術修行中！ 妮妮'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: [T.movie, T.kinder, t('人形', '人偶')],
    abilities: [{
      kind: 'auto', trigger: { event: 'placedFromHandToStage' },
      effects: [{ op: 'modifyPower', target: self, amount: { per: selfStage(movieKinder), multiplier: 1000, evaluate: 'atResolution' }, duration: 'untilNextOpponentTurnEnd' }],
      text: t('【自】このカードが手札から舞台に置かれた時、次の相手のターンの終わりまで、このカードのパワーを＋Ｘ。Ｘはあなたの、《MOVIE》か《幼稚園》のキャラの枚数×1000に等しい。',
        '【自】此卡從手牌被放置到舞台時，到下次的對手回合結束前，此卡的攻擊力+X。X等於你的《MOVIE》或《幼稚園》的角色張數×1000。'),
    }],
    note: '登場時算場上《MOVIE》或《幼稚園》角色有幾張（含她自己），每張+1000，一直持續到對手回合結束。場上越多越強，Lv0也能有4000～6000。',
    status: pending,
  },
  {
    id: 'CS/S114-T11', series: SERIES, name: t('忍術修行中！ ボーちゃん', '忍術修行中！ 阿呆'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 1500, soul: 1, triggers: [], traits: [T.movie, T.kinder, t('謎', '謎')],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'lookTopReorder', n: 2 }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を上から2枚まで見て、山札の上に好きな順番で置く。', '【自】此卡從手牌被放置到舞台時，你從自己的牌組上方看最多2張，以喜歡的順序放回牌組上方。'),
        review: ['「2枚まで見て」：目前固定看 2 張。'],
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard({ type: 'climax' }) }],
        effects: [{ op: 'moveCards', from: fromWaiting({ type: 'climax' }), to: toHand }],
        text: t('【自】［① 手札のCXを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のCXを1枚選び、手札に戻す。',
          '【自】［① 手牌的名場面1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的名場面1張，回到手牌。'),
      },
    ],
    note: '登場時看牌組上方2張排順序。另外可以付1能量、丟1張名場面，從休息室換回想要的名場面（剛丟的那張也可以選）。',
    status: pending,
  },
  {
    id: 'CS/S114-T12', series: SERIES, name: t('世界を救え しんのすけ', '拯救世界 小新'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 2000, soul: 1, triggers: [], traits: SHIN,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'modifyPower', target: self, amount: 1500, duration: 'thisTurn' }],
        text: t('【自】このカードが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋1500。', '【自】此卡從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+1500。'),
      },
      {
        kind: 'auto', trigger: { event: 'battleOpponentReversed' },
        effects: [{ op: 'restAndMoveToBack', target: oneOfMine({ ...movieFamily, excludeSource: true }) }],
        text: t('【自】このカードのバトル相手が【リバース】した時、あなたは他の自分の、《MOVIE》か《家族》のキャラを1枚選び、【レスト】し、後列のキャラのいない枠に動かす。',
          '【自】此卡的戰鬥對手【倒置】時，你選擇其他的自己的《MOVIE》或《家族》的角色1張，【橫置】，移動到後列的沒有角色的格子。'),
      },
    ],
    note: '登場的回合是3500。打倒對手時，可以把另1張《MOVIE》或《家族》角色橫置撤到後列空格（後列要有空格），保護下回合會被打倒的隊友。',
    status: pending,
  },
  {
    id: 'CS/S114-T13', series: SERIES, name: t('忍術修行中！ 風間くん', '忍術修行中！ 風間'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 2000, soul: 1, triggers: [], traits: [T.movie, T.kinder, t('優等生', '優等生')],
    abilities: [{
      kind: 'auto', trigger: { event: 'sourceLeavesStageToWaitingRoom' }, optional: true,
      cost: [{ kind: 'stock', n: 2 }, { kind: 'discard', selector: handDiscard() }],
      effects: [{ op: 'lookTopPick', look: 6, pick: { filter: movieKinder, upTo: 2 }, rest: 'waitingRoom' }],
      text: t('【自】［② 手札を1枚控え室に置く］このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から6枚まで見て、《MOVIE》か《幼稚園》のキャラを2枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
        '【自】［② 手牌1張放到休息室］此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多6張，選擇《MOVIE》或《幼稚園》的角色最多2張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      review: ['「6枚まで見て」：目前固定看 6 張。'],
    }],
    note: '被打倒進休息室時（被擠掉也算），付2能量並丟1張，看6張拿最多2張角色。等於丟1拿2。',
    status: pending,
  },
  {
    id: 'CS/S114-T14', series: SERIES, name: t('世界を救え ぶりぶりざえもん', '拯救世界 肥嘟嘟左衛門'),
    type: 'character', color: 'blue', level: 1, cost: 0, power: 500, soul: 1, triggers: [], traits: [T.movie, t('動物', '動物'), t('ダークヒーロー', '暗黑英雄')],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard() }],
        effects: [{ op: 'lookTopPick', look: 5, pick: { filter: {}, upTo: 1 }, rest: 'waitingRoom', secret: true }],
        text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を上から5枚まで見て、カードを1枚まで選び、手札に加え、残りのカードを控え室に置く。',
          '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你從自己的牌組上方看最多5張，選擇卡片最多1張，加到手牌，剩下的卡片放到休息室。'),
        review: ['「5枚まで見て」：目前固定看 5 張。卡面沒寫「相手に見せ」，所以拿的卡不公開。'],
      },
      {
        kind: 'auto', trigger: { event: 'reversedInBattle' },
        effects: [{
          op: 'revealTopCheck', filter: { levelAtLeast: 2 }, matchTo: 'deckTop',
          ifMatch: [{ op: 'may', prompt: '要把這張角色放到能量區嗎', then: [{ op: 'moveCards', from: { ...self, count: { exactly: 1 } }, to: { zone: 'stock', side: 'self' } }] }],
        }],
        text: t('【自】このカードが【リバース】した時、あなたは自分の山札の上から1枚を公開する。そのカードのレベルが2以上なら、あなたはこのカードをストック置場に置いてよい。（CXのレベルは0として扱う。公開したカードは元に戻す）',
          '【自】此卡【倒置】時，你將自己的牌組上方1張公開。那張卡片的等級在2以上的話，你可以將此卡放到能量區。(名場面視為等級0。公開的卡片放回原位)'),
      },
    ],
    note: '攻擊力只有500，是用來找牌的。登場時付1能量丟1張，看5張拿1張想要的卡（什麼卡都可以）。被打倒時翻牌組最上面1張：Lv2以上就能把他放進能量區。',
    status: pending,
  },
  {
    id: 'CS/S114-T15', series: SERIES, name: t(N.puni, '軟綿綿拳 小新'),
    type: 'character', color: 'blue', level: 1, cost: 0, power: 4500, soul: 1, triggers: [], traits: SHIN,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'modifyPower', target: self, amount: { per: selfStage(movieFamily), multiplier: 500, evaluate: 'atResolution' }, duration: 'thisTurn' }],
        text: t('【自】このカードが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋Ｘ。Ｘはあなたの、《MOVIE》か《家族》のキャラの枚数×500に等しい。',
          '【自】此卡從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+X。X等於你的《MOVIE》或《家族》的角色張數×500。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.aiya }, trigger: { event: 'attacks' },
        condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: N.aiya }, { kind: 'countAtLeast', selector: selfStage({ ...movieFamily, excludeSource: true }), n: 1 }] },
        effects: [{
          op: 'grantAbility', target: oneOfMine(), duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: { event: 'battleOpponentReversed' },
            effects: [{ op: 'searchDeck', filter: movieFamily, upTo: 1, reveal: true, shuffle: true }],
            text: t('【自】このカードのバトル相手が【リバース】した時、あなたは自分の山札を見て《MOVIE》か《家族》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
              '【自】此卡的戰鬥對手【倒置】時，你從自己的牌組選擇《MOVIE》或《家族》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
          },
        }],
        text: t('【自】【CXコンボ】このカードがアタックした時、CX置場に「アイヤータウンを守れ！」があり、他のあなたの、《MOVIE》か《家族》のキャラがいるなら、あなたは自分のキャラを1枚選び、そのターン中、次の能力を与える。『【自】このカードのバトル相手が【リバース】した時、あなたは自分の山札を見て《MOVIE》か《家族》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。』',
          '【自】【CX連動】此卡攻擊時，名場面區有「守護阿依亞鎮！」，有其他的你的《MOVIE》或《家族》的角色存在的話，你選擇自己的角色1張，在那個回合中，給予以下能力。『【自】此卡的戰鬥對手【倒置】時，你從自己的牌組選擇《MOVIE》或《家族》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。』'),
      },
    ],
    note: '登場時算場上《MOVIE》或《家族》角色有幾張（含他自己），每張+500。連動名場面「守護阿依亞鎮！」：攻擊時選1張角色（通常選他自己），這回合它打倒對手就能從牌組找1張角色。後列放「遭遇外星人 美冴＆小葵」還能再+1000。',
    status: pending,
  },
  {
    id: 'CS/S114-T16', series: SERIES, name: t('忍術修行中！ マサオくん', '忍術修行中！ 正男'),
    type: 'character', color: 'blue', level: 1, cost: 1, power: 500, soul: 1, triggers: ['soul'], traits: [T.movie, T.kinder, t('泣き虫', '愛哭鬼')],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'usedBackup' },
        effects: [{ op: 'lookTopPlace', dest: 'waitingRoom' }],
        text: t('【自】あなたがこのカードの『助太刀』を使った時、あなたは自分の山札を上から1枚見て、山札の上か控え室に置く。', '【自】當你使用此卡的『助太刀』時，你看自己的牌組上方1張，放到牌組上方或休息室。'),
      },
      {
        kind: 'activated', keyword: { id: 'backup', power: 2000, level: 1 }, timing: 'counter',
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discardSource' }],
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'inBattleWithSource' }, amount: 2000, duration: 'thisTurn' }],
        text: t('【起】【カウンター】助太刀2000 レベル1［① 手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋2000）',
          '【起】【反擊】助太刀2000 等級1［① 手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+2000)'),
      },
    ],
    note: '防守卡：對手正打你的角色時，付1能量從手牌丟出，被打的角色+2000。使用時還能看牌組最上面1張，不要的（例如名場面要留給對手的傷害判定時）可以丟進休息室。',
    status: pending,
  },
  {
    id: 'CS/S114-T17', series: SERIES, name: t('忍術修行中！ しんのすけ', '忍術修行中！ 小新'),
    type: 'character', color: 'blue', level: 2, cost: 1, power: 2000, soul: 1, triggers: ['soul'], traits: SHIN,
    abilities: [
      {
        kind: 'continuous', keyword: { id: 'assist' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'frontOfSource' }, amount: { perLevelOfTarget: true, multiplier: 500 }, duration: 'whileActive' }],
        text: t('【永】応援 このカードの前のあなたのキャラすべてに、パワーを＋Ｘ。Ｘはそのキャラのレベル×500に等しい。', '【永】應援 此卡前面的你的角色全部，攻擊力+X。X等於那張角色的等級×500。'),
      },
      {
        kind: 'activated',
        cost: [
          { kind: 'discard', selector: handDiscard(movieFamily, 2) },
          { kind: 'rest', selector: { zone: 'stage', side: 'self', state: 'stand', count: { exactly: 2 } } },
        ],
        effects: [{ op: 'moveCards', from: { zone: 'hand', side: 'self', filter: { name: N.henshin }, count: { upTo: 1 } }, to: { zone: 'stage', side: 'self', slot: 'any' } }],
        text: t('【起】［手札の、《MOVIE》か《家族》のキャラを2枚控え室に置き、あなたのキャラを2枚【レスト】する］あなたは自分の手札の「アクション仮面変身セット しんのすけ」を1枚まで選び、舞台の好きな枠に置く。',
          '【起】［手牌的《MOVIE》或《家族》的角色2張放到休息室，並將你的角色2張【橫置】］你選擇自己手牌的「動感超人變身組 小新」最多1張，放到舞台上喜歡的格子。'),
        review: ['「舞台の好きな枠に置く」：可以放到有角色的格子，原本的角色會進休息室。用這個效果放上去也算「從手牌被放置到舞台」，Lv3 小新的登場效果會發動。不用滿足等級、費用條件。'],
      },
    ],
    note: '放後列：斜前方2格的角色加「等級×500」。【起】：丟2張《MOVIE》或《家族》角色、橫置2張自己的角色，把手牌的「動感超人變身組 小新」（Lv3）直接放上舞台，不用管等級、不用付費。',
    status: pending,
  },
  {
    id: 'CS/S114-T18', series: SERIES, name: t('ナナとの触れ合い しんのすけ', '與娜娜的互動 小新'),
    type: 'character', color: 'blue', level: 2, cost: 1, power: 5000, soul: 2, triggers: ['soul'], traits: SHIN,
    abilities: [{
      kind: 'continuous',
      effects: [{
        op: 'modifyPower', target: self,
        amount: { per: { zone: 'stage', side: 'self', filter: { ...movieFamily, row: 'back', excludeSource: true }, count: 'all' }, multiplier: 2500, evaluate: 'live' },
        duration: 'whileActive',
      }],
      text: t('【永】他のあなたの後列の、《MOVIE》か《家族》のキャラ1枚につき、このカードのパワーを＋2500。', '【永】其他的你的後列的《MOVIE》或《家族》的角色每有1張，此卡的攻擊力+2500。'),
    }],
    note: '後列兩格都是《MOVIE》或《家族》角色的話，她會變成10000，而且魂傷2。',
    status: pending,
  },
  {
    id: 'CS/S114-T19', series: SERIES, name: t(N.henshin, '動感超人變身組 小新'),
    type: 'character', color: 'blue', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'], traits: SHIN,
    abilities: [{
      kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
      effects: [{ op: 'dealDamage', amount: 1, cancelable: true }],
      text: t('【自】このカードが手札から舞台に置かれた時、あなたは相手に1ダメージを与えてよい。（ダメージキャンセルは発生する）', '【自】此卡從手牌被放置到舞台時，你可以給對手1點傷害。(會發生傷害取消)'),
    }],
    note: '登場時給對手1點傷害（可能被取消）。也可以用「忍術修行中！ 小新」的【起】直接放上舞台。',
    status: pending,
  },
  {
    id: 'CS/S114-T20', series: SERIES, name: t(N.aiya, '守護阿依亞鎮！'),
    type: 'climax', color: 'blue', triggers: ['soul', 'gate'], traits: [],
    abilities: [climax(
      '【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【ゲート】：このカードがトリガーした時、あなたは自分の控え室のCXを1枚選び、手札に戻してよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(門：當你判定出此卡時，你可以選擇自己休息室的1張名場面，回到手牌)',
    )],
    note: '在名場面階段從手牌打出，效果持續到這回合結束：全部角色攻擊力+1000、魂傷+1。連動：「軟綿綿拳 小新」（Lv1）。判定翻到這張時：魂傷+1，還可以從休息室撿回1張名場面。',
    status: pending,
  },
];

// 預組內容（張數取自檔名；與 data/decks/CS-S114.csv 一致）
export const deck = ([
  ['T01', 2], ['T02', 4], ['T03', 2], ['T04', 4], ['T05', 4], ['T06', 2], ['T07', 2], ['T08', 2], ['T09', 2], ['T10', 2],
  ['T11', 2], ['T12', 2], ['T13', 2], ['T14', 2], ['T15', 4], ['T16', 2], ['T17', 2], ['T18', 2], ['T19', 2], ['T20', 4],
] as const).map(([n, c]) => ({ cardId: `CS/S114-${n}`, count: c as number }));

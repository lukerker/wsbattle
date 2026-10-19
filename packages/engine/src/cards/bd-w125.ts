// Ave Mujica 預組 BD/W125（19 種、50 張）。
// 日文原文由卡面圖放大後讀出（尚未經使用者核對）；中文與白話說明取自使用者整理的《Ave Mujica 預組卡表》，
// 其中 “Pedere Omnia” 依卡面改為 “Perdere Omnia”。
import type { Ability, Card, CardFilter, Selector, Text } from '../card-schema.ts';

const SERIES = 'BD';
const t = (ja: string, zh: string): Text => ({ ja, zh });
const music: CardFilter = { trait: '音楽' };

const N = {
  qlMortis: '“Quaerere Lumina”モーティス',
  qlOblivionis: '“Quaerere Lumina”オブリビオニス',
  qlAmoris: '“Quaerere Lumina”アモーリス',
  qlDoloris: '“Quaerere Lumina”ドロリス',
  qlTimoris: '“Quaerere Lumina”ティモリス',
  poOblivionis: '“Perdere Omnia”オブリビオニス',
  poMortis: '“Perdere Omnia”モーティス',
  poTimoris: '“Perdere Omnia”ティモリス',
  poAmoris: '“Perdere Omnia”アモーリス',
  poDoloris: '“Perdere Omnia”ドロリス',
  vMortis: '“Veritas”モーティス',
  vOblivionis: '“Veritas”オブリビオニス',
  vAmoris: '“Veritas”アモーリス',
  vDoloris: '“Veritas”ドロリス',
  vTimoris: '“Veritas”ティモリス',
};

const TRAIT_MUSIC = t('音楽', '音樂');
const TRAIT_AM = t('Ave Mujica', 'Ave Mujica');

const source: Selector = { zone: 'stage', side: 'self', count: 'all', relation: 'source' };
const otherMusic: Selector = { zone: 'stage', side: 'self', filter: { trait: '音楽', excludeSource: true }, count: 'all' };
const handDiscard = (filter?: CardFilter): Selector => ({ zone: 'hand', side: 'self', filter, count: { exactly: 1 } });
const toWaitingRoom = { zone: 'waitingRoom' as const, side: 'self' as const };
const toHand = { zone: 'hand' as const, side: 'self' as const };
const toStock = { zone: 'stock' as const, side: 'self' as const };

const encoreAbility = (discard: Selector, ja: string, zh: string): Ability => ({
  kind: 'auto',
  keyword: { id: 'encore' },
  trigger: { event: 'sourceLeavesStageToWaitingRoom' },
  optional: true,
  cost: [{ kind: 'discard', selector: discard }],
  effects: [{ op: 'returnSourceToSlot', state: 'rest' }],
  text: t(ja, zh),
});

const concentrate = (ja: string, zh: string): Ability => ({
  kind: 'activated',
  keyword: { id: 'concentrate' },
  cost: [{ kind: 'stock', n: 1 }, { kind: 'restSource' }],
  effects: [
    { op: 'moveCards', from: { zone: 'deck', side: 'self', count: { exactly: 5 }, fromTop: 5 }, to: toWaitingRoom, bind: 'milled' },
    { op: 'draw', upTo: { countOfBound: 'milled', filter: { type: 'climax' } } },
  ],
  text: t(ja, zh),
});

const pending = { translated: true, coded: true, verified: false, tested: true }; // 情境測試：game/cards-*.test.ts

export const cards: Card[] = [
  {
    id: 'BD/W125-T01', series: SERIES, name: t(N.qlMortis, '“Quaerere Lumina” Mortis'),
    type: 'character', color: 'green', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'myTurn' },
        effects: [{ op: 'modifyPower', target: source, amount: 3000, duration: 'whileActive' }],
        text: t('【永】あなたのターン中、このカードのパワーを＋3000。', '【永】在你的回合中，此卡的攻擊力+3000。'),
      },
      {
        kind: 'auto', trigger: { event: 'encoreStepStart', side: 'self' }, optional: true,
        condition: { kind: 'noOthers', selector: { zone: 'stage', side: 'self', filter: { row: 'front', excludeSource: true }, state: 'rest', count: 'all' } },
        cost: [{ kind: 'stock', n: 1 }],
        effects: [{ op: 'restSource' }],
        text: t('【自】［①］アンコールステップの始めに、他のあなたの前列の【横】しているキャラがいないなら、あなたはコストを払ってよい。そうしたら、このカードを【横】する。',
          '【自】［①］在安可階段開始時，沒有其他的你的前列的【橫置】的角色存在的話，你可以支付代價。支付代價的話，將此卡【橫置】。'),
        review: ['卡面第一個圖示（「前列の○○しているキャラ」）放大後與第二個「【横】する」的圖示看起來相同，我讀成「橫置」；你的卡表也是橫置。請對照實物確認是否為「正置」。'],
      },
    ],
    note: '自己回合她是4000，是Lv0的主力打手。效果2的觸發時機在安可階段開始時。日文原文是用圖示表示卡片狀態，翻譯可能不準，實際用法建議查官方QA。',
    status: pending,
  },
  {
    id: 'BD/W125-T02', series: SERIES, name: t(N.poOblivionis, '“Perdere Omnia” Oblivionis'),
    type: 'character', color: 'green', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard({ type: 'climax' }) }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { type: 'climax' }, count: { exactly: 1 } }, to: toHand }],
        text: t('【自】［① 手札のCXを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のCXを1枚選び、手札に戻す。',
          '【自】［① 手牌的名場面1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的名場面1張，回到手牌。'),
      },
      {
        kind: 'auto', trigger: { event: 'reversedInBattle' }, optional: true,
        condition: { kind: 'battleOpponentLevelAtMost', n: 0 },
        effects: [
          { op: 'moveCards', from: { zone: 'clock', side: 'opponent', count: { exactly: 1 }, position: 'top' }, to: { zone: 'waitingRoom', side: 'opponent' } },
          { op: 'moveCards', from: { zone: 'stage', side: 'opponent', count: { exactly: 1 }, relation: 'battleOpponentOfSource' }, to: { zone: 'clock', side: 'opponent' } },
        ],
        text: t('【自】このカードが【リバース】した時、このカードのバトル相手のレベルが0以下なら、あなたは相手のクロックの上から1枚を、控え室に置いてよい。そうしたら、あなたはそのキャラをクロック置場に置く。',
          '【自】此卡【倒置】時，此卡的戰鬥對手的等級是0以下的話，你可以將對手的傷害區上方1張，放到休息室。然後，你將那張角色放到傷害區。'),
        review: ['「這個戰鬥對手放到傷害區」是放進對手的傷害區（你的卡表註解與此一致）；牌面沒有寫明是誰的傷害區，請確認。'],
      },
    ],
    note: '效果1：登場時換CX。丟掉手上的CX，從休息室撿回現在需要的那張，例如要拿來連動的CX。效果2：她被Lv0角色打倒時，對手傷害區1張進休息室，再把打倒她的角色放進對手的傷害區。對手的傷害總數不變，但打倒她的角色會從場上消失。',
    status: pending,
  },
  {
    id: 'BD/W125-T03', series: SERIES, name: t(N.poMortis, '“Perdere Omnia” Mortis'),
    type: 'character', color: 'green', level: 1, cost: 0, power: 4000, soul: 1, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'modifyPower', target: source, amount: 3000, duration: 'thisTurn' }],
        text: t('【自】このカードが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋3000。', '【自】此卡從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+3000。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: "Choir 'S' Choir" }, trigger: { event: 'battleOpponentReversed' },
        condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: "Choir 'S' Choir" }, { kind: 'countAtLeast', selector: otherMusic, n: 2 }] },
        effects: [
          { op: 'searchDeck', filter: music, upTo: 1, reveal: true, shuffle: true },
          { op: 'modifyPower', target: { zone: 'stage', side: 'self', count: { exactly: 1 } }, amount: 2000, duration: 'thisTurn' },
        ],
        text: t("【自】【CXコンボ】このカードのバトル相手が【リバース】した時、あなたのCX置場に「Choir 'S' Choir」があり、他のあなたの《音楽》のキャラが2枚以上なら、あなたは自分の山札を見て《音楽》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルし、自分のキャラを1枚選び、そのターン中、パワーを＋2000。",
          "【自】【CX連動】此卡的戰鬥對手【倒置】時，你的名場面區有「Choir 'S' Choir」，其他的你的《音樂》的角色存在2張以上的話，你從自己的牌組選擇《音樂》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌，選擇自己的角色1張，在那個回合中，攻擊力+2000。"),
      },
    ],
    note: "登場那回合她是7000，費用0。連動CX「Choir 'S' Choir」：打倒對手後，從牌組選1張《音樂》角色加入手牌，再讓1張角色+2000。+2000建議給還沒攻擊的隊友。",
    status: pending,
  },
  {
    id: 'BD/W125-T04', series: SERIES, name: t(N.qlOblivionis, '“Quaerere Lumina” Oblivionis'),
    type: 'character', color: 'green', level: 1, cost: 1, power: 6000, soul: 1, triggers: ['soul'], traits: [TRAIT_MUSIC, TRAIT_AM], abilities: [],
    note: '沒有效果的角色，但是Lv1就有6000。搭配後列的「“Quaerere Lumina” Doloris」，會變成7500，被打倒時還能安可回場。',
    status: pending,
  },
  {
    id: 'BD/W125-T05', series: SERIES, name: t(N.vMortis, '“Veritas” Mortis'),
    type: 'character', color: 'green', level: 2, cost: 1, power: 6000, soul: 1, triggers: ['soul'], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: source, amount: { per: otherMusic, multiplier: 1000, evaluate: 'live' }, duration: 'whileActive' }],
        text: t('【永】他のあなたの《音楽》のキャラ1枚につき、このカードのパワーを＋1000。', '【永】其他的你的《音樂》的角色每有1張，此卡的攻擊力+1000。'),
      },
      {
        kind: 'auto', trigger: { event: 'battleOpponentReversed' },
        effects: [
          { op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: music, count: { exactly: 1 } }, to: toHand },
          { op: 'moveCards', from: handDiscard(), to: toWaitingRoom },
        ],
        text: t('【自】このカードのバトル相手が【リバース】した時、あなたは自分の控え室の《音楽》のキャラを1枚選び、手札に戻し、自分の手札を1枚選び、控え室に置く。',
          '【自】此卡的戰鬥對手【倒置】時，你選擇自己休息室的《音樂》的角色1張，回到手牌，選擇自己的手牌1張，放到休息室。'),
      },
    ],
    note: '場上其他4張都是《音樂》的話，她是10000，自己和對手的回合都有效。打倒對手時，從休息室撿1張《音樂》角色，再丟1張手牌（換牌）。',
    status: pending,
  },
  {
    id: 'BD/W125-T06', series: SERIES, name: t(N.vOblivionis, '“Veritas” Oblivionis'),
    type: 'character', color: 'green', level: 3, cost: 2, power: 9500, soul: 2, triggers: ['soul'], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: music, count: { exactly: 1 } }, amount: 1500, duration: 'thisTurn' }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋1500。', '【自】此卡從手牌被放置到舞台時，你選擇自己的《音樂》的角色1張，在那個回合中，攻擊力+1500。'),
      },
      {
        kind: 'auto', trigger: { event: 'encoreStepStart', side: 'self' }, optional: true,
        condition: { kind: 'all', of: [{ kind: 'placedThisTurnFromHand' }, { kind: 'countAtLeast', selector: otherMusic, n: 1 }] },
        cost: [{ kind: 'stock', n: 2 }],
        effects: [{ op: 'dealDamage', amount: 2, cancelable: true }],
        text: t('【自】［②］このカードが手札から舞台に置かれたターン中、あなたのアンコールステップの始めに、他のあなたの《音楽》のキャラがいるなら、あなたはコストを払ってよい。そうしたら、相手に2ダメージを与える。（ダメージキャンセルは発生する）',
          '【自】［②］此卡從手牌被放置到舞台的回合中，在你的安可階段開始時，有其他的你的《音樂》的角色存在的話，你可以支付代價。支付代價的話，給對手2點傷害。(會發生傷害取消)'),
      },
    ],
    note: '登場時選1張角色+1500，也可以選她自己（變成11000）。登場那回合所有攻擊結束後，付2能量再給對手2點傷害（可能被取消），適合終盤收尾。',
    status: pending,
  },
  {
    id: 'BD/W125-T07', series: SERIES, name: t("Choir 'S' Choir", "Choir 'S' Choir"),
    type: 'climax', color: 'green', triggers: ['treasure'], traits: [],
    abilities: [{
      kind: 'continuous',
      effects: [
        { op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all' }, amount: 1000, duration: 'whileActive' },
        { op: 'modifySoul', target: { zone: 'stage', side: 'self', count: 'all' }, amount: 1, duration: 'whileActive' },
      ],
      text: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。', '【永】你的角色全部，攻擊力+1000，魂傷+1。'),
    }],
    note: "在高潮階段從手牌打出，效果持續到這回合結束。連動：「“Perdere Omnia” Mortis」。綠色CX：等級區或傷害區要有綠色卡才能打出。判定翻到這張時：這張CX回到你的手牌，還可以+1能量。",
    status: pending,
  },
  {
    id: 'BD/W125-T08', series: SERIES, name: t(N.qlAmoris, '“Quaerere Lumina” Amoris'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 500, soul: 1, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'activated', cost: [{ kind: 'sendSourceToWaitingRoom' }],
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: music, count: { exactly: 1 } }, amount: 2000, duration: 'thisTurn' }],
        text: t('【起】［このカードを控え室に置く］あなたは自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋2000。', '【起】［將此卡放到休息室］你選擇自己的《音樂》的角色1張，在那個回合中，攻擊力+2000。'),
      },
      concentrate('【起】集中［① このカードを【横】する］あなたは自分の山札の上から5枚をめくり、控え室に置く。それらのカードのCX1枚につき、あなたは1枚まで引く。',
        '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻出5張，放到休息室。那些卡片中每有1張名場面，你抽最多1張牌。'),
    ],
    note: '放後列使用。效果1：把她自己送進休息室，讓1張《音樂》角色這回合+2000，適合在差一點就能打倒對手時用。集中：付1能量並把她橫置，翻5張，每1張CX抽1張。',
    status: pending,
  },
  {
    id: 'BD/W125-T09', series: SERIES, name: t(N.qlDoloris, '“Quaerere Lumina” Doloris'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'continuous',
        effects: [
          { op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: { name: N.qlOblivionis, excludeSource: true }, count: 'all' }, amount: 1500, duration: 'whileActive' },
          {
            op: 'grantAbility', duration: 'whileActive',
            target: { zone: 'stage', side: 'self', filter: { name: N.qlOblivionis, excludeSource: true }, count: 'all' },
            ability: encoreAbility(handDiscard({ type: 'character' }), '【自】アンコール［手札のキャラを1枚控え室に置く］', '【自】安可［手牌的角色1張放到休息室］'),
          },
        ],
        text: t('【永】他のあなたの「“Quaerere Lumina”オブリビオニス」すべてに、パワーを＋1500し、「【自】アンコール［手札のキャラを1枚控え室に置く］」を与える。',
          '【永】其他的你的「“Quaerere Lumina” Oblivionis」全部，攻擊力+1500，給予『【自】安可［手牌的角色1張放到休息室］』。'),
      },
      {
        kind: 'auto', keyword: { id: 'bond', targetName: N.qlOblivionis }, trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard() }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { name: N.qlOblivionis }, count: { exactly: 1 } }, to: toHand }],
        text: t('【自】絆／「“Quaerere Lumina”オブリビオニス」［手札を1枚控え室に置く］（このカードがプレイされて舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「“Quaerere Lumina”オブリビオニス」を1枚選び、手札に戻す）',
          '【自】絆／「“Quaerere Lumina” Oblivionis」［手牌1張放到休息室］(此卡被使用被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「“Quaerere Lumina” Oblivionis」1張，回到手牌)'),
      },
    ],
    note: '專門搭配「“Quaerere Lumina” Oblivionis」（Lv1 攻擊6000）。Doloris放後列，Oblivionis會變成7500。安可：Oblivionis被打倒時，丟1張手牌角色，就能以橫置狀態回到原本的格子。絆：Doloris從手牌登場時丟1張手牌，就能從休息室撿回Oblivionis。',
    status: pending,
  },
  {
    id: 'BD/W125-T10', series: SERIES, name: t(N.vDoloris, '“Veritas” Doloris'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1500, soul: 1, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'stockAtMost', n: 3 },
        effects: [{ op: 'modifyPower', target: source, amount: 1000, duration: 'whileActive' }],
        text: t('【永】あなたのストックが3枚以下なら、このカードのパワーを＋1000。', '【永】你的能量在3張以下的話，此卡的攻擊力+1000。'),
      },
      {
        kind: 'auto', trigger: { event: 'opponentAttackPhaseStart' }, optional: true,
        effects: [{ op: 'moveSourceToSlot', row: 'front', emptyOnly: true }],
        text: t('【自】相手のアタックフェイズの始めに、あなたはこのカードを前列のキャラのいない枠に動かしてよい。', '【自】在對手的攻擊階段開始時，你可以將此卡移動到前列的沒有角色的格子。'),
      },
    ],
    note: '能量在3張以下時，她是2500。效果2：前列有空格時，把她移過去補位，避免對手直接攻擊（魂傷+1）。她在後列時也能用。',
    status: pending,
  },
  {
    id: 'BD/W125-T11', series: SERIES, name: t(N.poTimoris, '“Perdere Omnia” Timoris'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1500, soul: 1, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: otherMusic, amount: 500, duration: 'whileActive' }],
        text: t('【永】他のあなたの《音楽》のキャラすべてに、パワーを＋500。', '【永】其他的你的《音樂》的角色全部，攻擊力+500。'),
      },
      {
        kind: 'activated', optional: true,
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard() }, { kind: 'restSource' }],
        effects: [{ op: 'searchDeck', filter: { type: 'character', trait: '音楽' }, upTo: 1, reveal: true, shuffle: true }],
        text: t('【起】［① 手札を1枚控え室に置き、このカードを【横】する］あなたは自分の山札を見て《音楽》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
          '【起】［① 手牌1張放到休息室，將此卡【橫置】］你從自己的牌組選擇《音樂》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
      },
    ],
    note: '放後列的輔助角色：場上其他《音樂》角色全部+500。付1能量、丟1張手牌、把她橫置，就能從牌組直接選1張《音樂》角色。她橫置後，+500的效果還是有效。',
    status: pending,
  },
  {
    id: 'BD/W125-T12', series: SERIES, name: t(N.vAmoris, '“Veritas” Amoris'),
    type: 'character', color: 'red', level: 1, cost: 0, power: 3500, soul: 1, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'myTurn' },
        effects: [{ op: 'modifyPower', target: source, amount: 1000, duration: 'whileActive' }],
        text: t('【永】あなたのターン中、このカードのパワーを＋1000。', '【永】在你的回合中，此卡的攻擊力+1000。'),
      },
      {
        kind: 'auto', trigger: { event: 'damageNotCancelledInBattle' }, optional: true,
        effects: [{ op: 'moveCards', from: { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'source' }, to: toStock }],
        text: t('【自】このカードのバトル中、あなたの受けたダメージがキャンセルされなかった時、あなたはこのカードをストック置場に置いてよい。', '【自】在此卡的戰鬥中，你所受到的傷害沒有被取消時，你可以將此卡放到能量區。'),
      },
    ],
    note: '自己回合她是4500。效果2：對手打她、你受到傷害時，把她送進能量區，+1能量。因為受到傷害的時間點比雙方比攻擊力還早，所以對手打不倒她，對手「打倒時」的效果也不會發動。注意格子會變空。',
    status: pending,
  },
  {
    id: 'BD/W125-T13', series: SERIES, name: t(N.poAmoris, '“Perdere Omnia” Amoris'),
    type: 'character', color: 'red', level: 2, cost: 1, power: 2500, soul: 1, triggers: ['soul'], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'continuous', keyword: { id: 'assist' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'frontOfSource' }, amount: { perLevelOfTarget: true, multiplier: 500 }, duration: 'whileActive' }],
        text: t('【永】応援 このカードの前のあなたのキャラすべてに、パワーを＋X。Xはそのキャラのレベル×500に等しい。', '【永】應援 此卡前面的你的角色全部，攻擊力+X。X等於那張角色的等級×500。'),
      },
      {
        kind: 'auto', trigger: { event: 'myClimaxPhaseStart' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: music, count: { upTo: 2 } }, amount: 1500, duration: 'thisTurn' }],
        text: t('【自】あなたのCXフェイズの始めに、あなたは自分の《音楽》のキャラを2枚まで選び、そのターン中、パワーを＋1500。', '【自】在你的CX階段開始時，你選擇自己的《音樂》的角色最多2張，在那個回合中，攻擊力+1500。'),
      },
    ],
    note: '放後列：她斜前方2格的角色依等級加攻，Lv3角色+1500，Lv0角色則不加。效果2：每回合到「CX階段（高潮階段）」開始時，自動選2張《音樂》角色+1500，不用打出CX。',
    status: pending,
  },
  {
    id: 'BD/W125-T14', series: SERIES, name: t(N.vTimoris, '“Veritas” Timoris'),
    type: 'character', color: 'red', level: 2, cost: 1, power: 2500, soul: 1, triggers: ['soul'], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'usedBackup' },
        effects: [{
          op: 'grantAbility', duration: 'thisTurn',
          target: { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'inBattleWithSource' },
          ability: {
            kind: 'auto', trigger: { event: 'battleOpponentReversed' },
            effects: [{ op: 'sendToMemory', from: { zone: 'stage', side: 'opponent', count: { exactly: 1 }, relation: 'battleOpponentOfSource' } }],
            text: t('【自】このカードのバトル相手が【リバース】した時、あなたはそのキャラを思い出にする。', '【自】此卡的戰鬥對手【倒置】時，你將那張角色放到回憶區。'),
          },
        }],
        text: t('【自】あなたがこのカードの「助太刀」を使った時、あなたは自分のバトル中のキャラを1枚選び、そのターン中、次の能力を与える。「【自】このカードのバトル相手が【リバース】した時、あなたはそのキャラを思い出にする。」',
          '【自】當你使用此卡的『助太刀』時，你選擇自己的戰鬥中的角色1張，在那個回合中，給予以下能力。『【自】此卡的戰鬥對手【倒置】時，你將那張角色放到回憶區。』'),
      },
      {
        kind: 'activated', keyword: { id: 'backup', power: 3000, level: 2 }, timing: 'counter',
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discardSource' }],
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'inBattleWithSource' }, amount: 3000, duration: 'thisTurn' }],
        text: t('【起】【カウンター】助太刀3000 レベル2［① 手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋3000）',
          '【起】【反擊】助太刀3000 等級2［① 手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+3000)'),
      },
    ],
    note: '防守卡：對手正打時，付1能量從手牌丟出，被打的角色+3000。你自己的等級要達到2才能用。如果因此反過來打倒對手的角色，那張角色會被送進回憶區。回憶區等於移出遊戲，對手不能安可，也撿不回來。',
    status: pending,
  },
  {
    id: 'BD/W125-T15', series: SERIES, name: t(N.qlTimoris, '“Quaerere Lumina” Timoris'),
    type: 'character', color: 'red', level: 2, cost: 1, power: 5000, soul: 2, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'modifyPower', target: source, amount: 6000, duration: 'thisTurn' }],
        text: t('【自】このカードが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋6000。', '【自】此卡從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+6000。'),
      },
      {
        kind: 'auto', trigger: { event: 'battleOpponentReversed' }, optional: true,
        condition: { kind: 'placedThisTurnFromHand' },
        cost: [{ kind: 'rest', selector: { zone: 'stage', side: 'self', filter: { trait: '音楽', excludeSource: true }, state: 'stand', count: { exactly: 1 } } }],
        effects: [{ op: 'moveCards', from: { zone: 'deck', side: 'self', count: { exactly: 1 }, fromTop: 1 }, to: toStock }],
        text: t('【自】［他のあなたの【縦】している《音楽》のキャラを1枚【横】する］このカードが手札から舞台に置かれたターン中、このカードのバトル相手が【リバース】した時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札の上から1枚を、ストック置場に置く。',
          '【自】［將其他的你的【正置】狀態的《音樂》的角色1張【橫置】］此卡從手牌被放置到舞台的回合中，此卡的戰鬥對手【倒置】時，你可以支付代價。支付代價的話，你將自己的牌組上方1張，放到能量區。'),
      },
    ],
    note: '登場那回合她是11000、魂傷2，是很強的Lv2打手。效果2的代價要橫置1張還站著的《音樂》角色。用後列角色當代價最划算，因為後列本來就不攻擊。',
    status: pending,
  },
  {
    id: 'BD/W125-T16', series: SERIES, name: t(N.poDoloris, '“Perdere Omnia” Doloris'),
    type: 'character', color: 'red', level: 3, cost: 2, power: 9500, soul: 2, triggers: [], traits: [TRAIT_MUSIC, TRAIT_AM],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [
          { op: 'moveCards', from: { zone: 'clock', side: 'self', count: { upTo: 1 }, position: 'top' }, to: toWaitingRoom },
          {
            op: 'payThen', cost: [{ kind: 'stock', n: 1 }],
            then: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'opponent', filter: { type: 'character' }, count: { exactly: 1 } }, to: { zone: 'stage', side: 'opponent', slot: 'empty' } }],
          },
        ],
        text: t('【自】［①］このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚までを、控え室に置き、あなたはコストを払ってよい。コストを払ったなら、あなたは相手の控え室のキャラを1枚選び、舞台のキャラのいない枠に置く。',
          '【自】［①］此卡從手牌被放置到舞台時，你將自己的傷害區上方最多1張，放到休息室，你可以支付代價。支付代價的話，你選擇對手的休息室的角色1張，放到舞台上沒有角色的格子。'),
        review: [
          '這個能力是「先無條件把傷害區上方至多1張放到休息室，再選擇付①」，我用 payThen 表達；請確認回血本身是否不需要付費（卡面 ① 寫在能力最前面，但「あなたはコストを払ってよい」在回血之後）。',
          '「舞台のキャラのいない枠に置く」：卡面沒寫是誰的舞台；依規則，從對手休息室出來的卡會放到對手的舞台。你卡表的白話說明也是「對手的空格」。請確認。',
        ],
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: '黒のバースデイ' }, trigger: { event: 'battleOpponentReversed' }, optional: true,
        condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: '黒のバースデイ' }, { kind: 'countAtLeast', selector: otherMusic, n: 2 }] },
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard() }],
        effects: [
          { op: 'dealDamage', amount: 1, cancelable: true },
          { op: 'moveCards', from: { zone: 'stage', side: 'opponent', count: { exactly: 1 }, relation: 'battleOpponentOfSource' }, to: { zone: 'clock', side: 'opponent' } },
        ],
        text: t('【自】【CXコンボ】［① 手札を1枚控え室に置く］このカードのバトル相手が【リバース】した時、あなたのCX置場に「黒のバースデイ」があり、他のあなたの《音楽》のキャラが2枚以上なら、あなたはコストを払ってよい。そうしたら、相手に1ダメージを与え、あなたはそのバトル相手をクロック置場に置く。（ダメージキャンセルは発生する）',
          '【自】【CX連動】［① 手牌1張放到休息室］此卡的戰鬥對手【倒置】時，你的名場面區有「黑色生日」，其他的你的《音樂》的角色存在2張以上的話，你可以支付代價。支付代價的話，給對手1點傷害，你將那張戰鬥對手放到傷害區。(會發生傷害取消)'),
        review: ['「黑色生日」的日文是「黒のバースデイ」，中文譯名請確認是否要統一為「黑色生日」。'],
      },
    ],
    note: '登場時免費回1血。再付1能量，可以把對手休息室1張角色放到對手的空格，讓你有可以打倒的對象，用來觸發連動。連動CX「黑色生日」：打倒對手後付1能量並丟1張手牌，給對手1點傷害（可能被取消），再把被打倒的角色放進對手傷害區（這張不能取消）。',
    status: pending,
  },
  {
    id: 'BD/W125-T17', series: SERIES, name: t('ふたつの月 ～Deep Into The Forest～', '雙月 ~Deep Into The Forest~'),
    type: 'event', color: 'red', level: 1, cost: 0, triggers: [], traits: [],
    abilities: [
      {
        kind: 'continuous', rules: ['ignoreColorRequirement'], effects: [],
        text: t('このカードは、色条件を満たさずに手札からプレイできる。', '【永】此卡可以無需滿足顏色條件從手牌使用。'),
      },
      {
        kind: 'event',
        effects: [{
          op: 'grantAbility', duration: 'thisTurn',
          target: { zone: 'stage', side: 'self', count: { exactly: 1 } },
          ability: {
            kind: 'auto', trigger: { event: 'battleOpponentReversed' },
            effects: [{ op: 'lookTopPick', look: 2, pick: { filter: { type: 'character', trait: '音楽' }, upTo: 2 }, rest: 'waitingRoom' }],
            text: t('【自】このカードのバトル相手が【リバース】した時、あなたは自分の山札を上から2枚まで見て、《音楽》のキャラを2枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
              '【自】此卡的戰鬥對手【倒置】時，你從自己的牌組上方看最多2張，選擇《音樂》的角色最多2張給對手確認，加到手牌，剩下的卡片放到休息室。'),
          },
        }],
        text: t('あなたは自分のキャラを1枚選び、そのターン中、次の能力を与える。「【自】このカードのバトル相手が【リバース】した時、あなたは自分の山札を上から2枚まで見て、《音楽》のキャラを2枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。」',
          '你選擇自己的角色1張，在那個回合中，給予以下能力。『【自】此卡的戰鬥對手【倒置】時，你從自己的牌組上方看最多2張，選擇《音樂》的角色最多2張給對手確認，加到手牌，剩下的卡片放到休息室。』'),
      },
    ],
    note: '不需要紅色也能使用，而且費用0。在主要階段先用，給1張角色加上能力。她打倒對手時看2張，裡面的《音樂》角色全部可以拿。建議選最有把握打倒對手的角色。',
    status: pending,
  },
  {
    id: 'BD/W125-T18', series: SERIES, name: t('黒のバースデイ', '黑色生日'),
    type: 'climax', color: 'red', triggers: ['comeback'], traits: [],
    abilities: [{
      kind: 'continuous',
      effects: [
        { op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all' }, amount: 1000, duration: 'whileActive' },
        { op: 'modifySoul', target: { zone: 'stage', side: 'self', count: 'all' }, amount: 1, duration: 'whileActive' },
      ],
      text: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。', '【永】你的角色全部，攻擊力+1000，魂傷+1。'),
    }],
    note: '在高潮階段從手牌打出，效果持續到這回合結束。連動：「“Perdere Omnia” Doloris」（Lv3）。判定翻到這張時：可以從休息室撿回1張角色。',
    status: pending,
  },
  {
    id: 'BD/W125-T19', series: SERIES, name: t('神さま、バカ', '神明，笨蛋'),
    type: 'climax', color: 'red', triggers: ['soul', 'soul'], traits: [],
    abilities: [{
      kind: 'continuous', effects: [{ op: 'modifySoul', target: { zone: 'stage', side: 'self', count: 'all' }, amount: 2, duration: 'whileActive' }],
      text: t('【永】あなたのキャラすべてに、ソウルを＋2。', '【永】你的角色全部，魂傷+2。'),
    }],
    note: '沒有連動角色，效果是全隊魂傷+2，用來把傷害打高。判定翻到這張時：這次攻擊魂傷+2。',
    status: pending,
  },
];

// 預組內容（張數取自檔名；與 data/decks/BD-W125.csv 一致）
export const deck: { cardId: string; count: number }[] = [
  ['T01', 4], ['T02', 2], ['T03', 4], ['T04', 2], ['T05', 2], ['T06', 2], ['T07', 4], ['T08', 4], ['T09', 2], ['T10', 2],
  ['T11', 4], ['T12', 2], ['T13', 2], ['T14', 2], ['T15', 2], ['T16', 4], ['T17', 2], ['T18', 2], ['T19', 2],
].map(([n, c]) => ({ cardId: `BD/W125-${n}`, count: c as number }));

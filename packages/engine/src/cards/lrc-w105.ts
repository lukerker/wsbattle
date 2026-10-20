// 莉可麗絲 預組 LRC/W105（20 種、50 張）。
// 日文原文取自官方卡表（ws-tcg.com），不是讀圖。2026-10-20 使用者核對通過；角色與特徵譯名暫用，之後可能統一調整。
import type { Ability, Card, CardFilter, Selector, Text } from '../card-schema.ts';

const SERIES = 'LRC';
export const source = '官方卡表';
const t = (ja: string, zh: string): Text => ({ ja, zh });

// 「《リコリコ》か《武器》のキャラ」
const lrcChar: CardFilter = { anyOf: [{ type: 'character', trait: 'リコリコ' }, { type: 'character', trait: '武器' }] };
const lrcOnStage: Selector = { zone: 'stage', side: 'self', filter: lrcChar, count: 'all' };
const otherLrcOnStage: Selector = { zone: 'stage', side: 'self', filter: { ...lrcChar, excludeSource: true }, count: 'all' };
const handDiscard = (filter?: CardFilter, n = 1): Selector => ({ zone: 'hand', side: 'self', filter, count: { exactly: n } });
const self: Selector = { zone: 'stage', side: 'self', count: 'all', relation: 'source' };
const selfStage: Selector = { zone: 'stage', side: 'self', count: 'all' };
const toHand = { zone: 'hand' as const, side: 'self' as const };

// 譯名待確認
const TRAIT_LRC = t('リコリコ', '莉可莉可');
const TRAIT_WEAPON = t('武器', '武器');
const TRAIT_GLASSES = t('メガネ', '眼鏡');
const TRAIT_NET = t('ネット', '網路');

const N = {
  chisatoLife: '一緒に生活 千束',
  cxPulse: '響かない鼓動',
  cxTogether: '力を合わせて',
  alanProof: 'アランチルドレンの証',
};

const encore = (ja: string, zh: string): Ability => ({
  kind: 'auto',
  keyword: { id: 'encore' },
  trigger: { event: 'sourceLeavesStageToWaitingRoom' },
  optional: true,
  cost: [{ kind: 'discard', selector: handDiscard({ type: 'character' }) }],
  effects: [{ op: 'returnSourceToSlot', state: 'rest' }],
  text: t(ja, zh),
});
const ENCORE_CHAR = encore(
  '【自】アンコール［手札のキャラを1枚控え室に置く］（このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、このカードがいた枠に【レスト】して置く）',
  '【自】安可［手牌的角色1張放到休息室］(此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，將此卡【橫置】放到原本的格子)',
);

const pending = { translated: true, coded: true, verified: true, tested: true }; // 2026-10-20 使用者核對通過（譯名暫用）；情境測試：game/cards-lrc.test.ts

export const cards: Card[] = [
  {
    id: 'LRC/W105-T01', series: SERIES, name: t('遊びに行こう 千束', '一起去玩吧 千束'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1500, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'opponentAttackPhaseStart' }, optional: true,
        effects: [{ op: 'moveSourceToSlot', row: 'front', emptyOnly: true }],
        text: t('【自】相手のアタックフェイズの始めに、あなたはこのカードを前列のキャラのいない枠に動かしてよい。',
          '【自】在對手的攻擊階段開始時，你可以將此卡移動到前列的沒有角色的格子。'),
      },
      {
        kind: 'auto', trigger: { event: 'sourceLeavesStageToWaitingRoom' }, optional: true,
        cost: [{ kind: 'stock', n: 1 }, { kind: 'deckTopToClock' }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: lrcChar, count: { exactly: 1 } }, to: toHand }],
        text: t('【自】［① あなたの山札の上から1枚をクロック置場に置く］このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の、《リコリコ》か《武器》のキャラを1枚選び、手札に戻す。',
          '【自】［① 將你的牌組上方1張放到傷害區］此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，你選擇自己休息室的《莉可莉可》或《武器》的角色1張，回到手牌。'),
        review: ['休息室裡的這張卡本身也是《莉可莉可》角色，所以可以選它自己回手牌。'],
      },
    ],
    note: '效果1：對手攻擊階段開始時，可以從後列跳到前列的空格擋攻擊（前列要有空格）。效果2：她進休息室時（被打倒、被擠掉都算），付1能量並把牌組最上面1張放進傷害區（自己多吃1點傷害），從休息室撿回1張角色，也可以撿她自己。',
    status: pending,
  },
  {
    id: 'LRC/W105-T02', series: SERIES, name: t('送り迎え ミズキ', '接送 瑞希'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 2000, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_GLASSES],
    abilities: [{
      kind: 'auto', trigger: { event: 'placedFromHandToStage' }, alsoOn: { event: 'sourceLeavesStageToWaitingRoom' }, optional: true,
      cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard() }],
      effects: [{ op: 'searchDeck', filter: lrcChar, upTo: 1, reveal: true, shuffle: true }],
      text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時か舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札を見て《リコリコ》か《武器》のキャラを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時或從舞台被放到休息室時，你可以支付代價。支付代價的話，你從自己的牌組選擇《莉可莉可》或《武器》的角色最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    }],
    note: '登場時、進休息室時各可以發動一次：付1能量並丟1張手牌，從牌組直接找1張角色。等於丟1換1，可以換成想要的角色。',
    status: pending,
  },
  {
    id: 'LRC/W105-T03', series: SERIES, name: t('喫茶リコリコinハワイ ミズキ', '莉可莉可咖啡廳in夏威夷 瑞希'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 2500, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_GLASSES],
    abilities: [{
      kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
      cost: [
        { kind: 'discard', selector: handDiscard({ type: 'climax' }) },
        { kind: 'discard', selector: { zone: 'stage', side: 'self', filter: { type: 'character' }, count: { exactly: 1 } } },
      ],
      effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { type: 'climax' }, count: { exactly: 1 } }, to: toHand }],
      text: t('【自】［手札のクライマックスを1枚控え室に置き、他のあなたの舞台のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のクライマックスを1枚選び、手札に戻す。',
        '【自】［手牌的名場面1張放到休息室，並將其他的你的舞台的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的名場面1張，回到手牌。'),
      review: ['剛丟掉的那張名場面已經在休息室，可以選它撿回來（等於換成想要的名場面）。'],
    }],
    note: 'Lv0 就有2500。登場時丟1張CX、再把場上另1張角色送進休息室，從休息室撿1張CX。送進休息室的若是「一起去玩吧 千束」或「接送 瑞希」，還會觸發她們進休息室的效果。',
    status: pending,
  },
  {
    id: 'LRC/W105-T04', series: SERIES, name: t('私の生き方 千束', '我的生存方式 千束'),
    type: 'character', color: 'red', level: 1, cost: 0, power: 4500, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'climaxPlaced', side: 'self' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: lrcChar, count: { exactly: 1 } }, amount: 1500, duration: 'thisTurn' }],
        text: t('【自】あなたのクライマックスがクライマックス置場に置かれた時、あなたは自分の、《リコリコ》か《武器》のキャラを1枚選び、そのターン中、パワーを＋1500。',
          '【自】當你的名場面被放置到名場面區時，你選擇自己的《莉可莉可》或《武器》的角色1張，在那個回合中，攻擊力+1500。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxPulse }, trigger: { event: 'climaxPlaced', side: 'self', filter: { name: N.cxPulse } }, optional: true,
        condition: { kind: 'all', of: [{ kind: 'sourceInSlot', slots: [0, 1, 2] }, { kind: 'stockAtMost', n: 4 }] },
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: lrcChar, count: { exactly: 1 } }, to: toHand }],
        text: t('【自】【CXコンボ】あなたのクライマックス置場に「響かない鼓動」が置かれた時、前列にこのカードがいて、あなたのストックが4枚以下なら、あなたは自分の控え室の、《リコリコ》か《武器》のキャラを1枚選び、手札に戻してよい。',
          '【自】【CX連動】當「不會響起的心跳」被放置到你的名場面區時，此卡在前列，且你的能量在4張以下的話，你可以選擇自己休息室的《莉可莉可》或《武器》的角色1張，回到手牌。'),
      },
    ],
    note: '打出任何CX時，選1張角色+1500。連動CX「不會響起的心跳」：她在前列、能量4張以下時，打出CX就能從休息室撿1張角色（不用攻擊就觸發）。',
    status: pending,
  },
  {
    id: 'LRC/W105-T05', series: SERIES, name: t('拘りのコーヒー ミカ', '講究的咖啡 米卡'),
    type: 'character', color: 'red', level: 1, cost: 1, power: 1000, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [{
      kind: 'activated', keyword: { id: 'backup', power: 2500, level: 1 }, timing: 'counter',
      cost: [{ kind: 'stock', n: 1 }, { kind: 'sourceToMemory' }],
      effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'inBattleWithSource' }, amount: 2500, duration: 'thisTurn' }],
      text: t('【起】【カウンター】助太刀2500 レベル1［① 手札のこのカードを思い出にする］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋2500）',
        '【起】【反擊】助太刀2500 等級1［① 將手牌的此卡放到回憶區］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+2500)'),
    }],
    note: '防守卡：對手正打你的角色時，付1能量從手牌打出，被打的角色+2500。用完放進回憶區（不是休息室），不會再洗回牌組。你的等級要達到1才能用。',
    status: pending,
  },
  {
    id: 'LRC/W105-T06', series: SERIES, name: t(N.chisatoLife, '一起生活 千束'),
    type: 'character', color: 'red', level: 1, cost: 1, power: 6000, soul: 2, triggers: [],
    traits: [TRAIT_LRC, TRAIT_WEAPON], abilities: [],
    note: '沒有效果，但Lv1就有6000、魂傷2。搭配後列的「共同生活 瀧奈」變成7500，而且得到安可（丟1張手牌的角色）。',
    status: pending,
  },
  {
    id: 'LRC/W105-T07', series: SERIES, name: t('おいしく楽しく 千束', '美味又開心 千束'),
    type: 'character', color: 'red', level: 2, cost: 2, power: 6000, soul: 2, triggers: ['soul'],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: self, amount: { per: otherLrcOnStage, multiplier: 1000, evaluate: 'live' }, duration: 'whileActive' }],
        text: t('【永】他のあなたの、《リコリコ》か《武器》のキャラ1枚につき、このカードのパワーを＋1000。',
          '【永】其他的你的《莉可莉可》或《武器》的角色每有1張，此卡的攻擊力+1000。'),
      },
      ENCORE_CHAR,
    ],
    note: '場上其他4張都是角色的話，她是10000（本牌組的角色都是《莉可莉可》）。自帶安可：被打倒時丟1張手牌的角色，就能橫置回到原本的格子。',
    status: pending,
  },
  {
    id: 'LRC/W105-T08', series: SERIES, name: t('ワイハの迷彩服 千束', '夏威夷的迷彩服 千束'),
    type: 'character', color: 'red', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{
          op: 'revealTopCheck', matchTo: 'deckTop',
          filter: { anyOf: [{ type: 'character', trait: 'リコリコ' }, { type: 'character', trait: '武器' }, { type: 'event' }] },
          ifMatch: [{ op: 'may', prompt: '要給對手 1 點傷害嗎', then: [{ op: 'dealDamage', amount: 1, cancelable: true }] }],
        }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札の上から1枚を公開する。そのカードが《リコリコ》か《武器》のキャラかイベントなら、あなたは相手に1ダメージを与えてよい。（ダメージキャンセルは発生する。公開したカードは元に戻す）',
          '【自】此卡從手牌被放置到舞台時，你將自己的牌組上方1張公開。那張卡片是《莉可莉可》或《武器》的角色、或是事件的話，你可以給對手1點傷害。(會發生傷害取消。公開的卡片放回原位)'),
        review: ['「《リコリコ》か《武器》のキャラかイベント」解讀為：有這兩個特徵之一的角色，或任何事件（事件卡沒有特徵）。'],
      },
      {
        kind: 'auto', trigger: { event: 'attacks' }, optional: true,
        cost: [{ kind: 'discard', selector: { zone: 'memory', side: 'self', filter: { name: N.alanProof }, count: { exactly: 1 } } }],
        effects: [{ op: 'putCardOnDeckTop', from: { zone: 'waitingRoom', side: 'opponent', count: { exactly: 1 } } }],
        text: t('【自】［あなたの思い出置場の「アランチルドレンの証」を1枚控え室に置く］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、あなたは相手の控え室のカードを1枚選び、山札の上に置く。',
          '【自】［將你的回憶區的「艾倫之子的證明」1張放到休息室］此卡攻擊時，你可以支付代價。支付代價的話，你選擇對手休息室的卡片1張，放到牌組上方。'),
      },
    ],
    note: '登場時公開牌組最上面1張：是角色或事件（不是CX）就能給對手1點傷害，公開的卡放回原位。效果2：回憶區有「艾倫之子的證明」時，攻擊時可以把它放進休息室，從對手休息室選1張卡放到對手牌組最上面（建議選非CX，讓傷害不容易被取消）。',
    status: pending,
  },
  {
    id: 'LRC/W105-T09', series: SERIES, name: t(N.alanProof, '艾倫之子的證明'),
    type: 'event', color: 'red', level: 1, cost: 1, triggers: [], traits: [],
    playCondition: { kind: 'countAtLeast', selector: lrcOnStage, n: 1 },
    abilities: [{
      kind: 'event',
      effects: [{ op: 'searchDeck', filter: { type: 'climax' }, upTo: 1, reveal: true, shuffle: true }, { op: 'sourceToMemory' }],
      text: t('このカードは、あなたの、《リコリコ》か《武器》のキャラがいないなら、手札からプレイできない。あなたは自分の山札を見てクライマックスを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。このカードを思い出にする。',
        '你的《莉可莉可》或《武器》的角色不存在的話，此卡不能從手牌使用。你從自己的牌組選擇名場面最多1張給對手確認，加到手牌，將那個牌組洗牌。將此卡放到回憶區。'),
    }],
    note: '場上要有角色才能用。從牌組直接拿1張CX，用完放進回憶區（不進休息室）。放在回憶區的這張，之後可以給「夏威夷的迷彩服 千束」當攻擊效果的代價。',
    status: pending,
  },
  {
    id: 'LRC/W105-T10', series: SERIES, name: t(N.cxPulse, '不會響起的心跳'),
    type: 'climax', color: 'red', triggers: ['comeback'], traits: [],
    abilities: [{
      kind: 'continuous',
      effects: [
        { op: 'modifyPower', target: selfStage, amount: 1000, duration: 'whileActive' },
        { op: 'modifySoul', target: selfStage, amount: 1, duration: 'whileActive' },
      ],
      text: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。', '【永】你的角色全部，攻擊力+1000，魂傷+1。'),
    }],
    note: '在名場面階段從手牌打出，效果持續到這回合結束。連動：「我的生存方式 千束」。判定翻到這張時：可以從休息室選1張角色加入手牌。',
    status: pending,
  },
  {
    id: 'LRC/W105-T11', series: SERIES, name: t('良好な変化 たきな', '良好的變化 瀧奈'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 500, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'allyLeavesStageToWaitingRoom', filter: lrcChar }, optional: true,
        condition: { kind: 'sourceInSlot', slots: [3, 4] },
        cost: [{ kind: 'sendSourceToWaitingRoom' }],
        effects: [{ op: 'returnTriggerCardToSlot' }],
        text: t('【自】［このカードを控え室に置く］他のあなたの、《リコリコ》か《武器》のキャラが舞台から控え室に置かれた時、後列にこのカードがいるなら、あなたはコストを払ってよい。そうしたら、そのキャラをそのキャラがいた枠に【レスト】して置く。',
          '【自】［將此卡放到休息室］其他的你的《莉可莉可》或《武器》的角色從舞台被放到休息室時，此卡在後列的話，你可以支付代價。支付代價的話，將那張角色【橫置】放到它原本的格子。'),
      },
      {
        kind: 'activated', keyword: { id: 'concentrate' },
        cost: [{ kind: 'stock', n: 1 }, { kind: 'restSource' }],
        effects: [
          { op: 'revealMill', n: 5, bind: 'milled', result: 'draw' },
          { op: 'drawCards', n: { countOfBound: 'milled', filter: { type: 'climax' } } },
        ],
        text: t('【起】集中［① このカードを【レスト】する］あなたは自分の山札の上から5枚をめくり、控え室に置く。それらのカードのクライマックス1枚につき、あなたは1枚まで引く。',
          '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻5張，放到休息室。那些卡片中每有1張名場面，你抽最多1張牌。'),
      },
    ],
    note: '放後列。效果1：你的其他角色進休息室時（被打倒等），可以讓瀧奈自己進休息室，把那張角色橫置放回原本的格子，像是免費的安可。效果2：集中，付1能量並把她橫置，翻5張，每1張CX抽1張。',
    status: pending,
  },
  {
    id: 'LRC/W105-T12', series: SERIES, name: t('共同生活 たきな', '共同生活 瀧奈'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 1000, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'continuous',
        effects: [
          { op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: { name: N.chisatoLife, excludeSource: true }, count: 'all' }, amount: 1500, duration: 'whileActive' },
          { op: 'grantAbility', target: { zone: 'stage', side: 'self', filter: { name: N.chisatoLife, excludeSource: true }, count: 'all' }, ability: ENCORE_CHAR, duration: 'whileActive' },
        ],
        text: t('【永】他のあなたの「一緒に生活 千束」すべてに、パワーを＋1500し、『【自】アンコール［手札のキャラを1枚控え室に置く］』を与える。',
          '【永】其他的你的「一起生活 千束」全部，攻擊力+1500，並給予『【自】安可［手牌的角色1張放到休息室］』。'),
      },
      {
        kind: 'auto', keyword: { id: 'bond', targetName: N.chisatoLife }, trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard() }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { name: N.chisatoLife }, count: { exactly: 1 } }, to: toHand }],
        text: t('【自】絆／「一緒に生活 千束」［手札を1枚控え室に置く］（このカードがプレイされて舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「一緒に生活 千束」を1枚選び、手札に戻す）',
          '【自】絆／「一起生活 千束」［手牌1張放到休息室］(此卡被使用被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「一起生活 千束」1張，回到手牌)'),
      },
    ],
    note: '專門搭配「一起生活 千束」（Lv1 攻擊6000）。不論瀧奈放前列還是後列，千束都變成7500，而且得到安可。絆：瀧奈從手牌登場時丟1張手牌，就能從休息室撿回千束。',
    status: pending,
  },
  {
    id: 'LRC/W105-T13', series: SERIES, name: t('謎多きハッカー クルミ', '謎團重重的駭客 胡桃'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 2500, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_NET],
    abilities: [{
      kind: 'continuous', condition: { kind: 'stockAtMost', n: 2 },
      effects: [{ op: 'modifyPower', target: self, amount: 1500, duration: 'whileActive' }],
      text: t('【永】あなたのストックが2枚以下なら、このカードのパワーを＋1500。', '【永】你的能量在2張以下的話，此卡的攻擊力+1500。'),
    }],
    note: '能量2張以下時是4000，Lv0裡數值很高，適合遊戲前期放前列。能量存到3張以上就變回2500。',
    status: pending,
  },
  {
    id: 'LRC/W105-T14', series: SERIES, name: t('遊びに行こう たきな', '一起去玩吧 瀧奈'),
    type: 'character', color: 'blue', level: 1, cost: 0, power: 4000, soul: 1, triggers: [],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'modifyPower', target: self, amount: { per: lrcOnStage, multiplier: 500, evaluate: 'atResolution' }, duration: 'thisTurn' }],
        text: t('【自】このカードが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋X。Xはあなたの、《リコリコ》か《武器》のキャラの枚数×500に等しい。',
          '【自】此卡從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+X。X等於你的《莉可莉可》或《武器》的角色張數×500。'),
      },
      {
        kind: 'auto', trigger: { event: 'attacks' }, condition: { kind: 'opponentInFrontLevel', level: 2 },
        effects: [{ op: 'modifyPower', target: self, amount: 6000, duration: 'thisTurn' }],
        text: t('【自】このカードがアタックした時、このカードの正面のキャラのレベルが2なら、そのターン中、このカードのパワーを＋6000。',
          '【自】此卡攻擊時，此卡的正面的角色等級是2的話，在那個回合中，此卡的攻擊力+6000。'),
      },
    ],
    note: '登場那回合，每有1張角色（包含她自己）+500，場上5張的話是6500。效果2：攻擊時正面是Lv2的角色就+6000（變成10000以上），專門打倒對手的Lv2。',
    status: pending,
  },
  {
    id: 'LRC/W105-T15', series: SERIES, name: t('仲間を救うため クルミ', '為了拯救夥伴 胡桃'),
    type: 'character', color: 'blue', level: 2, cost: 1, power: 3500, soul: 1, triggers: ['soul'],
    traits: [TRAIT_LRC, TRAIT_NET],
    abilities: [
      {
        kind: 'continuous', keyword: { id: 'assist' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'frontOfSource' }, amount: { perLevelOfTarget: true, multiplier: 500 }, duration: 'whileActive' }],
        text: t('【永】応援 このカードの前のあなたのキャラすべてに、パワーを＋X。Xはそのキャラのレベル×500に等しい。', '【永】應援 此卡前面的你的角色全部，攻擊力+X。X等於那張角色的等級×500。'),
      },
      {
        kind: 'activated', cost: [{ kind: 'restSource' }],
        effects: [{ op: 'lookTopPlace' }],
        text: t('【起】［このカードを【レスト】する］あなたは自分の山札を上から1枚見て、山札の上か下に置く。', '【起】［將此卡【橫置】］你看自己的牌組上方1張，放到牌組上方或下方。'),
      },
    ],
    note: '放後列：她斜前方2格的角色，Lv1的+500、Lv2的+1000、Lv3的+1500。起動：不用付能量，把她橫置就能看牌組最上面1張，決定留著或放到最下面（例如把CX留在上面，讓下一次判定翻到）。',
    status: pending,
  },
  {
    id: 'LRC/W105-T16', series: SERIES, name: t('仲間を救うため たきな', '為了拯救夥伴 瀧奈'),
    type: 'character', color: 'blue', level: 2, cost: 1, power: 4500, soul: 1, triggers: ['soul'],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [{
      kind: 'auto', trigger: { event: 'attacks' },
      effects: [{ op: 'modifyPower', target: self, amount: { per: { zone: 'stage', side: 'opponent', count: 'all' }, multiplier: 2000, evaluate: 'atResolution' }, duration: 'thisTurn' }],
      text: t('【自】このカードがアタックした時、そのターン中、このカードのパワーを＋X。Xは相手のキャラの枚数×2000に等しい。',
        '【自】此卡攻擊時，在那個回合中，此卡的攻擊力+X。X等於對手的角色張數×2000。'),
    }],
    note: '攻擊時，對手場上每有1張角色+2000。對手滿場5張時她是14500。對手角色越少越弱。',
    status: pending,
  },
  {
    id: 'LRC/W105-T17', series: SERIES, name: t('リコリス たきな＆千束', '莉可麗絲 瀧奈＆千束'),
    type: 'character', color: 'blue', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard() }],
        effects: [{ op: 'moveCards', from: { zone: 'clock', side: 'self', count: { exactly: 1 }, position: 'top' }, to: { zone: 'stock', side: 'self' } }],
        text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分のクロックの上から1枚を、ストック置場に置く。',
          '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你將自己的傷害區上方1張，放到能量區。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxTogether }, trigger: { event: 'attacks' }, optional: true,
        condition: { kind: 'climaxInZone', name: N.cxTogether },
        cost: [{ kind: 'stock', n: 2 }],
        effects: [{ op: 'dealDamage', amount: 2, cancelable: true }],
        text: t('【自】【CXコンボ】［②］このカードがアタックした時、クライマックス置場に「力を合わせて」があるなら、あなたはコストを払ってよい。そうしたら、相手に2ダメージを与える。（ダメージキャンセルは発生する）',
          '【自】【CX連動】［②］此卡攻擊時，名場面區有「齊心協力」的話，你可以支付代價。支付代價的話，給對手2點傷害。(會發生傷害取消)'),
      },
    ],
    note: '登場時丟1張手牌，回1血（傷害區1張移到能量區，順便多1能量）。連動CX「齊心協力」：攻擊時付2能量，先給對手2點傷害，再進行一般的攻擊傷害。',
    status: pending,
  },
  {
    id: 'LRC/W105-T18', series: SERIES, name: t('久々の再会 たきな', '久違的重逢 瀧奈'),
    type: 'character', color: 'blue', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'],
    traits: [TRAIT_LRC, TRAIT_WEAPON],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'lookTopPick', look: { per: lrcOnStage, multiplier: 1, evaluate: 'atResolution' }, pick: { filter: {}, upTo: 1 }, rest: 'waitingRoom', secret: true }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を上からＸ枚まで見て、カードを1枚まで選び、手札に加え、残りのカードを控え室に置く。Ｘはあなたの、《リコリコ》か《武器》のキャラの枚数に等しい。',
          '【自】此卡從手牌被放置到舞台時，你從自己的牌組上方看最多X張，選擇卡片最多1張，加到手牌，剩下的卡片放到休息室。X等於你的《莉可莉可》或《武器》的角色張數。'),
      },
      {
        kind: 'auto', trigger: { event: 'attacks' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard(undefined, 2) }],
        effects: [{ op: 'dealDamage', amount: 1, cancelable: true }],
        text: t('【自】［手札を2枚控え室に置く］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、相手に1ダメージを与える。（ダメージキャンセルは発生する）',
          '【自】［手牌2張放到休息室］此卡攻擊時，你可以支付代價。支付代價的話，給對手1點傷害。(會發生傷害取消)'),
      },
    ],
    note: '登場時看牌組上方X張（X＝場上角色數，包含她自己），任選1張加入手牌，其餘進休息室；拿的卡不用給對手看。攻擊時丟2張手牌，多給對手1點傷害。',
    status: pending,
  },
  {
    id: 'LRC/W105-T19', series: SERIES, name: t(N.cxTogether, '齊心協力'),
    type: 'climax', color: 'blue', triggers: ['soul', 'gate'], traits: [],
    abilities: [{
      kind: 'continuous',
      effects: [
        { op: 'modifyPower', target: selfStage, amount: 1000, duration: 'whileActive' },
        { op: 'modifySoul', target: selfStage, amount: 1, duration: 'whileActive' },
      ],
      text: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。', '【永】你的角色全部，攻擊力+1000，魂傷+1。'),
    }],
    note: '連動：「莉可麗絲 瀧奈＆千束」。判定翻到這張時：這次攻擊魂傷+1，而且可以從休息室選1張名場面加入手牌。',
    status: pending,
  },
  {
    id: 'LRC/W105-T20', series: SERIES, name: t('困っている人を助ける仕事', '幫助有困難的人的工作'),
    type: 'climax', color: 'blue', triggers: ['soul', 'soul'], traits: [],
    abilities: [{
      kind: 'continuous', effects: [{ op: 'modifySoul', target: selfStage, amount: 2, duration: 'whileActive' }],
      text: t('【永】あなたのキャラすべてに、ソウルを＋2。', '【永】你的角色全部，魂傷+2。'),
    }],
    note: '沒有連動角色，效果是全隊魂傷+2，用來把傷害打高。判定翻到時，這次攻擊魂傷+2。',
    status: pending,
  },
];

// 預組內容（張數取自檔名；與 data/decks/LRC-W105.csv 一致）
export const deck: { cardId: string; count: number }[] = [
  ['T01', 2], ['T02', 4], ['T03', 2], ['T04', 4], ['T05', 2], ['T06', 2], ['T07', 2], ['T08', 2], ['T09', 2], ['T10', 4],
  ['T11', 4], ['T12', 2], ['T13', 4], ['T14', 2], ['T15', 2], ['T16', 2], ['T17', 2], ['T18', 2], ['T19', 2], ['T20', 2],
].map(([n, c]) => ({ cardId: `LRC/W105-${n}`, count: c as number }));

// FAIRY TAIL 魔導少年 預組 FT/S09（19 種、50 張）。紅、綠兩色。
// 日文原文取自官方卡表（data/cards/FT-S09.json）。2010 年的卡，用語是舊版（クライマックス、［(1)］）。角色與特徵譯名暫用。
import type { Ability, Card, CardFilter, Selector, Text } from '../card-schema.ts';

const SERIES = 'FT';
export const source = '官方卡表';
const t = (ja: string, zh: string): Text => ({ ja, zh });

const self: Selector = { zone: 'stage', side: 'self', count: 'all', relation: 'source' };
const selfStage = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: 'all' });
const oneOfMine = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: { exactly: 1 } });
const toHand = { zone: 'hand' as const, side: 'self' as const };

const MAGIC = t('魔法', '魔法');
const KEY = t('鍵', '鑰匙');
const DRAGON = t('竜', '龍');

const N = {
  roar: '火竜の咆哮',
};

const climax = (ja: string, zh: string): Ability => ({
  kind: 'continuous',
  effects: [
    { op: 'modifyPower', target: selfStage(), amount: 1000, duration: 'whileActive' },
    { op: 'modifySoul', target: selfStage(), amount: 1, duration: 'whileActive' },
  ],
  text: t(ja, zh),
});

const pending = { translated: true, coded: true, verified: false, tested: true }; // 情境測試：game/cards-ft.test.ts

export const cards: Card[] = [
  {
    id: 'FT/S09-T01', series: SERIES, name: t('妖精の尻尾の看板娘 ミラジェーン', '妖精尾巴的招牌女孩 蜜拉珍'),
    type: 'character', color: 'green', level: 0, cost: 0, power: 500, soul: 1, triggers: [], traits: [MAGIC, t('ウェイトレス', '女服務生')],
    abilities: [
      {
        kind: 'continuous', keyword: { id: 'assist' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'frontOfSource' }, amount: 500, duration: 'whileActive' }],
        text: t('【永】応援 このカードの前のあなたのキャラすべてに、パワーを＋500。', '【永】應援 此卡前面的你的角色全部，攻擊力+500。'),
      },
      {
        kind: 'auto', trigger: { event: 'usedActivated' }, perTurn: 1,
        effects: [{ op: 'modifyPower', target: oneOfMine(), amount: 500, duration: 'thisTurn' }],
        text: t('【自】この能力は1ターンにつき1回まで発動する。あなたが【起】を使った時、あなたは自分のキャラを1枚選び、そのターン中、パワーを＋500。',
          '【自】此能力每回合最多發動1次。當你使用【起】時，你選擇自己的角色1張，在那個回合中，攻擊力+500。'),
        review: ['「【起】を使った時」：主要階段使用舞台角色的【起】、反擊步驟使用助太刀（也是【起】）都算。'],
      },
    ],
    note: '放後列：斜前方2格的角色+500。每回合第一次使用【起】（例如露西、艾爾夫曼的能力）時，再選1張角色+500。',
    status: pending,
  },
  {
    id: 'FT/S09-T02', series: SERIES, name: t('ルーシィ・ハートフィリア', '露西·哈特菲利亞'),
    type: 'character', color: 'green', level: 0, cost: 0, power: 2000, soul: 1, triggers: [], traits: [MAGIC, KEY],
    abilities: [{
      kind: 'activated',
      cost: [{ kind: 'rest', selector: { zone: 'stage', side: 'self', state: 'stand', count: { exactly: 2 } } }],
      effects: [{ op: 'modifyPower', target: oneOfMine({ trait: '鍵' }), amount: 2000, duration: 'thisTurn' }],
      text: t('【起】［あなたのキャラを2枚【レスト】する］あなたは自分の《鍵》のキャラを1枚選び、そのターン中、パワーを＋2000。',
        '【起】［將你的角色2張【橫置】］你選擇自己的《鑰匙》的角色1張，在那個回合中，攻擊力+2000。'),
      review: ['橫置的2張可以包含露西自己。'],
    }],
    note: '把自己的2張角色橫置（通常是後列），讓1張《鑰匙》角色這回合+2000。橫置的角色這回合不能攻擊，所以用後列的角色付。',
    status: pending,
  },
  {
    id: 'FT/S09-T03', series: SERIES, name: t('メイド姿のルーシィ', '女僕裝的露西'),
    type: 'character', color: 'green', level: 0, cost: 0, power: 3000, soul: 1, triggers: [], traits: [MAGIC, KEY], abilities: [],
    note: '沒有效果，但是Lv0就有3000。',
    status: pending,
  },
  {
    id: 'FT/S09-T04', series: SERIES, name: t('“拳で語れ”エルフマン', '"用拳頭說話" 艾爾夫曼'),
    type: 'character', color: 'green', level: 1, cost: 0, power: 4500, soul: 1, triggers: [], traits: [MAGIC, t('動物', '動物')],
    abilities: [{
      kind: 'activated',
      cost: [{ kind: 'rest', selector: { zone: 'stage', side: 'self', state: 'stand', count: { exactly: 1 } } }],
      effects: [{ op: 'modifyPower', target: self, amount: 1000, duration: 'thisTurn' }],
      text: t('【起】［あなたのキャラを1枚【レスト】する］そのターン中、このカードのパワーを＋1000。', '【起】［將你的角色1張【橫置】］在那個回合中，此卡的攻擊力+1000。'),
      review: ['橫置的角色可以是艾爾夫曼自己（橫置後這回合就不能攻擊）。'],
    }],
    note: '橫置1張自己的角色（通常是後列），他這回合+1000。可以用好幾次，每次橫置不同的角色。',
    status: pending,
  },
  {
    id: 'FT/S09-T05', series: SERIES, name: t('ルーシィ＆ハッピー', '露西＆哈比'),
    type: 'character', color: 'green', level: 1, cost: 0, power: 5500, soul: 1, triggers: [], traits: [MAGIC, KEY], abilities: [],
    note: '沒有效果，但是Lv1、費用0就有5500。',
    status: pending,
  },
  {
    id: 'FT/S09-T06', series: SERIES, name: t('処女宮のバルゴ', '處女宮的巴爾格'),
    type: 'character', color: 'green', level: 2, cost: 2, power: 9000, soul: 2, triggers: ['soul'], traits: [KEY, t('メイド', '女僕')], abilities: [],
    note: '沒有效果，Lv2就有9000、魂傷2。',
    status: pending,
  },
  {
    id: 'FT/S09-T07', series: SERIES, name: t('DEAR KABY', 'DEAR KABY'),
    type: 'climax', color: 'green', triggers: ['treasure'], traits: [],
    abilities: [climax(
      '【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【トレジャー】：このカードがトリガーした時、あなたはこのカードを手札に戻す。あなたは自分の山札の上から1枚を、ストック置場に置いてよい）',
      '【永】你的角色全部，攻擊力+1000，魂傷+1。(金條：當你判定出此卡時，你將此卡回到手牌。你可以將自己的牌組上方1張，放到能量區)',
    )],
    note: '在名場面階段從手牌打出，效果持續到這回合結束：全部角色攻擊力+1000、魂傷+1。判定翻到這張時：這張回到手牌，還可以把牌組最上面1張放進能量區。',
    status: pending,
  },
  {
    id: 'FT/S09-T08', series: SERIES, name: t('ハッピー', '哈比'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 2500, soul: 1, triggers: [], traits: [MAGIC, t('動物', '動物')],
    abilities: [{
      kind: 'activated',
      cost: [{ kind: 'stock', n: 2 }, { kind: 'restSource' }],
      effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { type: 'character', trait: '竜' }, count: { exactly: 1 } }, to: toHand }],
      text: t('【起】［② このカードを【レスト】する］あなたは自分の控え室の《竜》のキャラを1枚選び、手札に戻す。', '【起】［② 將此卡【橫置】］你選擇自己休息室的《龍》的角色1張，回到手牌。'),
    }],
    note: '付2能量並把哈比橫置，從休息室撿回1張《龍》角色（納茲、加吉爾）。放後列使用。',
    status: pending,
  },
  {
    id: 'FT/S09-T09', series: SERIES, name: t('ナツ・ドラグニル', '納茲·多拉格尼爾'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 3000, soul: 1, triggers: [], traits: [MAGIC, DRAGON], abilities: [],
    note: '沒有效果，但是Lv0就有3000。',
    status: pending,
  },
  {
    id: 'FT/S09-T10', series: SERIES, name: t('若き竜 ナツ', '年輕的龍 納茲'),
    type: 'character', color: 'red', level: 1, cost: 0, power: 1500, soul: 1, triggers: [], traits: [MAGIC, DRAGON],
    abilities: [{
      kind: 'activated', keyword: { id: 'backup', power: 1500, level: 1 }, timing: 'counter',
      cost: [{ kind: 'discardSource' }],
      effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'inBattleWithSource' }, amount: 1500, duration: 'thisTurn' }],
      text: t('【起】【カウンター】助太刀1500 レベル1［手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋1500）',
        '【起】【反擊】助太刀1500 等級1［手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+1500)'),
    }],
    note: '防守卡：對手正打你的角色時，不用付能量就能從手牌丟出，被打的角色+1500。自己的等級要達到1才能用。',
    status: pending,
  },
  {
    id: 'FT/S09-T11', series: SERIES, name: t('鉄の滅竜魔導士 ガジル', '鐵之滅龍魔導士 加吉爾'),
    type: 'character', color: 'red', level: 2, cost: 2, power: 9000, soul: 2, triggers: ['soul'], traits: [MAGIC, DRAGON], abilities: [],
    note: '沒有效果，Lv2就有9000、魂傷2。',
    status: pending,
  },
  {
    id: 'FT/S09-T12', series: SERIES, name: t('炎の滅竜魔導士 ナツ', '火之滅龍魔導士 納茲'),
    type: 'character', color: 'red', level: 3, cost: 2, power: 9500, soul: 2, triggers: ['soul'], traits: [MAGIC, DRAGON],
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'countAtLeast', selector: { zone: 'waitingRoom', side: 'self', filter: { name: N.roar }, count: 'all' }, n: 2 },
        effects: [{ op: 'modifyPower', target: self, amount: 2000, duration: 'whileActive' }],
        text: t('【永】あなたの控え室の「火竜の咆哮」が2枚以上なら、このカードのパワーを＋2000。', '【永】你的休息室的「火龍的咆哮」在2張以上的話，此卡的攻擊力+2000。'),
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        effects: [{ op: 'moveCards', from: { zone: 'clock', side: 'self', count: { exactly: 1 }, position: 'top' }, to: { zone: 'waitingRoom', side: 'self' } }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚を、控え室に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以將自己的傷害區上方1張，放到休息室。'),
      },
    ],
    note: '登場時回1血。休息室有2張以上「火龍的咆哮」時變成11500。',
    status: pending,
  },
  {
    id: 'FT/S09-T13', series: SERIES, name: t('Ｓ級クエスト', 'S級任務'),
    type: 'event', color: 'red', level: 1, cost: 0, triggers: [], traits: [],
    abilities: [{
      kind: 'event',
      effects: [{
        op: 'grantAbility', target: { zone: 'stage', side: 'self', count: { upTo: 2 } }, duration: 'thisTurn',
        ability: {
          kind: 'auto', trigger: { event: 'battleOpponentReversed' }, optional: true,
          cost: [{ kind: 'stock', n: 1 }],
          effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { type: 'character' }, count: { exactly: 1 } }, to: toHand }],
          text: t('【自】［①］このカードのバトル相手が【リバース】した時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のキャラを1枚選び、手札に戻す。',
            '【自】［①］此卡的戰鬥對手【倒置】時，你可以支付代價。支付代價的話，你選擇自己休息室的角色1張，回到手牌。'),
        },
      }],
      text: t('あなたは自分のキャラを2枚まで選び、そのターン中、次の能力を与える。『【自】［①］このカードのバトル相手が【リバース】した時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のキャラを1枚選び、手札に戻す。』',
        '你選擇自己的角色最多2張，在那個回合中，給予以下能力。『【自】［①］此卡的戰鬥對手【倒置】時，你可以支付代價。支付代價的話，你選擇自己休息室的角色1張，回到手牌。』'),
    }],
    note: '主要階段使用：選最多2張角色，這回合它們打倒對手時，可以付1能量從休息室撿回1張角色。',
    status: pending,
  },
  {
    id: 'FT/S09-T14', series: SERIES, name: t(N.roar, '火龍的咆哮'),
    type: 'climax', color: 'red', triggers: ['soul', 'soul'], traits: [],
    abilities: [{
      kind: 'auto', trigger: { event: 'placedToClimaxZone' },
      effects: [
        { op: 'moveCards', from: { zone: 'deck', side: 'self', count: { exactly: 1 }, fromTop: 1 }, to: { zone: 'stock', side: 'self' } },
        { op: 'modifySoul', target: selfStage(), amount: 1, duration: 'thisTurn' },
      ],
      text: t('【自】このカードが手札からクライマックス置場に置かれた時、あなたは自分の山札の上から1枚を、ストック置場に置き、自分のキャラすべてに、そのターン中、ソウルを＋1。',
        '【自】此卡從手牌被放置到名場面區時，你將自己的牌組上方1張，放到能量區，自己的角色全部，在那個回合中，魂傷+1。'),
    }],
    note: '打出時：牌組最上面1張進能量區，全部角色這回合魂傷+1（攻擊力不加）。這張進休息室後，2張以上會讓「火之滅龍魔導士 納茲」+2000。',
    status: pending,
  },
  {
    id: 'FT/S09-101', series: SERIES, name: t('キュートな星霊使い♥ルーシィ', '可愛的星靈魔導士♥露西'),
    type: 'character', color: 'green', level: 1, cost: 1, power: 3000, soul: 1, triggers: ['soul'], traits: [MAGIC, KEY],
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: selfStage({ trait: '魔法', excludeSource: true }), amount: 500, duration: 'whileActive' }],
        text: t('【永】他のあなたの《魔法》のキャラすべてに、パワーを＋500。', '【永】其他的你的《魔法》的角色全部，攻擊力+500。'),
      },
      {
        kind: 'activated',
        cost: [{ kind: 'stock', n: 1 }],
        effects: [{ op: 'modifyPower', target: oneOfMine(), amount: 1500, duration: 'thisTurn' }],
        text: t('【起】［①］あなたは自分のキャラを1枚選び、そのターン中、パワーを＋1500。', '【起】［①］你選擇自己的角色1張，在那個回合中，攻擊力+1500。'),
      },
    ],
    note: '其他《魔法》角色全部+500。付1能量讓1張角色這回合+1500，可以用好幾次。',
    status: pending,
  },
  {
    id: 'FT/S09-102', series: SERIES, name: t('鎧の魔導士 エルザ', '鎧甲魔導士 艾爾莎'),
    type: 'character', color: 'red', level: 2, cost: 2, power: 8500, soul: 2, triggers: ['soul'], traits: [MAGIC, t('武器', '武器')],
    abilities: [{
      kind: 'auto', keyword: { id: 'encore' }, trigger: { event: 'sourceLeavesStageToWaitingRoom' }, optional: true,
      cost: [{ kind: 'deckTopToClock' }],
      effects: [{ op: 'returnSourceToSlot', state: 'rest' }],
      text: t('【自】アンコール［あなたの山札の上から1枚をクロック置場に置く］（このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、このカードがいた枠に【レスト】して置く）',
        '【自】安可［將你的牌組上方1張放到傷害區］(此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，將此卡【橫置】放到原本的格子)'),
    }],
    note: '被打倒時，可以把牌組最上面1張放進傷害區（自己吃1點傷害），讓她橫置回到原本的格子。不用付能量就能安可。',
    status: pending,
  },
  {
    id: 'FT/S09-103', series: SERIES, name: t('炎の魔導士 ナツ', '火焰魔導士 納茲'),
    type: 'character', color: 'red', level: 1, cost: 1, power: 7000, soul: 1, triggers: [], traits: [MAGIC, DRAGON], abilities: [],
    note: '沒有效果，但是Lv1就有7000。',
    status: pending,
  },
  {
    id: 'FT/S09-104', series: SERIES, name: t('ハッピーが生まれた日', '哈比誕生的日子'),
    type: 'climax', color: 'red', triggers: ['soul', 'soul'], traits: [],
    abilities: [{
      kind: 'continuous', effects: [{ op: 'modifySoul', target: selfStage(), amount: 2, duration: 'whileActive' }],
      text: t('【永】あなたのキャラすべてに、ソウルを＋2。', '【永】你的角色全部，魂傷+2。'),
    }],
    note: '沒有連動角色，效果就是全隊魂傷+2，用來把傷害打高。判定翻到這張時：這次攻擊魂傷+2。',
    status: pending,
  },
  {
    id: 'FT/S09-105', series: SERIES, name: t('氷の造形魔導士 グレイ', '冰之造形魔導士 格雷'),
    type: 'character', color: 'green', level: 0, cost: 0, power: 2500, soul: 1, triggers: [], traits: [MAGIC, t('氷', '冰')],
    abilities: [{
      kind: 'activated',
      cost: [{ kind: 'stock', n: 2 }],
      effects: [{ op: 'modifyPower', target: self, amount: 5000, duration: 'thisTurn' }],
      text: t('【起】［②］そのターン中、このカードのパワーを＋5000。', '【起】［②］在那個回合中，此卡的攻擊力+5000。'),
    }],
    note: 'Lv0就有2500，付2能量這回合變成7500，可以打倒高等級的角色。',
    status: pending,
  },
];

// 預組內容（張數取自檔名；與 data/decks/FT-S09.csv 一致）
export const deck = ([
  ['T01', 4], ['T02', 4], ['T03', 2], ['T04', 2], ['T05', 2], ['T06', 2], ['T07', 4], ['T08', 2], ['T09', 4], ['T10', 2],
  ['T11', 2], ['T12', 4], ['T13', 2], ['T14', 2], ['101', 2], ['102', 4], ['103', 2], ['104', 2], ['105', 2],
] as const).map(([n, c]) => ({ cardId: `FT/S09-${n}`, count: c as number }));

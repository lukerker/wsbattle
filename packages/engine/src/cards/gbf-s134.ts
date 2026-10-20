// 碧藍幻想 預組 GBF/S134（15 種、50 張）。全部藍色。
// 日文依卡面圖片讀出；中文與白話說明參考預組卡表（卡表有幾處和卡面不同，以卡面為準，見 review）。
import type { Ability, Card, CardFilter, Selector, Text } from '../card-schema.ts';

const SERIES = 'GBF';
const t = (ja: string, zh: string): Text => ({ ja, zh });
const GB = 'グラブル';
const gbChar: CardFilter = { type: 'character', trait: GB };

const source: Selector = { zone: 'stage', side: 'self', count: 'all', relation: 'source' };
const selfStage = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: 'all' });
const otherGb: Selector = { zone: 'stage', side: 'self', filter: { trait: GB, excludeSource: true }, count: 'all' };
const handDiscard = (filter?: CardFilter): Selector => ({ zone: 'hand', side: 'self', filter, count: { exactly: 1 } });
const battleChar: Selector = { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'inBattleWithSource' };
const toWaitingRoom = { zone: 'waitingRoom' as const, side: 'self' as const };
const toHand = { zone: 'hand' as const, side: 'self' as const };
const anySlot = { zone: 'stage' as const, side: 'self' as const, slot: 'any' as const };

const TRAITS = [t(GB, '碧藍幻想'), t('グランサイファー', '古蘭賽法')];

const N = {
  rackam: '蒼空の先導者 ラカム',
  rosetta: '蒼麗の薔薇 ロゼッタ',
  io: '蒼翠の魔法少女 イオ',
  cxMale: '十天の極みに至りし者 主人公(男)',
  cxFemale: '十天の極みに至りし者 主人公(女)',
};

const climax = (): Ability => ({
  kind: 'continuous',
  effects: [
    { op: 'modifyPower', target: selfStage(), amount: 1000, duration: 'whileActive' },
    { op: 'modifySoul', target: selfStage(), amount: 1, duration: 'whileActive' },
  ],
  text: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【ゲート】：このカードがトリガーした時、あなたは自分の控え室のCXを1枚選び、手札に戻してよい）',
    '【永】你的角色全部，攻擊力+1000，魂傷+1。(門：當你判定出此卡時，你可以選擇自己休息室的1張名場面，回到手牌)'),
});

const pending = { translated: true, coded: true, verified: false, tested: true }; // 情境測試：game/cards-gbf.test.ts

export const cards: Card[] = [
  {
    id: 'GBF/S134-T01', series: SERIES, name: t('赤き竜 ビィ', '赤之龍 碧'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 500, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: otherGb, amount: 500, duration: 'whileActive' }],
        text: t('【永】他のあなたの《グラブル》のキャラすべてに、パワーを＋500。', '【永】其他的你的《碧藍幻想》的角色全部，攻擊力+500。'),
      },
      {
        kind: 'auto', trigger: { event: 'allyFrontAttacked', filter: { trait: GB } }, optional: true,
        cost: [{ kind: 'stock', n: 1 }, { kind: 'sendSourceToWaitingRoom' }],
        effects: [{ op: 'modifyPower', target: battleChar, amount: 3000, duration: 'thisTurn' }],
        text: t('【自】［① このカードを控え室に置く］他のあなたの《グラブル》のキャラがフロントアタックされた時、あなたはコストを払ってよい。そうしたら、あなたは自分のバトル中のキャラを1枚選び、そのターン中、パワーを＋3000。',
          '【自】［① 將此卡放到休息室］其他的你的《碧藍幻想》的角色被正打時，你可以支付代價。支付代價的話，你選擇自己戰鬥中的角色1張，在那個回合中，攻擊力+3000。'),
      },
    ],
    note: '放後列：其他《碧藍幻想》角色全部+500。對手正打你其他的《碧藍幻想》角色時，付1能量並把碧送進休息室，被打的角色這回合+3000，常常能反殺對手。',
    status: pending,
  },
  {
    id: 'GBF/S134-T02', series: SERIES, name: t('蒼き剣と誇りにかけて シャルロッテ', '賭上蒼之劍與榮耀 夏洛特'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 500, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'myTurn' },
        effects: [{ op: 'modifyPower', target: otherGb, amount: 500, duration: 'whileActive' }],
        text: t('【永】あなたのターン中、他のあなたの《グラブル》のキャラすべてに、パワーを＋500。', '【永】在你的回合中，其他的你的《碧藍幻想》的角色全部，攻擊力+500。'),
      },
      {
        kind: 'activated', keyword: { id: 'concentrate' },
        cost: [{ kind: 'stock', n: 1 }, { kind: 'restSource' }],
        effects: [
          { op: 'revealMill', n: 5, bind: 'milled', result: 'draw' },
          { op: 'drawCards', n: { countOfBound: 'milled', filter: { type: 'climax' } } },
        ],
        text: t('【起】集中［① このカードを【横】する］あなたは自分の山札の上から5枚をめくり、控え室に置く。それらのカードのCX1枚につき、あなたは1枚まで引く。',
          '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻5張，放到休息室。那些卡片中每有1張名場面，你抽最多1張牌。'),
      },
    ],
    note: '自己回合時，其他《碧藍幻想》角色全部+500。集中：付1能量並把她橫置，翻5張進休息室，每翻到1張名場面就抽1張。橫置後這回合不能攻擊，建議放後列使用。',
    status: pending,
  },
  {
    id: 'GBF/S134-T03', series: SERIES, name: t('荘厳の双刃 ヴィーラ', '莊嚴的雙刃 維拉'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [{
      kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
      cost: [{ kind: 'discard', selector: handDiscard() }],
      effects: [{ op: 'revealTopLevelRecover' }],
      text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札の上から1枚を公開し、自分の控え室のレベルX以下のキャラを1枚選び、手札に戻す。Xは公開されたカードのレベルに等しい。（CXのレベルは0として扱う。公開したカードは元に戻す）',
        '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你將自己的牌組上方1張公開，選擇自己休息室的等級X以下的角色1張，回到手牌。X等於公開的卡片的等級。(名場面視為等級0。公開的卡片放回原位)'),
    }],
    note: '登場時丟1張手牌：翻開牌組最上面1張看等級（看完放回），再從休息室撿回1張等級不超過它的角色。翻到Lv0或名場面只能撿Lv0；翻到Lv1可以撿Lv0或Lv1，依此類推。',
    status: pending,
  },
  {
    id: 'GBF/S134-T04', series: SERIES, name: t('空艇の導き手 ノア', '飛艇的引導者 諾亞'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'myClimaxPhaseStart' },
        condition: { kind: 'countAtLeast', selector: selfStage({ name: N.rackam }), n: 1 },
        effects: [
          { op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: { name: N.rackam }, count: { exactly: 1 }, as: 'rackam' }, amount: 3000, duration: 'thisTurn' },
          { op: 'modifySoul', target: { zone: 'stage', side: 'self', count: 'all', fromBind: 'rackam' }, amount: 1, duration: 'thisTurn' },
          {
            op: 'grantAbility', target: { zone: 'stage', side: 'self', count: 'all', fromBind: 'rackam' }, duration: 'thisTurn',
            ability: {
              kind: 'auto', trigger: { event: 'attacks' },
              effects: [{ op: 'lookTopReorder', n: 2 }],
              text: t('【自】このカードがアタックした時、あなたは自分の山札を上から2枚まで見て、山札の上に好きな順番で置く。', '【自】此卡攻擊時，你從自己的牌組上方看最多2張，以喜歡的順序放回牌組上方。'),
            },
          },
        ],
        text: t('【自】あなたのCXフェイズの始めに、あなたは自分の「蒼空の先導者 ラカム」を1枚選び、そのターン中、パワーを＋3000し、ソウルを＋1し、次の能力を与える。『【自】このカードがアタックした時、あなたは自分の山札を上から2枚まで見て、山札の上に好きな順番で置く。』',
          '【自】在你的名場面階段開始時，你選擇自己的「蒼空的先導者 拉卡姆」1張，在那個回合中，攻擊力+3000，魂傷+1，給予以下能力。『【自】此卡攻擊時，你從自己的牌組上方看最多2張，以喜歡的順序放回牌組上方。』'),
        review: ['卡表寫「你可以選擇」，但卡面是「選び」（一定要選），以卡面為準：場上有拉卡姆就一定會選。', '「2枚まで見て」：目前固定看 2 張。'],
      },
      {
        kind: 'auto', keyword: { id: 'bond', targetName: N.rackam }, trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard() }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { name: N.rackam }, count: { exactly: 1 } }, to: toHand }],
        text: t('【自】絆／「蒼空の先導者 ラカム」［手札を1枚控え室に置く］（このカードがプレイされて舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「蒼空の先導者 ラカム」を1枚選び、手札に戻す）',
          '【自】絆／「蒼空的先導者 拉卡姆」［手牌1張放到休息室］(此卡被使用被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「蒼空的先導者 拉卡姆」1張，回到手牌)'),
      },
    ],
    note: '專門搭配「蒼空的先導者 拉卡姆」（Lv1 攻擊5500）。名場面階段開始時，拉卡姆這回合+3000、魂傷+1，攻擊時還能看牌組上方2張排順序（把名場面排到後面，或把好牌排到判定）。絆：諾亞從手牌登場時丟1張，從休息室撿回拉卡姆。',
    status: pending,
  },
  {
    id: 'GBF/S134-T05', series: SERIES, name: t('蒼天の守護騎士 カタリナ', '蒼天的守護騎士 卡塔莉娜'),
    type: 'character', color: 'blue', level: 0, cost: 0, power: 2500, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous', rules: ['doesNotStand'], condition: { kind: 'noOthers', selector: otherGb }, effects: [],
        text: t('【永】他のあなたの《グラブル》のキャラがいないなら、このカードはあなたのスタンドフェイズに【スタンド】しない。', '【永】沒有其他的你的《碧藍幻想》的角色存在的話，此卡在你的起立階段不【直立】。'),
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{
          op: 'grantAbility', target: { zone: 'stage', side: 'self', count: { exactly: 1 } }, duration: 'thisTurn',
          ability: {
            kind: 'auto', trigger: { event: 'battleOpponentReversed' },
            effects: [{ op: 'restAndMoveToBack', target: { zone: 'stage', side: 'self', filter: { excludeSource: true }, count: { exactly: 1 } } }],
            text: t('【自】このカードのバトル相手が【リバース】した時、あなたは他の自分のキャラを1枚選び、【レスト】し、後列のキャラのいない枠に動かす。', '【自】此卡的戰鬥對手【倒置】時，你選擇其他的自己的角色1張，【橫置】，移動到後列的沒有角色的格子。'),
          },
        }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のキャラを1枚選び、そのターン中、次の能力を与える。『【自】このカードのバトル相手が【リバース】した時、あなたは他の自分のキャラを1枚選び、【レスト】し、後列のキャラのいない枠に動かす。』',
          '【自】此卡從手牌被放置到舞台時，你選擇自己的角色1張，在那個回合中，給予以下能力。『【自】此卡的戰鬥對手【倒置】時，你選擇其他的自己的角色1張，【橫置】，移動到後列的沒有角色的格子。』'),
      },
    ],
    note: 'Lv0就有2500。場上沒有其他《碧藍幻想》角色時，她起立階段不會直立（下回合不能攻擊）。登場時選1張角色（可以選她自己），這回合那張角色打倒對手後，可以把另一張角色橫置撤到後列空格，保護下回合會被打倒的隊友。',
    status: pending,
  },
  {
    id: 'GBF/S134-T06', series: SERIES, name: t('蒼醒の志士 オイゲン', '蒼醒之志士 歐根'),
    type: 'character', color: 'blue', level: 1, cost: 0, power: 2000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'usedBackup' },
        condition: { kind: 'countAtLeast', selector: selfStage({ trait: GB }), n: 1 },
        effects: [{ op: 'modifyPower', target: battleChar, amount: 1000, duration: 'thisTurn' }],
        text: t('【自】あなたがこのカードの「助太刀」を使った時、あなたの《グラブル》のキャラがいるなら、あなたは自分のバトル中のキャラを1枚選び、そのターン中、パワーを＋1000。',
          '【自】當你使用此卡的『助太刀』時，有你的《碧藍幻想》的角色存在的話，你選擇自己戰鬥中的角色1張，在那個回合中，攻擊力+1000。'),
      },
      {
        kind: 'activated', keyword: { id: 'backup', power: 1000, level: 1 }, timing: 'counter',
        cost: [{ kind: 'discardSource' }],
        effects: [{ op: 'modifyPower', target: battleChar, amount: 1000, duration: 'thisTurn' }],
        text: t('【起】【カウンター】助太刀1000 レベル1［手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋1000）',
          '【起】【反擊】助太刀1000 等級1［手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+1000)'),
      },
    ],
    note: '防守卡：對手正打你的角色時，不用付能量就能從手牌丟出，被打的角色+1000；場上有《碧藍幻想》角色的話再+1000，合計+2000。自己的等級要達到1才能用。',
    status: pending,
  },
  {
    id: 'GBF/S134-T07', series: SERIES, name: t('十天衆を総べし者 主人公(男)', '統領十天眾者 主人公(男)'),
    type: 'character', color: 'blue', level: 1, cost: 0, power: 4000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'countAtLeast', selector: otherGb, n: 2 },
        effects: [{ op: 'modifyPower', target: source, amount: 2000, duration: 'whileActive' }],
        text: t('【永】他のあなたの《グラブル》のキャラが2枚以上なら、このカードのパワーを＋2000。', '【永】其他的你的《碧藍幻想》的角色存在2張以上的話，此卡的攻擊力+2000。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxMale }, trigger: { event: 'attacks' },
        condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: N.cxMale }, { kind: 'countAtLeast', selector: otherGb, n: 2 }] },
        effects: [{ op: 'lookTopPick', look: 4, pick: { filter: { anyOf: [gbChar, { type: 'event' }] }, upTo: 1 }, rest: 'waitingRoom' }],
        text: t('【自】【CXコンボ】このカードがアタックした時、CX置場に「十天の極みに至りし者 主人公(男)」があり、他のあなたの《グラブル》のキャラが2枚以上なら、あなたは自分の山札を上から4枚まで見て、《グラブル》のキャラかイベントを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。',
          '【自】【CX連動】此卡攻擊時，名場面區有「達到十天之極者 主人公(男)」，其他的你的《碧藍幻想》的角色存在2張以上的話，你從自己的牌組上方看最多4張，選擇《碧藍幻想》的角色或事件最多1張給對手確認，加到手牌，剩下的卡片放到休息室。'),
        review: ['「《グラブル》のキャラかイベント」讀成「《碧藍幻想》角色，或任何事件」（事件卡沒有特徵）。'],
      },
    ],
    note: '場上有其他2張以上《碧藍幻想》角色時，Lv1就是6000。連動名場面「達到十天之極者 主人公(男)」：攻擊就觸發（不用打倒對手），看4張拿1張《碧藍幻想》角色或事件。',
    status: pending,
  },
  {
    id: 'GBF/S134-T08', series: SERIES, name: t(N.rackam, '蒼空的先導者 拉卡姆'),
    type: 'character', color: 'blue', level: 1, cost: 0, power: 5500, soul: 1, triggers: [], traits: TRAITS, abilities: [],
    note: '沒有效果，但是Lv1、費用0就有5500。搭配「飛艇的引導者 諾亞」：名場面階段開始時+3000、魂傷+1，攻擊時還能排牌組上方2張的順序。',
    status: pending,
  },
  {
    id: 'GBF/S134-T09', series: SERIES, name: t(N.rosetta, '蒼麗的薔薇 蘿賽塔'),
    type: 'character', color: 'blue', level: 2, cost: 1, power: 5500, soul: 1, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: otherGb, amount: 1000, duration: 'whileActive' }],
        text: t('【永】他のあなたの《グラブル》のキャラすべてに、パワーを＋1000。', '【永】其他的你的《碧藍幻想》的角色全部，攻擊力+1000。'),
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard(gbChar) }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { name: N.io }, count: { exactly: 1 } }, to: anySlot }],
        text: t('【自】［手札の《グラブル》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「蒼翠の魔法少女 イオ」を1枚選び、舞台の好きな枠に置く。',
          '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「蒼翠的魔法少女 伊歐」1張，放到舞台上喜歡的格子。'),
        review: ['卡表寫「薔薇之薔薇 蘿賽塔」，卡面是「蒼麗の薔薇 ロゼッタ」，以卡面為準。', '「舞台の好きな枠に置く」：可以放到有角色的格子，原本的角色會進休息室。'],
      },
    ],
    note: '放後列：其他《碧藍幻想》角色全部+1000。登場時丟1張《碧藍幻想》角色，從休息室把「蒼翠的魔法少女 伊歐」直接放上舞台（不用付費）。伊歐在前列、蘿賽塔在後列時，伊歐是9500。',
    status: pending,
  },
  {
    id: 'GBF/S134-T10', series: SERIES, name: t(N.io, '蒼翠的魔法少女 伊歐'),
    type: 'character', color: 'blue', level: 2, cost: 1, power: 6500, soul: 1, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'countAtLeast', selector: selfStage({ name: N.rosetta, row: 'back', excludeSource: true }), n: 1 },
        effects: [
          { op: 'modifyPower', target: source, amount: 3000, duration: 'whileActive' },
          {
            op: 'grantAbility', target: source, duration: 'whileActive',
            ability: {
              kind: 'auto', trigger: { event: 'attacks' }, optional: true,
              cost: [{ kind: 'stock', n: 1 }],
              effects: [{ op: 'extraTriggerCheck' }],
              text: t('【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。', '【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行2次判定。'),
            },
          },
        ],
        text: t('【永】他のあなたの後列の「蒼麗の薔薇 ロゼッタ」がいるなら、このカードのパワーを＋3000し、このカードは次の能力を得る。『【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。』',
          '【永】有其他的你的後列的「蒼麗的薔薇 蘿賽塔」存在的話，此卡的攻擊力+3000，此卡獲得以下能力。『【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行2次判定。』'),
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard(gbChar) }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { name: N.rosetta }, count: { exactly: 1 } }, to: anySlot }],
        text: t('【自】［手札の《グラブル》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「蒼麗の薔薇 ロゼッタ」を1枚選び、舞台の好きな枠に置く。',
          '【自】［手牌的《碧藍幻想》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「蒼麗的薔薇 蘿賽塔」1張，放到舞台上喜歡的格子。'),
      },
    ],
    note: '後列有「蒼麗的薔薇 蘿賽塔」時，她是9500（再加蘿賽塔的+1000就是10500），攻擊時還能付1能量判定2次。登場時丟1張《碧藍幻想》角色，從休息室把蘿賽塔直接放上舞台（放後列）。',
    status: pending,
  },
  {
    id: 'GBF/S134-T11', series: SERIES, name: t('蒼の少女 ルリア', '蒼之少女 露莉亞'),
    type: 'character', color: 'blue', level: 3, cost: 2, power: 9000, soul: 2, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: otherGb, amount: 1500, duration: 'whileActive' }],
        text: t('【永】他のあなたの《グラブル》のキャラすべてに、パワーを＋1500。', '【永】其他的你的《碧藍幻想》的角色全部，攻擊力+1500。'),
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [
          { op: 'moveCards', from: { zone: 'hand', side: 'self', filter: { type: 'character', levelAtMostPlayerLevel: true }, count: { upTo: 1 } }, to: anySlot, bind: 'placed' },
          { op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', fromBind: 'placed' }, amount: 2000, duration: 'thisTurn' },
        ],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の手札の自分のレベル以下のレベルのキャラを1枚まで選び、舞台の好きな枠に置き、そのターン中、そのキャラのパワーを＋2000。',
          '【自】此卡從手牌被放置到舞台時，你選擇自己手牌中等級在自己等級以下的角色最多1張，放到舞台上喜歡的格子，在那個回合中，那張角色的攻擊力+2000。'),
        review: ['用這個效果放到舞台的角色，也算「從手牌被放置到舞台」，它自己的登場效果會發動。'],
      },
      {
        kind: 'auto', trigger: { event: 'encoreStepStart', side: 'opponent' },
        condition: { kind: 'noOthers', selector: selfStage({ nameIncludes: ['主人公(男)', '主人公(女)'], excludeSource: true }) },
        effects: [{ op: 'moveCards', from: { ...source, count: { exactly: 1 } }, to: toWaitingRoom }],
        text: t('【自】相手のアンコールステップの始めに、他のあなたのカード名に「主人公(男)」か「主人公(女)」を含むキャラがいないなら、このカードを控え室に置く。',
          '【自】在對手的安可步驟開始時，沒有其他的你的卡名包含「主人公(男)」或「主人公(女)」的角色存在的話，將此卡放到休息室。'),
      },
    ],
    note: '其他《碧藍幻想》角色全部+1500。登場時可以從手牌免費再放1張角色上場（等級不能超過你的等級），那張這回合+2000。注意：對手回合的安可步驟開始時，場上沒有其他名字有「主人公」的角色，露莉亞就會進休息室。',
    status: pending,
  },
  {
    id: 'GBF/S134-T12', series: SERIES, name: t('十天衆を総べし者 主人公(女)', '統領十天眾者 主人公(女)'),
    type: 'character', color: 'blue', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        effects: [{ op: 'moveCards', from: { zone: 'clock', side: 'self', count: { exactly: 1 }, position: 'top' }, to: toWaitingRoom }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚を、控え室に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以將自己的傷害區上方1張，放到休息室。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.cxFemale }, trigger: { event: 'attacks' }, optional: true,
        condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: N.cxFemale }, { kind: 'countAtLeast', selector: otherGb, n: 1 }] },
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard() }],
        effects: [
          { op: 'dealDamage', amount: 1, cancelable: true },
          { op: 'lookOpponentTopArrange', n: 2 },
        ],
        text: t('【自】【CXコンボ】［① 手札を1枚控え室に置く］このカードがアタックした時、CX置場に「十天の極みに至りし者 主人公(女)」があり、他のあなたの《グラブル》のキャラがいるなら、あなたはコストを払ってよい。そうしたら、相手に1ダメージを与え、あなたは相手の山札を上から2枚まで見て、カードを2枚まで選び、山札の上に好きな順番で置き、残りのカードを控え室に置く。（ダメージキャンセルは発生する）',
          '【自】【CX連動】［① 手牌1張放到休息室］此卡攻擊時，名場面區有「達到十天之極者 主人公(女)」，有其他的你的《碧藍幻想》的角色存在的話，你可以支付代價。支付代價的話，給對手1點傷害，你從對手的牌組上方看最多2張，選擇最多2張以喜歡的順序放回牌組上方，剩下的卡片放到休息室。(會發生傷害取消)'),
        review: ['「2枚まで見て」：目前固定看 2 張。'],
      },
    ],
    note: '登場時回1血。連動名場面「達到十天之極者 主人公(女)」：攻擊時付1能量並丟1張，先給對手1點傷害（可能被取消），再看對手牌組上方2張：名場面丟進休息室，留下的排好順序，讓對手接下來的傷害比較難取消。',
    status: pending,
  },
  {
    id: 'GBF/S134-T13', series: SERIES, name: t('よろず屋 シェロカルテ', '萬事屋 榭洛卡特'),
    type: 'event', color: 'blue', level: 1, cost: 0, triggers: [], traits: [],
    abilities: [{
      kind: 'event', timing: 'counter',
      effects: [
        { op: 'lookTopPick', look: 4, pick: { filter: gbChar, upTo: 1 }, rest: 'waitingRoom' },
        { op: 'sourceToDeckBottom' },
      ],
      text: t('【カウンター】あなたは自分の山札を上から4枚まで見て、《グラブル》のキャラを1枚まで選んで相手に見せ、手札に加え、残りのカードを控え室に置く。このカードを山札の下に置く。',
        '【反擊】你從自己的牌組上方看最多4張，選擇《碧藍幻想》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。將此卡放到牌組下方。'),
      review: ['有反擊圖示的事件：自己的主要階段可以用，對手正打你時的反擊步驟也可以用〔2.8.2.1、7.4.1.2.1〕。用完放到牌組最下面，不進休息室。'],
    }],
    note: '0費的找牌事件：看4張拿1張《碧藍幻想》角色，用完放回牌組最下面。自己回合的主要階段可以用；對手正打你時也能在反擊步驟用（但這樣就不能再用助太刀，一次只能用1張）。',
    status: pending,
  },
  {
    id: 'GBF/S134-T14', series: SERIES, name: t(N.cxMale, '達到十天之極者 主人公(男)'),
    type: 'climax', color: 'blue', triggers: ['soul', 'gate'], traits: [], abilities: [climax()],
    note: '在名場面階段從手牌打出，效果持續到這回合結束：全部角色攻擊力+1000、魂傷+1。連動：「統領十天眾者 主人公(男)」（Lv1）。判定翻到這張時：魂傷+1，還可以從休息室撿回1張名場面。',
    status: pending,
  },
  {
    id: 'GBF/S134-T15', series: SERIES, name: t(N.cxFemale, '達到十天之極者 主人公(女)'),
    type: 'climax', color: 'blue', triggers: ['soul', 'gate'], traits: [], abilities: [climax()],
    note: '在名場面階段從手牌打出，效果持續到這回合結束：全部角色攻擊力+1000、魂傷+1。連動：「統領十天眾者 主人公(女)」（Lv3）。判定翻到這張時：魂傷+1，還可以從休息室撿回1張名場面。',
    status: pending,
  },
];

// 預組內容（張數取自檔名；與 data/decks/GBF-S134.csv 一致）
export const deck = ([
  ['T01', 4], ['T02', 4], ['T03', 2], ['T04', 4], ['T05', 4], ['T06', 2], ['T07', 4], ['T08', 4],
  ['T09', 2], ['T10', 4], ['T11', 4], ['T12', 2], ['T13', 2], ['T14', 4], ['T15', 4],
] as const).map(([n, c]) => ({ cardId: `GBF/S134-${n}`, count: c as number }));

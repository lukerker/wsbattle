// 孤獨搖滾 預組 BTR/W107（20 種、50 張）。
// 日文原文由卡面圖讀出（尚未經使用者核對）；中文與白話說明取自使用者整理的《孤獨搖滾 預組卡表》。
import type { Ability, Card, CardFilter, Selector, Text } from '../card-schema.ts';

const SERIES = 'BTR';
const t = (ja: string, zh: string): Text => ({ ja, zh });
const music: CardFilter = { trait: '音楽' };

const selfStage = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: 'all' });
const otherMusicOnStage: Selector = { zone: 'stage', side: 'self', filter: { trait: '音楽', excludeSource: true }, count: 'all' };
const musicOnStage: Selector = { zone: 'stage', side: 'self', filter: music, count: 'all' };
const handDiscard = (filter?: CardFilter): Selector => ({ zone: 'hand', side: 'self', filter, count: { exactly: 1 } });
const toWaitingRoom = { zone: 'waitingRoom' as const, side: 'self' as const };
const toHand = { zone: 'hand' as const, side: 'self' as const };

const TRAIT_MUSIC = t('音楽', '音樂');
const TRAIT_PERSON = t('しっかり者', '認真的人'); // 譯名待確認
const TRAIT_ODD = t('変人', '怪人'); // 譯名待確認
const TRAIT_POPULAR = t('人気者', '人氣者');

const assist = (amount: number, ja: string, zh: string): Ability => ({
  kind: 'continuous',
  keyword: { id: 'assist' },
  effects: [
    {
      op: 'modifyPower',
      target: { zone: 'stage', side: 'self', count: 'all', relation: 'frontOfSource' },
      amount,
      duration: 'whileActive',
    },
  ],
  text: t(ja, zh),
});

const encore = (discard: Selector, ja: string, zh: string): Ability => ({
  kind: 'auto',
  keyword: { id: 'encore' },
  trigger: { event: 'sourceLeavesStageToWaitingRoom' },
  optional: true,
  cost: [{ kind: 'discard', selector: discard }],
  effects: [{ op: 'returnSourceToSlot', state: 'rest' }],
  text: t(ja, zh),
});

const pending = { translated: true, coded: true, verified: false, tested: false };

export const cards: Card[] = [
  {
    id: 'BTR/W107-T01', series: SERIES, name: t('伊地知虹夏', '伊地知虹夏'),
    type: 'character', color: 'yellow', level: 0, cost: 0, power: 500, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC, TRAIT_PERSON],
    abilities: [
      assist(500, '【永】応援 このカードの前のあなたのキャラすべてに、パワーを＋500。', '【永】應援 此卡前面的你的角色全部，攻擊力+500。'),
      {
        kind: 'activated',
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard({ type: 'climax' }) }],
        optional: true,
        effects: [{
          op: 'moveCards',
          from: { zone: 'waitingRoom', side: 'self', filter: { type: 'character' }, count: { exactly: 1 } },
          to: toHand,
        }],
        text: t('【起】［① 手札のクライマックスを1枚控え室に置く］あなたは自分の控え室のキャラを1枚選び、手札に戻す。',
          '【起】［① 手牌的名場面1張放到休息室］你選擇自己休息室的角色1張，回到手牌。'),
      },
    ],
    note: '放後列：她斜前方2格的角色+500（任何角色都可以）。付1能量並丟1張CX，從休息室撿回任意1張角色。手上多出來、用不到的CX，可以用這招換成角色。',
    status: pending,
  },
  {
    id: 'BTR/W107-T02', series: SERIES, name: t('バンドのまとめ役 伊地知虹夏', '樂團的領導者 伊地知虹夏'),
    type: 'character', color: 'yellow', level: 0, cost: 0, power: 500, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC, TRAIT_PERSON],
    abilities: [
      {
        kind: 'auto',
        trigger: { event: 'climaxPlaced', side: 'self', filter: { color: 'yellow' } },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: { exactly: 1 } }, amount: 1500, duration: 'thisTurn' }],
        text: t('【自】あなたの黄のクライマックスがクライマックス置場に置かれた時、あなたは自分のキャラを1枚選び、そのターン中、パワーを＋1500。',
          '【自】當你的黃色的名場面被放置到名場面區時，你選擇自己的角色1張，在那個回合中，攻擊力+1500。'),
      },
      {
        kind: 'activated',
        keyword: { id: 'concentrate' },
        cost: [{ kind: 'stock', n: 1 }, { kind: 'restSource' }],
        effects: [
          { op: 'moveCards', from: { zone: 'deck', side: 'self', count: { exactly: 5 }, fromTop: 5, chooser: 'self' }, to: toWaitingRoom, bind: 'milled' },
          { op: 'draw', upTo: { countOfBound: 'milled', filter: { type: 'climax' } } },
        ],
        text: t('【起】集中［① このカードを【横】する］あなたは自分の山札の上から5枚をめくり、控え室に置く。それらのカードのクライマックス1枚につき、あなたは1枚まで引く。',
          '【起】集中［① 將此卡【橫置】］你從自己的牌組上方翻5張，放到休息室。那些卡片中每有1張名場面，你抽最多1張牌。'),
      },
    ],
    note: '打出黃色CX（「憧憬的樂團活動」或「第一張的大合照」）時，選1張角色+1500。紅色CX「史上最糟的藝人照」不會觸發。集中：付1能量並把她橫置，翻5張，每1張CX抽1張。建議放後列使用。',
    status: pending,
  },
  {
    id: 'BTR/W107-T03', series: SERIES, name: t('とっておきのアイテム 山田リョウ', '特別準備的道具 山田涼'),
    type: 'character', color: 'yellow', level: 0, cost: 0, power: 2000, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC, TRAIT_ODD],
    abilities: [{
      kind: 'continuous', condition: { kind: 'stockAtMost', n: 3 },
      effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'source' }, amount: 2000, duration: 'whileActive' }],
      text: t('【永】あなたのストックが3枚以下なら、このカードのパワーを＋2000。', '【永】你的能量在3張以下的話，此卡的攻擊力+2000。'),
    }],
    note: '能量在3張以下時，她是4000，遊戲前期非常強。能量存到4張以上就會變回2000，適合前期在前列打。',
    status: pending,
  },
  {
    id: 'BTR/W107-T04', series: SERIES, name: t('リードギター 後藤ひとり', '主奏吉他手 後藤一里'),
    type: 'character', color: 'yellow', level: 1, cost: 0, power: 4500, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'source' }, amount: { per: musicOnStage, multiplier: 500, evaluate: 'atResolution' }, duration: 'thisTurn' }],
        text: t('【自】このカードが手札から舞台に置かれた時、そのターン中、このカードのパワーを＋X。Xはあなたの《音楽》のキャラの枚数×500に等しい。',
          '【自】此卡從手牌被放置到舞台時，在那個回合中，此卡的攻擊力+X。X等於你的《音樂》的角色張數×500。'),
        review: ['X 在結算當下算定（含她自己），之後場上張數變動不再影響。這是依企劃書「發動當下定值型」的設計；請對照官方總合規則確認此類寫法的結算時機。'],
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: '憧れたバンド活動' }, trigger: { event: 'attacks' },
        condition: { kind: 'all', of: [{ kind: 'climaxInZone', name: '憧れたバンド活動' }, { kind: 'countAtLeast', selector: otherMusicOnStage, n: 1 }] },
        effects: [{ op: 'lookTopPick', look: 4, pick: { filter: music, upTo: 1 }, rest: 'waitingRoom' }],
        text: t('【自】【CXコンボ】このカードがアタックした時、クライマックス置場に「憧れたバンド活動」があり、他のあなたの《音楽》のキャラがいるなら、あなたは自分の山札を上から4枚を見て、《音楽》のキャラを1枚まで選び相手に見せ、手札に加え、残りのカードを控え室に置く。',
          '【自】【CX連動】此卡攻擊時，名場面區有「憧憬的樂團活動」，有其他的你的《音樂》的角色存在的話，你從自己的牌組上方看最多4張，選擇《音樂》的角色最多1張給對手確認，加到手牌，剩下的卡片放到休息室。'),
      },
    ],
    note: '登場那回合，每有1張《音樂》角色（包含她自己）+500。場上5張都是《音樂》的話，她是7000。連動CX「憧憬的樂團活動」：攻擊就觸發，不用打倒對手。看4張，拿1張《音樂》角色。',
    status: pending,
  },
  {
    id: 'BTR/W107-T05', series: SERIES, name: t('ベース 山田リョウ', '貝斯 山田涼'),
    type: 'character', color: 'yellow', level: 1, cost: 0, power: 4500, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC, TRAIT_ODD],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'attacks' },
        effects: [{
          op: 'modifyPower',
          target: { zone: 'stage', side: 'self', filter: { trait: '音楽', excludeSource: true }, count: { exactly: 1 }, as: 'target' },
          amount: { perSoulOfBound: 'target', multiplier: 1000, evaluate: 'atResolution' },
          duration: 'thisTurn',
        }],
        text: t('【自】このカードがアタックした時、あなたは他の自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋X。Xはそのキャラのソウル×1000に等しい。',
          '【自】此卡攻擊時，你選擇其他的自己的《音樂》的角色1張，在那個回合中，攻擊力+X。X等於那張角色的魂傷×1000。'),
      },
      {
        kind: 'auto', trigger: { event: 'damageCancelledInBattle' }, optional: true,
        effects: [{ op: 'returnSourceToHand' }],
        text: t('【自】このカードのバトル中、あなたの受けたダメージがキャンセルされた時、あなたはこのカードを手札に戻してよい。',
          '【自】在此卡的戰鬥中，你所受到的傷害被取消時，你可以將此卡返回手牌。'),
      },
    ],
    note: '加攻給「別人」，所以先用她攻擊。魂傷1的角色+1000，魂傷2的+2000；打出CX讓魂傷+1時加更多。效果2：對手打她時，如果你取消了傷害，可以把她收回手牌，避免被打倒。',
    status: pending,
  },
  {
    id: 'BTR/W107-T06', series: SERIES, name: t('オトバナ～ 伊地知虹夏', '音樂話題～ 伊地知虹夏'),
    type: 'character', color: 'yellow', level: 1, cost: 1, power: 500, soul: 1, triggers: ['soul'],
    traits: [TRAIT_MUSIC, TRAIT_PERSON],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'usedBackup' },
        effects: [{
          op: 'revealTopCheck', filter: { type: 'character', trait: '音楽' },
          ifMatch: [
            { op: 'moveCards', from: { zone: 'deck', side: 'self', count: { exactly: 1 }, fromTop: 1 }, to: toHand },
            { op: 'moveCards', from: handDiscard(), to: toWaitingRoom },
          ],
        }],
        text: t('【自】あなたがこのカードの「助太刀」を使った時、あなたは自分の山札の上から1枚を公開する。その公開したカードが《音楽》のキャラなら手札に加え、あなたは自分の手札を1枚選び、控え室に置く。（そうでないなら元に戻す）',
          '【自】當你使用此卡的『助太刀』時，你將自己的牌組上方1張公開。那張卡片是《音樂》的角色的話加到手牌，你選擇自己的手牌1張，放到休息室。(如果不是的話放回原位)'),
      },
      {
        kind: 'activated', keyword: { id: 'backup', power: 2000, level: 1 }, timing: 'counter',
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discardSource' }],
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: { exactly: 1 }, relation: 'inBattleWithSource' }, amount: 2000, duration: 'thisTurn' }],
        text: t('【起】【カウンター】助太刀2000 レベル1［① 手札のこのカードを控え室に置く］（あなたは自分のフロントアタックされているキャラを1枚選び、そのターン中、パワーを＋2000）',
          '【起】【反擊】助太刀2000 等級1［① 手牌的此卡放到休息室］(你選擇自己的正在被正打的角色1張，在那個回合中，攻擊力+2000)'),
      },
    ],
    note: '主要當防守卡：對手正打你的角色時，付1能量從手牌丟出，被打的角色+2000。你自己的等級要達到1才能用，對手側打時不能用。使用時還會順便翻1張換牌。',
    status: pending,
  },
  {
    id: 'BTR/W107-T07', series: SERIES, name: t('ドラム 伊地知虹夏', '鼓手 伊地知虹夏'),
    type: 'character', color: 'yellow', level: 2, cost: 0, power: 4000, soul: 1, triggers: ['soul'],
    traits: [TRAIT_MUSIC, TRAIT_PERSON],
    abilities: [assist(1000, '【永】応援 このカードの前のあなたのキャラすべてに、パワーを＋1000。', '【永】應援 此卡前面的你的角色全部，攻擊力+1000。')],
    note: '放後列：她斜前方2格的角色+1000。後列兩格分別放她和「伊地知虹夏」(Lv0)，前列中間可以同時吃到兩個應援。',
    status: pending,
  },
  {
    id: 'BTR/W107-T08', series: SERIES, name: t('クールで孤高 山田リョウ', '冷酷且孤高 山田涼'),
    type: 'character', color: 'yellow', level: 2, cost: 1, power: 7000, soul: 1, triggers: ['soul'],
    traits: [TRAIT_MUSIC, TRAIT_ODD],
    abilities: [{
      kind: 'continuous', condition: { kind: 'myTurn' },
      effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'source' }, amount: { per: otherMusicOnStage, multiplier: 1500, evaluate: 'live' }, duration: 'whileActive' }],
      text: t('【永】あなたのターン中、他のあなたの《音楽》のキャラ1枚につき、このカードのパワーを＋1500。', '【永】在你的回合中，其他的你的《音樂》的角色每有1張，此卡的攻擊力+1500。'),
    }],
    note: '自己回合場上其他4張都是《音樂》的話，她是13000，攻擊力很高。注意：對手回合沒有加成，只有7000，防守比較弱。',
    status: pending,
  },
  {
    id: 'BTR/W107-T09', series: SERIES, name: t('山田リョウ', '山田涼'),
    type: 'character', color: 'yellow', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'],
    traits: [TRAIT_MUSIC, TRAIT_ODD],
    abilities: [{
      kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
      cost: [{ kind: 'discard', selector: handDiscard() }],
      effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { type: 'character' }, count: { upTo: 2 } }, to: toHand }],
      text: t('【自】［手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室のキャラを2枚まで選び、手札に戻す。',
        '【自】［手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的角色最多2張，回到手牌。'),
    }],
    note: '登場時丟1撿2，手牌會多1張，適合終盤補充手牌。',
    status: pending,
  },
  {
    id: 'BTR/W107-T10', series: SERIES, name: t('バンド名「結束バンド」', '樂團名「團結Band」'),
    type: 'event', color: 'yellow', level: 1, cost: 1, triggers: [], traits: [],
    abilities: [{
      kind: 'event', effects: [{ op: 'searchDeck', filter: { type: 'climax' }, upTo: 1, reveal: true, shuffle: true }],
      text: t('あなたは自分の山札を見てクライマックスを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '你從自己的牌組選擇名場面最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    }],
    note: '從牌組直接選1張CX加入手牌，用完放進休息室。想發動「主奏吉他手 後藤一里」的連動，就拿「憧憬的樂團活動」。',
    status: pending,
  },
  {
    id: 'BTR/W107-T11', series: SERIES, name: t('憧れたバンド活動', '憧憬的樂團活動'),
    type: 'climax', color: 'yellow', triggers: ['choice'], traits: [],
    abilities: [{
      kind: 'continuous',
      effects: [
        { op: 'modifyPower', target: selfStage(), amount: 1000, duration: 'whileActive' },
        { op: 'modifySoul', target: selfStage(), amount: 1, duration: 'whileActive' },
      ],
      text: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。', '【永】你的角色全部，攻擊力+1000，魂傷+1。'),
    }],
    note: '在高潮階段從手牌打出，效果持續到這回合結束。連動：「主奏吉他手 後藤一里」。黃色CX，也會觸發「樂團的領導者 伊地知虹夏」。判定翻到這張時：從休息室選1張判定標誌是「魂」的角色，加入手牌或放進能量區。',
    status: pending,
  },
  {
    id: 'BTR/W107-T12', series: SERIES, name: t('初めて撮った皆との写真', '第一張的大合照'),
    type: 'climax', color: 'yellow', triggers: ['soul', 'soul'], traits: [],
    abilities: [{
      kind: 'continuous', effects: [{ op: 'modifySoul', target: selfStage(), amount: 2, duration: 'whileActive' }],
      text: t('【永】あなたのキャラすべてに、ソウルを＋2。', '【永】你的角色全部，魂傷+2。'),
    }],
    note: '沒有連動角色，效果是全隊魂傷+2，用來把傷害打高。黃色CX，也會觸發「樂團的領導者 伊地知虹夏」。判定翻到時，這次攻擊魂傷+2。',
    status: pending,
  },
  {
    id: 'BTR/W107-T13', series: SERIES, name: t('バンド女子？ 後藤ひとり', '樂團女子？ 後藤一里'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1000, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC],
    abilities: [
      {
        kind: 'continuous',
        effects: [
          { op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: { name: 'ギターボーカル 喜多郁代', excludeSource: true }, count: 'all' }, amount: 1000, duration: 'whileActive' },
          { op: 'modifySoul', target: { zone: 'stage', side: 'self', filter: { name: 'ギターボーカル 喜多郁代', excludeSource: true }, count: 'all' }, amount: 1, duration: 'whileActive' },
        ],
        text: t('【永】他のあなたの「ギターボーカル 喜多郁代」すべてに、パワーを＋1000し、ソウルを＋1。', '【永】其他的你的「主唱吉他手 喜多郁代」全部，攻擊力+1000，魂傷+1。'),
      },
      {
        kind: 'auto', keyword: { id: 'bond', targetName: 'ギターボーカル 喜多郁代' }, trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard() }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { name: 'ギターボーカル 喜多郁代' }, count: { exactly: 1 } }, to: toHand }],
        text: t('【自】絆／「ギターボーカル 喜多郁代」［手札を1枚控え室に置く］（このカードがプレイされて舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「ギターボーカル 喜多郁代」を1枚選び、手札に戻す）',
          '【自】絆／「主唱吉他手 喜多郁代」［手牌1張放到休息室］(此卡被使用被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「主唱吉他手 喜多郁代」1張，回到手牌)'),
      },
    ],
    note: '專門搭配「主唱吉他手 喜多郁代」（Lv1 攻擊5500）。一里放後列，郁代會變成6500、魂傷2。絆：一里從手牌登場時丟1張手牌，就能從休息室撿回郁代。',
    status: pending,
  },
  {
    id: 'BTR/W107-T14', series: SERIES, name: t('後藤ひとり', '後藤一里'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 2000, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{
          op: 'lookTopPick', look: 3, pick: { filter: { type: 'event' }, upTo: 1 }, rest: 'waitingRoom',
          then: [{ op: 'moveCards', from: handDiscard(), to: toWaitingRoom }],
        }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を上から3枚まで見て、イベントを1枚まで選び相手に見せ、手札に加え、残りのカードを控え室に置く。手札に加えたなら、あなたは自分の手札を1枚選び、控え室に置く。',
          '【自】此卡從手牌被放置到舞台時，你從自己的牌組上方看最多3張，選擇事件最多1張給對手確認，加到手牌，剩下的卡片放到休息室。加到手牌的話，你選擇自己的手牌1張，放到休息室。'),
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        condition: { kind: 'countAtMost', selector: { zone: 'stage', side: 'opponent', filter: { row: 'front' }, count: 'all' }, n: 1 },
        effects: [{ op: 'moveCards', from: { zone: 'stage', side: 'opponent', filter: { row: 'front', costAtMost: 0 }, count: { exactly: 1 } }, to: { zone: 'waitingRoom', side: 'opponent' } }],
        text: t('【自】このカードが手札から舞台に置かれた時、相手の前列のキャラが1枚以下なら、あなたは相手の前列のコスト0以下のキャラを1枚選び、控え室に置いてよい。',
          '【自】此卡從手牌被放置到舞台時，對手的前列的角色在1張以下的話，你可以選擇對手的前列的費用0以下的角色1張，放到休息室。'),
      },
    ],
    note: '效果1：看3張找事件（本牌組是「樂團名『團結Band』」）。找到要丟1張手牌，沒找到的話3張都進休息室。效果2：對手前列只有1張以下角色時，可以把1張費用0的角色直接送進休息室，不用戰鬥。',
    status: pending,
  },
  {
    id: 'BTR/W107-T15', series: SERIES, name: t('陽キャ 喜多郁代', '陽角 喜多郁代'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 2500, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC, TRAIT_POPULAR],
    abilities: [{
      kind: 'auto', trigger: { event: 'reversedInBattle' },
      effects: [{
        op: 'lookTopPick', look: 3, pick: { filter: { type: 'climax' }, upTo: 1 }, rest: 'waitingRoom',
        then: [{ op: 'moveCards', from: handDiscard(), to: toWaitingRoom }],
      }],
      text: t('【自】バトル中のこのカードが【リバース】した時、あなたは自分の山札を上から3枚まで見て、クライマックスを1枚まで選び相手に見せ、手札に加え、残りのカードを控え室に置く。手札に加えたなら、あなたは自分の手札を1枚選び、控え室に置く。',
        '【自】戰鬥中的此卡【倒置】時，你從自己的牌組上方看最多3張，選擇名場面最多1張給對手確認，加到手牌，剩下的卡片放到休息室。加到手牌的話，你選擇自己的手牌1張，放到休息室。'),
    }],
    note: 'Lv0就有2500，數值很高。被打倒時看3張找CX加入手牌（拿1丟1），輸了也有收穫，適合放前列。',
    status: pending,
  },
  {
    id: 'BTR/W107-T16', series: SERIES, name: t('ギターボーカル 喜多郁代', '主唱吉他手 喜多郁代'),
    type: 'character', color: 'red', level: 1, cost: 0, power: 5500, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC, TRAIT_POPULAR], abilities: [],
    note: '沒有效果的角色，但是Lv1、費用0就有5500。搭配後列的「樂團女子？ 後藤一里」，會變成6500、魂傷2。',
    status: pending,
  },
  {
    id: 'BTR/W107-T17', series: SERIES, name: t('人気者 喜多郁代', '高人氣 喜多郁代'),
    type: 'character', color: 'red', level: 1, cost: 1, power: 5500, soul: 1, triggers: [],
    traits: [TRAIT_MUSIC, TRAIT_POPULAR],
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'countAtLeast', selector: { zone: 'stage', side: 'self', filter: { excludeSource: true }, count: 'all' }, n: 3 },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'source' }, amount: 2000, duration: 'whileActive' }],
        text: t('【永】他のあなたのキャラが3枚以上なら、このカードのパワーを＋2000。', '【永】其他的你的角色存在3張以上的話，此卡的攻擊力+2000。'),
      },
      encore(handDiscard({ type: 'character' }), '【自】アンコール［手札のキャラを1枚控え室に置く］（このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、このカードを【横】にして元の枠に戻す）',
        '【自】安可［手牌的角色1張放到休息室］(此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，你將此卡【橫置】放回原位)'),
    ],
    note: '場上有其他3張以上的角色時，她是7500。自帶安可：被打倒時丟1張手牌角色，就能以橫置狀態回到原本的格子。',
    status: pending,
  },
  {
    id: 'BTR/W107-T18', series: SERIES, name: t('喜多郁代', '喜多郁代'),
    type: 'character', color: 'red', level: 2, cost: 2, power: 7000, soul: 2, triggers: ['soul'],
    traits: [TRAIT_MUSIC, TRAIT_POPULAR],
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'countAtLeast', selector: { zone: 'stage', side: 'self', filter: { excludeSource: true }, count: 'all' }, n: 3 },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: 'all', relation: 'source' }, amount: 3000, duration: 'whileActive' }],
        text: t('【永】他のあなたのキャラが3枚以上なら、このカードのパワーを＋3000。', '【永】其他的你的角色存在3張以上的話，此卡的攻擊力+3000。'),
      },
      encore(handDiscard(music), '【自】アンコール［手札の《音楽》のキャラを1枚控え室に置く］（このカードが舞台から控え室に置かれた時、あなたはコストを払ってよい。そうしたら、このカードを【横】にして元の枠に戻す）',
        '【自】安可［手牌的《音樂》的角色1張放到休息室］(此卡從舞台被放到休息室時，你可以支付代價。支付代價的話，你將此卡【橫置】放回原位)'),
    ],
    note: '場上有其他3張以上的角色時，她是10000，而且魂傷2。自帶安可：被打倒時丟1張手牌的《音樂》角色，就能回到原本的格子。',
    status: pending,
  },
  {
    id: 'BTR/W107-T19', series: SERIES, name: t('新しいあだ名 後藤ひとり', '新的綽號 後藤一里'),
    type: 'character', color: 'red', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'],
    traits: [TRAIT_MUSIC],
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        effects: [{ op: 'moveCards', from: { zone: 'clock', side: 'self', count: { exactly: 1 }, position: 'top' }, to: toWaitingRoom }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚を、控え室に置いてよい。', '【自】此卡從手牌被放置到舞台時，你可以將自己的傷害區上方1張，放到休息室。'),
      },
      {
        kind: 'auto', trigger: { event: 'attacks' }, optional: true,
        cost: [{ kind: 'stock', n: 1 }],
        effects: [{ op: 'putCardOnDeckTop', from: { zone: 'waitingRoom', side: 'opponent', count: { exactly: 1 } } }],
        text: t('【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、あなたは相手の控え室のカードを1枚選び、山札の上に置く。',
          '【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，你選擇對手休息室的卡片1張，放到牌組上方。'),
      },
    ],
    note: '登場時回1血（傷害區1張進休息室）。攻擊時付1能量：從對手休息室選1張卡，放到對手牌組最上面。（卡面沒有限制種類；建議選非CX的卡，這樣傷害翻的第1張就不會是CX，傷害比較不容易被取消。）',
    status: pending,
  },
  {
    id: 'BTR/W107-T20', series: SERIES, name: t('史上最低のアー写', '史上最糟的藝人照'),
    type: 'climax', color: 'red', triggers: ['soul', 'soul'], traits: [],
    abilities: [{
      kind: 'continuous', effects: [{ op: 'modifySoul', target: selfStage(), amount: 2, duration: 'whileActive' }],
      text: t('【永】あなたのキャラすべてに、ソウルを＋2。', '【永】你的角色全部，魂傷+2。'),
    }],
    note: '沒有連動角色，效果是全隊魂傷+2。紅色CX，不會觸發「樂團的領導者 伊地知虹夏」。判定翻到時，這次攻擊魂傷+2。',
    status: pending,
  },
];

// 預組內容（張數取自檔名；與 data/decks/BTR-W107.csv 一致）
export const deck: { cardId: string; count: number }[] = [
  ['T01', 4], ['T02', 4], ['T03', 2], ['T04', 4], ['T05', 2], ['T06', 2], ['T07', 2], ['T08', 2], ['T09', 2], ['T10', 2],
  ['T11', 4], ['T12', 2], ['T13', 2], ['T14', 2], ['T15', 4], ['T16', 2], ['T17', 2], ['T18', 2], ['T19', 2], ['T20', 2],
].map(([n, c]) => ({ cardId: `BTR/W107-${n}`, count: c as number }));

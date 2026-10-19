// GIRLS BAND CRY 預組 GCR/SE48（19 種、50 張）。全部紅色。
// 日文依卡面圖片讀出；中文與白話說明取自預組卡表。標 review 的是需要使用者核對的地方。
import type { Ability, CardFilter, Card, Selector, Text } from '../card-schema.ts';

const SERIES = 'GCR';
const t = (ja: string, zh: string): Text => ({ ja, zh });
const MUSIC = '音楽';
const music: CardFilter = { type: 'character', trait: MUSIC };

const source: Selector = { zone: 'stage', side: 'self', count: 'all', relation: 'source' };
const selfStage = (filter?: CardFilter): Selector => ({ zone: 'stage', side: 'self', filter, count: 'all' });
const otherMusic: Selector = { zone: 'stage', side: 'self', filter: { trait: MUSIC, excludeSource: true }, count: 'all' };
const musicOnStage: Selector = { zone: 'stage', side: 'self', filter: { trait: MUSIC }, count: 'all' };
const handDiscard = (filter?: CardFilter, n = 1): Selector => ({ zone: 'hand', side: 'self', filter, count: { exactly: n } });
const toWaitingRoom = { zone: 'waitingRoom' as const, side: 'self' as const };
const toHand = { zone: 'hand' as const, side: 'self' as const };
const toStock = { zone: 'stock' as const, side: 'self' as const };
const deckTop = (n: number): Selector => ({ zone: 'deck', side: 'self', count: { exactly: n }, fromTop: n });

const TRAIT_MUSIC = t(MUSIC, '音樂');
const TRAIT_TOGE = t('トゲナシトゲアリ', 'TOGENASHI TOGEARI');
const TRAITS = [TRAIT_MUSIC, TRAIT_TOGE];

// 「公開牌組上方 1 張，符合就加到手牌，再丟 1 張手牌（不符合就放回原位）」
const revealTake = (filter: CardFilter) => ({
  op: 'revealTopCheck' as const, filter,
  ifMatch: [{ op: 'moveCards' as const, from: handDiscard(), to: toWaitingRoom }],
});

const climaxEffect = (soulOnly: boolean): Ability => soulOnly
  ? {
      kind: 'continuous', effects: [{ op: 'modifySoul', target: selfStage(), amount: 2, duration: 'whileActive' }],
      text: t('【永】あなたのキャラすべてに、ソウルを＋2。', '【永】你的角色全部，魂傷+2。'),
    }
  : {
      kind: 'continuous',
      effects: [
        { op: 'modifyPower', target: selfStage(), amount: 1000, duration: 'whileActive' },
        { op: 'modifySoul', target: selfStage(), amount: 1, duration: 'whileActive' },
      ],
      text: t('【永】あなたのキャラすべてに、パワーを＋1000し、ソウルを＋1。（【カムバック】：このカードがトリガーした時、あなたは自分の控え室のキャラを1枚選び、手札に戻してよい）',
        '【永】你的角色全部，攻擊力+1000，魂傷+1。(木門：當你判定出此卡時，你可以選擇自己休息室的1張角色，回到手牌)'),
    };

const pending = { translated: true, coded: true, verified: false, tested: true }; // 情境測試：game/cards-gcr.test.ts

const N = {
  kokuhakuMomoka: '告白 桃香',
  zatto: '雑踏、僕らの街',
  unmei: '運命の華',
};

export const cards: Card[] = [
  {
    id: 'GCR/SE48-T01', series: SERIES, name: t('開戦の灯 ルパ', '開戰的信號 RUPA'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 500, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'climaxPlaced', side: 'self' },
        effects: [revealTake(music)],
        text: t('【自】あなたのCXがCX置場に置かれた時、あなたは自分の山札の上から1枚を公開する。そのカードが《音楽》のキャラなら手札に加え、あなたは自分の手札を1枚選び、控え室に置く。（そうでないなら元に戻す）',
          '【自】當你的名場面被放置到名場面區時，你將自己的牌組上方1張公開。那張卡片是《音樂》的角色的話加到手牌，你選擇自己的手牌1張，放到休息室。(如果不是的話放回原位)'),
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
    note: '效果1：每次你打出名場面就會自動觸發。翻到《音樂》角色就「拿1丟1」，換掉用不到的手牌。效果2「集中」：付1能量並把她橫置，翻5張進休息室，每翻到1張名場面就抽1張。橫置後這回合不能攻擊，所以建議放後列，在主要階段使用。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T02', series: SERIES, name: t('告白 仁菜', '告白 仁菜'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous',
        effects: [
          { op: 'modifyPower', target: selfStage({ name: N.kokuhakuMomoka, excludeSource: true }), amount: 1500, duration: 'whileActive' },
          {
            op: 'grantAbility', target: selfStage({ name: N.kokuhakuMomoka, excludeSource: true }), duration: 'whileActive',
            ability: {
              kind: 'auto', keyword: { id: 'encore' }, trigger: { event: 'sourceLeavesStageToWaitingRoom' }, optional: true,
              cost: [{ kind: 'discard', selector: handDiscard({ type: 'character' }) }],
              effects: [{ op: 'returnSourceToSlot', state: 'rest' }],
              text: t('【自】アンコール［手札のキャラを1枚控え室に置く］', '【自】安可［手牌的角色1張放到休息室］'),
            },
          },
        ],
        text: t('【永】他のあなたの「告白 桃香」すべてに、パワーを＋1500し、『【自】アンコール［手札のキャラを1枚控え室に置く］』を与える。',
          '【永】其他的你的「告白 桃香」全部，攻擊力+1500，給予『【自】安可［手牌的角色1張放到休息室］』。'),
      },
      {
        kind: 'auto', keyword: { id: 'bond', targetName: N.kokuhakuMomoka }, trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard() }],
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: { name: N.kokuhakuMomoka }, count: { exactly: 1 } }, to: toHand }],
        text: t('【自】絆／「告白 桃香」［手札を1枚控え室に置く］（このカードがプレイされて舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の「告白 桃香」を1枚選び、手札に戻す）',
          '【自】絆／「告白 桃香」［手牌1張放到休息室］(此卡被使用被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的「告白 桃香」1張，回到手牌)'),
      },
    ],
    note: '專門搭配「告白 桃香」（Lv1 攻擊7000）。仁菜放後列，桃香會變成8500。安可：桃香被打倒時，丟1張手牌角色，桃香就能以橫置狀態回到原本的格子。絆：仁菜從手牌登場時，丟1張手牌，就能從休息室撿回1張桃香。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T03', series: SERIES, name: t('初セッション すばる', '第一次的演奏 昂'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous', condition: { kind: 'all', of: [{ kind: 'myTurn' }, { kind: 'countAtLeast', selector: otherMusic, n: 1 }] },
        effects: [{ op: 'modifyPower', target: source, amount: 3000, duration: 'whileActive' }],
        text: t('【永】あなたのターン中、他のあなたの《音楽》のキャラがいるなら、このカードのパワーを＋3000。', '【永】在你的回合中，有其他的你的《音樂》的角色存在的話，此卡的攻擊力+3000。'),
      },
      {
        kind: 'auto', trigger: { event: 'attacks' }, optional: true,
        cost: [{ kind: 'stock', n: 1 }],
        effects: [{ op: 'extraTriggerCheck' }],
        text: t('【自】［①］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、そのアタック中、あなたはトリガーステップにトリガーチェックを2回行う。',
          '【自】［①］此卡攻擊時，你可以支付代價。支付代價的話，在那次攻擊中，你在判定階段執行2次判定。'),
      },
    ],
    note: '自己回合只要場上有其他《音樂》角色，她就是4000，在Lv0很強。付1能量就能判定2次：兩張的判定標誌都會生效，觸發機會變兩倍。判定的2張都會進能量區，付1拿回2，等於多賺1能量。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T04', series: SERIES, name: t('始まりの目撃者へ 智', '給初始的目擊者 智'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [revealTake({ anyOf: [music, { type: 'event' }] })],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札の上から1枚を公開する。そのカードが《音楽》のキャラかイベントなら手札に加え、あなたは自分の手札を1枚選び、控え室に置く。（そうでないなら元に戻す）',
          '【自】此卡從手牌被放置到舞台時，你將自己的牌組上方1張公開。那張卡片是《音樂》的角色或事件的話加到手牌，你選擇自己的手牌1張，放到休息室。(如果不是的話放回原位)'),
        review: ['「《音楽》のキャラかイベント」讀成「《音樂》角色，或任何事件」（事件卡沒有特徵）。'],
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard(music) }],
        effects: [{ op: 'drawCards', n: 1 }],
        text: t('【自】［手札の《音楽》のキャラを1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは1枚引く。',
          '【自】［手牌的《音樂》的角色1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你抽1張牌。'),
      },
    ],
    note: '從手牌登場時兩個效果都能發動，都是「換手牌」，不會增加手牌數量。效果1：翻到《音樂》角色或事件，就拿1丟1（翻到名場面不行，放回原位）。丟進休息室的角色，之後可以用「開戰的信號 仁菜」等卡撿回來。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T05', series: SERIES, name: t('帰る場所 智', '回去的地方 智'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 1500, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous',
        effects: [{ op: 'modifyPower', target: otherMusic, amount: 500, duration: 'whileActive' }],
        text: t('【永】他のあなたの《音楽》のキャラすべてに、パワーを＋500。', '【永】其他的你的《音樂》的角色全部，攻擊力+500。'),
      },
      {
        kind: 'auto', trigger: { event: 'myTriggerChecked', filter: { type: 'climax', hasTrigger: 'comeback' } },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', count: { exactly: 1 } }, amount: 1000, duration: 'untilNextOpponentTurnEnd' }],
        text: t('【自】あなたのトリガーアイコンが【カムバック】のCXがトリガーした時、あなたは自分のキャラを1枚選び、次の相手のターンの終わりまで、パワーを＋1000。',
          '【自】當你在判定階段判出判定標誌是木門的名場面時，你選擇自己的角色1張，到下次的對手回合結束前，攻擊力+1000。'),
      },
    ],
    note: '放後列的輔助角色：場上其他《音樂》角色全部+500。判定翻到木門名場面（「熙熙攘攘，我們的城市」或「命運之花」）時，選1張角色+1000。加攻會持續到對手回合結束，所以也能幫忙防守。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T06', series: SERIES, name: t('開戦の灯 仁菜', '開戰的信號 仁菜'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 2000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        cost: [{ kind: 'stock', n: 1 }, { kind: 'discard', selector: handDiscard() }],
        effects: [
          { op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: music, count: { exactly: 1 } }, to: toHand },
          { op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: { trait: MUSIC, excludeSource: true }, count: { exactly: 1 } }, amount: 1000, duration: 'thisTurn' },
        ],
        text: t('【自】［① 手札を1枚控え室に置く］このカードが手札から舞台に置かれた時、あなたはコストを払ってよい。そうしたら、あなたは自分の控え室の《音楽》のキャラを1枚選び、手札に戻し、他の自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋1000。',
          '【自】［① 手牌1張放到休息室］此卡從手牌被放置到舞台時，你可以支付代價。支付代價的話，你選擇自己休息室的《音樂》的角色1張，回到手牌，選擇其他的自己的《音樂》的角色1張，在那個回合中，攻擊力+1000。'),
      },
      {
        kind: 'auto', trigger: { event: 'climaxPlaced', side: 'opponent' }, optional: true,
        effects: [{ op: 'moveCards', from: { ...source, count: { exactly: 1 } }, to: toStock }],
        text: t('【自】相手のCXがCX置場に置かれた時、あなたはこのカードをストック置場に置いてよい。', '【自】當對手的名場面被放置到名場面區時，你可以將此卡放到能量區。'),
      },
    ],
    note: '付1能量＋丟1手牌：從休息室撿回1張《音樂》角色，再讓另一位隊友這回合+1000。效果2：對手打出名場面時，可以把她送進能量區，多1能量。注意：她如果在前列，送走後格子會變空，對手可以直接攻擊你（魂傷+1）。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T07', series: SERIES, name: t('始まりの目撃者へ 桃香', '給初始的目擊者 桃香'),
    type: 'character', color: 'red', level: 0, cost: 0, power: 2000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'attacks' },
        effects: [{
          op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: { trait: MUSIC, excludeSource: true }, count: { exactly: 1 } },
          amount: { per: otherMusic, multiplier: 500, evaluate: 'atResolution' }, duration: 'thisTurn',
        }],
        text: t('【自】このカードがアタックした時、あなたは他の自分の《音楽》のキャラを1枚選び、そのターン中、パワーを＋X。Xは他のあなたの《音楽》のキャラの枚数×500に等しい。',
          '【自】此卡攻擊時，你選擇其他的自己的《音樂》的角色1張，在那個回合中，攻擊力+X。X等於其他的你的《音樂》的角色張數×500。'),
      },
      {
        kind: 'auto', trigger: { event: 'opponentAttackPhaseStart' }, optional: true, condition: { kind: 'opponentInFront' },
        effects: [{ op: 'moveSourceToSlot', row: 'front', emptyOnly: true }],
        text: t('【自】相手のアタックフェイズの始めに、このカードの正面に相手のキャラがいるなら、あなたはこのカードを前列のキャラのいない枠に動かしてよい。',
          '【自】在對手的攻擊階段開始時，此卡的正面有對手的角色存在的話，你可以將此卡移動到前列的沒有角色的格子。'),
      },
    ],
    note: '加攻的對象是「別人」，不是她自己。所以先用桃香攻擊，把加成給後面要打的隊友（最多+2000）。效果2：可以閃開打不贏的對手角色，但前列要有空格才能用。她原本的格子會變空，對面那張角色可以直接攻擊你。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T08', series: SERIES, name: t('始まりの目撃者へ すばる', '給初始的目擊者 昂'),
    type: 'character', color: 'red', level: 1, cost: 0, power: 4000, soul: 1, triggers: [], traits: TRAITS,
    abilities: [{
      kind: 'continuous', condition: { kind: 'sourceInSlot', slots: [1] },
      effects: [
        { op: 'modifyPower', target: source, amount: 2500, duration: 'whileActive' },
        {
          op: 'grantAbility', target: source, duration: 'whileActive',
          ability: {
            kind: 'auto', trigger: { event: 'battleOpponentReversed' }, optional: true, condition: { kind: 'climaxInZone' },
            effects: [{ op: 'moveCards', from: deckTop(1), to: toStock }],
            text: t('【自】このカードのバトル相手が【リバース】した時、あなたのCX置場にCXがあるなら、あなたは自分の山札の上から1枚を、ストック置場に置いてよい。',
              '【自】此卡的戰鬥對手【倒置】時，你的名場面區有名場面的話，你可以將自己的牌組上方1張，放到能量區。'),
          },
        },
      ],
      text: t('【永】前列の中央の枠にこのカードがいるなら、このカードのパワーを＋2500し、このカードは次の能力を得る。『【自】このカードのバトル相手が【リバース】した時、あなたのCX置場にCXがあるなら、あなたは自分の山札の上から1枚を、ストック置場に置いてよい。』',
        '【永】此卡存在前列中央的格子的話，此卡的攻擊力+2500，此卡獲得以下能力。『【自】此卡的戰鬥對手【倒置】時，你的名場面區有名場面的話，你可以將自己的牌組上方1張，放到能量區。』'),
    }],
    note: '一定要放在前列正中間，才會變成6500，而且費用0。【倒置】＝被打倒。她打倒對手時，如果你這回合有打出名場面，就能+1能量。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T09', series: SERIES, name: t('開戦の灯 桃香', '開戰的信號 桃香'),
    type: 'character', color: 'red', level: 1, cost: 0, power: 5500, soul: 1, triggers: [], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous', rules: ['cannotSideAttack'], effects: [],
        text: t('【永】このカードはサイドアタックできない。', '【永】此卡不能側打。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.zatto }, trigger: { event: 'battleOpponentReversed' },
        condition: { kind: 'climaxInZone', name: N.zatto },
        effects: [{ op: 'lookTopHandAndStock', look: 4, filter: { levelAtLeast: 1 } }],
        text: t('【自】【CXコンボ】このカードのバトル相手が【リバース】した時、あなたのCX置場に「雑踏、僕らの街」があるなら、あなたは自分の山札を上から4枚まで見て、レベル1以上のカードを2枚まで選んで相手に見せ、1枚選び、手札に加え、1枚選び、ストック置場に置き、残りのカードを控え室に置く。（CXのレベルは0として扱う）',
          '【自】【CX連動】此卡的戰鬥對手【倒置】時，你的名場面區有「熙熙攘攘，我們的城市」的話，你從自己的牌組上方看最多4張，選擇等級1以上的卡片最多2張給對手確認，選擇1張，加到手牌，選擇1張，放到能量區，剩下的卡片放到休息室。(名場面視為等級0)'),
        review: [
          '「4枚まで見て」：目前固定看 4 張（不能選擇只看 1～3 張）。',
          '只選 1 張時，那張一定加到手牌（不能改放能量區）。',
        ],
      },
    ],
    note: '不能側打：只能正打（要打倒對手）或直接攻擊。連動名場面「熙熙攘攘，我們的城市」：打出這張名場面後，桃香打倒對手時看4張，1張Lv1以上的卡進手牌、1張進能量。名場面視為等級0，所以這個效果拿不到名場面。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T10', series: SERIES, name: t('ファンサービス ルパ', '粉絲福利 RUPA'),
    type: 'character', color: 'red', level: 1, cost: 1, power: 500, soul: 1, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'usedBackup' },
        effects: [revealTake(music)],
        text: t('【自】あなたがこのカードの「助太刀」を使った時、あなたは自分の山札の上から1枚を公開する。そのカードが《音楽》のキャラなら手札に加え、あなたは自分の手札を1枚選び、控え室に置く。（そうでないなら元に戻す）',
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
    note: '這張主要當防守卡：對手正打你的角色時，付1能量從手牌丟出，被打的角色+2000。你自己的等級要達到1才能用，對手側打時不能用。使用時還會順便翻1張換牌。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T11', series: SERIES, name: t(N.kokuhakuMomoka, '告白 桃香'),
    type: 'character', color: 'red', level: 1, cost: 1, power: 7000, soul: 1, triggers: [], traits: TRAITS, abilities: [],
    note: '沒有效果的角色，但是Lv1就有7000，數值很高。搭配後列的「告白 仁菜」，會變成8500，被打倒時還能安可回場。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T12', series: SERIES, name: t('開戦の灯 智', '開戰的信號 智'),
    type: 'character', color: 'red', level: 2, cost: 1, power: 5500, soul: 1, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous',
        effects: [{
          op: 'modifyPower', target: source,
          amount: { per: { zone: 'stage', side: 'self', filter: { trait: MUSIC, row: 'back', excludeSource: true }, count: 'all' }, multiplier: 2500, evaluate: 'live' },
          duration: 'whileActive',
        }],
        text: t('【永】他のあなたの後列の《音楽》のキャラ1枚につき、このカードのパワーを＋2500。', '【永】其他的你的後列的《音樂》的角色每有1張，此卡的攻擊力+2500。'),
      },
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' }, optional: true,
        condition: { kind: 'countAtLeast', selector: otherMusic, n: 4 },
        effects: [{ op: 'moveCards', from: { zone: 'waitingRoom', side: 'self', filter: music, count: { exactly: 1 } }, to: toStock }],
        text: t('【自】このカードが手札から舞台に置かれた時、他のあなたの《音楽》のキャラが4枚以上なら、あなたは自分の控え室の《音楽》のキャラを1枚選び、ストック置場に置いてよい。',
          '【自】此卡從手牌被放置到舞台時，其他的你的《音樂》的角色存在4張以上的話，你可以選擇自己休息室的《音樂》的角色1張，放到能量區。'),
      },
    ],
    note: '後列兩格都是《音樂》角色的話，她會變成10500。場上5格都放滿時登場，可以從休息室補1張到能量區，等於費用拿回來了。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T13', series: SERIES, name: t('開戦の灯 すばる', '開戰的信號 昂'),
    type: 'character', color: 'red', level: 2, cost: 1, power: 6500, soul: 1, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'continuous', keyword: { id: 'assist' },
        effects: [{ op: 'modifyPower', target: { zone: 'stage', side: 'self', filter: { trait: 'トゲナシトゲアリ' }, count: 'all', relation: 'frontOfSource' }, amount: 1500, duration: 'whileActive' }],
        text: t('【永】応援 このカードの前のあなたの《トゲナシトゲアリ》のキャラすべてに、パワーを＋1500。', '【永】應援 此卡前面的你的《TOGENASHI TOGEARI》的角色全部，攻擊力+1500。'),
      },
      {
        kind: 'activated',
        cost: [{ kind: 'sourceToDeckBottom' }],
        effects: [{ op: 'moveToOtherEmptySlot', target: { zone: 'stage', side: 'opponent', count: { exactly: 1 } } }],
        text: t('【起】［このカードを山札の下に置く］あなたは相手のキャラを1枚選び、相手の舞台のキャラのいない他の枠に動かす。',
          '【起】［將此卡放到牌組下方］你選擇對手的角色1張，移動到對手的舞台的沒有角色的其他格子。'),
      },
    ],
    note: '放後列使用。「前面」是指她斜前方的2個前列格子，那裡的角色+1500。【起】：把她放到牌組最下面，移動對手1張角色。可以讓對手的前列空出來方便直接攻擊，或把對手後列的輔助角色拉到前面。對手舞台要有空格才能用。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T14', series: SERIES, name: t('始まりの目撃者へ 仁菜', '給初始的目擊者 仁菜'),
    type: 'character', color: 'red', level: 3, cost: 2, power: 9500, soul: 2, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [
          { op: 'moveCards', from: { zone: 'clock', side: 'self', count: { upTo: 1 }, position: 'top' }, to: toWaitingRoom },
          { op: 'modifyPower', target: source, amount: 1500, duration: 'thisTurn' },
        ],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分のクロックの上から1枚までを、控え室に置き、そのターン中、このカードのパワーを＋1500。',
          '【自】此卡從手牌被放置到舞台時，你將自己的傷害區上方最多1張，放到休息室，在那個回合中，此卡的攻擊力+1500。'),
      },
      {
        kind: 'auto', keyword: { id: 'cxCombo', climaxName: N.unmei }, trigger: { event: 'battleOpponentReversed' }, optional: true,
        condition: { kind: 'climaxInZone', name: N.unmei },
        cost: [{ kind: 'stock', n: 1 }],
        effects: [
          { op: 'moveCards', from: { zone: 'stage', side: 'opponent', count: { exactly: 1 }, relation: 'battleOpponentOfSource' }, to: { zone: 'clock', side: 'opponent' } },
          { op: 'lookOpponentTopPlace' },
        ],
        text: t('【自】【CXコンボ】［①］このカードのバトル相手が【リバース】した時、あなたのCX置場に「運命の華」があるなら、あなたはコストを払ってよい。そうしたら、あなたはそのキャラをクロック置場に置き、相手の山札を上から1枚見て、山札の上か下に置く。',
          '【自】【CX連動】［①］此卡的戰鬥對手【倒置】時，你的名場面區有「命運之花」的話，你可以支付代價。支付代價的話，你將那張角色放到傷害區，看對手的牌組上方1張，放到牌組上方或下方。'),
      },
    ],
    note: '登場時回1血（傷害區1張進休息室），這回合變成11000。連動名場面「命運之花」：打倒對手後付1能量，把被打倒的角色放進對手的傷害區。這樣算1點傷害，而且不能被取消。看對手牌組最上面1張：是名場面就放到最下面，避免你下一次攻擊被取消。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T15', series: SERIES, name: t('始まりの目撃者へ ルパ', '給初始的目擊者 RUPA'),
    type: 'character', color: 'red', level: 3, cost: 2, power: 10000, soul: 2, triggers: ['soul'], traits: TRAITS,
    abilities: [
      {
        kind: 'auto', trigger: { event: 'placedFromHandToStage' },
        effects: [{ op: 'lookTopPick', look: { per: musicOnStage, multiplier: 1, evaluate: 'atResolution' }, pick: { filter: {}, upTo: 1 }, rest: 'waitingRoom', secret: true }],
        text: t('【自】このカードが手札から舞台に置かれた時、あなたは自分の山札を上からX枚まで見て、カードを1枚まで選び、手札に加え、残りのカードを控え室に置く。Xはあなたの《音楽》のキャラの枚数に等しい。',
          '【自】此卡從手牌被放置到舞台時，你從自己的牌組上方看最多X張，選擇卡片最多1張，加到手牌，剩下的卡片放到休息室。X等於你的《音樂》的角色張數。'),
        review: ['「X枚まで見て」：目前固定看 X 張（X＝場上《音樂》角色數，含她自己）。卡面沒寫「相手に見せ」，所以拿的卡不公開。'],
      },
      {
        kind: 'auto', trigger: { event: 'attacks' }, optional: true,
        cost: [{ kind: 'discard', selector: handDiscard(undefined, 2) }],
        effects: [
          { op: 'revealMill', n: 7, bind: 'milled', result: 'damage' },
          { op: 'dealDamage', amount: { countOfBound: 'milled', filter: { type: 'climax' } }, cancelable: true },
        ],
        text: t('【自】［手札を2枚控え室に置く］このカードがアタックした時、あなたはコストを払ってよい。そうしたら、あなたは自分の山札の上から7枚を、控え室に置き、相手にXダメージを与える。Xはそれらのカードのクライマックスの枚数に等しい。（ダメージキャンセルは発生する）',
          '【自】［手牌2張放到休息室］此卡攻擊時，你可以支付代價。支付代價的話，你將自己的牌組上方7張，放到休息室，給對手X點傷害。X等於那些卡片中的名場面張數。(會發生傷害取消)'),
      },
    ],
    note: '登場：看X張（X＝場上《音樂》角色數量，最多5），選1張加入手牌。攻擊時丟2張手牌：翻7張，每張名場面算1點傷害，一次打出去。對手還是可以取消，適合終盤收尾。注意：一次翻7張，牌組消耗很快。牌組用完要洗牌，而且你自己要受1點傷害。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T16', series: SERIES, name: t('中指立ててけ！', '竪起中指吧！'),
    type: 'event', color: 'red', level: 1, cost: 1, triggers: [], traits: [],
    abilities: [{
      kind: 'event', effects: [{ op: 'searchDeck', filter: { type: 'climax' }, upTo: 1, reveal: true, shuffle: true }],
      text: t('あなたは自分の山札を見てCXを1枚まで選んで相手に見せ、手札に加え、その山札をシャッフルする。',
        '你從自己的牌組選擇名場面最多1張給對手確認，加到手牌，將那個牌組洗牌。'),
    }],
    note: '從牌組直接選1張名場面加入手牌，用完放進休息室。看需要選：要連動「開戰的信號 桃香」就拿「熙熙攘攘，我們的城市」，要連動「給初始的目擊者 仁菜」就拿「命運之花」。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T17', series: SERIES, name: t(N.zatto, '熙熙攘攘，我們的城市'),
    type: 'climax', color: 'red', triggers: ['comeback'], traits: [], abilities: [climaxEffect(false)],
    note: '在高潮階段從手牌打出，效果持續到這回合結束。連動：「開戰的信號 桃香」。判定翻到這張時：可以從休息室撿回1張角色，「回去的地方 智」的效果也會觸發。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T18', series: SERIES, name: t(N.unmei, '命運之花'),
    type: 'climax', color: 'red', triggers: ['comeback'], traits: [], abilities: [climaxEffect(false)],
    note: '在高潮階段從手牌打出，效果持續到這回合結束。連動：「給初始的目擊者 仁菜」（Lv3）。判定翻到這張時：可以從休息室撿回1張角色，「回去的地方 智」的效果也會觸發。',
    status: pending,
  },
  {
    id: 'GCR/SE48-T19', series: SERIES, name: t('名もなき何もかも', '皆無其名'),
    type: 'climax', color: 'red', triggers: ['soul', 'soul'], traits: [], abilities: [climaxEffect(true)],
    note: '沒有連動角色，效果就是全隊魂傷+2，用來把傷害打高。判定翻到這張時：這次攻擊魂傷+2。',
    status: pending,
  },
];

// 預組內容（張數取自檔名；與 data/decks/GCR-SE48.csv 一致）
export const deck = ([
  ['T01', 4], ['T02', 2], ['T03', 4], ['T04', 2], ['T05', 2], ['T06', 2], ['T07', 2], ['T08', 2], ['T09', 4], ['T10', 2],
  ['T11', 2], ['T12', 4], ['T13', 2], ['T14', 4], ['T15', 2], ['T16', 2], ['T17', 4], ['T18', 2], ['T19', 2],
] as const).map(([n, c]) => ({ cardId: `GCR/SE48-${n}`, count: c as number }));

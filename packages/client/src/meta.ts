// 畫面用的資料：引擎實例、兩副預組、系列主題色、階段名稱與提示。
import { bdW125, btrW107, createEngine, type Card, type Phase, type PlayerId } from '@ws/engine';

export const cardById = new Map<string, Card>([...btrW107.cards, ...bdW125.cards].map((c) => [c.id, c]));
export const engine = createEngine(cardById);

const list = (d: { cardId: string; count: number }[]) => d.flatMap((x) => Array<string>(x.count).fill(x.cardId));

// 玩家 1＝孤獨搖滾、玩家 2＝Ave Mujica（之後改成建房時選牌組）
export const PLAYERS: Record<PlayerId, { label: string; series: string; accent: string; deck: string[] }> = {
  0: { label: '玩家 1', series: '孤獨搖滾', accent: '#e0587f', deck: list(btrW107.deck) },
  1: { label: '玩家 2', series: 'Ave Mujica', accent: '#c23a52', deck: list(bdW125.deck) },
};

export const PHASES: { id: Phase; name: string; hint: string }[] = [
  { id: 'stand', name: '起立', hint: '把橫置的角色全部直立起來（自動）。' },
  { id: 'draw', name: '抽牌', hint: '從牌組抽 1 張牌（自動）。' },
  { id: 'clock', name: '時計', hint: '可以把 1 張手牌拖到傷害區，然後抽 2 張；也可以略過。' },
  { id: 'main', name: '主要', hint: '把手牌拖到場上的格子出牌；拖動場上角色可以換位置；點選角色可以使用起動能力。' },
  { id: 'climax', name: '名場面', hint: '可以把 1 張名場面拖到名場面區，效果持續到回合結束。' },
  { id: 'attack', name: '攻擊', hint: '點選前列直立的角色，選擇正打、側打或直接攻擊。' },
  { id: 'encore', name: '安可', hint: '倒置的角色放進休息室；可以付費安可回到場上。' },
  { id: 'end', name: '結束', hint: '回合結束，換對手。' },
];

export const SLOT_NAME = ['前列左', '前列中', '前列右', '後列左', '後列右'] as const;

import { bdW125, btrW107, type Card } from '@ws/engine';

export type SeriesCode = 'BTR' | 'BD';

export const SERIES: Record<SeriesCode, { label: string; accent: string; cards: Card[] }> = {
  BTR: { label: '孤獨搖滾', accent: '#e0587f', cards: btrW107.cards },
  BD: { label: 'Ave Mujica', accent: '#a8233b', cards: bdW125.cards },
};

export const cardById = new Map<string, Card>([...btrW107.cards, ...bdW125.cards].map((c) => [c.id, c]));

export interface Placed {
  id: string;
  rested: boolean;
}

// 舞台格子：0～2 前列，3～4 後列
export interface SideState {
  series: SeriesCode;
  hand: string[];
  handCount: number; // 對手只看得到張數
  stage: (Placed | null)[];
  deck: number;
  waiting: string[];
  clock: string[];
  level: string[];
  climax: string[];
  memory: string[];
  stock: number;
}

export const initialMe = (): SideState => ({
  series: 'BTR',
  hand: ['BTR/W107-T04', 'BTR/W107-T09', 'BTR/W107-T10', 'BTR/W107-T11', 'BTR/W107-T13', 'BTR/W107-T06'],
  handCount: 6,
  stage: [null, { id: 'BTR/W107-T16', rested: false }, null, { id: 'BTR/W107-T07', rested: false }, { id: 'BTR/W107-T01', rested: true }],
  deck: 31,
  waiting: ['BTR/W107-T02', 'BTR/W107-T12', 'BTR/W107-T15'],
  clock: ['BTR/W107-T03', 'BTR/W107-T14'],
  level: ['BTR/W107-T05'],
  climax: [],
  memory: [],
  stock: 4,
});

export const initialOpp = (): SideState => ({
  series: 'BD',
  hand: [],
  handCount: 5,
  stage: [{ id: 'BD/W125-T03', rested: false }, { id: 'BD/W125-T05', rested: true }, null, null, { id: 'BD/W125-T11', rested: false }],
  deck: 33,
  waiting: ['BD/W125-T08', 'BD/W125-T12'],
  clock: ['BD/W125-T01', 'BD/W125-T02', 'BD/W125-T10'],
  level: ['BD/W125-T04'],
  climax: ['BD/W125-T07'],
  memory: [],
  stock: 3,
});

export const PHASES = [
  { id: 'stand', name: '起立', hint: '把橫置的角色全部直立起來（自動）。' },
  { id: 'draw', name: '抽牌', hint: '從牌組抽 1 張牌（自動）。' },
  { id: 'clock', name: '時計', hint: '可以選 1 張手牌放到傷害區，然後抽 2 張；也可以略過。' },
  { id: 'main', name: '主要', hint: '把手牌拖到場上的格子出牌；也可以拖動場上角色換位置。點一下卡片看說明。' },
  { id: 'climax', name: '名場面', hint: '可以從手牌打出 1 張名場面，效果持續到回合結束。' },
  { id: 'attack', name: '攻擊', hint: '選擇前列的角色進行攻擊。' },
  { id: 'encore', name: '安可', hint: '倒下的角色可以付費回到場上（預設自動處理）。' },
  { id: 'end', name: '結束', hint: '回合結束，換對手。' },
] as const;

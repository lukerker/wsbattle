// 畫面用的資料：卡片資料庫、系列主題色、系統預組、階段名稱與提示。
import { bdW125, btrW107, gcrSE48, type Card, type Phase } from '@ws/engine';

export const cardById = new Map<string, Card>([...btrW107.cards, ...bdW125.cards, ...gcrSE48.cards].map((c) => [c.id, c]));

const list = (d: { cardId: string; count: number }[]) => d.flatMap((x) => Array<string>(x.count).fill(x.cardId));

// 系列：代碼是卡號的第一段（BTR/W107-T01 → BTR）
export const SERIES: Record<string, { label: string; accent: string }> = {
  BTR: { label: '孤獨搖滾', accent: '#e0587f' },
  BD: { label: 'Ave Mujica', accent: '#c23a52' },
  GCR: { label: 'Girls Band Cry', accent: '#f26b2a' },
};
export const seriesInfo = (code: string) => SERIES[code] ?? { label: code, accent: '#8f99ad' };

export interface DeckInfo {
  id: string;
  name: string;
  series: string;
  cards: string[]; // 50 張的卡號
  preset: boolean; // 系統預組
}

export const PRESET_DECKS: DeckInfo[] = [
  { id: 'preset-BTR-W107', name: '孤獨搖滾 預組', series: 'BTR', cards: list(btrW107.deck), preset: true },
  { id: 'preset-BD-W125', name: 'Ave Mujica 預組', series: 'BD', cards: list(bdW125.deck), preset: true },
  { id: 'preset-GCR-SE48', name: 'Girls Band Cry 預組', series: 'GCR', cards: list(gcrSE48.deck), preset: true },
];

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

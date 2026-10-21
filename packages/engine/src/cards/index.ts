// 全部卡片與系統預組。新增系列時在這裡登記一次，伺服器、畫面、測試都從這裡拿。
import type { Card } from '../card-schema.ts';
import * as bdW125 from './bd-w125.ts';
import * as btrW107 from './btr-w107.ts';
import * as csS114 from './cs-s114.ts';
import * as ftS09 from './ft-s09.ts';
import * as gbfS134 from './gbf-s134.ts';
import * as gbfS134Bp from './gbf-s134-bp.ts';
import * as gcrSE48 from './gcr-se48.ts';
import * as gcrSE48Bp from './gcr-se48-bp.ts';
import * as lrcW105 from './lrc-w105.ts';

export interface PresetDeck {
  key: string; // 例：BTR-W107（data/decks 的檔名）
  series: string; // 卡號第一段
  name: string;
  deck: { cardId: string; count: number }[];
}

export const PRESETS: PresetDeck[] = [
  { key: 'BTR-W107', series: 'BTR', name: '孤獨搖滾 預組', deck: btrW107.deck },
  { key: 'BD-W125', series: 'BD', name: 'Ave Mujica 預組', deck: bdW125.deck },
  { key: 'GCR-SE48', series: 'GCR', name: 'Girls Band Cry 預組', deck: gcrSE48.deck },
  { key: 'GBF-S134', series: 'GBF', name: '碧藍幻想 預組', deck: gbfS134.deck },
  { key: 'LRC-W105', series: 'LRC', name: '莉可麗絲 預組', deck: lrcW105.deck },
  { key: 'FT-S09', series: 'FT', name: 'FAIRY TAIL 魔導少年 預組', deck: ftS09.deck },
  { key: 'CS-S114', series: 'CS', name: '蠟筆小新 電影版 預組', deck: csS114.deck },
];

export const ALL_CARDS: Card[] = [
  ...btrW107.cards, ...bdW125.cards, ...gcrSE48.cards, ...gcrSE48Bp.cards, ...gbfS134.cards, ...gbfS134Bp.cards,
  ...lrcW105.cards, ...ftS09.cards, ...csS114.cards,
];

export const cardDb = (): Map<string, Card> => new Map(ALL_CARDS.map((c) => [c.id, c]));

// 同一張卡的其他卡號（PR、再錄）：效果完全相同，只收錄原本的卡號。重複卡號 → 收錄的卡號
export const DUPLICATES: Record<string, string> = { ...gcrSE48Bp.duplicates, ...gbfS134Bp.duplicates };

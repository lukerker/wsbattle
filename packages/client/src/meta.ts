// 畫面用的資料：卡片資料庫、系列主題色、系統預組、階段名稱與提示。
import { ALL_CARDS, PRESETS, type Card, type Phase } from '@ws/engine';

export const cardById = new Map<string, Card>(ALL_CARDS.map((c) => [c.id, c]));

const list = (d: { cardId: string; count: number }[]) => d.flatMap((x) => Array<string>(x.count).fill(x.cardId));

// 系列：代碼是卡號的第一段（BTR/W107-T01 → BTR）
export const SERIES: Record<string, { label: string; accent: string }> = {
  BTR: { label: '孤獨搖滾', accent: '#e0587f' },
  BD: { label: 'Ave Mujica', accent: '#c23a52' },
  GCR: { label: 'Girls Band Cry', accent: '#f26b2a' },
  GBF: { label: '碧藍幻想', accent: '#1fb5d6' },
  LRC: { label: '莉可麗絲', accent: '#e8384f' },
  FT: { label: 'FAIRY TAIL 魔導少年', accent: '#e8a33c' },
  CS: { label: '蠟筆小新 電影版', accent: '#f2c230' },
};
export const seriesInfo = (code: string) => SERIES[code] ?? { label: code, accent: '#8f99ad' };

// 各系列的全部卡片（預組＋補充包），依卡號排序；組牌器、系列卡表用
export const SERIES_CARDS = new Map<string, Card[]>();
for (const c of [...cardById.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const list = SERIES_CARDS.get(c.series) ?? [];
  list.push(c);
  SERIES_CARDS.set(c.series, list);
}

// 相關卡片：效果裡用「卡名」提到的卡（CX 連動、絆、指定卡名的效果），兩邊都會列出；另外列出同名的卡（構築時合計最多 4 張，含 sameNameAs）
export interface Related {
  card: Card;
  label: 'CX連動' | '絆' | '效果相關' | '同名卡';
}
const RANK: Record<Related['label'], number> = { CX連動: 0, 絆: 1, 同名卡: 2, 效果相關: 3 };
export const RELATED = new Map<string, Related[]>();
{
  const byName = new Map<string, Card[]>();
  for (const c of cardById.values()) byName.set(c.name.ja, [...(byName.get(c.name.ja) ?? []), c]);
  const add = (a: Card, b: Card, label: Related['label']) => {
    if (a.id === b.id) return;
    const list = RELATED.get(a.id) ?? [];
    const x = list.find((r) => r.card.id === b.id);
    if (!x) list.push({ card: b, label });
    else if (RANK[label] < RANK[x.label]) x.label = label;
    RELATED.set(a.id, list);
  };
  for (const a of cardById.values()) {
    for (const same of byName.get(a.name.ja)!) add(a, same, '同名卡');
    // 「和「X」合計最多 4 張」的卡也算同名
    for (const alias of a.sameNameAs ?? []) for (const b of byName.get(alias) ?? []) { add(a, b, '同名卡'); add(b, a, '同名卡'); }
    for (const ab of a.abilities) {
      const kw = ab.keyword;
      for (const m of ab.text.ja.matchAll(/「([^」]+)」/g)) {
        for (const b of byName.get(m[1]!) ?? []) {
          const label = kw?.id === 'cxCombo' && kw.climaxName === b.name.ja ? 'CX連動' : kw?.id === 'bond' && kw.targetName === b.name.ja ? '絆' : '效果相關';
          add(a, b, label);
          add(b, a, label);
        }
      }
    }
  }
  for (const list of RELATED.values()) list.sort((x, y) => RANK[x.label] - RANK[y.label] || x.card.id.localeCompare(y.card.id));
}

export interface DeckInfo {
  id: string;
  name: string;
  series: string;
  cards: string[]; // 50 張的卡號
  preset: boolean; // 系統預組
  notReady?: string | null; // 還不能拿去對戰的原因（自己組的牌組）
}

export const PRESET_DECKS: DeckInfo[] = PRESETS.map((p) => ({ id: `preset-${p.key}`, name: p.name, series: p.series, cards: list(p.deck), preset: true }));

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

// 構築規則〔5.1.2〕：50 張整、同名卡最多 4 張、名場面合計最多 8 張。
// 組牌器和伺服器共用：組牌時可以先存不到 50 張的牌組，但不能超過上限；對戰時一定要剛好 50 張、而且每張卡都已完成。
import type { Card } from './card-schema.ts';

export const DECK_SIZE = 50;
export const MAX_SAME_NAME = 4;
export const MAX_CLIMAX = 8;

// 卡片效果已寫好並通過測試，才能放進牌組
export const isPlayable = (c: Card) => c.status.coded && c.status.tested;

// 「同名」的判定：卡名相同，或卡片寫明「和「X」合計最多 4 張」（sameNameAs）的算同一組
const groups = new WeakMap<ReadonlyMap<string, Card>, Map<string, string>>();
export function nameKey(db: ReadonlyMap<string, Card>, c: Card): string {
  let g = groups.get(db);
  if (!g) {
    g = new Map();
    const root = (n: string): string => (g!.get(n) && g!.get(n) !== n ? root(g!.get(n)!) : n);
    for (const x of db.values()) {
      for (const alias of x.sameNameAs ?? []) {
        const [a, b] = [root(x.name.ja), root(alias)].sort();
        if (a !== b) g.set(b!, a!);
        if (!g.has(a!)) g.set(a!, a!);
      }
    }
    for (const n of [...g.keys()]) g.set(n, root(n));
    groups.set(db, g);
  }
  return g.get(c.name.ja) ?? c.name.ja;
}

export interface DeckSummary {
  total: number;
  climax: number;
  incomplete: number; // 還沒完成的卡（張數）
  invalid: string | null; // 違反構築上限（不能存）
  notReady: string | null; // 可以存，但還不能拿去對戰的原因
}

export function deckSummary(db: ReadonlyMap<string, Card>, cards: readonly string[]): DeckSummary {
  const byName = new Map<string, number>();
  let climax = 0;
  let incomplete = 0;
  let invalid: string | null = null;
  for (const id of cards) {
    const c = db.get(id);
    if (!c) {
      invalid ??= `找不到卡片：${id}`;
      continue;
    }
    if (!isPlayable(c)) incomplete++;
    const key = nameKey(db, c);
    byName.set(key, (byName.get(key) ?? 0) + 1);
    if (c.type === 'climax') climax++;
  }
  if (cards.length > DECK_SIZE) invalid ??= `牌組最多 ${DECK_SIZE} 張，現在有 ${cards.length} 張`;
  for (const [name, n] of byName) if (n > MAX_SAME_NAME) invalid ??= `同名的卡最多 ${MAX_SAME_NAME} 張：「${name}」有 ${n} 張`;
  if (climax > MAX_CLIMAX) invalid ??= `名場面最多 ${MAX_CLIMAX} 張，現在有 ${climax} 張`;
  const notReady = invalid ?? (cards.length < DECK_SIZE ? `還差 ${DECK_SIZE - cards.length} 張` : incomplete ? `含 ${incomplete} 張還沒完成的卡` : null);
  return { total: cards.length, climax, incomplete, invalid, notReady };
}

// 再加 1 張這張卡會不會違反規則；可以加就回傳 null
export function addProblem(db: ReadonlyMap<string, Card>, cards: readonly string[], id: string): string | null {
  const c = db.get(id);
  if (!c) return '找不到這張卡';
  if (!isPlayable(c)) return '這張卡的效果還沒完成，暫時不能放進牌組';
  if (cards.length >= DECK_SIZE) return `牌組已經 ${DECK_SIZE} 張了`;
  const key = nameKey(db, c);
  const same = cards.filter((x) => db.get(x) && nameKey(db, db.get(x)!) === key).length;
  if (same >= MAX_SAME_NAME) return `同名的卡最多 ${MAX_SAME_NAME} 張`;
  if (c.type === 'climax' && cards.filter((x) => db.get(x)?.type === 'climax').length >= MAX_CLIMAX) return `名場面最多 ${MAX_CLIMAX} 張`;
  return null;
}

// 牌組的主要系列：張數最多的系列代碼（卡號第一段）
export function mainSeries(cards: readonly string[]): string {
  const n = new Map<string, number>();
  for (const id of cards) {
    const s = id.split('/')[0] ?? '';
    n.set(s, (n.get(s) ?? 0) + 1);
  }
  let best = '';
  for (const [s, k] of n) if (k > (n.get(best) ?? 0)) best = s;
  return best;
}

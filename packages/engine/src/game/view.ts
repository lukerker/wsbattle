// 依觀看者過濾狀態：只留下該玩家看得到的資訊。
// 手牌、牌組只存在伺服器端；觀戰者只拿公開版本。亂數狀態、內部步驟、待機中的能力一律移除（否則可推算牌序）。
import type { GameState, PlayerId } from './types.ts';

export type Viewer = PlayerId | 'spectator';

export interface GameView extends Omit<GameState, 'rng' | 'queue' | 'cards' | 'pending' | 'standby' | 'grants' | 'nextId' | 'placedThisTurn'> {
  cards: Record<string, { cardId: string | null; owner: PlayerId }>;
}

// reveal：額外讓這位觀看者看得到的卡（例如效果要他從牌組選卡時，那些卡的內容）
export function viewFor(s: GameState, viewer: Viewer, reveal: Iterable<string> = []): GameView {
  const hidden = new Set<string>();
  ([0, 1] as PlayerId[]).forEach((p) => {
    const pl = s.players[p];
    for (const u of pl.deck) hidden.add(u); // 牌組誰都不能看〔3.2.2〕
    for (const u of pl.stock) hidden.add(u); // 能量區裏向き〔3.10.2〕
    if (viewer !== p) for (const u of pl.hand) hidden.add(u); // 對手的手牌〔3.3.2〕
  });
  for (const u of reveal) hidden.delete(u);
  const cards: GameView['cards'] = {};
  for (const [uid, c] of Object.entries(s.cards)) cards[uid] = { cardId: hidden.has(uid) ? null : c.cardId, owner: c.owner };
  const { rng: _r, queue: _q, cards: _c, pending: _p, standby: _s, grants: _g, nextId: _n, placedThisTurn: _t, ...rest } = structuredClone(s);
  return { ...rest, cards };
}

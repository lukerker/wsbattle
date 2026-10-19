// 依觀看者過濾狀態：只留下該玩家看得到的資訊。
// 手牌、牌組只存在伺服器端；觀戰者只拿公開版本。亂數狀態與內部步驟一律移除（否則可推算牌序）。
import type { GameState, PlayerId } from './types.ts';

export type Viewer = PlayerId | 'spectator';

export interface GameView extends Omit<GameState, 'rng' | 'queue' | 'cards'> {
  cards: Record<string, { cardId: string | null; owner: PlayerId }>;
}

export function viewFor(s: GameState, viewer: Viewer): GameView {
  const hidden = new Set<string>();
  ([0, 1] as PlayerId[]).forEach((p) => {
    const pl = s.players[p];
    for (const u of pl.deck) hidden.add(u); // 牌組誰都不能看〔3.2.2〕
    for (const u of pl.stock) hidden.add(u); // 能量區裏向き〔3.10.2〕
    if (viewer !== p) for (const u of pl.hand) hidden.add(u); // 對手的手牌〔3.3.2〕
  });
  const cards: GameView['cards'] = {};
  for (const [uid, c] of Object.entries(s.cards)) cards[uid] = { cardId: hidden.has(uid) ? null : c.cardId, owner: c.owner };
  const { rng: _rng, queue: _queue, cards: _cards, ...rest } = structuredClone(s);
  return { ...rest, cards };
}

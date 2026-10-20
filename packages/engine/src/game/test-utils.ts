// 情境測試用的工具：建立乾淨的局面、把指定的卡放到指定位置、回應選擇。
import type { Card } from '../card-schema.ts';
import * as bd from '../cards/bd-w125.ts';
import * as btr from '../cards/btr-w107.ts';
import * as gcr from '../cards/gcr-se48.ts';
import * as gbf from '../cards/gbf-s134.ts';
import * as lrc from '../cards/lrc-w105.ts';
import { createEngine } from './engine.ts';
import type { Action, GameState, PlayerId, Slot } from './types.ts';

export const db = new Map<string, Card>([...btr.cards, ...bd.cards, ...gcr.cards, ...gbf.cards, ...lrc.cards].map((c) => [c.id, c]));
export const E = createEngine(db);
const list = (d: { cardId: string; count: number }[]) => d.flatMap((x) => Array<string>(x.count).fill(x.cardId));
export const DECKS: [string[], string[]] = [list(btr.deck), list(bd.deck)];

export function ok(s: GameState, a: Action): GameState {
  const r = E.apply(s, a);
  if (r.error) throw new Error(`${a.type}: ${r.error}（pending: ${JSON.stringify(s.pending)}）`);
  return r.state;
}

type Where = 'deck' | 'hand' | 'waiting' | 'clock' | 'level' | 'stock' | 'climax' | 'memory' | { slot: Slot; state?: 'stand' | 'rest' | 'reverse' };
const ZONES = ['deck', 'hand', 'waiting', 'clock', 'level', 'stock', 'climax', 'memory', 'resolution'] as const;

// 把指定卡號的一張卡（不是已經在目標位置的）放到指定位置
export function put(s: GameState, p: PlayerId, cardId: string, where: Where): string {
  const pl = s.players[p];
  const skip = new Set(typeof where === 'object' || where === 'deck' ? [] : pl[where]);
  for (const z of ZONES) {
    const i = pl[z].findIndex((u) => s.cards[u]!.cardId === cardId && !skip.has(u));
    if (i < 0) continue;
    const uid = pl[z].splice(i, 1)[0]!;
    if (typeof where === 'object') pl.stage[where.slot] = { uid, state: where.state ?? 'stand' };
    else pl[where].push(uid);
    return uid;
  }
  throw new Error(`找不到 ${cardId}`);
}

// 把牌組最上面依序換成指定的卡（陣列第一張在最上面）
export function top(s: GameState, p: PlayerId, ids: string[]): string[] {
  const used = new Set<string>();
  const uids = ids.map((id) => {
    const i = s.players[p].deck.findIndex((u) => s.cards[u]!.cardId === id && !used.has(u));
    if (i < 0) throw new Error(`牌組裡找不到 ${id}`);
    const u = s.players[p].deck.splice(i, 1)[0]!;
    used.add(u);
    return u;
  });
  s.players[p].deck.unshift(...uids);
  return uids;
}

// 乾淨的局面：雙方所有卡都在牌組，玩家 0 的第 3 回合主要階段
export const GCR_DECK = list(gcr.deck);
export const GBF_DECK = list(gbf.deck);
export const LRC_DECK = list(lrc.deck);
export function scene(seed = 11, decks: [string[], string[]] = DECKS): GameState {
  let s = E.newGame({ seed, decks }).state;
  s = ok(s, { type: 'mulligan', player: s.firstPlayer, discard: [] });
  s = ok(s, { type: 'mulligan', player: (1 - s.firstPlayer) as PlayerId, discard: [] });
  s = decideFirst(s);
  s = ok(s, { type: 'clock', player: s.turnPlayer, uid: null });
  for (const p of [0, 1] as PlayerId[]) {
    const pl = s.players[p];
    for (const z of ZONES) if (z !== 'deck') pl.deck.push(...pl[z].splice(0));
    for (let i = 0; i < 5; i++) {
      if (pl.stage[i]) pl.deck.push(pl.stage[i]!.uid);
      pl.stage[i] = null;
    }
  }
  s.turnPlayer = 0;
  s.turn = 3;
  s.pending = { kind: 'main', player: 0 };
  return s;
}

// 換完牌後決定先後攻：玩家 0 選左邊、玩家 1 選右邊（誰先攻由種子決定）
export function decideFirst(s: GameState): GameState {
  s = ok(s, { type: 'pickFirst', player: 0, card: 0 });
  return ok(s, { type: 'pickFirst', player: 1, card: 1 });
}

// 讓玩家 1 成為回合玩家（主要階段）
export function oppTurn(s: GameState): GameState {
  s.turnPlayer = 1;
  s.pending = { kind: 'main', player: 1 };
  return s;
}

export const who = (s: GameState) => s.pending!.player;
export const yes = (s: GameState) => ok(s, { type: 'yesno', player: who(s), yes: true });
export const no = (s: GameState) => ok(s, { type: 'yesno', player: who(s), yes: false });
export const choose = (s: GameState, uids: string[]) => ok(s, { type: 'choose', player: who(s), uids });
export const pass = (s: GameState) => ok(s, { type: 'pass', player: who(s) });
// 有多個能力同時待機時，選指定卡（或效果文字包含指定字串）的那一個；都沒指定就選第一個
export function order(s: GameState, uid?: string, text?: string): GameState {
  if (s.pending?.kind !== 'orderAbility') return s;
  const o = s.pending.options.find((x) => (!uid || x.uid === uid) && (!text || x.text.includes(text))) ?? s.pending.options[0]!;
  return choose(s, [String(o.id)]);
}
// 一直按「略過」直到出現指定的選擇
export function passUntil(s: GameState, kind: NonNullable<GameState['pending']>['kind']): GameState {
  for (let i = 0; i < 20 && s.pending && s.pending.kind !== kind; i++) s = pass(s);
  if (s.pending?.kind !== kind) throw new Error(`沒有出現 ${kind}（目前：${JSON.stringify(s.pending)}）`);
  return s;
}
export const uidOf = (s: GameState, p: PlayerId, cardId: string, zone: (typeof ZONES)[number]) => s.players[p][zone].find((u) => s.cards[u]!.cardId === cardId);
export const ids = (s: GameState, uids: string[]) => uids.map((u) => s.cards[u]!.cardId);

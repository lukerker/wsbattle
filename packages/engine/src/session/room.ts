// 一個房間：兩個座位＋觀戰者＋一局遊戲。不碰網路，伺服器與測試都用這份。
import type { Card } from '../card-schema.ts';
import { DECK_SIZE, deckSummary, isPlayable, mainSeries } from '../deck-rules.ts';
import { createEngine, type Engine } from '../game/engine.ts';
import type { Action, GameEvent, GameState, PlayerId, Pending } from '../game/types.ts';
import { viewFor } from '../game/view.ts';
import type { ClientState, RoomConfig, RoomInfo, SeatInfo, Viewer } from './protocol.ts';
import { StatsTracker } from './stats.ts';

export interface User {
  id: string;
  name: string;
}

interface Seat {
  user: User;
  deck: string[];
  deckName: string;
  series: string;
  ready: boolean; // 加入者按了「準備」（房主不用）
}

// 構築規則〔5.1.2〕（見 deck-rules.ts）：對戰時一定要剛好 50 張，而且每張卡的效果都已經做完並通過測試
export function validateDeck(db: ReadonlyMap<string, Card>, deck: unknown): string | null {
  if (!Array.isArray(deck) || deck.some((x) => typeof x !== 'string')) return '牌組必須剛好 50 張';
  const sum = deckSummary(db, deck as string[]);
  if (sum.invalid) return sum.invalid;
  if (sum.total !== DECK_SIZE) return `牌組必須剛好 ${DECK_SIZE} 張（現在 ${sum.total} 張）`;
  const bad = (deck as string[]).map((id) => db.get(id)!).find((c) => !isPlayable(c));
  if (bad) return `「${bad.name.zh}」的效果還沒完成，不能用來對戰`;
  return null;
}

export const seriesOf = (id: string) => id.split('/')[0] ?? '';

export class GameRoom {
  readonly code: string;
  readonly config: RoomConfig;
  readonly seats: [Seat | null, Seat | null] = [null, null];
  readonly spectators = new Map<string, string>(); // userId → 名稱
  readonly online = new Set<string>();
  game: GameState | null = null;
  status: RoomInfo['status'] = 'waiting';
  lastActive = Date.now();
  // 重播用：種子、雙方牌組、所有操作（引擎是純函式，這些就能完整重現一局）
  record: { seed: number; decks: [string[], string[]]; actions: Action[] } | null = null;
  hostId: string | null = null; // 房主：開房的人；房主在開局前離開就換成另一位玩家
  deadline: number | null = null; // 目前的待決選擇自動結束的時間（反擊、給對手確認）
  stats: StatsTracker | null = null; // 結算畫面用的統計
  private readonly engine: Engine;
  private readonly db: ReadonlyMap<string, Card>;

  constructor(db: ReadonlyMap<string, Card>, code: string, config: RoomConfig, engine: Engine = createEngine(db)) {
    this.db = db;
    this.code = code;
    this.config = config;
    this.engine = engine;
  }

  viewerOf(userId: string): Viewer | null {
    for (const p of [0, 1] as PlayerId[]) if (this.seats[p]?.user.id === userId) return p;
    return this.spectators.has(userId) ? 'spectator' : null;
  }

  hostName(): string {
    return this.seats.find((s) => s?.user.id === this.hostId)?.user.name ?? (this.seats[0] ?? this.seats[1])?.user.name ?? '';
  }

  // ── 加入與離開 ──
  joinPlayer(user: User, deck: unknown, deckName: string): { seat: PlayerId } | { error: string } {
    const mine = this.viewerOf(user.id);
    if (mine === 0 || mine === 1) return { seat: mine };
    if (mine === 'spectator') return { error: '你正在觀戰這個房間' };
    const free = this.seats[0] ? (this.seats[1] ? null : 1) : 0;
    if (free === null) return { error: '座位已經滿了，可以改用觀戰加入' };
    const err = validateDeck(this.db, deck);
    if (err) return { error: err };
    const cards = deck as string[];
    this.seats[free] = { user, deck: cards, deckName, series: mainSeries(cards), ready: false };
    this.hostId ??= user.id;
    this.touch();
    return { seat: free };
  }

  // 開局前：加入者按「準備」／取消準備
  setReady(userId: string, ready: boolean): { ok: true } | { error: string } {
    const v = this.viewerOf(userId);
    if (v !== 0 && v !== 1) return { error: '只有玩家可以準備' };
    if (this.status !== 'waiting') return { error: '遊戲已經開始了' };
    if (userId === this.hostId) return { error: '房主不用準備，等對手準備好就可以開始' };
    this.seats[v]!.ready = ready;
    this.touch();
    return { ok: true };
  }

  // 開局前更換牌組；加入者換牌組後要重新按準備
  changeDeck(userId: string, deck: unknown, deckName: string): { ok: true } | { error: string } {
    const v = this.viewerOf(userId);
    if (v !== 0 && v !== 1) return { error: '只有玩家可以換牌組' };
    if (this.status !== 'waiting') return { error: '遊戲已經開始，不能換牌組' };
    const err = validateDeck(this.db, deck);
    if (err) return { error: err };
    const cards = deck as string[];
    this.seats[v] = { ...this.seats[v]!, deck: cards, deckName, series: mainSeries(cards), ready: false };
    this.touch();
    return { ok: true };
  }

  // 房主按「遊戲開始」：兩個座位都有人、加入者已準備。回傳開局的事件
  start(userId: string): { events: GameEvent[] } | { error: string } {
    if (this.status !== 'waiting' || this.game) return { error: '遊戲已經開始了' };
    if (userId !== this.hostId) return { error: '只有房主可以開始遊戲' };
    const [a, b] = this.seats;
    if (!a || !b) return { error: '還在等對手加入' };
    const guest = a.user.id === this.hostId ? b : a;
    if (!guest.ready) return { error: '對手還沒準備好' };
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const r = this.engine.newGame({ seed, decks: [a.deck, b.deck] });
    this.game = r.state;
    this.record = { seed, decks: [a.deck, b.deck], actions: [] };
    this.stats = new StatsTracker();
    this.stats.add(r.events, r.state);
    this.status = 'playing';
    this.touch();
    return { events: r.events };
  }

  // 目前的待決選擇有時間限制時，時間到要自動做的動作（反擊：不使用；給對手確認：確認）
  timeoutAction(): { action: Action; seconds: number } | null {
    const p = this.game?.pending;
    if (!p || this.status !== 'playing' || !('timeout' in p) || !p.timeout) return null;
    if (p.kind === 'counter') return { action: { type: 'pass', player: p.player }, seconds: p.timeout };
    if (p.kind === 'acknowledge') return { action: { type: 'yesno', player: p.player, yes: true }, seconds: p.timeout };
    return null;
  }

  joinSpectator(user: User): { ok: true } | { error: string } {
    if (this.viewerOf(user.id) !== null) return { ok: true };
    if (!this.config.allowSpectators) return { error: '這個房間不開放觀戰' };
    if (this.spectators.size >= this.config.maxSpectators) return { error: `觀戰人數已滿（上限 ${this.config.maxSpectators} 人）` };
    this.spectators.set(user.id, user.name);
    this.touch();
    return { ok: true };
  }

  // 離開房間。對局中的玩家離開視為投降，才不會讓對手一直等
  leave(userId: string): { events: GameEvent[] } {
    const v = this.viewerOf(userId);
    this.online.delete(userId);
    this.touch();
    if (v === 'spectator') {
      this.spectators.delete(userId);
      return { events: [] };
    }
    if (v === null) return { events: [] };
    if (this.status === 'playing' && this.game) {
      const r = this.engine.apply(this.game, { type: 'concede', player: v });
      this.game = r.state;
      this.record?.actions.push({ type: 'concede', player: v });
      this.stats?.add(r.events, r.state);
      this.status = 'ended';
      return { events: r.events };
    }
    if (this.status === 'waiting') {
      this.seats[v] = null;
      const rest = this.seats.find((s) => s);
      if (rest) rest.ready = false;
      if (this.hostId === userId) this.hostId = rest?.user.id ?? null; // 房主離開：留下的玩家變成房主
    }
    return { events: [] };
  }

  isEmpty(): boolean {
    return !this.seats[0] && !this.seats[1] && this.spectators.size === 0;
  }

  // ── 操作 ──
  apply(userId: string, action: Action): { events: GameEvent[] } | { error: string } {
    const v = this.viewerOf(userId);
    if (v === null || v === 'spectator') return { error: '觀戰者不能操作' };
    if (!this.game || this.status !== 'playing') return { error: '遊戲還沒開始或已經結束' };
    if (!action || typeof action !== 'object' || action.player !== v) return { error: '這不是你的動作' };
    return this.applyAs(action);
  }

  // 執行動作（玩家本人送來的，或時間到由伺服器代為執行的預設動作）
  applyAs(action: Action): { events: GameEvent[] } | { error: string } {
    if (!this.game || this.status !== 'playing') return { error: '遊戲還沒開始或已經結束' };
    const r = this.engine.apply(this.game, action);
    if (r.error) return { error: r.error };
    this.game = r.state;
    this.record?.actions.push(action);
    this.stats?.add(r.events, r.state);
    if (r.state.winner !== null) this.status = 'ended';
    this.touch();
    return { events: r.events };
  }

  touch() {
    this.lastActive = Date.now();
  }

  // ── 給畫面的資料 ──
  info(userId: string): RoomInfo {
    const seat = (p: PlayerId): SeatInfo | null => {
      const s = this.seats[p];
      return s ? { uid: s.user.id, name: s.user.name, series: s.series, deckName: s.deckName, online: this.online.has(s.user.id), host: s.user.id === this.hostId, ready: s.ready } : null;
    };
    return {
      code: this.code,
      status: this.status,
      seats: [seat(0), seat(1)],
      config: this.config,
      spectators: [...this.spectators.values()].map((name) => ({ name })),
      you: this.viewerOf(userId) ?? 'spectator',
    };
  }

  clientState(viewer: Viewer): ClientState | null {
    const g = this.game;
    if (!g) return null;
    const e = this.engine;
    const pend: Pending | null = g.pending;
    const waitingPlayers: PlayerId[] = !pend ? [] : 'waiting' in pend ? pend.waiting : [pend.player];
    const isMine = viewer !== 'spectator' && waitingPlayers.includes(viewer);

    // 這個觀看者因為待決選擇而看得到的牌
    const reveal: string[] = [];
    if (pend?.kind === 'acknowledge') reveal.push(...pend.cards); // 公開給對手確認的卡：所有人都看得到
    if (isMine && pend) {
      if (pend.kind === 'select') reveal.push(...pend.options, ...(pend.shown ?? []));
      else if ('options' in pend && Array.isArray(pend.options)) reveal.push(...(pend.options as unknown[]).filter((x): x is string => typeof x === 'string'));
    }

    const view = viewFor(g, viewer, reveal);
    const power: Record<string, number> = {};
    const soul: Record<string, number> = {};
    const problems: Record<string, string | null> = {};
    const abilityText: Record<string, string> = {};
    for (const p of [0, 1] as PlayerId[]) {
      for (const c of g.players[p].stage) {
        if (!c) continue;
        power[c.uid] = e.power(g, c.uid);
        soul[c.uid] = e.soul(g, c.uid);
      }
    }
    if (viewer !== 'spectator') {
      for (const uid of g.players[viewer].hand) problems[uid] = e.playProblem(g, viewer, uid);
      for (const c of g.players[viewer].stage) {
        if (!c) continue;
        e.abilitiesOf(g, c.uid).forEach((a, i) => {
          if (a.kind === 'activated') abilityText[`${c.uid}:${i}`] = a.text.zh;
        });
      }
    }
    return {
      view,
      viewer,
      mine: isMine ? pend : null,
      waiting: pend ? { kind: pend.kind, players: waitingPlayers } : null,
      legal: isMine && pend && !('waiting' in pend) ? e.legalActions(g) : [], // 換牌、先後攻：雙方同時，畫面自己組按鈕
      power,
      soul,
      problems,
      abilityText,
      timerMs: this.deadline !== null ? Math.max(0, this.deadline - Date.now()) : null,
      stats: this.stats?.snapshot() ?? null,
    };
  }
}

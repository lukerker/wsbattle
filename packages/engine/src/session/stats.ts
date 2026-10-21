// 結算畫面的統計：房間把每次產生的事件丟進來累計（只用公開資訊，雙方和觀戰者看到的一樣）
import type { GameEvent, GameOverReason, GameState, PlayerId } from '../game/types.ts';

export interface PlayerStats {
  attacks: number; // 攻擊次數
  damageDealt: number; // 給對手造成、沒被取消而進了傷害區的張數
  maxHit: number; // 單次傷害最多幾張進傷害區
  cancels: number; // 自己取消掉幾次傷害（翻到名場面）
  characters: number; // 從手牌登場的角色數
  climaxes: number; // 打出的名場面數
  triggers: number; // 判定翻到有標誌的卡
  abilities: number; // 發動（開始解決）的效果數
  refreshes: number; // 牌組用完重洗的次數
}

export interface GameStats {
  players: [PlayerStats, PlayerStats];
  reason: GameOverReason | null;
  elapsedMs: number; // 遊玩時間（從開局到結束；還沒結束就是到現在）
}

const empty = (): PlayerStats => ({ attacks: 0, damageDealt: 0, maxHit: 0, cancels: 0, characters: 0, climaxes: 0, triggers: 0, abilities: 0, refreshes: 0 });

export class StatsTracker {
  readonly players: [PlayerStats, PlayerStats] = [empty(), empty()];
  reason: GameOverReason | null = null;
  readonly startedAt = Date.now();
  endedAt: number | null = null;
  private hit: { p: PlayerId; n: number } | null = null; // 正在處理的傷害：誰受傷、已經進傷害區幾張

  add(events: GameEvent[], s: GameState) {
    const owner = (uid: string) => s.cards[uid]?.owner;
    for (const e of events) {
      switch (e.t) {
        case 'attack': {
          const o = owner(e.uid);
          if (o !== undefined) this.players[o].attacks++;
          break;
        }
        case 'damage':
          this.hit = { p: e.p, n: 0 };
          break;
        case 'damageCancel':
          this.players[e.p].cancels++;
          this.hit = null;
          break;
        case 'move':
          if (e.from.zone === 'resolution' && e.to.zone === 'clock' && this.hit && e.to.p === this.hit.p) {
            const by = this.players[(1 - this.hit.p) as PlayerId];
            by.damageDealt++;
            by.maxHit = Math.max(by.maxHit, ++this.hit.n);
          }
          if (e.from.zone === 'hand' && e.to.zone === 'stage') this.players[e.from.p].characters++;
          if (e.from.zone === 'hand' && e.to.zone === 'climax') this.players[e.from.p].climaxes++;
          break;
        case 'trigger': {
          const o = owner(e.uid);
          if (o !== undefined && e.icons.length) this.players[o].triggers++;
          break;
        }
        case 'ability': {
          const o = owner(e.uid);
          if (o !== undefined) this.players[o].abilities++;
          break;
        }
        case 'refresh':
          this.players[e.p].refreshes++;
          break;
        case 'gameOver':
          this.reason = e.reason;
          this.endedAt = Date.now();
          break;
      }
    }
  }

  snapshot(): GameStats {
    return { players: structuredClone(this.players), reason: this.reason, elapsedMs: (this.endedAt ?? Date.now()) - this.startedAt };
  }
}

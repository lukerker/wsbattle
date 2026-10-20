// 對戰紀錄：把伺服器傳來的事件翻成一行一行的文字（只用公開資訊）。
import type { GameEvent, GameView, PlayerId } from '@ws/engine';
import { SLOT_NAME, cardById } from './meta.ts';

export interface LogEntry {
  id: number;
  p: PlayerId | null; // 誰做的（null＝系統）
  text: string;
  turn?: boolean; // 回合開始的分隔線
}

export const TRIGGER_ZH: Record<string, string> = {
  soul: '魂', comeback: '木門', pool: '錢袋', draw: '書本', treasure: '金條', gate: '門', choice: '選擇',
  return: '旋風', shot: '射擊', standby: '待機', chance: '機會', discovery: '發現', focus: '集中',
};
const MODE = { front: '正打', side: '側打', direct: '直接攻擊' } as const;

let nextId = 1;

export function buildLog(events: GameEvent[], view: GameView): LogEntry[] {
  const out: LogEntry[] = [];
  const add = (p: PlayerId | null, text: string, turn = false) => out.push({ id: nextId++, p, text, ...(turn ? { turn } : {}) });
  const nameOf = (cardId: string | null | undefined) => (cardId ? cardById.get(cardId)?.name.zh ?? cardId : null);
  const nameByUid = (uid: string) => nameOf(view.cards[uid]?.cardId) ?? '卡片';
  const ownerOf = (uid: string) => view.cards[uid]?.owner ?? null;

  for (const e of events) {
    switch (e.t) {
      case 'phase':
        if (e.phase === 'stand') add(e.player, `第 ${view.turn} 回合開始`, true);
        break;
      case 'move': {
        const name = nameOf(e.cardId);
        const { from, to } = e;
        if (!name) break; // 沒公開的移動（抽牌等）不記
        if (from.zone === 'hand' && to.zone === 'stage') add(from.p, `登場「${name}」（${to.slot !== undefined ? SLOT_NAME[to.slot] : '舞台'}）`);
        else if (from.zone === 'stage' && to.zone === 'stage' && from.p === to.p && to.slot !== undefined) add(to.p, `把「${name}」移到${SLOT_NAME[to.slot]}`);
        else if (from.zone === 'hand' && to.zone === 'climax') add(from.p, `打出名場面「${name}」`);
        else if (from.zone === 'hand' && to.zone === 'resolution') add(from.p, `使用事件「${name}」`);
        else if (from.zone === 'hand' && to.zone === 'clock') add(from.p, `把「${name}」放到傷害區（時計）`);
        else if (from.zone === 'waiting' && to.zone === 'hand') add(to.p, `從休息室拿回「${name}」`);
        else if (from.zone === 'waiting' && to.zone === 'stock') add(to.p, `把休息室的「${name}」放到能量區`);
        else if (from.zone === 'waiting' && to.zone === 'stage') add(to.p, `從休息室放「${name}」到${to.slot !== undefined ? SLOT_NAME[to.slot] : '舞台'}`);
        else if (from.zone === 'stage' && to.zone === 'clock' && to.p !== null) add(to.p, `「${name}」被放進傷害區`);
        else if (from.zone === 'stage' && to.zone === 'waiting') add(from.p, `「${name}」從舞台放到休息室`);
        else if (from.zone === 'stage' && to.zone === 'hand') add(from.p, `「${name}」從舞台回到手牌`);
        else if (from.zone === 'stage' && to.zone === 'memory') add(from.p, `「${name}」放到回憶區`);
        else if (from.zone === 'resolution' && to.zone === 'memory') add(from.p, `「${name}」放到回憶區`);
        break;
      }
      case 'cardState':
        if (e.state === 'reverse') add(ownerOf(e.uid), `「${nameByUid(e.uid)}」被倒置（戰鬥中被打倒）`);
        break;
      case 'attack':
        add(ownerOf(e.uid), `「${nameByUid(e.uid)}」${MODE[e.mode]}`);
        break;
      case 'trigger':
        add(ownerOf(e.uid), `判定：「${nameOf(e.cardId)}」${e.icons.length ? `（${e.icons.map((i) => TRIGGER_ZH[i] ?? i).join('、')}）` : '（沒有判定標誌）'}`);
        break;
      case 'damage':
        add(e.p, `受到 ${e.n} 點傷害`);
        break;
      case 'damageCancel':
        add(e.p, '傷害被取消（翻到名場面）');
        break;
      case 'levelUp':
        add(e.p, `升級（等級區放入「${nameByUid(e.uid)}」）`);
        break;
      case 'refresh':
        add(e.p, '牌組用完，休息室洗回牌組（重洗懲罰：1 張進傷害區）');
        break;
      case 'ability': {
        const text = e.text.replace(/^【[^】]*】/, '');
        add(ownerOf(e.uid), `「${nameOf(e.cardId)}」的效果：${text.length > 38 ? `${text.slice(0, 38)}…` : text}`);
        break;
      }
      case 'firstDecided':
        add(e.first, '翻到先攻，先攻開始');
        break;
      case 'log':
        add(e.p, e.text);
        break;
      case 'gameOver':
        add(null, e.winner === 'draw' ? '平手' : '遊戲結束');
        break;
    }
  }
  return out;
}

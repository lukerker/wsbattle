// 動畫：把引擎回傳的事件列表分成一步一步，依序套用到畫面上的盤面；
// 每一步之後用 FLIP（記住卡片原本的位置 → 新位置 → 從舊位置滑過去）讓卡片飛到新位置。只用 transform 和 opacity。
import { useLayoutEffect, useRef } from 'react';
import type { GameEvent, GameView, PlayerId } from '@ws/engine';

export interface AnimStep {
  events: GameEvent[];
  ms: number; // 這一步之後停多久再做下一步
  turnStart?: PlayerId; // 這一步是回合開始：顯示回合橫幅
  attack?: { uid: string; slot: number; mode: 'front' | 'side' | 'direct' }; // 這一步是攻擊宣告
}

// 攻擊動畫：攻擊角色先往後蓄力，再衝向正面的格子，撞擊時出現衝擊波與斬擊特效，被攻擊的角色震動，最後彈回原位
export function playAttack(root: HTMLElement, uid: string, attacker: PlayerId, slot: number, mode: 'front' | 'side' | 'direct') {
  const card = root.querySelector<HTMLElement>(`[data-uid="${uid}"]`);
  const target = root.querySelector<HTMLElement>(`[data-slot="${1 - attacker}-${2 - slot}"]`);
  if (!card || !target) return;
  const a = card.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const dx = t.left + t.width / 2 - (a.left + a.width / 2);
  const dy = t.top + t.height / 2 - (a.top + a.height / 2);
  const b = getComputedStyle(card).transform;
  const base = b === 'none' ? '' : b;
  const reach = mode === 'side' ? 0.62 : 0.8; // 側打擦過去，不完全撞上
  const sideX = mode === 'side' ? t.width * 0.55 : 0;
  card.style.zIndex = '60';
  card.animate(
    [
      { transform: base || 'none', offset: 0 },
      { transform: `translate(${-dx * 0.07}px, ${-dy * 0.07}px) scale(1.08) ${base}`, offset: 0.28 },
      { transform: `translate(${dx * reach + sideX}px, ${dy * reach}px) scale(1.16) ${base}`, offset: 0.52, easing: 'cubic-bezier(.6,0,.9,.5)' },
      { transform: `translate(${dx * reach * 0.9 + sideX}px, ${dy * reach * 0.9}px) scale(1.12) ${base}`, offset: 0.6 },
      { transform: base || 'none', offset: 1 },
    ],
    { duration: 760, easing: 'ease-out' },
  );
  window.setTimeout(() => {
    card.style.zIndex = '';
  }, 780);
  // 撞擊的瞬間
  window.setTimeout(() => {
    const fx = document.createElement('div');
    fx.className = `impact ${mode}`;
    fx.style.left = `${t.left + t.width / 2 + sideX * 0.6}px`;
    fx.style.top = `${t.top + t.height / 2}px`;
    fx.innerHTML = '<i></i><i></i><b></b>';
    document.body.appendChild(fx);
    window.setTimeout(() => fx.remove(), 750);
    const def = target.querySelector<HTMLElement>('.cimg');
    if (def) {
      const db = getComputedStyle(def).transform;
      const d = db === 'none' ? '' : db;
      def.animate(
        [{ transform: d || 'none' }, { transform: `translate(-7px, 3px) ${d}` }, { transform: `translate(6px, -2px) ${d}` }, { transform: `translate(-3px, 1px) ${d}` }, { transform: d || 'none' }],
        { duration: 320 },
      );
    }
    if (mode === 'direct') {
      const mat = root.querySelector<HTMLElement>('.mat');
      mat?.animate([{ transform: 'none' }, { transform: 'translate(0, -5px)' }, { transform: 'translate(0, 3px)' }, { transform: 'none' }], { duration: 260 });
    }
  }, 400);
}

const REVEAL_MS = 1000; // 判定、傷害翻開的卡：一張停 1 秒
const DRAW_MS = 420;
const MOVE_MS = 380;

// 分步：從牌組翻開（判定、傷害）、抽牌、放到傷害區，各自一步；其餘連續的事件合成一步
export function groupEvents(events: GameEvent[]): AnimStep[] {
  const steps: AnimStep[] = [];
  let cur: GameEvent[] = [];
  const flush = () => {
    if (!cur.length) return;
    const visible = cur.some((e) => e.t === 'move' || e.t === 'cardState');
    steps.push({ events: cur, ms: visible ? MOVE_MS : 0 });
    cur = [];
  };
  let lastReveal = false; // 連續翻開好幾張（集中、翻 7 張）：第 1 張之後翻快一點
  for (const e of events) {
    const reveal = e.t === 'move' && e.from.zone === 'deck' && e.to.zone === 'resolution';
    if (!reveal && e.t !== 'reveal') lastReveal = false;
    if (reveal) {
      flush();
      steps.push({ events: [e], ms: lastReveal ? 360 : REVEAL_MS });
      lastReveal = true;
      continue;
    }
    if (e.t === 'phase' && e.phase === 'stand') {
      flush();
      steps.push({ events: [e], ms: 1100, turnStart: e.player });
      continue;
    }
    if (e.t === 'move' && e.from.zone === 'deck' && (e.to.zone === 'resolution' || e.to.zone === 'hand' || e.to.zone === 'clock')) {
      flush();
      steps.push({ events: [e], ms: e.to.zone === 'resolution' ? REVEAL_MS : DRAW_MS });
      continue;
    }
    // 攻擊宣告：單獨一步，播攻擊動畫（衝向對手再彈回）
    if (e.t === 'attack') {
      cur.push(e);
      steps.push({ events: cur, ms: 820, attack: { uid: e.uid, slot: e.slot, mode: e.mode } });
      cur = [];
      continue;
    }
    if (e.t === 'damageCancel') {
      cur.push(e);
      flush();
      continue;
    }
    cur.push(e);
  }
  flush();
  return steps;
}

type ZoneArr = 'deck' | 'hand' | 'waiting' | 'clock' | 'level' | 'stock' | 'climax' | 'memory' | 'resolution';
const ARR: ZoneArr[] = ['deck', 'hand', 'waiting', 'clock', 'level', 'stock', 'climax', 'memory', 'resolution'];

// 把一步的事件套用到畫面上的盤面（回傳新的盤面，不改原本的）
export function applyStep(v: GameView, events: GameEvent[], known: (uid: string) => string | null): GameView {
  const n: GameView = structuredClone(v);
  for (const e of events) {
    if (e.t === 'phase') {
      n.phase = e.phase;
      n.turnPlayer = e.player;
    }
    if (e.t === 'cardState') {
      for (const p of n.players) for (const c of p.stage) if (c?.uid === e.uid) c.state = e.state;
    }
    if (e.t !== 'move') continue;
    // 從原本的位置拿掉（格子之間移動時保留橫置等狀態）
    let state: 'stand' | 'rest' | 'reverse' = 'stand';
    for (const p of n.players) {
      for (const z of ARR) {
        const i = p[z].indexOf(e.uid);
        if (i >= 0) p[z].splice(i, 1);
      }
      p.stage.forEach((c, i) => {
        if (c?.uid !== e.uid) return;
        if (e.from.zone === 'stage') state = c.state;
        p.stage[i] = null;
      });
    }
    const dst = n.players[e.to.p];
    if (e.to.zone === 'stage') dst.stage[e.to.slot!] = { uid: e.uid, state };
    else if (e.to.zone === 'deck') dst.deck.unshift(e.uid);
    else dst[e.to.zone].push(e.uid);
    const id = e.cardId ?? known(e.uid);
    if (id) n.cards[e.uid] = { ...n.cards[e.uid]!, cardId: id };
  }
  return n;
}

// 新出現的卡從哪裡飛來（例如抽牌：從牌組）
export function originsOf(events: GameEvent[]): Map<string, { key: string; flip: boolean }> {
  const m = new Map<string, { key: string; flip: boolean }>();
  for (const e of events) {
    if (e.t !== 'move') continue;
    const hidden = e.from.zone === 'deck' || e.from.zone === 'stock';
    m.set(e.uid, { key: `${e.from.zone}-${e.from.p}`, flip: hidden && e.to.zone !== 'stock' && e.to.zone !== 'deck' });
  }
  return m;
}

// FLIP：每次盤面改變後，把每張卡（data-uid）從上一次的位置滑到新位置
export function useFlip(root: React.RefObject<HTMLElement | null>, deps: unknown, origins: React.MutableRefObject<Map<string, { key: string; flip: boolean }>>, remeasure: unknown) {
  const rects = useRef(new Map<string, DOMRect>());

  // 版面改變（面板開關、視窗大小）時只重新記位置，不播動畫
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const m = new Map<string, DOMRect>();
    el.querySelectorAll<HTMLElement>('[data-uid]').forEach((c) => m.set(c.dataset.uid!, c.getBoundingClientRect()));
    rects.current = m;
  }, [remeasure]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const next = new Map<string, DOMRect>();
    el.querySelectorAll<HTMLElement>('[data-uid]').forEach((card) => {
      const uid = card.dataset.uid!;
      const r = card.getBoundingClientRect();
      next.set(uid, r);
      const origin = origins.current.get(uid);
      let prev = rects.current.get(uid);
      if (!prev && origin) prev = el.querySelector<HTMLElement>(`[data-zone="${origin.key}"]`)?.getBoundingClientRect();
      if (!prev) return;
      const dx = prev.left + prev.width / 2 - (r.left + r.width / 2);
      const dy = prev.top + prev.height / 2 - (r.top + r.height / 2);
      const flip = origin?.flip && !rects.current.has(uid);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && !flip) return;
      const base = getComputedStyle(card).transform;
      const b = base === 'none' ? '' : base;
      const s = Math.min(prev.width / Math.max(r.width, 1), 2);
      card.animate(
        flip
          ? [
              { transform: `translate(${dx}px, ${dy}px) scale(${s}) scaleX(0.05) ${b}`, opacity: 0.6 },
              { transform: `translate(${dx * 0.4}px, ${dy * 0.4}px) scaleX(1) ${b}`, opacity: 1, offset: 0.45 },
              { transform: b || 'none', opacity: 1 },
            ]
          : [{ transform: `translate(${dx}px, ${dy}px) ${b}` }, { transform: b || 'none' }],
        { duration: flip ? 520 : 380, easing: 'cubic-bezier(.2,.7,.2,1)' },
      );
    });
    rects.current = next;
    origins.current.clear();
  }, [deps]);
}

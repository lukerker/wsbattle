// 動畫：把引擎回傳的事件列表分成一步一步，依序套用到畫面上的盤面；
// 每一步之後用 FLIP（記住卡片原本的位置 → 新位置 → 從舊位置滑過去）讓卡片飛到新位置。只用 transform 和 opacity。
import { useLayoutEffect, useRef } from 'react';
import type { GameEvent, GameView, PlayerId } from '@ws/engine';
import { BACK_URL } from './CardFace.tsx';
import type { SoundName } from './sound.ts';

export interface AnimStep {
  events: GameEvent[];
  ms: number; // 這一步之後停多久再做下一步
  turnStart?: PlayerId; // 這一步是回合開始：顯示回合橫幅
  attack?: { uid: string; slot: number; mode: 'front' | 'side' | 'direct' }; // 這一步是攻擊宣告
  firstDecided?: { first: PlayerId; firstCard: 0 | 1; picks: [0 | 1, 0 | 1] }; // 這一步是先後攻翻牌
  showcase?: { uid: string; cardId: string; p: PlayerId }; // 這一步是出牌：放大展示
  shuffle?: { p: PlayerId; refresh: boolean }; // 這一步是洗牌（refresh＝牌組用完，休息室洗回牌組）
  sound?: SoundName;
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

const REVEAL_MS = 1300; // 判定、傷害翻開的卡：第 1 張停久一點
const REVEAL_NEXT_MS = 950; // 連續翻開（傷害 3 點、集中）：之後每張
const DRAW_MS = 480;
export const SHOWCASE_MS = 2000; // 出牌：放大翻開給大家看，再縮小貼到場上
const SHUFFLE_MS = 1500;
const REFRESH_MS = 2100; // 牌組用完：休息室的牌飛回牌組再洗
const GAME_OVER_MS = 1400;

// 每張卡移動要飛多久：放到能量區、從解決領域離開（判定、傷害結算完）飛慢一點，看得清楚
export function moveMs(e: Extract<GameEvent, { t: 'move' }>): number {
  if (e.to.zone === 'stock') return 900;
  if (e.from.zone === 'resolution') return 720;
  if (e.from.zone === 'deck') return 640;
  return 420;
}

// 從手牌打出、要放大展示的卡：角色登場、名場面、事件
const isShowcase = (e: GameEvent): boolean =>
  e.t === 'move' && e.from.zone === 'hand' && !!e.cardId && (e.to.zone === 'stage' || e.to.zone === 'climax' || e.to.zone === 'resolution');

// 分步：從牌組翻開（判定、傷害）、抽牌、放到傷害區，各自一步；其餘連續的事件合成一步
export function groupEvents(events: GameEvent[]): AnimStep[] {
  const steps: AnimStep[] = [];
  let cur: GameEvent[] = [];
  const flush = (extra = 0) => {
    if (!cur.length) return;
    const moves = cur.filter((e): e is Extract<GameEvent, { t: 'move' }> => e.t === 'move');
    const visible = moves.length > 0 || cur.some((e) => e.t === 'cardState');
    steps.push({ events: cur, ms: visible ? Math.max(380, ...moves.map(moveMs)) + 80 + extra : extra });
    cur = [];
  };
  let lastReveal = false; // 連續翻開好幾張（集中、翻 7 張）：第 1 張之後翻快一點
  for (const e of events) {
    const reveal = e.t === 'move' && e.from.zone === 'deck' && e.to.zone === 'resolution';
    if (!reveal && e.t !== 'reveal' && e.t !== 'trigger') lastReveal = false;
    if (reveal) {
      flush();
      steps.push({ events: [e], ms: lastReveal ? REVEAL_NEXT_MS : REVEAL_MS, sound: 'flip' });
      lastReveal = true;
      continue;
    }
    if (e.t === 'move' && isShowcase(e)) {
      flush();
      steps.push({ events: [e], ms: SHOWCASE_MS, showcase: { uid: e.uid, cardId: e.cardId!, p: e.from.p }, sound: 'play' });
      continue;
    }
    if (e.t === 'firstDecided') {
      flush();
      steps.push({ events: [e], ms: 3600, firstDecided: { first: e.first, firstCard: e.firstCard, picks: e.picks } });
      continue;
    }
    if (e.t === 'phase' && e.phase === 'stand') {
      flush();
      steps.push({ events: [e], ms: 1100, turnStart: e.player });
      continue;
    }
    // 牌組用完：休息室的牌（前面的 move）和重洗一起一步，播洗牌
    if (e.t === 'refresh') {
      cur.push(e);
      const p = e.p;
      const ev = cur;
      cur = [];
      steps.push({ events: ev, ms: REFRESH_MS, shuffle: { p, refresh: true }, sound: 'shuffle' });
      continue;
    }
    if (e.t === 'shuffle') {
      const prev = steps[steps.length - 1];
      if (prev?.shuffle?.refresh && prev.shuffle.p === e.p && !cur.length) {
        prev.events.push(e); // 重洗已經播過洗牌
        continue;
      }
      flush();
      steps.push({ events: [e], ms: SHUFFLE_MS, shuffle: { p: e.p, refresh: false }, sound: 'shuffle' });
      continue;
    }
    if (e.t === 'move' && e.from.zone === 'deck' && (e.to.zone === 'hand' || e.to.zone === 'clock')) {
      flush();
      steps.push({ events: [e], ms: e.to.zone === 'hand' ? DRAW_MS : moveMs(e) + 200, sound: e.to.zone === 'hand' ? 'draw' : 'hit' });
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
      flush(300);
      continue;
    }
    // 傷害結算：翻開的卡放進傷害區（一起飛過去）
    if (e.t === 'move' && e.from.zone === 'resolution' && e.to.zone === 'clock') {
      const prev = steps[steps.length - 1];
      if (!cur.length && prev?.sound === 'hit' && prev.events.every((x) => x.t === 'move' && x.from.zone === 'resolution' && x.to.zone === 'clock')) {
        prev.events.push(e);
        continue;
      }
      flush();
      steps.push({ events: [e], ms: moveMs(e) + 250, sound: 'hit' });
      continue;
    }
    if (e.t === 'gameOver') {
      cur.push(e);
      flush(GAME_OVER_MS);
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

// 這一步移動的卡從哪裡飛來（例如抽牌：從牌組）、要不要翻面、飛多久
export type Origin = { key: string; flip: boolean; ms: number };
export function originsOf(events: GameEvent[], known: (uid: string) => string | null): Map<string, Origin> {
  const m = new Map<string, Origin>();
  for (const e of events) {
    if (e.t !== 'move') continue;
    const hidden = e.from.zone === 'deck' || e.from.zone === 'stock';
    const face = !!(e.cardId ?? known(e.uid)); // 翻過來看得到牌面才翻（對手抽牌：手牌還是牌背）
    m.set(e.uid, { key: `${e.from.zone}-${e.from.p}`, flip: hidden && face && e.to.zone !== 'stock' && e.to.zone !== 'deck', ms: moveMs(e) });
  }
  return m;
}

// FLIP：每次盤面改變後，把每張卡（data-uid）從上一次的位置滑到新位置。
// 從牌組翻開的卡：前半段是牌背轉到側面，後半段牌面從側面轉正（Y 軸 3D 翻牌）
export function useFlip(root: React.RefObject<HTMLElement | null>, deps: unknown, origins: React.MutableRefObject<Map<string, Origin>>, remeasure: unknown) {
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
      const ms = origin?.ms ?? 420;
      if (!flip) {
        card.animate([{ transform: `translate(${dx}px, ${dy}px) ${b}` }, { transform: b || 'none' }], { duration: ms, easing: 'cubic-bezier(.25,.7,.25,1)' });
        return;
      }
      // 牌背：從牌組的位置轉到側面（90 度），同時往目的地移動一半
      const s = Math.min(prev.width / Math.max(r.width, 1), 2);
      const back = document.createElement('img');
      back.src = BACK_URL;
      back.className = 'flip-back';
      Object.assign(back.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      document.body.appendChild(back);
      const half = ms / 2;
      back.animate(
        [
          { transform: `perspective(700px) translate(${dx}px, ${dy}px) scale(${s}) rotateY(0deg)` },
          { transform: `perspective(700px) translate(${dx * 0.45}px, ${dy * 0.45 - r.height * 0.15}px) scale(${(s + 1) / 2 * 1.08}) rotateY(90deg)` },
        ],
        { duration: half, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' },
      ).onfinish = () => back.remove();
      card.animate(
        [
          { transform: `perspective(700px) translate(${dx * 0.45}px, ${dy * 0.45 - r.height * 0.15}px) scale(${(s + 1) / 2 * 1.08}) rotateY(-90deg) ${b}` },
          { transform: `perspective(700px) translate(0px, 0px) scale(1) rotateY(0deg) ${b}` },
        ],
        { duration: half, delay: half, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'backwards' },
      );
    });
    rects.current = next;
    origins.current.clear();
  }, [deps]);
}

// 洗牌：牌組上方幾張牌背左右分開再交錯疊回去，洗兩輪。refresh＝牌組用完，先讓幾張牌從休息室飛回牌組
export function playShuffle(root: HTMLElement, p: PlayerId, refresh: boolean) {
  const deck = root.querySelector<HTMLElement>(`[data-zone="deck-${p}"]`)?.getBoundingClientRect();
  if (!deck) return;
  const waiting = root.querySelector<HTMLElement>(`[data-zone="waiting-${p}"]`)?.getBoundingClientRect();
  const box = document.createElement('div');
  box.className = 'shuffle-fx';
  Object.assign(box.style, { left: `${deck.left}px`, top: `${deck.top}px`, width: `${deck.width}px`, height: `${deck.height}px` });
  const N = 6;
  const cards = Array.from({ length: N }, () => {
    const img = document.createElement('img');
    img.src = BACK_URL;
    box.appendChild(img);
    return img;
  });
  const label = document.createElement('span');
  label.textContent = refresh ? '重洗' : '洗牌';
  box.appendChild(label);
  document.body.appendChild(box);
  const gather = refresh && waiting ? 600 : 0;
  if (gather && waiting) {
    const gx = waiting.left - deck.left;
    const gy = waiting.top - deck.top;
    cards.forEach((c, i) =>
      c.animate([{ transform: `translate(${gx}px, ${gy}px)`, opacity: 0 }, { transform: `translate(${gx}px, ${gy}px)`, opacity: 1, offset: 0.15 }, { transform: 'none', opacity: 1 }], {
        duration: 420, delay: i * 30, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards',
      }),
    );
  }
  const w = deck.width;
  const round = 600;
  cards.forEach((c, i) => {
    const left = i % 2 === 0;
    const x = (left ? -1 : 1) * w * 0.62;
    const lift = -(i % 3) * 2;
    const tilt = left ? -8 : 8;
    c.animate(
      [
        { transform: 'none', offset: 0 },
        { transform: `translate(${x}px, ${lift}px) rotate(${tilt}deg)`, offset: 0.35 },
        { transform: `translate(${x * 0.2}px, ${lift - 4}px) rotate(${tilt / 3}deg)`, offset: 0.6 + i * 0.04 },
        { transform: 'none', offset: 1 },
      ],
      { duration: round, delay: gather + 60, iterations: 2, easing: 'ease-in-out', fill: 'backwards' },
    );
  });
  label.animate([{ opacity: 0, transform: 'translate(-50%, 0) scale(.8)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], {
    duration: gather + round * 2 + 200, fill: 'both',
  });
  window.setTimeout(() => box.remove(), gather + round * 2 + 260);
}

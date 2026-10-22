// 教學：從大廳進來，一章一章看。左邊示範畫面（卡片部位、場地動畫、作品一覽），右邊說明文字。
// 場地示範直接用對戰畫面的 Board 和 FLIP 動畫，看到的就是實際對戰的樣子。看到哪裡存在這台裝置，下次從那裡繼續。
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GameView, PlayerId } from '@ws/engine';
import { Board } from './Board.tsx';
import { CardFace, CardImg, cardImg } from './CardFace.tsx';
import { playAttack, playShuffle, useFlip, type Origin } from './anim.ts';
import { PHASES, SERIES, cardById } from './meta.ts';
import { pickLobbyBg } from './Screens.tsx';
import { CHAPTERS, type Frame, type SideSpec, type Slide, type Spot, type Visual } from './tutorial-lessons.ts';

const POS_KEY = 'ws-tutorial-pos';
const CH_COLORS = ['#ff5a92', '#33c4e8', '#ffb21e', '#5bd16f', '#9b7bff', '#ff7a45'];

function loadPos(): { c: number; s: number } {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as { c: number; s: number } | null;
    if (p && CHAPTERS[p.c]?.slides[p.s]) return p;
  } catch { /* 讀不到就從頭 */ }
  return { c: 0, s: 0 };
}

export default function Tutorial({ onBack }: { onBack: () => void }) {
  const [pos, setPos] = useState(loadPos);
  const [menu, setMenu] = useState(false);
  const [bg] = useState(pickLobbyBg);
  const chapter = CHAPTERS[pos.c]!;
  const slide = chapter.slides[pos.s]!;
  const isFirst = pos.c === 0 && pos.s === 0;
  const isLast = pos.c === CHAPTERS.length - 1 && pos.s === chapter.slides.length - 1;

  useEffect(() => {
    try { localStorage.setItem(POS_KEY, JSON.stringify(isLast ? { c: 0, s: 0 } : pos)); } catch { /* 存不了就算了 */ }
  }, [pos, isLast]);

  const go = (d: 1 | -1) =>
    setPos(({ c, s }) => {
      const n = s + d;
      if (n >= 0 && n < CHAPTERS[c]!.slides.length) return { c, s: n };
      const nc = c + d;
      if (nc < 0 || nc >= CHAPTERS.length) return { c, s };
      return { c: nc, s: d > 0 ? 0 : CHAPTERS[nc]!.slides.length - 1 };
    });

  // 鍵盤左右鍵翻頁
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 手機：左右滑動翻頁
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 70 && Math.abs(e.clientY - s.y) < Math.abs(dx) * 0.6) go(dx < 0 ? 1 : -1);
  };

  const color = CH_COLORS[pos.c % CH_COLORS.length]!;
  return (
    <div className="tut" style={{ ['--tc' as string]: color, ...(bg ? { ['--tut-bg' as string]: `url(${cardImg(`bg/${bg}`)})` } : {}) }}>
      <header className="tut-top">
        <button className="tut-pill" onClick={onBack}>← 大廳</button>
        <div className="tut-progress" aria-label="章節進度">
          {CHAPTERS.map((ch, i) => (
            <button
              key={i} title={ch.title} aria-label={ch.title}
              className={i === pos.c ? 'on' : i < pos.c ? 'done' : ''}
              style={{ ['--tc' as string]: CH_COLORS[i % CH_COLORS.length] }}
              onClick={() => setPos({ c: i, s: 0 })}
            >
              <i style={{ width: i < pos.c ? '100%' : i === pos.c ? `${((pos.s + 1) / ch.slides.length) * 100}%` : '0%' }} />
            </button>
          ))}
        </div>
        <button className="tut-pill" onClick={() => setMenu(true)}>目錄</button>
      </header>

      <main className="tut-main" onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <section className="tut-vis">
          <VisualView key={`${pos.c}-${pos.s}`} v={slide.visual} />
        </section>
        <section className="tut-text" key={`t${pos.c}-${pos.s}`}>
          <span className="tut-ch">第 {pos.c + 1} 章・{chapter.title}</span>
          <h2>{slide.title}</h2>
          <Body slide={slide} />
        </section>
      </main>

      <footer className="tut-nav">
        <button className="sk-btn back" disabled={isFirst} onClick={() => go(-1)}><b>◀ 上一頁</b></button>
        <span className="tut-page">{pos.s + 1} / {chapter.slides.length}</span>
        {isLast ? (
          <button className="sk-btn next" onClick={onBack}><b>回到大廳 ▶</b></button>
        ) : (
          <button className="sk-btn next" onClick={() => go(1)}><b>{pos.s === chapter.slides.length - 1 ? '下一章' : '下一頁'} ▶</b></button>
        )}
      </footer>

      {menu && (
        <div className="tut-menu" onClick={() => setMenu(false)}>
          <div className="tut-menu-box" onClick={(e) => e.stopPropagation()}>
            <h3>目錄</h3>
            <ol>
              {CHAPTERS.map((ch, i) => (
                <li key={i}>
                  <button className={i === pos.c ? 'on' : ''} style={{ ['--tc' as string]: CH_COLORS[i % CH_COLORS.length] }} onClick={() => { setPos({ c: i, s: 0 }); setMenu(false); }}>
                    <em>{i + 1}</em><b>{ch.title}</b><span>{ch.slides.length} 頁</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// 說明文字：**粗體**、「・」開頭的行是條列
function Body({ slide }: { slide: Slide }) {
  const rich = (t: string) => t.split(/(\*\*[^*]+\*\*)/).map((part, i) => (part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : part));
  return (
    <div className="tut-body">
      {slide.body.map((line, i) => (line.startsWith('・') ? <p key={i} className="li">{rich(line.slice(1))}</p> : <p key={i}>{rich(line)}</p>))}
    </div>
  );
}

function VisualView({ v }: { v: Visual }) {
  switch (v.kind) {
    case 'hero': return <Hero />;
    case 'series': return <SeriesGrid />;
    case 'card': return <CardAnatomy id={v.id} spots={v.spots ?? []} landscape={v.landscape} />;
    case 'cards': return <CardRow cards={v.cards} />;
    case 'board': return <DemoBoard frames={v.frames} hand={!!v.hand} />;
    case 'phases': return <Phases />;
    case 'turnCards': return <TurnCards />;
  }
}

// ───── 開頭：Logo＋各作品主視覺輪播 ─────
const SERIES_CODES = Object.keys(SERIES);
function Hero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % SERIES_CODES.length), 2600);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="tut-hero">
      {SERIES_CODES.map((code, k) => (
        <img key={code} className={k === i ? 'on' : ''} src={cardImg(`vs/${code}.jpg`)} alt="" draggable={false} onError={(e) => (e.currentTarget.style.display = 'none')} />
      ))}
      <div className="tut-hero-logo"><img src="/logo.png" alt="Weiß Schwarz" draggable={false} /></div>
    </div>
  );
}

function SeriesGrid() {
  return (
    <div className="tut-series">
      {SERIES_CODES.map((code, k) => (
        <figure key={code} style={{ ['--pc' as string]: SERIES[code]!.accent, animationDelay: `${k * 90}ms` }}>
          <div><img src={cardImg(`vs/${code}.jpg`)} alt="" draggable={false} onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /></div>
          <figcaption>{SERIES[code]!.label}</figcaption>
        </figure>
      ))}
    </div>
  );
}

// ───── 卡片部位：在卡圖上圈出位置（百分比，依官方卡面版型），旁邊標名稱 ─────
const SPOTS: Record<Spot, { x: number; y: number; w: number; h: number; label: string; side: 'l' | 'r' | 't' | 'b' }> = {
  level: { x: 7.5, y: 8, w: 14, h: 10, label: '等級', side: 'l' },
  cost: { x: 9, y: 19, w: 10, h: 7, label: '費用', side: 'l' },
  trigger: { x: 91, y: 7.5, w: 14, h: 10, label: '判定圖示', side: 'r' },
  power: { x: 17, y: 93, w: 22, h: 6, label: '攻擊力', side: 'l' },
  soul: { x: 30, y: 93, w: 7, h: 6, label: '魂傷', side: 'b' },
  name: { x: 58, y: 86, w: 62, h: 5, label: '卡名', side: 'r' },
  traits: { x: 72, y: 93, w: 46, h: 5, label: '特徵', side: 'r' },
  text: { x: 51, y: 79, w: 94, h: 10, label: '效果', side: 't' },
  color: { x: 3.5, y: 82, w: 7, h: 34, label: '顏色（卡框）', side: 'l' },
};

function CardAnatomy({ id, spots, landscape }: { id: string; spots: Spot[]; landscape?: boolean }) {
  const card = cardById.get(id);
  return (
    <div className={`tut-anat${landscape ? ' land' : ''}`}>
      <div className="tut-anat-card">
        {landscape ? <CardImg card={card} landscape /> : <img src={cardImg(`${id}.webp`)} alt={card?.name.zh ?? id} draggable={false} />}
        {spots.map((k, i) => {
          const s = SPOTS[k];
          return (
            <span key={k} className={`spot ${s.side}`} style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%`, animationDelay: `${i * 0.25}s` }}>
              <em>{s.label}</em>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CardRow({ cards }: { cards: { id: string; label: string }[] }) {
  const units = cards.reduce((n, c) => n + (cardById.get(c.id)?.type === 'climax' ? 1.4 : 1), 0);
  return (
    <div className="tut-cards" style={{ ['--units' as string]: units, ['--n' as string]: cards.length }}>
      {cards.map((c, i) => {
        const card = cardById.get(c.id);
        const land = card?.type === 'climax';
        return (
          <figure key={c.id + i} className={land ? 'land' : ''} style={{ animationDelay: `${i * 120}ms` }}>
            <div className="tut-cards-img"><CardImg card={card} landscape={land} /></div>
            <figcaption>{c.label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function Phases() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % PHASES.length), 1100);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="tut-phases">
      <ol>
        {PHASES.map((p, k) => (
          <li key={p.id} className={k === i ? 'on' : k < i ? 'done' : ''}><em>{k + 1}</em><b>{p.name}</b></li>
        ))}
      </ol>
      <p>{PHASES[i]!.hint}</p>
    </div>
  );
}

function TurnCards() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => setOpen((o) => !o), 2200);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="tut-turn">
      {(['first', 'last'] as const).map((k) => (
        <div key={k} className={`tut-turn-card${open ? ' open' : ''}`}>
          <div className="face back"><img src={cardImg('back.png')} alt="" draggable={false} /></div>
          <div className="face front"><img src={cardImg(`system/${k}.jpg`)} alt={k === 'first' ? '先攻' : '後攻'} draggable={false} /></div>
        </div>
      ))}
    </div>
  );
}

// ───── 場地示範 ─────
// 每一格是完整的場面（和前一格合併）；換格時卡片用對戰畫面的 FLIP 動畫飛過去，播完一輪停一下從頭再來
interface Built {
  view: GameView;
  hand: string[];
  zoneOf: Map<string, { zone: string; p: PlayerId }>;
  power: Record<string, number>;
  soul: Record<string, number>;
  frame: Frame;
}

const PREFIX = ['BTR/W107-', 'BD/W125-'];

function buildSide(spec: SideSpec, p: PlayerId, cards: GameView['cards'], zoneOf: Built['zoneOf']) {
  const tok = (t: string, zone: string, i: number) => {
    const m = /^(T\d+)?(?:@(\w+))?(?::(rest|rev))?$/.exec(t);
    if (!m) throw new Error(`教學場地的卡寫錯了：${t}`);
    const uid = m[2] ? `${p}${m[2]}` : `${p}-${zone}-${i}`;
    cards[uid] = { cardId: m[1] ? PREFIX[p] + m[1] : null, owner: p };
    zoneOf.set(uid, { zone, p });
    return { uid, state: m[3] === 'rest' ? ('rest' as const) : m[3] === 'rev' ? ('reverse' as const) : ('stand' as const) };
  };
  const list = (zone: string, arr: string[] = []) => arr.map((t, i) => tok(t, zone, i).uid);
  const stockSpec = spec.stock ?? 0;
  const pl = {
    hand: list('hand', spec.hand),
    stage: [0, 1, 2, 3, 4].map((i) => (spec.stage?.[i] ? tok(spec.stage[i]!, 'stage', i) : null)),
    waiting: list('waiting', spec.waiting),
    clock: list('clock', spec.clock),
    level: list('level', spec.level),
    stock: typeof stockSpec === 'number' ? Array.from({ length: stockSpec }, (_, i) => tok('', 'stock', i).uid) : list('stock', stockSpec),
    climax: list('climax', spec.climax),
    memory: list('memory', spec.memory),
    resolution: list('resolution', spec.resolution),
    deck: [] as string[],
  };
  // 牌組：上面幾張是指定的卡（已經移到別區的跳過），其餘補蓋著的卡
  const n = spec.deck ?? 0;
  for (const t of spec.deckTop ?? []) {
    if (pl.deck.length >= n) break;
    const tag = /@(\w+)/.exec(t)?.[1];
    if (tag && zoneOf.has(`${p}${tag}`)) continue;
    pl.deck.push(tok(t, 'deck', pl.deck.length).uid);
  }
  while (pl.deck.length < n) pl.deck.push(tok('', 'deck', pl.deck.length).uid);
  return pl;
}

function buildFrames(frames: Frame[]): Built[] {
  let me: SideSpec = {};
  let opp: SideSpec = {};
  let power: Record<string, number> = {};
  let soul: Record<string, number> = {};
  return frames.map((f) => {
    me = { ...me, ...f.me };
    opp = { ...opp, ...f.opp };
    if (f.power) power = f.power;
    if (f.soul) soul = f.soul;
    const cards: GameView['cards'] = {};
    const zoneOf: Built['zoneOf'] = new Map();
    const p0 = buildSide(me, 0, cards, zoneOf);
    const p1 = buildSide(opp, 1, cards, zoneOf);
    const view = {
      cards, players: [p0, p1], firstPlayer: 0, turnPlayer: f.turn ?? 0, turn: 3, phase: 'main', attack: null, attacksThisTurn: 0,
      mods: [], markers: {}, skipStand: [], shields: [], usedOnce: [], winner: null, firstPick: null,
    } as unknown as GameView;
    const byUid = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [`0${k}`, v]));
    return { view, hand: p0.hand, zoneOf, power: byUid(power), soul: byUid(soul), frame: f };
  });
}

const HL_SEL = (k: string) => (k === 'hand' ? '.tut-hand' : /^stage-\d$/.test(k) ? `[data-slot^="${k.slice(6)}-"]` : k.startsWith('slot-') ? `[data-slot="${k.slice(5)}"]` : `[data-zone="${k}"]`);

function DemoBoard({ frames, hand }: { frames: Frame[]; hand: boolean }) {
  const built = useMemo(() => buildFrames(frames), [frames]);
  const [idx, setIdx] = useState(0);
  const [round, setRound] = useState(0); // 從頭重播：位置直接跳回去，不播飛回去的動畫
  const root = useRef<HTMLDivElement>(null);
  const origins = useRef(new Map<string, Origin>());
  const cur = built[idx]!;

  // 換格前算好：從牌組翻出來的卡要從牌組飛出來並翻面
  const prevIdx = useRef(idx);
  if (prevIdx.current !== idx) {
    const prev = built[prevIdx.current]!;
    prevIdx.current = idx;
    origins.current.clear();
    if (idx > 0) for (const [uid, at] of cur.zoneOf) {
      const was = prev.zoneOf.get(uid);
      if (was?.zone === 'deck' && at.zone !== 'deck') {
        origins.current.set(uid, { key: `deck-${was.p}`, flip: !!cur.view.cards[uid]?.cardId && at.zone !== 'stock', ms: 650 });
      }
    }
  }
  useFlip(root, `${round}-${idx}`, origins, round);

  useEffect(() => {
    if (built.length < 2) return;
    const last = idx === built.length - 1;
    const t = window.setTimeout(() => {
      if (last) {
        setRound((r) => r + 1);
        setIdx(0);
      } else setIdx(idx + 1);
    }, (cur.frame.ms ?? 1700) + (last ? 1800 : 0));
    return () => window.clearTimeout(t);
  }, [idx, built, cur]);

  // 這一格的特效：攻擊、洗牌
  useLayoutEffect(() => {
    const el = root.current;
    const f = cur.frame;
    if (!el) return;
    if (f.attack) playAttack(el, `${f.attack.p ?? 0}${f.attack.tag}`, f.attack.p ?? 0, f.attack.slot, f.attack.mode);
    if (f.shuffle) playShuffle(el, f.shuffle.p, f.shuffle.refresh);
  }, [idx, round]);

  const hl = cur.frame.hl ?? [];
  const cardOf = (uid: string) => {
    const id = cur.view.cards[uid]?.cardId;
    return id ? cardById.get(id) : undefined;
  };
  const noop = () => undefined;
  return (
    <div className={`tut-demo${hand ? ' with-hand' : ''}`} ref={root}>
      {hl.length > 0 && <style>{`${hl.map((k) => `.tut-demo ${HL_SEL(k)}`).join(',')}{animation:tut-hl 1.3s ease-in-out infinite;z-index:40;}`}</style>}
      {cur.frame.caption && <div className="tut-caption" key={`${round}-${idx}`}>{cur.frame.caption}</div>}
      <div className="tut-demo-mat">
        <Board
          view={cur.view}
          viewer={0}
          active={cur.frame.turn ?? 0}
          power={(uid) => cur.power[uid] ?? cardOf(uid)?.power ?? 0}
          soul={(uid) => cur.soul[uid] ?? cardOf(uid)?.soul ?? 0}
          selected={null}
          glow={new Set()}
          dropTargets={new Set()}
          dragOver={null}
          draggingFrom={null}
          onCard={noop}
          onZone={noop}
          onStagePointer={noop}
          attackModes={{}}
          onAttack={noop}
        />
      </div>
      {hand && (
        <div className="tut-hand" data-zone="hand-0">
          {cur.hand.map((uid) => {
            const c = cardOf(uid);
            return c ? <CardFace key={uid} uid={uid} card={c} /> : null;
          })}
        </div>
      )}
      {built.length > 1 && (
        <div className="tut-dots">{built.map((_, k) => <i key={k} className={k === idx ? 'on' : ''} />)}</div>
      )}
    </div>
  );
}

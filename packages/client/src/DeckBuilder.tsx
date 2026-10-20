// 組牌器與系列卡表：卡片清單（篩選）、卡片說明、牌組內容。
// 構築規則和伺服器共用 engine 的 deck-rules；這裡只負責畫面。
import { useMemo, useState } from 'react';
import { addProblem, deckSummary, isPlayable, mainSeries, MAX_CLIMAX, DECK_SIZE, type Card } from '@ws/engine';
import { CardImg, CardInfo, COLOR_ZH, TYPE_ZH } from './CardFace.tsx';
import { saveDeck, type SavedDeck } from './decks.ts';
import { TRIGGER_ZH } from './log.ts';
import { SERIES, SERIES_CARDS, cardById, seriesInfo } from './meta.ts';

// ───── 篩選 ─────
interface Filter {
  q: string;
  types: string[];
  levels: number[];
  colors: string[];
  costs: number[];
  souls: number[];
}
const EMPTY: Filter = { q: '', types: [], levels: [], colors: [], costs: [], souls: [] };

function matches(c: Card, f: Filter): boolean {
  if (f.types.length && !f.types.includes(c.type)) return false;
  if (f.colors.length && !f.colors.includes(c.color)) return false;
  // 沒有這個數值的卡（名場面沒有等級、事件沒有魂傷…）在勾選後不顯示
  if (f.levels.length && (c.type === 'climax' || !f.levels.includes(c.level ?? -1))) return false;
  if (f.costs.length && (c.cost === undefined || !f.costs.includes(c.cost))) return false;
  if (f.souls.length && (c.soul === undefined || !f.souls.includes(c.soul))) return false;
  const q = f.q.trim().toLowerCase();
  if (q) {
    const hay = [c.id, c.name.zh, c.name.ja, c.note ?? '', ...c.traits.flatMap((t) => [t.zh, t.ja]), ...c.abilities.flatMap((a) => [a.text.zh, a.text.ja])].join('\n').toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}
const filterCount = (f: Filter) => f.types.length + f.levels.length + f.colors.length + f.costs.length + f.souls.length + (f.q.trim() ? 1 : 0);

function Chips<T extends string | number>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T[]; onChange: (v: T[]) => void }) {
  return (
    <div className="chips">
      <span className="chips-lbl">{label}</span>
      {options.map(([v, text]) => {
        const on = value.includes(v);
        return (
          <button key={String(v)} type="button" className={`chip${on ? ' on' : ''}${typeof v === 'string' && v in COLOR_ZH ? ` col c-${v}` : ''}`} onClick={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

function FilterBar({ f, set, pool }: { f: Filter; set: (f: Filter) => void; pool: Card[] }) {
  const [open, setOpen] = useState(false);
  const colors = (['yellow', 'green', 'red', 'blue', 'purple'] as const).filter((c) => c !== 'purple' || pool.some((x) => x.color === 'purple'));
  const n = filterCount(f) - (f.q.trim() ? 1 : 0);
  return (
    <div className="filters">
      <div className="filter-top">
        <input className="search" type="search" placeholder="搜尋卡名、效果、卡號" value={f.q} onChange={(e) => set({ ...f, q: e.target.value })} />
        <button type="button" className={`btn${n ? ' primary' : ''}`} onClick={() => setOpen(!open)}>篩選{n ? `（${n}）` : ''} {open ? '▴' : '▾'}</button>
        {filterCount(f) > 0 && <button type="button" className="btn ghost" onClick={() => set(EMPTY)}>清除</button>}
      </div>
      {open && (
        <div className="filter-grid">
          <Chips label="類型" options={[['character', '角色'], ['event', '事件'], ['climax', '名場面']]} value={f.types} onChange={(types) => set({ ...f, types })} />
          <Chips label="等級" options={[0, 1, 2, 3].map((v) => [v, String(v)] as [number, string])} value={f.levels} onChange={(levels) => set({ ...f, levels })} />
          <Chips label="顏色" options={colors.map((c) => [c, COLOR_ZH[c]!] as [string, string])} value={f.colors} onChange={(colors) => set({ ...f, colors })} />
          <Chips label="費用" options={[0, 1, 2, 3].map((v) => [v, String(v)] as [number, string])} value={f.costs} onChange={(costs) => set({ ...f, costs })} />
          <Chips label="魂傷" options={[0, 1, 2].map((v) => [v, String(v)] as [number, string])} value={f.souls} onChange={(souls) => set({ ...f, souls })} />
        </div>
      )}
    </div>
  );
}

// ───── 卡片格子（卡圖＋卡號＋卡名＋數值標籤，標籤用卡片顏色） ─────
export function CardTile({ card, count, selected, onClick, onAdd }: { card: Card; count?: number; selected?: boolean; onClick: () => void; onAdd?: () => void }) {
  const ready = isPlayable(card);
  const tags: [string, string][] = [['類型', TYPE_ZH[card.type]!]];
  if (card.type === 'climax') tags.push(['判定', card.triggers.map((t) => TRIGGER_ZH[t] ?? t).join('＋') || '—']);
  if (card.level !== undefined) tags.push(['等級', String(card.level)]);
  if (card.soul !== undefined) tags.push(['魂傷', String(card.soul)]);
  if (card.cost !== undefined) tags.push(['費用', String(card.cost)]);
  if (card.power !== undefined) tags.push(['攻擊', String(card.power)]);
  return (
    <div className={`ctile c-${card.color}${selected ? ' selected' : ''}${ready ? '' : ' unready'}`} onClick={onClick}>
      <div className="ctile-img">
        <CardImg card={card} />
        {!!count && <span className="cnt">×{count}</span>}
        {onAdd && ready && (
          <button type="button" className="ctile-add" title="加 1 張" onClick={(e) => { e.stopPropagation(); onAdd(); }}>＋</button>
        )}
        {!ready && <span className="ctile-wip">製作中</span>}
      </div>
      <div className="ctile-no">{card.id}</div>
      <div className="ctile-name">{card.name.zh}</div>
      <div className="ctile-tags">
        {tags.map(([k, v]) => <span key={k}><i>{k}</i>{v}</span>)}
      </div>
    </div>
  );
}

function CardPool({ cards, counts, selected, onSelect, onAdd }: { cards: Card[]; counts?: Map<string, number>; selected: string | null; onSelect: (id: string) => void; onAdd?: (id: string) => void }) {
  const [f, setF] = useState<Filter>(EMPTY);
  const shown = useMemo(() => cards.filter((c) => matches(c, f)), [cards, f]);
  return (
    <div className="pool">
      <FilterBar f={f} set={setF} pool={cards} />
      <div className="pool-meta muted">{shown.length} / {cards.length} 種</div>
      <div className="pool-grid">
        {shown.map((c) => (
          <CardTile key={c.id} card={c} count={counts?.get(c.id)} selected={selected === c.id} onClick={() => onSelect(c.id)} onAdd={onAdd && (() => onAdd(c.id))} />
        ))}
        {shown.length === 0 && <p className="muted pool-empty">沒有符合條件的卡。</p>}
      </div>
    </div>
  );
}

// 卡片說明面板：寬螢幕在左側，窄螢幕改成彈窗
function InfoPanel({ card, count, onAdd, onRemove, onClose }: { card: Card | null; count?: number; onAdd?: () => void; onRemove?: () => void; onClose: () => void }) {
  if (!card) return <aside className="info-side"><p className="muted">點一下卡片查看大圖與效果說明。</p></aside>;
  const body = (
    <>
      <div className="info-left">
      <div className="info-big"><CardImg card={card} /></div>
      {onAdd && (
        <div className="count-ctl">
          <button type="button" className="btn" disabled={!count} onClick={onRemove}>－</button>
          <b>{count ?? 0} 張</b>
          <button type="button" className="btn primary" onClick={onAdd}>＋</button>
        </div>
      )}
      </div>
      <div className="info-stack"><CardInfo card={card} /></div>
    </>
  );
  return (
    <>
      <aside className="info-side">{body}</aside>
      <div className="modal info-modal" onClick={onClose}>
        <div className="dialog" onClick={(e) => e.stopPropagation()}>
          <header className="info-modal-head"><b>{card.id}</b><button className="btn" onClick={onClose}>關閉</button></header>
          <div className="info-modal-body">{body}</div>
        </div>
      </div>
    </>
  );
}

function SeriesTabs({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div className="series-tabs">
      {Object.keys(SERIES).filter((s) => SERIES_CARDS.has(s)).map((s) => (
        <button key={s} type="button" className={`series-tab${s === value ? ' on' : ''}`} style={{ ['--pc' as string]: seriesInfo(s).accent }} onClick={() => onChange(s)}>
          {seriesInfo(s).label}
        </button>
      ))}
    </div>
  );
}

// ───── 系列卡表（只看，不組牌） ─────
export function SeriesBrowser({ series, onBack }: { series: string; onBack: () => void }) {
  const [cur, setCur] = useState(series);
  const [sel, setSel] = useState<string | null>(null);
  const cards = SERIES_CARDS.get(cur) ?? [];
  return (
    <div className="builder browse" style={{ ['--pc' as string]: seriesInfo(cur).accent }}>
      <header className="bld-head">
        <button className="btn ghost" onClick={onBack}>← 返回</button>
        <h2>系列卡表</h2>
        <SeriesTabs value={cur} onChange={(s) => { setCur(s); setSel(null); }} />
      </header>
      <div className="bld-body">
        <InfoPanel card={sel ? cardById.get(sel)! : null} onClose={() => setSel(null)} />
        <CardPool cards={cards} selected={sel} onSelect={setSel} />
      </div>
    </div>
  );
}

// ───── 組牌器 ─────
const ORDER = { character: 0, event: 1, climax: 2 } as const;
const sortIds = (ids: string[]) => {
  const c = (id: string) => cardById.get(id)!;
  return [...ids].sort((a, b) => ORDER[c(a).type] - ORDER[c(b).type] || (c(a).level ?? 0) - (c(b).level ?? 0) || a.localeCompare(b));
};

export function DeckBuilder({ deck, series, onClose }: { deck: SavedDeck | null; series: string; onClose: () => void }) {
  const [id, setId] = useState(deck?.id);
  const [name, setName] = useState(deck?.name ?? `${seriesInfo(series).label} 牌組`);
  const [cards, setCards] = useState<string[]>(deck?.cards ?? []);
  const [saved, setSaved] = useState(JSON.stringify({ name: deck?.name ?? null, cards: deck?.cards ?? [] }));
  const [pool, setPool] = useState(deck && deck.cards.length ? mainSeries(deck.cards) : series);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of cards) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  }, [cards]);
  const sum = deckSummary(cardById, cards);
  const dirty = JSON.stringify({ name, cards }) !== saved;
  const flash = (t: string) => {
    setMsg(t);
    window.setTimeout(() => setMsg((m) => (m === t ? null : m)), 2600);
  };

  const add = (cid: string) => {
    const p = addProblem(cardById, cards, cid);
    if (p) return flash(p);
    setCards([...cards, cid]);
  };
  const remove = (cid: string) => {
    const i = cards.lastIndexOf(cid);
    if (i >= 0) setCards([...cards.slice(0, i), ...cards.slice(i + 1)]);
  };
  const save = async () => {
    setBusy(true);
    try {
      const d = await saveDeck({ id, name, cards: sortIds(cards) });
      setId(d.id);
      setName(d.name);
      setCards(d.cards);
      setSaved(JSON.stringify({ name: d.name, cards: d.cards }));
      flash(sum.notReady ? `已儲存（${sum.notReady}，補齊後才能對戰）` : '已儲存');
    } catch (e) {
      flash(`儲存失敗：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const back = () => {
    if (dirty && !window.confirm('還沒儲存，確定要離開嗎？')) return;
    onClose();
  };

  const rows = useMemo(() => sortIds([...counts.keys()]), [counts]);
  return (
    <div className="builder" style={{ ['--pc' as string]: seriesInfo(pool).accent }}>
      <header className="bld-head">
        <button className="btn ghost" onClick={back}>← 返回</button>
        <input className="deck-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} aria-label="牌組名稱" />
        <SeriesTabs value={pool} onChange={(s) => { setPool(s); setSel(null); }} />
        <button className="btn primary" disabled={busy || !dirty || !!sum.invalid} onClick={() => void save()}>{busy ? '儲存中…' : dirty ? '儲存' : '已儲存'}</button>
      </header>
      <div className="bld-body has-deck">
        <InfoPanel card={sel ? cardById.get(sel)! : null} count={sel ? counts.get(sel) ?? 0 : 0} onAdd={sel ? () => add(sel) : undefined} onRemove={sel ? () => remove(sel) : undefined} onClose={() => setSel(null)} />
        <CardPool cards={SERIES_CARDS.get(pool) ?? []} counts={counts} selected={sel} onSelect={setSel} onAdd={add} />
        <aside className="deck-side">
          <div className={`deck-sum${sum.notReady ? '' : ' ok'}`}>
            <b>{sum.total} <small>/ {DECK_SIZE}</small></b>
            <span>名場面 {sum.climax} / {MAX_CLIMAX}</span>
            <span className="state">{sum.notReady ?? '可以對戰'}</span>
          </div>
          <div className="deck-rows">
            {rows.map((cid) => {
              const c = cardById.get(cid)!;
              return (
                <div key={cid} className={`deck-row c-${c.color}${sel === cid ? ' on' : ''}`} onClick={() => setSel(cid)}>
                  <i className="lv">{c.type === 'climax' ? 'CX' : c.type === 'event' ? '事' : `Lv${c.level}`}</i>
                  <span className="nm">{c.name.zh}</span>
                  <button type="button" onClick={(e) => { e.stopPropagation(); remove(cid); }}>－</button>
                  <b>{counts.get(cid)}</b>
                  <button type="button" onClick={(e) => { e.stopPropagation(); add(cid); }}>＋</button>
                </div>
              );
            })}
            {rows.length === 0 && <p className="muted">點卡片右下角的「＋」加進牌組。</p>}
          </div>
        </aside>
      </div>
      {msg && <div className="toast bld-toast">{msg}</div>}
    </div>
  );
}

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Card } from '@ws/engine';
import { Board, type ZoneMode } from './Board.tsx';
import { Abilities, BACK_URL, CardFace, CardImg, CardInfo, cardMeta } from './CardFace.tsx';
import { PHASES, SERIES, cardById, initialMe, initialOpp, type SideState } from './mock.ts';

type Source = { from: 'hand' | 'stage'; index: number };
type Selection = Source | null;
type ZoneView = { title: string; ids: string[]; mode: ZoneMode } | null;
type Drag = { src: Source; id: string; x: number; y: number; over: string | null } | null;

const DRAG_THRESHOLD = 8; // 移動超過幾 px 才算拖曳，否則算點選
const dropTargetAt = (x: number, y: number) =>
  (document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null)?.dataset.drop ?? null;

export default function App() {
  const [me, setMe] = useState<SideState>(initialMe);
  const [opp] = useState<SideState>(initialOpp);
  const [phase, setPhase] = useState(3);
  const [viewed, setViewed] = useState<Card | null>(null); // 點選查看、但不能操作的卡（對手的卡、名場面等）
  const [sel, setSel] = useState<Selection>(null); // 點選的自己的卡（可以操作）
  const [drag, setDrag] = useState<Drag>(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 1000 && window.innerHeight > 520);
  const [zoneView, setZoneView] = useState<ZoneView>(null);
  const [sheet, setSheet] = useState<null | 'ask' | 'pick'>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2400);
  };

  const idAt = (s: Source) => (s.from === 'hand' ? me.hand[s.index] : me.stage[s.index]?.id);
  const selectedCard = useMemo(() => {
    const id = sel ? idAt(sel) : undefined;
    return id ? (cardById.get(id) ?? null) : null;
  }, [sel, me]);
  const shown = viewed ?? selectedCard;
  const cur = PHASES[phase]!;

  // 預覽一律用點選觸發（桌機與手機一致），不用滑鼠懸停
  const peek = (c: Card) => {
    setViewed(c);
    setSel(null);
    setPanelOpen(true);
  };
  const select = (target: Source) => {
    const same = sel?.from === target.from && sel.index === target.index;
    if (same && !viewed) return setSel(null);
    setSel(target);
    setViewed(null);
    setPanelOpen(true);
  };

  const tap = (src: Source) => {
    if (src.from === 'hand' && sheet === 'pick') return setPicked(picked === src.index ? null : src.index);
    select(src);
  };

  // ── 出牌與移動（示範；正式規則之後由引擎判定）──
  const putOnStage = (id: string, slot: number, fromHand: number) => {
    const old = me.stage[slot];
    const hand = me.hand.filter((_, i) => i !== fromHand);
    setMe({
      ...me,
      hand,
      handCount: hand.length,
      stage: me.stage.map((p, i) => (i === slot ? { id, rested: false } : p)),
      waiting: old ? [...me.waiting, old.id] : me.waiting,
    });
    if (old) say('原本在那格的角色放進休息室');
  };

  const dropOn = (src: Source, id: string, target: string) => {
    const card = cardById.get(id)!;
    if (target === 'climax') {
      if (src.from !== 'hand') return;
      if (card.type !== 'climax') return say('只有名場面卡能放到名場面區');
      if (cur.id !== 'climax') return say('名場面只能在「名場面」階段打出');
      if (me.climax.length) return say('名場面區已經有一張了');
      const hand = me.hand.filter((_, i) => i !== src.index);
      setMe({ ...me, hand, handCount: hand.length, climax: [id] });
      return setSel(null);
    }
    const slot = Number(target.replace('slot-', ''));
    if (src.from === 'hand') {
      if (card.type === 'climax') return say('名場面要放到名場面區');
      if (card.type === 'event') return say('事件卡請點選後按「使用」');
      if (cur.id !== 'main') return say('角色只能在「主要」階段打出');
      putOnStage(id, slot, src.index);
    } else {
      if (slot === src.index) return;
      if (cur.id !== 'main') return say('只有「主要」階段可以移動角色');
      const stage = [...me.stage];
      [stage[src.index], stage[slot]] = [stage[slot] ?? null, stage[src.index] ?? null];
      setMe({ ...me, stage });
    }
    setSel(null);
  };

  // 按下卡片：移動超過門檻就是拖曳，否則放開時當作點選。用 pointer 事件，滑鼠與觸控共用
  const beginPointer = (e: ReactPointerEvent, src: Source) => {
    if (e.button !== 0) return;
    const id = idAt(src);
    if (!id) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
      moved = true;
      setDrag({ src, id, x: ev.clientX, y: ev.clientY, over: dropTargetAt(ev.clientX, ev.clientY) });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDrag(null);
      if (!moved) return tap(src);
      const target = ev.type === 'pointerup' ? dropTargetAt(ev.clientX, ev.clientY) : null;
      if (target) dropOn(src, id, target);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const playEvent = (index: number) => {
    const id = me.hand[index]!;
    if (cur.id !== 'main') return say('事件只能在「主要」階段使用');
    const hand = me.hand.filter((_, i) => i !== index);
    setMe({ ...me, hand, handCount: hand.length, waiting: [...me.waiting, id] });
    setSel(null);
    say('事件使用後放進休息室（示範，效果尚未實作）');
  };

  const toggleRest = (index: number) =>
    setMe({ ...me, stage: me.stage.map((p, i) => (i === index && p ? { ...p, rested: !p.rested } : p)) });

  const confirmPay = () => {
    if (picked === null) return;
    const id = me.hand[picked];
    if (!id) return;
    const hand = me.hand.filter((_, i) => i !== picked);
    setMe({ ...me, hand, handCount: hand.length, waiting: [...me.waiting, id] });
    setSheet(null);
    setPicked(null);
    say('已支付：手牌 1 張放到休息室（示範到此結束）');
  };

  const dragCard = drag ? cardById.get(drag.id)! : null;
  const dragKind = !dragCard ? null : drag!.src.from === 'stage' || dragCard.type === 'character' ? 'character' : dragCard.type === 'climax' ? 'climax' : null;
  const sheetCard = cardById.get('BTR/W107-T09')!;

  return (
    <div className={`app${drag ? ' dragging' : ''}`} style={{ ['--accent' as string]: SERIES[me.series].accent }}>
      <header className="topbar">
        <div className="brand">
          <span className="logo">WS</span>
          <span className="vs">{SERIES[me.series].label}<i>vs</i>{SERIES[opp.series].label}</span>
        </div>
        <ol className="phases" aria-label="階段列">
          {PHASES.map((p, i) => (
            <li key={p.id} className={i === phase ? 'on' : i < phase ? 'done' : ''}>{p.name}</li>
          ))}
        </ol>
        <div className="opp-hand" title="對手手牌張數">
          <span>對手手牌</span>
          <div className="fan">{Array.from({ length: opp.handCount }).map((_, i) => <img key={i} src={BACK_URL} alt="" style={{ ['--i' as string]: i }} />)}</div>
          <b>{opp.handCount}</b>
        </div>
        <button className="btn ghost" onClick={() => setSheet('ask')}>示範：可選擇的費用</button>
        <button className="btn primary" onClick={() => setPhase((phase + 1) % PHASES.length)}>下一階段</button>
      </header>
      <div className="hint"><b>{cur.name}階段</b><span>{cur.hint}</span></div>
      <div className="rotate-tip">手機請橫向使用，畫面會完整顯示整個場地。</div>

      <div className="main">
        <aside className={`panel${panelOpen ? '' : ' closed'}`}>
          <button className="tab" onClick={() => setPanelOpen(!panelOpen)} aria-label={panelOpen ? '收合卡面預覽' : '展開卡面預覽'}>
            {panelOpen ? '◀' : '卡面預覽 ▶'}
          </button>
          {panelOpen && (shown ? (
            <Preview card={shown}>
              {sel && selectedCard && !viewed && (
                <div className="actions">
                  {sel.from === 'hand' ? (
                    selectedCard.type === 'event' ? (
                      <button className="btn primary" onClick={() => playEvent(sel.index)}>使用</button>
                    ) : (
                      <p className="why tip">把卡片拖到場上的格子就能出牌</p>
                    )
                  ) : (
                    <button className="btn primary" onClick={() => toggleRest(sel.index)}>{me.stage[sel.index]?.rested ? '直立' : '橫置'}</button>
                  )}
                  <button className="btn" onClick={() => setSel(null)}>取消</button>
                </div>
              )}
            </Preview>
          ) : (
            <div className="empty-preview">
              <div className="ph-card" />
              <p>點一下卡片，這裡會顯示大圖與效果說明。<br />手牌可以直接拖到場上出牌。</p>
            </div>
          ))}
        </aside>

        <section className="table">
          <Board
            me={me}
            opp={opp}
            selected={sel?.from === 'stage' ? sel.index : null}
            dragging={dragKind}
            dragOver={drag?.over ?? null}
            draggingFrom={drag?.src.from === 'stage' ? drag.src.index : null}
            onPeek={peek}
            onZone={(title, ids, mode) => setZoneView({ title, ids, mode })}
            onStagePointer={(e, i) => beginPointer(e, { from: 'stage', index: i })}
          />
          <div className={`hand${sheet === 'pick' ? ' picking' : ''}`} aria-label="手牌">
            {me.hand.map((id, i) => (
              <CardFace
                key={id + i}
                card={cardById.get(id)!}
                selected={sheet === 'pick' ? picked === i : sel?.from === 'hand' && sel.index === i}
                dim={drag?.src.from === 'hand' && drag.src.index === i}
                onPointerDown={(e) => beginPointer(e, { from: 'hand', index: i })}
              />
            ))}
          </div>
        </section>
      </div>

      {zoneView && <ZoneDialog view={zoneView} onClose={() => setZoneView(null)} />}

      {sheet && (
        <div className="sheet" role="dialog" aria-label="可選擇的費用">
          {sheet === 'ask' ? (
            <>
              <div className="sheet-body">
                <div className="sheet-card"><CardImg card={sheetCard} /></div>
                <div>
                  <h3>{sheetCard.name.zh}<small>登場時效果</small></h3>
                  <p>可以付費發動：付了的話，從休息室選最多 2 張角色回到手牌。</p>
                  <p className="cost"><span>費用</span>手牌 1 張放到休息室</p>
                </div>
              </div>
              <div className="actions">
                <button className="btn primary" onClick={() => setSheet('pick')}>支付並發動</button>
                <button className="btn" onClick={() => setSheet(null)}>不發動</button>
              </div>
            </>
          ) : (
            <div className="sheet-pick">
              <p>請在手牌選 1 張放到休息室（可選的牌已亮起）</p>
              <div className="actions">
                <button className="btn primary" disabled={picked === null} onClick={confirmPay}>確認</button>
                <button className="btn" onClick={() => { setSheet('ask'); setPicked(null); }}>返回上一步</button>
              </div>
            </div>
          )}
        </div>
      )}

      {drag && dragCard && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <CardImg card={dragCard} />
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function Preview({ card, children }: { card: Card; children?: React.ReactNode }) {
  return (
    <div className="preview">
      <div className="pv-head">
        <div className="pv-card"><CardImg card={card} /></div>
        <div className="pv-info">
          <h3>{card.name.zh}</h3>
          <p className="ja">{card.name.ja}</p>
          <p className="meta">{cardMeta(card)}</p>
          {card.traits.length > 0 && <div className="traits">{card.traits.map((t) => <span key={t.ja}>{t.zh}</span>)}</div>}
        </div>
      </div>
      <Abilities card={card} />
      {card.note && <div className="note"><b>白話說明</b><p>{card.note}</p></div>}
      {children}
    </div>
  );
}

// 區域彈窗：inline＝點卡後說明顯示在同一頁下方（傷害區、等級區、回憶區）；
// layer＝卡多，點卡後再開一層說明頁（休息室）
function ZoneDialog({ view, onClose }: { view: NonNullable<ZoneView>; onClose: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [detail, setDetail] = useState<Card | null>(null);
  const cards = view.ids.map((id) => cardById.get(id)!);
  const pickedCard = picked !== null ? cards[picked] : undefined;

  return (
    <div className="modal" onClick={onClose}>
      <div className={`dialog zone-dialog ${view.mode}`} onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{view.title}<small>{cards.length} 張</small></h3>
          <button className="btn" onClick={onClose}>關閉</button>
        </header>
        <div className="zgrid">
          {cards.length === 0 && <p className="muted">目前沒有卡片。</p>}
          {cards.map((c, i) => (
            <CardFace
              key={view.ids[i]! + i}
              card={c}
              selected={view.mode === 'inline' ? picked === i : detail === c}
              onClick={() => (view.mode === 'inline' ? setPicked(picked === i ? null : i) : setDetail(c))}
            />
          ))}
        </div>
        {view.mode === 'inline' && cards.length > 0 && (
          <div className="zone-info">
            {pickedCard ? <CardInfo card={pickedCard} /> : <p className="muted">點選上面的卡片，說明會顯示在這裡。</p>}
          </div>
        )}
      </div>

      {detail && (
        <div className="modal layer" onClick={(e) => { e.stopPropagation(); setDetail(null); }}>
          <div className="dialog detail" onClick={(e) => e.stopPropagation()}>
            <div className="detail-img"><CardImg card={detail} /></div>
            <div className="detail-body">
              <CardInfo card={detail} />
              <div className="actions"><button className="btn" onClick={() => setDetail(null)}>返回休息室</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

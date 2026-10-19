import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { viewFor, type Action, type Card, type GameState, type Pending, type PlayerId, type Slot } from '@ws/engine';
import { Board, type ZoneMode } from './Board.tsx';
import { Abilities, BACK_URL, CardFace, CardImg, CardInfo, cardMeta } from './CardFace.tsx';
import { PHASES, PLAYERS, SLOT_NAME, cardById, engine } from './meta.ts';

// 同一台電腦兩人輪流操作：畫面永遠用「現在要做決定的玩家」的視角，換人時先遮住手牌

type Source = { from: 'hand'; uid: string } | { from: 'stage'; slot: number; uid: string };
type ZoneView = { title: string; ids: string[]; mode: ZoneMode } | null;
type Drag = { src: Source; x: number; y: number; over: string | null } | null;

const DRAG_THRESHOLD = 8;
const dropTargetAt = (x: number, y: number) =>
  (document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null)?.dataset.drop ?? null;

const newGame = () => engine.newGame({ seed: (Math.random() * 2 ** 31) >>> 0, decks: [PLAYERS[0].deck, PLAYERS[1].deck] }).state;

export default function App() {
  const [game, setGame] = useState<GameState>(newGame);
  const [seen, setSeen] = useState<PlayerId | null>(null); // 已經確認換人的玩家
  const [selfTest, setSelfTest] = useState(false); // 自己一個人測試：不跳換人遮罩
  const [viewed, setViewed] = useState<Card | null>(null);
  const [selected, setSelected] = useState<Source | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 1000 && window.innerHeight > 520);
  const [zoneView, setZoneView] = useState<ZoneView>(null);
  const [toast, setToast] = useState<string | null>(null);

  const pending = game.pending;
  const viewer: PlayerId = pending?.player ?? game.turnPlayer;
  const view = useMemo(() => viewFor(game, viewer), [game, viewer]);
  const legal = useMemo(() => engine.legalActions(game), [game]);
  const me = view.players[viewer];
  const handoff = !selfTest && game.winner === null && seen !== viewer;

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  const act = (a: Action) => {
    const r = engine.apply(game, a);
    if (r.error) return say(r.error);
    for (const e of r.events) if (e.t === 'notice') say(e.text);
    setGame(r.state);
    setSelected(null);
    setViewed(null);
  };

  const cardOfUid = (uid: string) => cardById.get(game.cards[uid]!.cardId)!;
  const shown = viewed ?? (selected ? cardOfUid(selected.uid) : null);
  const has = (pred: (a: Action) => boolean) => legal.some(pred);

  // 拖曳中可以放的地方（由引擎的合法動作決定）
  const dropTargets = useMemo(() => {
    const out = new Set<string>();
    if (!drag || !pending) return out;
    const { src } = drag;
    if (src.from === 'hand') {
      if (pending.kind === 'main' && has((a) => a.type === 'playCharacter' && a.uid === src.uid)) for (let i = 0; i < 5; i++) out.add(`slot-${i}`);
      if (pending.kind === 'climax' && has((a) => a.type === 'playClimax' && a.uid === src.uid)) out.add('climax');
      if (pending.kind === 'clock') out.add('clock');
    } else if (pending.kind === 'main') {
      for (let i = 0; i < 5; i++) if (i !== src.slot) out.add(`slot-${i}`);
    }
    return out;
  }, [drag, pending, legal]);

  const dropOn = (src: Source, target: string) => {
    if (!pending) return;
    if (target === 'clock' && pending.kind === 'clock' && src.from === 'hand') return act({ type: 'clock', player: viewer, uid: src.uid });
    if (target === 'climax' && src.from === 'hand') return act({ type: 'playClimax', player: viewer, uid: src.uid });
    if (target.startsWith('slot-') && pending.kind === 'main') {
      const slot = Number(target.slice(5)) as Slot;
      if (src.from === 'hand') return act({ type: 'playCharacter', player: viewer, uid: src.uid, slot });
      if (slot !== src.slot) return act({ type: 'moveStage', player: viewer, from: src.slot as Slot, to: slot });
    }
    say('這裡不能放');
  };

  // 按下卡片：移動超過門檻就是拖曳，否則放開時當作點選（滑鼠與觸控共用）
  const beginPointer = (e: ReactPointerEvent, src: Source) => {
    if (e.button !== 0) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_THRESHOLD) return;
      moved = true;
      setDrag({ src, x: ev.clientX, y: ev.clientY, over: dropTargetAt(ev.clientX, ev.clientY) });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      setDrag(null);
      if (!moved) {
        setViewed(null);
        setSelected((cur) => (cur?.uid === src.uid ? null : src));
        setPanelOpen(true);
        return;
      }
      const target = ev.type === 'pointerup' ? dropTargetAt(ev.clientX, ev.clientY) : null;
      if (target) dropOn(src, target);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const peek = (uid: string) => {
    const id = view.cards[uid]?.cardId;
    if (!id) return;
    setSelected(null);
    setViewed(cardById.get(id)!);
    setPanelOpen(true);
  };

  // 可以點選的卡發光
  const glow = useMemo(() => {
    const g = new Set<string>();
    for (const a of legal) {
      if (a.type === 'attack') g.add(me.stage[a.slot]!.uid);
      if (a.type === 'activate') g.add(a.uid);
      if (a.type === 'playCharacter' || a.type === 'playEvent' || a.type === 'playClimax') g.add(a.uid);
    }
    return g;
  }, [legal, me]);

  const passLabel: Partial<Record<Pending['kind'], string>> = { clock: '略過時計', main: '結束主要階段', climax: '不打名場面', attackDeclare: '結束攻擊' };
  const curPhase = PHASES.find((p) => p.id === game.phase);
  const dragCard = drag ? cardOfUid(drag.src.uid) : null;

  return (
    <div className={`app${drag ? ' dragging' : ''}`} style={{ ['--accent' as string]: PLAYERS[viewer].accent }}>
      <header className="topbar">
        <div className="brand">
          <span className="logo">WS</span>
          <span className="vs">
            <b>{PLAYERS[viewer].label}</b>（{PLAYERS[viewer].series}）<i>vs</i>{PLAYERS[(1 - viewer) as PlayerId].series}
          </span>
        </div>
        <ol className="phases" aria-label="階段列">
          {PHASES.map((p, i) => {
            const cur = PHASES.findIndex((x) => x.id === game.phase);
            return <li key={p.id} className={i === cur ? 'on' : i < cur ? 'done' : ''}>{p.name}</li>;
          })}
        </ol>
        <div className="opp-hand" title="對手手牌張數">
          <span>對手手牌</span>
          <div className="fan">{view.players[(1 - viewer) as PlayerId].hand.map((u, i) => <img key={u} src={BACK_URL} alt="" style={{ ['--i' as string]: i }} />)}</div>
          <b>{view.players[(1 - viewer) as PlayerId].hand.length}</b>
        </div>
        <label className="selftest" title="自己一個人測試時，換人不跳遮罩">
          <input type="checkbox" checked={selfTest} onChange={(e) => setSelfTest(e.target.checked)} /> 單人測試
        </label>
        {pending && passLabel[pending.kind] && (
          <button className="btn primary" onClick={() => act(pending.kind === 'clock' ? { type: 'clock', player: viewer, uid: null } : { type: 'pass', player: viewer })}>
            {passLabel[pending.kind]}
          </button>
        )}
      </header>
      <div className="hint">
        <b>第 {Math.max(1, game.turn)} 回合・{game.turn === 0 ? '換牌' : `${PLAYERS[game.turnPlayer].label}的${curPhase?.name ?? ''}階段`}</b>
        <span>{pending ? pendingHint(pending) : curPhase?.hint}</span>
      </div>
      <div className="rotate-tip">手機請橫向使用，畫面會完整顯示整個場地。</div>

      <div className="main">
        <aside className={`panel${panelOpen ? '' : ' closed'}`}>
          <button className="tab" onClick={() => setPanelOpen(!panelOpen)} aria-label={panelOpen ? '收合卡面預覽' : '展開卡面預覽'}>
            {panelOpen ? '◀' : '卡面預覽 ▶'}
          </button>
          {panelOpen && (shown ? (
            <Preview card={shown}>{selected && !viewed && <CardActions src={selected} />}</Preview>
          ) : (
            <div className="empty-preview">
              <div className="ph-card" />
              <p>點一下卡片，這裡會顯示大圖與效果說明。<br />手牌可以直接拖到場上出牌。</p>
            </div>
          ))}
        </aside>

        <section className="table">
          <Board
            view={view}
            viewer={viewer}
            power={(uid) => engine.power(game, uid)}
            soul={(uid) => engine.soul(game, uid)}
            selected={selected?.uid ?? null}
            glow={glow}
            dropTargets={dropTargets}
            dragOver={drag?.over ?? null}
            draggingFrom={drag?.src.from === 'stage' ? drag.src.slot : null}
            onCard={peek}
            onZone={(title, ids, mode) => setZoneView({ title, ids, mode })}
            onStagePointer={(e, slot) => {
              const uid = me.stage[slot]?.uid;
              if (uid) beginPointer(e, { from: 'stage', slot, uid });
            }}
          />
          <div className="hand" aria-label="手牌">
            {me.hand.map((uid) => (
              <CardFace
                key={uid}
                card={cardOfUid(uid)}
                selected={selected?.uid === uid}
                glow={glow.has(uid)}
                dim={drag?.src.uid === uid}
                onPointerDown={(e) => beginPointer(e, { from: 'hand', uid })}
              />
            ))}
          </div>
        </section>
      </div>

      {zoneView && <ZoneDialog view={zoneView} cardOf={(uid) => (view.cards[uid]?.cardId ? cardById.get(view.cards[uid]!.cardId!)! : null)} onClose={() => setZoneView(null)} />}

      {pending && !handoff && isPrompt(pending) && <PromptSheet key={JSON.stringify(pending)} pending={pending} game={game} legal={legal} act={act} />}

      {handoff && (
        <div className="handoff">
          <div className="handoff-box" style={{ ['--accent' as string]: PLAYERS[viewer].accent }}>
            <p className="who">輪到 {PLAYERS[viewer].label}（{PLAYERS[viewer].series}）</p>
            <p>{pending ? pendingHint(pending) : ''}</p>
            <p className="muted">請把畫面交給{PLAYERS[viewer].label}，對方的手牌已經隱藏。</p>
            <button className="btn primary" onClick={() => setSeen(viewer)}>我是{PLAYERS[viewer].label}，開始</button>
          </div>
        </div>
      )}

      {game.winner !== null && (
        <div className="handoff">
          <div className="handoff-box">
            <p className="who">{game.winner === 'draw' ? '平手' : `${PLAYERS[game.winner].label}（${PLAYERS[game.winner].series}）獲勝`}</p>
            <button className="btn primary" onClick={() => { setGame(newGame()); setSeen(null); }}>再來一局</button>
          </div>
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

  // 選取自己的卡時，預覽面板下方的操作按鈕
  function CardActions({ src }: { src: Source }) {
    const card = cardOfUid(src.uid);
    const buttons: { label: string; a: Action }[] = [];
    let tip: string | null = null;
    for (const a of legal) {
      if (a.type === 'playEvent' && a.uid === src.uid) buttons.push({ label: '使用事件', a });
      if (a.type === 'playClimax' && a.uid === src.uid) buttons.push({ label: '打出名場面', a });
      if (a.type === 'clock' && a.uid === src.uid) buttons.push({ label: '放到傷害區，抽 2 張', a });
      if (a.type === 'activate' && a.uid === src.uid) {
        const text = engine.abilitiesOf(game, a.uid)[a.index]!.text.zh.replace(/^【起】/, '');
        buttons.push({ label: `發動：${text.length > 18 ? `${text.slice(0, 18)}…` : text}`, a });
      }
      if (a.type === 'attack' && src.from === 'stage' && a.slot === src.slot) buttons.push({ label: { front: '正打', side: '側打', direct: '直接攻擊' }[a.mode], a });
    }
    if (src.from === 'hand' && card.type === 'character' && has((a) => a.type === 'playCharacter' && a.uid === src.uid)) tip = '把這張卡拖到場上的格子就能出牌';
    if (src.from === 'hand' && pending?.kind === 'main' && !has((a) => (a.type === 'playCharacter' || a.type === 'playEvent') && a.uid === src.uid)) {
      tip = engine.playProblem(game, viewer, src.uid) ?? null;
    }
    if (!buttons.length && !tip) return null;
    return (
      <div className="actions">
        {buttons.map((b) => <button key={JSON.stringify(b.a)} className="btn primary" onClick={() => act(b.a)}>{b.label}</button>)}
        {tip && <p className="why tip">{tip}</p>}
      </div>
    );
  }
}

const isPrompt = (p: Pending) => !['main', 'climax', 'attackDeclare', 'clock'].includes(p.kind);

function pendingHint(p: Pending): string {
  switch (p.kind) {
    case 'mulligan': return '換牌：選要丟掉的手牌（可以不選），丟幾張就抽幾張。';
    case 'clock': return '可以把 1 張手牌拖到傷害區（之後抽 2 張），或按「略過時計」。';
    case 'main': return '把手牌拖到格子出牌、拖動角色換位置、點選角色使用起動能力；做完按「結束主要階段」。';
    case 'climax': return '可以把名場面拖到名場面區，或按「不打名場面」。';
    case 'attackDeclare': return '點選發光的前列角色選擇攻擊方式，或按「結束攻擊」。';
    case 'counter': return '對手正打你的角色：可以使用助太刀。';
    case 'levelUp': return '傷害區滿 7 張：選 1 張放到等級區（升級）。';
    case 'encoreChoose': return '選 1 張倒置的角色放進休息室（之後可以安可）。';
    case 'handLimit': return `手牌超過 7 張：選 ${p.count} 張丟掉。`;
    case 'pick': return '判定效果：選擇要拿回的卡。';
    case 'yesno': return '判定效果：要不要執行？';
    case 'select': return p.prompt;
    case 'confirm': return p.prompt.split('\n')[0]!;
    case 'chooseSlot': return p.prompt;
    case 'orderAbility': return '有多個效果同時發動：選擇先解決哪一個。';
  }
}

// 底部彈出視窗：回應引擎的待決選擇
function PromptSheet({ pending: p, game, legal, act }: { pending: Pending; game: GameState; legal: Action[]; act: (a: Action) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const player = p.player;
  const cardOf = (uid: string) => cardById.get(game.cards[uid]!.cardId)!;
  const toggle = (uid: string, max: number) =>
    setPicked((cur) => (cur.includes(uid) ? cur.filter((u) => u !== uid) : max === 1 ? [uid] : cur.length < max ? [...cur, uid] : cur));

  const cards = (options: string[], max: number) => (
    <div className="opts">
      {options.map((uid) => <CardFace key={uid} card={cardOf(uid)} selected={picked.includes(uid)} onClick={() => toggle(uid, max)} />)}
    </div>
  );
  const choose = (uids: string[], dest?: 'hand' | 'stock') => act({ type: 'choose', player, uids, ...(dest ? { dest } : {}) });
  let body: React.ReactNode = null;
  let buttons: React.ReactNode = null;

  switch (p.kind) {
    case 'mulligan':
      body = cards(game.players[player].hand, 99);
      buttons = <button className="btn primary" onClick={() => act({ type: 'mulligan', player, discard: picked })}>{picked.length ? `丟掉 ${picked.length} 張並重抽` : '不換牌'}</button>;
      break;
    case 'handLimit':
      body = cards(game.players[player].hand, p.count);
      buttons = <button className="btn primary" disabled={picked.length !== p.count} onClick={() => choose(picked)}>丟掉這 {p.count} 張</button>;
      break;
    case 'select':
      body = cards(p.options, p.max);
      buttons = (
        <button className="btn primary" disabled={picked.length < p.min || picked.length > p.max} onClick={() => choose(picked)}>
          {picked.length ? `確定（${picked.length} 張）` : p.min === 0 ? '都不選' : `請選 ${p.min} 張`}
        </button>
      );
      break;
    case 'levelUp':
    case 'encoreChoose':
    case 'counter':
      body = cards(p.options, 1);
      buttons = (
        <>
          <button className="btn primary" disabled={picked.length !== 1} onClick={() => choose(picked)}>
            {p.kind === 'levelUp' ? '放到等級區' : p.kind === 'encoreChoose' ? '放進休息室' : '使用助太刀'}
          </button>
          {p.kind === 'counter' && <button className="btn" onClick={() => act({ type: 'pass', player })}>不使用</button>}
        </>
      );
      break;
    case 'pick':
      body = cards(p.options, 1);
      buttons = (
        <>
          {p.dests.map((d) => (
            <button key={d} className="btn primary" disabled={picked.length !== 1} onClick={() => choose(picked, d)}>{d === 'hand' ? '加到手牌' : '放進能量區'}</button>
          ))}
          <button className="btn" onClick={() => choose([])}>不拿</button>
        </>
      );
      break;
    case 'yesno':
    case 'confirm': {
      const text = p.kind === 'confirm' ? p.prompt : { treasureStock: '寶：要把牌組最上面 1 張放進能量區嗎？', pool: '要把牌組最上面 1 張放進能量區嗎？', draw: '要抽 1 張牌嗎？' }[p.reason];
      body = <p className="prompt-text">{text}</p>;
      buttons = (
        <>
          <button className="btn primary" onClick={() => act({ type: 'yesno', player, yes: true })}>是</button>
          <button className="btn" onClick={() => act({ type: 'yesno', player, yes: false })}>否</button>
        </>
      );
      break;
    }
    case 'chooseSlot':
      buttons = p.slots.map((slot) => <button key={slot} className="btn primary" onClick={() => act({ type: 'chooseSlot', player, slot })}>{SLOT_NAME[slot]}</button>);
      break;
    case 'orderAbility':
      body = (
        <div className="order-list">
          {p.options.map((o) => (
            <button key={o.id} className="order-item" onClick={() => act({ type: 'choose', player, uids: [String(o.id)] })}>
              <b>{cardOf(o.uid).name.zh}</b>
              <span>{o.text}</span>
            </button>
          ))}
        </div>
      );
      break;
  }
  void legal;
  return (
    <div className="sheet prompt" role="dialog" aria-label="需要你的選擇">
      <h3>{pendingHint(p)}<small>{PLAYERS[player].label}</small></h3>
      {body}
      {buttons && <div className="actions">{buttons}</div>}
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
function ZoneDialog({ view, cardOf, onClose }: { view: NonNullable<ZoneView>; cardOf: (uid: string) => Card | null; onClose: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [detail, setDetail] = useState<Card | null>(null);
  const cards = view.ids.map(cardOf).filter((c): c is Card => !!c);
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
              <div className="actions"><button className="btn" onClick={() => setDetail(null)}>返回</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

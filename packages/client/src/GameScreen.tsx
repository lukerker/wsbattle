import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Action, AttackMode, Card, ClientState, GameEvent, GameView, Pending, PlayerId, RoomInfo, Slot } from '@ws/engine';
import { applyStep, groupEvents, originsOf, playAttack, useFlip } from './anim.ts';
import { Board, type ZoneMode } from './Board.tsx';
import { Abilities, BACK_URL, CardFace, CardImg, CardInfo, cardMeta } from './CardFace.tsx';
import { PHASES, SLOT_NAME, cardById, seriesInfo } from './meta.ts';
import { net, useNet } from './net.ts';

// 連線對戰畫面：永遠用自己的座位視角；觀戰者看座位 0 的視角，只看得到公開資訊。
// 伺服器每次回傳新狀態與事件列表，這裡照事件一步一步播動畫，播完才讓玩家繼續操作。

type Source = { from: 'hand'; uid: string } | { from: 'stage'; slot: number; uid: string };
type ZoneView = { title: string; ids: string[]; mode: ZoneMode } | null;
type Drag = { src: Source; x: number; y: number; over: string | null } | null;
type Anim = { display: GameView; banner: PlayerId | null };

const DRAG_THRESHOLD = 8;
const dropTargetAt = (x: number, y: number) =>
  (document.elementFromPoint(x, y)?.closest('[data-drop]') as HTMLElement | null)?.dataset.drop ?? null;
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export default function GameScreen({ room }: { room: RoomInfo }) {
  const { error } = useNet();
  const [cs, setCs] = useState<ClientState | null>(null); // 最新的完整狀態
  const [anim, setAnim] = useState<Anim | null>(null);
  const [busy, setBusy] = useState(false); // 已送出動作、等伺服器回應
  const [viewed, setViewed] = useState<Card | null>(null);
  const [selected, setSelected] = useState<Source | null>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 1000 && window.innerHeight > 520);
  const [zoneView, setZoneView] = useState<ZoneView>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const origins = useRef(new Map<string, { key: string; flip: boolean }>());
  const csRef = useRef<ClientState | null>(null);
  const queue = useRef<{ state: ClientState; events: GameEvent[] }[]>([]);
  const running = useRef(false);

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  // 伺服器傳來的狀態：排隊，一個一個播完動畫
  useEffect(() => {
    const drain = async () => {
      if (running.current) return;
      running.current = true;
      while (queue.current.length) {
        const { state, events } = queue.current.shift()!;
        const prev = csRef.current;
        csRef.current = state;
        setCs(state);
        setBusy(false);
        const notes = events.filter((e) => e.t === 'notice').map((e) => (e as { text: string }).text);
        if (notes.length) say(notes.join('　'));
        if (prev && events.length) {
          const known = (uid: string) => state.view.cards[uid]?.cardId ?? null;
          let display = prev.view;
          for (const step of groupEvents(events)) {
            display = applyStep(display, step.events, known);
            for (const [uid, o] of originsOf(step.events)) origins.current.set(uid, o);
            setAnim({ display, banner: step.turnStart ?? null });
            const atk = step.attack;
            if (atk) window.requestAnimationFrame(() => rootRef.current && playAttack(rootRef.current, atk.uid, display.turnPlayer, atk.slot, atk.mode));
            if (step.ms) await sleep(step.ms);
          }
          setAnim(null);
        }
      }
      running.current = false;
    };
    return net.onState((state, events) => {
      queue.current.push({ state, events });
      void drain();
    });
  }, []);

  // 伺服器回報的錯誤（例如動作不合法）
  useEffect(() => {
    if (!error) return;
    say(error);
    setBusy(false);
    net.clearError();
  }, [error]);

  if (!cs) return <div className="app"><div className="center-note">正在載入牌局…</div></div>;

  const spectating = cs.viewer === 'spectator';
  const seat: PlayerId = spectating ? 0 : (cs.viewer as PlayerId);
  const opp = (1 - seat) as PlayerId;
  const view = anim?.display ?? cs.view;
  const me = view.players[seat];
  const mine = cs.mine;
  const legal = anim ? [] : cs.legal;
  const nm = (p: PlayerId) => room.seats[p]?.name ?? `玩家 ${p + 1}`;
  const accentOf = (p: PlayerId) => seriesInfo(room.seats[p]?.series ?? '').accent;
  const seriesName = (p: PlayerId) => seriesInfo(room.seats[p]?.series ?? '').label;
  const cardOfUid = (uid: string): Card | null => {
    const id = view.cards[uid]?.cardId;
    return id ? (cardById.get(id) ?? null) : null;
  };

  // 送出動作：伺服器算完會傳回新狀態與事件
  const act = (a: Action) => {
    if (anim || busy || spectating) return;
    setBusy(true);
    setSelected(null);
    setViewed(null);
    net.action(a);
  };

  const shownCard = viewed ?? (selected ? cardOfUid(selected.uid) : null);
  const has = (pred: (a: Action) => boolean) => legal.some(pred);

  // 拖曳中可以放的地方（由伺服器給的合法動作決定）
  const dropTargets = (() => {
    const out = new Set<string>();
    if (!drag || !mine) return out;
    const { src } = drag;
    if (src.from === 'hand') {
      if (mine.kind === 'main' && has((a) => a.type === 'playCharacter' && a.uid === src.uid)) for (let i = 0; i < 5; i++) out.add(`slot-${i}`);
      if (mine.kind === 'climax' && has((a) => a.type === 'playClimax' && a.uid === src.uid)) out.add('climax');
      if (mine.kind === 'clock') out.add('clock');
    } else if (mine.kind === 'main') {
      for (let i = 0; i < 5; i++) if (i !== src.slot) out.add(`slot-${i}`);
    }
    return out;
  })();

  const dropOn = (src: Source, target: string) => {
    if (!mine) return;
    if (target === 'clock' && mine.kind === 'clock' && src.from === 'hand') return act({ type: 'clock', player: seat, uid: src.uid });
    if (target === 'climax' && src.from === 'hand') return act({ type: 'playClimax', player: seat, uid: src.uid });
    if (target.startsWith('slot-') && mine.kind === 'main') {
      const slot = Number(target.slice(5)) as Slot;
      if (src.from === 'hand') return act({ type: 'playCharacter', player: seat, uid: src.uid, slot });
      if (slot !== src.slot) return act({ type: 'moveStage', player: seat, from: src.slot as Slot, to: slot });
    }
    say('這裡不能放');
  };

  // 按下卡片：移動超過門檻就是拖曳，否則放開時當作點選（滑鼠與觸控共用）
  const beginPointer = (e: ReactPointerEvent, src: Source) => {
    if (e.button !== 0 || anim || spectating) return;
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
    const c = cardOfUid(uid);
    if (!c) return;
    setSelected(null);
    setViewed(c);
    setPanelOpen(true);
  };

  // 可以點選的卡發光
  const glow = new Set<string>();
  for (const a of legal) {
    if (a.type === 'attack') glow.add(me.stage[a.slot]!.uid);
    if (a.type === 'activate') glow.add(a.uid);
    if (a.type === 'playCharacter' || a.type === 'playEvent' || a.type === 'playClimax') glow.add(a.uid);
  }

  // 每個可以攻擊的格子有哪些攻擊方式（攻擊角色兩側的按鈕用）
  const attackModes: Record<number, AttackMode[]> = {};
  for (const a of legal) if (a.type === 'attack') (attackModes[a.slot] ??= []).push(a.mode);

  const passLabel: Partial<Record<Pending['kind'], string>> = { clock: '略過時計', main: '結束主要階段', climax: '不打名場面', attackDeclare: '結束攻擊' };
  const turnPlayer = view.turnPlayer;
  const curPhase = PHASES.find((p) => p.id === view.phase);
  const dragCard = drag ? cardOfUid(drag.src.uid) : null;
  const myTurn = turnPlayer === seat;
  const passAction = (): Action | null => (!mine || !passLabel[mine.kind] ? null : mine.kind === 'clock' ? { type: 'clock', player: seat, uid: null } : { type: 'pass', player: seat });

  // 回合中卻在等另一位玩家回應（升級、助太刀、確認公開的卡…）：用黃色標出來，回合中的玩家才知道不是卡住了
  const waiting = anim ? null : cs.waiting;
  const responders = waiting && view.turn > 0 && waiting.kind !== 'mulligan' ? waiting.players.filter((p) => p !== turnPlayer) : [];
  const responder = responders[0] ?? null;
  const iRespond = responders.includes(seat);

  const plate = (p: PlayerId, side: 'me' | 'opp') => {
    const active = view.turn > 0 && turnPlayer === p;
    const offline = room.seats[p]?.online === false;
    const status =
      offline ? '⚠ 斷線中，等待重新連線' :
      responder === p ? '⚠ 回應中：需要做選擇' :
      responder !== null && active ? `▶ 回合中・等待 ${nm(responder)} 回應…` :
      active ? `▶ 回合中・${curPhase?.name ?? ''}階段` : view.turn === 0 ? '換牌中' : '等待中';
    return (
      <div className={`plate ${side}${active ? ' active' : ''}${responder === p ? ' responding' : ''}${responder !== null && active ? ' waiting' : ''}${offline ? ' offline' : ''}`} style={{ ['--pc' as string]: accentOf(p) }}>
        <div className="avatar">{nm(p).slice(0, 1)}</div>
        <div className="pinfo">
          <b>{nm(p)}{!spectating && p === seat ? '（你）' : ''}</b>
          <span>{seriesName(p)}</span>
          <em>{status}</em>
          <small>手牌 {view.players[p].hand.length}・等級 {view.players[p].level.length}・傷害 {view.players[p].clock.length}/7</small>
        </div>
      </div>
    );
  };

  const hint = anim ? '…'
    : mine ? pendingHint(mine)
    : waiting ? `等待 ${waiting.players.map(nm).join('、')} ${waiting.kind === 'mulligan' ? '換牌' : '回應'}…`
    : spectating ? '觀戰中：你只看得到公開的資訊' : (curPhase?.hint ?? '');

  const wonText = view.winner === null ? '' : view.winner === 'draw' ? '平手' : spectating ? `${nm(view.winner)} 獲勝` : view.winner === seat ? '你獲勝了！' : '你輸了';
  const leave = () => net.send({ t: 'leave' });
  const onLeaveClick = () => (!spectating && room.status === 'playing' ? setConfirmLeave(true) : leave());

  return (
    <div
      ref={rootRef}
      className={`app${drag ? ' dragging' : ''}${anim ? ' animating' : ''}${panelOpen ? ' panel-open' : ''}`}
      style={{ ['--accent' as string]: accentOf(seat) }}
    >
      <header className="topbar">
        <div className="brand">
          <span className="logo">WS</span>
          <span className="vs">
            <b>{nm(seat)}</b>（{seriesName(seat)}）<i>vs</i>{nm(opp)}（{seriesName(opp)}）
          </span>
        </div>
        <ol className="phases" aria-label="階段列">
          {PHASES.map((p, i) => {
            const cur = PHASES.findIndex((x) => x.id === view.phase);
            return <li key={p.id} className={i === cur ? 'on' : i < cur ? 'done' : ''}>{p.name}</li>;
          })}
        </ol>
        <div className="opp-hand" title="對手手牌張數">
          <span>對手手牌</span>
          <div className="fan" data-zone={`hand-${opp}`}>
            {view.players[opp].hand.map((u, i) => <img key={u} data-uid={u} src={BACK_URL} alt="" style={{ ['--i' as string]: i }} />)}
          </div>
          <b>{view.players[opp].hand.length}</b>
        </div>
        <span className="room-chip" title="房間代碼">房間 {room.code}{room.spectators.length ? `・觀戰 ${room.spectators.length}` : ''}</span>
        {!anim && passAction() && (
          <button className="btn primary top-pass" onClick={() => act(passAction()!)}>{passLabel[mine!.kind]}</button>
        )}
        <button className="btn ghost leave-btn" onClick={onLeaveClick}>{spectating ? '離開觀戰' : '離開'}</button>
      </header>
      <div className={`hint${iRespond ? ' responding' : ''}`}>
        <b>第 {Math.max(1, view.turn)} 回合・{view.turn === 0 ? '換牌' : `${nm(turnPlayer)}的${curPhase?.name ?? ''}階段`}</b>
        {iRespond && <em className="resp">{nm(seat)} 回應中</em>}
        <span>{hint}</span>
      </div>
      <div className="rotate-tip">手機請橫向使用，畫面會完整顯示整個場地。</div>

      <div className="main">
        <aside className={`panel${panelOpen ? '' : ' closed'}`}>
          <button className="tab" onClick={() => setPanelOpen(!panelOpen)} aria-label={panelOpen ? '收合卡面預覽' : '展開卡面預覽'}>
            {panelOpen ? '◀' : '卡面預覽 ▶'}
          </button>
          {panelOpen && (shownCard ? (
            <Preview card={shownCard}>{selected && !viewed && !anim && <CardActions src={selected} />}</Preview>
          ) : (
            <div className="empty-preview">
              <div className="ph-card" />
              <p>點一下卡片，這裡會顯示大圖與效果說明。{spectating ? '' : <><br />手牌可以直接拖到場上出牌。</>}</p>
            </div>
          ))}
        </aside>

        <section className="table">
          <div className="mat-wrap">
            <Board
              view={view}
              viewer={seat}
              active={turnPlayer}
              power={(uid) => cs.power[uid] ?? cardOfUid(uid)?.power ?? 0}
              soul={(uid) => cs.soul[uid] ?? cardOfUid(uid)?.soul ?? 0}
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
              attackModes={attackModes}
              onAttack={(slot, mode) => act({ type: 'attack', player: seat, slot: slot as Slot, mode })}
            />
            {view.turn > 0 && (
              <div className={`turn-pill ${myTurn ? 'me' : 'opp'}${responder !== null ? ' waiting' : ''}`} style={{ ['--pc' as string]: accentOf(turnPlayer) }}>
                {responder !== null ? `⏳ 等待 ${nm(responder)} 回應` : `${myTurn ? '▼' : '▲'} ${nm(turnPlayer)}的回合`}
              </div>
            )}
            {/* 場地右側：上面對手的名牌；下面自己的名牌，名牌上方是階段按鈕（兩者保持固定間距，名牌長高也不會蓋到按鈕） */}
            <div className="side-col opp">{plate(opp, 'opp')}</div>
            <div className="side-col me">
              {!anim && passAction() && (
                <button className="btn primary side-pass" onClick={() => act(passAction()!)}>{passLabel[mine!.kind]}</button>
              )}
              {plate(seat, 'me')}
            </div>
            {anim?.banner != null && (
              <div className="turn-banner" key={`${view.turn}-${anim.banner}`} style={{ ['--pc' as string]: accentOf(anim.banner) }}>
                <small>第 {view.turn} 回合</small>
                <b>{nm(anim.banner)} 的回合</b>
              </div>
            )}
          </div>
          <div className="hand" aria-label="手牌" data-zone={`hand-${seat}`}>
            {me.hand.map((uid) => {
              const c = cardOfUid(uid);
              return c ? (
                <CardFace
                  key={uid}
                  uid={uid}
                  card={c}
                  selected={selected?.uid === uid}
                  glow={glow.has(uid)}
                  dim={drag?.src.uid === uid}
                  onPointerDown={(e) => beginPointer(e, { from: 'hand', uid })}
                />
              ) : (
                <div key={uid} className="cardface"><CardImg uid={uid} /></div> // 觀戰者看不到手牌，只顯示牌背
              );
            })}
          </div>
        </section>
      </div>

      {zoneView && <ZoneDialog view={zoneView} cardOf={cardOfUid} onClose={() => setZoneView(null)} />}

      {!anim && mine && isPrompt(mine) && (
        <PromptSheet key={JSON.stringify(mine)} pending={mine} view={cs.view} seat={seat} act={act} name={nm(seat)} cardOf={(uid) => {
          const id = cs.view.cards[uid]?.cardId;
          return id ? cardById.get(id)! : null;
        }} />
      )}

      {confirmLeave && (
        <div className="handoff">
          <div className="handoff-box">
            <p className="who">要離開這場對戰嗎？</p>
            <p className="muted">對戰中離開會視為投降，對手獲勝。</p>
            <div className="actions" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => { setConfirmLeave(false); leave(); }}>投降並離開</button>
              <button className="btn" onClick={() => setConfirmLeave(false)}>繼續比賽</button>
            </div>
          </div>
        </div>
      )}

      {!anim && view.winner !== null && (
        <div className="handoff">
          <div className="handoff-box" style={{ ['--accent' as string]: accentOf(view.winner === 'draw' ? seat : view.winner) }}>
            <p className="who">{wonText}</p>
            <button className="btn primary" onClick={leave}>回到大廳</button>
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
    if (!card) return null;
    const buttons: { label: string; a: Action }[] = [];
    let tip: string | null = null;
    for (const a of legal) {
      if (a.type === 'playEvent' && a.uid === src.uid) buttons.push({ label: '使用事件', a });
      if (a.type === 'playClimax' && a.uid === src.uid) buttons.push({ label: '打出名場面', a });
      if (a.type === 'clock' && a.uid === src.uid) buttons.push({ label: '放到傷害區，抽 2 張', a });
      if (a.type === 'activate' && a.uid === src.uid) {
        const text = (cs!.abilityText[`${a.uid}:${a.index}`] ?? '').replace(/^【起】/, '');
        buttons.push({ label: `發動：${text.length > 18 ? `${text.slice(0, 18)}…` : text}`, a });
      }
      if (a.type === 'attack' && src.from === 'stage' && a.slot === src.slot) buttons.push({ label: { front: '正打', side: '側打', direct: '直接攻擊' }[a.mode], a });
    }
    if (src.from === 'hand' && card.type === 'character' && has((a) => a.type === 'playCharacter' && a.uid === src.uid)) tip = '把這張卡拖到場上的格子就能出牌';
    if (src.from === 'hand' && mine?.kind === 'main' && !has((a) => (a.type === 'playCharacter' || a.type === 'playEvent') && a.uid === src.uid)) {
      tip = cs!.problems[src.uid] ?? null;
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
    case 'attackDeclare': return '點選發光的前列角色，選擇正打、側打或直接攻擊；不攻擊就按「結束攻擊」。';
    case 'counter': return '對手正打你的角色：可以使用助太刀。';
    case 'levelUp': return '傷害區滿 7 張：選 1 張放到等級區（升級）。';
    case 'encoreChoose': return '選 1 張倒置的角色放進休息室（之後可以安可）。';
    case 'handLimit': return `手牌超過 7 張：選 ${p.count} 張丟掉。`;
    case 'pick': return '判定效果：選擇要拿回的卡。';
    case 'yesno': return '判定效果：要不要執行？';
    case 'select': return p.prompt;
    case 'confirm': return p.prompt.split('\n')[0]!;
    case 'chooseSlot': return p.prompt;
    case 'orderAbility': return p.canSkip ? '有多個效果可以發動：選擇先處理哪一個（選了之後還能決定要不要發動），或都不發動。' : '有多個效果同時發動：選擇先解決哪一個。';
    case 'acknowledge': return p.prompt;
  }
}

// 底部彈出視窗：回應引擎的待決選擇。可以收起來看場地，看完再展開
function PromptSheet({ pending: p, view, seat, act, name, cardOf: cardLookup }: { pending: Pending; view: GameView; seat: PlayerId; act: (a: Action) => void; name: string; cardOf: (uid: string) => Card | null }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [focus, setFocus] = useState<Card | null>(null); // 最後點的卡：在視窗右側顯示說明
  const [collapsed, setCollapsed] = useState(false);
  const player = seat;
  const cardOf = (uid: string) => cardLookup(uid)!;
  const toggle = (uid: string, max: number) =>
    setPicked((cur) => (cur.includes(uid) ? cur.filter((u) => u !== uid) : max === 1 ? [uid] : cur.length < max ? [...cur, uid] : cur));

  // shown：一起顯示但不能選的卡（看牌時翻開的其他牌）
  const cards = (options: string[], max: number, shown?: string[]) => (
    <div className="opts">
      {(shown ?? options).map((uid) => {
        const can = options.includes(uid) && max > 0;
        return (
          <CardFace
            key={uid}
            card={cardOf(uid)}
            selected={picked.includes(uid)}
            dim={!can && !!shown}
            onClick={() => { if (can) toggle(uid, max); setFocus(cardOf(uid)); }}
          />
        );
      })}
    </div>
  );
  const choose = (uids: string[], dest?: 'hand' | 'stock') => act({ type: 'choose', player, uids, ...(dest ? { dest } : {}) });
  let body: React.ReactNode = null;
  let buttons: React.ReactNode = null;

  switch (p.kind) {
    case 'mulligan':
      body = cards(view.players[player].hand, 99);
      buttons = <button className="btn primary" onClick={() => act({ type: 'mulligan', player, discard: picked })}>{picked.length ? `丟掉 ${picked.length} 張並重抽` : '不換牌'}</button>;
      break;
    case 'handLimit':
      body = cards(view.players[player].hand, p.count);
      buttons = <button className="btn primary" disabled={picked.length !== p.count} onClick={() => choose(picked)}>丟掉這 {p.count} 張</button>;
      break;
    case 'select': {
      body = cards(p.options, p.max, p.shown);
      const label = p.shown
        ? picked.length ? `把這 ${picked.length} 張加到手牌，其餘放到休息室` : p.options.length ? '都不拿，全部放到休息室' : '放到休息室'
        : picked.length ? `確定（${picked.length} 張）` : p.min === 0 ? '都不選' : `請選 ${p.min} 張`;
      buttons = <button className="btn primary" disabled={picked.length < p.min || picked.length > p.max} onClick={() => choose(picked)}>{label}</button>;
      break;
    }
    case 'acknowledge':
      body = cards([], 0, p.cards);
      buttons = <button className="btn primary" onClick={() => act({ type: 'yesno', player, yes: true })}>確認</button>;
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
      if (p.canSkip) buttons = <button className="btn" onClick={() => act({ type: 'choose', player, uids: [] })}>都不發動</button>;
      break;
  }
  return (
    <div className={`sheet prompt${collapsed ? ' collapsed' : ''}`} role="dialog" aria-label="需要你的選擇">
      <div className="sheet-head">
        <h3>{pendingHint(p)}<small>{name}</small></h3>
        <button className="btn ghost fold" onClick={() => setCollapsed(!collapsed)}>{collapsed ? '▲ 展開' : '▼ 收起看場地'}</button>
      </div>
      {!collapsed && (
        <div className="prompt-row">
          <div className="prompt-main">
            {body}
            {buttons && <div className="actions">{buttons}</div>}
          </div>
          {focus && (
            <div className="prompt-info">
              <b>{focus.name.zh}</b>
              <p className="meta">{cardMeta(focus)}</p>
              <Abilities card={focus} />
            </div>
          )}
        </div>
      )}
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

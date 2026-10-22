import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Action, AttackMode, Card, ClientState, GameEvent, GameStats, GameView, Pending, PlayerId, RoomInfo, Slot } from '@ws/engine';
import { SHOWCASE_MS, applyStep, groupEvents, originsOf, playAttack, playShuffle, useFlip, type Origin } from './anim.ts';
import { Board, type ZoneMode } from './Board.tsx';
import { Abilities, BACK_URL, CardFace, CardImg, CardInfo, PowerTag, cardImg, cardMeta } from './CardFace.tsx';
import { PHASES, SLOT_NAME, cardById, seriesInfo } from './meta.ts';
import { buildLog, type LogEntry } from './log.ts';
import { DEFAULT_TURN_CARDS, loadTurnCards, type TurnCards } from './turnCards.ts';
import { net, useNet } from './net.ts';
import { play } from './sound.ts';
import { SoundControl } from './SoundControl.tsx';

// 連線對戰畫面：永遠用自己的座位視角；觀戰者看座位 0 的視角，只看得到公開資訊。
// 伺服器每次回傳新狀態與事件列表，這裡照事件一步一步播動畫，播完才讓玩家繼續操作。

type Source = { from: 'hand'; uid: string } | { from: 'stage'; slot: number; uid: string };
type ZoneView = { title: string; ids: string[]; mode: ZoneMode } | null;
type Drag = { src: Source; x: number; y: number; over: string | null } | null;
type FirstDecided = { first: PlayerId; firstCard: 0 | 1; picks: [0 | 1, 0 | 1] };
type Showcase = { uid: string; cardId: string; p: PlayerId };
type Anim = { display: GameView; banner: PlayerId | null; firstDecided: FirstDecided | null; showcase: Showcase | null };

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
  const [log, setLog] = useState<LogEntry[]>([]);
  const [logOpen, setLogOpen] = useState(false); // 窄螢幕：對戰紀錄用彈窗看
  const rootRef = useRef<HTMLDivElement>(null);
  const origins = useRef(new Map<string, Origin>());
  const csRef = useRef<ClientState | null>(null);
  const queue = useRef<{ state: ClientState; events: GameEvent[]; at: number }[]>([]);
  const running = useRef(false);
  // 限時選擇（反擊、給對手確認）的截止時間：用收到訊息的時間＋剩餘毫秒，不受雙方電腦時間差影響
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [deadline]);
  const secondsLeft = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  // 這個回合剛加到手牌的卡：選手牌時標「剛拿到」，同名卡才分得出來
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());

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
        const { state, events, at } = queue.current.shift()!;
        const prev = csRef.current;
        csRef.current = state;
        setCs(state);
        setBusy(false);
        setDeadline(state.timerMs === null || state.timerMs === undefined ? null : at + state.timerMs);
        setNow(Date.now());
        if (state.viewer !== 'spectator') {
          const seatNow = state.viewer;
          setFresh((cur) => {
            let next = cur;
            for (const e of events) {
              if (e.t === 'phase' && e.phase === 'stand') next = new Set();
              if (e.t === 'move' && e.to.zone === 'hand' && e.to.p === seatNow) next = new Set([...next, e.uid]);
            }
            const hand = new Set(state.view.players[seatNow].hand);
            return new Set([...next].filter((u) => hand.has(u)));
          });
        }
        const notes = events.filter((e) => e.t === 'notice').map((e) => (e as { text: string }).text);
        if (notes.length) say(notes.join('　'));
        if (prev && events.length) {
          const known = (uid: string) => state.view.cards[uid]?.cardId ?? null;
          let display = prev.view;
          for (const step of groupEvents(events)) {
            display = applyStep(display, step.events, known);
            const entries = buildLog(step.events, state.view);
            if (entries.length) setLog((l) => [...l, ...entries].slice(-80));
            for (const [uid, o] of originsOf(step.events, known)) origins.current.set(uid, o);
            setAnim({ display, banner: step.turnStart ?? null, firstDecided: step.firstDecided ?? null, showcase: step.showcase ?? null });
            const atk = step.attack;
            if (atk) window.requestAnimationFrame(() => rootRef.current && playAttack(rootRef.current, atk.uid, display.turnPlayer, atk.slot, atk.mode));
            const sh = step.shuffle;
            if (sh) window.requestAnimationFrame(() => rootRef.current && playShuffle(rootRef.current, sh.p, sh.refresh));
            if (step.sound) play(step.sound);
            if (step.turnStart !== undefined && step.turnStart === state.viewer) play('turn'); // 輪到自己：叮～
            if (step.ms) await sleep(step.ms);
          }
          setAnim(null);
        }
      }
      running.current = false;
    };
    return net.onState((state, events) => {
      queue.current.push({ state, events, at: Date.now() });
      void drain();
    });
  }, []);

  // 先後攻翻牌用開房玩家上傳的卡面（沒有就用系統預設）
  const [turnCards, setTurnCards] = useState<TurnCards>(DEFAULT_TURN_CARDS);
  const hostUid = room.seats.find((s) => s?.host)?.uid ?? room.seats[0]?.uid;
  useEffect(() => {
    void loadTurnCards(hostUid).then(setTurnCards);
  }, [hostUid]);

  // 剛開局（還在換牌）第一次進這個畫面：播 VS 動畫（每間房間只播一次，重新整理不再播）
  const [vs, setVs] = useState(false);
  const vsChecked = useRef(false);
  useLayoutEffect(() => { // 畫面畫出來之前就決定，避免先閃一下場地
    if (!cs || vsChecked.current) return;
    vsChecked.current = true;
    const key = `ws-vs-${room.code}`;
    if (cs.view.turn !== 0 || sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    setVs(true);
    const t = window.setTimeout(() => setVs(false), 3900);
    return () => window.clearTimeout(t);
  }, [cs, room.code]);

  // 伺服器回報的錯誤（例如動作不合法）
  useEffect(() => {
    if (!error) return;
    say(error);
    setBusy(false);
    net.clearError();
  }, [error]);

  // 盤面每次改變：卡片從舊位置滑到新位置（從牌組翻開的卡會翻面）
  const shownView = anim?.display ?? cs?.view ?? null;
  useFlip(rootRef, shownView, origins, `${panelOpen}`);

  // 階段列：目前的階段一直保持在中間（小螢幕放不下全部階段時才看得到）
  const phasesRef = useRef<HTMLOListElement>(null);
  useLayoutEffect(() => {
    const ol = phasesRef.current;
    const li = ol?.querySelector<HTMLElement>('li.on');
    if (!ol || !li) return;
    ol.scrollTo({ left: li.offsetLeft - (ol.clientWidth - li.offsetWidth) / 2, behavior: 'smooth' });
  }, [shownView?.phase]);

  // 需要自己回應（反擊、確認、對手回合中要做選擇）：叮叮～
  const promptKey = !anim && cs?.mine && isPrompt(cs.mine) ? JSON.stringify(cs.mine) : null;
  useEffect(() => {
    if (!promptKey || !cs?.mine || cs.viewer === 'spectator') return;
    const k = cs.mine.kind;
    if (['counter', 'acknowledge', 'confirm', 'yesno', 'levelUp'].includes(k) || cs.view.turnPlayer !== cs.viewer) play('alert');
  }, [promptKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <img className="logo" src="/logo.png" alt="Weiß Schwarz" />
          <span className="vs">
            <b>{nm(seat)}</b>（{seriesName(seat)}）<i>vs</i>{nm(opp)}（{seriesName(opp)}）
          </span>
        </div>
        <ol className="phases" aria-label="階段列" ref={phasesRef}>
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
        <SoundControl />
        <button className="btn ghost log-btn" onClick={() => setLogOpen(true)}>紀錄</button>
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
                {responder !== null ? `⏳ 等待 ${nm(responder)} 回應${secondsLeft !== null ? `（${secondsLeft} 秒）` : ''}` : `${myTurn ? '▼' : '▲'} ${nm(turnPlayer)}的回合`}
              </div>
            )}
            {/* 場地右側：上面對手的名牌；下面自己的名牌，名牌上方是階段按鈕（兩者保持固定間距，名牌長高也不會蓋到按鈕） */}
            <div className="side-col">
              {plate(opp, 'opp')}
              <GameLog entries={log} />
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

      {logOpen && (
        <div className="modal" onClick={() => setLogOpen(false)}>
          <div className="dialog log-dialog" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>對戰紀錄</h3>
              <button className="btn" onClick={() => setLogOpen(false)}>關閉</button>
            </header>
            <GameLog entries={log} />
          </div>
        </div>
      )}

      {(anim?.firstDecided || (!anim && cs.waiting?.kind === 'decideFirst')) && (
        <FirstPick
          picks={anim?.firstDecided?.picks ?? view.firstPick?.picks ?? [null, null]}
          result={anim?.firstDecided ?? null}
          seat={seat}
          spectating={spectating}
          canPick={!spectating && mine?.kind === 'decideFirst'}
          name={nm}
          accent={accentOf}
          images={turnCards}
          onPick={(card) => act({ type: 'pickFirst', player: seat, card })}
        />
      )}

      {vs && (
        <VsIntro
          left={{ name: nm(seat), series: room.seats[seat]?.series ?? '', label: seriesName(seat), accent: accentOf(seat) }}
          right={{ name: nm(opp), series: room.seats[opp]?.series ?? '', label: seriesName(opp), accent: accentOf(opp) }}
        />
      )}

      {zoneView && <ZoneDialog view={zoneView} cardOf={cardOfUid} onClose={() => setZoneView(null)} />}

      {!anim && mine && isPrompt(mine) && (
        <PromptSheet key={JSON.stringify(mine)} pending={mine} view={cs.view} seat={seat} act={act} name={nm(seat)} secondsLeft={secondsLeft} fresh={fresh} power={cs.power} soul={cs.soul} cardOf={(uid) => {
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

      {anim?.showcase && (
        <ShowcaseCard key={anim.showcase.uid} show={anim.showcase} root={rootRef} card={cardById.get(anim.showcase.cardId) ?? null} accent={accentOf(anim.showcase.p)} />
      )}

      {!anim && view.winner !== null && (
        <GameOver
          winner={view.winner}
          seat={seat}
          spectating={spectating}
          view={view}
          stats={cs.stats}
          log={log}
          name={nm}
          accent={accentOf}
          title={wonText}
          onLeave={leave}
        />
      )}

      {drag && dragCard && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <CardImg card={dragCard} />
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );

  // 對戰紀錄：雙方做了什麼、發動了什麼效果（新的在最下面，自動捲到底）
  function GameLog({ entries }: { entries: LogEntry[] }) {
    const ref = useRef<HTMLOListElement>(null);
    useEffect(() => {
      if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [entries.length]);
    return (
      <div className="game-log">
        <b className="log-title">對戰紀錄</b>
        <ol ref={ref}>
          {entries.length === 0 && <li className="muted">雙方的動作和發動的效果會顯示在這裡。</li>}
          {entries.map((e) => (
            <li key={e.id} className={e.turn ? 'turn' : ''} style={e.p !== null ? { ['--pc' as string]: accentOf(e.p) } : undefined}>
              {e.p !== null && !e.turn && <span className="who">{e.p === seat && !spectating ? '你' : nm(e.p)}</span>}
              {e.turn && e.p !== null ? `${nm(e.p)}・${e.text}` : e.text}
            </li>
          ))}
        </ol>
      </div>
    );
  }

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

// 這張卡在誰的舞台、第幾格（不在舞台上回傳 null）
function stageSlotOf(view: GameView, uid: string): { p: PlayerId; slot: number } | null {
  for (const p of [0, 1] as PlayerId[]) {
    const slot = view.players[p].stage.findIndex((c) => c?.uid === uid);
    if (slot >= 0) return { p, slot };
  }
  return null;
}

const isPrompt = (p: Pending) => !['main', 'climax', 'attackDeclare', 'clock', 'decideFirst'].includes(p.kind);

function pendingHint(p: Pending): string {
  switch (p.kind) {
    case 'mulligan': return '換牌：選要丟掉的手牌（可以不選），丟幾張就抽幾張。';
    case 'decideFirst': return '決定先後攻：點選一張蓋著的卡。';
    case 'clock': return '可以把 1 張手牌拖到傷害區（之後抽 2 張），或按「略過時計」。';
    case 'main': return '把手牌拖到格子出牌、拖動角色換位置、點選角色使用起動能力；做完按「結束主要階段」。';
    case 'climax': return '可以把名場面拖到名場面區，或按「不打名場面」。';
    case 'attackDeclare': return '點選發光的前列角色，選擇正打、側打或直接攻擊；不攻擊就按「結束攻擊」。';
    case 'counter': return '對手正打你的角色：可以使用 1 張助太刀或反擊事件。';
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
    case 'chooseOption': return p.prompt;
  }
}

// 底部彈出視窗：回應引擎的待決選擇。可以收起來看場地，看完再展開
function PromptSheet({ pending: p, view, seat, act, name, secondsLeft, fresh, power, soul, cardOf: cardLookup }: {
  pending: Pending; view: GameView; seat: PlayerId; act: (a: Action) => void; name: string; secondsLeft: number | null; fresh: Set<string>;
  power: Record<string, number>; soul: Record<string, number>; cardOf: (uid: string) => Card | null;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [focus, setFocus] = useState<Card | null>(null); // 最後點的卡：在視窗右側顯示說明
  const [collapsed, setCollapsed] = useState(false);
  const player = seat;
  const cardOf = (uid: string) => cardLookup(uid)!;
  const toggle = (uid: string, max: number) =>
    setPicked((cur) => (cur.includes(uid) ? cur.filter((u) => u !== uid) : max === 1 ? [uid] : cur.length < max ? [...cur, uid] : cur));

  // shown：一起顯示但不能選的卡（看牌時翻開的其他牌）
  const ordered = p.kind === 'select' && !!p.ordered;
  // 換牌階段：用滑鼠時指到哪張就看哪張（點一下是選要丟的牌，避免為了看效果誤按）；觸控照舊點按
  const hoverPeek = p.kind === 'mulligan';
  const myHand = view.players[player].hand;
  const cards = (options: string[], max: number, shown?: string[]) => {
    // 選的全是舞台上的角色：照舞台的擺位顯示，同名的角色才分得出是哪一隻
    if (!shown && options.length && options.every((u) => stageSlotOf(view, u))) return stagePicker(options, max);
    // 選手牌：照手牌的順序，剛拿到的卡標出來
    const list = !shown && options.every((u) => myHand.includes(u)) ? myHand.filter((u) => options.includes(u)) : (shown ?? options);
    return (
      <div className="opts">
        {list.map((uid) => {
          const can = options.includes(uid) && max > 0;
          const order = ordered ? picked.indexOf(uid) : -1;
          return (
            <div key={uid} className="opt-wrap" onPointerEnter={hoverPeek ? (e) => { if (e.pointerType === 'mouse') setFocus(cardOf(uid)); } : undefined}>
              <CardFace
                card={cardOf(uid)}
                selected={picked.includes(uid)}
                dim={!can && !!shown}
                onClick={() => { if (can) toggle(uid, max); setFocus(cardOf(uid)); }}
              />
              {order >= 0 && <span className="order-badge">{order === 0 ? '最上' : order + 1}</span>}
              {fresh.has(uid) && myHand.includes(uid) && <span className="fresh-badge">剛拿到</span>}
            </div>
          );
        })}
      </div>
    );
  };
  // 舞台擺位：對手在上（和場上一樣左右相反、後列在上），自己在下（前列在上、後列在下）
  const stagePicker = (options: string[], max: number) => {
    const owners = ([1 - seat, seat] as PlayerId[]).filter((o) => options.some((u) => stageSlotOf(view, u)?.p === o));
    const slotBox = (o: PlayerId, i: number) => {
      const c = view.players[o].stage[i];
      if (!c) return <div key={i} className="sp-slot empty" />;
      const can = options.includes(c.uid) && max > 0;
      const card = cardOf(c.uid);
      return (
        <div key={i} className={`sp-slot${can ? ' can' : ' off'}${picked.includes(c.uid) ? ' on' : ''}`} onClick={() => { if (can) toggle(c.uid, max); setFocus(card); }}>
          <div className="sp-img"><CardImg card={card} /></div>
          <PowerTag card={card} power={power[c.uid]} soul={soul[c.uid]} />
        </div>
      );
    };
    return (
      <div className="stage-pick">
        {owners.map((o) => {
          const front = o === seat ? [0, 1, 2] : [2, 1, 0];
          const back = o === seat ? [3, 4] : [4, 3];
          const rows = o === seat ? [front, back] : [back, front];
          return (
            <div key={o} className="sp-side">
              <span className="sp-who">{o === seat ? '你的舞台' : '對手的舞台'}</span>
              {rows.map((r, k) => <div key={k} className={`sp-row${r.length === 2 ? ' back' : ''}`}>{r.map((i) => slotBox(o, i))}</div>)}
            </div>
          );
        })}
      </div>
    );
  };
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
      const label = p.button
        ? p.button
        : p.shown
        ? picked.length ? `把這 ${picked.length} 張加到手牌，其餘放到休息室` : p.options.length ? '都不拿，全部放到休息室' : '放到休息室'
        : picked.length ? `確定（${picked.length} 張）` : p.min === 0 ? '都不選' : `請選 ${p.min} 張`;
      buttons = <button className="btn primary" disabled={picked.length < p.min || picked.length > p.max} onClick={() => choose(picked)}>{label}</button>;
      break;
    }
    case 'acknowledge':
      body = cards([], 0, p.cards);
      buttons = (
        <>
          <button className="btn primary" onClick={() => act({ type: 'yesno', player, yes: true })}>{p.button ?? '確認'}{p.timeout && secondsLeft !== null ? `（${secondsLeft}）` : ''}</button>
          {p.timeout && secondsLeft !== null && <span className="countdown">{secondsLeft} 秒後自動確認</span>}
        </>
      );
      break;
    case 'levelUp':
    case 'encoreChoose':
    case 'counter':
      body = cards(p.options, 1);
      buttons = (
        <>
          <button className="btn primary" disabled={picked.length !== 1} onClick={() => choose(picked)}>
            {p.kind === 'levelUp' ? '放到等級區' : p.kind === 'encoreChoose' ? '放進休息室' : '使用'}
          </button>
          {p.kind === 'counter' && <button className="btn" onClick={() => act({ type: 'pass', player })}>不使用{secondsLeft !== null ? `（${secondsLeft}）` : ''}</button>}
          {p.kind === 'counter' && secondsLeft !== null && <span className="countdown">{secondsLeft} 秒後自動不使用</span>}
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
      const text = p.kind === 'confirm' ? p.prompt : { treasureStock: '判定翻到金條：那張名場面已回到手牌。要再把牌組最上面 1 張放進能量區嗎？', pool: '判定翻到錢袋：要把牌組最上面 1 張放進能量區嗎？', draw: '判定翻到書本：要抽 1 張牌嗎？' }[p.reason];
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
      buttons = p.slots.map((slot) => (
        <button key={slot} className="btn primary" onClick={() => act({ type: 'chooseSlot', player, slot })}>
          {p.owner !== undefined && p.owner !== player ? '對手的' : ''}{SLOT_NAME[slot]}
        </button>
      ));
      break;
    case 'chooseOption':
      body = (
        <div className="order-list">
          {p.options.map((label, i) => (
            <button key={i} className="order-item" onClick={() => act({ type: 'choose', player, uids: [String(i)] })}>
              <span>{label}</span>
            </button>
          ))}
        </div>
      );
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

// 決定先後攻：兩張蓋著的大卡，雙方各點一張（點過的亮起並標名字），都選好後一起翻開
function FirstPick({ picks, result, seat, spectating, canPick, name, accent, images, onPick }: {
  picks: (0 | 1 | null)[];
  result: FirstDecided | null;
  seat: PlayerId;
  spectating: boolean;
  canPick: boolean;
  name: (p: PlayerId) => string;
  accent: (p: PlayerId) => string;
  images: TurnCards;
  onPick: (card: 0 | 1) => void;
}) {
  const opp = (1 - seat) as PlayerId;
  const owner = (card: 0 | 1): PlayerId | null => (picks[0] === card ? 0 : picks[1] === card ? 1 : null);
  const status = result
    ? `${spectating ? name(result.first) : result.first === seat ? '你' : name(result.first)} 先攻！`
    : spectating ? '雙方選卡中…'
    : picks[seat] === null ? '點一張卡' : picks[opp] === null ? `等待 ${name(opp)} 選卡…` : '翻牌中…';
  return (
    <div className={`first-pick${result ? ' revealed' : ''}`}>
      <div className="fp-banner"><span>決定先後攻</span></div>
      <div className="fp-cards">
        {([0, 1] as const).map((card) => {
          const p = owner(card);
          const free = canPick && picks[seat] === null && p === null;
          const face = result ? (card === result.firstCard ? images.first : images.last) : images.first;
          return (
            <div key={card} className="fp-slot">
              <button
                className={`fp-card${p !== null ? ' picked' : ''}${free ? ' free' : ''}`}
                style={p !== null ? { ['--pc' as string]: accent(p) } : undefined}
                disabled={!free}
                onClick={() => onPick(card)}
                aria-label={card === 0 ? '左邊的卡' : '右邊的卡'}
              >
                <span className="fp-inner">
                  <img className="fp-back" src={BACK_URL} alt="" draggable={false} />
                  <img className="fp-face" src={face} alt="" draggable={false} />
                </span>
              </button>
              <span className="fp-who" style={p !== null ? { ['--pc' as string]: accent(p) } : undefined}>
                {p === null ? ' ' : p === seat && !spectating ? '你' : name(p)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="fp-status">{status}</p>
    </div>
  );
}

// 進入對戰的 VS 動畫：左右兩邊是雙方牌組的主視覺，撞在一起噴出「VS」
function VsIntro({ left, right }: { left: VsSide; right: VsSide }) {
  const side = (s: VsSide, cls: 'l' | 'r') => (
    <div className={`vs-side ${cls}`} style={{ ['--pc' as string]: s.accent }}>
      <div className="vs-art">
        <img src={cardImg(`vs/${s.series}.jpg`)} alt="" draggable={false} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <div className="vs-name">
        <b>{s.name}</b>
        <span>{s.label}</span>
      </div>
    </div>
  );
  return (
    <div className="vs-intro" aria-hidden="true">
      <div className="vs-stage">
        {side(left, 'l')}
        {side(right, 'r')}
        <div className="vs-flash" />
        <div className="vs-ring" />
        <div className="vs-text">VS</div>
      </div>
    </div>
  );
}
type VsSide = { name: string; series: string; label: string; accent: string };

// 出牌展示：卡片從出牌玩家的手牌翻開、放大到畫面中間（和先後攻的卡一樣大）停一下，再縮小貼到場上的位置
function ShowcaseCard({ show, root, card, accent }: { show: Showcase; root: React.RefObject<HTMLElement | null>; card: Card | null; accent: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const r = root.current;
    if (!el || !r) return;
    const target = r.querySelector<HTMLElement>(`[data-uid="${show.uid}"]`);
    target?.getAnimations({ subtree: true }).forEach((x) => x.finish()); // 場上那張卡藏起來，不用滑過去；量位置前先停在終點
    const inner = target?.querySelector<HTMLElement>('.cimg-in') ?? target;
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const from = r.querySelector<HTMLElement>(`[data-zone="hand-${show.p}"]`)?.getBoundingClientRect();
    const fdx = from ? from.left + from.width / 2 - cx : 0;
    const fdy = from ? from.top + from.height / 2 - cy : box.height;
    const fs = from ? Math.min(0.5, Math.max(0.12, (from.height * 0.9) / box.height)) : 0.3;
    // 目的地：場上那張卡（橫放的名場面：外框是橫的，卡片轉 -90 度）
    const land = !!target?.classList.contains('land');
    const t = inner?.getBoundingClientRect();
    const tdx = t ? t.left + t.width / 2 - cx : 0;
    const tdy = t ? t.top + t.height / 2 - cy : 0;
    const ts = t ? (land ? t.height : t.width) / box.width : 0.3;
    const rot = land ? -90 : 0;
    const hide = [target, target?.parentElement?.querySelector<HTMLElement>('.ptag')].filter((x): x is HTMLElement => !!x); // 卡和攻擊力標籤等貼上去才出現
    hide.forEach((x) => (x.style.visibility = 'hidden'));
    const done = () => hide.forEach((x) => (x.style.visibility = ''));
    const tf = (x: number, y: number, s: number, ry: number, rz: number) => `translate(${x}px, ${y}px) scale(${s}) rotateY(${ry}deg) rotate(${rz}deg)`;
    const a = el.animate(
      [
        { transform: tf(fdx, fdy, fs, 180, 0), opacity: 0, offset: 0, easing: 'cubic-bezier(.2,.75,.25,1)' },
        { transform: tf(fdx * 0.8, fdy * 0.8, fs * 1.4, 160, 0), opacity: 1, offset: 0.05, easing: 'cubic-bezier(.2,.75,.25,1)' },
        { transform: tf(0, 0, 1.05, 0, 0), opacity: 1, offset: 0.3 },
        { transform: tf(0, 0, 1, 0, 0), opacity: 1, offset: 0.36 },
        { transform: tf(0, 0, 1, 0, 0), opacity: 1, offset: 0.72, easing: 'cubic-bezier(.55,0,.35,1)' },
        { transform: tf(tdx, tdy, ts, 0, rot), opacity: 1, offset: 1 },
      ],
      { duration: SHOWCASE_MS - 60, fill: 'forwards' },
    );
    a.onfinish = () => {
      done();
      play('land');
      el.style.opacity = '0';
    };
    return () => {
      a.cancel();
      done();
    };
  }, [show, root]);
  return (
    <div className="showcase" aria-hidden="true" style={{ ['--pc' as string]: accent }}>
      <div className="sc-card" ref={ref}>
        <img className="sc-back" src={BACK_URL} alt="" draggable={false} />
        <div className="sc-face">{card ? <CardImg card={card} /> : <img src={BACK_URL} alt="" />}</div>
      </div>
    </div>
  );
}

// 遊戲結束：先停在最後的場面，打出勝負橫幅；接著出現結算（可以收起來看最後的場地）
function GameOver({ winner, seat, spectating, view, stats, log, name, accent, title, onLeave }: {
  winner: PlayerId | 'draw'; seat: PlayerId; spectating: boolean; view: GameView; stats: GameStats | null; log: LogEntry[];
  name: (p: PlayerId) => string; accent: (p: PlayerId) => string; title: string; onLeave: () => void;
}) {
  const [stage, setStage] = useState<'banner' | 'result' | 'board'>('banner');
  const won = winner !== 'draw' && !spectating && winner === seat;
  const lost = winner !== 'draw' && !spectating && winner !== seat;
  useEffect(() => {
    play(lost ? 'lose' : 'win');
    const t = window.setTimeout(() => setStage((s) => (s === 'banner' ? 'result' : s)), 2800);
    return () => window.clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const opp = (1 - seat) as PlayerId;
  const who = (p: PlayerId) => (!spectating && p === seat ? '你' : name(p));
  const loser = winner === 'draw' ? null : ((1 - winner) as PlayerId);
  const reason = !stats?.reason ? '' : loser === null ? '雙方同時達到敗北條件'
    : stats.reason === 'level' ? `${who(loser)}的等級到達 4`
    : stats.reason === 'deck' ? `${who(loser)}的牌組和休息室都用完了`
    : `${who(loser)}投降（離開對戰）`;
  const big = winner === 'draw' ? '平手' : spectating ? `${name(winner)} 獲勝` : won ? '勝利' : '敗北';
  const color = accent(winner === 'draw' ? seat : winner);

  const time = (ms: number) => {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m >= 60 ? `${Math.floor(m / 60)} 小時 ${m % 60} 分` : `${m} 分 ${s} 秒`;
  };
  type Row = [string, (p: PlayerId) => number | string, boolean?]; // 第三欄：數字比大小，大的標亮
  const rows: Row[] = stats ? [
    ['最終等級・傷害', (p) => `Lv ${view.players[p].level.length}・${view.players[p].clock.length}/7`],
    ['造成傷害', (p) => stats.players[p].damageDealt, true],
    ['單次最大傷害', (p) => stats.players[p].maxHit, true],
    ['取消傷害', (p) => stats.players[p].cancels, true],
    ['攻擊次數', (p) => stats.players[p].attacks, true],
    ['登場角色', (p) => stats.players[p].characters, true],
    ['打出名場面', (p) => stats.players[p].climaxes, true],
    ['判定觸發', (p) => stats.players[p].triggers, true],
    ['發動效果', (p) => stats.players[p].abilities, true],
    ['重洗次數', (p) => stats.players[p].refreshes],
  ] : [];
  // 最後的攻防：最後 10 行紀錄（含回合分隔），看得出是怎麼結束的
  const finale = log.filter((e) => e.text !== '遊戲結束').slice(-10);

  return (
    <>
      {stage === 'banner' && (
        <div className={`go-banner${lost ? ' lost' : ''}`} style={{ ['--pc' as string]: color }}>
          <div className="go-strip">
            <b>{big}</b>
            {reason && <span>{reason}</span>}
          </div>
        </div>
      )}
      {stage === 'board' && (
        <div className="go-bar" style={{ ['--pc' as string]: color }}>
          <b>遊戲結束・{title}</b>
          <button className="btn primary" onClick={() => setStage('result')}>查看結算</button>
          <button className="btn" onClick={onLeave}>回到大廳</button>
        </div>
      )}
      {stage === 'result' && (
        <div className="modal go-modal">
          <div className={`dialog go-result${lost ? ' lost' : ''}`} style={{ ['--pc' as string]: color }}>
            <header className="go-head">
              <b>{big}</b>
              {reason && <span>{reason}</span>}
            </header>
            {stats && (
              <div className="go-meta">
                <div><small>遊玩時間</small><b>{time(stats.elapsedMs)}</b></div>
                <div><small>回合數</small><b>{view.turn}</b></div>
                <div><small>先攻</small><b>{who(view.firstPlayer)}</b></div>
              </div>
            )}
            {rows.length > 0 && (
              <table className="go-table">
                <thead>
                  <tr>
                    <th />
                    {([seat, opp] as PlayerId[]).map((p) => (
                      <th key={p} style={{ ['--pc' as string]: accent(p) }}>{name(p)}{!spectating && p === seat ? '（你）' : ''}{winner === p ? ' 👑' : ''}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, get, cmp]) => {
                    const a = get(seat);
                    const b = get(opp);
                    return (
                      <tr key={label}>
                        <td>{label}</td>
                        <td className={cmp && a > b ? 'hi' : ''}>{a}</td>
                        <td className={cmp && b > a ? 'hi' : ''}>{b}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {finale.length > 0 && (
              <div className="go-finale">
                <b>最後的攻防</b>
                <ol>
                  {finale.map((e) => (
                    <li key={e.id} className={e.turn ? 'turn' : ''} style={e.p !== null ? { ['--pc' as string]: accent(e.p) } : undefined}>
                      {e.p !== null && !e.turn && <span className="who">{who(e.p)}</span>}
                      {e.turn && e.p !== null ? `${name(e.p)}・${e.text}` : e.text}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={() => setStage('board')}>查看最後的場地</button>
              <button className="btn primary" onClick={onLeave}>回到大廳</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

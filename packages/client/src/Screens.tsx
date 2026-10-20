import { useEffect, useMemo, useState } from 'react';
import { deckSummary, type RoomInfo } from '@ws/engine';
import { authErrorText, type Auth } from './auth.ts';
import { CardFace, CardInfo } from './CardFace.tsx';
import { DeckBuilder, SeriesBrowser } from './DeckBuilder.tsx';
import { deckSeries, deleteDeck, saveDeck, useMyDecks, type SavedDeck } from './decks.ts';
import { PRESET_DECKS, SERIES, SERIES_CARDS, cardById, seriesInfo, type DeckInfo } from './meta.ts';
import { net, useNet } from './net.ts';
import { DEFAULT_TURN_CARDS, fileToCardImage, loadTurnCards, saveTurnCard, type TurnCards } from './turnCards.ts';

// ───── 登入 ─────
export function LoginScreen({ auth, onDone }: { auth: Auth; onDone: (name: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState(() => localStorage.getItem('ws-dev-name') ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dev = auth.kind === 'dev';

  const run = async (fn: () => Promise<{ name: string }> | { name: string }) => {
    setBusy(true);
    setErr(null);
    try {
      onDone((await fn()).name);
    } catch (e) {
      setErr(authErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen login">
      <div className="login-card">
        <img className="login-logo" src="/logo.png" alt="Weiß Schwarz" />
        <h1>黑白雙翼 對戰模擬器</h1>
        <p className="sub">和朋友線上對戰，免費、繁體中文</p>

        {dev ? (
          <form onSubmit={(e) => { e.preventDefault(); void run(() => auth.signInDev(name)); }}>
            <div className="dev-note">測試登入模式：還沒有設定 Firebase，所以只要輸入名字就能進來。每個瀏覽器分頁都是不同的玩家。</div>
            <label className="field"><span>玩家名稱</span><input value={name} maxLength={16} autoFocus placeholder="你想用什麼名字？" onChange={(e) => setName(e.target.value)} /></label>
            <button className="btn primary wide" disabled={busy || !name.trim()}>進入大廳</button>
          </form>
        ) : (
          <>
            <div className="tabs2">
              <button className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setErr(null); }}>登入</button>
              <button className={mode === 'register' ? 'on' : ''} onClick={() => { setMode('register'); setErr(null); }}>註冊</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => (mode === 'login' ? auth.signInEmail(email, password) : auth.signUpEmail(email, password, name)));
              }}
            >
              {mode === 'register' && (
                <label className="field"><span>玩家名稱</span><input value={name} maxLength={16} placeholder="對戰時顯示的名字" onChange={(e) => setName(e.target.value)} /></label>
              )}
              <label className="field"><span>Email</span><input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} /></label>
              <label className="field"><span>密碼</span><input type="password" value={password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={(e) => setPassword(e.target.value)} /></label>
              <button className="btn primary wide" disabled={busy || !email || !password || (mode === 'register' && !name.trim())}>{mode === 'login' ? '登入' : '建立帳號'}</button>
            </form>
            <div className="or"><span>或</span></div>
            <button className="btn wide google" disabled={busy} onClick={() => void run(() => auth.signInGoogle())}>使用 Google 登入</button>
          </>
        )}
        {err && <p className="form-err">{err}</p>}
      </div>
    </div>
  );
}

// ───── 牌組 ─────
const DEFAULT_DECK_KEY = 'ws-default-deck';
const readDefault = () => {
  try {
    return localStorage.getItem(DEFAULT_DECK_KEY);
  } catch {
    return null;
  }
};
const toInfo = (d: SavedDeck): DeckInfo => {
  const sum = deckSummary(cardById, d.cards);
  return { id: d.id, name: d.name, series: deckSeries(d), cards: d.cards, preset: false, notReady: sum.notReady };
};

// 可以選的牌組：自己的（最近編輯的在前）＋系統預組。預設牌組不能用（不到 50 張等）時，改用第一副能用的
export const useDecks = () => {
  const { decks: mine, loaded } = useMyDecks();
  const [defId, setDefId] = useState(readDefault);
  const own = useMemo(() => mine.map(toInfo), [mine]);
  const setDefault = (id: string) => {
    try {
      localStorage.setItem(DEFAULT_DECK_KEY, id);
    } catch { /* 瀏覽器不給存就只記在這次 */ }
    setDefId(id);
  };
  const usable = [...own.filter((d) => !d.notReady), ...PRESET_DECKS];
  const def = usable.find((d) => d.id === defId) ?? usable[0]!;
  return { own, presets: PRESET_DECKS, loaded, def, setDefault };
};

// 建房、加入時選牌組：自己的牌組在上面，系統預組收起來（沒有自己的牌組、或正選著預組時自動展開）
function DeckPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { own, presets } = useDecks();
  const [manual, setManual] = useState<boolean | null>(null);
  const showPresets = manual ?? (own.length === 0 || presets.some((p) => p.id === value));
  const opt = (d: DeckInfo) => (
    <button key={d.id} type="button" disabled={!!d.notReady} className={`deck-opt${d.id === value ? ' on' : ''}`} style={{ ['--pc' as string]: seriesInfo(d.series).accent }} onClick={() => onChange(d.id)}>
      <b>{d.name}</b>
      <span>{seriesInfo(d.series).label}・{d.notReady ?? `${d.cards.length} 張`}</span>
    </button>
  );
  return (
    <div className="deck-picker">
      {own.map(opt)}
      <button type="button" className="fold" onClick={() => setManual(!showPresets)}>系統預組（{presets.length}）{showPresets ? '▴' : '▾'}</button>
      {showPresets && presets.map(opt)}
    </div>
  );
}

type DeckView = { kind: 'list' } | { kind: 'build'; deck: SavedDeck | null; series: string } | { kind: 'browse'; series: string };

export function DecksScreen({ onBack }: { onBack: () => void }) {
  const { own, presets, loaded, def, setDefault } = useDecks();
  const { decks: mine, error } = useMyDecks();
  const { user } = useNet();
  const [view, setView] = useState<DeckView>({ kind: 'list' });
  const [open, setOpen] = useState<DeckInfo | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [newDeck, setNewDeck] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const showPresets = presetsOpen ?? (loaded && own.length === 0);

  const grouped = useMemo(() => {
    if (!open) return [];
    const m = new Map<string, number>();
    for (const id of open.cards) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [open]);

  if (view.kind === 'build') return <DeckBuilder deck={view.deck} series={view.series} onClose={() => setView({ kind: 'list' })} />;
  if (view.kind === 'browse') return <SeriesBrowser series={view.series} onBack={() => setView({ kind: 'list' })} />;

  const copy = async (p: DeckInfo) => {
    setErr(null);
    try {
      const d = await saveDeck({ name: `${p.name}（複製）`, cards: p.cards });
      setView({ kind: 'build', deck: d, series: p.series });
    } catch (e) {
      setErr(`複製失敗：${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const remove = async (d: DeckInfo) => {
    if (!window.confirm(`確定要刪除「${d.name}」嗎？刪除後不能復原。`)) return;
    setErr(null);
    try {
      await deleteDeck(d.id);
    } catch (e) {
      setErr(`刪除失敗：${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const seriesList = Object.keys(SERIES).filter((s) => SERIES_CARDS.has(s));

  return (
    <div className="screen">
      <header className="scr-head"><button className="btn ghost" onClick={onBack}>← 回大廳</button><h2>我的牌組</h2></header>
      <section className="scr-sec">
        <div className="sec-head">
          <h3>我的牌組</h3>
          <button className="btn primary" disabled={!user} onClick={() => setNewDeck(true)}>＋ 建立新牌組</button>
        </div>
        {!user && <p className="muted">連上伺服器後會載入你的牌組…</p>}
        {user && !loaded && <p className="muted">載入中…</p>}
        {(error || err) && <p className="err">{err ?? error}</p>}
        {loaded && own.length === 0 && (
          <div className="empty-deck">
            <p>還沒有自己組的牌組。</p>
            <p className="muted">可以從空白開始組，或把下面的系統預組「複製到我的牌組」再修改。</p>
          </div>
        )}
        {own.length > 0 && (
          <div className="deck-grid">
            {own.map((d) => (
              <div key={d.id} className="deck-card" style={{ ['--pc' as string]: seriesInfo(d.series).accent }}>
                <div className="deck-ban" />
                <b>{d.name}</b>
                <span>{seriesInfo(d.series).label}・{d.cards.length} / 50 張{d.notReady ? `・${d.notReady}` : '・可以對戰'}</span>
                <div className="actions">
                  <button className="btn" onClick={() => setView({ kind: 'build', deck: mine.find((x) => x.id === d.id)!, series: d.series })}>編輯</button>
                  <button className={`btn${def.id === d.id ? ' primary' : ''}`} disabled={!!d.notReady} onClick={() => setDefault(d.id)}>{def.id === d.id ? '✓ 預設牌組' : '設為預設'}</button>
                  <button className="btn ghost" onClick={() => void remove(d)}>刪除</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="scr-sec">
        <h3>系列卡表</h3>
        <div className="series-chips">
          {seriesList.map((s) => (
            <button key={s} className="series-chip" style={{ ['--pc' as string]: seriesInfo(s).accent }} onClick={() => setView({ kind: 'browse', series: s })}>
              <b>{seriesInfo(s).label}</b>
              <span>{SERIES_CARDS.get(s)!.length} 種卡</span>
            </button>
          ))}
        </div>
      </section>

      <section className="scr-sec">
        <button className="fold sec-fold" onClick={() => setPresetsOpen(!showPresets)}>系統預組（{presets.length}）{showPresets ? '▴' : '▾'}</button>
        {showPresets && (
          <div className="deck-grid">
            {presets.map((d) => (
              <div key={d.id} className="deck-card" style={{ ['--pc' as string]: seriesInfo(d.series).accent }}>
                <div className="deck-ban" />
                <b>{d.name}</b>
                <span>{seriesInfo(d.series).label}・{d.cards.length} 張</span>
                <div className="actions">
                  <button className="btn" onClick={() => { setOpen(d); setPick(null); }}>查看牌表</button>
                  <button className={`btn${def.id === d.id ? ' primary' : ''}`} onClick={() => setDefault(d.id)}>{def.id === d.id ? '✓ 預設牌組' : '設為預設'}</button>
                  <button className="btn" disabled={!user} onClick={() => void copy(d)}>複製到我的牌組</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <TurnCardsSection />

      {newDeck && (
        <div className="modal" onClick={() => setNewDeck(false)}>
          <div className="dialog small" onClick={(e) => e.stopPropagation()}>
            <h3>建立新牌組</h3>
            <p className="lbl">要用哪個系列的卡？（組的時候也可以切換）</p>
            <div className="deck-picker">
              {seriesList.map((s) => (
                <button key={s} type="button" className="deck-opt" style={{ ['--pc' as string]: seriesInfo(s).accent }} onClick={() => { setNewDeck(false); setView({ kind: 'build', deck: null, series: s }); }}>
                  <b>{seriesInfo(s).label}</b>
                  <span>{SERIES_CARDS.get(s)!.length} 種卡</span>
                </button>
              ))}
            </div>
            <div className="actions"><button className="btn ghost" onClick={() => setNewDeck(false)}>取消</button></div>
          </div>
        </div>
      )}

      {open && (
        <div className="modal" onClick={() => setOpen(null)}>
          <div className="dialog zone-dialog" onClick={(e) => e.stopPropagation()}>
            <header><h3>{open.name}<small>{open.cards.length} 張・{grouped.length} 種</small></h3><button className="btn" onClick={() => setOpen(null)}>關閉</button></header>
            <div className="zgrid">
              {grouped.map(([id, n]) => (
                <div key={id} className="deck-thumb">
                  <CardFace card={cardById.get(id)!} selected={pick === id} onClick={() => setPick(pick === id ? null : id)} />
                  <span className="cnt">×{n}</span>
                </div>
              ))}
            </div>
            <div className="zone-info">{pick ? <CardInfo card={cardById.get(pick)!} /> : <p className="muted">點選卡片查看說明。</p>}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// 先攻／後攻卡面：開房時會用你上傳的這兩張（沒上傳就用系統預設）
function TurnCardsSection() {
  const { user } = useNet();
  const uid = user?.userId;
  const [cards, setCards] = useState<TurnCards | null>(null);
  const [busy, setBusy] = useState<keyof TurnCards | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (uid) void loadTurnCards(uid).then(setCards);
  }, [uid]);
  if (!uid) return null;

  const change = async (which: keyof TurnCards, file: File | null) => {
    setErr(null);
    setBusy(which);
    try {
      const image = file ? await fileToCardImage(file) : null;
      await saveTurnCard(uid, which, image);
      setCards(await loadTurnCards(uid));
    } catch (e) {
      setErr(e instanceof Error ? `上傳失敗：${e.message}` : '上傳失敗');
    } finally {
      setBusy(null);
    }
  };
  const slot = (which: keyof TurnCards, label: string) => {
    const src = cards?.[which] ?? DEFAULT_TURN_CARDS[which];
    const custom = src !== DEFAULT_TURN_CARDS[which];
    return (
      <div className="turn-slot">
        <div className="turn-img">{busy === which ? <span className="muted">處理中…</span> : <img src={src} alt={label} />}</div>
        <b>{label}{custom ? '' : '（系統預設）'}</b>
        <div className="actions">
          <label className="btn">
            上傳圖片
            <input type="file" accept="image/*" hidden disabled={busy !== null} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void change(which, f); }} />
          </label>
          {custom && <button className="btn ghost" disabled={busy !== null} onClick={() => void change(which, null)}>恢復預設</button>}
        </div>
      </div>
    );
  };
  return (
    <section className="scr-sec">
      <h3>先攻／後攻卡面</h3>
      <p className="muted">你開的房間，決定先後攻時會翻這兩張。圖片會自動裁成卡片比例（5:7）。</p>
      <div className="turn-cards">
        {slot('first', '先攻卡')}
        {slot('last', '後攻卡')}
      </div>
      {err && <p className="err">{err}</p>}
    </section>
  );
}

// ───── 大廳 ─────
function ServerStatus() {
  const { status, wakeSeconds } = useNet();
  const text =
    status === 'waking' ? `正在喚醒對戰伺服器…（免費主機閒置後會休眠，第一次大約要 1 分鐘）已等 ${wakeSeconds} 秒` :
    status === 'connecting' ? '正在連線到對戰伺服器…' :
    status === 'offline' ? '連線中斷，重新連線中…' : null;
  if (!text) return null;
  return <div className="srv-status"><i />{text}</div>;
}

export function LobbyScreen({ name, onDecks, onLogout, onRename }: { name: string; onDecks: () => void; onLogout: () => void; onRename: (n: string) => void }) {
  const { status } = useNet();
  const [dlg, setDlg] = useState<'create' | 'join' | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const ready = status === 'online';

  return (
    <div className="screen lobby">
      <header className="lobby-top">
        <div className="brand"><img className="logo" src="/logo.png" alt="Weiß Schwarz" /><b>黑白雙翼 對戰模擬器</b></div>
        <div className="who-box">
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); onRename(draft); setEditing(false); }}>
              <input autoFocus value={draft} maxLength={16} onChange={(e) => setDraft(e.target.value)} onBlur={() => setEditing(false)} />
            </form>
          ) : (
            <button className="btn ghost" onClick={() => { setDraft(name); setEditing(true); }} title="修改名稱">{name} ✎</button>
          )}
          <button className="btn ghost" onClick={onLogout}>登出</button>
        </div>
      </header>
      <ServerStatus />
      <div className="lobby-grid">
        <button className="big-btn create" disabled={!ready} onClick={() => setDlg('create')}>
          <i>＋</i><b>建立遊戲</b><span>開一個私人房間，把 6 位數代碼傳給朋友</span>
        </button>
        <button className="big-btn join" disabled={!ready} onClick={() => setDlg('join')}>
          <i>→</i><b>加入遊戲／觀戰</b><span>輸入朋友給你的房間代碼</span>
        </button>
        <button className="big-btn decks" onClick={onDecks}>
          <i>▤</i><b>我的牌組</b><span>預組與自己組的牌組</span>
        </button>
      </div>
      {dlg === 'create' && <CreateDialog onClose={() => setDlg(null)} />}
      {dlg === 'join' && <JoinDialog onClose={() => setDlg(null)} />}
    </div>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const { def, setDefault } = useDecks();
  const [spectators, setSpectators] = useState(true);
  const [max, setMax] = useState(6);
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <h3>建立遊戲</h3>
        <p className="lbl">選擇牌組</p>
        <DeckPicker value={def.id} onChange={setDefault} />
        <label className="switch-row">
          <input type="checkbox" checked={spectators} onChange={(e) => setSpectators(e.target.checked)} />
          <span>開放觀戰（觀戰者看不到任何一方的手牌）</span>
        </label>
        {spectators && (
          <label className="switch-row indent">
            <span>觀戰人數上限</span>
            <select value={max} onChange={(e) => setMax(Number(e.target.value))}>{[2, 4, 6, 8].map((n) => <option key={n} value={n}>{n} 人</option>)}</select>
          </label>
        )}
        <div className="actions">
          <button className="btn primary" onClick={() => net.send({ t: 'create', deck: def.cards, deckName: def.name, allowSpectators: spectators, maxSpectators: spectators ? max : 0 })}>建立房間</button>
          <button className="btn" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

function JoinDialog({ onClose }: { onClose: () => void }) {
  const { def, setDefault } = useDecks();
  const { peek } = useNet();
  const [code, setCode] = useState('');

  useEffect(() => {
    net.clearPeek();
    return () => net.clearPeek();
  }, []);
  useEffect(() => {
    if (code.length === 6) net.send({ t: 'peek', code });
    else net.clearPeek();
  }, [code]);

  const info = peek && peek.code === code ? peek : null;
  const canPlay = !!info?.exists && info.info!.seatFree && info.info!.status === 'waiting';
  const canWatch = !!info?.exists && info.info!.spectatorsAllowed && !info.info!.spectatorsFull;

  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <h3>加入遊戲／觀戰</h3>
        <label className="field">
          <span>房間代碼（6 位數字）</span>
          <input className="code-input" inputMode="numeric" autoFocus maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        </label>
        {code.length === 6 && !info && <p className="muted">查詢中…</p>}
        {info && !info.exists && <p className="form-err">找不到這個房間，請確認代碼</p>}
        {info?.exists && (
          <p className="room-peek">
            <b>{info.info!.hostName}</b> 的房間・{info.info!.status === 'waiting' ? '等待對手中' : info.info!.status === 'playing' ? '對戰中' : '已結束'}
          </p>
        )}
        {canPlay && (
          <>
            <p className="lbl">選擇牌組</p>
            <DeckPicker value={def.id} onChange={setDefault} />
          </>
        )}
        <div className="actions">
          <button className="btn primary" disabled={!canPlay} onClick={() => net.send({ t: 'join', code, role: 'player', deck: def.cards, deckName: def.name })}>加入對戰</button>
          <button className="btn" disabled={!canWatch} onClick={() => net.send({ t: 'join', code, role: 'spectator' })}>觀戰</button>
          <button className="btn ghost" onClick={onClose}>取消</button>
        </div>
        {info?.exists && !canPlay && !canWatch && <p className="muted">這個房間座位已滿，而且不開放（或已滿）觀戰。</p>}
      </div>
    </div>
  );
}

// ───── 等待房間（還沒開局）─────
export function RoomScreen({ room }: { room: RoomInfo }) {
  const [copied, setCopied] = useState(false);
  const [deckDlg, setDeckDlg] = useState(false);
  const me = room.you === 0 || room.you === 1 ? room.seats[room.you] : null;
  const guest = room.seats.find((s) => s && !s.host) ?? null;
  const bothSeated = !!room.seats[0] && !!room.seats[1];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* 瀏覽器不允許就算了，代碼就在畫面上 */ }
  };
  return (
    <div className="screen">
      <header className="scr-head"><h2>房間</h2></header>
      <div className="room-box">
        <p className="muted">把這組代碼傳給朋友，對方在大廳按「加入遊戲／觀戰」輸入即可</p>
        <div className="code-big">{room.code.split('').map((c, i) => <b key={i}>{c}</b>)}</div>
        <button className="btn" onClick={copy}>{copied ? '✓ 已複製' : '複製代碼'}</button>
        <div className="seats">
          {([0, 1] as const).map((p) => {
            const s = room.seats[p];
            return (
              <div key={p} className={`seat${s ? '' : ' empty'}`} style={{ ['--pc' as string]: s ? seriesInfo(s.series).accent : '#555' }}>
                {s ? (
                  <>
                    <div className="avatar">{s.name.slice(0, 1)}</div>
                    <div><b>{s.name}{room.you === p ? '（你）' : ''}{s.host && <small className="host-tag">房主</small>}</b><span>{seriesInfo(s.series).label}・{s.deckName}</span></div>
                    {!s.host && <em className={s.ready ? 'on' : ''}>{s.ready ? '✓ 已準備' : '未準備'}</em>}
                    <em className={s.online ? 'on' : ''}>{s.online ? '在線' : '離線'}</em>
                  </>
                ) : <span className="wait-dots">等待對手加入<i>.</i><i>.</i><i>.</i></span>}
              </div>
            );
          })}
        </div>
        {room.config.allowSpectators && <p className="muted">觀戰：{room.spectators.length} / {room.config.maxSpectators} 人{room.spectators.length ? `（${room.spectators.map((s) => s.name).join('、')}）` : ''}</p>}
        {me && (
          <div className="room-actions">
            {me.host ? (
              <button className="btn primary big" disabled={!bothSeated || !guest?.ready} onClick={() => net.send({ t: 'start' })}>遊戲開始</button>
            ) : (
              <button className={`btn big${me.ready ? '' : ' primary'}`} onClick={() => net.send({ t: 'ready', ready: !me.ready })}>{me.ready ? '取消準備' : '準備'}</button>
            )}
            <button className="btn" onClick={() => setDeckDlg(true)}>更改牌組</button>
          </div>
        )}
        {me?.host && <p className="muted small">{!bothSeated ? '等對手加入後，對手按「準備」，你就可以按「遊戲開始」。觀戰的人也可以先進來。' : guest?.ready ? '對手已準備好，可以開始了。' : '等對手按「準備」。'}</p>}
        {me && !me.host && <p className="muted small">{me.ready ? '已準備，等房主按「遊戲開始」。' : '確認牌組後按「準備」。'}</p>}
        <button className="btn ghost" onClick={() => net.send({ t: 'leave' })}>離開房間</button>
      </div>
      {deckDlg && me && <ChangeDeckDialog current={me.deckName} onClose={() => setDeckDlg(false)} />}
    </div>
  );
}

// 開局前更換牌組（加入者換了要重新按準備）
function ChangeDeckDialog({ current, onClose }: { current: string; onClose: () => void }) {
  const { own, presets, def, setDefault } = useDecks();
  const [pick, setPick] = useState(() => [...own, ...presets].find((d) => d.name === current && !d.notReady)?.id ?? def.id);
  const deck = [...own, ...presets].find((d) => d.id === pick && !d.notReady);
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <h3>更改牌組</h3>
        <DeckPicker value={pick} onChange={setPick} />
        <div className="actions">
          <button className="btn primary" disabled={!deck} onClick={() => {
            if (!deck) return;
            setDefault(deck.id);
            net.send({ t: 'changeDeck', deck: deck.cards, deckName: deck.name });
            onClose();
          }}>使用這副牌組</button>
          <button className="btn" onClick={onClose}>取消</button>
        </div>
      </div>
    </div>
  );
}

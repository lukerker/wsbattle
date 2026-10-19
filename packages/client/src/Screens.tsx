import { useEffect, useMemo, useState } from 'react';
import type { RoomInfo } from '@ws/engine';
import { authErrorText, type Auth } from './auth.ts';
import { CardFace, CardInfo } from './CardFace.tsx';
import { PRESET_DECKS, cardById, seriesInfo, type DeckInfo } from './meta.ts';
import { net, useNet } from './net.ts';

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
export const useDecks = () => {
  const [defId, setDefId] = useState(() => localStorage.getItem(DEFAULT_DECK_KEY) ?? PRESET_DECKS[0]!.id);
  const decks: DeckInfo[] = PRESET_DECKS; // 之後這裡會加上玩家自己組的牌組（存在雲端）
  const setDefault = (id: string) => {
    localStorage.setItem(DEFAULT_DECK_KEY, id);
    setDefId(id);
  };
  const def = decks.find((d) => d.id === defId) ?? decks[0]!;
  return { decks, def, setDefault };
};

function DeckPicker({ decks, value, onChange }: { decks: DeckInfo[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="deck-picker">
      {decks.map((d) => (
        <button key={d.id} type="button" className={`deck-opt${d.id === value ? ' on' : ''}`} style={{ ['--pc' as string]: seriesInfo(d.series).accent }} onClick={() => onChange(d.id)}>
          <b>{d.name}</b>
          <span>{seriesInfo(d.series).label}・{d.cards.length} 張</span>
        </button>
      ))}
    </div>
  );
}

export function DecksScreen({ onBack }: { onBack: () => void }) {
  const { decks, def, setDefault } = useDecks();
  const [open, setOpen] = useState<DeckInfo | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  const grouped = useMemo(() => {
    if (!open) return [];
    const m = new Map<string, number>();
    for (const id of open.cards) m.set(id, (m.get(id) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [open]);

  return (
    <div className="screen">
      <header className="scr-head"><button className="btn ghost" onClick={onBack}>← 回大廳</button><h2>我的牌組</h2></header>
      <section className="scr-sec">
        <h3>系統預組</h3>
        <div className="deck-grid">
          {decks.filter((d) => d.preset).map((d) => (
            <div key={d.id} className="deck-card" style={{ ['--pc' as string]: seriesInfo(d.series).accent }}>
              <div className="deck-ban" />
              <b>{d.name}</b>
              <span>{seriesInfo(d.series).label}・{d.cards.length} 張</span>
              <div className="actions">
                <button className="btn" onClick={() => { setOpen(d); setPick(null); }}>查看牌表</button>
                <button className={`btn${def.id === d.id ? ' primary' : ''}`} onClick={() => setDefault(d.id)}>{def.id === d.id ? '✓ 預設牌組' : '設為預設'}</button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="scr-sec">
        <h3>自己組的牌組</h3>
        <div className="empty-deck">
          <p>還沒有自己組的牌組。</p>
          <p className="muted">補充包的卡片開放之後，就可以在這裡自由組牌，並存到你的帳號。</p>
          <button className="btn" disabled>＋ 建立新牌組（尚未開放）</button>
        </div>
      </section>

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
  const { decks, def, setDefault } = useDecks();
  const [spectators, setSpectators] = useState(true);
  const [max, setMax] = useState(6);
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog small" onClick={(e) => e.stopPropagation()}>
        <h3>建立遊戲</h3>
        <p className="lbl">選擇牌組</p>
        <DeckPicker decks={decks} value={def.id} onChange={setDefault} />
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
  const { decks, def, setDefault } = useDecks();
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
            <DeckPicker decks={decks} value={def.id} onChange={setDefault} />
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
                    <div><b>{s.name}{room.you === p ? '（你）' : ''}</b><span>{seriesInfo(s.series).label}・{s.deckName}</span></div>
                    <em className={s.online ? 'on' : ''}>{s.online ? '在線' : '離線'}</em>
                  </>
                ) : <span className="wait-dots">等待對手加入<i>.</i><i>.</i><i>.</i></span>}
              </div>
            );
          })}
        </div>
        {room.config.allowSpectators && <p className="muted">觀戰：{room.spectators.length} / {room.config.maxSpectators} 人{room.spectators.length ? `（${room.spectators.map((s) => s.name).join('、')}）` : ''}</p>}
        <button className="btn ghost" onClick={() => net.send({ t: 'leave' })}>離開房間</button>
      </div>
    </div>
  );
}

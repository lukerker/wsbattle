import { useEffect, useRef, useState } from 'react';
import { createAuth, type Auth } from './auth.ts';
import GameScreen from './GameScreen.tsx';
import { DecksScreen, LobbyScreen, LoginScreen, RoomScreen } from './Screens.tsx';
import { net, useNet } from './net.ts';

// 畫面流程：登入 → 大廳（建立／加入／我的牌組）→ 房間 → 對戰
export default function App() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [sub, setSub] = useState<'lobby' | 'decks'>('lobby');
  const { room, error, status } = useNet();
  const [toast, setToast] = useState<string | null>(null);
  const started = useRef(false);

  // 啟動：建立登入模組，還原登入狀態；已登入就連上伺服器
  useEffect(() => {
    void (async () => {
      const a = await createAuth();
      setAuth(a);
      const u = await a.restore();
      if (u) {
        setName(u.name);
        started.current = true;
        void net.start(a);
      }
      setBooting(false);
    })();
  }, []);

  // 大廳、房間畫面的錯誤提示（對戰畫面自己處理）
  useEffect(() => {
    if (!error || room?.status === 'playing' || room?.status === 'ended') return;
    setToast(error);
    net.clearError();
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [error, room?.status]);

  if (booting || !auth) return <div className="screen"><div className="center-note">載入中…</div></div>;

  if (name === null) {
    return (
      <LoginScreen
        auth={auth}
        onDone={(n) => {
          setName(n);
          started.current = true;
          void net.start(auth);
        }}
      />
    );
  }

  const logout = async () => {
    net.stop();
    started.current = false;
    await auth.signOut();
    setName(null);
    setSub('lobby');
  };

  let body;
  if (status === 'kicked') {
    body = (
      <div className="screen login">
        <div className="login-card">
          <h1>已在其他裝置登入</h1>
          <p className="sub">你的帳號在另一台裝置（或分頁）登入了，這裡已經中斷連線。</p>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => net.resume()}>在這裡繼續</button>
            <button className="btn ghost" onClick={() => void logout()}>登出</button>
          </div>
        </div>
      </div>
    );
  } else if (room && (room.status === 'playing' || room.status === 'ended')) body = <GameScreen room={room} />;
  else if (room) body = <RoomScreen room={room} />;
  else if (sub === 'decks') body = <DecksScreen onBack={() => setSub('lobby')} />;
  else body = <LobbyScreen name={name} onDecks={() => setSub('decks')} onLogout={logout} onRename={(n) => void auth.setName(n).then((u) => setName(u.name))} />;

  return (
    <>
      {body}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

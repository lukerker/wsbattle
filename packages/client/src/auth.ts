// 登入：有設定 Firebase 就用 Firebase（Email 註冊登入、Google），沒設定就用「測試登入」（只填名字，每個分頁是不同的人）。
import { FIREBASE } from './config.ts';

export interface AuthUser {
  name: string;
}

export interface Auth {
  kind: 'dev' | 'firebase';
  // 啟動時還原登入狀態
  restore(): Promise<AuthUser | null>;
  signInEmail(email: string, password: string): Promise<AuthUser>;
  signUpEmail(email: string, password: string, name: string): Promise<AuthUser>;
  signInGoogle(): Promise<AuthUser>;
  signInDev(name: string): AuthUser;
  setName(name: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  // 連上對戰伺服器時要送的身分資料
  hello(): Promise<{ token?: string; name?: string; devId?: string }>;
}

const DEV_NAME_KEY = 'ws-dev-name';
const DEV_ID_KEY = 'ws-dev-id';

function createDevAuth(): Auth {
  // sessionStorage：每個分頁一個身分，所以開兩個分頁就是兩位玩家
  const devId = () => {
    let id = sessionStorage.getItem(DEV_ID_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem(DEV_ID_KEY, id);
    }
    return id;
  };
  let name: string | null = sessionStorage.getItem(DEV_NAME_KEY);
  return {
    kind: 'dev',
    restore: async () => (name ? { name } : null),
    signInEmail: async () => { throw new Error('目前是測試登入模式'); },
    signUpEmail: async () => { throw new Error('目前是測試登入模式'); },
    signInGoogle: async () => { throw new Error('目前是測試登入模式'); },
    signInDev: (n) => {
      name = n.trim().slice(0, 16) || '玩家';
      sessionStorage.setItem(DEV_NAME_KEY, name);
      localStorage.setItem(DEV_NAME_KEY, name);
      return { name };
    },
    setName: async (n) => {
      name = n.trim().slice(0, 16) || '玩家';
      sessionStorage.setItem(DEV_NAME_KEY, name);
      return { name };
    },
    signOut: async () => { name = null; sessionStorage.removeItem(DEV_NAME_KEY); },
    hello: async () => ({ devId: devId(), name: name ?? '玩家' }),
  };
}

// Firebase 的錯誤代碼轉成中文
export function authErrorText(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-email': 'Email 格式不正確',
    'auth/missing-password': '請輸入密碼',
    'auth/weak-password': '密碼至少要 6 個字元',
    'auth/email-already-in-use': '這個 Email 已經註冊過了，請直接登入',
    'auth/invalid-credential': 'Email 或密碼不正確',
    'auth/user-not-found': 'Email 或密碼不正確',
    'auth/wrong-password': 'Email 或密碼不正確',
    'auth/too-many-requests': '嘗試次數太多，請稍後再試',
    'auth/popup-closed-by-user': '已取消 Google 登入',
    'auth/popup-blocked': '瀏覽器擋掉了登入視窗，請允許彈出視窗後再試',
    'auth/network-request-failed': '網路連線失敗，請檢查網路',
    'auth/operation-not-allowed': '這個登入方式還沒有在 Firebase 後台開啟',
    'auth/unauthorized-domain': '這個網址還沒有加入 Firebase 的授權網域',
  };
  return map[code] ?? (e instanceof Error ? e.message : '登入失敗');
}

async function createFirebaseAuth(): Promise<Auth> {
  const [{ initializeApp }, fa] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = initializeApp(FIREBASE!);
  const auth = fa.getAuth(app);
  const toUser = (u: { displayName: string | null; email: string | null }): AuthUser => ({ name: u.displayName || u.email?.split('@')[0] || '玩家' });
  return {
    kind: 'firebase',
    restore: () =>
      new Promise((resolve) => {
        const off = fa.onAuthStateChanged(auth, (u) => {
          off();
          resolve(u ? toUser(u) : null);
        });
      }),
    signInEmail: async (email, password) => toUser((await fa.signInWithEmailAndPassword(auth, email, password)).user),
    signUpEmail: async (email, password, name) => {
      const cred = await fa.createUserWithEmailAndPassword(auth, email, password);
      await fa.updateProfile(cred.user, { displayName: name.trim().slice(0, 16) });
      return toUser({ displayName: name.trim().slice(0, 16), email });
    },
    signInGoogle: async () => toUser((await fa.signInWithPopup(auth, new fa.GoogleAuthProvider())).user),
    signInDev: () => { throw new Error('已啟用 Firebase 登入'); },
    setName: async (name) => {
      if (!auth.currentUser) throw new Error('尚未登入');
      await fa.updateProfile(auth.currentUser, { displayName: name.trim().slice(0, 16) });
      return toUser({ displayName: name.trim().slice(0, 16), email: auth.currentUser.email });
    },
    signOut: () => fa.signOut(auth),
    hello: async () => ({ token: await auth.currentUser?.getIdToken(), name: auth.currentUser?.displayName ?? undefined }),
  };
}

export const createAuth = (): Promise<Auth> => (FIREBASE ? createFirebaseAuth() : Promise.resolve(createDevAuth()));

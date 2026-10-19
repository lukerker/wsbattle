// 前端設定。Firebase 的網頁設定不是機密（任何人打開網頁都看得到），放 .env.local 即可：
//   VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
//   VITE_SERVER_URL（對戰伺服器的網址，例如 wss://ws-sim.onrender.com；沒設就連同一台電腦的 8787 埠）
const env = import.meta.env as Record<string, string | undefined>;

export const FIREBASE = env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID
  ? {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? `${env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    }
  : null;

// 手機用區域網路連到這台電腦的網頁時，伺服器網址也要用同一個主機名稱
const host = window.location.hostname || 'localhost';
export const SERVER_WS = env.VITE_SERVER_URL ?? `ws://${host}:8787`;
export const SERVER_HTTP = SERVER_WS.replace(/^ws/, 'http');

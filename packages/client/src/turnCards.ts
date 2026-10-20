// 先攻／後攻卡面：玩家可以在「我的牌組」上傳自己的圖；開房的玩家的卡會用在那間房間的先後攻翻牌。
// 有 Firebase 時存在 Firestore 的 turnCards/<uid>（登入的人都能讀，只有本人能寫）；測試登入時存在這台電腦的瀏覽器。
import { FIREBASE } from './config.ts';

export interface TurnCards {
  first: string; // 圖片網址（上傳的是 data URL）
  last: string;
}
export const DEFAULT_TURN_CARDS: TurnCards = { first: '/card-img/system/first.jpg', last: '/card-img/system/last.jpg' };

const local = (uid: string) => FIREBASE === null || uid.startsWith('dev:');
const localKey = (uid: string) => `ws-turn-cards:${uid}`;

async function firestore() {
  const [{ getApps, initializeApp }, fs] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
  const app = getApps()[0] ?? initializeApp(FIREBASE!);
  return { fs, db: fs.getFirestore(app) };
}

// 讀某位玩家的卡面（沒上傳的那張用系統預設）
export async function loadTurnCards(uid: string | undefined): Promise<TurnCards> {
  if (!uid) return DEFAULT_TURN_CARDS;
  try {
    let data: Partial<TurnCards> = {};
    if (local(uid)) {
      data = JSON.parse(localStorage.getItem(localKey(uid)) ?? '{}') as Partial<TurnCards>;
    } else {
      const { fs, db } = await firestore();
      const snap = await fs.getDoc(fs.doc(db, 'turnCards', uid));
      data = (snap.data() ?? {}) as Partial<TurnCards>;
    }
    return { first: data.first || DEFAULT_TURN_CARDS.first, last: data.last || DEFAULT_TURN_CARDS.last };
  } catch {
    return DEFAULT_TURN_CARDS; // 讀不到（網路、權限）就用預設，不影響開局
  }
}

// 上傳或刪除（image＝null 恢復預設）
export async function saveTurnCard(uid: string, which: keyof TurnCards, image: string | null): Promise<void> {
  if (local(uid)) {
    const cur = JSON.parse(localStorage.getItem(localKey(uid)) ?? '{}') as Partial<TurnCards>;
    if (image) cur[which] = image;
    else delete cur[which];
    localStorage.setItem(localKey(uid), JSON.stringify(cur));
    return;
  }
  const { fs, db } = await firestore();
  await fs.setDoc(fs.doc(db, 'turnCards', uid), { [which]: image ?? fs.deleteField(), updatedAt: Date.now() }, { merge: true });
}

// 使用者選的圖片 → 裁成卡片比例（5:7，置中裁切）並縮到 500×700 的 JPEG
export async function fileToCardImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('讀不到這張圖片'));
      i.src = url;
    });
    const W = 500;
    const H = 700;
    const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const sw = W / scale;
    const sh = H / scale;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H);
    return canvas.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

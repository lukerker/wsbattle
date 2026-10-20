// 自己組的牌組：有 Firebase 時存在 Firestore 的 decks/<uid>/items/<deckId>（只有本人能讀寫）；
// 測試登入時存在這台電腦的瀏覽器。畫面共用同一份清單（useMyDecks）。
import { useEffect, useSyncExternalStore } from 'react';
import { mainSeries } from '@ws/engine';
import { FIREBASE } from './config.ts';
import { useNet } from './net.ts';

export interface SavedDeck {
  id: string;
  name: string;
  cards: string[]; // 卡號，可以少於 50 張
  updatedAt: number;
}

export const deckSeries = (d: { cards: string[] }) => mainSeries(d.cards);

interface Store {
  uid: string | null;
  decks: SavedDeck[];
  loaded: boolean;
  error: string | null;
}

let store: Store = { uid: null, decks: [], loaded: false, error: null };
const listeners = new Set<() => void>();
const set = (p: Partial<Store>) => {
  store = { ...store, ...p };
  for (const l of listeners) l();
};

const local = (uid: string) => FIREBASE === null || uid.startsWith('dev:');
const localKey = (uid: string) => `ws-decks:${uid}`;
const sorted = (list: SavedDeck[]) => [...list].sort((a, b) => b.updatedAt - a.updatedAt);

async function firestore() {
  const [{ getApps, initializeApp }, fs] = await Promise.all([import('firebase/app'), import('firebase/firestore')]);
  const app = getApps()[0] ?? initializeApp(FIREBASE!);
  return { fs, db: fs.getFirestore(app) };
}

async function load(uid: string) {
  set({ uid, decks: [], loaded: false, error: null });
  try {
    let list: SavedDeck[];
    if (local(uid)) {
      list = JSON.parse(localStorage.getItem(localKey(uid)) ?? '[]') as SavedDeck[];
    } else {
      const { fs, db } = await firestore();
      const snap = await fs.getDocs(fs.collection(db, 'decks', uid, 'items'));
      list = snap.docs.map((d) => ({ ...(d.data() as Omit<SavedDeck, 'id'>), id: d.id }));
    }
    if (store.uid === uid) set({ decks: sorted(list), loaded: true });
  } catch (e) {
    if (store.uid === uid) set({ loaded: true, error: `讀不到你的牌組：${e instanceof Error ? e.message : String(e)}` });
  }
}

const writeLocal = (uid: string, list: SavedDeck[]) => localStorage.setItem(localKey(uid), JSON.stringify(list));

export async function saveDeck(d: Omit<SavedDeck, 'id' | 'updatedAt'> & { id?: string }): Promise<SavedDeck> {
  const uid = store.uid;
  if (!uid) throw new Error('還沒連上伺服器，請稍等一下再存');
  const deck: SavedDeck = { id: d.id ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: d.name.trim().slice(0, 30) || '未命名牌組', cards: d.cards, updatedAt: Date.now() };
  const list = sorted([deck, ...store.decks.filter((x) => x.id !== deck.id)]);
  if (local(uid)) {
    writeLocal(uid, list);
  } else {
    const { fs, db } = await firestore();
    await fs.setDoc(fs.doc(db, 'decks', uid, 'items', deck.id), { name: deck.name, cards: deck.cards, updatedAt: deck.updatedAt });
  }
  set({ decks: list });
  return deck;
}

export async function deleteDeck(id: string): Promise<void> {
  const uid = store.uid;
  if (!uid) throw new Error('還沒連上伺服器');
  const list = store.decks.filter((x) => x.id !== id);
  if (local(uid)) {
    writeLocal(uid, list);
  } else {
    const { fs, db } = await firestore();
    await fs.deleteDoc(fs.doc(db, 'decks', uid, 'items', id));
  }
  set({ decks: list });
}

// 目前登入玩家的牌組（連上伺服器、知道是誰之後才會讀）
export function useMyDecks() {
  const { user } = useNet();
  const uid = user?.userId ?? null;
  useEffect(() => {
    if (uid && store.uid !== uid) void load(uid);
  }, [uid]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => store,
  );
}

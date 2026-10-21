// 音效：用 Web Audio 即時合成，不用音檔。音量與開關存在這台裝置（localStorage）。
// 瀏覽器要使用者先點過畫面才允許出聲，所以第一次點擊時才建立／喚醒 AudioContext。
import { useSyncExternalStore } from 'react';

export type SoundName = 'turn' | 'alert' | 'shuffle' | 'draw' | 'play' | 'land' | 'flip' | 'hit' | 'win' | 'lose';

interface Settings {
  volume: number; // 0～1
  muted: boolean;
}

const KEY = 'ws-sound';
let settings: Settings = { volume: 0.7, muted: false };
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
  if (saved) settings = { volume: typeof saved.volume === 'number' ? Math.min(1, Math.max(0, saved.volume)) : settings.volume, muted: !!saved.muted };
} catch {
  // 讀不到就用預設
}
const listeners = new Set<() => void>();

export function setSound(next: Partial<Settings>) {
  settings = { ...settings, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // 無痕模式等存不了：這次有效就好
  }
  if (master) master.gain.value = gainOf();
  listeners.forEach((l) => l());
}

export function useSound(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
  );
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const gainOf = () => (settings.muted ? 0 : settings.volume * settings.volume * 0.9); // 平方：滑桿低段比較好調

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = gainOf();
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

// 第一次點擊畫面：喚醒音效
if (typeof window !== 'undefined') {
  const unlock = () => {
    const a = audio();
    if (a && a.state === 'suspended') void a.resume();
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
}

// 清脆的鈴聲：正弦波＋高八度泛音，快速起音、慢慢衰減
function bell(a: AudioContext, at: number, freq: number, len: number, vol: number) {
  for (const [mul, v] of [[1, 1], [2, 0.35], [3.01, 0.12]] as const) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'sine';
    o.frequency.value = freq * mul;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol * v, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len / mul);
    o.connect(g).connect(master!);
    o.start(at);
    o.stop(at + len + 0.05);
  }
}

// 濾波後的白噪音：紙牌摩擦、翻動的聲音
function noise(a: AudioContext, at: number, len: number, vol: number, f: { type: BiquadFilterType; from: number; to?: number; q?: number }, attack = 0.005) {
  const src = a.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filter = a.createBiquadFilter();
  filter.type = f.type;
  filter.Q.value = f.q ?? 1;
  filter.frequency.setValueAtTime(f.from, at);
  if (f.to) filter.frequency.exponentialRampToValueAtTime(f.to, at + len);
  const g = a.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(filter).connect(g).connect(master!);
  src.start(at, Math.random() * 0.5);
  src.stop(at + len + 0.05);
}

function thump(a: AudioContext, at: number, freq: number, vol: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, at);
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, at + 0.12);
  g.gain.setValueAtTime(vol, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + 0.2);
}

export function play(name: SoundName) {
  if (settings.muted || settings.volume === 0) return;
  const a = audio();
  if (!a || !master || a.state !== 'running') return;
  const t = a.currentTime + 0.01;
  switch (name) {
    case 'turn': // 叮～
      bell(a, t, 1568, 1.6, 0.32);
      break;
    case 'alert': // 叮叮～
      bell(a, t, 1760, 0.35, 0.28);
      bell(a, t + 0.15, 1760, 0.9, 0.28);
      break;
    case 'shuffle': // 刷刷：兩輪快速的紙牌摩擦
      for (let r = 0; r < 2; r++) {
        for (let i = 0; i < 9; i++) noise(a, t + r * 0.55 + i * 0.038, 0.05, 0.22, { type: 'bandpass', from: 3200 + Math.random() * 1500, q: 0.9 });
        noise(a, t + r * 0.55 + 0.36, 0.12, 0.3, { type: 'bandpass', from: 1800, to: 900, q: 0.7 }); // 牌疊回去
      }
      break;
    case 'draw': // 抽牌：輕輕的刷一聲
      noise(a, t, 0.16, 0.22, { type: 'bandpass', from: 1600, to: 4200, q: 0.8 }, 0.04);
      break;
    case 'play': // 出牌：卡片從手上揮出
      noise(a, t, 0.32, 0.2, { type: 'bandpass', from: 900, to: 3800, q: 0.7 }, 0.12);
      bell(a, t + 0.18, 2349, 0.5, 0.06);
      break;
    case 'land': // 卡片放到場上：啪
      noise(a, t, 0.07, 0.4, { type: 'lowpass', from: 2400, q: 0.5 });
      thump(a, t, 160, 0.35);
      break;
    case 'flip': // 翻牌：清脆的翻動
      noise(a, t, 0.06, 0.32, { type: 'highpass', from: 2400, q: 0.6 });
      noise(a, t + 0.05, 0.09, 0.2, { type: 'bandpass', from: 1400, q: 1 });
      break;
    case 'hit': // 傷害進傷害區
      thump(a, t, 110, 0.45);
      noise(a, t, 0.1, 0.18, { type: 'lowpass', from: 900 });
      break;
    case 'win':
      [1047, 1319, 1568, 2093].forEach((f, i) => bell(a, t + i * 0.11, f, 1.4, 0.2));
      break;
    case 'lose':
      [784, 659, 523].forEach((f, i) => bell(a, t + i * 0.2, f, 1.2, 0.2));
      break;
  }
}

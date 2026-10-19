// 固定種子的亂數（mulberry32）。狀態存在 GameState.rng，同樣的種子與操作一定重現同樣的對局。

export function nextRandom(s: { rng: number }): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function shuffleInPlace<T>(s: { rng: number }, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

// 從官方卡表（ws-tcg.com）抓卡片的日文文字與數值，存到 data/cards/<KEY>.json（已有的卡會更新）。
// 卡片檔的日文原文以這份為準，cards-official.test.ts 會逐張比對。
// 用法：node scripts/fetch-cards.ts GBF-S134 001-132 P01 P02EX P03S
//   範圍「001-132」照位數補零；卡號後面的稀有度字尾（P02EX 的 EX）存檔時拿掉，變成 GBF/S134-P02。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const [key, ...specs] = process.argv.slice(2);
if (!key || !specs.length) {
  console.error('用法：node scripts/fetch-cards.ts GBF-S134 001-132 P01 P02EX');
  process.exit(1);
}
const prefix = key.replace('-', '/'); // GBF-S134 → GBF/S134
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const nos: string[] = [];
for (const sp of specs) {
  const m = sp.match(/^([A-Z]*)(\d+)-([A-Z]*)(\d+)$/);
  if (!m) {
    nos.push(sp);
    continue;
  }
  for (let i = Number(m[2]); i <= Number(m[4]); i++) nos.push(`${m[1]}${String(i).padStart(m[2]!.length, '0')}`);
}

interface OfficialCard {
  id: string; // 本專案用的卡號（去掉稀有度字尾）
  officialId: string;
  name: string;
  type: 'character' | 'event' | 'climax';
  color: string;
  level?: number;
  cost?: number;
  power?: number;
  soul?: number;
  triggers: string[]; // 判定圖示（本專案的名稱）
  traits: string[];
  text: string[]; // 一行一段，已整理成卡片檔的寫法（見 normalize）
  rare: string;
}

const ICON: Record<string, string> = { salvage: 'カムバック', gate: 'ゲート', treasure: 'トレジャー', choice: 'チョイス', draw: 'ドロー', soul: 'ソウル', bounce: 'リターン', stock: 'プール', shot: 'ショット', standby: 'スタンバイ' };
const TRIGGER: Record<string, string> = { salvage: 'comeback', soul: 'soul', gate: 'gate', treasure: 'treasure', choice: 'choice', draw: 'draw', bounce: 'return', stock: 'pool', shot: 'shot', standby: 'standby' };
const COLOR: Record<string, string> = { red: 'red', blue: 'blue', yellow: 'yellow', green: 'green', purple: 'purple' };
const CIRCLED = '⓪①②③④⑤⑥⑦⑧⑨';

const decode = (s: string) => s.replace(/&hearts;/g, '♥').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
// 官方文字 → 卡片檔的寫法：拿掉括號旁的半形空白、(1) 寫成 ①、判定圖示寫成【カムバック】等
const normalize = (line: string) => decode(line)
  .replace(/\[\[(\w+)\.gif\]\]|\[(\w+)\]/g, (_, a: string, b: string) => `【${ICON[a ?? b] ?? a ?? b}】`)
  .replace(/\((\d)\)/g, (_, d: string) => CIRCLED[Number(d)]!)
  .replace(/ +(?=[［（【「])|(?<=[】］）」]) +/g, '')
  .trim();

const file = `data/cards/${key}.json`;
const list: OfficialCard[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : [];
const icons = (x: string | null) => [...(x ?? '').matchAll(/\[\[(\w+)\.gif\]\]/g)].map((m) => m[1]!);
const num = (x: string) => (x === '-' || x === '' ? undefined : Number(x));

for (const no of nos) {
  const officialId = `${prefix}-${no}`;
  const r = await fetch(`https://ws-tcg.com/manage/CardListUser/detailByNoJson?card_number=${encodeURIComponent(officialId)}`, { headers: { 'User-Agent': UA } });
  const c = (await r.json()).card;
  await new Promise((ok) => setTimeout(ok, 400));
  if (!c) {
    console.log(`${officialId}：官方卡表沒有這張`);
    continue;
  }
  const type = ({ 2: 'character', 3: 'event', 4: 'climax' } as const)[Number(c.card_kind) as 2 | 3 | 4];
  const card: OfficialCard = {
    id: `${prefix}-${no.replace(/^([A-Z]?\d+)[A-Z]+$/, '$1')}`,
    officialId,
    name: decode(c.card_name),
    type,
    color: COLOR[icons(c.color)[0] ?? ''] ?? 'colorless',
    ...(type !== 'climax' ? { level: num(c.level), cost: num(c.cost) } : {}),
    ...(type === 'character' ? { power: num(c.power), soul: icons(c.soul).length } : {}),
    triggers: icons(c.card_trigger).map((i) => TRIGGER[i] ?? i),
    traits: [c.feature1, c.feature2, c.feature3].filter((x: string) => x && x !== '-' && x !== '特徴なし').map(decode),
    text: (c.text ?? '').split(/<br\s*\/?>|\n/).map(normalize).filter((x: string) => x && x !== '-'),
    rare: c.rare,
  };
  const i = list.findIndex((x) => x.officialId === officialId);
  if (i >= 0) list[i] = card;
  else list.push(card);
  console.log(officialId, card.name);
}

list.sort((a, b) => a.officialId.localeCompare(b.officialId));
mkdirSync('data/cards', { recursive: true });
writeFileSync(file, `${JSON.stringify(list, null, 1)}\n`, 'utf-8');
console.log(`${file}：${list.length} 張`);

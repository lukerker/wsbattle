// 產生「原文／中文／程式化結果」三欄對照表，供使用者核對。
// 用法：node scripts/build-review.ts BTR-W107
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Card } from '../packages/engine/src/card-schema.ts';

const key = process.argv[2] ?? 'BTR-W107';
const mod = await import(`../packages/engine/src/cards/${key.toLowerCase()}.ts`);
const cards: Card[] = mod.cards;
const deck: { cardId: string; count: number }[] = mod.deck;
const source: string = mod.source ?? '讀圖'; // 日文原文的來源
const count = new Map(deck.map((d) => [d.cardId, d.count]));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colorName: Record<string, string> = { yellow: '黃', red: '紅', blue: '藍', green: '綠', purple: '紫', colorless: '無' };
const typeName: Record<string, string> = { character: '角色', event: '事件', climax: '名場面' };

const rows = cards.map((c) => {
  const head = [
    colorName[c.color], typeName[c.type],
    c.level !== undefined ? `Lv${c.level}` : '', c.cost !== undefined ? `費用${c.cost}` : '',
    c.power !== undefined ? `攻擊${c.power}` : '', c.soul !== undefined ? `魂傷${c.soul}` : '',
    c.triggers.length ? `判定：${c.triggers.join('+')}` : '',
  ].filter(Boolean).join('｜');
  const traits = c.traits.map((t) => `${t.zh}(${t.ja})`).join('、');
  const abilities = c.abilities.length ? c.abilities : [];
  const body = abilities.length
    ? abilities.map((a) => `<tr><td>${esc(a.text.ja)}</td><td>${esc(a.text.zh)}</td><td><pre>${esc(JSON.stringify({ ...a, text: undefined, review: undefined }, null, 1))}</pre>${a.review?.map((r) => `<p class="warn">⚠ ${esc(r)}</p>`).join('') ?? ''}</td></tr>`).join('')
    : '<tr><td colspan="3">（無效果，純數值）</td></tr>';
  return `<section><h2>${esc(c.id)}　${esc(c.name.zh)} <small>${esc(c.name.ja)}</small> ×${count.get(c.id) ?? 0}</h2>
<p>${esc(head)}${traits ? `｜特徵：${esc(traits)}` : ''}</p>
<table><tr><th>日文原文（${source}）</th><th>繁體中文</th><th>程式化結果</th></tr>${body}</table>
${c.playCondition ? `<p>出牌條件：<code>${esc(JSON.stringify(c.playCondition))}</code></p>` : ''}
${c.note ? `<p class="note">白話：${esc(c.note)}</p>` : ''}</section>`;
}).join('\n');

const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>${key} 核對表</title>
<style>body{font:14px/1.6 system-ui,sans-serif;max-width:1200px;margin:2rem auto;padding:0 1rem}
section{border-top:2px solid #ccc;margin-top:1.5rem}table{border-collapse:collapse;width:100%}
td,th{border:1px solid #ccc;padding:6px;vertical-align:top;width:33%}pre{margin:0;white-space:pre-wrap;font-size:11px}
.warn{color:#b45309;margin:4px 0}.note{color:#555}small{color:#888;font-weight:normal}</style>
<h1>${key} 預組核對表</h1><p>請逐張核對：日文是否讀對、中文是否通順、程式化結果是否和原文一致。有 ⚠ 的是我不確定的地方。</p>
${rows}</html>`;

mkdirSync('docs/review', { recursive: true });
writeFileSync(`docs/review/${key}.html`, html, 'utf-8');
console.log(`docs/review/${key}.html`, cards.length, '張');

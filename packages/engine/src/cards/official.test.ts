// 卡片檔對照官方卡表（data/cards/*.json，由 scripts/fetch-cards.ts 抓下來）：卡名、數值、判定、特徵、日文原文都要一字不差。
// 官方卡表有、但卡片檔沒有的卡，必須是同一張卡的另一個卡號（duplicates），而且文字完全相同。
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_CARDS, DUPLICATES } from './index.ts';

interface Official {
  id: string;
  officialId: string;
  rare: string;
  name: string;
  type: string;
  color: string;
  level?: number;
  cost?: number;
  power?: number;
  soul?: number;
  triggers: string[];
  traits: string[];
  text: string[];
}

const dir = new URL('../../../../data/cards/', import.meta.url);
const byId = new Map(ALL_CARDS.map((c) => [c.id, c]));

for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const list: Official[] = JSON.parse(readFileSync(new URL(f, dir), 'utf-8'));
  const official = new Map(list.map((o) => [o.id, o]));
  describe(`官方卡表 ${f}`, () => {
    for (const o of list) {
      it(`${o.id} ${o.name}`, () => {
        const dup = DUPLICATES[o.id];
        if (dup) {
          const orig = official.get(dup)!;
          expect(byId.has(o.id), '重複的卡不另外建資料').toBe(false);
          expect({ ...o, id: dup }).toMatchObject({ ...orig, officialId: o.officialId, rare: o.rare });
          return;
        }
        const c = byId.get(o.id);
        expect(c, '卡片檔裡沒有這張卡').toBeDefined();
        expect(c!.name.ja).toBe(o.name);
        expect({ type: c!.type, color: c!.color, level: c!.level, cost: c!.cost, power: c!.power, soul: c!.soul })
          .toEqual({ type: o.type, color: o.color, level: o.level, cost: o.cost, power: o.power, soul: o.soul });
        expect([...c!.triggers].sort()).toEqual([...o.triggers].sort());
        expect(c!.traits.map((x) => x.ja)).toEqual(o.traits);
        expect(c!.abilities.map((a) => a.text.ja).join('')).toBe(o.text.join(''));
      });
    }
  });
}

describe('卡片效果指定的卡名', () => {
  it('每個指定的卡名都對得到真的存在的卡', () => {
    const names = new Set(ALL_CARDS.map((c) => c.name.ja));
    for (const c of ALL_CARDS) {
      const json = JSON.stringify([c.abilities, c.playCondition, c.sameNameAs]);
      for (const m of json.matchAll(/"(?:name|targetName|climaxName)":"([^"]+)"/g)) expect(names.has(m[1]!), `${c.id}：${m[1]}`).toBe(true);
      for (const m of json.matchAll(/"names":\[([^\]]*)\]/g)) for (const n of JSON.parse(`[${m[1]}]`) as string[]) expect(names.has(n), `${c.id}：${n}`).toBe(true);
    }
  });
});

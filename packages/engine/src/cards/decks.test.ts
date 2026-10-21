import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Card } from '../card-schema.ts';
import * as btr from './btr-w107.ts';
import * as bd from './bd-w125.ts';
import * as gcr from './gcr-se48.ts';
import * as gbf from './gbf-s134.ts';
import * as lrc from './lrc-w105.ts';
import * as ft from './ft-s09.ts';
import * as cs from './cs-s114.ts';

const decks: Record<string, { cards: Card[]; deck: { cardId: string; count: number }[]; csv: string }> = {
  'BTR/W107 孤獨搖滾': { ...btr, csv: 'BTR-W107' },
  'BD/W125 Ave Mujica': { ...bd, csv: 'BD-W125' },
  'GCR/SE48 Girls Band Cry': { ...gcr, csv: 'GCR-SE48' },
  'GBF/S134 碧藍幻想': { ...gbf, csv: 'GBF-S134' },
  'LRC/W105 莉可麗絲': { ...lrc, csv: 'LRC-W105' },
  'FT/S09 FAIRY TAIL': { ...ft, csv: 'FT-S09' },
  'CS/S114 蠟筆小新': { ...cs, csv: 'CS-S114' },
};

for (const [label, { cards, deck, csv }] of Object.entries(decks)) {
  const byId = new Map(cards.map((c) => [c.id, c]));

  describe(`${label} 預組牌表`, () => {
    it('卡號唯一，且預組裡每張卡都有資料', () => {
      expect(byId.size).toBe(cards.length);
      for (const { cardId } of deck) expect(byId.has(cardId), cardId).toBe(true);
    });

    it('合計剛好 50 張', () => {
      expect(deck.reduce((n, d) => n + d.count, 0)).toBe(50);
    });

    it('與 data/decks 的 CSV（由檔名張數產生）一致', () => {
      const rows = readFileSync(new URL(`../../../../data/decks/${csv}.csv`, import.meta.url), 'utf-8')
        .replace(/^﻿/, '').trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
      expect(rows.map((r) => ({ cardId: r[2], count: Number(r[3]) }))).toEqual(deck);
    });

    it('同名卡不超過 4 張', () => {
      const byName = new Map<string, number>();
      for (const { cardId, count } of deck) {
        const name = byId.get(cardId)!.name.ja;
        byName.set(name, (byName.get(name) ?? 0) + count);
      }
      for (const [name, n] of byName) expect(n, name).toBeLessThanOrEqual(4);
    });

    it('名場面（CX）不超過 8 張', () => {
      const climax = deck.filter((d) => byId.get(d.cardId)!.type === 'climax').reduce((n, d) => n + d.count, 0);
      expect(climax).toBeLessThanOrEqual(8);
    });

    it('角色卡有等級、費用、攻擊與魂傷', () => {
      for (const c of cards.filter((c) => c.type === 'character')) {
        for (const k of ['level', 'cost', 'power', 'soul'] as const) expect(c[k], `${c.id}.${k}`).toBeTypeOf('number');
      }
    });

    it('指定卡名的效果，其卡名都對得到預組裡真的存在的卡', () => {
      const names = new Set(cards.map((c) => c.name.ja));
      const json = JSON.stringify(cards.map((c) => c.abilities));
      for (const m of json.matchAll(/"(?:name|targetName)":"([^"]+)"/g)) expect(names.has(m[1]!), m[1]).toBe(true);
    });
  });
}

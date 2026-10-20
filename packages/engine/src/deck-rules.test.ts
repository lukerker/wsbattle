import { describe, expect, it } from 'vitest';
import { addProblem, deckSummary, mainSeries } from './deck-rules.ts';
import { db, LRC_DECK } from './game/test-utils.ts';

const C = (n: string) => `LRC/W105-${n}`;

describe('構築規則（組牌器與伺服器共用）', () => {
  it('預組：50 張、可以對戰', () => {
    expect(deckSummary(db, LRC_DECK)).toMatchObject({ total: 50, climax: 8, incomplete: 0, invalid: null, notReady: null });
  });

  it('少於 50 張可以存，但還不能對戰', () => {
    const s = deckSummary(db, LRC_DECK.slice(0, 44));
    expect(s.invalid).toBeNull();
    expect(s.notReady).toBe('還差 6 張');
  });

  it('超過上限就不能存：51 張、同名 5 張、名場面 9 張', () => {
    expect(deckSummary(db, [...LRC_DECK, C('T06')]).invalid).toMatch('最多 50 張');
    expect(deckSummary(db, Array(5).fill(C('T06'))).invalid).toMatch('同名的卡最多 4 張');
    const cx = [...Array(4).fill(C('T10')), ...Array(4).fill(C('T19')), C('T20')];
    expect(deckSummary(db, cx).invalid).toMatch('名場面最多 8 張');
  });

  it('加卡前檢查：滿 50 張、同名第 5 張、第 9 張名場面都不能加', () => {
    expect(addProblem(db, LRC_DECK, C('T06'))).toMatch('50 張');
    expect(addProblem(db, Array(4).fill(C('T06')), C('T06'))).toMatch('同名');
    expect(addProblem(db, Array(3).fill(C('T06')), C('T06'))).toBeNull();
    const cx8 = [...Array(4).fill(C('T10')), ...Array(4).fill(C('T19'))];
    expect(addProblem(db, cx8, C('T20'))).toMatch('名場面最多 8 張');
    expect(addProblem(db, cx8, C('T06'))).toBeNull();
    expect(addProblem(db, [], 'XXX/000')).toMatch('找不到');
  });

  it('主要系列：張數最多的系列', () => {
    expect(mainSeries(LRC_DECK)).toBe('LRC');
    expect(mainSeries(['BTR/W107-T01', ...LRC_DECK.slice(0, 3)])).toBe('LRC');
  });
});

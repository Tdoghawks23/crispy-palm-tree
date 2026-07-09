import { describe, expect, it } from 'vitest';
import { parseRepRangeMax, parseTargetRIR, suggestProgression } from '../progression';

describe('progression (R10)', () => {
  it('no history: falls back to rep-range/RIR guidance, never a fabricated number', () => {
    const result = suggestProgression({
      repRangeMax: 15,
      targetRIR: '1–2',
      mostRecentSets: [],
    });
    expect(result.kind).toBe('no-history');
    expect(result.message).toMatch(/RIR 1–2/);
    expect(result.message).not.toMatch(/\d+\s*lb/);
  });

  it('hit top of rep range on every set: suggests a weight increase', () => {
    const result = suggestProgression({
      repRangeMax: 15,
      targetRIR: '1–2',
      mostRecentSets: [
        { weight: 30, reps: 15 },
        { weight: 30, reps: 15 },
        { weight: 30, reps: 16 },
      ],
    });
    expect(result.kind).toBe('increase-weight');
    if (result.kind === 'increase-weight') {
      expect(result.suggestedWeight).toBe(35);
    }
  });

  it('uses a smaller 2.5 lb increment for light loads under 20 lb', () => {
    const result = suggestProgression({
      repRangeMax: 15,
      targetRIR: '1–2',
      mostRecentSets: [{ weight: 15, reps: 15 }],
    });
    expect(result.kind).toBe('increase-weight');
    if (result.kind === 'increase-weight') {
      expect(result.suggestedWeight).toBe(17.5);
    }
  });

  it('did not hit top of rep range: suggests +1 rep at the same weight', () => {
    const result = suggestProgression({
      repRangeMax: 15,
      targetRIR: '1–2',
      mostRecentSets: [
        { weight: 30, reps: 10 },
        { weight: 30, reps: 9 },
        { weight: 30, reps: 8 },
      ],
    });
    expect(result.kind).toBe('increase-reps');
    if (result.kind === 'increase-reps') {
      expect(result.suggestedReps).toBe(9);
      expect(result.weight).toBe(30);
    }
  });

  describe('bodyweight exercises (QA should-fix 2)', () => {
    it('no history: guidance omits weight language', () => {
      const result = suggestProgression({
        repRangeMax: 20,
        targetRIR: '1–2',
        mostRecentSets: [],
        bodyweight: true,
      });
      expect(result.kind).toBe('no-history');
      expect(result.message).not.toMatch(/weight/i);
      expect(result.message).not.toMatch(/\d+\s*lb/);
    });

    it('hit top of rep range: suggests the harder variation, not a weight bump', () => {
      const result = suggestProgression({
        repRangeMax: 20,
        targetRIR: '1–2',
        mostRecentSets: [{ weight: 0, reps: 20 }],
        bodyweight: true,
        progressionCue: 'elevate feet if 20 reps easy',
      });
      expect(result.kind).toBe('increase-difficulty');
      if (result.kind === 'increase-difficulty') {
        expect(result.message).toMatch(/harder variation/);
        expect(result.message).toMatch(/elevate feet if 20 reps easy/);
      }
      expect(result.message).not.toMatch(/\d+\.?\d*\s*lb/);
    });

    it('hit top of rep range without a progression cue: still suggests harder variation generically', () => {
      const result = suggestProgression({
        repRangeMax: 20,
        targetRIR: '1–2',
        mostRecentSets: [{ weight: 0, reps: 20 }],
        bodyweight: true,
      });
      expect(result.kind).toBe('increase-difficulty');
      if (result.kind === 'increase-difficulty') {
        expect(result.message).toMatch(/harder variation/);
      }
    });

    it('did not hit top of range with no added weight logged: suggests +1 rep, omits weight', () => {
      const result = suggestProgression({
        repRangeMax: 20,
        targetRIR: '1–2',
        mostRecentSets: [{ weight: 0, reps: 15 }],
        bodyweight: true,
      });
      expect(result.kind).toBe('increase-reps');
      if (result.kind === 'increase-reps') {
        expect(result.suggestedReps).toBe(16);
        expect(result.message).not.toMatch(/weight/i);
      }
    });

    it('did not hit top of range but added weight was logged: still mentions the added weight', () => {
      const result = suggestProgression({
        repRangeMax: 20,
        targetRIR: '1–2',
        mostRecentSets: [{ weight: 10, reps: 15 }],
        bodyweight: true,
      });
      expect(result.kind).toBe('increase-reps');
      if (result.kind === 'increase-reps') {
        expect(result.message).toMatch(/10 lb/);
      }
    });
  });

  describe('parseRepRangeMax', () => {
    it('parses the top of a standard rep range', () => {
      expect(parseRepRangeMax('8–15 reps @ RIR 1–2')).toBe(15);
    });

    it('parses ranges with trailing annotations', () => {
      expect(parseRepRangeMax('10–20 reps @ RIR 1–2 (last set)')).toBe(20);
    });

    it('returns undefined for non-rep prescriptions like timed holds', () => {
      expect(parseRepRangeMax('30–45s holds @ RIR 1–2')).toBeUndefined();
    });
  });

  describe('parseTargetRIR', () => {
    it('parses the RIR target out of a reps string', () => {
      expect(parseTargetRIR('8–15 reps @ RIR 1–2')).toBe('1–2');
    });

    it('parses RIR with trailing annotations', () => {
      expect(parseTargetRIR('10–20 reps @ RIR 1–2 (last set)')).toBe('1–2');
    });

    it('returns undefined when no RIR is present', () => {
      expect(parseTargetRIR('12–20 reps each (superset)')).toBeUndefined();
    });
  });
});

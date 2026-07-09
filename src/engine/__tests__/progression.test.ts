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

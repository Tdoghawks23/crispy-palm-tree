import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WARMUP_STEPS } from '../warmup';

describe('warmup (R5 — verbatim from source)', () => {
  it('matches docs/source/program_full.json warmup array exactly', () => {
    const sourcePath = path.join(__dirname, '..', '..', '..', 'docs', 'source', 'program_full.json');
    const source = JSON.parse(readFileSync(sourcePath, 'utf-8'));
    expect(WARMUP_STEPS).toEqual(source.warmup);
  });

  it('has all 4 components', () => {
    expect(WARMUP_STEPS.map((s) => s.component)).toEqual([
      'General warm-up',
      'Elbow-health circuit',
      'Ramp sets',
      'Optional blood-flow',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  getCategoryCount,
  getTopCandidates,
  isNameSweepCategory,
  isPronounceable,
  iterateCandidates,
} from '../src/modules/namesweep/generator.js';

describe('name-sweep generator', () => {
  it('recognizes every supported category', () => {
    expect(isNameSweepCategory('3c')).toBe(true);
    expect(isNameSweepCategory('3l')).toBe(true);
    expect(isNameSweepCategory('3lp')).toBe(true);
    expect(isNameSweepCategory('4c')).toBe(true);
    expect(isNameSweepCategory('4l')).toBe(true);
    expect(isNameSweepCategory('4lp')).toBe(true);
    expect(isNameSweepCategory('5l')).toBe(false);
  });

  it('reports the complete raw candidate counts', () => {
    expect(getCategoryCount('3c')).toBe(46_656);
    expect(getCategoryCount('3l')).toBe(17_576);
    expect(getCategoryCount('3lp')).toBe(2_730);
    expect(getCategoryCount('4c')).toBe(1_679_616);
    expect(getCategoryCount('4l')).toBe(456_976);
    expect(getCategoryCount('4lp')).toBe(79_380);
  });

  it('generates every 3-letter pronounceable candidate', () => {
    const candidates = [...iterateCandidates('3lp')];

    expect(candidates).toHaveLength(2_730);
    expect(candidates.every((candidate) => candidate.pronounceable)).toBe(true);
    expect(candidates.every((candidate) => isPronounceable(candidate.name))).toBe(true);
  });

  it('keeps output inside the requested category', () => {
    const candidates = [...iterateCandidates('3l')].slice(0, 100);

    expect(candidates.every((candidate) => /^[a-z]{3}$/.test(candidate.name))).toBe(true);
  });

  it('returns ranked candidates without duplicates', () => {
    const candidates = getTopCandidates('3lp', 50);
    const names = candidates.map((candidate) => candidate.name);

    expect(candidates).toHaveLength(50);
    expect(new Set(names).size).toBe(50);
    expect(candidates.every((candidate) => candidate.pronounceable)).toBe(true);

    for (let index = 1; index < candidates.length; index += 1) {
      expect(candidates[index - 1]!.score).toBeGreaterThanOrEqual(candidates[index]!.score);
    }
  });
});

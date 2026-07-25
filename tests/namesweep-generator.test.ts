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
    for (const category of [
      '2c',
      '2l',
      '2lp',
      '2n',
      '3c',
      '3l',
      '3lp',
      '3n',
      '4c',
      '4l',
      '4lp',
      '4n',
    ]) {
      expect(isNameSweepCategory(category)).toBe(true);
    }

    expect(isNameSweepCategory('5l')).toBe(false);
  });

  it('reports the complete raw candidate counts', () => {
    expect(getCategoryCount('2c')).toBe(1_296);
    expect(getCategoryCount('2l')).toBe(676);
    expect(getCategoryCount('2lp')).toBe(210);
    expect(getCategoryCount('2n')).toBe(100);
    expect(getCategoryCount('3c')).toBe(46_656);
    expect(getCategoryCount('3l')).toBe(17_576);
    expect(getCategoryCount('3lp')).toBe(2_730);
    expect(getCategoryCount('3n')).toBe(1_000);
    expect(getCategoryCount('4c')).toBe(1_679_616);
    expect(getCategoryCount('4l')).toBe(456_976);
    expect(getCategoryCount('4lp')).toBe(79_380);
    expect(getCategoryCount('4n')).toBe(10_000);
  });

  it('generates every 2-letter pronounceable candidate', () => {
    const candidates = [...iterateCandidates('2lp')];

    expect(candidates).toHaveLength(210);
    expect(candidates.every((candidate) => candidate.pronounceable)).toBe(true);
    expect(candidates.every((candidate) => isPronounceable(candidate.name))).toBe(true);
  });

  it('generates numeric names with leading zeros', () => {
    const candidates = [...iterateCandidates('2n')];

    expect(candidates).toHaveLength(100);
    expect(candidates.some((candidate) => candidate.name === '00')).toBe(true);
    expect(candidates.some((candidate) => candidate.name === '99')).toBe(true);
    expect(candidates.every((candidate) => /^\d{2}$/.test(candidate.name))).toBe(true);
  });

  it('keeps output inside the requested category', () => {
    const candidates = [...iterateCandidates('3l')].slice(0, 100);

    expect(candidates.every((candidate) => /^[a-z]{3}$/.test(candidate.name))).toBe(true);
  });

  it('caps ranked output at one thousand candidates', () => {
    const candidates = getTopCandidates('4n', 5_000);

    expect(candidates).toHaveLength(1_000);
  });

  it('returns ranked estimates without duplicates', () => {
    const candidates = getTopCandidates('3lp', 100);
    const names = candidates.map((candidate) => candidate.name);

    expect(candidates).toHaveLength(100);
    expect(new Set(names).size).toBe(100);
    expect(candidates.every((candidate) => candidate.pronounceable)).toBe(true);
    expect(
      candidates.every(
        (candidate) => candidate.score >= 1 && candidate.score <= 99,
      ),
    ).toBe(true);

    for (let index = 1; index < candidates.length; index += 1) {
      expect(candidates[index - 1]!.score).toBeGreaterThanOrEqual(
        candidates[index]!.score,
      );
    }
  });
});
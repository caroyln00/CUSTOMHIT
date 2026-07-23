import { describe, expect, it } from 'vitest';
import { chooseUnique, cleanRecreationText, formatDuration, parseDuration } from '../src/modules/recreation/utils.js';

describe('recreation utilities', () => {
  it('parses bounded durations', () => {
    expect(parseDuration('30m')).toBe(30 * 60_000);
    expect(parseDuration('2h')).toBe(2 * 60 * 60_000);
    expect(parseDuration('3d')).toBe(3 * 24 * 60 * 60_000);
    expect(parseDuration('1w')).toBe(7 * 24 * 60 * 60_000);
    expect(() => parseDuration('soon')).toThrow();
    expect(() => parseDuration('31d')).toThrow();
  });

  it('formats common durations', () => {
    expect(formatDuration(60_000)).toBe('1m');
    expect(formatDuration(2 * 60 * 60_000)).toBe('2h');
    expect(formatDuration(3 * 24 * 60 * 60_000)).toBe('3d');
    expect(formatDuration(14 * 24 * 60 * 60_000)).toBe('2w');
  });

  it('chooses unique bounded values', () => {
    expect(chooseUnique(['a', 'b', 'c'], 2, () => 0)).toEqual(['b', 'c']);
    expect(new Set(chooseUnique(['a', 'b', 'c'], 10, () => 0.5)).size).toBe(3);
    expect(chooseUnique(['a'], 0)).toEqual([]);
  });

  it('cleans recreation text', () => {
    expect(cleanRecreationText('  hello\n  world  ', 100)).toBe('hello world');
    expect(cleanRecreationText('abcdef', 3)).toBe('abc');
  });
});

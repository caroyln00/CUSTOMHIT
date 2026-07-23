import { describe, expect, it } from 'vitest';
import { parseDuration } from '../src/modules/moderation/duration.js';

describe('moderation duration parser', () => {
  it('accepts supported units', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('10m')).toBe(600_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('3d')).toBe(259_200_000);
    expect(parseDuration('1w')).toBe(604_800_000);
  });

  it('rejects invalid or over-limit values', () => {
    expect(parseDuration('0m')).toBeNull();
    expect(parseDuration('29d')).toBeNull();
    expect(parseDuration('forever')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  NAME_CHECK_EXTERNAL_PLATFORMS,
  NAME_CHECK_PLATFORMS,
  isNameCheckPlatform,
} from '../src/modules/namesweep/platforms.js';

describe('custom name-check platforms', () => {
  it('fits inside the Discord slash-command choice limit', () => {
    expect(NAME_CHECK_PLATFORMS.length).toBeLessThanOrEqual(25);
  });

  it('recognizes every configured platform', () => {
    for (const platform of NAME_CHECK_PLATFORMS) {
      expect(isNameCheckPlatform(platform)).toBe(true);
    }

    expect(isNameCheckPlatform('not-a-platform')).toBe(false);
  });

  it('includes requested gaming and developer platforms', () => {
    expect(NAME_CHECK_PLATFORMS).toContain('xbox');
    expect(NAME_CHECK_PLATFORMS).toContain('playstation');
    expect(NAME_CHECK_PLATFORMS).toContain('github');
    expect(NAME_CHECK_PLATFORMS).toContain('reddit');
    expect(NAME_CHECK_PLATFORMS).toContain('roblox');
  });

  it('does not duplicate external platforms', () => {
    expect(new Set(NAME_CHECK_EXTERNAL_PLATFORMS).size)
      .toBe(NAME_CHECK_EXTERNAL_PLATFORMS.length);
  });
});
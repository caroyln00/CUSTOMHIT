import { describe, expect, it } from 'vitest';
import {
  isMeaningfulMessage,
  levelUpBonus,
  MAX_LEVEL,
  levelFromXp,
  levelProgress,
  progressBar,
  randomXp,
  xpForLevel,
} from '../src/modules/levels/utils.js';

describe('levels utilities', () => {
  it('calculates total XP thresholds and levels', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(1)).toBe(10);
    expect(xpForLevel(5)).toBe(250);
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(9)).toBe(0);
    expect(levelFromXp(10)).toBe(1);
    expect(levelFromXp(39)).toBe(1);
    expect(levelFromXp(40)).toBe(2);
    expect(levelFromXp(Number.MAX_SAFE_INTEGER)).toBe(MAX_LEVEL);
  });

  it('returns level-local progress', () => {
    const progress = levelProgress(25);
    expect(progress.level).toBe(1);
    expect(progress.currentLevelXp).toBe(10);
    expect(progress.nextLevelXp).toBe(40);
    expect(progress.progressXp).toBe(15);
    expect(progress.requiredXp).toBe(30);
    expect(progress.ratio).toBe(0.5);
  });

  it('calculates cumulative level-up bonus XP', () => {
    expect(levelUpBonus(0, 1)).toBe(7);
    expect(levelUpBonus(1, 3)).toBe(20);
    expect(levelUpBonus(50, 50)).toBe(0);
  });

  it('renders bounded text progress bars', () => {
    expect(progressBar(0.5, 10)).toBe('[#####-----]');
    expect(progressBar(-1, 4)).toBe('[----]');
    expect(progressBar(2, 4)).toBe('[####]');
  });

  it('awards inclusive random XP ranges', () => {
    expect(randomXp(15, 25, () => 0)).toBe(15);
    expect(randomXp(15, 25, () => 0.999999)).toBe(25);
    expect(randomXp(25, 15, () => 0)).toBe(15);
  });

  it('rejects empty, link-only, and tiny messages', () => {
    expect(isMeaningfulMessage('hello')).toBe(true);
    expect(isMeaningfulMessage('a1b')).toBe(true);
    expect(isMeaningfulMessage('ok')).toBe(false);
    expect(isMeaningfulMessage('https://example.com')).toBe(false);
    expect(isMeaningfulMessage('   ')).toBe(false);
  });
});

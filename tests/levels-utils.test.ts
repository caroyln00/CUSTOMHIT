import { describe, expect, it } from 'vitest';
import {
  isMeaningfulMessage,
  levelFromXp,
  levelProgress,
  progressBar,
  randomXp,
  xpForLevel,
} from '../src/modules/levels/utils.js';

describe('levels utilities', () => {
  it('calculates total XP thresholds and levels', () => {
    expect(xpForLevel(0)).toBe(0);
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(5)).toBe(2500);
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(99)).toBe(0);
    expect(levelFromXp(100)).toBe(1);
    expect(levelFromXp(399)).toBe(1);
    expect(levelFromXp(400)).toBe(2);
  });

  it('returns level-local progress', () => {
    const progress = levelProgress(250);
    expect(progress.level).toBe(1);
    expect(progress.currentLevelXp).toBe(100);
    expect(progress.nextLevelXp).toBe(400);
    expect(progress.progressXp).toBe(150);
    expect(progress.requiredXp).toBe(300);
    expect(progress.ratio).toBe(0.5);
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

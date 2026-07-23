export const MAX_LEVEL = 500;

export function xpForLevel(level: number): number {
  const safeLevel = Math.max(0, Math.min(MAX_LEVEL, Math.trunc(level)));
  return 100 * safeLevel * safeLevel;
}

export function levelFromXp(xp: number): number {
  const safeXp = Math.max(0, Math.trunc(xp));
  return Math.min(MAX_LEVEL, Math.floor(Math.sqrt(safeXp / 100)));
}

export interface LevelProgress {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progressXp: number;
  requiredXp: number;
  ratio: number;
}

export function levelProgress(xp: number): LevelProgress {
  const safeXp = Math.max(0, Math.trunc(xp));
  const level = levelFromXp(safeXp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = level >= MAX_LEVEL ? currentLevelXp : xpForLevel(level + 1);
  const requiredXp = Math.max(0, nextLevelXp - currentLevelXp);
  const progressXp = Math.max(0, safeXp - currentLevelXp);
  const ratio = requiredXp === 0 ? 1 : Math.min(1, progressXp / requiredXp);
  return { level, currentLevelXp, nextLevelXp, progressXp, requiredXp, ratio };
}

export function progressBar(ratio: number, width = 12): string {
  const safeWidth = Math.max(4, Math.min(30, Math.trunc(width)));
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(safeRatio * safeWidth);
  return `[${'#'.repeat(filled)}${'-'.repeat(safeWidth - filled)}]`;
}

export function randomXp(min: number, max: number, random = Math.random): number {
  const safeMin = Math.max(0, Math.trunc(Math.min(min, max)));
  const safeMax = Math.max(safeMin, Math.trunc(Math.max(min, max)));
  return safeMin + Math.floor(random() * (safeMax - safeMin + 1));
}

export function isMeaningfulMessage(content: string): boolean {
  const withoutLinks = content.replace(/https?:\/\/\S+/gi, ' ');
  const meaningful = withoutLinks.replace(/<a?:\w+:\d+>/g, ' ').replace(/\s+/g, ' ').trim();
  return /[\p{L}\p{N}]/u.test(meaningful) && meaningful.length >= 3;
}

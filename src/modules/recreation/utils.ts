const DURATION_PATTERN = /^(\d+)\s*([mhdw])$/i;

export const MIN_DURATION_MS = 60_000;
export const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export function parseDuration(input: string): number {
  const match = DURATION_PATTERN.exec(input.trim());
  if (!match) throw new Error('Use a duration such as 30m, 2h, 3d, or 1w.');
  const amount = Number.parseInt(match[1] ?? '', 10);
  const unit = (match[2] ?? '').toLowerCase();
  const multiplier = unit === 'm'
    ? 60_000
    : unit === 'h'
      ? 60 * 60_000
      : unit === 'd'
        ? 24 * 60 * 60_000
        : 7 * 24 * 60 * 60_000;
  const milliseconds = amount * multiplier;
  if (!Number.isSafeInteger(milliseconds) || milliseconds < MIN_DURATION_MS || milliseconds > MAX_DURATION_MS) {
    throw new Error('Duration must be between 1 minute and 30 days.');
  }
  return milliseconds;
}

export function formatDuration(milliseconds: number): string {
  const safe = Math.max(0, Math.trunc(milliseconds));
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  if (safe % week === 0 && safe >= week) return `${safe / week}w`;
  if (safe % day === 0 && safe >= day) return `${safe / day}d`;
  if (safe % hour === 0 && safe >= hour) return `${safe / hour}h`;
  return `${Math.max(1, Math.ceil(safe / minute))}m`;
}

export function chooseUnique<T>(items: readonly T[], count: number, random = Math.random): T[] {
  const copy = [...items];
  const safeCount = Math.max(0, Math.min(copy.length, Math.trunc(count)));
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.max(0, Math.min(0.999999999999, random())) * (index + 1));
    const value = copy[index];
    copy[index] = copy[swapIndex] as T;
    copy[swapIndex] = value as T;
  }
  return copy.slice(0, safeCount);
}

export function cleanRecreationText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

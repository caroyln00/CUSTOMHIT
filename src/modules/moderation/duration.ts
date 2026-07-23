export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

export function parseDuration(input: string): number | null {
  const normalized = input.trim().toLowerCase();
  const match = /^(\d+)(s|m|h|d|w)$/.exec(normalized);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isSafeInteger(value) || value <= 0) return null;
  const multiplier = unit === 's'
    ? 1_000
    : unit === 'm'
      ? 60_000
      : unit === 'h'
        ? 3_600_000
        : unit === 'd'
          ? 86_400_000
          : 604_800_000;
  const duration = value * multiplier;
  return duration <= MAX_TIMEOUT_MS ? duration : null;
}

export function formatDuration(milliseconds: number): string {
  const units: Array<[number, string]> = [
    [604_800_000, 'week'],
    [86_400_000, 'day'],
    [3_600_000, 'hour'],
    [60_000, 'minute'],
    [1_000, 'second'],
  ];
  for (const [size, name] of units) {
    if (milliseconds % size === 0) {
      const value = milliseconds / size;
      return `${value} ${name}${value === 1 ? '' : 's'}`;
    }
  }
  return `${Math.round(milliseconds / 1000)} seconds`;
}

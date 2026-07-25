export const NAME_SWEEP_CATEGORIES = [
  '3c',
  '3l',
  '3lp',
  '4c',
  '4l',
  '4lp',
] as const;

export type NameSweepCategory = typeof NAME_SWEEP_CATEGORIES[number];

export interface NameCandidate {
  name: string;
  category: NameSweepCategory;
  score: number;
  pronounceable: boolean;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';
const VOWELS = 'aeiou';
const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';

const PRONOUNCEABLE_PATTERNS: Record<'3lp' | '4lp', readonly string[]> = {
  '3lp': ['CVC', 'VCV'],
  '4lp': ['CVCV', 'VCVC', 'CVVC', 'CCVC'],
};

const CATEGORY_COUNTS: Record<NameSweepCategory, number> = {
  '3c': 36 ** 3,
  '3l': 26 ** 3,
  '3lp': (21 * 5 * 21) + (5 * 21 * 5),
  '4c': 36 ** 4,
  '4l': 26 ** 4,
  '4lp':
    (21 * 5 * 21 * 5) +
    (5 * 21 * 5 * 21) +
    (21 * 5 * 5 * 21) +
    (21 * 21 * 5 * 21),
};

function* cartesian(characters: string, length: number): Generator<string> {
  const indexes = new Array<number>(length).fill(0);

  while (true) {
    yield indexes.map((index) => characters[index]).join('');

    let position = length - 1;
    while (position >= 0) {
      indexes[position] = indexes[position]! + 1;

      if (indexes[position]! < characters.length) break;

      indexes[position] = 0;
      position -= 1;
    }

    if (position < 0) return;
  }
}

function* generatePattern(pattern: string): Generator<string> {
  const sets = [...pattern].map((symbol) => {
    if (symbol === 'V') return VOWELS;
    if (symbol === 'C') return CONSONANTS;
    throw new Error(`Unsupported pronunciation pattern symbol: ${symbol}`);
  });

  const indexes = new Array<number>(sets.length).fill(0);

  while (true) {
    yield indexes.map((index, position) => sets[position]![index]!).join('');

    let position = sets.length - 1;
    while (position >= 0) {
      indexes[position] = indexes[position]! + 1;

      if (indexes[position]! < sets[position]!.length) break;

      indexes[position] = 0;
      position -= 1;
    }

    if (position < 0) return;
  }
}

export function isNameSweepCategory(value: string): value is NameSweepCategory {
  return NAME_SWEEP_CATEGORIES.includes(value as NameSweepCategory);
}

export function getCategoryCount(category: NameSweepCategory): number {
  return CATEGORY_COUNTS[category];
}

export function getCategoryLabel(category: NameSweepCategory): string {
  const labels: Record<NameSweepCategory, string> = {
    '3c': '3-character',
    '3l': '3-letter',
    '3lp': '3-letter pronounceable',
    '4c': '4-character',
    '4l': '4-letter',
    '4lp': '4-letter pronounceable',
  };

  return labels[category];
}

export function isPronounceable(name: string): boolean {
  const normalized = name.toLowerCase();

  if (normalized.length === 3) {
    return (
      /^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]$/.test(normalized) ||
      /^[aeiou][bcdfghjklmnpqrstvwxyz][aeiou]$/.test(normalized)
    );
  }

  if (normalized.length === 4) {
    return (
      /^[bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz][aeiou]$/.test(normalized) ||
      /^[aeiou][bcdfghjklmnpqrstvwxyz][aeiou][bcdfghjklmnpqrstvwxyz]$/.test(normalized) ||
      /^[bcdfghjklmnpqrstvwxyz][aeiou][aeiou][bcdfghjklmnpqrstvwxyz]$/.test(normalized) ||
      /^[bcdfghjklmnpqrstvwxyz]{2}[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(normalized)
    );
  }

  return false;
}

export function scoreCandidate(name: string): number {
  const normalized = name.toLowerCase();
  const uniqueCharacters = new Set(normalized);
  const digitCount = [...normalized].filter((character) => /\d/.test(character)).length;
  const repeatedCount = normalized.length - uniqueCharacters.size;
  const rareCount = [...normalized].filter((character) => 'qjxz'.includes(character)).length;
  const commonCount = [...normalized].filter((character) => 'etaoinrsl'.includes(character)).length;

  let score = 100;

  if (isPronounceable(normalized)) score += 40;

  score += uniqueCharacters.size * 3;
  score += commonCount * 2;
  score -= digitCount * 8;
  score -= repeatedCount * 7;
  score -= rareCount * 3;

  if (/^[a-z]+$/.test(normalized)) score += 8;
  if (/^[aeiou]/.test(normalized)) score += 2;
  if (/(.)\1/.test(normalized)) score -= 5;

  return score;
}

export function* iterateCandidates(
  category: NameSweepCategory,
): Generator<NameCandidate> {
  if (category === '3c') {
    for (const name of cartesian(ALPHANUMERIC, 3)) {
      yield {
        name,
        category,
        score: scoreCandidate(name),
        pronounceable: isPronounceable(name),
      };
    }
    return;
  }

  if (category === '3l') {
    for (const name of cartesian(LETTERS, 3)) {
      yield {
        name,
        category,
        score: scoreCandidate(name),
        pronounceable: isPronounceable(name),
      };
    }
    return;
  }

  if (category === '4c') {
    for (const name of cartesian(ALPHANUMERIC, 4)) {
      yield {
        name,
        category,
        score: scoreCandidate(name),
        pronounceable: isPronounceable(name),
      };
    }
    return;
  }

  if (category === '4l') {
    for (const name of cartesian(LETTERS, 4)) {
      yield {
        name,
        category,
        score: scoreCandidate(name),
        pronounceable: isPronounceable(name),
      };
    }
    return;
  }

  for (const pattern of PRONOUNCEABLE_PATTERNS[category]) {
    for (const name of generatePattern(pattern)) {
      yield {
        name,
        category,
        score: scoreCandidate(name),
        pronounceable: true,
      };
    }
  }
}

function isWorse(left: NameCandidate, right: NameCandidate): boolean {
  if (left.score !== right.score) return left.score < right.score;
  return left.name > right.name;
}

function isBetter(left: NameCandidate, right: NameCandidate): boolean {
  if (left.score !== right.score) return left.score > right.score;
  return left.name < right.name;
}

function siftUp(heap: NameCandidate[], index: number): void {
  let current = index;

  while (current > 0) {
    const parent = Math.floor((current - 1) / 2);

    if (!isWorse(heap[current]!, heap[parent]!)) return;

    [heap[current], heap[parent]] = [heap[parent]!, heap[current]!];
    current = parent;
  }
}

function siftDown(heap: NameCandidate[], index: number): void {
  let current = index;

  while (true) {
    const left = (current * 2) + 1;
    const right = left + 1;
    let worst = current;

    if (left < heap.length && isWorse(heap[left]!, heap[worst]!)) {
      worst = left;
    }

    if (right < heap.length && isWorse(heap[right]!, heap[worst]!)) {
      worst = right;
    }

    if (worst === current) return;

    [heap[current], heap[worst]] = [heap[worst]!, heap[current]!];
    current = worst;
  }
}

export function getTopCandidates(
  category: NameSweepCategory,
  limit = 25,
): NameCandidate[] {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const heap: NameCandidate[] = [];

  for (const candidate of iterateCandidates(category)) {
    if (heap.length < safeLimit) {
      heap.push(candidate);
      siftUp(heap, heap.length - 1);
      continue;
    }

    if (isBetter(candidate, heap[0]!)) {
      heap[0] = candidate;
      siftDown(heap, 0);
    }
  }

  return heap.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    return left.name.localeCompare(right.name);
  });
}

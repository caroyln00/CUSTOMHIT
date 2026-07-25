export const NAME_SWEEP_CATEGORIES = [
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
] as const;

export type NameSweepCategory = typeof NAME_SWEEP_CATEGORIES[number];

export interface NameCandidate {
  name: string;
  category: NameSweepCategory;
  score: number;
  entropy: number;
  demandPenalty: number;
  pronounceable: boolean;
  tieBreaker: number;
}

const LETTERS = 'abcdefghijklmnopqrstuvwxyz';
const ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DIGITS = '0123456789';
const VOWELS = 'aeiou';
const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';

const PRONOUNCEABLE_PATTERNS: Record<'2lp' | '3lp' | '4lp', readonly string[]> = {
  '2lp': ['CV', 'VC'],
  '3lp': ['CVC', 'VCV'],
  '4lp': ['CVCV', 'VCVC', 'CVVC', 'CCVC'],
};

const CATEGORY_COUNTS: Record<NameSweepCategory, number> = {
  '2c': 36 ** 2,
  '2l': 26 ** 2,
  '2lp': (21 * 5) + (5 * 21),
  '2n': 10 ** 2,
  '3c': 36 ** 3,
  '3l': 26 ** 3,
  '3lp': (21 * 5 * 21) + (5 * 21 * 5),
  '3n': 10 ** 3,
  '4c': 36 ** 4,
  '4l': 26 ** 4,
  '4lp':
    (21 * 5 * 21 * 5) +
    (5 * 21 * 5 * 21) +
    (21 * 5 * 5 * 21) +
    (21 * 21 * 5 * 21),
  '4n': 10 ** 4,
};

const CATEGORY_BASE_SCORE: Record<NameSweepCategory, number> = {
  '2c': 10,
  '2l': 5,
  '2lp': 3,
  '2n': 4,
  '3c': 25,
  '3l': 12,
  '3lp': 8,
  '3n': 8,
  '4c': 58,
  '4l': 38,
  '4lp': 28,
  '4n': 28,
};

const LETTER_POPULARITY: Readonly<Record<string, number>> = {
  e: 13,
  t: 12,
  a: 11,
  o: 10,
  i: 10,
  n: 9,
  r: 9,
  s: 8,
  h: 8,
  l: 7,
  d: 6,
  c: 5,
  u: 5,
  m: 5,
  f: 4,
  p: 4,
  g: 4,
  w: 3,
  y: 3,
  b: 3,
  v: 2,
  k: 2,
  x: 1,
  j: 1,
  q: 1,
  z: 1,
};

const DIGIT_POPULARITY: Readonly<Record<string, number>> = {
  '0': 8,
  '1': 9,
  '2': 6,
  '3': 6,
  '4': 5,
  '5': 7,
  '6': 5,
  '7': 9,
  '8': 8,
  '9': 7,
};

const COMMON_BIGRAMS = new Set([
  'th',
  'he',
  'in',
  'er',
  'an',
  're',
  'on',
  'at',
  'en',
  'nd',
  'ti',
  'es',
  'or',
  'te',
  'of',
  'ed',
  'is',
  'it',
  'al',
  'ar',
  'st',
  'to',
  'nt',
  'ng',
  'se',
  'ha',
  'as',
  'ou',
  'io',
  'le',
  've',
  'co',
  'me',
  'de',
  'hi',
  'ri',
  'ro',
  'ic',
  'ne',
  'ea',
  'ra',
  'ce',
  'li',
  'ch',
  'll',
  'be',
  'ma',
  'si',
  'om',
  'ur',
]);

const COMMON_TRIGRAMS = new Set([
  'the',
  'and',
  'ing',
  'ion',
  'ent',
  'her',
  'for',
  'tha',
  'nth',
  'int',
  'ere',
  'ter',
  'est',
  'ers',
  'ati',
  'hat',
  'ate',
  'all',
  'eth',
  'hes',
  'ver',
  'his',
  'oft',
  'ith',
  'you',
]);

const COMMON_NUMERIC_PATTERNS = new Set([
  '00',
  '01',
  '07',
  '10',
  '11',
  '12',
  '13',
  '21',
  '23',
  '24',
  '33',
  '42',
  '44',
  '55',
  '66',
  '69',
  '77',
  '88',
  '99',
  '101',
  '111',
  '123',
  '222',
  '333',
  '420',
  '444',
  '555',
  '666',
  '777',
  '888',
  '911',
  '999',
  '0000',
  '1000',
  '1111',
  '1234',
  '2000',
  '2222',
  '3333',
  '4200',
  '4444',
  '5555',
  '6666',
  '6969',
  '7777',
  '8008',
  '8888',
  '9999',
]);

function* cartesian(characters: string, length: number): Generator<string> {
  const indexes = new Array<number>(length).fill(0);

  while (true) {
    yield indexes.map((index) => characters[index]!).join('');

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

function calculateEntropy(name: string): number {
  if (name.length <= 1) return 0;

  const counts = new Map<string, number>();

  for (const character of name) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  let entropy = 0;

  for (const count of counts.values()) {
    const probability = count / name.length;
    entropy -= probability * Math.log2(probability);
  }

  const maximumEntropy = Math.log2(name.length);

  return maximumEntropy === 0 ? 0 : entropy / maximumEntropy;
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function isPalindrome(value: string): boolean {
  return value === [...value].reverse().join('');
}

function isSequentialDigits(value: string): boolean {
  if (!/^\d+$/.test(value) || value.length < 2) return false;

  let ascending = true;
  let descending = true;

  for (let index = 1; index < value.length; index += 1) {
    const previous = Number(value[index - 1]);
    const current = Number(value[index]);

    if (current !== previous + 1) ascending = false;
    if (current !== previous - 1) descending = false;
  }

  return ascending || descending;
}

function inferCategory(name: string): NameSweepCategory {
  const normalized = name.toLowerCase();
  const length = normalized.length;

  let candidate: string;

  if (/^\d+$/.test(normalized)) {
    candidate = `${length}n`;
  } else if (/^[a-z]+$/.test(normalized)) {
    candidate = `${length}l`;
  } else {
    candidate = `${length}c`;
  }

  if (isNameSweepCategory(candidate)) return candidate;

  throw new Error(`Cannot infer a supported category for: ${name}`);
}

function analyzeCandidate(
  name: string,
  category: NameSweepCategory,
): Omit<NameCandidate, 'name' | 'category' | 'tieBreaker'> {
  const normalized = name.toLowerCase();
  const characters = [...normalized];
  const uniqueCharacters = new Set(characters);
  const pronounceable = isPronounceable(normalized);

  const letterCount = characters.filter((character) => /[a-z]/.test(character)).length;
  const digitCount = characters.filter((character) => /\d/.test(character)).length;
  const repeatedCharacters = normalized.length - uniqueCharacters.size;
  const adjacentRepeatCount = [...normalized.matchAll(/(.)\1/g)].length;

  let popularityTotal = 0;
  let rarityBonus = 0;

  for (const character of characters) {
    const popularity = /[a-z]/.test(character)
      ? LETTER_POPULARITY[character] ?? 6
      : DIGIT_POPULARITY[character] ?? 7;

    popularityTotal += popularity;
    rarityBonus += Math.max(0, 8 - popularity) * 1.2;
  }

  const averagePopularity = popularityTotal / Math.max(1, normalized.length);
  const entropy = calculateEntropy(normalized);
  const diversityRatio = uniqueCharacters.size / Math.max(1, normalized.length);

  let demandPenalty = averagePopularity * 1.4;

  for (let index = 0; index < normalized.length - 1; index += 1) {
    if (COMMON_BIGRAMS.has(normalized.slice(index, index + 2))) {
      demandPenalty += 4;
    }
  }

  for (let index = 0; index < normalized.length - 2; index += 1) {
    if (COMMON_TRIGRAMS.has(normalized.slice(index, index + 3))) {
      demandPenalty += 9;
    }
  }

  if (pronounceable) demandPenalty += 14;
  if (isPalindrome(normalized)) demandPenalty += 8;
  if (adjacentRepeatCount > 0) demandPenalty += adjacentRepeatCount * 8;
  if (uniqueCharacters.size === 1) demandPenalty += 24;
  if (isSequentialDigits(normalized)) demandPenalty += 18;
  if (COMMON_NUMERIC_PATTERNS.has(normalized)) demandPenalty += 25;
  if (/^(19|20)\d{2}$/.test(normalized)) demandPenalty += 15;
  if (/^\d+0{2,}$/.test(normalized)) demandPenalty += 10;
  if (/^(abc|xyz|qwe|asd|zxc|lol|god|sex|xxx)$/i.test(normalized)) demandPenalty += 25;

  const mixedCharacterBonus = letterCount > 0 && digitCount > 0 ? 10 : 0;
  const numericDiversityBonus =
    digitCount === normalized.length && uniqueCharacters.size === normalized.length ? 4 : 0;

  const rawScore =
    CATEGORY_BASE_SCORE[category] +
    (entropy * 20) +
    (diversityRatio * 12) +
    rarityBonus +
    mixedCharacterBonus +
    numericDiversityBonus -
    demandPenalty -
    (repeatedCharacters * 5);

  return {
    score: Math.max(1, Math.min(99, Math.round(rawScore))),
    entropy: Number(entropy.toFixed(4)),
    demandPenalty: Number(demandPenalty.toFixed(2)),
    pronounceable,
  };
}

function makeCandidate(name: string, category: NameSweepCategory): NameCandidate {
  return {
    name,
    category,
    ...analyzeCandidate(name, category),
    tieBreaker: stableHash(`${category}:${name}`),
  };
}

export function isNameSweepCategory(value: string): value is NameSweepCategory {
  return NAME_SWEEP_CATEGORIES.includes(value as NameSweepCategory);
}

export function getCategoryCount(category: NameSweepCategory): number {
  return CATEGORY_COUNTS[category];
}

export function getCategoryLabel(category: NameSweepCategory): string {
  const labels: Record<NameSweepCategory, string> = {
    '2c': '2-character',
    '2l': '2-letter',
    '2lp': '2-letter pronounceable',
    '2n': '2-digit',
    '3c': '3-character',
    '3l': '3-letter',
    '3lp': '3-letter pronounceable',
    '3n': '3-digit',
    '4c': '4-character',
    '4l': '4-letter',
    '4lp': '4-letter pronounceable',
    '4n': '4-digit',
  };

  return labels[category];
}

export function isPronounceable(name: string): boolean {
  const normalized = name.toLowerCase();

  if (normalized.length === 2) {
    return (
      /^[bcdfghjklmnpqrstvwxyz][aeiou]$/.test(normalized) ||
      /^[aeiou][bcdfghjklmnpqrstvwxyz]$/.test(normalized)
    );
  }

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

export function scoreCandidate(
  name: string,
  category: NameSweepCategory = inferCategory(name),
): number {
  return analyzeCandidate(name, category).score;
}

export function* iterateCandidates(
  category: NameSweepCategory,
): Generator<NameCandidate> {
  if (category === '2lp' || category === '3lp' || category === '4lp') {
    for (const pattern of PRONOUNCEABLE_PATTERNS[category]) {
      for (const name of generatePattern(pattern)) {
        yield makeCandidate(name, category);
      }
    }

    return;
  }

  const length = Number.parseInt(category[0]!, 10);

  const characterSet = category.endsWith('n')
    ? DIGITS
    : category.endsWith('l')
      ? LETTERS
      : ALPHANUMERIC;

  for (const name of cartesian(characterSet, length)) {
    yield makeCandidate(name, category);
  }
}

function isWorse(left: NameCandidate, right: NameCandidate): boolean {
  if (left.score !== right.score) return left.score < right.score;
  if (left.entropy !== right.entropy) return left.entropy < right.entropy;
  if (left.demandPenalty !== right.demandPenalty) {
    return left.demandPenalty > right.demandPenalty;
  }

  return left.tieBreaker > right.tieBreaker;
}

function isBetter(left: NameCandidate, right: NameCandidate): boolean {
  if (left.score !== right.score) return left.score > right.score;
  if (left.entropy !== right.entropy) return left.entropy > right.entropy;
  if (left.demandPenalty !== right.demandPenalty) {
    return left.demandPenalty < right.demandPenalty;
  }

  return left.tieBreaker < right.tieBreaker;
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
  const safeLimit = Math.max(1, Math.min(1000, Math.trunc(limit)));
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
    if (left.entropy !== right.entropy) return right.entropy - left.entropy;
    if (left.demandPenalty !== right.demandPenalty) {
      return left.demandPenalty - right.demandPenalty;
    }

    if (left.tieBreaker !== right.tieBreaker) {
      return left.tieBreaker - right.tieBreaker;
    }

    return left.name.localeCompare(right.name);
  });
}
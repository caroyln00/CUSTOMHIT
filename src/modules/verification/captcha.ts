import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { PNG } from 'pngjs';

const CHARSET = 'ACDEFGHJKMNPRTUVWXY23456789';

const FONT: Record<string, string[]> = {
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  C: ['01111','10000','10000','10000','10000','10000','01111'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01110'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  J: ['00111','00010','00010','00010','00010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  N: ['10001','11001','10101','10011','10001','10001','10001'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','10101','01010'],
  X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110'],
};

export function normalizeAnswer(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
}

export function generateCode(length = 5): string {
  if (length < 4 || length > 8) throw new Error('CAPTCHA length must be between 4 and 8.');
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += CHARSET[randomInt(0, CHARSET.length)];
  }
  return result;
}

export function hashAnswer(answer: string, salt = randomBytes(16).toString('hex')): { hash: string; salt: string } {
  const normalized = normalizeAnswer(answer);
  const hash = createHash('sha256').update(`${salt}:${normalized}`).digest('hex');
  return { hash, salt };
}

export function compareAnswer(answer: string, salt: string, expectedHash: string): boolean {
  const actualHash = hashAnswer(answer, salt).hash;
  const actual = Buffer.from(actualHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function setPixel(png: PNG, x: number, y: number, rgba: [number, number, number, number]): void {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const index = (png.width * y + x) << 2;
  png.data[index] = rgba[0];
  png.data[index + 1] = rgba[1];
  png.data[index + 2] = rgba[2];
  png.data[index + 3] = rgba[3];
}

function drawLine(png: PNG, x0: number, y0: number, x1: number, y1: number, rgba: [number, number, number, number]): void {
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    setPixel(png, x, y, rgba);
    if (x === x1 && y === y1) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
}

function drawGlyph(png: PNG, glyph: string[], startX: number, startY: number, scale: number): void {
  for (let row = 0; row < glyph.length; row += 1) {
    const line = glyph[row];
    if (!line) continue;
    for (let column = 0; column < line.length; column += 1) {
      if (line[column] !== '1') continue;
      for (let dy = 0; dy < scale; dy += 1) {
        for (let dx = 0; dx < scale; dx += 1) {
          setPixel(png, startX + column * scale + dx, startY + row * scale + dy, [242, 239, 255, 255]);
        }
      }
    }
  }
}

export function renderCaptchaPng(code: string): Buffer {
  const width = 420;
  const height = 160;
  const png = new PNG({ width, height });

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const glow = Math.max(0, 1 - Math.hypot(x - width / 2, y - height / 2) / 260);
      setPixel(png, x, y, [10 + Math.floor(18 * glow), 8 + Math.floor(8 * glow), 24 + Math.floor(42 * glow), 255]);
    }
  }

  for (let i = 0; i < 14; i += 1) {
    drawLine(
      png,
      randomInt(0, width),
      randomInt(0, height),
      randomInt(0, width),
      randomInt(0, height),
      [100 + randomInt(0, 80), 40 + randomInt(0, 70), 170 + randomInt(0, 80), 130],
    );
  }

  for (let i = 0; i < 1300; i += 1) {
    setPixel(png, randomInt(0, width), randomInt(0, height), [90, 55, 150, randomInt(45, 150)]);
  }

  const scale = 8;
  const glyphWidth = 5 * scale;
  const gap = 16;
  const totalWidth = code.length * glyphWidth + (code.length - 1) * gap;
  let x = Math.floor((width - totalWidth) / 2);
  for (const character of code) {
    const glyph = FONT[character];
    if (!glyph) throw new Error(`No CAPTCHA glyph for ${character}`);
    drawGlyph(png, glyph, x + randomInt(-3, 4), 46 + randomInt(-7, 8), scale);
    x += glyphWidth + gap;
  }

  return PNG.sync.write(png);
}

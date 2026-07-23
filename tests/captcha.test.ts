import { describe, expect, it } from 'vitest';
import { compareAnswer, generateCode, hashAnswer, normalizeAnswer, renderCaptchaPng } from '../src/modules/verification/captcha.js';

describe('CAPTCHA utilities', () => {
  it('normalizes answers', () => {
    expect(normalizeAnswer(' a7-k 3t ')).toBe('A7K3T');
  });

  it('generates an unambiguous five-character code', () => {
    const code = generateCode(5);
    expect(code).toHaveLength(5);
    expect(code).toMatch(/^[ACDEFGHJKMNPRTUVWXY23456789]+$/);
  });

  it('hashes and verifies without storing plaintext', () => {
    const { hash, salt } = hashAnswer('A7K3T');
    expect(compareAnswer('a7-k3t', salt, hash)).toBe(true);
    expect(compareAnswer('WRONG', salt, hash)).toBe(false);
  });

  it('renders a PNG image', () => {
    const buffer = renderCaptchaPng('A7K3T');
    expect(buffer.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(buffer.length).toBeGreaterThan(1000);
  });
});

import { describe, expect, it } from 'vitest';
import {
  detectPhishing,
  isBurstSpam,
  isDuplicateSpam,
  normalizeMessage,
} from '../src/modules/security/heuristics.js';

describe('security heuristics', () => {
  it('detects known tracking domains', () => {
    const result = detectPhishing('check this https://grabify.link/example');
    expect(result.detected).toBe(true);
    expect(result.reason).toContain('tracking');
  });

  it('detects fake Discord gift domains', () => {
    const result = detectPhishing('free nitro https://discord-nitro-gift.example/claim');
    expect(result.detected).toBe(true);
  });

  it('allows official Discord gift links', () => {
    const result = detectPhishing('gift https://discord.gift/example');
    expect(result.detected).toBe(false);
  });

  it('detects QR verification takeover patterns', () => {
    const result = detectPhishing('Verify your Discord account: scan this QR code https://example.com/verify');
    expect(result.detected).toBe(true);
  });

  it('normalizes mentions, links, casing, and spacing', () => {
    expect(normalizeMessage(' HELLO   <@123> https://example.com ')).toBe('hello <user> <url>');
  });

  it('detects burst and duplicate spam windows', () => {
    const now = 10_000;
    expect(isBurstSpam([5_000, 6_000, 7_000, 8_000, 9_000, 10_000], now, 6, 6)).toBe(true);
    expect(isDuplicateSpam([
      { normalized: 'same', timestamp: 8_000 },
      { normalized: 'same', timestamp: 9_000 },
      { normalized: 'same', timestamp: 10_000 },
    ], 'same', now, 3)).toBe(true);
  });
});

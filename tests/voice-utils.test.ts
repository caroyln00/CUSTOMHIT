import { describe, expect, it } from 'vitest';
import { defaultVoiceChannelName, parseVoiceLimit, safeVoiceChannelName } from '../src/modules/voice/service.js';

describe('temporary voice utilities', () => {
  it('normalizes room names', () => {
    expect(safeVoiceChannelName('  Ranked\nRoom   One  ')).toBe('Ranked Room One');
    expect(safeVoiceChannelName('')).toBe('Temporary Room');
    expect(safeVoiceChannelName('x'.repeat(120))).toHaveLength(80);
    expect(defaultVoiceChannelName({ displayName: 'Player' } as never)).toBe("Player's Room");
  });

  it('validates room limits', () => {
    expect(parseVoiceLimit('0')).toBe(0);
    expect(parseVoiceLimit('99')).toBe(99);
    expect(() => parseVoiceLimit('-1')).toThrow();
    expect(() => parseVoiceLimit('100')).toThrow();
    expect(() => parseVoiceLimit('abc')).toThrow();
  });
});

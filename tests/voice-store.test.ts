import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Store } from '../src/core/store.js';

const cleanup: string[] = [];

afterEach(() => {
  for (const directory of cleanup.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('temporary voice store', () => {
  it('persists configuration and room ownership', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hit-voice-'));
    cleanup.push(directory);
    const store = new Store(join(directory, 'hit.sqlite'));

    const settings = store.upsertVoiceSettings({
      guildId: 'guild-1',
      lobbyChannelId: 'lobby-1',
      categoryId: 'category-1',
      logChannelId: 'logs-1',
      defaultUserLimit: 5,
    });
    expect(settings.defaultUserLimit).toBe(5);
    expect(store.getVoiceSettings('guild-1')?.lobbyChannelId).toBe('lobby-1');

    const room = store.createTempVoiceChannel({
      guildId: 'guild-1',
      channelId: 'voice-1',
      ownerId: 'owner-1',
    });
    expect(room.ownerId).toBe('owner-1');
    expect(store.getTempVoiceChannelByOwner('guild-1', 'owner-1')?.channelId).toBe('voice-1');

    const transferred = store.transferTempVoiceOwnership('voice-1', 'owner-2');
    expect(transferred.ownerId).toBe('owner-2');
    expect(store.listTempVoiceChannels('guild-1')).toHaveLength(1);
    expect(store.deleteTempVoiceChannel('voice-1')).toBe(true);
    expect(store.getTempVoiceChannelByChannel('voice-1')).toBeNull();

    store.close();
  });
});

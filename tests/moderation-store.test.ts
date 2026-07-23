import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Store } from '../src/core/store.js';

const directories: string[] = [];

function createStore(): Store {
  const directory = mkdtempSync(join(tmpdir(), 'hit-mod-store-'));
  directories.push(directory);
  return new Store(join(directory, 'hit.sqlite'));
}

afterEach(() => {
  while (directories.length) {
    const directory = directories.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

describe('moderation store', () => {
  it('stores settings, warnings, and cases', () => {
    const store = createStore();
    store.upsertModerationSettings({ guildId: 'guild', logChannelId: 'logs' });
    expect(store.getModerationSettings('guild')?.logChannelId).toBe('logs');

    const warning = store.addWarning('guild', 'user', 'moderator', 'Repeated spam');
    expect(warning.reason).toBe('Repeated spam');
    expect(store.listActiveWarnings('guild', 'user')).toHaveLength(1);

    const moderationCase = store.createModerationCase({
      guildId: 'guild',
      moderatorId: 'moderator',
      targetId: 'user',
      action: 'warn',
      reason: 'Repeated spam',
      metadata: { activeWarnings: 1 },
    });
    expect(store.getModerationCase('guild', moderationCase.id)?.action).toBe('warn');
    expect(store.listModerationCasesForTarget('guild', 'user')).toHaveLength(1);

    expect(store.clearActiveWarnings('guild', 'user', 'moderator')).toBe(1);
    expect(store.listActiveWarnings('guild', 'user')).toHaveLength(0);
    store.close();
  });
});

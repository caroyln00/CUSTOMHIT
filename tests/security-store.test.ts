import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Store } from '../src/core/store.js';

const paths: string[] = [];
afterEach(() => {
  for (const path of paths.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('security store', () => {
  it('persists settings, trust, events, and lockdown snapshots', () => {
    const directory = mkdtempSync(join(tmpdir(), 'hit-security-'));
    paths.push(directory);
    const store = new Store(join(directory, 'hit.sqlite'));

    const settings = store.upsertSecuritySettings({
      guildId: 'guild',
      logChannelId: 'logs',
      quarantineRoleId: 'quarantine',
      antiSpamEnabled: true,
      antiPhishingEnabled: true,
      antiRaidEnabled: true,
      antiNukeEnabled: true,
      autoLockdownEnabled: false,
      spamMessageLimit: 6,
      spamWindowSeconds: 6,
      duplicateMessageLimit: 3,
      mentionLimit: 5,
      autoTimeoutMinutes: 10,
      raidJoinLimit: 8,
      raidWindowSeconds: 10,
      nukeActionLimit: 3,
      nukeWindowSeconds: 30,
      lockdownMinutes: 10,
    });
    expect(settings.logChannelId).toBe('logs');
    expect(store.getSecuritySettings('guild')?.antiNukeEnabled).toBe(true);

    store.addSecurityTrustedUser('guild', 'staff', 'owner');
    expect(store.isSecurityTrustedUser('guild', 'staff')).toBe(true);
    expect(store.listSecurityTrustedUsers('guild')).toEqual(['staff']);

    const event = store.recordSecurityEvent({
      guildId: 'guild',
      actorId: 'actor',
      targetId: 'target',
      eventType: 'test',
      severity: 'warning',
      detail: { points: 2 },
    });
    expect(event.id).toBeGreaterThan(0);
    expect(event.detail?.points).toBe(2);

    store.replaceLockdownSnapshots('guild', [{
      guildId: 'guild',
      channelId: 'channel',
      overwriteExisted: false,
      permissions: { SendMessages: null, AddReactions: true },
    }]);
    expect(store.getLockdownSnapshots('guild')[0]?.permissions.AddReactions).toBe(true);

    store.setSecurityLockdown({
      guildId: 'guild',
      active: true,
      actorId: 'owner',
      reason: 'test',
      startedAt: 100,
      expiresAt: 200,
    });
    expect(store.listExpiredSecurityLockdowns(201)).toHaveLength(1);

    expect(store.removeSecurityTrustedUser('guild', 'staff')).toBe(true);
    store.close();
  });
});

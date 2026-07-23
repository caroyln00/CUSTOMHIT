import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Store } from '../src/core/store.js';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function createStore(): Store {
  const directory = mkdtempSync(join(tmpdir(), 'hit-levels-test-'));
  directories.push(directory);
  return new Store(join(directory, 'hit.sqlite'));
}

describe('levels store', () => {
  it('persists configuration and exclusions', () => {
    const store = createStore();
    const settings = store.upsertLevelSettings({
      guildId: 'guild',
      enabled: true,
      announceChannelId: 'announce',
      logChannelId: 'logs',
      messageXpMin: 15,
      messageXpMax: 25,
      messageCooldownSeconds: 60,
      voiceXpPerMinute: 10,
      voiceMinMembers: 2,
      announceLevelUps: true,
      stackRewardRoles: true,
    });
    expect(settings.enabled).toBe(true);
    expect(store.getLevelSettings('guild')?.voiceXpPerMinute).toBe(10);

    store.addLevelExcludedChannel('guild', 'channel');
    store.addLevelExcludedRole('guild', 'role');
    expect(store.isLevelChannelExcluded('guild', 'channel')).toBe(true);
    expect(store.isLevelRoleExcluded('guild', ['other', 'role'])).toBe(true);
    expect(store.removeLevelExcludedChannel('guild', 'channel')).toBe(true);
    expect(store.removeLevelExcludedRole('guild', 'role')).toBe(true);
    store.close();
  });

  it('enforces message cooldowns and tracks voice activity', () => {
    const store = createStore();
    const first = store.tryAwardMessageXp('guild', 'user', 20, 60_000, 1_000);
    expect(first?.after.xp).toBe(20);
    expect(first?.after.messageCount).toBe(1);
    expect(store.tryAwardMessageXp('guild', 'user', 20, 60_000, 30_000)).toBeNull();
    const second = store.tryAwardMessageXp('guild', 'user', 25, 60_000, 61_000);
    expect(second?.after.xp).toBe(45);
    expect(second?.after.messageCount).toBe(2);

    const voice = store.awardVoiceXp('guild', 'user', 30, 3, 70_000);
    expect(voice.after.xp).toBe(75);
    expect(voice.after.voiceMinutes).toBe(3);
    store.close();
  });

  it('supports leaderboard ranking and XP administration', () => {
    const store = createStore();
    store.setLevelXp('guild', 'one', 500, 1);
    store.setLevelXp('guild', 'two', 1000, 2);
    store.setLevelXp('guild', 'three', 250, 3);
    expect(store.listLevelLeaderboard('guild').map((profile) => profile.userId)).toEqual(['two', 'one', 'three']);
    expect(store.getLevelRank('guild', 'two')).toBe(1);
    expect(store.getLevelRank('guild', 'one')).toBe(2);
    expect(store.adjustLevelXp('guild', 'one', -700).after.xp).toBe(0);
    expect(store.adjustLevelXp('guild', 'three', 250).after.xp).toBe(500);
    store.close();
  });

  it('persists one reward role per level', () => {
    const store = createStore();
    store.upsertLevelReward('guild', 5, 'role-five');
    store.upsertLevelReward('guild', 10, 'role-ten');
    store.upsertLevelReward('guild', 5, 'role-five-new');
    expect(store.listLevelRewards('guild').map((reward) => [reward.level, reward.roleId])).toEqual([
      [5, 'role-five-new'],
      [10, 'role-ten'],
    ]);
    expect(store.deleteLevelReward('guild', 10)).toBe(true);
    expect(store.listLevelRewards('guild')).toHaveLength(1);
    store.close();
  });
});

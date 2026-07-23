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
  const directory = mkdtempSync(join(tmpdir(), 'hit-lfg-test-'));
  directories.push(directory);
  return new Store(join(directory, 'hit.sqlite'));
}

describe('lfg store', () => {
  it('persists configuration and an LFG lifecycle', () => {
    const store = createStore();
    const settings = store.upsertLfgSettings({
      guildId: 'guild',
      forumChannelId: 'forum',
      panelChannelId: 'panel',
      logChannelId: 'log',
      maxOpenPerUser: 2,
      defaultExpiryMinutes: 180,
    });
    expect(settings.forumChannelId).toBe('forum');
    expect(store.getLfgSettings('guild')?.defaultExpiryMinutes).toBe(180);

    const post = store.createLfgPost({
      guildId: 'guild',
      threadId: 'thread',
      starterMessageId: 'starter',
      ownerId: 'owner',
      game: 'Game',
      mode: 'Ranked',
      platform: 'PC',
      region: 'NA',
      notes: 'Mic required',
      maxPlayers: 4,
      expiresAt: 5_000,
    });
    expect(post.status).toBe('open');
    expect(store.countActiveLfgPostsForOwner('guild', 'owner')).toBe(1);

    expect(store.addLfgParticipant(post.id, 'one')).toBe(true);
    expect(store.addLfgParticipant(post.id, 'one')).toBe(false);
    expect(store.addLfgParticipant(post.id, 'two')).toBe(true);
    expect(store.countLfgParticipants(post.id)).toBe(2);
    expect(store.listLfgParticipants(post.id).map((entry) => entry.userId)).toEqual(['one', 'two']);

    expect(store.setLfgStatus(post.id, 'full').status).toBe('full');
    expect(store.removeLfgParticipant(post.id, 'one')).toBe(true);
    expect(store.setLfgStatus(post.id, 'open').status).toBe('open');
    expect(store.setLfgStatus(post.id, 'closed', 'owner', 'done').closeReason).toBe('done');
    expect(store.countActiveLfgPostsForOwner('guild', 'owner')).toBe(0);

    store.deleteLfgPost(post.id);
    expect(store.getLfgPostByThread('thread')).toBeNull();
    store.close();
  });

  it('returns only active expired posts to the worker', () => {
    const store = createStore();
    const expired = store.createLfgPost({
      guildId: 'guild', threadId: 'expired-thread', starterMessageId: 'starter-1', ownerId: 'one',
      game: 'A', mode: 'B', platform: 'PC', region: 'NA', notes: 'N', maxPlayers: 2, expiresAt: 100,
    });
    const future = store.createLfgPost({
      guildId: 'guild', threadId: 'future-thread', starterMessageId: 'starter-2', ownerId: 'two',
      game: 'A', mode: 'B', platform: 'PC', region: 'NA', notes: 'N', maxPlayers: 2, expiresAt: 10_000,
    });
    store.setLfgStatus(expired.id, 'closed', 'owner', 'manual');
    expect(store.listExpiredLfgPosts(1_000)).toHaveLength(0);
    store.setLfgStatus(expired.id, 'open');
    expect(store.listExpiredLfgPosts(1_000).map((post) => post.id)).toEqual([expired.id]);
    expect(store.getLfgPostById('guild', future.id)?.threadId).toBe('future-thread');
    store.close();
  });
});

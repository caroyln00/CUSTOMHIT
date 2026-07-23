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
  const directory = mkdtempSync(join(tmpdir(), 'hit-community-test-'));
  directories.push(directory);
  return new Store(join(directory, 'hit.sqlite'));
}

function configure(store: Store): void {
  store.upsertCommunitySettings({
    guildId: 'guild',
    logChannelId: 'logs',
    currencyName: 'credits',
    startingBalance: 100,
    dailyReward: 250,
    dailyCooldownHours: 24,
    workMin: 50,
    workMax: 150,
    workCooldownMinutes: 60,
    countingChannelId: 'counting',
    countingResetOnMistake: true,
    countingDeleteInvalid: true,
    starboardChannelId: 'starboard',
    starThreshold: 3,
    starEmoji: '⭐',
    allowSelfStar: false,
  });
}

describe('community store', () => {
  it('persists economy, counting, and starboard settings', () => {
    const store = createStore();
    configure(store);
    expect(store.getCommunitySettings('guild')).toMatchObject({
      currencyName: 'credits',
      countingChannelId: 'counting',
      starboardChannelId: 'starboard',
      starThreshold: 3,
    });
    expect(store.getCountingState('guild')).toMatchObject({ currentNumber: 0, highScore: 0 });
    store.close();
  });

  it('enforces economy cooldowns, transfers, and administration', () => {
    const store = createStore();
    configure(store);
    const first = store.claimEconomyDaily('guild', 'one', 100, 250, 24, 1_000);
    expect(first.claimed).toBe(true);
    expect(first.account.balance).toBe(350);
    expect(store.claimEconomyDaily('guild', 'one', 100, 250, 24, 2_000).claimed).toBe(false);

    const work = store.claimEconomyWork('guild', 'one', 100, 75, 60, 3_000);
    expect(work.claimed).toBe(true);
    expect(work.account.balance).toBe(425);
    expect(store.claimEconomyWork('guild', 'one', 100, 75, 60, 4_000).claimed).toBe(false);

    const transfer = store.transferEconomy('guild', 'one', 'two', 125, 100, 5_000);
    expect(transfer?.sender.balance).toBe(300);
    expect(transfer?.recipient.balance).toBe(225);
    expect(store.transferEconomy('guild', 'two', 'one', 500, 100, 6_000)).toBeNull();

    expect(store.adjustEconomyBalance('guild', 'two', 'staff', 'set', 900, 100, 7_000).balance).toBe(900);
    expect(store.listEconomyLeaderboard('guild').map((account) => account.userId)).toEqual(['two', 'one']);
    expect(store.getEconomyRank('guild', 'two')).toBe(1);
    store.close();
  });

  it('processes sequential counting and preserves the high score', () => {
    const store = createStore();
    configure(store);
    expect(store.processCount('guild', 'one', 1, true, 1, 'message-one').status).toBe('accepted');
    expect(store.getCountingState('guild').currentMessageId).toBe('message-one');
    expect(store.processCount('guild', 'one', 2, true, 2).status).toBe('same_user');
    expect(store.processCount('guild', 'two', 2, true, 3).state.currentNumber).toBe(2);
    const wrong = store.processCount('guild', 'three', 4, true, 4);
    expect(wrong.status).toBe('wrong');
    expect(wrong.reset).toBe(true);
    expect(wrong.state.currentNumber).toBe(0);
    expect(wrong.state.highScore).toBe(2);
    expect(store.resetCountingState('guild', 5).highScore).toBe(2);
    store.close();
  });

  it('persists and removes starboard records', () => {
    const store = createStore();
    configure(store);
    store.upsertStarboardRecord({
      guildId: 'guild',
      sourceMessageId: 'source',
      sourceChannelId: 'general',
      starboardMessageId: 'board',
      authorId: 'author',
      starCount: 3,
    }, 1);
    expect(store.getStarboardRecord('guild', 'source')?.starCount).toBe(3);
    store.upsertStarboardRecord({
      guildId: 'guild',
      sourceMessageId: 'source',
      sourceChannelId: 'general',
      starboardMessageId: 'board',
      authorId: 'author',
      starCount: 5,
    }, 2);
    expect(store.getStarboardRecordByBoardMessage('board')?.starCount).toBe(5);
    expect(store.deleteStarboardRecordByBoardMessage('board')).toBe(true);
    expect(store.getStarboardRecord('guild', 'source')).toBeNull();
    store.close();
  });
});

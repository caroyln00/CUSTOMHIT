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
  const directory = mkdtempSync(join(tmpdir(), 'hit-recreation-test-'));
  directories.push(directory);
  return new Store(join(directory, 'hit.sqlite'));
}

describe('recreation store', () => {
  it('persists recreation settings', () => {
    const store = createStore();
    store.upsertRecreationSettings({
      guildId: 'guild',
      giveawayChannelId: 'giveaways',
      eventChannelId: 'events',
      logChannelId: 'logs',
      notificationRoleId: 'role',
      defaultGiveawayMinutes: 1440,
      defaultEventReminderMinutes: 60,
    });
    expect(store.getRecreationSettings('guild')).toMatchObject({
      giveawayChannelId: 'giveaways',
      eventChannelId: 'events',
      notificationRoleId: 'role',
    });
    store.close();
  });

  it('tracks giveaway entries, endings, and reroll draws', () => {
    const store = createStore();
    const giveaway = store.createGiveaway({
      guildId: 'guild',
      channelId: 'channel',
      messageId: 'message',
      hostId: 'host',
      prize: 'Prize',
      description: 'Description',
      winnerCount: 2,
      requiredRoleId: null,
      minimumLevel: 0,
      endsAt: 1000,
    });
    expect(store.toggleGiveawayEntryIfActive(giveaway.id, 'one', 1)).toBe('entered');
    expect(store.toggleGiveawayEntryIfActive(giveaway.id, 'one', 2)).toBe('left');
    expect(store.toggleGiveawayEntryIfActive(giveaway.id, 'one', 3)).toBe('entered');
    expect(store.addGiveawayEntry(giveaway.id, 'two', 4)).toBe(true);
    expect(store.countGiveawayEntries(giveaway.id)).toBe(2);
    expect(store.listDueGiveaways(999)).toHaveLength(0);
    expect(store.listDueGiveaways(1000)).toHaveLength(1);
    expect(store.setGiveawayStatusIfActive(giveaway.id, 'ended', 'bot', 1001)?.status).toBe('ended');
    expect(store.toggleGiveawayEntryIfActive(giveaway.id, 'three', 1002)).toBeNull();
    expect(store.setGiveawayStatusIfActive(giveaway.id, 'cancelled', 'bot', 1002)).toBeNull();
    store.addGiveawayWinners(giveaway.id, ['one', 'two'], 1, 1003);
    expect(store.nextGiveawayDrawNumber(giveaway.id)).toBe(2);
    store.addGiveawayWinners(giveaway.id, ['two'], 2, 1004);
    expect(store.listLatestGiveawayWinners(giveaway.id).map((winner) => winner.userId)).toEqual(['two']);
    store.close();
  });

  it('tracks event RSVPs, reminders, and completion', () => {
    const store = createStore();
    const event = store.createRecreationEvent({
      guildId: 'guild',
      channelId: 'events',
      messageId: 'event-message',
      hostId: 'host',
      title: 'Game Night',
      description: 'Play together',
      location: 'Voice',
      capacity: 5,
      startsAt: 120_000,
      endsAt: 240_000,
      reminderMinutes: 1,
    });
    expect(store.tryUpsertRecreationEventRsvp(event.id, 'one', 'going', 1, 1)).not.toBeNull();
    expect(store.tryUpsertRecreationEventRsvp(event.id, 'two', 'going', 1, 2)).toBeNull();
    store.upsertRecreationEventRsvp(event.id, 'two', 'maybe');
    store.upsertRecreationEventRsvp(event.id, 'one', 'declined');
    expect(store.countRecreationEventRsvps(event.id, 'going')).toBe(0);
    expect(store.countRecreationEventRsvps(event.id, 'maybe')).toBe(1);
    expect(store.countRecreationEventRsvps(event.id, 'declined')).toBe(1);
    expect(store.listDueRecreationEventReminders(59_999)).toHaveLength(0);
    expect(store.listDueRecreationEventReminders(60_000)).toHaveLength(1);
    store.markRecreationEventReminderSent(event.id);
    expect(store.listDueRecreationEventReminders(60_001)).toHaveLength(0);
    expect(store.listCompletedRecreationEvents(239_999)).toHaveLength(0);
    expect(store.listCompletedRecreationEvents(240_000)).toHaveLength(1);
    expect(store.setRecreationEventStatus(event.id, 'completed')?.status).toBe('completed');
    store.close();
  });
});

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
  const directory = mkdtempSync(join(tmpdir(), 'hit-ticket-test-'));
  directories.push(directory);
  return new Store(join(directory, 'hit.sqlite'));
}

describe('ticket store', () => {
  it('saves settings and tracks a ticket lifecycle', () => {
    const store = createStore();
    const settings = store.upsertTicketSettings({
      guildId: 'guild',
      categoryId: 'category',
      panelChannelId: 'panel',
      supportRoleId: 'support',
      logChannelId: 'log',
      maxOpenPerUser: 1,
    });
    expect(settings.maxOpenPerUser).toBe(1);
    expect(store.getTicketSettings('guild')?.supportRoleId).toBe('support');

    const ticket = store.createTicket({
      guildId: 'guild',
      channelId: 'channel',
      openerId: 'member',
      type: 'general',
    });
    expect(ticket.status).toBe('open');
    expect(store.countOpenTicketsForUser('guild', 'member')).toBe(1);

    expect(store.setTicketClaim(ticket.id, 'staff').claimedBy).toBe('staff');
    expect(store.setTicketStatus(ticket.id, 'closed').status).toBe('closed');
    expect(store.countOpenTicketsForUser('guild', 'member')).toBe(0);

    store.deleteTicket(ticket.id);
    expect(store.getTicketByChannel('channel')).toBeNull();
    store.close();
  });
});

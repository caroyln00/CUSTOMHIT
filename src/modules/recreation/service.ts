import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import type {
  GiveawayRecord,
  RecreationEventRecord,
  RecreationEventResponse,
  RecreationSettings,
  Store,
} from '../../core/store.js';
import { logger } from '../../core/logger.js';
import { levelFromXp } from '../levels/utils.js';
import { chooseUnique, cleanRecreationText, formatDuration, parseDuration } from './utils.js';

const COLOR = 0x7c3aed;
const SUCCESS = 0x22c55e;
const WARNING = 0xf59e0b;
const FAILURE = 0xef4444;
const GIVEAWAY_TOGGLE_ID = 'hit:recreation:giveaway-toggle';
const EVENT_GOING_ID = 'hit:recreation:event-going';
const EVENT_MAYBE_ID = 'hit:recreation:event-maybe';
const EVENT_DECLINED_ID = 'hit:recreation:event-declined';
const HELP_DELETE_MS = 15_000;

function requireSettings(store: Store, guildId: string): RecreationSettings {
  const settings = store.getRecreationSettings(guildId);
  if (!settings) throw new Error('HIT recreation is not configured. Run /recreation setup.');
  return settings;
}

async function requireManager(guild: Guild, userId: string): Promise<GuildMember> {
  const member = await guild.members.fetch(userId);
  if (!member.permissions.has(PermissionFlagsBits.ManageGuild)
    && !member.permissions.has(PermissionFlagsBits.Administrator)) {
    throw new Error('You need Manage Server permission to use that recreation action.');
  }
  return member;
}

async function fetchTextChannel(guild: Guild, channelId: string, label: string): Promise<TextChannel> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`${label} must point to a standard text channel.`);
  }
  return channel;
}

function unix(milliseconds: number): number {
  return Math.floor(milliseconds / 1000);
}

function giveawayStatusLabel(record: GiveawayRecord): string {
  if (record.status === 'active') return 'ACTIVE';
  if (record.status === 'cancelled') return 'CANCELLED';
  return 'ENDED';
}

function eventStatusLabel(record: RecreationEventRecord): string {
  if (record.status === 'scheduled') return 'SCHEDULED';
  if (record.status === 'cancelled') return 'CANCELLED';
  return 'COMPLETED';
}

function giveawayEmbed(record: GiveawayRecord, entryCount: number, winnerIds: string[] = []): EmbedBuilder {
  const requirements = [
    record.requiredRoleId ? `Role: <@&${record.requiredRoleId}>` : null,
    record.minimumLevel > 0 ? `Minimum level: ${record.minimumLevel}` : null,
  ].filter(Boolean).join('\n') || 'No additional requirements.';
  const embed = new EmbedBuilder()
    .setColor(record.status === 'active' ? COLOR : record.status === 'ended' ? SUCCESS : FAILURE)
    .setTitle(record.prize.toUpperCase())
    .setDescription(record.description)
    .addFields(
      { name: 'Giveaway ID', value: String(record.id), inline: true },
      { name: 'Status', value: giveawayStatusLabel(record), inline: true },
      { name: 'Hosted by', value: `<@${record.hostId}>`, inline: true },
      { name: 'Winners', value: String(record.winnerCount), inline: true },
      { name: 'Entries', value: String(entryCount), inline: true },
      { name: 'Ends', value: record.status === 'active' ? `<t:${unix(record.endsAt)}:R>` : `<t:${unix(record.endsAt)}:f>`, inline: true },
      { name: 'Requirements', value: requirements, inline: false },
    )
    .setFooter({ text: record.status === 'active' ? 'Use the button below to enter or leave.' : 'This giveaway is closed.' });
  if (winnerIds.length > 0) {
    embed.addFields({ name: 'Selected winners', value: winnerIds.map((id) => `<@${id}>`).join(', ') });
  } else if (record.status === 'ended') {
    embed.addFields({ name: 'Selected winners', value: 'No eligible winners were available.' });
  }
  return embed;
}

function giveawayControls(record: GiveawayRecord): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(GIVEAWAY_TOGGLE_ID)
      .setLabel(record.status === 'active' ? 'Enter or Leave' : 'Giveaway Closed')
      .setStyle(record.status === 'active' ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(record.status !== 'active'),
  );
}

function eventCounts(record: RecreationEventRecord, store: Store): { going: number; maybe: number; declined: number } {
  return {
    going: store.countRecreationEventRsvps(record.id, 'going'),
    maybe: store.countRecreationEventRsvps(record.id, 'maybe'),
    declined: store.countRecreationEventRsvps(record.id, 'declined'),
  };
}

function eventEmbed(record: RecreationEventRecord, store: Store): EmbedBuilder {
  const counts = eventCounts(record, store);
  const capacity = record.capacity > 0 ? `${counts.going}/${record.capacity}` : `${counts.going}/Unlimited`;
  return new EmbedBuilder()
    .setColor(record.status === 'scheduled' ? COLOR : record.status === 'completed' ? SUCCESS : FAILURE)
    .setTitle(record.title.toUpperCase())
    .setDescription(record.description)
    .addFields(
      { name: 'Event ID', value: String(record.id), inline: true },
      { name: 'Status', value: eventStatusLabel(record), inline: true },
      { name: 'Hosted by', value: `<@${record.hostId}>`, inline: true },
      { name: 'Starts', value: `<t:${unix(record.startsAt)}:F>\n<t:${unix(record.startsAt)}:R>`, inline: true },
      { name: 'Ends', value: `<t:${unix(record.endsAt)}:t>`, inline: true },
      { name: 'Location', value: record.location, inline: true },
      { name: 'Attending', value: capacity, inline: true },
      { name: 'Maybe', value: String(counts.maybe), inline: true },
      { name: 'Not Attending', value: String(counts.declined), inline: true },
    )
    .setFooter({ text: record.status === 'scheduled' ? 'Use the buttons below to update your RSVP.' : 'RSVPs are closed.' });
}

function eventControls(record: RecreationEventRecord): ActionRowBuilder<ButtonBuilder> {
  const disabled = record.status !== 'scheduled';
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(EVENT_GOING_ID).setLabel('Attending').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(EVENT_MAYBE_ID).setLabel('Maybe').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(EVENT_DECLINED_ID).setLabel('Not Attending').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
  );
}

async function sendLog(guild: Guild, settings: RecreationSettings, title: string, description: string, color = COLOR): Promise<void> {
  const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  await channel.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()] }).catch(() => undefined);
}

async function notificationContent(guild: Guild, settings: RecreationSettings): Promise<{ content?: string; roles: string[] }> {
  if (!settings.notificationRoleId) return { roles: [] };
  const role = await guild.roles.fetch(settings.notificationRoleId).catch(() => null);
  if (!role) return { roles: [] };
  const me = guild.members.me ?? await guild.members.fetchMe();
  if (!role.mentionable && !me.permissions.has(PermissionFlagsBits.MentionEveryone)) return { roles: [] };
  return { content: `<@&${role.id}>`, roles: [role.id] };
}

async function refreshGiveaway(guild: Guild, record: GiveawayRecord, store: Store): Promise<void> {
  const channel = await fetchTextChannel(guild, record.channelId, 'Giveaway channel').catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(record.messageId).catch(() => null);
  if (!message) return;
  const winners = store.listLatestGiveawayWinners(record.id).map((winner) => winner.userId);
  await message.edit({ embeds: [giveawayEmbed(record, store.countGiveawayEntries(record.id), winners)], components: [giveawayControls(record)] }).catch(() => undefined);
}

async function refreshEvent(guild: Guild, record: RecreationEventRecord, store: Store): Promise<void> {
  const channel = await fetchTextChannel(guild, record.channelId, 'Event channel').catch(() => null);
  if (!channel) return;
  const message = await channel.messages.fetch(record.messageId).catch(() => null);
  if (!message) return;
  await message.edit({ embeds: [eventEmbed(record, store)], components: [eventControls(record)] }).catch(() => undefined);
}

async function eligibleGiveawayMembers(guild: Guild, record: GiveawayRecord, store: Store): Promise<string[]> {
  const eligible: string[] = [];
  for (const entry of store.listGiveawayEntries(record.id)) {
    const member = await guild.members.fetch(entry.userId).catch(() => null);
    if (!member || member.user.bot || member.id === record.hostId) continue;
    if (record.requiredRoleId && !member.roles.cache.has(record.requiredRoleId)) continue;
    if (record.minimumLevel > 0) {
      const profile = store.getLevelProfile(guild.id, member.id);
      if (levelFromXp(profile?.xp ?? 0) < record.minimumLevel) continue;
    }
    eligible.push(member.id);
  }
  return eligible;
}

async function finishGiveaway(guild: Guild, record: GiveawayRecord, actorId: string, store: Store): Promise<GiveawayRecord> {
  const ended = store.setGiveawayStatusIfActive(record.id, 'ended', actorId);
  if (!ended) throw new Error('That giveaway is no longer active.');
  const eligible = await eligibleGiveawayMembers(guild, ended, store);
  const selected = chooseUnique(eligible, ended.winnerCount);
  if (selected.length > 0) {
    store.recordGiveawayWinners(ended.id, selected);
  }
  await refreshGiveaway(guild, ended, store);
  const channel = await fetchTextChannel(guild, ended.channelId, 'Giveaway channel').catch(() => null);
  if (channel) {
    const announcement = selected.length > 0
      ? `Giveaway #${ended.id} ended. Winners: ${selected.map((id) => `<@${id}>`).join(', ')}. Prize: **${ended.prize}**.`
      : `Giveaway #${ended.id} ended without enough eligible entries. Prize: **${ended.prize}**.`;
    await channel.send({ content: announcement, allowedMentions: { users: selected } }).catch(() => undefined);
  }
  const settings = requireSettings(store, guild.id);
  await sendLog(guild, settings, 'GIVEAWAY ENDED', [
    `Giveaway: #${ended.id}`,
    `Prize: ${ended.prize}`,
    `Actor: <@${actorId}>`,
    `Eligible entries: ${eligible.length}`,
    `Winners: ${selected.length > 0 ? selected.map((id) => `<@${id}>`).join(', ') : 'None'}`,
  ].join('\n'), SUCCESS);
  return ended;
}

async function rerollGiveaway(guild: Guild, record: GiveawayRecord, actorId: string, store: Store): Promise<string[]> {
  if (record.status !== 'ended') throw new Error('Only an ended giveaway can be rerolled.');
  const eligible = await eligibleGiveawayMembers(guild, record, store);
  const previous = new Set(store.listLatestGiveawayWinners(record.id).map((winner) => winner.userId));
  const fresh = eligible.filter((id) => !previous.has(id));
  const pool = fresh.length >= record.winnerCount ? fresh : eligible;
  const selected = chooseUnique(pool, record.winnerCount);
  if (selected.length === 0) throw new Error('No eligible entries are available for a reroll.');
  store.recordGiveawayWinners(record.id, selected);
  await refreshGiveaway(guild, record, store);
  const channel = await fetchTextChannel(guild, record.channelId, 'Giveaway channel').catch(() => null);
  if (channel) {
    await channel.send({
      content: `Giveaway #${record.id} was rerolled. New winner${selected.length === 1 ? '' : 's'}: ${selected.map((id) => `<@${id}>`).join(', ')}.`,
      allowedMentions: { users: selected },
    }).catch(() => undefined);
  }
  const settings = requireSettings(store, guild.id);
  await sendLog(guild, settings, 'GIVEAWAY REROLLED', `Giveaway: #${record.id}\nActor: <@${actorId}>\nWinners: ${selected.map((id) => `<@${id}>`).join(', ')}`, WARNING);
  return selected;
}

async function cancelGiveaway(guild: Guild, record: GiveawayRecord, actorId: string, store: Store): Promise<GiveawayRecord> {
  const cancelled = store.setGiveawayStatusIfActive(record.id, 'cancelled', actorId);
  if (!cancelled) throw new Error('That giveaway is no longer active.');
  await refreshGiveaway(guild, cancelled, store);
  const settings = requireSettings(store, guild.id);
  await sendLog(guild, settings, 'GIVEAWAY CANCELLED', `Giveaway: #${record.id}\nPrize: ${record.prize}\nActor: <@${actorId}>`, FAILURE);
  return cancelled;
}

async function sendEventReminder(guild: Guild, record: RecreationEventRecord, store: Store, manual = false): Promise<void> {
  const current = store.getRecreationEvent(guild.id, record.id);
  if (!current || current.status !== 'scheduled' || current.startsAt <= Date.now()) {
    if (manual) throw new Error('That event is no longer scheduled for a future time.');
    return;
  }
  const channel = await fetchTextChannel(guild, current.channelId, 'Event channel');
  const going = store.listRecreationEventRsvps(current.id).filter((rsvp) => rsvp.response === 'going').map((rsvp) => rsvp.userId);
  const mentioned = going.slice(0, 50);
  const settings = requireSettings(store, guild.id);
  const notify = await notificationContent(guild, settings);
  const content = [
    notify.content,
    `Event #${current.id}, **${current.title}**, starts <t:${unix(current.startsAt)}:R>.`,
    going.length > 0
      ? `Confirmed attendees (${going.length}): ${mentioned.map((id) => `<@${id}>`).join(', ')}${going.length > mentioned.length ? ` and ${going.length - mentioned.length} more` : ''}`
      : 'No confirmed attendees yet.',
  ].filter(Boolean).join('\n');
  await channel.send({ content, allowedMentions: { roles: notify.roles, users: mentioned } });
  if (!manual) store.markRecreationEventReminderSent(current.id);
  await sendLog(guild, settings, manual ? 'EVENT REMINDER SENT MANUALLY' : 'EVENT REMINDER SENT', `Event: #${current.id}\nTitle: ${current.title}\nStarts: <t:${unix(current.startsAt)}:F>`, WARNING);
}

async function completeEvent(guild: Guild, record: RecreationEventRecord, store: Store): Promise<void> {
  const completed = store.setRecreationEventStatus(record.id, 'completed');
  if (!completed) return;
  await refreshEvent(guild, completed, store);
  const settings = requireSettings(store, guild.id);
  await sendLog(guild, settings, 'EVENT COMPLETED', `Event: #${completed.id}\nTitle: ${completed.title}\nHost: <@${completed.hostId}>`, SUCCESS);
}

async function cancelEvent(guild: Guild, record: RecreationEventRecord, actorId: string, store: Store): Promise<RecreationEventRecord> {
  const cancelled = store.setRecreationEventStatus(record.id, 'cancelled');
  if (!cancelled) throw new Error('That event is no longer scheduled.');
  await refreshEvent(guild, cancelled, store);
  const channel = await fetchTextChannel(guild, cancelled.channelId, 'Event channel').catch(() => null);
  if (channel) {
    await channel.send({ content: `Event #${cancelled.id}, **${cancelled.title}**, was cancelled.` }).catch(() => undefined);
  }
  const settings = requireSettings(store, guild.id);
  await sendLog(guild, settings, 'EVENT CANCELLED', `Event: #${cancelled.id}\nTitle: ${cancelled.title}\nActor: <@${actorId}>`, FAILURE);
  return cancelled;
}

function boundedField(lines: string[], empty: string): string {
  if (lines.length === 0) return empty;
  let value = '';
  for (const raw of lines) {
    const line = raw.slice(0, 220);
    const candidate = value ? `${value}\n${line}` : line;
    if (candidate.length > 1000) break;
    value = candidate;
  }
  return value || empty;
}

function activeEmbed(guild: Guild, store: Store): EmbedBuilder {
  const giveaways = store.listActiveGiveaways(guild.id, 10);
  const events = store.listScheduledRecreationEvents(guild.id, 10);
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('ACTIVE GIVEAWAYS AND EVENTS')
    .addFields(
      {
        name: 'Giveaways',
        value: boundedField(
          giveaways.map((item) => `#${item.id} — **${item.prize}** — <#${item.channelId}> — <t:${unix(item.endsAt)}:R>`),
          'No active giveaways.',
        ),
      },
      {
        name: 'Events',
        value: boundedField(
          events.map((item) => `#${item.id} — **${item.title}** — <#${item.channelId}> — <t:${unix(item.startsAt)}:R>`),
          'No scheduled events.',
        ),
      },
    );
}

async function diagnose(guild: Guild, settings: RecreationSettings): Promise<string[]> {
  const me = guild.members.me ?? await guild.members.fetchMe();
  const lines: string[] = [];
  for (const [label, channelId] of [
    ['Giveaway channel', settings.giveawayChannelId],
    ['Event channel', settings.eventChannelId],
    ['Log channel', settings.logChannelId],
  ] as const) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    const valid = channel?.type === ChannelType.GuildText;
    lines.push(`${valid ? 'PASS' : 'FAIL'} ${label} — Configured channel must be a standard text channel.`);
    if (valid) {
      const permissions = channel.permissionsFor(me);
      lines.push(`${permissions?.has(PermissionFlagsBits.ViewChannel) ? 'PASS' : 'FAIL'} ${label} view access — HIT must see the channel.`);
      lines.push(`${permissions?.has(PermissionFlagsBits.SendMessages) ? 'PASS' : 'FAIL'} ${label} send access — HIT must send recreation messages.`);
      lines.push(`${permissions?.has(PermissionFlagsBits.EmbedLinks) ? 'PASS' : 'FAIL'} ${label} embed access — HIT must send embedded recreation posts.`);
      lines.push(`${permissions?.has(PermissionFlagsBits.ReadMessageHistory) ? 'PASS' : 'FAIL'} ${label} history access — HIT must update its existing posts.`);
    }
  }
  if (settings.notificationRoleId) {
    const role = await guild.roles.fetch(settings.notificationRoleId).catch(() => null);
    lines.push(`${role ? 'PASS' : 'FAIL'} Notification role — Configured notification role must exist.`);
  }
  return lines;
}

export async function handleRecreationSlashCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<void> {
  if (!interaction.inCachedGuild()) throw new Error('This command can only be used in a server.');
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'active') {
    requireSettings(store, interaction.guildId);
    await interaction.reply({ embeds: [activeEmbed(interaction.guild, store)], flags: MessageFlags.Ephemeral });
    return;
  }

  await requireManager(interaction.guild, interaction.user.id);

  if (subcommand === 'setup') {
    const giveawayChannel = interaction.options.getChannel('giveaway_channel', true);
    const eventChannel = interaction.options.getChannel('event_channel', true);
    const logChannel = interaction.options.getChannel('log_channel', true);
    if (giveawayChannel.type !== ChannelType.GuildText || eventChannel.type !== ChannelType.GuildText || logChannel.type !== ChannelType.GuildText) {
      throw new Error('Giveaway, event, and log channels must be standard text channels.');
    }
    const role = interaction.options.getRole('notification_role');
    const settings = store.upsertRecreationSettings({
      guildId: interaction.guildId,
      giveawayChannelId: giveawayChannel.id,
      eventChannelId: eventChannel.id,
      logChannelId: logChannel.id,
      notificationRoleId: role?.id ?? null,
      defaultGiveawayMinutes: interaction.options.getInteger('default_giveaway_minutes') ?? 1440,
      defaultEventReminderMinutes: interaction.options.getInteger('default_event_reminder_minutes') ?? 60,
    });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(SUCCESS).setTitle('HIT RECREATION CONFIGURED').addFields(
        { name: 'Giveaways', value: `<#${settings.giveawayChannelId}>`, inline: true },
        { name: 'Events', value: `<#${settings.eventChannelId}>`, inline: true },
        { name: 'Logs', value: `<#${settings.logChannelId}>`, inline: true },
        { name: 'Notification role', value: settings.notificationRoleId ? `<@&${settings.notificationRoleId}>` : 'None', inline: true },
        { name: 'Default giveaway duration', value: `${settings.defaultGiveawayMinutes} minutes`, inline: true },
        { name: 'Default event reminder', value: `${settings.defaultEventReminderMinutes} minutes`, inline: true },
      )],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const settings = requireSettings(store, interaction.guildId);

  if (subcommand === 'diagnose') {
    const lines = await diagnose(interaction.guild, settings);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(lines.every((line) => line.startsWith('PASS')) ? SUCCESS : FAILURE)
        .setTitle('HIT RECREATION DIAGNOSTICS')
        .setDescription(lines.join('\n'))],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === 'config') {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR).setTitle('HIT RECREATION CONFIGURATION').addFields(
        { name: 'Giveaway channel', value: `<#${settings.giveawayChannelId}>`, inline: true },
        { name: 'Event channel', value: `<#${settings.eventChannelId}>`, inline: true },
        { name: 'Log channel', value: `<#${settings.logChannelId}>`, inline: true },
        { name: 'Notification role', value: settings.notificationRoleId ? `<@&${settings.notificationRoleId}>` : 'None', inline: true },
        { name: 'Default giveaway duration', value: `${settings.defaultGiveawayMinutes} minutes`, inline: true },
        { name: 'Default event reminder', value: `${settings.defaultEventReminderMinutes} minutes`, inline: true },
        { name: 'Active giveaways', value: String(store.listActiveGiveaways(interaction.guildId).length), inline: true },
        { name: 'Scheduled events', value: String(store.listScheduledRecreationEvents(interaction.guildId).length), inline: true },
      )],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (subcommand === 'giveaway-create') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channelOption = interaction.options.getChannel('channel');
    const channelId = channelOption?.id ?? settings.giveawayChannelId;
    const channel = await fetchTextChannel(interaction.guild, channelId, 'Giveaway channel');
    const prize = cleanRecreationText(interaction.options.getString('prize', true), 150);
    if (!prize) throw new Error('Prize must contain visible text.');
    const description = cleanRecreationText(interaction.options.getString('description') ?? 'Enter for a chance to win.', 1000) || 'Enter for a chance to win.';
    const durationInput = interaction.options.getString('duration') ?? `${settings.defaultGiveawayMinutes}m`;
    const durationMs = parseDuration(durationInput);
    const winnerCount = interaction.options.getInteger('winners') ?? 1;
    const requiredRole = interaction.options.getRole('required_role');
    const minimumLevel = interaction.options.getInteger('minimum_level') ?? 0;
    const placeholder = await channel.send('Creating giveaway...');
    let record: GiveawayRecord;
    try {
      record = store.createGiveaway({
        guildId: interaction.guildId,
        channelId: channel.id,
        messageId: placeholder.id,
        hostId: interaction.user.id,
        prize,
        description,
        winnerCount,
        requiredRoleId: requiredRole?.id ?? null,
        minimumLevel,
        endsAt: Date.now() + durationMs,
      });
    } catch (error) {
      await placeholder.delete().catch(() => undefined);
      throw error;
    }
    const notify = await notificationContent(interaction.guild, settings);
    await placeholder.edit({
      content: notify.content ?? null,
      embeds: [giveawayEmbed(record, 0)],
      components: [giveawayControls(record)],
      allowedMentions: { roles: notify.roles },
    });
    await sendLog(interaction.guild, settings, 'GIVEAWAY CREATED', `Giveaway: #${record.id}\nPrize: ${record.prize}\nHost: <@${record.hostId}>\nDuration: ${formatDuration(durationMs)}\nChannel: <#${channel.id}>`, SUCCESS);
    await interaction.editReply(`Giveaway #${record.id} was created in <#${channel.id}>.`);
    return;
  }

  if (subcommand === 'giveaway-end' || subcommand === 'giveaway-reroll' || subcommand === 'giveaway-cancel') {
    const id = interaction.options.getInteger('id', true);
    const record = store.getGiveaway(interaction.guildId, id);
    if (!record) throw new Error(`Giveaway #${id} was not found.`);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (subcommand === 'giveaway-end') {
      await finishGiveaway(interaction.guild, record, interaction.user.id, store);
      await interaction.editReply(`Giveaway #${id} ended.`);
    } else if (subcommand === 'giveaway-reroll') {
      const winners = await rerollGiveaway(interaction.guild, record, interaction.user.id, store);
      await interaction.editReply(`Giveaway #${id} was rerolled with ${winners.length} winner${winners.length === 1 ? '' : 's'}.`);
    } else {
      await cancelGiveaway(interaction.guild, record, interaction.user.id, store);
      await interaction.editReply(`Giveaway #${id} was cancelled.`);
    }
    return;
  }

  if (subcommand === 'event-create') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channelOption = interaction.options.getChannel('channel');
    const channelId = channelOption?.id ?? settings.eventChannelId;
    const channel = await fetchTextChannel(interaction.guild, channelId, 'Event channel');
    const title = cleanRecreationText(interaction.options.getString('title', true), 150);
    if (!title) throw new Error('Event title must contain visible text.');
    const description = cleanRecreationText(interaction.options.getString('description') ?? 'Community event.', 1000) || 'Community event.';
    const startsIn = parseDuration(interaction.options.getString('starts_in', true));
    const durationMinutes = interaction.options.getInteger('duration_minutes') ?? 120;
    const startsAt = Date.now() + startsIn;
    const endsAt = startsAt + durationMinutes * 60_000;
    const location = cleanRecreationText(interaction.options.getString('location') ?? 'To be announced.', 200) || 'To be announced.';
    const capacity = interaction.options.getInteger('capacity') ?? 0;
    const reminderMinutes = interaction.options.getInteger('reminder_minutes') ?? settings.defaultEventReminderMinutes;
    const placeholder = await channel.send('Creating event...');
    let record: RecreationEventRecord;
    try {
      record = store.createRecreationEvent({
        guildId: interaction.guildId,
        channelId: channel.id,
        messageId: placeholder.id,
        hostId: interaction.user.id,
        title,
        description,
        location,
        capacity,
        startsAt,
        endsAt,
        reminderMinutes,
      });
    } catch (error) {
      await placeholder.delete().catch(() => undefined);
      throw error;
    }
    const notify = await notificationContent(interaction.guild, settings);
    await placeholder.edit({
      content: notify.content ?? null,
      embeds: [eventEmbed(record, store)],
      components: [eventControls(record)],
      allowedMentions: { roles: notify.roles },
    });
    await sendLog(interaction.guild, settings, 'EVENT CREATED', `Event: #${record.id}\nTitle: ${record.title}\nHost: <@${record.hostId}>\nStarts: <t:${unix(record.startsAt)}:F>\nChannel: <#${channel.id}>`, SUCCESS);
    await interaction.editReply(`Event #${record.id} was created in <#${channel.id}>.`);
    return;
  }

  if (subcommand === 'event-cancel' || subcommand === 'event-remind') {
    const id = interaction.options.getInteger('id', true);
    const record = store.getRecreationEvent(interaction.guildId, id);
    if (!record) throw new Error(`Event #${id} was not found.`);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (subcommand === 'event-cancel') {
      await cancelEvent(interaction.guild, record, interaction.user.id, store);
      await interaction.editReply(`Event #${id} was cancelled.`);
    } else {
      if (record.status !== 'scheduled') throw new Error('Only a scheduled event can receive a reminder.');
      await sendEventReminder(interaction.guild, record, store, true);
      await interaction.editReply(`A reminder was sent for event #${id}.`);
    }
    return;
  }

  throw new Error('Unknown recreation subcommand.');
}

export async function handleRecreationInteraction(interaction: ButtonInteraction, store: Store): Promise<boolean> {
  if (![GIVEAWAY_TOGGLE_ID, EVENT_GOING_ID, EVENT_MAYBE_ID, EVENT_DECLINED_ID].includes(interaction.customId)) return false;
  if (!interaction.inCachedGuild()) throw new Error('This control can only be used in a server.');
  requireSettings(store, interaction.guildId);
  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (interaction.customId === GIVEAWAY_TOGGLE_ID) {
    const record = store.getGiveawayByMessageId(interaction.message.id);
    if (!record || record.guildId !== interaction.guildId) throw new Error('This giveaway is no longer registered.');
    if (record.status !== 'active' || record.endsAt <= Date.now()) throw new Error('This giveaway is closed.');
    if (member.id === record.hostId) throw new Error('The giveaway host cannot enter their own giveaway.');
    if (record.requiredRoleId && !member.roles.cache.has(record.requiredRoleId)) throw new Error('You do not have the required role for this giveaway.');
    if (record.minimumLevel > 0) {
      const profile = store.getLevelProfile(interaction.guildId, member.id);
      if (levelFromXp(profile?.xp ?? 0) < record.minimumLevel) throw new Error(`You must be level ${record.minimumLevel} to enter.`);
    }
    const result = store.toggleGiveawayEntryIfActive(record.id, member.id);
    if (!result) throw new Error('This giveaway closed before your entry was processed.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await refreshGiveaway(interaction.guild, record, store);
    await interaction.editReply(result === 'left' ? `You left giveaway #${record.id}.` : `You entered giveaway #${record.id}.`);
    return true;
  }

  const record = store.getRecreationEventByMessageId(interaction.message.id);
  if (!record || record.guildId !== interaction.guildId) throw new Error('This event is no longer registered.');
  if (record.status !== 'scheduled' || record.endsAt <= Date.now()) throw new Error('RSVPs are closed for this event.');
  const response: RecreationEventResponse = interaction.customId === EVENT_GOING_ID
    ? 'going'
    : interaction.customId === EVENT_MAYBE_ID
      ? 'maybe'
      : 'declined';
  const updatedRsvp = store.tryUpsertRecreationEventRsvp(record.id, member.id, response, record.capacity);
  if (!updatedRsvp) {
    if (response === 'going' && record.capacity > 0) throw new Error('This event has reached its attendee capacity or has closed.');
    throw new Error('RSVPs closed before your response was processed.');
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await refreshEvent(interaction.guild, record, store);
  await interaction.editReply(`Your RSVP for event #${record.id} is now ${response === 'declined' ? 'not attending' : response === 'going' ? 'attending' : 'maybe'}.`);
  return true;
}

function deleteLater(message: Message): void {
  setTimeout(() => void message.delete().catch(() => undefined), HELP_DELETE_MS);
}

export async function handleRecreationPrefixCommand(message: Message, store: Store, defaultPrefix: string): Promise<void> {
  if (!message.guild || !message.member || message.author.bot) return;
  const prefix = store.getGuildSettings(message.guild.id)?.prefix ?? defaultPrefix;
  if (!message.content.startsWith(prefix)) return;
  const body = message.content.slice(prefix.length).trim();
  const [rawCommand, rawAction, rawId] = body.split(/\s+/);
  const command = rawCommand?.toLowerCase();
  if (command !== 'giveaway' && command !== 'event' && command !== 'recreation') return;
  requireSettings(store, message.guild.id);
  const action = rawAction?.toLowerCase() ?? 'help';

  if (action === 'active' || action === 'list') {
    await message.reply({ embeds: [activeEmbed(message.guild, store)] });
    return;
  }

  const adminActions = command === 'giveaway'
    ? new Set(['end', 'reroll', 'cancel'])
    : new Set(['cancel', 'remind']);
  if (adminActions.has(action)) {
    await requireManager(message.guild, message.author.id);
    const id = Number.parseInt(rawId ?? '', 10);
    if (!Number.isInteger(id) || id < 1) throw new Error(`Usage: ${prefix}${command} ${action} <id>`);
    if (command === 'giveaway') {
      const record = store.getGiveaway(message.guild.id, id);
      if (!record) throw new Error(`Giveaway #${id} was not found.`);
      if (action === 'end') await finishGiveaway(message.guild, record, message.author.id, store);
      else if (action === 'reroll') await rerollGiveaway(message.guild, record, message.author.id, store);
      else await cancelGiveaway(message.guild, record, message.author.id, store);
      await message.reply(`Giveaway #${id} ${action === 'end' ? 'ended' : action === 'reroll' ? 'rerolled' : 'cancelled'}.`);
    } else {
      const record = store.getRecreationEvent(message.guild.id, id);
      if (!record) throw new Error(`Event #${id} was not found.`);
      if (action === 'cancel') await cancelEvent(message.guild, record, message.author.id, store);
      else await sendEventReminder(message.guild, record, store, true);
      await message.reply(`Event #${id} ${action === 'cancel' ? 'cancelled' : 'reminder sent'}.`);
    }
    return;
  }

  const reply = await message.reply([
    '**HIT RECREATION COMMANDS**',
    `\`${prefix}recreation active\``,
    `\`${prefix}giveaway active\``,
    `\`${prefix}event active\``,
    'Staff create giveaways and events with `/recreation`.',
    'Staff management: `;giveaway end <id>`, `;giveaway reroll <id>`, `;giveaway cancel <id>`, `;event cancel <id>`, `;event remind <id>`.',
    '',
    'This help message will be removed automatically.',
  ].join('\n'));
  deleteLater(message);
  deleteLater(reply);
}

export function startRecreationWorker(client: Client, store: Store): NodeJS.Timeout {
  const refreshScheduledEventPosts = async (): Promise<void> => {
    for (const guild of client.guilds.cache.values()) {
      for (const record of store.listScheduledRecreationEvents(guild.id, 100)) {
        try {
          await refreshEvent(guild, record, store);
        } catch (error) {
          logger.warn('Failed to refresh scheduled event post', { guildId: guild.id, eventId: record.id, error: String(error) });
        }
      }
    }
  };

  const run = async (): Promise<void> => {
    for (const record of store.listDueGiveaways()) {
      try {
        const guild = await client.guilds.fetch(record.guildId).catch(() => null);
        if (guild) await finishGiveaway(guild, record, client.user?.id ?? 'HIT', store);
      } catch (error) {
        logger.warn('Failed to finish giveaway', { guildId: record.guildId, giveawayId: record.id, error: String(error) });
      }
    }
    for (const record of store.listDueRecreationEventReminders()) {
      try {
        const guild = await client.guilds.fetch(record.guildId).catch(() => null);
        if (guild) await sendEventReminder(guild, record, store);
      } catch (error) {
        logger.warn('Failed to send event reminder', { guildId: record.guildId, eventId: record.id, error: String(error) });
      }
    }
    for (const record of store.listCompletedRecreationEvents()) {
      try {
        const guild = await client.guilds.fetch(record.guildId).catch(() => null);
        if (guild) await completeEvent(guild, record, store);
      } catch (error) {
        logger.warn('Failed to complete event', { guildId: record.guildId, eventId: record.id, error: String(error) });
      }
    }
  };
  void refreshScheduledEventPosts();
  void run();
  return setInterval(() => void run(), 30_000);
}

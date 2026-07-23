import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  TextChannel,
  User,
} from 'discord.js';
import type { Store, TicketRecord, TicketSettings } from '../../core/store.js';

const COLOR = 0x0f3d66;
const CREATE_PREFIX = 'hit:ticket:create:';
const CLAIM_ID = 'hit:ticket:claim';
const CLOSE_ID = 'hit:ticket:close';
const REOPEN_ID = 'hit:ticket:reopen';
const TRANSCRIPT_ID = 'hit:ticket:transcript';
const DELETE_ID = 'hit:ticket:delete';
const DELETE_CONFIRM_ID = 'hit:ticket:delete-confirm';

export const ticketKinds = {
  general: { label: 'General Support', emoji: '🎫', description: 'Questions, access problems, and general help.' },
  report: { label: 'Report Member', emoji: '🚨', description: 'Privately report a member or serious incident.' },
  appeal: { label: 'Punishment Appeal', emoji: '⚖️', description: 'Appeal a warning, timeout, kick, or ban.' },
  verification: { label: 'Verification Help', emoji: '🔒', description: 'Get help if verification is not working.' },
  partnership: { label: 'Business / Partnership', emoji: '🤝', description: 'Private partnership or business requests.' },
} as const;

export type TicketKind = keyof typeof ticketKinds;

function isTicketKind(value: string): value is TicketKind {
  return Object.prototype.hasOwnProperty.call(ticketKinds, value);
}

function requireTicketSettings(store: Store, guildId: string): TicketSettings {
  const settings = store.getTicketSettings(guildId);
  if (!settings) throw new Error('HIT tickets are not configured. Run /hit tickets-setup.');
  return settings;
}

function safeChannelPart(input: string): string {
  const value = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 45);
  return value || 'member';
}

function ticketChannelName(kind: TicketKind, user: User, closed = false): string {
  const base = `${closed ? 'closed' : 'ticket'}-${kind}-${safeChannelPart(user.username)}-${user.id.slice(-4)}`;
  return base.slice(0, 95);
}

function panelRows(): ActionRowBuilder<ButtonBuilder>[] {
  const buttons = (Object.entries(ticketKinds) as [TicketKind, (typeof ticketKinds)[TicketKind]][]).map(([kind, details]) => (
    new ButtonBuilder()
      .setCustomId(`${CREATE_PREFIX}${kind}`)
      .setLabel(details.label)
      .setEmoji(details.emoji)
      .setStyle(kind === 'report' ? ButtonStyle.Danger : ButtonStyle.Primary)
  ));
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)];
}

function openControls(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(CLAIM_ID).setLabel('Claim').setEmoji('🛡️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(TRANSCRIPT_ID).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CLOSE_ID).setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
}

function closedControls(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(REOPEN_ID).setLabel('Reopen').setEmoji('🔓').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(TRANSCRIPT_ID).setLabel('Transcript').setEmoji('📄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(DELETE_ID).setLabel('Delete').setEmoji('🗑️').setStyle(ButtonStyle.Danger),
  );
}

function ticketPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('SUPPORT TERMINAL')
    .setDescription([
      '**Open a private ticket only when staff involvement is necessary.**',
      '',
      'Choose the category that best matches your issue.',
      'Explain everything clearly in your first message and include evidence when relevant.',
      '',
      'Duplicate, joke, or abusive tickets may result in restricted support access.',
    ].join('\n'))
    .setFooter({ text: 'HIT Support • Private, recorded, controlled.' });
}

function isSupport(member: GuildMember, settings: TicketSettings): boolean {
  return member.roles.cache.has(settings.supportRoleId)
    || member.permissions.has(PermissionFlagsBits.ManageChannels)
    || member.permissions.has(PermissionFlagsBits.Administrator);
}

async function getTextTicketChannel(guild: Guild, channelId: string): Promise<TextChannel> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) throw new Error('This command must be used inside a HIT ticket channel.');
  return channel;
}

async function sendTicketLog(
  guild: Guild,
  settings: TicketSettings,
  embed: EmbedBuilder,
  file?: AttachmentBuilder,
): Promise<void> {
  const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  await channel.send({ embeds: [embed], files: file ? [file] : [] }).catch(() => undefined);
}

async function buildTranscript(channel: TextChannel, ticket: TicketRecord): Promise<AttachmentBuilder> {
  const messages = [];
  let before: string | undefined;
  while (messages.length < 1000) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (batch.size === 0) break;
    messages.push(...batch.values());
    before = batch.last()?.id;
    if (batch.size < 100) break;
  }
  messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = [
    `HIT Ticket Transcript`,
    `Ticket ID: ${ticket.id}`,
    `Guild: ${channel.guild.name} (${channel.guild.id})`,
    `Channel: #${channel.name} (${channel.id})`,
    `Opener: ${ticket.openerId}`,
    `Type: ${ticket.type}`,
    `Status: ${ticket.status}`,
    `Created: ${new Date(ticket.createdAt).toISOString()}`,
    '',
  ];
  for (const message of messages) {
    const attachments = [...message.attachments.values()].map((attachment) => attachment.url);
    const content = message.content || '[no text content]';
    lines.push(`[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag} (${message.author.id}): ${content}`);
    if (attachments.length) lines.push(`  Attachments: ${attachments.join(', ')}`);
    if (message.embeds.length) lines.push(`  Embeds: ${message.embeds.length}`);
  }
  return new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `hit-ticket-${ticket.id}.txt` });
}

async function createTicket(guild: Guild, user: User, kind: TicketKind, store: Store): Promise<TextChannel> {
  const settings = requireTicketSettings(store, guild.id);
  const openCount = store.countOpenTicketsForUser(guild.id, user.id);
  if (openCount >= settings.maxOpenPerUser) {
    const existing = store.getOpenTicketForUser(guild.id, user.id);
    if (existing) throw new Error(`You already have an open ticket: <#${existing.channelId}>`);
    throw new Error(`You already have ${openCount} open ticket(s).`);
  }

  const category = await guild.channels.fetch(settings.categoryId);
  if (!category || category.type !== ChannelType.GuildCategory) throw new Error('The configured ticket category no longer exists.');
  const supportRole = await guild.roles.fetch(settings.supportRoleId);
  if (!supportRole) throw new Error('The configured support role no longer exists.');
  const botMember = guild.members.me ?? await guild.members.fetchMe();

  const channel = await guild.channels.create({
    name: ticketChannelName(kind, user),
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `HIT ticket | opener=${user.id} | type=${kind}`,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.UseApplicationCommands,
        ],
      },
      {
        id: supportRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.UseApplicationCommands,
        ],
      },
      {
        id: botMember.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.UseApplicationCommands,
        ],
      },
    ],
    reason: `HIT ${ticketKinds[kind].label} ticket opened by ${user.tag}`,
  });

  let ticket: TicketRecord;
  try {
    ticket = store.createTicket({ guildId: guild.id, channelId: channel.id, openerId: user.id, type: kind });
  } catch (error) {
    await channel.delete('HIT database rollback').catch(() => undefined);
    throw error;
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${ticketKinds[kind].emoji} ${ticketKinds[kind].label.toUpperCase()}`)
    .setDescription([
      `<@${user.id}>, your private ticket is open.`,
      '',
      '**Explain the issue clearly in your first message.**',
      'Include usernames, dates, screenshots, message links, or other evidence when relevant.',
      '',
      `Ticket ID: \`${ticket.id}\``,
    ].join('\n'))
    .setFooter({ text: 'HIT Support • Staff actions are logged.' })
    .setTimestamp();
  const message = await channel.send({
    content: `<@${user.id}> <@&${settings.supportRoleId}>`,
    allowedMentions: { users: [user.id], roles: [settings.supportRoleId] },
    embeds: [embed],
    components: [openControls()],
  });
  await message.pin().catch(() => undefined);
  store.recordTicketEvent(ticket.id, guild.id, user.id, 'ticket_opened', { type: kind, channelId: channel.id });
  await sendTicketLog(guild, settings, new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('TICKET OPENED')
    .setDescription(`<@${user.id}> opened <#${channel.id}>.`)
    .addFields(
      { name: 'Ticket ID', value: String(ticket.id), inline: true },
      { name: 'Type', value: ticketKinds[kind].label, inline: true },
    )
    .setTimestamp());
  return channel;
}

async function requireTicketContext(
  guild: Guild,
  channelId: string,
  store: Store,
): Promise<{ channel: TextChannel; ticket: TicketRecord; settings: TicketSettings }> {
  const channel = await getTextTicketChannel(guild, channelId);
  const ticket = store.getTicketByChannel(channel.id);
  if (!ticket) throw new Error('This channel is not registered as a HIT ticket.');
  const settings = requireTicketSettings(store, guild.id);
  return { channel, ticket, settings };
}

async function claimTicket(member: GuildMember, channel: TextChannel, ticket: TicketRecord, settings: TicketSettings, store: Store): Promise<string> {
  if (!isSupport(member, settings)) throw new Error('Only support staff can claim tickets.');
  if (ticket.status !== 'open') throw new Error('This ticket is closed.');
  if (ticket.claimedBy && ticket.claimedBy !== member.id) throw new Error(`This ticket is already claimed by <@${ticket.claimedBy}>.`);
  const updated = store.setTicketClaim(ticket.id, member.id);
  store.recordTicketEvent(updated.id, channel.guild.id, member.id, 'ticket_claimed');
  await channel.send(`🛡️ Ticket claimed by <@${member.id}>.`);
  return `Ticket claimed by <@${member.id}>.`;
}

async function saveTranscript(
  channel: TextChannel,
  ticket: TicketRecord,
  settings: TicketSettings,
  actorId: string,
  store: Store,
): Promise<void> {
  const file = await buildTranscript(channel, ticket);
  await sendTicketLog(channel.guild, settings, new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('TICKET TRANSCRIPT')
    .setDescription(`Transcript saved for <#${channel.id}>.`)
    .addFields(
      { name: 'Ticket ID', value: String(ticket.id), inline: true },
      { name: 'Opener', value: `<@${ticket.openerId}>`, inline: true },
      { name: 'Type', value: ticketKinds[ticket.type as TicketKind]?.label ?? ticket.type, inline: true },
    )
    .setTimestamp(), file);
  store.recordTicketEvent(ticket.id, channel.guild.id, actorId, 'transcript_saved');
}

async function closeTicket(
  member: GuildMember,
  channel: TextChannel,
  ticket: TicketRecord,
  settings: TicketSettings,
  store: Store,
): Promise<void> {
  if (ticket.status === 'closed') throw new Error('This ticket is already closed.');
  if (member.id !== ticket.openerId && !isSupport(member, settings)) throw new Error('Only the ticket opener or support staff can close this ticket.');
  await saveTranscript(channel, ticket, settings, member.id, store);
  await channel.permissionOverwrites.edit(ticket.openerId, {
    ViewChannel: true,
    SendMessages: false,
    AddReactions: false,
    AttachFiles: false,
  }, { reason: `HIT ticket closed by ${member.user.tag}` });
  const kind = isTicketKind(ticket.type) ? ticket.type : 'general';
  const opener = await channel.guild.client.users.fetch(ticket.openerId).catch(() => member.user);
  await channel.setName(ticketChannelName(kind, opener, true)).catch(() => undefined);
  store.setTicketStatus(ticket.id, 'closed');
  store.recordTicketEvent(ticket.id, channel.guild.id, member.id, 'ticket_closed');
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('TICKET CLOSED')
      .setDescription(`Closed by <@${member.id}>. Staff may reopen, export, or delete this ticket.`)
      .setTimestamp()],
    components: [closedControls()],
  });
}

async function reopenTicket(
  member: GuildMember,
  channel: TextChannel,
  ticket: TicketRecord,
  settings: TicketSettings,
  store: Store,
): Promise<void> {
  if (!isSupport(member, settings)) throw new Error('Only support staff can reopen tickets.');
  if (ticket.status === 'open') throw new Error('This ticket is already open.');
  await channel.permissionOverwrites.edit(ticket.openerId, {
    ViewChannel: true,
    SendMessages: true,
    AddReactions: true,
    AttachFiles: true,
    EmbedLinks: true,
  }, { reason: `HIT ticket reopened by ${member.user.tag}` });
  const kind = isTicketKind(ticket.type) ? ticket.type : 'general';
  const opener = await channel.guild.client.users.fetch(ticket.openerId);
  await channel.setName(ticketChannelName(kind, opener)).catch(() => undefined);
  store.setTicketStatus(ticket.id, 'open');
  store.recordTicketEvent(ticket.id, channel.guild.id, member.id, 'ticket_reopened');
  await channel.send({
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('TICKET REOPENED')
      .setDescription(`Reopened by <@${member.id}>.`)
      .setTimestamp()],
    components: [openControls()],
  });
}

async function addUserToTicket(member: GuildMember, channel: TextChannel, target: User, settings: TicketSettings, store: Store, ticket: TicketRecord): Promise<void> {
  if (!isSupport(member, settings)) throw new Error('Only support staff can add members to tickets.');
  await channel.permissionOverwrites.edit(target.id, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AttachFiles: true,
    EmbedLinks: true,
  }, { reason: `Added to HIT ticket by ${member.user.tag}` });
  store.recordTicketEvent(ticket.id, channel.guild.id, member.id, 'member_added', { targetId: target.id });
  await channel.send(`➕ <@${target.id}> was added by <@${member.id}>.`);
}

async function removeUserFromTicket(member: GuildMember, channel: TextChannel, target: User, settings: TicketSettings, store: Store, ticket: TicketRecord): Promise<void> {
  if (!isSupport(member, settings)) throw new Error('Only support staff can remove members from tickets.');
  if (target.id === ticket.openerId) throw new Error('The ticket opener cannot be removed. Close the ticket instead.');
  await channel.permissionOverwrites.delete(target.id, `Removed from HIT ticket by ${member.user.tag}`);
  store.recordTicketEvent(ticket.id, channel.guild.id, member.id, 'member_removed', { targetId: target.id });
  await channel.send(`➖ <@${target.id}> was removed by <@${member.id}>.`);
}

async function renameTicket(member: GuildMember, channel: TextChannel, name: string, settings: TicketSettings, store: Store, ticket: TicketRecord): Promise<void> {
  if (!isSupport(member, settings)) throw new Error('Only support staff can rename tickets.');
  const safe = safeChannelPart(name);
  await channel.setName(`${ticket.status === 'closed' ? 'closed' : 'ticket'}-${safe}`.slice(0, 95));
  store.recordTicketEvent(ticket.id, channel.guild.id, member.id, 'ticket_renamed', { name: safe });
}

export async function postTicketPanel(guild: Guild, channelId: string): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) throw new Error('Choose a standard text channel.');
  await channel.send({ embeds: [ticketPanelEmbed()], components: panelRows() });
}

export async function handleHitTicketAdminCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<boolean> {
  const subcommand = interaction.options.getSubcommand();
  if (!subcommand.startsWith('tickets-')) return false;
  if (!interaction.guildId || !interaction.guild) throw new Error('This command can only be used inside a server.');

  if (subcommand === 'tickets-setup') {
    const category = interaction.options.getChannel('category', true);
    const panel = interaction.options.getChannel('panel_channel', true);
    const supportRole = interaction.options.getRole('support_role', true);
    const log = interaction.options.getChannel('log_channel', true);
    const maxOpen = interaction.options.getInteger('max_open_per_user') ?? 1;
    if (category.type !== ChannelType.GuildCategory) throw new Error('Ticket category must be a category.');
    if (panel.type !== ChannelType.GuildText || log.type !== ChannelType.GuildText) throw new Error('Panel and log channels must be standard text channels.');
    store.upsertTicketSettings({
      guildId: interaction.guildId,
      categoryId: category.id,
      panelChannelId: panel.id,
      supportRoleId: supportRole.id,
      logChannelId: log.id,
      maxOpenPerUser: maxOpen,
    });
    await interaction.reply({
      content: [
        '✓ HIT tickets configured.',
        `Category: <#${category.id}>`,
        `Panel: <#${panel.id}>`,
        `Support: <@&${supportRole.id}>`,
        `Logs: <#${log.id}>`,
        `Maximum open tickets: ${maxOpen}`,
        '',
        'Run `/hit tickets-diagnose`, then `/hit tickets-panel`.',
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const settings = requireTicketSettings(store, interaction.guildId);

  if (subcommand === 'tickets-panel') {
    const selected = interaction.options.getChannel('channel');
    const channelId = selected?.id ?? settings.panelChannelId;
    await postTicketPanel(interaction.guild, channelId);
    await interaction.reply({ content: `✓ Ticket panel posted in <#${channelId}>.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (subcommand === 'tickets-config') {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR).setTitle('HIT TICKET CONFIG').addFields(
        { name: 'Category', value: `<#${settings.categoryId}>`, inline: true },
        { name: 'Panel', value: `<#${settings.panelChannelId}>`, inline: true },
        { name: 'Support', value: `<@&${settings.supportRoleId}>`, inline: true },
        { name: 'Logs', value: `<#${settings.logChannelId}>`, inline: true },
        { name: 'Maximum open', value: String(settings.maxOpenPerUser), inline: true },
      )],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (subcommand === 'tickets-diagnose') {
    const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
    const category = await interaction.guild.channels.fetch(settings.categoryId).catch(() => null);
    const panel = await interaction.guild.channels.fetch(settings.panelChannelId).catch(() => null);
    const log = await interaction.guild.channels.fetch(settings.logChannelId).catch(() => null);
    const support = await interaction.guild.roles.fetch(settings.supportRoleId).catch(() => null);
    const checks = [
      { ok: botMember.permissions.has(PermissionFlagsBits.ManageChannels), label: 'Manage Channels', detail: 'Required to create, lock, rename, and delete ticket channels.' },
      { ok: botMember.permissions.has(PermissionFlagsBits.ManageMessages), label: 'Manage Messages', detail: 'Required for ticket controls and cleanup.' },
      { ok: category?.type === ChannelType.GuildCategory, label: 'Ticket category', detail: category ? `Using ${category.name}.` : 'Configured category is missing.' },
      { ok: panel?.type === ChannelType.GuildText, label: 'Panel channel', detail: panel ? `Using #${panel.name}.` : 'Configured panel channel is missing.' },
      { ok: log?.type === ChannelType.GuildText, label: 'Log channel', detail: log ? `Using #${log.name}.` : 'Configured log channel is missing.' },
      { ok: Boolean(support), label: 'Support role', detail: support ? `Using ${support.name}.` : 'Configured support role is missing.' },
    ];
    if (panel?.type === ChannelType.GuildText) {
      const permissions = panel.permissionsFor(botMember);
      checks.push({
        ok: Boolean(permissions?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ])),
        label: 'Panel permissions',
        detail: 'View, Send, Embed, and Read History are required.',
      });
    }
    if (log?.type === ChannelType.GuildText) {
      const permissions = log.permissionsFor(botMember);
      checks.push({
        ok: Boolean(permissions?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
        ])),
        label: 'Log permissions',
        detail: 'View, Send, Embed, Attach Files, and Read History are required.',
      });
    }
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(checks.every((check) => check.ok) ? 0x22c55e : 0xef4444)
        .setTitle('HIT TICKET DIAGNOSTICS')
        .setDescription(checks.map((check) => `${check.ok ? '✅' : '❌'} **${check.label}** — ${check.detail}`).join('\n'))],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  return false;
}

export async function handleTicketSlashCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<void> {
  if (!interaction.guildId || !interaction.guild) throw new Error('This command can only be used inside a server.');
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'open') {
    const kindValue = interaction.options.getString('type', true);
    if (!isTicketKind(kindValue)) throw new Error('Invalid ticket type.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = await createTicket(interaction.guild, interaction.user, kindValue, store);
    await interaction.editReply(`✓ Your private ticket is ready: <#${channel.id}>`);
    return;
  }

  if (!interaction.channelId) throw new Error('This command must be used inside a ticket channel.');
  const { channel, ticket, settings } = await requireTicketContext(interaction.guild, interaction.channelId, store);
  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (subcommand === 'claim') {
    const result = await claimTicket(member, channel, ticket, settings, store);
    await interaction.reply({ content: `✓ ${result}`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'close') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await closeTicket(member, channel, ticket, settings, store);
    await interaction.editReply('✓ Ticket closed and transcript saved.');
    return;
  }
  if (subcommand === 'reopen') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await reopenTicket(member, channel, ticket, settings, store);
    await interaction.editReply('✓ Ticket reopened.');
    return;
  }
  if (subcommand === 'add') {
    const target = interaction.options.getUser('user', true);
    await addUserToTicket(member, channel, target, settings, store, ticket);
    await interaction.reply({ content: `✓ Added <@${target.id}>.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'remove') {
    const target = interaction.options.getUser('user', true);
    await removeUserFromTicket(member, channel, target, settings, store, ticket);
    await interaction.reply({ content: `✓ Removed <@${target.id}>.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'rename') {
    const name = interaction.options.getString('name', true);
    await renameTicket(member, channel, name, settings, store, ticket);
    await interaction.reply({ content: '✓ Ticket renamed.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'transcript') {
    if (member.id !== ticket.openerId && !isSupport(member, settings)) throw new Error('You cannot export this ticket.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await saveTranscript(channel, ticket, settings, member.id, store);
    await interaction.editReply('✓ Transcript saved to the configured log channel.');
  }
}

export async function handleTicketInteraction(interaction: ButtonInteraction, store: Store): Promise<boolean> {
  if (!interaction.guildId || !interaction.guild) return false;

  if (interaction.customId.startsWith(CREATE_PREFIX)) {
    const kindValue = interaction.customId.slice(CREATE_PREFIX.length);
    if (!isTicketKind(kindValue)) return false;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = await createTicket(interaction.guild, interaction.user, kindValue, store);
    await interaction.editReply(`✓ Your private ticket is ready: <#${channel.id}>`);
    return true;
  }

  if (![CLAIM_ID, CLOSE_ID, REOPEN_ID, TRANSCRIPT_ID, DELETE_ID, DELETE_CONFIRM_ID].includes(interaction.customId)) return false;
  if (!interaction.channelId) return false;
  const { channel, ticket, settings } = await requireTicketContext(interaction.guild, interaction.channelId, store);
  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (interaction.customId === CLAIM_ID) {
    const result = await claimTicket(member, channel, ticket, settings, store);
    await interaction.reply({ content: `✓ ${result}`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.customId === CLOSE_ID) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await closeTicket(member, channel, ticket, settings, store);
    await interaction.editReply('✓ Ticket closed and transcript saved.');
    return true;
  }

  if (interaction.customId === REOPEN_ID) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await reopenTicket(member, channel, ticket, settings, store);
    await interaction.editReply('✓ Ticket reopened.');
    return true;
  }

  if (interaction.customId === TRANSCRIPT_ID) {
    if (member.id !== ticket.openerId && !isSupport(member, settings)) throw new Error('You cannot export this ticket.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await saveTranscript(channel, ticket, settings, member.id, store);
    await interaction.editReply('✓ Transcript saved to the configured log channel.');
    return true;
  }

  if (interaction.customId === DELETE_ID) {
    if (!isSupport(member, settings)) throw new Error('Only support staff can delete tickets.');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(DELETE_CONFIRM_ID).setLabel('Permanently Delete').setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({
      content: '⚠ This permanently deletes the channel after saving one final transcript.',
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (interaction.customId === DELETE_CONFIRM_ID) {
    if (!isSupport(member, settings)) throw new Error('Only support staff can delete tickets.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await saveTranscript(channel, ticket, settings, member.id, store);
    store.recordTicketEvent(ticket.id, channel.guild.id, member.id, 'ticket_deleted');
    store.deleteTicket(ticket.id);
    await interaction.editReply('✓ Final transcript saved. Deleting ticket...');
    await channel.delete(`HIT ticket deleted by ${member.user.tag}`);
    return true;
  }

  return false;
}

export async function handleTicketPrefixCommand(message: Message, store: Store, defaultPrefix: string): Promise<void> {
  if (!message.guild || !message.member || message.author.bot) return;
  const prefix = store.getGuildSettings(message.guild.id)?.prefix ?? defaultPrefix;
  if (!message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  if (args[0]?.toLowerCase() !== 'ticket') return;
  const action = args[1]?.toLowerCase() ?? 'open';

  if (action === 'open') {
    const rawKind = args[2]?.toLowerCase() ?? 'general';
    const kind: TicketKind = isTicketKind(rawKind) ? rawKind : 'general';
    const channel = await createTicket(message.guild, message.author, kind, store);
    await message.reply(`✓ Your private ticket is ready: <#${channel.id}>`);
    return;
  }

  const ticket = store.getTicketByChannel(message.channelId);
  if (!ticket) {
    await message.reply('✖ Use ticket controls inside a HIT ticket channel.');
    return;
  }
  const settings = requireTicketSettings(store, message.guild.id);
  const channel = await getTextTicketChannel(message.guild, message.channelId);

  if (action === 'claim') {
    await claimTicket(message.member, channel, ticket, settings, store);
    return;
  }
  if (action === 'close') {
    await closeTicket(message.member, channel, ticket, settings, store);
    return;
  }
  if (action === 'reopen') {
    await reopenTicket(message.member, channel, ticket, settings, store);
    return;
  }
  if (action === 'transcript') {
    if (message.member.id !== ticket.openerId && !isSupport(message.member, settings)) throw new Error('You cannot export this ticket.');
    await saveTranscript(channel, ticket, settings, message.member.id, store);
    await message.reply('✓ Transcript saved to the configured log channel.');
    return;
  }
  if (action === 'add' || action === 'remove') {
    const target = message.mentions.users.first();
    if (!target) throw new Error(`Mention a member: ${prefix}ticket ${action} @member`);
    if (action === 'add') await addUserToTicket(message.member, channel, target, settings, store, ticket);
    else await removeUserFromTicket(message.member, channel, target, settings, store, ticket);
    return;
  }
  if (action === 'rename') {
    const name = args.slice(2).join('-');
    if (!name) throw new Error(`Usage: ${prefix}ticket rename new-name`);
    await renameTicket(message.member, channel, name, settings, store, ticket);
    await message.reply('✓ Ticket renamed.');
    return;
  }

  await message.reply([
    `\`${prefix}ticket open [general|report|appeal|verification|partnership]\``,
    `\`${prefix}ticket claim\``,
    `\`${prefix}ticket close\``,
    `\`${prefix}ticket reopen\``,
    `\`${prefix}ticket add @member\``,
    `\`${prefix}ticket remove @member\``,
    `\`${prefix}ticket rename name\``,
    `\`${prefix}ticket transcript\``,
  ].join('\n'));
}

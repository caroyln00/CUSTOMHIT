import {
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  VoiceChannel,
  VoiceState,
} from 'discord.js';
import type { Store, TempVoiceChannel, VoiceSettings } from '../../core/store.js';
import { logger } from '../../core/logger.js';

const COLOR = 0x0f3d66;
const MIN_LIMIT = 0;
const MAX_LIMIT = 99;
const HELP_DELETE_MS = 15_000;
const EMPTY_DELETE_DELAY_MS = 2_500;

const EXACT_JOIN_TO_CREATE_IDS = new Set([
  '1528860389323051160',
  '1528858835358584913',
  '1528863063862939720',
]);

function requireVoiceSettings(store: Store, guildId: string): VoiceSettings {
  const settings = store.getVoiceSettings(guildId);
  if (!settings) throw new Error('HIT temporary voice is not configured. Run /hit voice-setup.');
  return settings;
}

export function safeVoiceChannelName(input: string): string {
  const clean = input
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return clean || 'Temporary Room';
}

export function defaultVoiceChannelName(member: Pick<GuildMember, 'displayName'>): string {
  return safeVoiceChannelName(`${member.displayName}'s Room`);
}

export function parseVoiceLimit(input: string): number {
  const value = Number.parseInt(input, 10);
  if (!Number.isInteger(value) || value < MIN_LIMIT || value > MAX_LIMIT) {
    throw new Error(`User limit must be a whole number from ${MIN_LIMIT} to ${MAX_LIMIT}. Use 0 for unlimited.`);
  }
  return value;
}

function canManageRoom(member: GuildMember, record: TempVoiceChannel): boolean {
  return member.id === record.ownerId
    || member.permissions.has(PermissionFlagsBits.ManageChannels)
    || member.permissions.has(PermissionFlagsBits.Administrator);
}

function resolveLogChannelId(guild: Guild, settings: VoiceSettings | null): string | null {
  if (settings?.logChannelId) return settings.logChannelId;
  const transcripts = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildText && channel.name.toLowerCase() === 'transcripts',
  );
  return transcripts?.id ?? null;
}

async function sendVoiceLog(
  guild: Guild,
  settings: VoiceSettings | null,
  title: string,
  description: string,
): Promise<void> {
  const logChannelId = resolveLogChannelId(guild, settings);
  if (!logChannelId) return;
  const channel = await guild.channels.fetch(logChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  await channel.send({
    embeds: [new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(description).setTimestamp()],
  }).catch(() => undefined);
}

async function removeTempChannel(guild: Guild, record: TempVoiceChannel, store: Store, reason: string): Promise<void> {
  const settings = store.getVoiceSettings(guild.id);
  const channel = await guild.channels.fetch(record.channelId).catch(() => null);
  if (channel && channel.type === ChannelType.GuildVoice) {
    await channel.delete(reason).catch(() => undefined);
  }
  store.deleteTempVoiceChannel(record.channelId);
  await sendVoiceLog(guild, settings, 'TEMPORARY VOICE DELETED', [
    `Channel ID: ${record.channelId}`,
    `Owner: <@${record.ownerId}>`,
    `Reason: ${reason}`,
  ].join('\n'));
}

async function createOrMoveToOwnedRoom(
  newState: VoiceState,
  store: Store,
  settings: VoiceSettings | null,
  categoryId: string,
): Promise<void> {
  const member = newState.member;
  if (!member || member.user.bot) return;

  const existing = store.getTempVoiceChannelByOwner(newState.guild.id, member.id);
  if (existing) {
    const existingChannel = await newState.guild.channels.fetch(existing.channelId).catch(() => null);
    if (existingChannel?.type === ChannelType.GuildVoice) {
      await newState.setChannel(existingChannel, 'HIT moved the owner to their existing temporary room.');
      return;
    }
    store.deleteTempVoiceChannel(existing.channelId);
  }

  const category = await newState.guild.channels.fetch(categoryId).catch(() => null);
  if (!category || category.type !== ChannelType.GuildCategory) {
    throw new Error('The configured temporary voice category no longer exists.');
  }

  const channel = await newState.guild.channels.create({
    name: defaultVoiceChannelName(member),
    type: ChannelType.GuildVoice,
    parent: category.id,
    userLimit: settings?.defaultUserLimit ?? 0,
    reason: `HIT temporary voice room for ${member.user.tag}`,
  });

  store.createTempVoiceChannel({
    guildId: newState.guild.id,
    channelId: channel.id,
    ownerId: member.id,
  });

  try {
    await newState.setChannel(channel, 'HIT created a temporary voice room.');
  } catch (error) {
    store.deleteTempVoiceChannel(channel.id);
    await channel.delete('HIT rolled back a temporary voice room after move failure.').catch(() => undefined);
    throw error;
  }

  await sendVoiceLog(newState.guild, settings, 'TEMPORARY VOICE CREATED', [
    `Channel: <#${channel.id}>`,
    `Owner: <@${member.id}>`,
    `User limit: ${(settings?.defaultUserLimit ?? 0) === 0 ? 'Unlimited' : settings?.defaultUserLimit}`,
  ].join('\n'));
}

async function scheduleEmptyRoomCleanup(guild: Guild, channelId: string, store: Store): Promise<void> {
  setTimeout(() => {
    void (async () => {
      const record = store.getTempVoiceChannelByChannel(channelId);
      if (!record) return;
      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) {
        store.deleteTempVoiceChannel(channelId);
        return;
      }
      if (channel.type !== ChannelType.GuildVoice) {
        store.deleteTempVoiceChannel(channelId);
        return;
      }
      if (channel.members.size === 0) {
        await removeTempChannel(guild, record, store, 'Temporary voice room became empty.');
      }
    })().catch((error) => logger.error('Temporary voice cleanup failed', { guildId: guild.id, channelId, error: String(error) }));
  }, EMPTY_DELETE_DELAY_MS);
}

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState, store: Store): Promise<void> {
  const settings = store.getVoiceSettings(newState.guild.id);
  const configuredLobbyId = settings?.lobbyChannelId ?? null;
  const joinedLobby = newState.channelId
    && (EXACT_JOIN_TO_CREATE_IDS.has(newState.channelId) || newState.channelId === configuredLobbyId);

  if (joinedLobby && oldState.channelId !== newState.channelId) {
    const lobby = newState.channel;
    if (!lobby || lobby.type !== ChannelType.GuildVoice) {
      throw new Error('The Join to Create ID must point to a standard voice channel.');
    }

    const categoryId = EXACT_JOIN_TO_CREATE_IDS.has(lobby.id)
      ? lobby.parentId
      : settings?.categoryId ?? lobby.parentId;

    if (!categoryId) {
      throw new Error('Each Join to Create channel must be inside the category where temporary rooms should be created.');
    }

    await createOrMoveToOwnedRoom(newState, store, settings, categoryId);
  }

  if (oldState.channelId && oldState.channelId !== newState.channelId) {
    const record = store.getTempVoiceChannelByChannel(oldState.channelId);
    if (record) await scheduleEmptyRoomCleanup(oldState.guild, oldState.channelId, store);
  }
}

export function handleTempVoiceChannelDelete(channelId: string, store: Store): void {
  store.deleteTempVoiceChannel(channelId);
}

function requireMember(interaction: ChatInputCommandInteraction): GuildMember {
  if (!interaction.inCachedGuild()) {
    throw new Error('This command can only be used inside the server.');
  }
  return interaction.member;
}

function requireCurrentRoom(member: GuildMember, store: Store): { channel: VoiceChannel; record: TempVoiceChannel } {
  const channel = member.voice.channel;
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    throw new Error('Join your temporary voice room first.');
  }
  const record = store.getTempVoiceChannelByChannel(channel.id);
  if (!record) throw new Error('This is not a HIT temporary voice room.');
  return { channel, record };
}

async function statusText(member: GuildMember, store: Store): Promise<string> {
  const { channel, record } = requireCurrentRoom(member, store);
  const owner = await member.guild.members.fetch(record.ownerId).catch(() => null);
  const everyoneOverwrite = channel.permissionOverwrites.cache.get(member.guild.roles.everyone.id);
  const connect = everyoneOverwrite?.deny.has(PermissionFlagsBits.Connect) ? 'Locked' : 'Open';
  const visibility = everyoneOverwrite?.deny.has(PermissionFlagsBits.ViewChannel) ? 'Hidden' : 'Visible';
  return [
    `Channel: <#${channel.id}>`,
    `Owner: ${owner ? `<@${owner.id}>` : `<@${record.ownerId}>`}`,
    `Members: ${channel.members.size}`,
    `User limit: ${channel.userLimit === 0 ? 'Unlimited' : channel.userLimit}`,
    `Access: ${connect}`,
    `Visibility: ${visibility}`,
  ].join('\n');
}

async function performRoomAction(
  member: GuildMember,
  store: Store,
  action: string,
  value?: string | number | GuildMember,
): Promise<string> {
  const { channel, record } = requireCurrentRoom(member, store);

  if (action === 'status') return statusText(member, store);
  if (action === 'claim') {
    if (record.ownerId === member.id) return 'You already own this room.';
    const owner = await member.guild.members.fetch(record.ownerId).catch(() => null);
    if (owner?.voice.channelId === channel.id) throw new Error('The current owner is still connected to this room.');
    store.transferTempVoiceOwnership(channel.id, member.id);
    return `You now own <#${channel.id}>.`;
  }

  if (!canManageRoom(member, record)) throw new Error('Only the room owner or staff can use that control.');

  if (action === 'rename') {
    const name = safeVoiceChannelName(String(value ?? ''));
    await channel.setName(name, `HIT temporary voice rename by ${member.user.tag}`);
    return `Room renamed to **${name}**.`;
  }
  if (action === 'limit') {
    const limit = typeof value === 'number' ? value : parseVoiceLimit(String(value ?? ''));
    await channel.setUserLimit(limit, `HIT temporary voice limit changed by ${member.user.tag}`);
    return `User limit set to **${limit === 0 ? 'Unlimited' : limit}**.`;
  }
  if (action === 'lock') {
    await channel.permissionOverwrites.edit(member.guild.roles.everyone, { Connect: false }, { reason: 'HIT temporary room locked.' });
    return 'Room locked. New members cannot connect unless explicitly permitted.';
  }
  if (action === 'unlock') {
    await channel.permissionOverwrites.edit(member.guild.roles.everyone, { Connect: null }, { reason: 'HIT temporary room unlocked.' });
    return 'Room unlocked.';
  }
  if (action === 'hide') {
    await channel.permissionOverwrites.edit(member.guild.roles.everyone, { ViewChannel: false }, { reason: 'HIT temporary room hidden.' });
    return 'Room hidden from regular members.';
  }
  if (action === 'show') {
    await channel.permissionOverwrites.edit(member.guild.roles.everyone, { ViewChannel: null }, { reason: 'HIT temporary room shown.' });
    return 'Room is visible again.';
  }
  if (action === 'permit') {
    const target = value as GuildMember;
    await channel.permissionOverwrites.edit(target, { ViewChannel: true, Connect: true }, { reason: 'HIT temporary room access granted.' });
    return `<@${target.id}> can now view and join this room.`;
  }
  if (action === 'reject') {
    const target = value as GuildMember;
    if (target.id === member.id) throw new Error('You cannot reject yourself.');
    await channel.permissionOverwrites.edit(target, { Connect: false }, { reason: 'HIT temporary room access denied.' });
    if (target.voice.channelId === channel.id) {
      await target.voice.setChannel(null, 'Removed from a HIT temporary voice room.');
    }
    return `<@${target.id}> was removed and cannot reconnect.`;
  }
  if (action === 'transfer') {
    const target = value as GuildMember;
    if (target.voice.channelId !== channel.id) throw new Error('The new owner must be connected to this room.');
    store.transferTempVoiceOwnership(channel.id, target.id);
    return `Room ownership transferred to <@${target.id}>.`;
  }
  if (action === 'close') {
    await removeTempChannel(member.guild, record, store, `Closed by ${member.user.tag}.`);
    return 'Temporary voice room closed.';
  }

  throw new Error('Unknown temporary voice action.');
}

export async function handleVoiceSlashCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<void> {
  const member = requireMember(interaction);
  const subcommand = interaction.options.getSubcommand();
  let result: string;

  if (subcommand === 'rename') {
    result = await performRoomAction(member, store, 'rename', interaction.options.getString('name', true));
  } else if (subcommand === 'limit') {
    result = await performRoomAction(member, store, 'limit', interaction.options.getInteger('amount', true));
  } else if (subcommand === 'permit' || subcommand === 'reject' || subcommand === 'transfer') {
    const targetUser = interaction.options.getUser('user', true);
    const target = await interaction.guild!.members.fetch(targetUser.id);
    result = await performRoomAction(member, store, subcommand, target);
  } else {
    result = await performRoomAction(member, store, subcommand);
  }

  await interaction.reply({ content: result, flags: MessageFlags.Ephemeral });
}

function temporaryHelp(prefix: string): string {
  return [
    '**HIT TEMPORARY VOICE COMMANDS**',
    `\`${prefix}voice status\``,
    `\`${prefix}voice rename New Room Name\``,
    `\`${prefix}voice limit 5\``,
    `\`${prefix}voice lock\` / \`${prefix}voice unlock\``,
    `\`${prefix}voice hide\` / \`${prefix}voice show\``,
    `\`${prefix}voice permit @user\``,
    `\`${prefix}voice reject @user\``,
    `\`${prefix}voice transfer @user\``,
    `\`${prefix}voice claim\``,
    `\`${prefix}voice close\``,
  ].join('\n');
}

function deleteLater(message: Message, delay = HELP_DELETE_MS): void {
  setTimeout(() => void message.delete().catch(() => undefined), delay);
}

export async function handleVoicePrefixCommand(message: Message, store: Store, prefix: string): Promise<void> {
  if (!message.guild || message.author.bot || !message.content.startsWith(prefix)) return;
  const body = message.content.slice(prefix.length).trim();
  const [command, subcommandRaw, ...rest] = body.split(/\s+/);
  if (!command || !['voice', 'vc'].includes(command.toLowerCase())) return;

  const member = message.member;
  if (!member) return;
  const subcommand = (subcommandRaw ?? '').toLowerCase();
  if (!subcommand) {
    const response = await message.reply(temporaryHelp(prefix));
    deleteLater(message);
    deleteLater(response);
    return;
  }

  let result: string;
  if (subcommand === 'rename') {
    result = await performRoomAction(member, store, 'rename', rest.join(' '));
  } else if (subcommand === 'limit') {
    result = await performRoomAction(member, store, 'limit', parseVoiceLimit(rest[0] ?? ''));
  } else if (['permit', 'reject', 'transfer'].includes(subcommand)) {
    const target = message.mentions.members?.first();
    if (!target) throw new Error(`Usage: ${prefix}voice ${subcommand} @user`);
    result = await performRoomAction(member, store, subcommand, target);
  } else if (['status', 'lock', 'unlock', 'hide', 'show', 'claim', 'close'].includes(subcommand)) {
    result = await performRoomAction(member, store, subcommand);
  } else {
    throw new Error(temporaryHelp(prefix));
  }

  await message.reply(result);
}

function permissionLine(ok: boolean, label: string, detail: string): string {
  return `${ok ? 'PASS' : 'FAIL'} ${label} — ${detail}`;
}

export async function handleHitVoiceAdminCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<boolean> {
  if (interaction.commandName !== 'hit' || !interaction.inCachedGuild()) return false;
  const subcommand = interaction.options.getSubcommand();
  if (!subcommand.startsWith('voice-')) return false;

  if (subcommand === 'voice-setup') {
    const lobby = interaction.options.getChannel('lobby', true);
    const category = interaction.options.getChannel('category', true);
    const logChannel = interaction.options.getChannel('log_channel', true);
    if (lobby.type !== ChannelType.GuildVoice) throw new Error('Lobby must be a standard voice channel.');
    if (category.type !== ChannelType.GuildCategory) throw new Error('Category must be a category channel.');
    if (logChannel.type !== ChannelType.GuildText) throw new Error('Log channel must be a text channel.');
    const existing = store.getVoiceSettings(interaction.guildId);
    const settings = store.upsertVoiceSettings({
      guildId: interaction.guildId,
      lobbyChannelId: lobby.id,
      categoryId: category.id,
      logChannelId: logChannel.id,
      defaultUserLimit: interaction.options.getInteger('default_user_limit') ?? existing?.defaultUserLimit ?? 0,
    });

    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('HIT TEMPORARY VOICE DEFAULTS CONFIGURED')
        .addFields(
          { name: 'Fallback Lobby', value: `<#${settings.lobbyChannelId}>`, inline: true },
          { name: 'Fallback Category', value: `<#${settings.categoryId}>`, inline: true },
          { name: 'Exact Lobbies', value: [...EXACT_JOIN_TO_CREATE_IDS].map((id) => `<#${id}>`).join('\n'), inline: false },
          { name: 'Log Channel', value: `<#${settings.logChannelId}>`, inline: true },
          { name: 'Default Limit', value: settings.defaultUserLimit === 0 ? 'Unlimited' : String(settings.defaultUserLimit), inline: true },
        )],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const settings = store.getVoiceSettings(interaction.guildId);
  if (subcommand === 'voice-config') {
    const lobbyLines = await Promise.all([...EXACT_JOIN_TO_CREATE_IDS].map(async (lobbyId) => {
      const lobby = await interaction.guild.channels.fetch(lobbyId).catch(() => null);
      if (!lobby || lobby.type !== ChannelType.GuildVoice) return `<#${lobbyId}> — Invalid or missing`;
      return `<#${lobbyId}> — Rooms create in ${lobby.parentId ? `<#${lobby.parentId}>` : 'No category'}`;
    }));
    const logChannelId = resolveLogChannelId(interaction.guild, settings);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('HIT TEMPORARY VOICE CONFIGURATION')
        .addFields(
          { name: 'Join to Create Lobbies', value: lobbyLines.join('\n'), inline: false },
          { name: 'Log Channel', value: logChannelId ? `<#${logChannelId}>` : 'Not configured', inline: true },
          { name: 'Default Limit', value: (settings?.defaultUserLimit ?? 0) === 0 ? 'Unlimited' : String(settings?.defaultUserLimit), inline: true },
          { name: 'Active Rooms', value: String(store.listTempVoiceChannels(interaction.guildId).length), inline: true },
        )],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (subcommand === 'voice-diagnose') {
    const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
    const lines = [
      permissionLine(botMember.permissions.has(PermissionFlagsBits.ManageChannels), 'Manage Channels', 'Required to create, edit, and delete rooms.'),
      permissionLine(botMember.permissions.has(PermissionFlagsBits.MoveMembers), 'Move Members', 'Required to move users from each lobby.'),
    ];

    for (const lobbyId of EXACT_JOIN_TO_CREATE_IDS) {
      const lobby = await interaction.guild.channels.fetch(lobbyId).catch(() => null);
      const lobbyOk = Boolean(lobby && lobby.type === ChannelType.GuildVoice);
      lines.push(permissionLine(lobbyOk, `Lobby ${lobbyId}`, 'ID must point to a standard voice channel.'));
      if (!lobby || lobby.type !== ChannelType.GuildVoice) continue;
      const lobbyPermissions = lobby.permissionsFor(botMember);
      lines.push(permissionLine(Boolean(lobby.parentId), `Lobby ${lobbyId} category`, 'Lobby must be inside its temporary-room category.'));
      lines.push(permissionLine(Boolean(lobbyPermissions?.has(PermissionFlagsBits.ViewChannel)), `Lobby ${lobbyId} view access`, 'HIT must see the lobby.'));
      lines.push(permissionLine(Boolean(lobbyPermissions?.has(PermissionFlagsBits.Connect)), `Lobby ${lobbyId} connect access`, 'HIT must manage moves from the lobby.'));
      if (lobby.parentId) {
        const category = await interaction.guild.channels.fetch(lobby.parentId).catch(() => null);
        const categoryPermissions = category?.permissionsFor(botMember);
        lines.push(permissionLine(Boolean(category && category.type === ChannelType.GuildCategory), `Lobby ${lobbyId} parent category`, 'Parent category must exist.'));
        lines.push(permissionLine(Boolean(categoryPermissions?.has(PermissionFlagsBits.ViewChannel)), `Lobby ${lobbyId} category access`, 'HIT must see and create rooms in the category.'));
      }
    }

    const logChannelId = resolveLogChannelId(interaction.guild, settings);
    const logChannel = logChannelId ? await interaction.guild.channels.fetch(logChannelId).catch(() => null) : null;
    const logPermissions = logChannel?.permissionsFor(botMember);
    lines.push(permissionLine(Boolean(logChannel && logChannel.type === ChannelType.GuildText), 'Log channel', 'Configure a log channel or keep a text channel named transcripts.'));
    lines.push(permissionLine(Boolean(logPermissions?.has(PermissionFlagsBits.SendMessages)), 'Log send access', 'HIT must send room activity logs.'));
    lines.push(permissionLine(Boolean(logPermissions?.has(PermissionFlagsBits.EmbedLinks)), 'Log embed access', 'HIT must embed room activity logs.'));

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(lines.some((line) => line.startsWith('FAIL')) ? 0xef4444 : 0x22c55e).setTitle('HIT TEMPORARY VOICE DIAGNOSTICS').setDescription(lines.join('\n').slice(0, 4096))],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  return false;
}

export function startVoiceWorker(client: Client, store: Store): NodeJS.Timeout {
  const run = async (): Promise<void> => {
    for (const record of store.listTempVoiceChannels()) {
      const guild = client.guilds.cache.get(record.guildId);
      if (!guild) continue;
      const channel = await guild.channels.fetch(record.channelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildVoice) {
        store.deleteTempVoiceChannel(record.channelId);
        continue;
      }
      if (channel.members.size === 0) {
        await removeTempChannel(guild, record, store, 'Recovered an empty temporary voice room.');
      }
    }
  };
  void run().catch((error) => logger.error('Temporary voice startup recovery failed', { error: String(error) }));
  return setInterval(() => void run().catch((error) => logger.error('Temporary voice worker failed', { error: String(error) })), 60_000);
}

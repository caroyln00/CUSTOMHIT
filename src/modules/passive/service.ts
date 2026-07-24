import {
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildBasedChannel,
  type GuildMember,
  type Message,
  type PartialMessage,
  type Role,
} from 'discord.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SETTINGS_PATH = resolve(process.cwd(), 'data', 'passive-settings.json');
const COLOR = 0x5865f2;
const WARNING = 0xf59e0b;
const FAILURE = 0xef4444;

export interface PassiveSettings {
  guildId: string;
  logChannelId: string;
  welcomeChannelId: string | null;
  autoroleId: string | null;
  welcomeEnabled: boolean;
  goodbyeEnabled: boolean;
  messageLogsEnabled: boolean;
  serverLogsEnabled: boolean;
  antiCapsEnabled: boolean;
  antiEmojiEnabled: boolean;
  antiInvitesEnabled: boolean;
  antiAttachmentsEnabled: boolean;
  antiRepeatEnabled: boolean;
  maxCapsPercent: number;
  maxEmojis: number;
  welcomeMessage: string;
  goodbyeMessage: string;
  updatedAt: number;
}

type SettingsFile = Record<string, PassiveSettings>;
let cache: SettingsFile | null = null;

function loadSettings(): SettingsFile {
  if (cache) return cache;
  if (!existsSync(SETTINGS_PATH)) {
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8')) as SettingsFile;
  } catch {
    cache = {};
  }
  return cache;
}

function saveSettings(data: SettingsFile): void {
  mkdirSync(dirname(SETTINGS_PATH), { recursive: true });
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  cache = data;
}

function getSettings(guildId: string): PassiveSettings | null {
  return loadSettings()[guildId] ?? null;
}

function upsertSettings(settings: PassiveSettings): void {
  const data = loadSettings();
  data[settings.guildId] = settings;
  saveSettings(data);
}

function truncate(value: string, max = 1000): string {
  const clean = value.replace(/```/g, 'ˋˋˋ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean || '(empty)';
}

async function sendLog(guild: Guild, settings: PassiveSettings, title: string, description: string, color = COLOR): Promise<void> {
  const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
  if (!channel?.isSendable()) return;
  await channel.send({ embeds: [new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(truncate(description, 4000))
    .setTimestamp()] }).catch(() => undefined);
}

function renderTemplate(template: string, member: GuildMember): string {
  return template
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));
}

function countEmojis(content: string): number {
  const unicode = content.match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
  const custom = content.match(/<a?:[A-Za-z0-9_]+:\d+>/g)?.length ?? 0;
  return unicode + custom;
}

function capsPercent(content: string): number {
  const letters = [...content].filter((char) => /\p{L}/u.test(char));
  if (letters.length < 12) return 0;
  const uppercase = letters.filter((char) => char === char.toUpperCase() && char !== char.toLowerCase()).length;
  return Math.round((uppercase / letters.length) * 100);
}

function dangerousAttachment(message: Message): string | null {
  const dangerous = /\.(?:exe|scr|com|bat|cmd|ps1|vbs|vbe|js|jse|wsf|wsh|msi|reg|lnk|jar)$/i;
  return [...message.attachments.values()].find((attachment) => dangerous.test(attachment.name ?? ''))?.name ?? null;
}

async function moderateMessage(message: Message, settings: PassiveSettings, reason: string): Promise<boolean> {
  const preview = truncate(message.content, 500);
  await message.delete().catch(() => undefined);
  if (message.channel.isSendable()) {
    const warning = await message.channel.send({
      content: `${message.author}, your message was removed: **${reason}**`,
      allowedMentions: { users: [message.author.id] },
    }).catch(() => null);
    if (warning) setTimeout(() => void warning.delete().catch(() => undefined), 7000);
  }
  await sendLog(message.guild!, settings, 'PASSIVE AUTOMOD', [
    `Member: <@${message.author.id}> (${message.author.id})`,
    `Channel: <#${message.channelId}>`,
    `Reason: ${reason}`,
    `Content: ${preview}`,
  ].join('\n'), FAILURE);
  return true;
}

export async function handlePassiveMessage(message: Message): Promise<boolean> {
  if (!message.guild || !message.member || message.author.bot) return false;
  const settings = getSettings(message.guild.id);
  if (!settings) return false;
  if (message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;
  const content = message.content;

  if (settings.antiInvitesEnabled && /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[A-Za-z0-9-]+/i.test(content)) {
    return moderateMessage(message, settings, 'Discord invite links are blocked.');
  }
  if (settings.antiAttachmentsEnabled) {
    const filename = dangerousAttachment(message);
    if (filename) return moderateMessage(message, settings, `Potentially dangerous attachment blocked: ${filename}`);
  }
  if (settings.antiRepeatEnabled && /(.)\1{11,}/iu.test(content)) {
    return moderateMessage(message, settings, 'Excessive repeated characters.');
  }
  if (settings.antiEmojiEnabled && countEmojis(content) > settings.maxEmojis) {
    return moderateMessage(message, settings, `Too many emojis (limit ${settings.maxEmojis}).`);
  }
  const caps = capsPercent(content);
  if (settings.antiCapsEnabled && caps >= settings.maxCapsPercent) {
    return moderateMessage(message, settings, `Excessive capital letters (${caps}%).`);
  }
  return false;
}

export async function onPassiveMemberJoin(member: GuildMember): Promise<void> {
  const settings = getSettings(member.guild.id);
  if (!settings) return;
  if (settings.autoroleId) {
    const role = await member.guild.roles.fetch(settings.autoroleId).catch(() => null);
    if (role?.editable) await member.roles.add(role, 'HIT passive autorole').catch(() => undefined);
  }
  if (settings.welcomeEnabled && settings.welcomeChannelId) {
    const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
    if (channel?.isSendable()) {
      await channel.send({ content: renderTemplate(settings.welcomeMessage, member), allowedMentions: { users: [member.id] } }).catch(() => undefined);
    }
  }
  const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86_400_000);
  await sendLog(member.guild, settings, 'MEMBER JOINED', [
    `Member: <@${member.id}> (${member.id})`,
    `Account age: ${ageDays} day${ageDays === 1 ? '' : 's'}`,
    ageDays < 7 ? 'Warning: account is less than seven days old.' : 'Account-age check passed.',
  ].join('\n'), ageDays < 7 ? WARNING : COLOR);
}

export async function onPassiveMemberRemove(member: GuildMember): Promise<void> {
  const settings = getSettings(member.guild.id);
  if (!settings) return;
  if (settings.goodbyeEnabled && settings.welcomeChannelId) {
    const channel = await member.guild.channels.fetch(settings.welcomeChannelId).catch(() => null);
    if (channel?.isSendable()) await channel.send(renderTemplate(settings.goodbyeMessage, member)).catch(() => undefined);
  }
  await sendLog(member.guild, settings, 'MEMBER LEFT', `Member: ${member.user.tag} (${member.id})`, WARNING);
}

export async function handlePassiveMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
  const settings = getSettings(newMember.guild.id);
  if (!settings?.serverLogsEnabled) return;
  const lines: string[] = [];
  if (oldMember.nickname !== newMember.nickname) lines.push(`Nickname: **${oldMember.nickname ?? oldMember.user.username}** → **${newMember.nickname ?? newMember.user.username}**`);
  const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id) && role.id !== newMember.guild.id);
  const removed = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id) && role.id !== newMember.guild.id);
  if (added.size) lines.push(`Roles added: ${added.map((role) => `<@&${role.id}>`).join(', ')}`);
  if (removed.size) lines.push(`Roles removed: ${removed.map((role) => `<@&${role.id}>`).join(', ')}`);
  if (lines.length) await sendLog(newMember.guild, settings, 'MEMBER UPDATED', `Member: <@${newMember.id}>\n${lines.join('\n')}`);
}

export async function handlePassiveMessageDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guild || message.author?.bot) return;
  const settings = getSettings(message.guild.id);
  if (!settings?.messageLogsEnabled) return;
  await sendLog(message.guild, settings, 'MESSAGE DELETED', [
    `Author: ${message.author ? `<@${message.author.id}> (${message.author.id})` : 'Unknown'}`,
    `Channel: <#${message.channelId}>`,
    `Content: ${truncate(message.content ?? '(content unavailable)', 1500)}`,
  ].join('\n'), FAILURE);
}

export async function handlePassiveMessageUpdate(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
  if (!newMessage.guild || newMessage.author?.bot) return;
  const settings = getSettings(newMessage.guild.id);
  if (!settings?.messageLogsEnabled) return;
  const before = oldMessage.content ?? '(content unavailable)';
  const after = newMessage.content ?? '(content unavailable)';
  if (before === after) return;
  await sendLog(newMessage.guild, settings, 'MESSAGE EDITED', [
    `Author: ${newMessage.author ? `<@${newMessage.author.id}> (${newMessage.author.id})` : 'Unknown'}`,
    `Channel: <#${newMessage.channelId}>`,
    `Before: ${truncate(before, 1200)}`,
    `After: ${truncate(after, 1200)}`,
  ].join('\n'), WARNING);
}

export async function handlePassiveChannelEvent(action: 'created' | 'deleted' | 'updated', channel: GuildBasedChannel): Promise<void> {
  const settings = getSettings(channel.guild.id);
  if (!settings?.serverLogsEnabled) return;
  await sendLog(channel.guild, settings, `CHANNEL ${action.toUpperCase()}`, `Channel: **${channel.name}** (${channel.id})\nType: ${channel.type}`, action === 'deleted' ? FAILURE : COLOR);
}

export async function handlePassiveRoleEvent(action: 'created' | 'deleted' | 'updated', role: Role): Promise<void> {
  const settings = getSettings(role.guild.id);
  if (!settings?.serverLogsEnabled) return;
  await sendLog(role.guild, settings, `ROLE ${action.toUpperCase()}`, `Role: **${role.name}** (${role.id})`, action === 'deleted' ? FAILURE : COLOR);
}

export async function handlePassiveSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName !== 'passive') return;
  if (!interaction.inCachedGuild()) throw new Error('This command can only be used in a server.');
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'setup') {
    const current = getSettings(interaction.guildId);
    const settings: PassiveSettings = {
      guildId: interaction.guildId,
      logChannelId: interaction.options.getChannel('log_channel', true).id,
      welcomeChannelId: interaction.options.getChannel('welcome_channel')?.id ?? current?.welcomeChannelId ?? null,
      autoroleId: interaction.options.getRole('autorole')?.id ?? current?.autoroleId ?? null,
      welcomeEnabled: interaction.options.getBoolean('welcome') ?? current?.welcomeEnabled ?? true,
      goodbyeEnabled: interaction.options.getBoolean('goodbye') ?? current?.goodbyeEnabled ?? true,
      messageLogsEnabled: interaction.options.getBoolean('message_logs') ?? current?.messageLogsEnabled ?? true,
      serverLogsEnabled: interaction.options.getBoolean('server_logs') ?? current?.serverLogsEnabled ?? true,
      antiCapsEnabled: interaction.options.getBoolean('anti_caps') ?? current?.antiCapsEnabled ?? true,
      antiEmojiEnabled: interaction.options.getBoolean('anti_emoji') ?? current?.antiEmojiEnabled ?? true,
      antiInvitesEnabled: interaction.options.getBoolean('anti_invites') ?? current?.antiInvitesEnabled ?? true,
      antiAttachmentsEnabled: interaction.options.getBoolean('anti_attachments') ?? current?.antiAttachmentsEnabled ?? true,
      antiRepeatEnabled: interaction.options.getBoolean('anti_repeat') ?? current?.antiRepeatEnabled ?? true,
      maxCapsPercent: interaction.options.getInteger('caps_percent') ?? current?.maxCapsPercent ?? 80,
      maxEmojis: interaction.options.getInteger('emoji_limit') ?? current?.maxEmojis ?? 10,
      welcomeMessage: interaction.options.getString('welcome_message') ?? current?.welcomeMessage ?? 'Welcome {user} to **{server}**! You are member #{membercount}.',
      goodbyeMessage: interaction.options.getString('goodbye_message') ?? current?.goodbyeMessage ?? '**{username}** left **{server}**.',
      updatedAt: Date.now(),
    };
    upsertSettings(settings);
    await interaction.reply({ content: 'HIT passive automod, logging, welcome, goodbye, and autorole settings were saved.', flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === 'status') {
    const settings = getSettings(interaction.guildId);
    if (!settings) throw new Error('Passive systems are not configured. Run `/passive setup`.');
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('HIT PASSIVE SYSTEMS').addFields(
      { name: 'Logging', value: `Messages: ${settings.messageLogsEnabled ? 'On' : 'Off'}\nServer changes: ${settings.serverLogsEnabled ? 'On' : 'Off'}\nLog: <#${settings.logChannelId}>`, inline: true },
      { name: 'Member automation', value: `Welcome: ${settings.welcomeEnabled ? 'On' : 'Off'}\nGoodbye: ${settings.goodbyeEnabled ? 'On' : 'Off'}\nAutorole: ${settings.autoroleId ? `<@&${settings.autoroleId}>` : 'Off'}`, inline: true },
      { name: 'Automod', value: `Caps: ${settings.antiCapsEnabled ? `On (${settings.maxCapsPercent}%)` : 'Off'}\nEmoji: ${settings.antiEmojiEnabled ? `On (${settings.maxEmojis})` : 'Off'}\nInvites: ${settings.antiInvitesEnabled ? 'On' : 'Off'}\nRisky files: ${settings.antiAttachmentsEnabled ? 'On' : 'Off'}\nRepeated characters: ${settings.antiRepeatEnabled ? 'On' : 'Off'}` },
    )], flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === 'disable') {
    const current = getSettings(interaction.guildId);
    if (!current) throw new Error('Passive systems are not configured.');
    upsertSettings({ ...current, welcomeEnabled: false, goodbyeEnabled: false, messageLogsEnabled: false, serverLogsEnabled: false, antiCapsEnabled: false, antiEmojiEnabled: false, antiInvitesEnabled: false, antiAttachmentsEnabled: false, antiRepeatEnabled: false, updatedAt: Date.now() });
    await interaction.reply({ content: 'All HIT passive systems were disabled. Your settings were preserved.', flags: MessageFlags.Ephemeral });
    return;
  }

  throw new Error('Unknown passive subcommand.');
}

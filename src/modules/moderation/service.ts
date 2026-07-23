import { randomUUID } from 'node:crypto';
import {
  ActionRowBuilder,
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
  Role,
  User,
} from 'discord.js';
import type { ModerationCase, ModerationSettings, Store } from '../../core/store.js';
import { formatDuration, parseDuration } from './duration.js';

const COLOR = 0x7c3aed;
const SUCCESS = 0x22c55e;
const DANGER = 0xef4444;
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

const MODERATION_PREFIX_COMMANDS = new Set([
  'warn',
  'warnings',
  'clearwarnings',
  'timeout',
  'untimeout',
  'kick',
  'ban',
  'unban',
  'purge',
  'slowmode',
  'lock',
  'unlock',
  'nick',
  'role',
  'unrole',
  'case',
  'history',
]);

type DangerousAction = 'kick' | 'ban';

interface PendingAction {
  token: string;
  type: DangerousAction;
  guildId: string;
  moderatorId: string;
  targetId: string;
  reason: string;
  deleteMessageSeconds: number;
  expiresAt: number;
}

const pendingActions = new Map<string, PendingAction>();

function requireModerationSettings(store: Store, guildId: string): ModerationSettings {
  const settings = store.getModerationSettings(guildId);
  if (!settings) throw new Error('Run `/hit moderation-setup` first.');
  return settings;
}

function requireMemberPermission(member: GuildMember, permission: bigint, label: string): void {
  if (!member.permissions.has(permission)) throw new Error(`${label} is required.`);
}

async function getBotMember(guild: Guild): Promise<GuildMember> {
  return guild.members.me ?? guild.members.fetchMe();
}

function assertTargetable(actor: GuildMember, target: GuildMember, botMember: GuildMember): void {
  if (target.id === actor.id) throw new Error('You cannot moderate yourself.');
  if (target.id === botMember.id) throw new Error('You cannot moderate HIT.');
  if (target.id === target.guild.ownerId) throw new Error('The server owner cannot be moderated.');
  if (actor.id !== actor.guild.ownerId && actor.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    throw new Error('Your highest role must be above the target member.');
  }
  if (botMember.roles.highest.comparePositionTo(target.roles.highest) <= 0) {
    throw new Error('Move HIT above the target member’s highest role.');
  }
}

function assertRoleManageable(actor: GuildMember, role: Role, botMember: GuildMember): void {
  if (role.managed) throw new Error('That integration-managed role cannot be changed manually.');
  if (role.id === role.guild.id) throw new Error('The @everyone role cannot be assigned or removed.');
  if (actor.id !== actor.guild.ownerId && actor.roles.highest.comparePositionTo(role) <= 0) {
    throw new Error('Your highest role must be above that role.');
  }
  if (botMember.roles.highest.comparePositionTo(role) <= 0) {
    throw new Error('Move HIT above that role.');
  }
}

async function sendModerationLog(
  guild: Guild,
  settings: ModerationSettings,
  moderationCase: ModerationCase,
): Promise<void> {
  const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  const metadata = moderationCase.metadata
    ? Object.entries(moderationCase.metadata)
      .slice(0, 8)
      .map(([key, value]) => `**${key}:** ${String(value)}`)
      .join('\n')
    : '';
  const embed = new EmbedBuilder()
    .setColor(['ban', 'kick'].includes(moderationCase.action) ? DANGER : COLOR)
    .setTitle(`MODERATION CASE #${moderationCase.id}`)
    .addFields(
      { name: 'Action', value: moderationCase.action.toUpperCase(), inline: true },
      { name: 'Moderator', value: `<@${moderationCase.moderatorId}>`, inline: true },
      { name: 'Target', value: moderationCase.targetId ? `<@${moderationCase.targetId}>` : 'None', inline: true },
      { name: 'Reason', value: moderationCase.reason },
    )
    .setTimestamp(moderationCase.createdAt);
  if (metadata) embed.addFields({ name: 'Details', value: metadata.slice(0, 1024) });
  await channel.send({ embeds: [embed] }).catch(() => undefined);
}

async function createCase(
  store: Store,
  guild: Guild,
  settings: ModerationSettings,
  input: {
    moderatorId: string;
    targetId: string | null;
    action: string;
    reason: string;
    metadata?: Record<string, unknown>;
  },
): Promise<ModerationCase> {
  const moderationCase = store.createModerationCase({
    guildId: guild.id,
    moderatorId: input.moderatorId,
    targetId: input.targetId,
    action: input.action,
    reason: input.reason,
    metadata: input.metadata ?? null,
  });
  await sendModerationLog(guild, settings, moderationCase);
  return moderationCase;
}

async function notifyTarget(user: User, guild: Guild, action: string, reason: string, detail?: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(DANGER)
    .setTitle(`MODERATION NOTICE — ${guild.name}`)
    .setDescription([
      `**Action:** ${action}`,
      detail ? `**Details:** ${detail}` : null,
      `**Reason:** ${reason}`,
    ].filter(Boolean).join('\n'))
    .setFooter({ text: 'Use the server ticket or appeal system if you need to contest this action.' })
    .setTimestamp();
  await user.send({ embeds: [embed] }).catch(() => undefined);
}

function caseEmbed(moderationCase: ModerationCase): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`CASE #${moderationCase.id}`)
    .addFields(
      { name: 'Action', value: moderationCase.action.toUpperCase(), inline: true },
      { name: 'Moderator', value: `<@${moderationCase.moderatorId}>`, inline: true },
      { name: 'Target', value: moderationCase.targetId ? `<@${moderationCase.targetId}>` : 'None', inline: true },
      { name: 'Reason', value: moderationCase.reason },
    )
    .setTimestamp(moderationCase.createdAt);
  if (moderationCase.metadata) {
    const details = Object.entries(moderationCase.metadata)
      .map(([key, value]) => `**${key}:** ${String(value)}`)
      .join('\n');
    if (details) embed.addFields({ name: 'Details', value: details.slice(0, 1024) });
  }
  return embed;
}

async function executeDangerousAction(action: PendingAction, guild: Guild, store: Store): Promise<ModerationCase> {
  const settings = requireModerationSettings(store, guild.id);
  const moderator = await guild.members.fetch(action.moderatorId);
  const botMember = await getBotMember(guild);

  if (action.type === 'kick') {
    requireMemberPermission(moderator, PermissionFlagsBits.KickMembers, 'Kick Members');
    const target = await guild.members.fetch(action.targetId).catch(() => null);
    if (!target) throw new Error('The target member is no longer in the server.');
    assertTargetable(moderator, target, botMember);
    if (!target.kickable) throw new Error('HIT cannot kick that member.');
    await notifyTarget(target.user, guild, 'KICK', action.reason);
    await target.kick(`${action.reason} | Moderator ${moderator.user.tag}`);
    return createCase(store, guild, settings, {
      moderatorId: moderator.id,
      targetId: target.id,
      action: 'kick',
      reason: action.reason,
    });
  }

  requireMemberPermission(moderator, PermissionFlagsBits.BanMembers, 'Ban Members');
  const targetMember = await guild.members.fetch(action.targetId).catch(() => null);
  if (targetMember) {
    assertTargetable(moderator, targetMember, botMember);
    if (!targetMember.bannable) throw new Error('HIT cannot ban that member.');
    await notifyTarget(targetMember.user, guild, 'BAN', action.reason);
  }
  await guild.members.ban(action.targetId, {
    deleteMessageSeconds: action.deleteMessageSeconds,
    reason: `${action.reason} | Moderator ${moderator.user.tag}`,
  });
  return createCase(store, guild, settings, {
    moderatorId: moderator.id,
    targetId: action.targetId,
    action: 'ban',
    reason: action.reason,
    metadata: { deleteMessageSeconds: action.deleteMessageSeconds },
  });
}

function confirmationRow(token: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`hit:mod:confirm:${token}`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`hit:mod:cancel:${token}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );
}

function queueDangerousAction(input: Omit<PendingAction, 'token' | 'expiresAt'>): PendingAction {
  const token = randomUUID();
  const action: PendingAction = { ...input, token, expiresAt: Date.now() + 60_000 };
  pendingActions.set(token, action);
  setTimeout(() => pendingActions.delete(token), 65_000).unref();
  return action;
}

export async function handleModerationButton(interaction: ButtonInteraction, store: Store): Promise<boolean> {
  if (!interaction.customId.startsWith('hit:mod:')) return false;
  const [, , operation, token] = interaction.customId.split(':');
  if (!operation || !token) return true;
  const action = pendingActions.get(token);
  if (!action || action.expiresAt <= Date.now()) {
    pendingActions.delete(token);
    await interaction.reply({ content: '⚠ This confirmation expired.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (interaction.user.id !== action.moderatorId) {
    await interaction.reply({ content: '✖ Only the moderator who started this action can confirm it.', flags: MessageFlags.Ephemeral });
    return true;
  }
  if (operation === 'cancel') {
    pendingActions.delete(token);
    await interaction.update({ content: '✓ Moderation action cancelled.', embeds: [], components: [] });
    return true;
  }
  if (operation !== 'confirm' || !interaction.guild) return true;

  pendingActions.delete(token);
  await interaction.deferUpdate();
  const moderationCase = await executeDangerousAction(action, interaction.guild, store);
  await interaction.editReply({
    content: `✓ ${action.type === 'ban' ? 'Banned' : 'Kicked'} <@${action.targetId}>. Case #${moderationCase.id}.`,
    embeds: [],
    components: [],
  });
  return true;
}

async function warnMember(
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
  store: Store,
): Promise<ModerationCase> {
  requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
  const settings = requireModerationSettings(store, moderator.guild.id);
  const botMember = await getBotMember(moderator.guild);
  assertTargetable(moderator, target, botMember);
  store.addWarning(moderator.guild.id, target.id, moderator.id, reason);
  await notifyTarget(target.user, moderator.guild, 'WARNING', reason);
  return createCase(store, moderator.guild, settings, {
    moderatorId: moderator.id,
    targetId: target.id,
    action: 'warn',
    reason,
    metadata: { activeWarnings: store.listActiveWarnings(moderator.guild.id, target.id).length },
  });
}

async function timeoutMember(
  moderator: GuildMember,
  target: GuildMember,
  durationMs: number,
  reason: string,
  store: Store,
): Promise<ModerationCase> {
  requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
  const settings = requireModerationSettings(store, moderator.guild.id);
  const botMember = await getBotMember(moderator.guild);
  assertTargetable(moderator, target, botMember);
  if (!target.moderatable) throw new Error('HIT cannot timeout that member.');
  await notifyTarget(target.user, moderator.guild, 'TIMEOUT', reason, formatDuration(durationMs));
  await target.timeout(durationMs, `${reason} | Moderator ${moderator.user.tag}`);
  return createCase(store, moderator.guild, settings, {
    moderatorId: moderator.id,
    targetId: target.id,
    action: 'timeout',
    reason,
    metadata: { duration: formatDuration(durationMs), durationMs },
  });
}

async function removeTimeout(
  moderator: GuildMember,
  target: GuildMember,
  reason: string,
  store: Store,
): Promise<ModerationCase> {
  requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
  const settings = requireModerationSettings(store, moderator.guild.id);
  const botMember = await getBotMember(moderator.guild);
  assertTargetable(moderator, target, botMember);
  if (!target.moderatable) throw new Error('HIT cannot change that member’s timeout.');
  await target.timeout(null, `${reason} | Moderator ${moderator.user.tag}`);
  return createCase(store, moderator.guild, settings, {
    moderatorId: moderator.id,
    targetId: target.id,
    action: 'untimeout',
    reason,
  });
}

async function purgeMessages(
  moderator: GuildMember,
  channel: ChatInputCommandInteraction['channel'] | Message['channel'],
  amount: number,
  targetUserId: string | null,
  store: Store,
): Promise<{ deleted: number; moderationCase: ModerationCase }> {
  requireMemberPermission(moderator, PermissionFlagsBits.ManageMessages, 'Manage Messages');
  const settings = requireModerationSettings(store, moderator.guild.id);
  if (!channel || !channel.isTextBased() || !('bulkDelete' in channel) || !('messages' in channel)) {
    throw new Error('Use this command in a standard text channel or thread.');
  }
  const fetched = await channel.messages.fetch({ limit: 100 });
  const selected = fetched
    .filter((message) => !message.pinned && (!targetUserId || message.author.id === targetUserId))
    .first(Math.max(1, Math.min(amount, 100)));
  const deleted = await channel.bulkDelete(selected, true);
  const moderationCase = await createCase(store, moderator.guild, settings, {
    moderatorId: moderator.id,
    targetId: targetUserId,
    action: 'purge',
    reason: 'Message cleanup',
    metadata: { requested: amount, deleted: deleted.size, channelId: channel.id },
  });
  return { deleted: deleted.size, moderationCase };
}

async function setSlowmode(
  moderator: GuildMember,
  channel: ChatInputCommandInteraction['channel'] | Message['channel'],
  seconds: number,
  store: Store,
): Promise<ModerationCase> {
  requireMemberPermission(moderator, PermissionFlagsBits.ManageChannels, 'Manage Channels');
  const settings = requireModerationSettings(store, moderator.guild.id);
  if (!channel || !channel.isTextBased() || !('setRateLimitPerUser' in channel)) {
    throw new Error('Use this command in a channel that supports slowmode.');
  }
  await channel.setRateLimitPerUser(seconds, `HIT slowmode by ${moderator.user.tag}`);
  return createCase(store, moderator.guild, settings, {
    moderatorId: moderator.id,
    targetId: null,
    action: 'slowmode',
    reason: seconds === 0 ? 'Slowmode disabled' : `Slowmode set to ${seconds} seconds`,
    metadata: { channelId: channel.id, seconds },
  });
}

async function setChannelLock(
  moderator: GuildMember,
  channel: ChatInputCommandInteraction['channel'] | Message['channel'],
  locked: boolean,
  store: Store,
): Promise<ModerationCase> {
  requireMemberPermission(moderator, PermissionFlagsBits.ManageChannels, 'Manage Channels');
  const settings = requireModerationSettings(store, moderator.guild.id);
  if (!channel || !('permissionOverwrites' in channel)) throw new Error('Use this command in a guild channel.');
  await channel.permissionOverwrites.edit(moderator.guild.roles.everyone, {
    SendMessages: locked ? false : null,
    AddReactions: locked ? false : null,
    SendMessagesInThreads: locked ? false : null,
  }, { reason: `HIT ${locked ? 'lock' : 'unlock'} by ${moderator.user.tag}` });
  return createCase(store, moderator.guild, settings, {
    moderatorId: moderator.id,
    targetId: null,
    action: locked ? 'lock' : 'unlock',
    reason: `${locked ? 'Locked' : 'Unlocked'} channel`,
    metadata: { channelId: channel.id },
  });
}

async function changeNickname(
  moderator: GuildMember,
  target: GuildMember,
  nickname: string | null,
  reason: string,
  store: Store,
): Promise<ModerationCase> {
  requireMemberPermission(moderator, PermissionFlagsBits.ManageNicknames, 'Manage Nicknames');
  const settings = requireModerationSettings(store, moderator.guild.id);
  const botMember = await getBotMember(moderator.guild);
  assertTargetable(moderator, target, botMember);
  if (!target.manageable) throw new Error('HIT cannot change that member’s nickname.');
  await target.setNickname(nickname, `${reason} | Moderator ${moderator.user.tag}`);
  return createCase(store, moderator.guild, settings, {
    moderatorId: moderator.id,
    targetId: target.id,
    action: 'nickname',
    reason,
    metadata: { nickname: nickname ?? 'reset' },
  });
}

async function changeRole(
  moderator: GuildMember,
  target: GuildMember,
  role: Role,
  add: boolean,
  reason: string,
  store: Store,
): Promise<ModerationCase> {
  requireMemberPermission(moderator, PermissionFlagsBits.ManageRoles, 'Manage Roles');
  const settings = requireModerationSettings(store, moderator.guild.id);
  const botMember = await getBotMember(moderator.guild);
  assertTargetable(moderator, target, botMember);
  assertRoleManageable(moderator, role, botMember);
  if (add) await target.roles.add(role, `${reason} | Moderator ${moderator.user.tag}`);
  else await target.roles.remove(role, `${reason} | Moderator ${moderator.user.tag}`);
  return createCase(store, moderator.guild, settings, {
    moderatorId: moderator.id,
    targetId: target.id,
    action: add ? 'role_add' : 'role_remove',
    reason,
    metadata: { roleId: role.id, roleName: role.name },
  });
}

function historyEmbed(user: User, cases: ModerationCase[]): EmbedBuilder {
  const lines = cases.length
    ? cases.map((item) => `**#${item.id}** • ${item.action.toUpperCase()} • <t:${Math.floor(item.createdAt / 1000)}:R>\n${item.reason}`)
    : ['No moderation history found.'];
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`MODERATION HISTORY — ${user.username}`)
    .setDescription(lines.join('\n\n').slice(0, 4000))
    .setThumbnail(user.displayAvatarURL());
}

function warningsEmbed(user: User, warnings: ReturnType<Store['listActiveWarnings']>): EmbedBuilder {
  const lines = warnings.length
    ? warnings.map((warning) => `**#${warning.id}** • <t:${Math.floor(warning.createdAt / 1000)}:R> • <@${warning.moderatorId}>\n${warning.reason}`)
    : ['No active warnings.'];
  return new EmbedBuilder()
    .setColor(warnings.length ? DANGER : SUCCESS)
    .setTitle(`ACTIVE WARNINGS — ${user.username}`)
    .setDescription(lines.join('\n\n').slice(0, 4000))
    .setThumbnail(user.displayAvatarURL());
}

export async function handleHitModerationAdminCommand(
  interaction: ChatInputCommandInteraction,
  store: Store,
): Promise<boolean> {
  if (interaction.commandName !== 'hit' || !interaction.guild || !interaction.member) return false;
  const subcommand = interaction.options.getSubcommand();
  if (!subcommand.startsWith('moderation-')) return false;
  const member = await interaction.guild.members.fetch(interaction.user.id);
  requireMemberPermission(member, PermissionFlagsBits.ManageGuild, 'Manage Server');

  if (subcommand === 'moderation-setup') {
    const channel = interaction.options.getChannel('log_channel', true);
    if (channel.type !== ChannelType.GuildText) throw new Error('Choose a standard text channel.');
    store.upsertModerationSettings({ guildId: interaction.guild.id, logChannelId: channel.id });
    await interaction.reply({ content: `✓ Moderation logs configured in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  const settings = requireModerationSettings(store, interaction.guild.id);
  if (subcommand === 'moderation-config') {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR).setTitle('HIT MODERATION CONFIG').addFields(
        { name: 'Log channel', value: `<#${settings.logChannelId}>` },
        { name: 'Prefix', value: `\`${store.getGuildSettings(interaction.guild.id)?.prefix ?? ';'}\`` },
      )],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const botMember = await getBotMember(interaction.guild);
  const channel = await interaction.guild.channels.fetch(settings.logChannelId).catch(() => null);
  const needed = [
    ['Manage Messages', PermissionFlagsBits.ManageMessages],
    ['Manage Channels', PermissionFlagsBits.ManageChannels],
    ['Manage Roles', PermissionFlagsBits.ManageRoles],
    ['Manage Nicknames', PermissionFlagsBits.ManageNicknames],
    ['Timeout Members', PermissionFlagsBits.ModerateMembers],
    ['Kick Members', PermissionFlagsBits.KickMembers],
    ['Ban Members', PermissionFlagsBits.BanMembers],
  ] as const;
  const lines = needed.map(([label, permission]) => `${botMember.permissions.has(permission) ? '✅' : '❌'} **${label}**`);
  lines.push(`${channel?.type === ChannelType.GuildText ? '✅' : '❌'} **Moderation log channel**`);
  if (channel?.type === ChannelType.GuildText) {
    const permissions = channel.permissionsFor(botMember);
    lines.push(`${permissions?.has(PermissionFlagsBits.SendMessages) && permissions.has(PermissionFlagsBits.EmbedLinks) ? '✅' : '❌'} **Log channel send/embed access**`);
  }
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(lines.every((line) => line.startsWith('✅')) ? SUCCESS : DANGER).setTitle('HIT MODERATION DIAGNOSTICS').setDescription(lines.join('\n'))],
    flags: MessageFlags.Ephemeral,
  });
  return true;
}

export async function handleModerationSlashCommand(
  interaction: ChatInputCommandInteraction,
  store: Store,
): Promise<void> {
  if (interaction.commandName !== 'mod' || !interaction.guild) return;
  const moderator = await interaction.guild.members.fetch(interaction.user.id);
  const subcommand = interaction.options.getSubcommand();
  requireModerationSettings(store, interaction.guild.id);

  if (subcommand === 'warn') {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('user', true).id);
    const reason = interaction.options.getString('reason', true);
    const moderationCase = await warnMember(moderator, target, reason, store);
    await interaction.reply({ content: `✓ Warned ${target}. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'warnings') {
    requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
    const user = interaction.options.getUser('user', true);
    await interaction.reply({ embeds: [warningsEmbed(user, store.listActiveWarnings(interaction.guild.id, user.id))], flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'clearwarnings') {
    requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const settings = requireModerationSettings(store, interaction.guild.id);
    const count = store.clearActiveWarnings(interaction.guild.id, user.id, moderator.id);
    const moderationCase = await createCase(store, interaction.guild, settings, {
      moderatorId: moderator.id,
      targetId: user.id,
      action: 'clearwarnings',
      reason,
      metadata: { cleared: count },
    });
    await interaction.reply({ content: `✓ Cleared ${count} warning(s) for ${user}. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'timeout') {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('user', true).id);
    const rawDuration = interaction.options.getString('duration', true);
    const duration = parseDuration(rawDuration);
    if (!duration) throw new Error('Use a duration like `10m`, `2h`, `3d`, or `1w` (maximum 28 days).');
    const reason = interaction.options.getString('reason', true);
    const moderationCase = await timeoutMember(moderator, target, duration, reason, store);
    await interaction.reply({ content: `✓ Timed out ${target} for ${formatDuration(duration)}. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'untimeout') {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('user', true).id);
    const reason = interaction.options.getString('reason', true);
    const moderationCase = await removeTimeout(moderator, target, reason, store);
    await interaction.reply({ content: `✓ Removed ${target}’s timeout. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'kick' || subcommand === 'ban') {
    const permission = subcommand === 'kick' ? PermissionFlagsBits.KickMembers : PermissionFlagsBits.BanMembers;
    requireMemberPermission(moderator, permission, subcommand === 'kick' ? 'Kick Members' : 'Ban Members');
    const user = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member) assertTargetable(moderator, member, await getBotMember(interaction.guild));
    const reason = interaction.options.getString('reason', true);
    const deleteDays = subcommand === 'ban' ? interaction.options.getInteger('delete_days') ?? 0 : 0;
    const action = queueDangerousAction({
      type: subcommand,
      guildId: interaction.guild.id,
      moderatorId: moderator.id,
      targetId: user.id,
      reason,
      deleteMessageSeconds: deleteDays * 86_400,
    });
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(DANGER).setTitle(`CONFIRM ${subcommand.toUpperCase()}`).setDescription(`Target: ${user}\nReason: ${reason}\n\nThis confirmation expires in 60 seconds.`)],
      components: [confirmationRow(action.token)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (subcommand === 'unban') {
    requireMemberPermission(moderator, PermissionFlagsBits.BanMembers, 'Ban Members');
    const userId = interaction.options.getString('user_id', true).replace(/\D/g, '');
    if (!/^\d{17,20}$/.test(userId)) throw new Error('Provide a valid Discord user ID.');
    const reason = interaction.options.getString('reason', true);
    const settings = requireModerationSettings(store, interaction.guild.id);
    await interaction.guild.members.unban(userId, `${reason} | Moderator ${moderator.user.tag}`);
    const moderationCase = await createCase(store, interaction.guild, settings, {
      moderatorId: moderator.id,
      targetId: userId,
      action: 'unban',
      reason,
    });
    await interaction.reply({ content: `✓ Unbanned <@${userId}>. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'purge') {
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('user');
    const result = await purgeMessages(moderator, interaction.channel, amount, user?.id ?? null, store);
    await interaction.reply({ content: `✓ Deleted ${result.deleted} message(s). Case #${result.moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'slowmode') {
    const seconds = interaction.options.getInteger('seconds', true);
    const moderationCase = await setSlowmode(moderator, interaction.channel, seconds, store);
    await interaction.reply({ content: `✓ Slowmode ${seconds === 0 ? 'disabled' : `set to ${seconds} seconds`}. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'lock' || subcommand === 'unlock') {
    const moderationCase = await setChannelLock(moderator, interaction.channel, subcommand === 'lock', store);
    await interaction.reply({ content: `✓ Channel ${subcommand === 'lock' ? 'locked' : 'unlocked'}. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'nick') {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('user', true).id);
    const nickname = interaction.options.getString('nickname');
    const reason = interaction.options.getString('reason', true);
    const moderationCase = await changeNickname(moderator, target, nickname, reason, store);
    await interaction.reply({ content: `✓ ${nickname ? 'Updated' : 'Reset'} ${target}’s nickname. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'role-add' || subcommand === 'role-remove') {
    const target = await interaction.guild.members.fetch(interaction.options.getUser('user', true).id);
    const selectedRole = interaction.options.getRole('role', true);
    const role = await interaction.guild.roles.fetch(selectedRole.id);
    if (!role) throw new Error('Role not found.');
    const reason = interaction.options.getString('reason', true);
    const moderationCase = await changeRole(moderator, target, role, subcommand === 'role-add', reason, store);
    await interaction.reply({ content: `✓ ${subcommand === 'role-add' ? 'Added' : 'Removed'} ${role} ${subcommand === 'role-add' ? 'to' : 'from'} ${target}. Case #${moderationCase.id}.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'case') {
    requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
    const moderationCase = store.getModerationCase(interaction.guild.id, interaction.options.getInteger('id', true));
    if (!moderationCase) throw new Error('Case not found.');
    await interaction.reply({ embeds: [caseEmbed(moderationCase)], flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'history') {
    requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
    const user = interaction.options.getUser('user', true);
    const limit = interaction.options.getInteger('limit') ?? 10;
    await interaction.reply({ embeds: [historyEmbed(user, store.listModerationCasesForTarget(interaction.guild.id, user.id, limit))], flags: MessageFlags.Ephemeral });
  }
}

async function resolveMentionedMember(message: Message, raw?: string): Promise<GuildMember> {
  if (!message.guild) throw new Error('This command only works in a server.');
  const mentioned = message.mentions.members?.first();
  if (mentioned) return mentioned;
  const id = raw?.replace(/\D/g, '');
  if (!id) throw new Error('Mention a member or provide their user ID.');
  return message.guild.members.fetch(id);
}

async function resolveMentionedRole(message: Message, raw?: string): Promise<Role> {
  if (!message.guild) throw new Error('This command only works in a server.');
  const mentioned = message.mentions.roles.first();
  if (mentioned) return mentioned;
  const id = raw?.replace(/\D/g, '');
  if (!id) throw new Error('Mention a role or provide its role ID.');
  const role = await message.guild.roles.fetch(id);
  if (!role) throw new Error('Role not found.');
  return role;
}

export async function handleModerationPrefixCommand(message: Message, store: Store, defaultPrefix: string): Promise<void> {
  if (!message.guild || !message.member || message.author.bot) return;
  const prefix = store.getGuildSettings(message.guild.id)?.prefix ?? defaultPrefix;
  if (!message.content.startsWith(prefix)) return;
  const body = message.content.slice(prefix.length).trim();
  const args = body.split(/\s+/);
  const command = args[0]?.toLowerCase();
  if (!command || !MODERATION_PREFIX_COMMANDS.has(command)) return;
  requireModerationSettings(store, message.guild.id);
  const moderator = message.member;

  if (command === 'warn') {
    const target = await resolveMentionedMember(message, args[1]);
    const reason = args.slice(2).join(' ').trim();
    if (!reason) throw new Error(`Usage: ${prefix}warn @member reason`);
    const moderationCase = await warnMember(moderator, target, reason, store);
    await message.reply(`✓ Warned ${target}. Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'warnings') {
    requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
    const target = await resolveMentionedMember(message, args[1]);
    await message.reply({ embeds: [warningsEmbed(target.user, store.listActiveWarnings(message.guild.id, target.id))] });
    return;
  }
  if (command === 'clearwarnings') {
    requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
    const target = await resolveMentionedMember(message, args[1]);
    const reason = args.slice(2).join(' ').trim();
    if (!reason) throw new Error(`Usage: ${prefix}clearwarnings @member reason`);
    const settings = requireModerationSettings(store, message.guild.id);
    const count = store.clearActiveWarnings(message.guild.id, target.id, moderator.id);
    const moderationCase = await createCase(store, message.guild, settings, {
      moderatorId: moderator.id,
      targetId: target.id,
      action: 'clearwarnings',
      reason,
      metadata: { cleared: count },
    });
    await message.reply(`✓ Cleared ${count} warning(s). Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'timeout') {
    const target = await resolveMentionedMember(message, args[1]);
    const duration = parseDuration(args[2] ?? '');
    if (!duration) throw new Error(`Usage: ${prefix}timeout @member 10m reason`);
    const reason = args.slice(3).join(' ').trim();
    if (!reason) throw new Error(`Usage: ${prefix}timeout @member 10m reason`);
    const moderationCase = await timeoutMember(moderator, target, duration, reason, store);
    await message.reply(`✓ Timed out ${target} for ${formatDuration(duration)}. Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'untimeout') {
    const target = await resolveMentionedMember(message, args[1]);
    const reason = args.slice(2).join(' ').trim();
    if (!reason) throw new Error(`Usage: ${prefix}untimeout @member reason`);
    const moderationCase = await removeTimeout(moderator, target, reason, store);
    await message.reply(`✓ Removed ${target}’s timeout. Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'kick' || command === 'ban') {
    const permission = command === 'kick' ? PermissionFlagsBits.KickMembers : PermissionFlagsBits.BanMembers;
    requireMemberPermission(moderator, permission, command === 'kick' ? 'Kick Members' : 'Ban Members');
    const target = await resolveMentionedMember(message, args[1]);
    assertTargetable(moderator, target, await getBotMember(message.guild));
    const reason = args.slice(2).join(' ').trim();
    if (!reason) throw new Error(`Usage: ${prefix}${command} @member reason`);
    const action = queueDangerousAction({
      type: command,
      guildId: message.guild.id,
      moderatorId: moderator.id,
      targetId: target.id,
      reason,
      deleteMessageSeconds: command === 'ban' ? 86_400 : 0,
    });
    await message.reply({
      embeds: [new EmbedBuilder().setColor(DANGER).setTitle(`CONFIRM ${command.toUpperCase()}`).setDescription(`Target: ${target}\nReason: ${reason}\n\nThis confirmation expires in 60 seconds.`)],
      components: [confirmationRow(action.token)],
    });
    return;
  }
  if (command === 'unban') {
    requireMemberPermission(moderator, PermissionFlagsBits.BanMembers, 'Ban Members');
    const userId = args[1]?.replace(/\D/g, '') ?? '';
    const reason = args.slice(2).join(' ').trim();
    if (!/^\d{17,20}$/.test(userId) || !reason) throw new Error(`Usage: ${prefix}unban USER_ID reason`);
    const settings = requireModerationSettings(store, message.guild.id);
    await message.guild.members.unban(userId, `${reason} | Moderator ${moderator.user.tag}`);
    const moderationCase = await createCase(store, message.guild, settings, {
      moderatorId: moderator.id,
      targetId: userId,
      action: 'unban',
      reason,
    });
    await message.reply(`✓ Unbanned <@${userId}>. Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'purge') {
    const amount = Number(args[1]);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100) throw new Error(`Usage: ${prefix}purge 1-100 [@member]`);
    const target = message.mentions.users.first();
    const result = await purgeMessages(moderator, message.channel, amount, target?.id ?? null, store);
    const reply = await message.reply(`✓ Deleted ${result.deleted} message(s). Case #${result.moderationCase.id}.`);
    setTimeout(() => void reply.delete().catch(() => undefined), 5_000).unref();
    return;
  }
  if (command === 'slowmode') {
    const seconds = Number(args[1]);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 21_600) throw new Error(`Usage: ${prefix}slowmode 0-21600`);
    const moderationCase = await setSlowmode(moderator, message.channel, seconds, store);
    await message.reply(`✓ Slowmode ${seconds === 0 ? 'disabled' : `set to ${seconds} seconds`}. Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'lock' || command === 'unlock') {
    const moderationCase = await setChannelLock(moderator, message.channel, command === 'lock', store);
    await message.reply(`✓ Channel ${command === 'lock' ? 'locked' : 'unlocked'}. Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'nick') {
    const target = await resolveMentionedMember(message, args[1]);
    const rawNickname = args.slice(2).join(' ').trim();
    if (!rawNickname) throw new Error(`Usage: ${prefix}nick @member new nickname | reset`);
    const nickname = rawNickname.toLowerCase() === 'reset' ? null : rawNickname.slice(0, 32);
    const moderationCase = await changeNickname(moderator, target, nickname, 'Nickname changed by staff', store);
    await message.reply(`✓ ${nickname ? 'Updated' : 'Reset'} ${target}’s nickname. Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'role' || command === 'unrole') {
    const target = await resolveMentionedMember(message, args[1]);
    const role = await resolveMentionedRole(message, args[2]);
    const reason = args.slice(3).join(' ').trim() || 'Role updated by staff';
    const moderationCase = await changeRole(moderator, target, role, command === 'role', reason, store);
    await message.reply(`✓ ${command === 'role' ? 'Added' : 'Removed'} ${role} ${command === 'role' ? 'to' : 'from'} ${target}. Case #${moderationCase.id}.`);
    return;
  }
  if (command === 'case') {
    requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
    const id = Number(args[1]);
    if (!Number.isInteger(id) || id < 1) throw new Error(`Usage: ${prefix}case CASE_ID`);
    const moderationCase = store.getModerationCase(message.guild.id, id);
    if (!moderationCase) throw new Error('Case not found.');
    await message.reply({ embeds: [caseEmbed(moderationCase)] });
    return;
  }
  if (command === 'history') {
    requireMemberPermission(moderator, PermissionFlagsBits.ModerateMembers, 'Timeout Members');
    const target = await resolveMentionedMember(message, args[1]);
    await message.reply({ embeds: [historyEmbed(target.user, store.listModerationCasesForTarget(message.guild.id, target.id, 10))] });
  }
}

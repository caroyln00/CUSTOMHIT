import {
  AuditLogEvent,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Guild,
  GuildAuditLogsEntry,
  GuildChannel,
  GuildMember,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  PermissionsBitField,
  Role,
} from 'discord.js';
import type { PermissionOverwriteOptions } from 'discord.js';
import type {
  LockdownSnapshot,
  SecurityEventRecord,
  SecuritySettings,
  Store,
} from '../../core/store.js';
import { logger } from '../../core/logger.js';
import {
  detectPhishing,
  isBurstSpam,
  isDuplicateSpam,
  normalizeMessage,
} from './heuristics.js';

const COLOR = 0xf59e0b;
const DANGER = 0xef4444;
const SUCCESS = 0x22c55e;

const SECURITY_PREFIX_COMMANDS = new Set(['security', 'lockdown', 'unlockdown']);

const TEXT_LOCK_KEYS = [
  'SendMessages',
  'AddReactions',
  'CreatePublicThreads',
  'CreatePrivateThreads',
  'SendMessagesInThreads',
] as const;

const VOICE_LOCK_KEYS = ['Connect', 'Speak'] as const;

type LockPermissionName = typeof TEXT_LOCK_KEYS[number] | typeof VOICE_LOCK_KEYS[number];

const LOCK_PERMISSION_FLAGS: Record<LockPermissionName, bigint> = {
  SendMessages: PermissionFlagsBits.SendMessages,
  AddReactions: PermissionFlagsBits.AddReactions,
  CreatePublicThreads: PermissionFlagsBits.CreatePublicThreads,
  CreatePrivateThreads: PermissionFlagsBits.CreatePrivateThreads,
  SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
  Connect: PermissionFlagsBits.Connect,
  Speak: PermissionFlagsBits.Speak,
};

const DANGEROUS_PERMISSIONS = new PermissionsBitField([
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
]);

const DANGEROUS_ACTION_WEIGHTS = new Map<AuditLogEvent, number>([
  [AuditLogEvent.ChannelDelete, 2],
  [AuditLogEvent.RoleDelete, 2],
  [AuditLogEvent.BotAdd, 3],
  [AuditLogEvent.MemberBanAdd, 1],
  [AuditLogEvent.MemberKick, 1],
  [AuditLogEvent.WebhookCreate, 1],
  [AuditLogEvent.WebhookDelete, 1],
  [AuditLogEvent.RoleUpdate, 1],
  [AuditLogEvent.ChannelOverwriteCreate, 1],
  [AuditLogEvent.ChannelOverwriteUpdate, 1],
  [AuditLogEvent.ChannelOverwriteDelete, 1],
  [AuditLogEvent.GuildUpdate, 1],
]);

interface MessageState {
  timestamps: number[];
  messages: Array<{ normalized: string; timestamp: number }>;
  incidents: number[];
}

interface AuditActionState {
  actions: Array<{ timestamp: number; points: number }>;
}

const messageStates = new Map<string, MessageState>();
const joinWindows = new Map<string, number[]>();
const raidAlertCooldowns = new Map<string, number>();
const auditActionStates = new Map<string, AuditActionState>();
const containmentCooldowns = new Map<string, number>();

function requireSecuritySettings(store: Store, guildId: string): SecuritySettings {
  const settings = store.getSecuritySettings(guildId);
  if (!settings) throw new Error('Run `/hit security-setup` first.');
  return settings;
}

function onOff(value: boolean): string {
  return value ? 'ON' : 'OFF';
}

function securityConfigEmbed(settings: SecuritySettings, trustedUsers: string[]): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('HIT SECURITY CONFIGURATION')
    .addFields(
      { name: 'Log Channel', value: `<#${settings.logChannelId}>`, inline: true },
      { name: 'Quarantine Role', value: settings.quarantineRoleId ? `<@&${settings.quarantineRoleId}>` : 'Not configured', inline: true },
      { name: 'Trusted Accounts', value: trustedUsers.length ? trustedUsers.map((id) => `<@${id}>`).join(', ').slice(0, 1024) : 'Server owner only', inline: false },
      { name: 'Protection', value: [
        `Anti-spam: **${onOff(settings.antiSpamEnabled)}**`,
        `Anti-phishing: **${onOff(settings.antiPhishingEnabled)}**`,
        `Anti-raid: **${onOff(settings.antiRaidEnabled)}**`,
        `Anti-nuke: **${onOff(settings.antiNukeEnabled)}**`,
        `Automatic lockdown: **${onOff(settings.autoLockdownEnabled)}**`,
      ].join('\n'), inline: true },
      { name: 'Thresholds', value: [
        `${settings.spamMessageLimit} messages / ${settings.spamWindowSeconds}s`,
        `${settings.duplicateMessageLimit} duplicate messages`,
        `${settings.mentionLimit} mentions per message`,
        `${settings.raidJoinLimit} joins / ${settings.raidWindowSeconds}s`,
        `${settings.nukeActionLimit} destructive points / ${settings.nukeWindowSeconds}s`,
      ].join('\n'), inline: true },
    )
    .setFooter({ text: 'Owner and HIT are always trusted. Trust staff before they perform bulk server changes.' })
    .setTimestamp(settings.updatedAt);
}

function securityStatusEmbed(store: Store, settings: SecuritySettings): EmbedBuilder {
  const lockdown = store.getSecurityLockdown(settings.guildId);
  const lockdownText = lockdown?.active
    ? `ACTIVE — ${lockdown.expiresAt ? `<t:${Math.floor(lockdown.expiresAt / 1000)}:R>` : 'manual unlock required'}\nReason: ${lockdown.reason}`
    : 'Inactive';
  return securityConfigEmbed(settings, store.listSecurityTrustedUsers(settings.guildId))
    .setTitle('HIT SECURITY STATUS')
    .addFields({ name: 'Emergency Lockdown', value: lockdownText });
}

async function sendSecurityLog(
  guild: Guild,
  settings: SecuritySettings,
  input: {
    eventType: string;
    severity: 'info' | 'warning' | 'critical';
    actorId?: string | null;
    targetId?: string | null;
    title: string;
    description: string;
    detail?: Record<string, unknown>;
  },
  store: Store,
): Promise<SecurityEventRecord> {
  const event = store.recordSecurityEvent({
    guildId: guild.id,
    actorId: input.actorId ?? null,
    targetId: input.targetId ?? null,
    eventType: input.eventType,
    severity: input.severity,
    detail: input.detail ?? null,
  });

  const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
  if (channel?.type === ChannelType.GuildText) {
    const color = input.severity === 'critical' ? DANGER : input.severity === 'warning' ? COLOR : SUCCESS;
    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(input.title)
      .setDescription(input.description)
      .setFooter({ text: `Security event #${event.id}` })
      .setTimestamp(event.createdAt);
    if (input.detail) {
      const detail = Object.entries(input.detail)
        .slice(0, 10)
        .map(([key, value]) => `**${key}:** ${String(value)}`)
        .join('\n');
      if (detail) embed.addFields({ name: 'Details', value: detail.slice(0, 1024) });
    }
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => undefined);
  }
  return event;
}

function isSecurityTrusted(guild: Guild, userId: string, store: Store): boolean {
  return userId === guild.ownerId
    || userId === guild.members.me?.id
    || store.isSecurityTrustedUser(guild.id, userId);
}

async function timeoutForSecurity(member: GuildMember, settings: SecuritySettings, reason: string): Promise<boolean> {
  if (!member.moderatable || member.id === member.guild.ownerId) return false;
  await member.timeout(settings.autoTimeoutMinutes * 60_000, reason).catch(() => undefined);
  return Boolean(member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now());
}

function countMentions(message: Message): number {
  return message.mentions.users.size
    + message.mentions.roles.size
    + (message.mentions.everyone ? settingsSafeEveryoneCount(message) : 0);
}

function settingsSafeEveryoneCount(message: Message): number {
  return message.content.includes('@everyone') || message.content.includes('@here') ? 100 : 0;
}

export async function handleSecurityMessage(message: Message, store: Store): Promise<boolean> {
  if (!message.guild || !message.member || message.author.bot) return false;
  const settings = store.getSecuritySettings(message.guild.id);
  if (!settings) return false;

  const trusted = isSecurityTrusted(message.guild, message.author.id, store);

  if (settings.antiPhishingEnabled && !trusted) {
    const detection = detectPhishing(message.content);
    if (detection.detected) {
      await message.delete().catch(() => undefined);
      const timedOut = await timeoutForSecurity(message.member, settings, `HIT anti-phishing: ${detection.reason ?? 'dangerous link'}`);
      await sendSecurityLog(message.guild, settings, {
        eventType: 'phishing_blocked',
        severity: 'critical',
        actorId: message.author.id,
        title: 'PHISHING CONTENT BLOCKED',
        description: `HIT removed a high-confidence phishing or credential-theft pattern from <@${message.author.id}>.`,
        detail: {
          reason: detection.reason ?? 'Unknown',
          host: detection.host ?? 'Not available',
          channel: message.channelId,
          timedOut,
        },
      }, store);
      return true;
    }
  }

  if (!settings.antiSpamEnabled || trusted || message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return false;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const state = messageStates.get(key) ?? { timestamps: [], messages: [], incidents: [] };
  state.timestamps.push(now);
  state.messages.push({ normalized: normalizeMessage(message.content), timestamp: now });
  state.timestamps = state.timestamps.filter((timestamp) => timestamp >= now - Math.max(settings.spamWindowSeconds * 1000, 30_000));
  state.messages = state.messages.filter((entry) => entry.timestamp >= now - 30_000);
  state.incidents = state.incidents.filter((timestamp) => timestamp >= now - 5 * 60_000);

  const burst = isBurstSpam(state.timestamps, now, settings.spamMessageLimit, settings.spamWindowSeconds);
  const duplicate = isDuplicateSpam(
    state.messages,
    normalizeMessage(message.content),
    now,
    settings.duplicateMessageLimit,
  );
  const mentionSpam = countMentions(message) > settings.mentionLimit;

  if (!burst && !duplicate && !mentionSpam) {
    messageStates.set(key, state);
    return false;
  }

  state.incidents.push(now);
  messageStates.set(key, state);
  await message.delete().catch(() => undefined);
  const reason = mentionSpam ? 'Mass mention spam' : duplicate ? 'Repeated duplicate messages' : 'Message flood';
  const timedOut = state.incidents.length >= 2
    ? await timeoutForSecurity(message.member, settings, `HIT anti-spam: ${reason}`)
    : false;

  if (message.channel.isSendable()) {
    const notice = await message.channel.send({
      content: `<@${message.author.id}> spam blocked.${timedOut ? ` You were timed out for ${settings.autoTimeoutMinutes} minutes.` : ''}`,
      allowedMentions: { users: [message.author.id] },
    }).catch(() => null);
    if (notice) setTimeout(() => void notice.delete().catch(() => undefined), 8_000).unref();
  }

  await sendSecurityLog(message.guild, settings, {
    eventType: 'spam_blocked',
    severity: timedOut ? 'warning' : 'info',
    actorId: message.author.id,
    title: 'SPAM BLOCKED',
    description: `HIT removed spam from <@${message.author.id}> in <#${message.channelId}>.`,
    detail: { reason, incidents: state.incidents.length, timedOut },
  }, store);
  return true;
}

function permissionKeysForChannel(channel: GuildChannel): LockPermissionName[] {
  switch (channel.type) {
    case ChannelType.GuildCategory:
      return [...TEXT_LOCK_KEYS, ...VOICE_LOCK_KEYS];
    case ChannelType.GuildVoice:
    case ChannelType.GuildStageVoice:
      return [...VOICE_LOCK_KEYS];
    case ChannelType.GuildText:
    case ChannelType.GuildAnnouncement:
    case ChannelType.GuildForum:
    case ChannelType.GuildMedia:
      return [...TEXT_LOCK_KEYS];
    default:
      return [];
  }
}

const LOCKDOWN_EXEMPT_IDS = new Set([
  '1528862721402077214',
  '1528862198510784592',
  '1528862452299857921',
  '1528863063862939720',
]);

function isLockdownExemptChannel(channel: GuildChannel): boolean {
  if (LOCKDOWN_EXEMPT_IDS.has(channel.id)) return true;
  const parentId = 'parentId' in channel ? channel.parentId : null;
  return typeof parentId === 'string' && LOCKDOWN_EXEMPT_IDS.has(parentId);
}

const VERIFIED_SNAPSHOT_PREFIX = 'verified:';
const VERIFIED_OVERWRITE_EXISTED_KEY = `${VERIFIED_SNAPSHOT_PREFIX}__overwriteExisted`;

function snapshotOverwriteForTarget(
  channel: GuildChannel,
  targetId: string,
  keys: LockPermissionName[],
  prefix = '',
): LockdownSnapshot['permissions'] {
  const overwrite = channel.permissionOverwrites.cache.get(targetId);
  return Object.fromEntries(keys.map((key) => {
    const flag = LOCK_PERMISSION_FLAGS[key];
    if (overwrite?.allow.has(flag)) return [`${prefix}${key}`, true];
    if (overwrite?.deny.has(flag)) return [`${prefix}${key}`, false];
    return [`${prefix}${key}`, null];
  }));
}

function permissionOptionsFromSnapshot(
  permissions: LockdownSnapshot['permissions'],
  keys: LockPermissionName[],
  prefix = '',
): PermissionOverwriteOptions {
  return Object.fromEntries(keys.map((key) => [key, permissions[`${prefix}${key}`] ?? null])) as PermissionOverwriteOptions;
}

function lockdownPermissions(keys: LockPermissionName[]): PermissionOverwriteOptions {
  return Object.fromEntries(keys.map((key) => [key, false])) as PermissionOverwriteOptions;
}

async function removeEmptyOverwrite(
  channel: GuildChannel,
  target: Role,
  reason: string,
): Promise<void> {
  const overwrite = channel.permissionOverwrites.cache.get(target.id);
  if (overwrite && overwrite.allow.bitfield === 0n && overwrite.deny.bitfield === 0n) {
    await channel.permissionOverwrites.delete(target, reason);
  }
}

async function activateLockdown(
  guild: Guild,
  settings: SecuritySettings,
  store: Store,
  actorId: string,
  reason: string,
  minutes: number,
): Promise<{ changed: number; failed: number }> {
  const existing = store.getSecurityLockdown(guild.id);
  if (existing?.active) throw new Error('Security lockdown is already active.');

  const botMember = guild.members.me ?? await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels) || !botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
    throw new Error('HIT needs Manage Channels and Manage Roles for lockdown.');
  }

  await guild.channels.fetch();
  const guildSettings = store.getGuildSettings(guild.id);
  const verificationChannelId = guildSettings?.verificationChannelId;
  const verifiedRole = guildSettings
    ? await guild.roles.fetch(guildSettings.verifiedRoleId).catch(() => null)
    : null;
  const snapshots: LockdownSnapshot[] = [];
  let changed = 0;
  let failed = 0;

  for (const channel of guild.channels.cache.values()) {
    if (channel.isThread()) continue;
    if (channel.id === settings.logChannelId) continue;
    if (channel.id === verificationChannelId) continue;

    const guildChannel = channel as GuildChannel;
    if (isLockdownExemptChannel(guildChannel)) continue;
    const keys = permissionKeysForChannel(guildChannel);
    if (!keys.length) continue;
    const overwriteExisted = guildChannel.permissionOverwrites.cache.has(guild.id);
    const verifiedOverwriteExisted = verifiedRole
      ? guildChannel.permissionOverwrites.cache.has(verifiedRole.id)
      : false;
    const permissions = {
      ...snapshotOverwriteForTarget(guildChannel, guild.id, keys),
      ...(verifiedRole
        ? snapshotOverwriteForTarget(guildChannel, verifiedRole.id, keys, VERIFIED_SNAPSHOT_PREFIX)
        : {}),
      ...(verifiedRole ? { [VERIFIED_OVERWRITE_EXISTED_KEY]: verifiedOverwriteExisted } : {}),
    };

    try {
      await guildChannel.permissionOverwrites.edit(
        guild.roles.everyone,
        lockdownPermissions(keys),
        { reason: `HIT security lockdown: ${reason}` },
      );
      if (verifiedRole) {
        await guildChannel.permissionOverwrites.edit(
          verifiedRole,
          lockdownPermissions(keys),
          { reason: `HIT security lockdown: ${reason}` },
        );
      }
      snapshots.push({ guildId: guild.id, channelId: guildChannel.id, overwriteExisted, permissions });
      changed += 1;
    } catch {
      await guildChannel.permissionOverwrites.edit(
        guild.roles.everyone,
        permissionOptionsFromSnapshot(permissions, keys),
        { reason: 'HIT rolled back an incomplete lockdown change.' },
      ).catch(() => undefined);
      if (verifiedRole) {
        await guildChannel.permissionOverwrites.edit(
          verifiedRole,
          permissionOptionsFromSnapshot(permissions, keys, VERIFIED_SNAPSHOT_PREFIX),
          { reason: 'HIT rolled back an incomplete lockdown change.' },
        ).catch(() => undefined);
        if (!verifiedOverwriteExisted) {
          await removeEmptyOverwrite(guildChannel, verifiedRole, 'HIT removed an incomplete temporary lockdown overwrite.')
            .catch(() => undefined);
        }
      }
      failed += 1;
    }
  }

  if (!snapshots.length) throw new Error('HIT could not lock any channels. Check its role and channel permissions.');
  store.replaceLockdownSnapshots(guild.id, snapshots);
  const now = Date.now();
  store.setSecurityLockdown({
    guildId: guild.id,
    active: true,
    actorId,
    reason,
    startedAt: now,
    expiresAt: minutes > 0 ? now + minutes * 60_000 : null,
  });
  await sendSecurityLog(guild, settings, {
    eventType: 'lockdown_enabled',
    severity: 'critical',
    actorId,
    title: 'EMERGENCY LOCKDOWN ENABLED',
    description: `HIT restricted ${changed} channel(s).${minutes > 0 ? ` Automatic restoration is scheduled in ${minutes} minute(s).` : ''}`,
    detail: { reason, changed, failed },
  }, store);
  return { changed, failed };
}

async function deactivateLockdown(
  guild: Guild,
  settings: SecuritySettings,
  store: Store,
  actorId: string,
  reason: string,
): Promise<{ restored: number; failed: number }> {
  const state = store.getSecurityLockdown(guild.id);
  if (!state?.active) throw new Error('Security lockdown is not active.');
  const snapshots = store.getLockdownSnapshots(guild.id);
  const guildSettings = store.getGuildSettings(guild.id);
  const verifiedRole = guildSettings
    ? await guild.roles.fetch(guildSettings.verifiedRoleId).catch(() => null)
    : null;
  const remaining: LockdownSnapshot[] = [];
  let restored = 0;
  let failed = 0;

  for (const snapshot of snapshots) {
    const channel = await guild.channels.fetch(snapshot.channelId).catch(() => null);
    if (!channel || channel.isThread()) continue;
    const guildChannel = channel as GuildChannel;
    const keys = permissionKeysForChannel(guildChannel);
    try {
      await guildChannel.permissionOverwrites.edit(
        guild.roles.everyone,
        permissionOptionsFromSnapshot(snapshot.permissions, keys),
        { reason: `HIT security lockdown ended: ${reason}` },
      );
      if (!snapshot.overwriteExisted) {
        await removeEmptyOverwrite(guildChannel, guild.roles.everyone, `HIT removed temporary lockdown overwrite: ${reason}`);
      }

      const hasVerifiedSnapshot = Object.prototype.hasOwnProperty.call(
        snapshot.permissions,
        VERIFIED_OVERWRITE_EXISTED_KEY,
      );
      if (verifiedRole && hasVerifiedSnapshot) {
        await guildChannel.permissionOverwrites.edit(
          verifiedRole,
          permissionOptionsFromSnapshot(snapshot.permissions, keys, VERIFIED_SNAPSHOT_PREFIX),
          { reason: `HIT security lockdown ended: ${reason}` },
        );
        if (snapshot.permissions[VERIFIED_OVERWRITE_EXISTED_KEY] !== true) {
          await removeEmptyOverwrite(guildChannel, verifiedRole, `HIT removed temporary verified-role lockdown overwrite: ${reason}`);
        }
      }
      restored += 1;
    } catch {
      failed += 1;
      remaining.push(snapshot);
    }
  }

  if (remaining.length) {
    store.replaceLockdownSnapshots(guild.id, remaining);
  } else {
    store.clearLockdownSnapshots(guild.id);
    store.setSecurityLockdown({
      guildId: guild.id,
      active: false,
      actorId,
      reason,
      startedAt: state.startedAt,
      expiresAt: null,
    });
  }

  await sendSecurityLog(guild, settings, {
    eventType: 'lockdown_disabled',
    severity: remaining.length ? 'warning' : 'info',
    actorId,
    title: remaining.length ? 'LOCKDOWN PARTIALLY RESTORED' : 'LOCKDOWN ENDED',
    description: remaining.length
      ? `HIT restored ${restored} channel(s), but ${failed} require another restoration attempt.`
      : `HIT restored ${restored} channel(s) to their saved permission state.`,
    detail: { reason, restored, failed },
  }, store);
  return { restored, failed };
}

export async function onSecurityMemberJoin(member: GuildMember, store: Store): Promise<void> {
  const settings = store.getSecuritySettings(member.guild.id);
  if (!settings?.antiRaidEnabled) return;
  const now = Date.now();
  const timestamps = joinWindows.get(member.guild.id) ?? [];
  timestamps.push(now);
  const active = timestamps.filter((timestamp) => timestamp >= now - settings.raidWindowSeconds * 1000);
  joinWindows.set(member.guild.id, active);
  if (active.length < settings.raidJoinLimit) return;

  const cooldown = raidAlertCooldowns.get(member.guild.id) ?? 0;
  if (cooldown > now) return;
  raidAlertCooldowns.set(member.guild.id, now + 60_000);

  await sendSecurityLog(member.guild, settings, {
    eventType: 'raid_detected',
    severity: 'critical',
    actorId: member.id,
    title: 'POSSIBLE RAID DETECTED',
    description: `${active.length} accounts joined within ${settings.raidWindowSeconds} seconds. New members remain behind HIT verification.`,
    detail: { joins: active.length, windowSeconds: settings.raidWindowSeconds, latestAccount: member.user.tag },
  }, store);

  if (settings.autoLockdownEnabled && !store.getSecurityLockdown(member.guild.id)?.active) {
    await activateLockdown(
      member.guild,
      settings,
      store,
      member.guild.members.me?.id ?? 'HIT',
      `Automatic raid response: ${active.length} joins in ${settings.raidWindowSeconds}s`,
      settings.lockdownMinutes,
    ).catch((error) => logger.error('Automatic raid lockdown failed', { guildId: member.guild.id, error: String(error) }));
  }
}

function auditActionName(action: AuditLogEvent): string {
  return AuditLogEvent[action] ?? String(action);
}

async function containExecutor(
  guild: Guild,
  settings: SecuritySettings,
  executorId: string,
  targetId: string | null,
): Promise<{ removedRoles: string[]; quarantined: boolean; botRemoved: boolean }> {
  const executor = await guild.members.fetch(executorId).catch(() => null);
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  const removedRoles: Role[] = [];
  let quarantined = false;
  let botRemoved = false;

  if (executor && executor.id !== guild.ownerId) {
    const roles = executor.roles.cache.filter((role) =>
      role.id !== guild.id
      && !role.managed
      && botMember.roles.highest.comparePositionTo(role) > 0
      && role.permissions.any(DANGEROUS_PERMISSIONS),
    );
    if (roles.size) {
      await executor.roles.remove([...roles.values()], 'HIT anti-nuke containment').catch(() => undefined);
      removedRoles.push(...roles.values());
    }

    if (settings.quarantineRoleId) {
      const quarantine = await guild.roles.fetch(settings.quarantineRoleId).catch(() => null);
      if (quarantine && !quarantine.managed && botMember.roles.highest.comparePositionTo(quarantine) > 0) {
        await executor.roles.add(quarantine, 'HIT anti-nuke containment').catch(() => undefined);
        quarantined = executor.roles.cache.has(quarantine.id);
      }
    }
  }

  if (targetId) {
    const target = await guild.members.fetch(targetId).catch(() => null);
    if (target?.user.bot && target.id !== botMember.id && target.kickable) {
      await target.kick('HIT anti-nuke: untrusted bot addition triggered containment').catch(() => undefined);
      botRemoved = !guild.members.cache.has(target.id);
    }
  }

  return { removedRoles: removedRoles.map((role) => role.name), quarantined, botRemoved };
}

export async function handleSecurityAuditLogEntry(
  entry: GuildAuditLogsEntry,
  guild: Guild,
  store: Store,
): Promise<void> {
  const settings = store.getSecuritySettings(guild.id);
  if (!settings?.antiNukeEnabled) return;
  const weight = DANGEROUS_ACTION_WEIGHTS.get(entry.action);
  const executorId = entry.executorId;
  if (!weight || !executorId || isSecurityTrusted(guild, executorId, store)) return;

  const now = Date.now();
  const key = `${guild.id}:${executorId}`;
  const state = auditActionStates.get(key) ?? { actions: [] };
  state.actions.push({ timestamp: now, points: weight });
  state.actions = state.actions.filter((action) => action.timestamp >= now - settings.nukeWindowSeconds * 1000);
  auditActionStates.set(key, state);
  const points = state.actions.reduce((total, action) => total + action.points, 0);

  await sendSecurityLog(guild, settings, {
    eventType: 'dangerous_audit_action',
    severity: points >= settings.nukeActionLimit ? 'critical' : 'warning',
    actorId: executorId,
    targetId: entry.targetId,
    title: 'DANGEROUS SERVER ACTION DETECTED',
    description: `<@${executorId}> performed **${auditActionName(entry.action)}**. HIT recorded ${points}/${settings.nukeActionLimit} anti-nuke points.`,
    detail: { action: auditActionName(entry.action), points, reason: entry.reason ?? 'No audit reason' },
  }, store);

  if (points < settings.nukeActionLimit) return;
  const cooldown = containmentCooldowns.get(key) ?? 0;
  if (cooldown > now) return;
  containmentCooldowns.set(key, now + settings.nukeWindowSeconds * 1000);
  state.actions = [];

  const containment = await containExecutor(guild, settings, executorId, entry.targetId);
  await sendSecurityLog(guild, settings, {
    eventType: 'anti_nuke_containment',
    severity: 'critical',
    actorId: executorId,
    targetId: entry.targetId,
    title: 'ANTI-NUKE CONTAINMENT TRIGGERED',
    description: `HIT contained <@${executorId}> after destructive activity crossed the configured threshold.`,
    detail: {
      removedRoles: containment.removedRoles.join(', ') || 'None manageable',
      quarantined: containment.quarantined,
      untrustedBotRemoved: containment.botRemoved,
      points,
    },
  }, store);

  if (settings.autoLockdownEnabled && !store.getSecurityLockdown(guild.id)?.active) {
    await activateLockdown(
      guild,
      settings,
      store,
      guild.members.me?.id ?? 'HIT',
      `Automatic anti-nuke response to ${executorId}`,
      settings.lockdownMinutes,
    ).catch((error) => logger.error('Automatic anti-nuke lockdown failed', { guildId: guild.id, error: String(error) }));
  }
}

export async function handleHitSecurityAdminCommand(
  interaction: ChatInputCommandInteraction,
  store: Store,
): Promise<boolean> {
  if (!interaction.guild || !interaction.member) return false;
  const subcommand = interaction.options.getSubcommand();
  if (!subcommand.startsWith('security-')) return false;
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server is required.');

  if (subcommand === 'security-setup') {
    const existing = store.getSecuritySettings(interaction.guild.id);
    const settings = store.upsertSecuritySettings({
      guildId: interaction.guild.id,
      logChannelId: interaction.options.getChannel('log_channel', true).id,
      quarantineRoleId: interaction.options.getRole('quarantine_role')?.id ?? existing?.quarantineRoleId ?? null,
      antiSpamEnabled: interaction.options.getBoolean('anti_spam') ?? existing?.antiSpamEnabled ?? true,
      antiPhishingEnabled: interaction.options.getBoolean('anti_phishing') ?? existing?.antiPhishingEnabled ?? true,
      antiRaidEnabled: interaction.options.getBoolean('anti_raid') ?? existing?.antiRaidEnabled ?? true,
      antiNukeEnabled: interaction.options.getBoolean('anti_nuke') ?? existing?.antiNukeEnabled ?? true,
      autoLockdownEnabled: interaction.options.getBoolean('auto_lockdown') ?? existing?.autoLockdownEnabled ?? false,
      spamMessageLimit: existing?.spamMessageLimit ?? 6,
      spamWindowSeconds: existing?.spamWindowSeconds ?? 6,
      duplicateMessageLimit: existing?.duplicateMessageLimit ?? 3,
      mentionLimit: existing?.mentionLimit ?? 5,
      autoTimeoutMinutes: existing?.autoTimeoutMinutes ?? 10,
      raidJoinLimit: existing?.raidJoinLimit ?? 8,
      raidWindowSeconds: existing?.raidWindowSeconds ?? 10,
      nukeActionLimit: existing?.nukeActionLimit ?? 3,
      nukeWindowSeconds: existing?.nukeWindowSeconds ?? 30,
      lockdownMinutes: existing?.lockdownMinutes ?? 10,
    });
    await interaction.reply({
      content: `✓ HIT security configured in <#${settings.logChannelId}>. Trust staff with \`/security trust\` before bulk server changes.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const settings = requireSecuritySettings(store, interaction.guild.id);
  if (subcommand === 'security-config') {
    await interaction.reply({ embeds: [securityConfigEmbed(settings, store.listSecurityTrustedUsers(interaction.guild.id))], flags: MessageFlags.Ephemeral });
    return true;
  }

  const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
  const logChannel = await interaction.guild.channels.fetch(settings.logChannelId).catch(() => null);
  const quarantine = settings.quarantineRoleId ? await interaction.guild.roles.fetch(settings.quarantineRoleId).catch(() => null) : null;
  const logPermissions = logChannel?.isTextBased() ? logChannel.permissionsFor(botMember) : null;
  const diagnostics = [
    ['Manage Messages', botMember.permissions.has(PermissionFlagsBits.ManageMessages), 'Required for spam and phishing deletion.'],
    ['Timeout Members', botMember.permissions.has(PermissionFlagsBits.ModerateMembers), 'Required for automatic timeouts.'],
    ['Manage Channels', botMember.permissions.has(PermissionFlagsBits.ManageChannels), 'Required for emergency lockdown.'],
    ['Manage Roles', botMember.permissions.has(PermissionFlagsBits.ManageRoles), 'Required for lockdown and anti-nuke containment.'],
    ['View Audit Log', botMember.permissions.has(PermissionFlagsBits.ViewAuditLog), 'Required for anti-nuke detection.'],
    ['Kick Members', botMember.permissions.has(PermissionFlagsBits.KickMembers), 'Required to remove untrusted bots.'],
    ['Security log channel', Boolean(logChannel?.isTextBased()), 'Configured log channel must exist.'],
    ['Security log permissions', Boolean(logPermissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])), 'View, Send, and Embed Links are required.'],
    ['Quarantine hierarchy', !quarantine || (!quarantine.managed && botMember.roles.highest.comparePositionTo(quarantine) > 0), quarantine ? `HIT must be above ${quarantine.name}.` : 'No quarantine role configured.'],
  ] as const;
  const embed = new EmbedBuilder()
    .setColor(diagnostics.every((item) => item[1]) ? SUCCESS : DANGER)
    .setTitle('HIT SECURITY DIAGNOSTICS')
    .setDescription(diagnostics.map(([label, ok, detail]) => `${ok ? '✅' : '❌'} **${label}** — ${detail}`).join('\n'));
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  return true;
}

export async function handleSecuritySlashCommand(
  interaction: ChatInputCommandInteraction,
  store: Store,
): Promise<void> {
  if (!interaction.guild) throw new Error('This command only works in a server.');
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server is required.');
  const settings = requireSecuritySettings(store, interaction.guild.id);
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'status') {
    await interaction.reply({ embeds: [securityStatusEmbed(store, settings)], flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'trust') {
    const user = interaction.options.getUser('user', true);
    store.addSecurityTrustedUser(interaction.guild.id, user.id, interaction.user.id);
    await interaction.reply({ content: `✓ ${user} is trusted by HIT anti-nuke.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'untrust') {
    const user = interaction.options.getUser('user', true);
    if (user.id === interaction.guild.ownerId || user.id === interaction.client.user.id) throw new Error('The server owner and HIT are permanently trusted.');
    const removed = store.removeSecurityTrustedUser(interaction.guild.id, user.id);
    await interaction.reply({ content: removed ? `✓ Removed ${user} from the trust list.` : `${user} was not on the trust list.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (subcommand === 'lockdown') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reason = interaction.options.getString('reason', true);
    const minutes = interaction.options.getInteger('minutes') ?? settings.lockdownMinutes;
    const result = await activateLockdown(interaction.guild, settings, store, interaction.user.id, reason, minutes);
    await interaction.editReply(`✓ Lockdown enabled across ${result.changed} channel(s). Failed: ${result.failed}.`);
    return;
  }
  if (subcommand === 'unlock') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const reason = interaction.options.getString('reason', true);
    const result = await deactivateLockdown(interaction.guild, settings, store, interaction.user.id, reason);
    await interaction.editReply(`✓ Restored ${result.restored} channel(s). Failed: ${result.failed}.`);
  }
}

export async function handleSecurityPrefixCommand(message: Message, store: Store, defaultPrefix: string): Promise<void> {
  if (!message.guild || !message.member || message.author.bot) return;
  const prefix = store.getGuildSettings(message.guild.id)?.prefix ?? defaultPrefix;
  if (!message.content.startsWith(prefix)) return;
  const body = message.content.slice(prefix.length).trim();
  const [rawCommand, ...args] = body.split(/\s+/u);
  const command = rawCommand?.toLowerCase();
  if (!command || !SECURITY_PREFIX_COMMANDS.has(command)) return;
  if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) throw new Error('Manage Server is required.');
  const settings = requireSecuritySettings(store, message.guild.id);

  if (command === 'security') {
    await message.reply({ embeds: [securityStatusEmbed(store, settings)] });
    return;
  }
  const reason = args.join(' ').trim();
  if (!reason) throw new Error(`Usage: ${prefix}${command} reason`);
  if (command === 'lockdown') {
    const result = await activateLockdown(message.guild, settings, store, message.author.id, reason, settings.lockdownMinutes);
    await message.reply(`✓ Lockdown enabled across ${result.changed} channel(s). Failed: ${result.failed}.`);
    return;
  }
  const result = await deactivateLockdown(message.guild, settings, store, message.author.id, reason);
  await message.reply(`✓ Restored ${result.restored} channel(s). Failed: ${result.failed}.`);
}

export function startSecurityWorker(client: Client, store: Store): NodeJS.Timeout {
  return setInterval(() => {
    for (const lockdown of store.listExpiredSecurityLockdowns()) {
      const guild = client.guilds.cache.get(lockdown.guildId);
      const settings = store.getSecuritySettings(lockdown.guildId);
      if (!guild || !settings) continue;
      void deactivateLockdown(guild, settings, store, client.user?.id ?? 'HIT', 'Automatic lockdown expiration')
        .catch((error) => logger.error('Automatic lockdown restoration failed', { guildId: lockdown.guildId, error: String(error) }));
    }
  }, 30_000);
}

import { readFileSync } from 'node:fs';
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
  Role,
} from 'discord.js';
import {
  LevelProfile,
  LevelSettings,
  LevelXpChange,
  Store,
} from '../../core/store.js';
import { logger } from '../../core/logger.js';
import {
  isMeaningfulMessage,
  levelFromXp,
  levelUpBonus,
  MAX_LEVEL,
  levelProgress,
  progressBar,
  randomXp,
  xpForLevel,
} from './utils.js';

const COLOR = 0x7c3aed;
const SUCCESS = 0x22c55e;
const FAILURE = 0xef4444;
const VOICE_TICK_MS = 30_000;
const HELP_DELETE_MS = 15_000;
const BOOSTER_XP_MULTIPLIER = 1.5;
const MAX_ANNOUNCED_REWARD_ROLES = 8;
const LEVEL_ROLE_PATTERN = /^Level\s+(\d{1,4})$/i;
const voiceAwardClocks = new Map<string, number>();

function requireSettings(store: Store, guildId: string): LevelSettings {
  const settings = store.getLevelSettings(guildId);
  if (!settings) throw new Error('HIT levels are not configured. Run /hit levels-setup.');
  return settings;
}

function settingsInput(settings: LevelSettings): Omit<LevelSettings, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...input } = settings;
  return input;
}

function channelMention(id: string | null): string {
  return id ? `<#${id}>` : 'Current message channel';
}

function memberExcluded(member: GuildMember, store: Store): boolean {
  return store.isLevelRoleExcluded(member.guild.id, member.roles.cache.keys());
}

function channelExcluded(guildId: string, channelId: string, parentId: string | null, store: Store): boolean {
  return store.isLevelChannelExcluded(guildId, channelId)
    || Boolean(parentId && store.isLevelChannelExcluded(guildId, parentId));
}

async function fetchTextChannel(guild: Guild, channelId: string | null) {
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return null;
  if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) return null;
  return channel;
}

async function sendLevelLog(
  guild: Guild,
  settings: LevelSettings,
  title: string,
  description: string,
): Promise<void> {
  const channel = await fetchTextChannel(guild, settings.logChannelId);
  if (!channel) return;
  await channel.send({
    embeds: [new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(description).setTimestamp()],
  }).catch(() => undefined);
}


type ActivityRank = {
  name: string;
  unlockLevel: number;
  roleId: string;
};

function loadActivityRanks(): ActivityRank[] {
  const filePath =
    process.env.ACTIVITY_RANKS_PATH?.trim() ||
    '/app/data/activity-ranks.json';

  try {
    const parsed = JSON.parse(
      readFileSync(filePath, 'utf8')
    ) as unknown;

    const record =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};

    const rows = Array.isArray(parsed)
      ? parsed
      : [
          record.activityRanks,
          record.activity_roles,
          record.activityRoles,
          record.ranks,
          record.roles,
        ].find(Array.isArray) ?? [];

    return rows
      .map((row): ActivityRank | null => {
        if (!row || typeof row !== 'object') return null;

        const value = row as Record<string, unknown>;
        const unlockLevel = Number(value.unlockLevel);
        const roleId =
          typeof value.roleId === 'string'
            ? value.roleId.trim()
            : '';

        if (
          !Number.isInteger(unlockLevel) ||
          unlockLevel < 1 ||
          !/^\d{17,20}$/.test(roleId)
        ) {
          return null;
        }

        return {
          name:
            typeof value.name === 'string'
              ? value.name
              : roleId,
          unlockLevel,
          roleId,
        };
      })
      .filter((rank): rank is ActivityRank => rank !== null)
      .sort((a, b) => a.unlockLevel - b.unlockLevel);
  } catch {
    return [];
  }
}

function memberXpMultiplier(member: GuildMember): number {
  return member.premiumSince ? BOOSTER_XP_MULTIPLIER : 1;
}

function multipliedXp(member: GuildMember, amount: number): number {
  return Math.max(0, Math.trunc(amount * memberXpMultiplier(member)));
}

async function syncRewardRoles(
  member: GuildMember,
  settings: LevelSettings,
  level: number,
  store: Store,
): Promise<string[]> {
  const rewards = store.listLevelRewards(member.guild.id);
  const activityRanks = loadActivityRanks();

  if (rewards.length === 0 && activityRanks.length === 0) return [];

  const eligible = rewards.filter((reward) => reward.level <= level);
  const desiredIds = new Set<string>();
  if (settings.stackRewardRoles) {
    for (const reward of eligible) desiredIds.add(reward.roleId);
  } else {
    const highest = eligible.at(-1);
    if (highest) desiredIds.add(highest.roleId);
  }

  for (const rank of activityRanks) {
    if (rank.unlockLevel <= level) desiredIds.add(rank.roleId);
  }

  const rewardIds = new Set([
    ...rewards.map((reward) => reward.roleId),
    ...activityRanks.map((rank) => rank.roleId),
  ]);

  await member.guild.roles.fetch().catch(() => undefined);
  const addRoles = [...desiredIds]
    .filter((roleId) => !member.roles.cache.has(roleId))
    .map((roleId) => member.guild.roles.cache.get(roleId))
    .filter((role): role is Role => Boolean(role?.editable));
  const removeRoles = [...rewardIds]
    .filter((roleId) => !desiredIds.has(roleId) && member.roles.cache.has(roleId))
    .map((roleId) => member.guild.roles.cache.get(roleId))
    .filter((role): role is Role => Boolean(role?.editable));

  if (addRoles.length > 0) {
    await member.roles.add(addRoles, `HIT bulk level reward synchronization at level ${level}`);
  }
  if (removeRoles.length > 0) {
    await member.roles.remove(removeRoles, `HIT bulk level reward synchronization at level ${level}`);
  }

  return addRoles.map((role) => role.id);
}

async function resolveAnnouncementChannel(member: GuildMember, settings: LevelSettings, sourceChannelId: string | null) {
  const preferredId = process.env.MAIN_GENERAL_CHANNEL_ID?.trim() || '1528858711773151283';
  const preferred = await fetchTextChannel(member.guild, preferredId);
  if (preferred) return preferred;
  const mainGeneral = member.guild.channels.cache.find((channel) => (
    channel.type === ChannelType.GuildText
    && channel.name.toLowerCase() === 'general'
    && channel.parent?.name.toLowerCase() === 'general'
  ));
  if (mainGeneral?.type === ChannelType.GuildText) return mainGeneral;
  const configured = await fetchTextChannel(member.guild, settings.announceChannelId);
  if (configured) return configured;
  return fetchTextChannel(member.guild, sourceChannelId);
}

async function announceLevelUp(
  member: GuildMember,
  settings: LevelSettings,
  oldLevel: number,
  newLevel: number,
  sourceChannelId: string | null,
  addedRoleIds: string[],
  bonusXp: number,
): Promise<void> {
  if (!settings.announceLevelUps || newLevel <= oldLevel) return;
  const channel = await resolveAnnouncementChannel(member, settings, sourceChannelId);
  if (!channel) return;
  const visibleRoles = addedRoleIds.slice(0, MAX_ANNOUNCED_REWARD_ROLES);
  const hiddenCount = Math.max(0, addedRoleIds.length - visibleRoles.length);
  const rewardLine = visibleRoles.length > 0
    ? `
Reward role${addedRoleIds.length === 1 ? '' : 's'}: ${visibleRoles.map((id) => `<@&${id}>`).join(', ')}${hiddenCount > 0 ? ` and ${hiddenCount} more` : ''}`
    : '';
  const bonusLine = bonusXp > 0 ? `
Level-up bonus: **+${bonusXp.toLocaleString()} XP**` : '';
  await channel.send({
    content: `<@${member.id}> reached level **${newLevel}**.${bonusLine}${rewardLine}`,
    allowedMentions: { users: [member.id], roles: [] },
  }).catch(() => undefined);
}

interface ProcessLevelResult {
  change: LevelXpChange;
  oldLevel: number;
  newLevel: number;
  bonusXp: number;
  addedRoleIds: string[];
}

function applyNaturalLevelBonuses(
  change: LevelXpChange,
  store: Store,
  source: 'message' | 'voice' | 'admin',
): { change: LevelXpChange; bonusXp: number } {
  if (source === 'admin') return { change, bonusXp: 0 };

  const originalBefore = change.before;
  let after = change.after;
  let rewardedThrough = levelFromXp(originalBefore.xp);
  let totalBonus = 0;

  for (let pass = 0; pass < 25; pass += 1) {
    const reached = levelFromXp(after.xp);
    if (reached <= rewardedThrough) break;
    const bonus = levelUpBonus(rewardedThrough, reached);
    if (bonus <= 0) break;
    const bonusChange = store.adjustLevelXp(after.guildId, after.userId, bonus);
    after = bonusChange.after;
    totalBonus += bonus;
    rewardedThrough = reached;
  }

  return {
    change: {
      before: originalBefore,
      after,
      amount: after.xp - originalBefore.xp,
    },
    bonusXp: totalBonus,
  };
}

async function processLevelChange(
  member: GuildMember,
  settings: LevelSettings,
  initialChange: LevelXpChange,
  store: Store,
  source: 'message' | 'voice' | 'admin',
  sourceChannelId: string | null,
): Promise<ProcessLevelResult> {
  const bonusResult = applyNaturalLevelBonuses(initialChange, store, source);
  const change = bonusResult.change;
  const oldLevel = levelFromXp(change.before.xp);
  const newLevel = levelFromXp(change.after.xp);
  const shouldSync = source === 'admin' || newLevel !== oldLevel;
  const addedRoleIds = shouldSync
    ? await syncRewardRoles(member, settings, newLevel, store)
    : [];

  if (newLevel !== oldLevel) {
    await sendLevelLog(member.guild, settings, 'LEVEL CHANGED', [
      `Member: <@${member.id}>`,
      `Previous level: ${oldLevel}`,
      `New level: ${newLevel}`,
      `XP: ${change.after.xp}`,
      `Bonus XP: ${bonusResult.bonusXp}`,
      `Source: ${source}`,
    ].join('\n'));
    await announceLevelUp(
      member,
      settings,
      oldLevel,
      newLevel,
      sourceChannelId,
      addedRoleIds,
      bonusResult.bonusXp,
    );
  }

  return {
    change,
    oldLevel,
    newLevel,
    bonusXp: bonusResult.bonusXp,
    addedRoleIds,
  };
}

export async function handleLevelsMessage(message: Message, store: Store, defaultPrefix: string): Promise<void> {
  if (!message.guild || !message.member || message.author.bot || message.webhookId) return;
  const settings = store.getLevelSettings(message.guild.id);
  if (!settings?.enabled) return;
  const prefix = store.getGuildSettings(message.guild.id)?.prefix ?? defaultPrefix;
  if (message.content.trimStart().startsWith(prefix)) return;
  if (!isMeaningfulMessage(message.content)) return;
  if (memberExcluded(message.member, store)) return;
  const parentId = 'parentId' in message.channel ? message.channel.parentId : null;
  if (channelExcluded(message.guild.id, message.channelId, parentId, store)) return;

  const amount = multipliedXp(message.member, randomXp(settings.messageXpMin, settings.messageXpMax));
  const change = store.tryAwardMessageXp(
    message.guild.id,
    message.author.id,
    amount,
    settings.messageCooldownSeconds * 1000,
  );
  if (!change) return;
  await processLevelChange(message.member, settings, change, store, 'message', message.channelId);
}

function eligibleVoiceMember(member: GuildMember, settings: LevelSettings, store: Store): boolean {
  const channel = member.voice.channel;
  if (!channel || member.user.bot) return false;
  if (member.voice.selfDeaf || member.voice.serverDeaf) return false;
  if (member.guild.afkChannelId === channel.id) return false;
  if (memberExcluded(member, store)) return false;
  if (channelExcluded(member.guild.id, channel.id, channel.parentId, store)) return false;
  const activeHumans = channel.members.filter((candidate: GuildMember) => (
    !candidate.user.bot
    && !candidate.voice.selfDeaf
    && !candidate.voice.serverDeaf
  )).size;
  return activeHumans >= settings.voiceMinMembers;
}

async function awardVoiceActivity(client: Client, store: Store): Promise<void> {
  const now = Date.now();
  const activeKeys = new Set<string>();

  for (const guild of client.guilds.cache.values()) {
    const settings = store.getLevelSettings(guild.id);
    if (!settings?.enabled || settings.voiceXpPerMinute <= 0) continue;

    for (const state of guild.voiceStates.cache.values()) {
      const member = state.member;
      if (!member || !eligibleVoiceMember(member, settings, store)) continue;
      const key = `${guild.id}:${member.id}`;
      activeKeys.add(key);
      const lastAward = voiceAwardClocks.get(key);
      if (lastAward === undefined) {
        voiceAwardClocks.set(key, now);
        continue;
      }
      const minutes = Math.floor((now - lastAward) / 60_000);
      if (minutes < 1) continue;
      voiceAwardClocks.set(key, lastAward + minutes * 60_000);
      const change = store.awardVoiceXp(
        guild.id,
        member.id,
        multipliedXp(member, settings.voiceXpPerMinute * minutes),
        minutes,
        now,
      );
      await processLevelChange(member, settings, change, store, 'voice', null);
    }
  }

  for (const key of voiceAwardClocks.keys()) {
    if (!activeKeys.has(key)) voiceAwardClocks.delete(key);
  }
}

export function startLevelsWorker(client: Client, store: Store): NodeJS.Timeout {
  const run = async (): Promise<void> => {
    try {
      await awardVoiceActivity(client, store);
    } catch (error) {
      logger.warn('Levels voice worker failed', { error: String(error) });
    }
  };
  void run();
  return setInterval(() => void run(), VOICE_TICK_MS);
}

function rankEmbed(member: GuildMember, profile: LevelProfile | null, rank: number | null): EmbedBuilder {
  const safeProfile: LevelProfile = profile ?? {
    guildId: member.guild.id,
    userId: member.id,
    xp: 0,
    messageCount: 0,
    voiceMinutes: 0,
    lastMessageXpAt: null,
    updatedAt: Date.now(),
  };
  const progress = levelProgress(safeProfile.xp);
  const progressText = progress.requiredXp === 0
    ? 'Maximum level reached'
    : `${progress.progressXp.toLocaleString()} / ${progress.requiredXp.toLocaleString()} XP`;
  return new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: member.displayName, iconURL: member.displayAvatarURL() })
    .setTitle('HIT LEVEL PROFILE')
    .setDescription(`${progressBar(progress.ratio)}\n${progressText}`)
    .addFields(
      { name: 'Level', value: String(progress.level), inline: true },
      { name: 'Rank', value: rank ? `#${rank}` : 'Unranked', inline: true },
      { name: 'Total XP', value: safeProfile.xp.toLocaleString(), inline: true },
      { name: 'XP for next level', value: progress.level >= MAX_LEVEL ? 'Maximum level' : xpForLevel(progress.level + 1).toLocaleString(), inline: true },
      { name: 'XP messages', value: safeProfile.messageCount.toLocaleString(), inline: true },
      { name: 'Voice minutes', value: safeProfile.voiceMinutes.toLocaleString(), inline: true },
    );
}

async function leaderboardEmbed(guild: Guild, store: Store, page: number): Promise<EmbedBuilder> {
  const pageSize = 10;
  const safePage = Math.max(1, Math.min(100, Math.trunc(page)));
  const offset = (safePage - 1) * pageSize;
  const profiles = store.listLevelLeaderboard(guild.id, pageSize, offset);
  const lines = profiles.length === 0
    ? ['No members have earned XP yet.']
    : profiles.map((profile, index) => {
      const position = offset + index + 1;
      return `**${position}.** <@${profile.userId}> - Level ${levelFromXp(profile.xp)} - ${profile.xp.toLocaleString()} XP`;
    });
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('HIT LEVEL LEADERBOARD')
    .setDescription(lines.join('\n'))
    .setFooter({ text: `Page ${safePage}` });
}

function rewardsEmbed(guild: Guild, store: Store, requestedPage = 1): EmbedBuilder {
  const rewards = store.listLevelRewards(guild.id);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(rewards.length / pageSize));
  const safeRequestedPage = Number.isFinite(requestedPage) ? Math.trunc(requestedPage) : 1;
  const page = Math.min(Math.max(safeRequestedPage, 1), totalPages);
  const offset = (page - 1) * pageSize;
  const visibleRewards = rewards.slice(offset, offset + pageSize);
  const description = rewards.length === 0
    ? 'No level reward roles are configured.'
    : visibleRewards.map((reward) => `Level **${reward.level}** - <@&${reward.roleId}>`).join('\n');

  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('HIT LEVEL REWARDS')
    .setDescription(description)
    .setFooter({ text: `Page ${page}/${totalPages} | ${rewards.length} configured reward role(s)` });
}

export async function handleLevelSlashCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<void> {
  if (interaction.commandName !== 'level' || !interaction.inCachedGuild()) return;
  requireSettings(store, interaction.guildId);
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'rank') {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) throw new Error('That member is not in this server.');
    const profile = store.getLevelProfile(interaction.guildId, member.id);
    const rank = store.getLevelRank(interaction.guildId, member.id);
    await interaction.reply({ embeds: [rankEmbed(member, profile, rank)] });
    return;
  }

  if (subcommand === 'leaderboard') {
    const page = interaction.options.getInteger('page') ?? 1;
    await interaction.reply({ embeds: [await leaderboardEmbed(interaction.guild, store, page)] });
    return;
  }

  if (subcommand === 'rewards') {
    const page = interaction.options.getInteger('page') ?? 1;
    await interaction.reply({ embeds: [rewardsEmbed(interaction.guild, store, page)] });
  }
}

function permissionLine(ok: boolean, label: string, detail: string): string {
  return `${ok ? 'PASS' : 'FAIL'} ${label} - ${detail}`;
}

async function diagnoseLevels(guild: Guild, settings: LevelSettings, store: Store): Promise<string[]> {
  const bot = guild.members.me ?? await guild.members.fetchMe();
  const logChannel = await fetchTextChannel(guild, settings.logChannelId);
  const announceChannel = settings.announceChannelId
    ? await fetchTextChannel(guild, settings.announceChannelId)
    : null;
  const lines = [
    permissionLine(settings.messageXpMin <= settings.messageXpMax, 'Message XP range', 'Minimum XP must not exceed maximum XP.'),
    permissionLine(Boolean(logChannel), 'Log channel', 'Configured log channel must be a text channel.'),
    permissionLine(Boolean(logChannel?.permissionsFor(bot)?.has(PermissionFlagsBits.SendMessages)), 'Log send access', 'HIT must send level activity logs.'),
    permissionLine(Boolean(logChannel?.permissionsFor(bot)?.has(PermissionFlagsBits.EmbedLinks)), 'Log embed access', 'HIT must send embedded logs.'),
    permissionLine(!settings.announceChannelId || Boolean(announceChannel), 'Announcement channel', 'Configured announcement channel must exist.'),
    permissionLine(!settings.announceChannelId || Boolean(announceChannel?.permissionsFor(bot)?.has(PermissionFlagsBits.SendMessages)), 'Announcement send access', 'HIT must send level-up announcements.'),
  ];

  const rewards = store.listLevelRewards(guild.id);
  if (rewards.length > 0) {
    lines.push(permissionLine(bot.permissions.has(PermissionFlagsBits.ManageRoles), 'Manage Roles', 'Required for level reward roles.'));
  }

  let missingRewards = 0;
  let unmanageableRewards = 0;
  for (const reward of rewards) {
    const role = await guild.roles.fetch(reward.roleId).catch(() => null);
    if (!role) missingRewards += 1;
    else if (!role.editable) unmanageableRewards += 1;
  }

  lines.push(permissionLine(missingRewards === 0, 'Reward roles exist', `${rewards.length - missingRewards}/${rewards.length} configured roles exist.`));
  lines.push(permissionLine(unmanageableRewards === 0, 'Reward role hierarchy', `${rewards.length - unmanageableRewards}/${rewards.length} configured roles are manageable.`));
  return lines;
}

function roleIsValidReward(role: Role): boolean {
  return !role.managed && role.id !== role.guild.roles.everyone.id && role.editable;
}

async function syncNamedLevelRewards(
  guild: Guild,
  store: Store,
): Promise<{ imported: number; skipped: number }> {
  const roles = await guild.roles.fetch();
  const byLevel = new Map<number, Role>();
  let skipped = 0;

  for (const role of roles.values()) {
    const match = LEVEL_ROLE_PATTERN.exec(role.name.trim());
    if (!match) continue;

    const level = Number(match[1]);
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL || !roleIsValidReward(role)) {
      skipped += 1;
      continue;
    }

    const existing = byLevel.get(level);
    if (!existing || role.position > existing.position) {
      byLevel.set(level, role);
    }
  }

  for (const [level, role] of byLevel) {
    store.upsertLevelReward(guild.id, level, role.id);
  }

  return { imported: byLevel.size, skipped };
}

function requireOptionalUser(interaction: ChatInputCommandInteraction): string {
  const user = interaction.options.getUser('user');
  if (!user) throw new Error('Choose a user for that action.');
  return user.id;
}

export async function handleHitLevelsAdminCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<boolean> {
  if (interaction.commandName !== 'hit' || !interaction.inCachedGuild()) return false;
  const subcommand = interaction.options.getSubcommand();
  if (!subcommand.startsWith('levels-')) return false;

  if (subcommand === 'levels-setup') {
    const existing = store.getLevelSettings(interaction.guildId);
    const logChannel = interaction.options.getChannel('log_channel', true);
    const announceChannel = interaction.options.getChannel('announce_channel');
    if (logChannel.type !== ChannelType.GuildText && logChannel.type !== ChannelType.GuildAnnouncement) {
      throw new Error('Log channel must be a standard text or announcement channel.');
    }
    if (announceChannel && announceChannel.type !== ChannelType.GuildText && announceChannel.type !== ChannelType.GuildAnnouncement) {
      throw new Error('Announcement channel must be a standard text or announcement channel.');
    }
    const messageXpMin = interaction.options.getInteger('message_xp_min') ?? existing?.messageXpMin ?? 50;
    const messageXpMax = interaction.options.getInteger('message_xp_max') ?? existing?.messageXpMax ?? 100;
    if (messageXpMin > messageXpMax) throw new Error('Message XP minimum cannot exceed the maximum.');
    const settings = store.upsertLevelSettings({
      guildId: interaction.guildId,
      enabled: existing?.enabled ?? true,
      announceChannelId: announceChannel?.id ?? existing?.announceChannelId ?? null,
      logChannelId: logChannel.id,
      messageXpMin,
      messageXpMax,
      messageCooldownSeconds: interaction.options.getInteger('message_cooldown_seconds') ?? existing?.messageCooldownSeconds ?? 15,
      voiceXpPerMinute: interaction.options.getInteger('voice_xp_per_minute') ?? existing?.voiceXpPerMinute ?? 50,
      voiceMinMembers: interaction.options.getInteger('voice_min_members') ?? existing?.voiceMinMembers ?? 2,
      announceLevelUps: interaction.options.getBoolean('announce_level_ups') ?? existing?.announceLevelUps ?? true,
      stackRewardRoles: interaction.options.getBoolean('stack_reward_roles') ?? existing?.stackRewardRoles ?? false,
    });
    const rewardSync = await syncNamedLevelRewards(interaction.guild, store);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(SUCCESS).setTitle('HIT LEVELS CONFIGURED').addFields(
        { name: 'Status', value: settings.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Message XP', value: `${settings.messageXpMin}-${settings.messageXpMax}`, inline: true },
        { name: 'Cooldown', value: `${settings.messageCooldownSeconds} seconds`, inline: true },
        { name: 'Voice XP', value: `${settings.voiceXpPerMinute} per minute`, inline: true },
        { name: 'Voice minimum', value: `${settings.voiceMinMembers} active members`, inline: true },
        { name: 'Announcements', value: settings.announceLevelUps ? channelMention(settings.announceChannelId) : 'Disabled', inline: true },
        { name: 'Logs', value: `<#${settings.logChannelId}>`, inline: true },
        { name: 'Reward behavior', value: settings.stackRewardRoles ? 'Stack all earned roles' : 'Keep highest earned role', inline: true },
        { name: 'Named rewards imported', value: String(rewardSync.imported), inline: true },
      )],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const settings = requireSettings(store, interaction.guildId);

  if (subcommand === 'levels-diagnose') {
    const lines = await diagnoseLevels(interaction.guild, settings, store);
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(lines.every((line) => line.startsWith('PASS')) ? SUCCESS : FAILURE)
        .setTitle('HIT LEVELS DIAGNOSTICS')
        .setDescription(lines.join('\n'))],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (subcommand === 'levels-config') {
    const excludedChannels = store.listLevelExcludedChannels(interaction.guildId);
    const excludedRoles = store.listLevelExcludedRoles(interaction.guildId);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR).setTitle('HIT LEVELS CONFIGURATION').addFields(
        { name: 'Status', value: settings.enabled ? 'Enabled' : 'Disabled', inline: true },
        { name: 'Message XP', value: `${settings.messageXpMin}-${settings.messageXpMax} every ${settings.messageCooldownSeconds}s`, inline: true },
        { name: 'Voice XP', value: `${settings.voiceXpPerMinute}/minute with ${settings.voiceMinMembers}+ active`, inline: true },
        { name: 'Announcement channel', value: settings.announceLevelUps ? channelMention(settings.announceChannelId) : 'Disabled', inline: true },
        { name: 'Log channel', value: `<#${settings.logChannelId}>`, inline: true },
        { name: 'Reward behavior', value: settings.stackRewardRoles ? 'Stack roles' : 'Highest role only', inline: true },
        { name: 'Reward roles', value: String(store.listLevelRewards(interaction.guildId).length), inline: true },
        { name: 'Excluded channels/categories', value: String(excludedChannels.length), inline: true },
        { name: 'Excluded roles', value: String(excludedRoles.length), inline: true },
      )],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (subcommand === 'levels-manage') {
    const action = interaction.options.getString('action', true);
    if (action === 'enable' || action === 'disable') {
      const updated = store.upsertLevelSettings({ ...settingsInput(settings), enabled: action === 'enable' });
      await interaction.reply({ content: `HIT levels are now ${updated.enabled ? 'enabled' : 'disabled'}.`, flags: MessageFlags.Ephemeral });
      return true;
    }
    if (action === 'exclude-channel' || action === 'include-channel') {
      const channel = interaction.options.getChannel('channel');
      if (!channel) throw new Error('Choose a channel or category for that action.');
      if (action === 'exclude-channel') store.addLevelExcludedChannel(interaction.guildId, channel.id);
      else store.removeLevelExcludedChannel(interaction.guildId, channel.id);
      await interaction.reply({ content: `<#${channel.id}> is now ${action === 'exclude-channel' ? 'excluded from' : 'included in'} XP earning.`, flags: MessageFlags.Ephemeral });
      return true;
    }
    if (action === 'exclude-role' || action === 'include-role') {
      const role = interaction.options.getRole('role');
      if (!role) throw new Error('Choose a role for that action.');
      if (action === 'exclude-role') store.addLevelExcludedRole(interaction.guildId, role.id);
      else store.removeLevelExcludedRole(interaction.guildId, role.id);
      await interaction.reply({ content: `<@&${role.id}> is now ${action === 'exclude-role' ? 'excluded from' : 'included in'} XP earning.`, flags: MessageFlags.Ephemeral });
      return true;
    }
    if (action === 'sync-rewards') {
      const result = await syncNamedLevelRewards(interaction.guild, store);
      await interaction.reply({
        content: `Imported ${result.imported} editable Level N roles.${result.skipped > 0 ? ` Skipped ${result.skipped} invalid or unmanageable role(s).` : ''}`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }
    if (action === 'list-rewards') {
      await interaction.reply({ embeds: [rewardsEmbed(interaction.guild, store)], flags: MessageFlags.Ephemeral });
      return true;
    }
    if (action === 'add-reward' || action === 'remove-reward') {
      const level = interaction.options.getInteger('level');
      if (level === null || level < 1) throw new Error('Choose a reward level from 1 through 1000.');
      if (action === 'add-reward') {
        const role = interaction.options.getRole('role');
        if (!role) throw new Error('Choose a role to add as the reward.');
        const guildRole = await interaction.guild.roles.fetch(role.id).catch(() => null);
        if (!guildRole || !roleIsValidReward(guildRole)) {
          throw new Error('The reward role must be un-managed and below HIT in the role list.');
        }
        store.upsertLevelReward(interaction.guildId, level, role.id);
        await interaction.reply({ content: `Level ${level} now awards <@&${role.id}>.`, flags: MessageFlags.Ephemeral });
      } else {
        const removed = store.deleteLevelReward(interaction.guildId, level);
        await interaction.reply({ content: removed ? `Removed the level ${level} reward.` : `No reward was configured for level ${level}.`, flags: MessageFlags.Ephemeral });
      }
      return true;
    }

    if (action === 'sync-all') {
      if (interaction.user.id !== interaction.guild.ownerId) {
        throw new Error('Only the server owner can synchronize all reward roles.');
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const members = await interaction.guild.members.fetch();
      let synchronized = 0;
      let rolesAdded = 0;
      const failures: string[] = [];

      for (const member of members.values()) {
        if (member.user.bot) continue;

        try {
          const profile = store.getLevelProfile(interaction.guildId, member.id);
          const added = await syncRewardRoles(
            member,
            settings,
            levelFromXp(profile?.xp ?? 0),
            store,
          );

          synchronized += 1;
          rolesAdded += added.length;
        } catch (error) {
          failures.push(
            `${member.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      await interaction.editReply(
        `Synchronized reward roles for ${synchronized} member(s). Added ${rolesAdded} role(s). Failures: ${failures.length}.` +
          (failures.length > 0 ? `\n${failures.slice(0, 10).join('\n')}` : ''),
      );

      return true;
    }

    const userId = requireOptionalUser(interaction);
    const currentProfile = store.getLevelProfile(interaction.guildId, userId);
    const current = currentProfile?.xp ?? 0;
    if (action === 'sync-user') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) throw new Error('That member is not in this server.');
      const added = await syncRewardRoles(member, settings, levelFromXp(current), store);
      await interaction.editReply(
        `Synchronized level reward roles for <@${userId}>.${added.length > 0 ? ` Added ${added.length} role(s).` : ''}`,
      );
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    let change: LevelXpChange;
    if (action === 'reset-user') {
      change = store.setLevelXp(interaction.guildId, userId, 0);
    } else if (action === 'set-level') {
      const level = interaction.options.getInteger('level');
      if (level === null) throw new Error('Choose a level from 0 through 1000.');
      change = store.setLevelXp(interaction.guildId, userId, xpForLevel(level));
    } else {
      const amount = interaction.options.getInteger('amount');
      if (amount === null) throw new Error('Choose an XP amount for that action.');
      if (action === 'add-xp') change = store.adjustLevelXp(interaction.guildId, userId, amount);
      else if (action === 'remove-xp') change = store.adjustLevelXp(interaction.guildId, userId, -amount);
      else if (action === 'set-xp') change = store.setLevelXp(interaction.guildId, userId, amount);
      else throw new Error('Unknown levels management action.');
    }
    const member = await interaction.guild.members.fetch(userId).catch(() => null);
    const result = member
      ? await processLevelChange(member, settings, change, store, 'admin', null)
      : { change, oldLevel: levelFromXp(change.before.xp), newLevel: levelFromXp(change.after.xp), bonusXp: 0, addedRoleIds: [] };
    await sendLevelLog(interaction.guild, settings, 'LEVEL XP ADMIN CHANGE', [
      `Member: <@${userId}>`,
      `Moderator: <@${interaction.user.id}>`,
      `Previous XP: ${current}`,
      `New XP: ${result.change.after.xp}`,
      `Action: ${action}`,
    ].join('\n'));
    await interaction.editReply(
      `<@${userId}> now has ${result.change.after.xp.toLocaleString()} XP at level ${result.newLevel}.`,
    );
    return true;
  }

  return false;
}

export async function handleXpSlashCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<void> {
  if (interaction.commandName !== 'xp' || !interaction.inCachedGuild()) return;
  const settings = requireSettings(store, interaction.guildId);
  const action = interaction.options.getSubcommand();

  if (action === 'sync-all') {
    if (interaction.user.id !== interaction.guild.ownerId) {
      throw new Error('Only the server owner can synchronize all reward roles.');
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const members = await interaction.guild.members.fetch();
    let synchronized = 0;
    let rolesAdded = 0;
    const failures: string[] = [];
    for (const member of members.values()) {
      if (member.user.bot) continue;
      try {
        const profile = store.getLevelProfile(interaction.guildId, member.id);
        const added = await syncRewardRoles(member, settings, levelFromXp(profile?.xp ?? 0), store);
        synchronized += 1;
        rolesAdded += added.length;
      } catch (error) {
        failures.push(`${member.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await interaction.editReply(
      `Synchronized ${synchronized} member(s). Added ${rolesAdded} role(s). Failures: ${failures.length}.` +
      (failures.length > 0 ? `
${failures.slice(0, 10).join('\n')}` : ''),
    );
    return;
  }

  const user = interaction.options.getUser('user', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) throw new Error('That member is not in this server.');
  const before = store.getLevelProfile(interaction.guildId, user.id)?.xp ?? 0;

  if (action === 'sync') {
    const added = await syncRewardRoles(member, settings, levelFromXp(before), store);
    await interaction.editReply(`Synchronized <@${user.id}>. Added ${added.length} role(s).`);
    return;
  }

  let change: LevelXpChange;
  if (action === 'give') {
    change = store.adjustLevelXp(interaction.guildId, user.id, interaction.options.getInteger('amount', true));
  } else if (action === 'remove') {
    change = store.adjustLevelXp(interaction.guildId, user.id, -interaction.options.getInteger('amount', true));
  } else if (action === 'set') {
    change = store.setLevelXp(interaction.guildId, user.id, interaction.options.getInteger('amount', true));
  } else if (action === 'level') {
    change = store.setLevelXp(interaction.guildId, user.id, xpForLevel(interaction.options.getInteger('level', true)));
  } else if (action === 'reset') {
    change = store.setLevelXp(interaction.guildId, user.id, 0);
  } else {
    throw new Error('Unknown XP command.');
  }

  const result = await processLevelChange(member, settings, change, store, 'admin', null);
  await sendLevelLog(interaction.guild, settings, 'FAST XP ADMIN CHANGE', [
    `Member: <@${user.id}>`,
    `Moderator: <@${interaction.user.id}>`,
    `Previous XP: ${before}`,
    `New XP: ${result.change.after.xp}`,
    `Action: ${action}`,
  ].join('\n'));
  await interaction.editReply(
    `<@${user.id}> now has ${result.change.after.xp.toLocaleString()} XP at level ${result.newLevel}.`,
  );
}

function levelsHelp(prefix: string): string {
  return [
    '**HIT LEVEL COMMANDS**',
    `\`${prefix}rank\` or \`${prefix}rank @user\``,
    `\`${prefix}leaderboard\``,
    `\`${prefix}levels rewards\``,
    'Slash commands: `/level rank`, `/level leaderboard`, `/level rewards`',
  ].join('\n');
}

function deleteLater(message: Message): void {
  setTimeout(() => void message.delete().catch(() => undefined), HELP_DELETE_MS);
}

export async function handleLevelsPrefixCommand(message: Message, store: Store, defaultPrefix: string): Promise<void> {
  if (!message.guild || message.author.bot) return;
  const prefix = store.getGuildSettings(message.guild.id)?.prefix ?? defaultPrefix;
  if (!message.content.startsWith(prefix)) return;
  const [rawCommand, rawSubcommand, rawArgument] = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = rawCommand?.toLowerCase();
  if (!command || !['rank', 'level', 'leaderboard', 'lb', 'levels'].includes(command)) return;
  requireSettings(store, message.guild.id);

  if (command === 'rank' || command === 'level') {
    const target = message.mentions.members?.first() ?? message.member;
    if (!target) throw new Error('That member is not available.');
    const profile = store.getLevelProfile(message.guild.id, target.id);
    const rank = store.getLevelRank(message.guild.id, target.id);
    await message.reply({ embeds: [rankEmbed(target, profile, rank)] });
    return;
  }

  if (command === 'leaderboard' || command === 'lb') {
    await message.reply({ embeds: [await leaderboardEmbed(message.guild, store, 1)] });
    return;
  }

  if (rawSubcommand?.toLowerCase() === 'rewards') {
    const page = Number(rawArgument ?? 1);
    await message.reply({ embeds: [rewardsEmbed(message.guild, store, Number.isFinite(page) ? page : 1)] });
    return;
  }

  const response = await message.reply(levelsHelp(prefix));
  deleteLater(message);
  deleteLater(response);
}

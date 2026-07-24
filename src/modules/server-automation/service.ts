import {
  ChannelType,
  Client,
  Guild,
  GuildMember,
  Routes,
  type CategoryChannel,
  type GuildBasedChannel,
  type Role,
  type TextChannel,
} from 'discord.js';
import { logger } from '../../core/logger.js';
import { Store } from '../../core/store.js';

const CUSTOMHIT_GUILD_ID = process.env.DISCORD_GUILD_ID?.trim() || '1528835957510373537';
const MAIN_GENERAL_CHANNEL_ID = process.env.MAIN_GENERAL_CHANNEL_ID?.trim() || '1528858711773151283';
const BOOST_CATEGORY_ID = process.env.BOOST_CATEGORY_ID?.trim() || '1528860276705984582';
const NV_ROLE_ID = process.env.NV_ROLE_ID?.trim() || '1528838334707667146';
const YV_ROLE_ID = process.env.YV_ROLE_ID?.trim() || '1528837906595057814';
const PINGS_ROLE_NAME = 'Pings';
const LEGACY_NO_PINGS_ROLE_NAMES = new Set(['no ping', 'no pings']);
const NOTIFICATION_ROLE_NAMES = new Set([
  'announcements',
  'server updates',
  'lfg',
  'polls',
  'partnerships',
  'content drops',
  'voice activity',
]);

interface OnboardingOption {
  id: string;
  title: string;
  description: string | null;
  role_ids: string[];
  channel_ids: string[];
  emoji_id?: string | null;
  emoji_name?: string | null;
  emoji_animated?: boolean;
}

interface OnboardingPrompt {
  id: string;
  type: number;
  options: OnboardingOption[];
  title: string;
  single_select: boolean;
  required: boolean;
  in_onboarding: boolean;
}

interface GuildOnboarding {
  guild_id: string;
  prompts: OnboardingPrompt[];
  default_channel_ids: string[];
  enabled: boolean;
  mode?: number;
}

async function fetchGuild(client: Client): Promise<Guild | null> {
  return client.guilds.fetch(CUSTOMHIT_GUILD_ID).catch(() => null);
}

function findMainGeneral(guild: Guild): TextChannel | null {
  const exact = guild.channels.cache.get(MAIN_GENERAL_CHANNEL_ID);
  if (exact?.type === ChannelType.GuildText) return exact;
  const channel = guild.channels.cache.find((candidate) => (
    candidate.type === ChannelType.GuildText
    && candidate.name.toLowerCase() === 'general'
    && candidate.parent?.name.toLowerCase() === 'general'
  ));
  return channel?.type === ChannelType.GuildText ? channel : null;
}

function findBoostCategory(guild: Guild): CategoryChannel | null {
  const exact = guild.channels.cache.get(BOOST_CATEGORY_ID);
  if (exact?.type === ChannelType.GuildCategory) return exact;
  const channel = guild.channels.cache.find((candidate) => (
    candidate.type === ChannelType.GuildCategory
    && candidate.name.toLowerCase() === 'boost'
  ));
  return channel?.type === ChannelType.GuildCategory ? channel : null;
}

function findBoosterRole(guild: Guild): Role | null {
  return guild.roles.premiumSubscriberRole
    ?? guild.roles.cache.find((role) => role.managed && role.name.toLowerCase().includes('booster'))
    ?? null;
}

async function ensureBoostAccess(guild: Guild): Promise<void> {
  await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
  const category = findBoostCategory(guild);
  const boosterRole = findBoosterRole(guild);
  if (!category || !boosterRole) {
    logger.warn('Booster configuration skipped', {
      guildId: guild.id,
      categoryFound: Boolean(category),
      boosterRoleFound: Boolean(boosterRole),
    });
    return;
  }

  const children = guild.channels.cache.filter((channel) => (
    'parentId' in channel && channel.parentId === category.id
  ));
  const targets: GuildBasedChannel[] = [category, ...children.values()];
  const boosterAllow = {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true,
    AddReactions: true,
    EmbedLinks: true,
    AttachFiles: true,
    CreatePublicThreads: true,
    SendMessagesInThreads: true,
    Connect: true,
    Speak: true,
    Stream: true,
    UseVAD: true,
  } as const;

  for (const channel of targets) {
    if (!('permissionOverwrites' in channel)) continue;
    await channel.permissionOverwrites.edit(
      guild.roles.everyone,
      { ViewChannel: false, SendMessages: false },
      { reason: 'CUSTOMHIT booster access policy' },
    );
    await channel.permissionOverwrites.edit(
      boosterRole,
      boosterAllow,
      { reason: 'CUSTOMHIT booster access policy' },
    );
    if (channel.permissionOverwrites.cache.has(YV_ROLE_ID)) {
      await channel.permissionOverwrites.delete(
        YV_ROLE_ID,
        'CUSTOMHIT booster access policy',
      ).catch(() => undefined);
    }
  }
}

async function ensurePingsRole(guild: Guild): Promise<Role> {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);

  let role = guild.roles.cache.find((candidate) => (
    !candidate.managed && candidate.name.toLowerCase() === PINGS_ROLE_NAME.toLowerCase()
  )) ?? null;

  if (!role) {
    role = guild.roles.cache.find((candidate) => (
      !candidate.managed && LEGACY_NO_PINGS_ROLE_NAMES.has(candidate.name.toLowerCase())
    )) ?? null;
  }

  if (!role) {
    role = await guild.roles.create({
      name: PINGS_ROLE_NAME,
      permissions: [],
      hoist: false,
      mentionable: false,
      reason: 'CUSTOMHIT onboarding notification role',
    });
  } else if (
    role.name !== PINGS_ROLE_NAME
    || role.permissions.bitfield !== 0n
    || role.hoist
    || role.mentionable
  ) {
    role = await role.edit({
      name: PINGS_ROLE_NAME,
      permissions: [],
      hoist: false,
      mentionable: false,
      reason: 'CUSTOMHIT onboarding notification role policy',
    });
  }

  for (const channel of guild.channels.cache.values()) {
    if (!('permissionOverwrites' in channel)) continue;
    if (!channel.permissionOverwrites.cache.has(role.id)) continue;
    await channel.permissionOverwrites.delete(
      role.id,
      'CUSTOMHIT Pings role must not change channel access',
    ).catch(() => undefined);
  }

  const notificationPeers = guild.roles.cache.filter((candidate) => (
    !candidate.managed
    && candidate.id !== role.id
    && NOTIFICATION_ROLE_NAMES.has(candidate.name.toLowerCase())
  ));
  const recreationRole = guild.roles.cache.find((candidate) => (
    !candidate.managed && candidate.name.toLowerCase() === 'recreation'
  ));
  const targetPosition = notificationPeers.size > 0
    ? Math.min(...notificationPeers.map((candidate) => candidate.position))
    : Math.max((recreationRole?.position ?? 3) + 1, 4);
  if (role.position !== targetPosition) {
    await role.setPosition(targetPosition, {
      reason: 'CUSTOMHIT notification role hierarchy',
    }).catch(() => undefined);
  }

  return role;
}

function roleForOnboardingOption(guild: Guild, option: OnboardingOption): Role | null {
  for (const roleId of option.role_ids) {
    if (roleId === NV_ROLE_ID) continue;
    const role = guild.roles.cache.get(roleId);
    if (role) return role;
  }
  return null;
}

function cleanPromptTitle(title: string): string {
  return title.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s+/g, ' ').trim()
    || 'Choose your notification roles';
}

async function repairOnboarding(guild: Guild): Promise<Role | null> {
  const pingsRole = await ensurePingsRole(guild).catch((error: unknown) => {
    logger.warn('Could not create or repair Pings role', { guildId: guild.id, error: String(error) });
    return null;
  });
  if (!pingsRole) return null;

  const route = Routes.guildOnboarding(guild.id);
  const onboarding = await guild.client.rest.get(route).catch((error: unknown) => {
    logger.warn('Could not read guild onboarding', { guildId: guild.id, error: String(error) });
    return null;
  }) as GuildOnboarding | null;
  if (!onboarding) return pingsRole;

  let changed = false;
  const prompts = onboarding.prompts.map((prompt) => {
    const promptTitle = cleanPromptTitle(prompt.title);
    if (promptTitle !== prompt.title) changed = true;

    const options = prompt.options.map((option) => {
      const configuredRole = roleForOnboardingOption(guild, option);
      const isLegacyNoPingsOption = (
        configuredRole === null
        || LEGACY_NO_PINGS_ROLE_NAMES.has(option.title.toLowerCase().trim())
      );
      const role = isLegacyNoPingsOption ? pingsRole : configuredRole;
      const title = role?.name ?? PINGS_ROLE_NAME;
      const description = role?.id === pingsRole.id
        ? 'Receive general server pings.'
        : `Receive ${title} notifications.`;
      const roleIds = isLegacyNoPingsOption
        ? [...new Set([...option.role_ids, pingsRole.id])]
        : option.role_ids;

      if (
        option.title !== title
        || option.description !== description
        || option.emoji_id !== null
        || option.emoji_name !== null
        || option.emoji_animated === true
        || roleIds.length !== option.role_ids.length
        || roleIds.some((roleId, index) => roleId !== option.role_ids[index])
      ) {
        changed = true;
      }
      return {
        id: option.id,
        title,
        description,
        role_ids: roleIds,
        channel_ids: option.channel_ids,
        emoji_id: null,
        emoji_name: null,
        emoji_animated: false,
      };
    });

    return {
      id: prompt.id,
      type: prompt.type,
      title: promptTitle,
      single_select: prompt.single_select,
      required: prompt.required,
      in_onboarding: prompt.in_onboarding,
      options,
    };
  });

  if (!changed) return pingsRole;
  await guild.client.rest.put(route, {
    body: {
      prompts,
      default_channel_ids: onboarding.default_channel_ids,
      enabled: onboarding.enabled,
      mode: onboarding.mode ?? 0,
    },
    reason: 'CUSTOMHIT onboarding Pings role and option repair',
  }).catch((error: unknown) => {
    logger.warn('Could not update guild onboarding', { guildId: guild.id, error: String(error) });
  });
  return pingsRole;
}

function ensureLevelConfiguration(guild: Guild, store: Store): void {
  const general = findMainGeneral(guild);
  const current = store.getLevelSettings(guild.id);
  if (!general || !current) return;

  const legacyRates = (
    current.messageXpMin === 15
    && current.messageXpMax === 25
    && current.messageCooldownSeconds === 60
    && current.voiceXpPerMinute === 10
  );
  store.upsertLevelSettings({
    ...current,
    announceChannelId: general.id,
    messageXpMin: legacyRates ? 50 : current.messageXpMin,
    messageXpMax: legacyRates ? 100 : current.messageXpMax,
    messageCooldownSeconds: legacyRates ? 15 : current.messageCooldownSeconds,
    voiceXpPerMinute: legacyRates ? 50 : current.voiceXpPerMinute,
    announceLevelUps: true,
    stackRewardRoles: true,
  });
}

export async function ensureCustomHitServerConfiguration(client: Client, store: Store): Promise<void> {
  const guild = await fetchGuild(client);
  if (!guild) {
    logger.warn('CUSTOMHIT server automation skipped; guild unavailable', { guildId: CUSTOMHIT_GUILD_ID });
    return;
  }
  await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
  ensureLevelConfiguration(guild, store);
  await ensureBoostAccess(guild);
  const pingsRole = await repairOnboarding(guild);
  logger.info('CUSTOMHIT server automation complete', {
    guildId: guild.id,
    mainGeneralChannelId: findMainGeneral(guild)?.id,
    boostCategoryId: findBoostCategory(guild)?.id,
    pingsRoleId: pingsRole?.id,
  });
}

export async function handleBoosterMemberUpdate(oldMember: GuildMember, newMember: GuildMember): Promise<void> {
  if (newMember.guild.id !== CUSTOMHIT_GUILD_ID) return;
  if (oldMember.premiumSince || !newMember.premiumSince) return;
  const general = findMainGeneral(newMember.guild);
  if (!general) return;
  await general.send({
    content: `<@${newMember.id}> boosted the server. Thank you for supporting the community.`,
    allowedMentions: { users: [newMember.id] },
  }).catch(() => undefined);
}

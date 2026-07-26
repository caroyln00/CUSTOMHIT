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
const ONBOARDING_ROLE_SPECS = [
  {
    name: 'Announcements',
    aliases: ['announcements', 'announcement'],
    description: 'Receive Announcements notifications.',
    preservePermissions: false,
  },
  {
    name: 'Server Updates',
    aliases: ['server updates', 'updates'],
    description: 'Receive Server Updates notifications.',
    preservePermissions: false,
  },
  {
    name: 'LFG',
    aliases: ['lfg'],
    description: 'Receive LFG notifications.',
    preservePermissions: false,
  },
  {
    name: 'Polls',
    aliases: ['polls', 'poll'],
    description: 'Receive Polls notifications.',
    preservePermissions: false,
  },
  {
    name: 'Partnerships',
    aliases: ['partnerships', 'partnership'],
    description: 'Receive Partnerships notifications.',
    preservePermissions: false,
  },
  {
    name: 'Content Drops',
    aliases: ['content drops', 'content'],
    description: 'Receive Content Drops notifications.',
    preservePermissions: false,
  },
  {
    name: 'Voice Activity',
    aliases: ['voice activity', 'voice'],
    description: 'Receive Voice Activity notifications.',
    preservePermissions: false,
  },
  {
    name: 'Recreation',
    aliases: ['recreation'],
    description: 'Receive Recreation notifications.',
    preservePermissions: true,
  },
  {
    name: 'Pings',
    aliases: ['pings', 'no pings', 'no ping'],
    description: 'Receive general server pings.',
    preservePermissions: false,
  },
] as const;


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

async function ensureOnboardingRole(
  guild: Guild,
  spec: (typeof ONBOARDING_ROLE_SPECS)[number],
): Promise<Role> {
  const aliases = new Set(spec.aliases.map((alias) => alias.toLowerCase()));
  aliases.add(spec.name.toLowerCase());

  let role = guild.roles.cache.find((candidate) => (
    !candidate.managed && candidate.name.toLowerCase() === spec.name.toLowerCase()
  )) ?? null;

  if (!role) {
    role = guild.roles.cache.find((candidate) => (
      !candidate.managed && aliases.has(candidate.name.toLowerCase())
    )) ?? null;
  }

  if (!role) {
    role = await guild.roles.create({
      name: spec.name,
      permissions: 0n,
      hoist: false,
      mentionable: false,
      reason: 'CUSTOMHIT advanced onboarding role',
    });
  } else {
    const shouldEdit = (
      role.name !== spec.name
      || role.hoist
      || role.mentionable
      || (!spec.preservePermissions && role.permissions.bitfield !== 0n)
    );
    if (shouldEdit) {
      role = await role.edit({
        name: spec.name,
        permissions: spec.preservePermissions ? role.permissions.bitfield : 0n,
        hoist: false,
        mentionable: false,
        reason: 'CUSTOMHIT advanced onboarding role policy',
      });
    }
  }

  if (!spec.preservePermissions) {
    for (const channel of guild.channels.cache.values()) {
      if (!('permissionOverwrites' in channel)) continue;
      if (!channel.permissionOverwrites.cache.has(role.id)) continue;
      await channel.permissionOverwrites.delete(
        role.id,
        'CUSTOMHIT notification roles must not alter channel access',
      ).catch(() => undefined);
    }
  }

  return role;
}

async function ensureOnboardingRoles(guild: Guild): Promise<Map<string, Role>> {
  await Promise.all([guild.roles.fetch(), guild.channels.fetch()]);
  const roles = new Map<string, Role>();
  for (const spec of ONBOARDING_ROLE_SPECS) {
    const role = await ensureOnboardingRole(guild, spec);
    roles.set(spec.name, role);
  }

  const notificationPeers = [...roles.values()].filter((role) => role.name !== 'Recreation');
  const recreationRole = roles.get('Recreation');
  const recreationPosition = recreationRole?.position ?? 3;
  let nextPosition = Math.max(recreationPosition + 1, 4);
  for (const role of notificationPeers.reverse()) {
    if (role.position !== nextPosition) {
      await role.setPosition(nextPosition, {
        reason: 'CUSTOMHIT notification role hierarchy',
      }).catch(() => undefined);
    }
    nextPosition += 1;
  }

  const retainedPings = roles.get('Pings');
  for (const duplicate of guild.roles.cache.values()) {
    if (duplicate.managed || duplicate.id === retainedPings?.id) continue;
    const lowered = duplicate.name.toLowerCase();
    if (lowered !== 'no ping' && lowered !== 'no pings') continue;
    await duplicate.delete('CUSTOMHIT removed obsolete No Pings role').catch(() => undefined);
  }

  return roles;
}

async function repairOnboarding(guild: Guild): Promise<Map<string, Role> | null> {
  const roles = await ensureOnboardingRoles(guild).catch((error: unknown) => {
    logger.warn('Could not create or repair onboarding roles', {
      guildId: guild.id,
      error: String(error),
    });
    return null;
  });
  if (!roles) return null;

  const route = Routes.guildOnboarding(guild.id);
  const onboarding = await guild.client.rest.get(route).catch((error: unknown) => {
    logger.warn('Could not read guild onboarding', { guildId: guild.id, error: String(error) });
    return null;
  }) as GuildOnboarding | null;
  if (!onboarding) return roles;

  const sourcePrompt = onboarding.prompts[0];
  if (!sourcePrompt || sourcePrompt.options.length < ONBOARDING_ROLE_SPECS.length) {
    logger.warn('Advanced onboarding repair requires one prompt with at least nine existing options', {
      guildId: guild.id,
      promptCount: onboarding.prompts.length,
      optionCount: sourcePrompt?.options.length ?? 0,
    });
    return roles;
  }

  const options = ONBOARDING_ROLE_SPECS.map((spec, index) => {
    const sourceOption = sourcePrompt.options[index];
    const role = roles.get(spec.name);
    if (!sourceOption) throw new Error(`Missing source onboarding option ${index + 1}.`);
    if (!role) throw new Error(`Missing onboarding role ${spec.name}.`);
    return {
      id: sourceOption.id,
      title: spec.name,
      description: spec.description,
      role_ids: [NV_ROLE_ID, role.id],
      channel_ids: [],
      emoji_id: null,
      emoji_name: null,
      emoji_animated: false,
    };
  });

  const prompt: OnboardingPrompt = {
    id: sourcePrompt.id,
    type: 0,
    title: 'What do you want to be notified about?',
    single_select: false,
    required: true,
    in_onboarding: true,
    options,
  };

  await guild.client.rest.put(route, {
    body: {
      prompts: [prompt],
      default_channel_ids: onboarding.default_channel_ids,
      enabled: true,
      mode: 1,
    },
    reason: 'CUSTOMHIT deterministic advanced onboarding configuration',
  });

  logger.info('CUSTOMHIT advanced onboarding repaired', {
    guildId: guild.id,
    mode: 1,
    enabled: true,
    optionNames: ONBOARDING_ROLE_SPECS.map((spec) => spec.name),
    defaultChannelCount: onboarding.default_channel_ids.length,
  });
  return roles;
}

function ensureLevelConfiguration(guild: Guild, store: Store): void {
  const general = findMainGeneral(guild);
  const current = store.getLevelSettings(guild.id);
  if (!general || !current) return;

  const legacyRates = (
    current.messageXpMin === 15
    && (current.messageXpMax === 25 || current.messageXpMax === 40)
    && current.messageCooldownSeconds === 60
    && (current.voiceXpPerMinute === 0 || current.voiceXpPerMinute === 10)
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
  const onboardingRoles = await repairOnboarding(guild);
  logger.info('CUSTOMHIT server automation complete', {
    guildId: guild.id,
    mainGeneralChannelId: findMainGeneral(guild)?.id,
    boostCategoryId: findBoostCategory(guild)?.id,
    pingsRoleId: onboardingRoles?.get('Pings')?.id,
    onboardingMode: 'advanced',
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

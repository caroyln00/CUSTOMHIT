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

async function repairOnboarding(guild: Guild): Promise<void> {
  await guild.roles.fetch();
  const route = Routes.guildOnboarding(guild.id);
  const onboarding = await guild.client.rest.get(route).catch((error: unknown) => {
    logger.warn('Could not read guild onboarding', { guildId: guild.id, error: String(error) });
    return null;
  }) as GuildOnboarding | null;
  if (!onboarding) return;

  let changed = false;
  const prompts = onboarding.prompts.map((prompt) => {
    const promptTitle = cleanPromptTitle(prompt.title);
    if (promptTitle !== prompt.title) changed = true;

    const options = prompt.options.map((option) => {
      const role = roleForOnboardingOption(guild, option);
      const title = role?.name ?? 'No Pings';
      const description = role
        ? `Receive ${title} notifications.`
        : 'Do not receive notification pings.';
      if (
        option.title !== title
        || option.description !== description
        || option.emoji_id !== null
        || option.emoji_name !== null
        || option.emoji_animated === true
      ) {
        changed = true;
      }
      return {
        id: option.id,
        title,
        description,
        role_ids: option.role_ids,
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

  if (!changed) return;
  await guild.client.rest.put(route, {
    body: {
      prompts,
      default_channel_ids: onboarding.default_channel_ids,
      enabled: onboarding.enabled,
      mode: onboarding.mode ?? 0,
    },
    reason: 'CUSTOMHIT onboarding role names and emoji cleanup',
  }).catch((error: unknown) => {
    logger.warn('Could not update guild onboarding', { guildId: guild.id, error: String(error) });
  });
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
  await repairOnboarding(guild);
  logger.info('CUSTOMHIT server automation complete', {
    guildId: guild.id,
    mainGeneralChannelId: findMainGeneral(guild)?.id,
    boostCategoryId: findBoostCategory(guild)?.id,
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

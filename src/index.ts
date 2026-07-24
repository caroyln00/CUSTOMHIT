import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  Partials,
  type MessageReaction,
} from 'discord.js';
import { env } from './core/env.js';
import { logger } from './core/logger.js';
import { Store } from './core/store.js';
import {
  handleHitSlashCommand,
  handlePrefixCommand,
  handleVerificationInteraction,
  onMemberJoin,
  startVerificationTimeoutWorker,
} from './modules/verification/service.js';
import {
  handleHitTicketAdminCommand,
  handleTicketInteraction,
  handleTicketPrefixCommand,
  handleTicketSlashCommand,
} from './modules/tickets/service.js';
import {
  handleHitSecurityAdminCommand,
  handleSecurityAuditLogEntry,
  handleSecurityMessage,
  handleSecurityPrefixCommand,
  handleSecuritySlashCommand,
  onSecurityMemberJoin,
  startSecurityWorker,
} from './modules/security/service.js';
import {
  handleHitModerationAdminCommand,
  handleModerationButton,
  handleModerationPrefixCommand,
  handleModerationSlashCommand,
} from './modules/moderation/service.js';

import {
  handleHitVoiceAdminCommand,
  handleTempVoiceChannelDelete,
  handleVoicePrefixCommand,
  handleVoiceSlashCommand,
  handleVoiceStateUpdate,
  startVoiceWorker,
} from './modules/voice/service.js';


import {
  handleHitLevelsAdminCommand,
  handleLevelsMessage,
  handleLevelsPrefixCommand,
  handleLevelSlashCommand,
  handleXpSlashCommand,
  startLevelsWorker,
} from './modules/levels/service.js';



import {
  handleCommunityMessage,
  handleCommunityMessageDelete,
  handleCommunityMessageUpdate,
  handleCommunityPrefixCommand,
  handleCommunitySlashCommand,
  handleStarboardReaction,
  handleStarboardReactionClear,
} from './modules/community/service.js';

import {
  handleRecreationInteraction,
  handleRecreationPrefixCommand,
  handleRecreationSlashCommand,
  startRecreationWorker,
} from './modules/recreation/service.js';

import {
  handlePassiveChannelEvent,
  handlePassiveMemberUpdate,
  handlePassiveMessage,
  handlePassiveMessageDelete,
  handlePassiveMessageUpdate,
  handlePassiveRoleEvent,
  handlePassiveSlashCommand,
  onPassiveMemberJoin,
  onPassiveMemberRemove,
} from './modules/passive/service.js';
import { handleFunSlashCommand } from './modules/fun/service.js';
import {
  ensureCustomHitServerConfiguration,
  handleBoosterMemberUpdate,
} from './modules/server-automation/service.js';

import {
  handleGuidedLfgChannelMessage,
  handleHitLfgAdminCommand,
  handleLfgInteraction,
  handleLfgPrefixCommand,
  handleLfgSlashCommand,
  startLfgWorker,
} from './modules/lfg/service.js';

const HIT_VERSION = '97.21.43';

const store = new Store(env.databasePath);
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember, Partials.Channel, Partials.Message, Partials.Reaction],
});

let timeoutWorker: NodeJS.Timeout | undefined;
let securityWorker: NodeJS.Timeout | undefined;
let lfgWorker: NodeJS.Timeout | undefined;
let voiceWorker: NodeJS.Timeout | undefined;
let levelsWorker: NodeJS.Timeout | undefined;
let recreationWorker: NodeJS.Timeout | undefined;

client.once(Events.ClientReady, async (readyClient) => {
  logger.info('HIT is online', {
    user: readyClient.user.tag,
    version: HIT_VERSION,
    guilds: readyClient.guilds.cache.size,
    prefix: env.defaultPrefix,
    modules: ['verification', 'tickets', 'moderation', 'security', 'passive', 'fun', 'lfg', 'voice', 'levels', 'recreation', 'economy', 'counting', 'starboard'],
  });
  readyClient.user.setPresence({ activities: [{ name: `HIT v${HIT_VERSION} | ${env.defaultPrefix}help` }], status: 'online' });
  timeoutWorker = startVerificationTimeoutWorker(client, store);
  securityWorker = startSecurityWorker(client, store);
  lfgWorker = startLfgWorker(client, store);
  voiceWorker = startVoiceWorker(client, store);
  levelsWorker = startLevelsWorker(client, store);
  recreationWorker = startRecreationWorker(client, store);
  await ensureCustomHitServerConfiguration(readyClient, store).catch((error) => {
    logger.error('CUSTOMHIT server automation failed', { error: String(error) });
  });
});

client.on(Events.GuildMemberAdd, async (member) => {
  await onSecurityMemberJoin(member, store);
  await onPassiveMemberJoin(member);
  await onMemberJoin(member, store);
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (await handleGuidedLfgChannelMessage(message)) return;
    if (await handleSecurityMessage(message, store)) return;
    if (await handlePassiveMessage(message)) return;
    if (await handleCommunityMessage(message, store)) return;
    await handleLevelsMessage(message, store, env.defaultPrefix);
    await handlePrefixCommand(message, store, env.defaultPrefix);
    await handleTicketPrefixCommand(message, store, env.defaultPrefix);
    await handleModerationPrefixCommand(message, store, env.defaultPrefix);
    await handleSecurityPrefixCommand(message, store, env.defaultPrefix);
    await handleLfgPrefixCommand(message, store, env.defaultPrefix);
    await handleVoicePrefixCommand(message, store, env.defaultPrefix);
    await handleLevelsPrefixCommand(message, store, env.defaultPrefix);
    await handleRecreationPrefixCommand(message, store, env.defaultPrefix);
    await handleCommunityPrefixCommand(message, store, env.defaultPrefix);
  } catch (error) {
    logger.error('Prefix command failed', { guildId: message.guildId ?? undefined, userId: message.author.id, error: String(error) });
    await message.reply(`✖ ${error instanceof Error ? error.message : 'HIT encountered an error.'}`).catch(() => undefined);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (await handleModerationButton(interaction, store)) return;
      if (await handleRecreationInteraction(interaction, store)) return;
      if (await handleTicketInteraction(interaction, store)) return;
    }
    if (interaction.isButton() || interaction.isModalSubmit()) {
      if (await handleLfgInteraction(interaction, store)) return;
      if (await handleVerificationInteraction(interaction, store)) return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'hit') {
      if (await handleHitLevelsAdminCommand(interaction, store)) return;
      if (await handleHitVoiceAdminCommand(interaction, store)) return;
      if (await handleHitLfgAdminCommand(interaction, store)) return;
      if (await handleHitSecurityAdminCommand(interaction, store)) return;
      if (await handleHitModerationAdminCommand(interaction, store)) return;
      if (await handleHitTicketAdminCommand(interaction, store)) return;
      await handleHitSlashCommand(interaction, store, env.defaultPrefix);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'ticket') {
      await handleTicketSlashCommand(interaction, store);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'mod') {
      await handleModerationSlashCommand(interaction, store);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'security') {
      await handleSecuritySlashCommand(interaction, store);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'lfg') {
      await handleLfgSlashCommand(interaction, store);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'voice') {
      await handleVoiceSlashCommand(interaction, store);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'level') {
      await handleLevelSlashCommand(interaction, store);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'xp') {
      await handleXpSlashCommand(interaction, store);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'recreation') {
      await handleRecreationSlashCommand(interaction, store);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'passive') {
      await handlePassiveSlashCommand(interaction);
      return;
    }
    if (interaction.isChatInputCommand() && interaction.commandName === 'fun') {
      await handleFunSlashCommand(interaction);
      return;
    }
    if (interaction.isChatInputCommand() && ['community', 'economy', 'counting', 'starboard'].includes(interaction.commandName)) {
      await handleCommunitySlashCommand(interaction, store);
    }
  } catch (error) {
    logger.error('Interaction failed', { guildId: interaction.guildId ?? undefined, userId: interaction.user.id, error: String(error) });
    const payload = { content: `✖ ${error instanceof Error ? error.message : 'HIT encountered an error.'}`, flags: MessageFlags.Ephemeral as const };
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => undefined);
      else await interaction.reply(payload).catch(() => undefined);
    }
  }
});




client.on(Events.MessageReactionAdd, async (reaction) => {
  try {
    const fullReaction = reaction.partial ? await reaction.fetch() : (reaction as MessageReaction);
    await handleStarboardReaction(fullReaction, store);
  } catch (error) {
    logger.error('Starboard reaction-add handler failed', { guildId: reaction.message.guildId ?? undefined, error: String(error) });
  }
});

client.on(Events.MessageReactionRemove, async (reaction) => {
  try {
    const fullReaction = reaction.partial ? await reaction.fetch() : (reaction as MessageReaction);
    await handleStarboardReaction(fullReaction, store);
  } catch (error) {
    logger.error('Starboard reaction-remove handler failed', { guildId: reaction.message.guildId ?? undefined, error: String(error) });
  }
});

client.on(Events.MessageReactionRemoveAll, async (message) => {
  try {
    await handleStarboardReactionClear(message, store);
  } catch (error) {
    logger.error('Starboard reaction-clear handler failed', { guildId: message.guildId ?? undefined, error: String(error) });
  }
});

client.on(Events.MessageReactionRemoveEmoji, async (reaction) => {
  try {
    await handleStarboardReactionClear(reaction.message, store, reaction.emoji.id ?? reaction.emoji.name ?? '');
  } catch (error) {
    logger.error('Starboard emoji-clear handler failed', { guildId: reaction.message.guildId ?? undefined, error: String(error) });
  }
});

client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  try {
    await handlePassiveMessageUpdate(oldMessage, newMessage);
    await handleCommunityMessageUpdate(newMessage, store);
  } catch (error) {
    logger.error('Counting message-update handler failed', { guildId: newMessage.guildId ?? undefined, error: String(error) });
  }
});

client.on(Events.MessageDelete, async (message) => {
  try {
    await handlePassiveMessageDelete(message);
    await handleCommunityMessageDelete(message, store);
  } catch (error) {
    logger.error('Starboard message-delete handler failed', { guildId: message.guildId ?? undefined, error: String(error) });
  }
});

client.on(Events.GuildMemberRemove, async (member) => {
  try {
    await onPassiveMemberRemove(member as import('discord.js').GuildMember);
  } catch (error) {
    logger.error('Passive member-remove handler failed', { guildId: member.guild.id, userId: member.id, error: String(error) });
  }
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!('roles' in oldMember)) return;
  try {
    await handlePassiveMemberUpdate(oldMember as import('discord.js').GuildMember, newMember);
    await handleBoosterMemberUpdate(oldMember as import('discord.js').GuildMember, newMember);
  } catch (error) {
    logger.error('Passive member-update handler failed', { guildId: newMember.guild.id, userId: newMember.id, error: String(error) });
  }
});

client.on(Events.ChannelCreate, async (channel) => {
  if (channel.isDMBased()) return;
  try { await handlePassiveChannelEvent('created', channel); }
  catch (error) { logger.error('Passive channel-create handler failed', { guildId: channel.guild.id, error: String(error) }); }
});

client.on(Events.ChannelDelete, async (channel) => {
  if (channel.isDMBased()) return;
  try { await handlePassiveChannelEvent('deleted', channel); }
  catch (error) { logger.error('Passive channel-delete handler failed', { guildId: channel.guild.id, error: String(error) }); }
});

client.on(Events.ChannelUpdate, async (_oldChannel, newChannel) => {
  if (newChannel.isDMBased()) return;
  try { await handlePassiveChannelEvent('updated', newChannel); }
  catch (error) { logger.error('Passive channel-update handler failed', { guildId: newChannel.guild.id, error: String(error) }); }
});

client.on(Events.GuildRoleCreate, async (role) => {
  try { await handlePassiveRoleEvent('created', role); }
  catch (error) { logger.error('Passive role-create handler failed', { guildId: role.guild.id, error: String(error) }); }
});

client.on(Events.GuildRoleDelete, async (role) => {
  try { await handlePassiveRoleEvent('deleted', role); }
  catch (error) { logger.error('Passive role-delete handler failed', { guildId: role.guild.id, error: String(error) }); }
});

client.on(Events.GuildRoleUpdate, async (_oldRole, newRole) => {
  try { await handlePassiveRoleEvent('updated', newRole); }
  catch (error) { logger.error('Passive role-update handler failed', { guildId: newRole.guild.id, error: String(error) }); }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    await handleVoiceStateUpdate(oldState, newState, store);
  } catch (error) {
    logger.error('Temporary voice handler failed', { guildId: newState.guild.id, userId: newState.member?.id, error: String(error) });
  }
});

client.on(Events.ChannelDelete, (channel) => {
  handleTempVoiceChannelDelete(channel.id, store);
});

client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
  try {
    await handleSecurityAuditLogEntry(entry, guild, store);
  } catch (error) {
    logger.error('Security audit handler failed', { guildId: guild.id, error: String(error) });
  }
});

client.on(Events.Error, (error) => logger.error('Discord client error', { error: String(error) }));
client.on(Events.Warn, (message) => logger.warn('Discord client warning', { message }));

async function shutdown(signal: string): Promise<void> {
  logger.info('Shutting down HIT', { signal });
  if (timeoutWorker) clearInterval(timeoutWorker);
  if (securityWorker) clearInterval(securityWorker);
  if (lfgWorker) clearInterval(lfgWorker);
  if (voiceWorker) clearInterval(voiceWorker);
  if (levelsWorker) clearInterval(levelsWorker);
  if (recreationWorker) clearInterval(recreationWorker);
  client.destroy();
  store.close();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('Unhandled rejection', { reason: String(reason) }));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.stack ?? String(error) });
  void shutdown('uncaughtException');
});

await client.login(env.token);

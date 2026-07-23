import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  ComponentType,
  EmbedBuilder,
  ForumChannel,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js';
import type { LfgParticipant, LfgPost, LfgSettings, LfgStatus, Store } from '../../core/store.js';
import { logger } from '../../core/logger.js';

const COLOR = 0x0f3d66;
export const GUIDED_LFG_CHANNEL_ID = '1528950639596408842';
const CREATE_BUTTON_ID = 'hit:lfg:create';
const MINE_BUTTON_ID = 'hit:lfg:mine';
const CREATE_MODAL_ID = 'hit:lfg:create-modal';
const JOIN_BUTTON_ID = 'hit:lfg:join';
const LEAVE_BUTTON_ID = 'hit:lfg:leave';
const CLOSE_BUTTON_ID = 'hit:lfg:close';
const REOPEN_BUTTON_ID = 'hit:lfg:reopen';
const DELETE_BUTTON_ID = 'hit:lfg:delete';
const DELETE_CONFIRM_BUTTON_ID = 'hit:lfg:delete-confirm';
const STATUS_TAG_NAMES = new Set(['open', 'full', 'closed', 'expired']);
const MIN_EXPIRY_MINUTES = 15;
const MAX_EXPIRY_MINUTES = 10080;

interface LfgCreateInput {
  game: string;
  mode: string;
  platform: string;
  region: string;
  maxPlayers: number;
  notes: string;
  expiryMinutes: number;
}

function requireLfgSettings(store: Store, guildId: string): LfgSettings {
  const settings = store.getLfgSettings(guildId);
  if (!settings) throw new Error('HIT LFG is not configured. Run /hit lfg-setup.');
  return settings;
}

function cleanText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function statusLabel(status: LfgStatus): string {
  if (status === 'open') return 'OPEN';
  if (status === 'full') return 'FULL';
  if (status === 'closed') return 'CLOSED';
  return 'EXPIRED';
}

function statusColor(status: LfgStatus): number {
  if (status === 'open') return 0x22c55e;
  if (status === 'full') return 0xf59e0b;
  if (status === 'closed') return 0x64748b;
  return 0xef4444;
}

function canManageLfg(member: GuildMember, post: LfgPost): boolean {
  return member.id === post.ownerId
    || member.permissions.has(PermissionFlagsBits.ManageThreads)
    || member.permissions.has(PermissionFlagsBits.ManageChannels)
    || member.permissions.has(PermissionFlagsBits.Administrator);
}

function panelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('GUIDED LFG CREATION')
    .setDescription([
      '**Press the button below to create your LFG.**',
      '',
      'HIT will guide you through the game, mode, platform, region, player limit, expiration, and requirements.',
      '',
      'This channel is panel-only. Regular messages are automatically removed.',
      'Use `/lfg mine` anywhere in the server to view your active groups.',
      '',
      'Do not post account sales, cheats, scams, paid carries, or unsafe external links.',
    ].join('\n'))
    .setFooter({ text: 'HIT LFG | Guided creation only.' });
}

function panelControls(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(CREATE_BUTTON_ID).setLabel('Create LFG').setStyle(ButtonStyle.Primary),
  );
}

function isGuidedPanelMessage(message: Message): boolean {
  if (!message.client.user || message.author.id !== message.client.user.id) return false;
  const hasGuidedEmbed = message.embeds.some((embed) => embed.title === 'GUIDED LFG CREATION');
  const hasCreateButton = message.components.some((component) => {
    if (component.type !== ComponentType.ActionRow) return false;
    return component.components.some(
      (child) => child.type === ComponentType.Button && child.customId === CREATE_BUTTON_ID,
    );
  });
  return hasGuidedEmbed && hasCreateButton;
}

async function fetchGuidedPanelChannel(guild: Guild): Promise<TextChannel> {
  const channel = await guild.channels.fetch(GUIDED_LFG_CHANNEL_ID).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error(`The guided LFG channel <#${GUIDED_LFG_CHANNEL_ID}> is missing or is not a text channel.`);
  }
  return channel;
}

async function enforceGuidedPanelPermissions(channel: TextChannel): Promise<void> {
  const botMember = channel.guild.members.me ?? await channel.guild.members.fetchMe();
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: false,
    AddReactions: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false,
    SendMessagesInThreads: false,
  }, { reason: 'HIT guided LFG panel is read-only.' });
  await channel.permissionOverwrites.edit(botMember, {
    ViewChannel: true,
    SendMessages: true,
    EmbedLinks: true,
    ReadMessageHistory: true,
    ManageMessages: true,
  }, { reason: 'Allow HIT to maintain the guided LFG panel.' });
}

async function clearGuidedPanelChannel(channel: TextChannel): Promise<void> {
  let before: string | undefined;
  for (let page = 0; page < 10; page += 1) {
    const messages = before
      ? await channel.messages.fetch({ limit: 100, before })
      : await channel.messages.fetch({ limit: 100 });
    if (!messages.size) break;
    const oldest = messages.last();
    for (const existing of messages.values()) {
      await existing.delete().catch(() => undefined);
    }
    before = oldest?.id;
    if (messages.size < 100) break;
  }
}

async function postOnlyGuidedPanel(channel: TextChannel): Promise<void> {
  await enforceGuidedPanelPermissions(channel);
  await clearGuidedPanelChannel(channel);
  await channel.send({ embeds: [panelEmbed()], components: [panelControls()] });
}

export async function handleGuidedLfgChannelMessage(message: Message): Promise<boolean> {
  if (!message.guild || message.channelId !== GUIDED_LFG_CHANNEL_ID) return false;
  if (isGuidedPanelMessage(message)) return true;
  await message.delete().catch(() => undefined);
  return true;
}

function createModal(defaultExpiryMinutes: number): ModalBuilder {
  const game = new TextInputBuilder()
    .setCustomId('game')
    .setLabel('Game')
    .setPlaceholder('Fortnite, GTA V, Roblox, Call of Duty...')
    .setMinLength(2)
    .setMaxLength(50)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);
  const mode = new TextInputBuilder()
    .setCustomId('mode')
    .setLabel('Mode / Activity')
    .setPlaceholder('Ranked, Duos, Heist, Grinding, Customs...')
    .setMinLength(2)
    .setMaxLength(50)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);
  const platform = new TextInputBuilder()
    .setCustomId('platform')
    .setLabel('Platform')
    .setPlaceholder('PC, PlayStation, Xbox, Mobile, Crossplay...')
    .setMinLength(2)
    .setMaxLength(30)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);
  const region = new TextInputBuilder()
    .setCustomId('region')
    .setLabel('Region')
    .setPlaceholder('NA-East, NA-West, EU, OCE...')
    .setMinLength(2)
    .setMaxLength(30)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);
  const details = new TextInputBuilder()
    .setCustomId('details')
    .setLabel('Players, expiration, and notes')
    .setPlaceholder(`First line: 4 | ${defaultExpiryMinutes}\nThen add requirements or notes.`)
    .setMinLength(1)
    .setMaxLength(900)
    .setRequired(true)
    .setStyle(TextInputStyle.Paragraph);

  return new ModalBuilder()
    .setCustomId(CREATE_MODAL_ID)
    .setTitle('Create HIT LFG')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(game),
      new ActionRowBuilder<TextInputBuilder>().addComponents(mode),
      new ActionRowBuilder<TextInputBuilder>().addComponents(platform),
      new ActionRowBuilder<TextInputBuilder>().addComponents(region),
      new ActionRowBuilder<TextInputBuilder>().addComponents(details),
    );
}

function parseModalDetails(raw: string, defaultExpiryMinutes: number): Pick<LfgCreateInput, 'maxPlayers' | 'notes' | 'expiryMinutes'> {
  const lines = raw.trim().split(/\r?\n/);
  const first = lines.shift()?.trim() ?? '';
  const parts = first.split('|').map((part) => part.trim()).filter(Boolean);
  const maxPlayers = Number.parseInt(parts[0] ?? '', 10);
  const requestedExpiry = parts[1] ? Number.parseInt(parts[1], 10) : defaultExpiryMinutes;
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 20) {
    throw new Error('The first value must be a total player limit from 2 to 20. Example: 4 | 180');
  }
  if (!Number.isInteger(requestedExpiry) || requestedExpiry < MIN_EXPIRY_MINUTES || requestedExpiry > MAX_EXPIRY_MINUTES) {
    throw new Error(`Expiration must be ${MIN_EXPIRY_MINUTES}-${MAX_EXPIRY_MINUTES} minutes. Example: 4 | 180`);
  }
  const notes = cleanText(lines.join(' '), 800) || 'No additional requirements.';
  return { maxPlayers, notes, expiryMinutes: requestedExpiry };
}

function parsePrefixCreate(raw: string, defaultExpiryMinutes: number): LfgCreateInput {
  const fields = raw.split('|').map((field) => field.trim());
  if (fields.length < 5) {
    throw new Error('Usage: ;lfg create Game | Mode | Platform | Region | Players | Expiry minutes | Notes');
  }
  const maxPlayers = Number.parseInt(fields[4] ?? '', 10);
  const possibleExpiry = Number.parseInt(fields[5] ?? '', 10);
  const hasExplicitExpiry = Number.isInteger(possibleExpiry);
  const expiryCandidate = hasExplicitExpiry ? possibleExpiry : defaultExpiryMinutes;
  if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 20) throw new Error('Players must be a number from 2 to 20.');
  if (expiryCandidate < MIN_EXPIRY_MINUTES || expiryCandidate > MAX_EXPIRY_MINUTES) {
    throw new Error(`Expiration must be ${MIN_EXPIRY_MINUTES}-${MAX_EXPIRY_MINUTES} minutes.`);
  }
  return {
    game: cleanText(fields[0] ?? '', 50),
    mode: cleanText(fields[1] ?? '', 50),
    platform: cleanText(fields[2] ?? '', 30),
    region: cleanText(fields[3] ?? '', 30),
    maxPlayers,
    expiryMinutes: expiryCandidate,
    notes: cleanText(fields.slice(hasExplicitExpiry ? 6 : 5).join(' | '), 800) || 'No additional requirements.',
  };
}

function participantMentions(participants: LfgParticipant[]): string {
  if (!participants.length) return 'No one has joined yet.';
  return participants.map((participant) => `<@${participant.userId}>`).join(', ');
}

function buildLfgEmbed(post: LfgPost, participants: LfgParticipant[]): EmbedBuilder {
  const totalPlayers = 1 + participants.length;
  const closeLine = post.status === 'closed' || post.status === 'expired'
    ? `\n**Closed:** ${post.closeReason ?? statusLabel(post.status)}`
    : '';
  return new EmbedBuilder()
    .setColor(statusColor(post.status))
    .setTitle(`${post.game} | ${post.mode}`.slice(0, 256))
    .setDescription([
      `**Status:** ${statusLabel(post.status)}`,
      `**Owner:** <@${post.ownerId}>`,
      `**Platform:** ${post.platform}`,
      `**Region:** ${post.region}`,
      `**Players:** ${totalPlayers}/${post.maxPlayers}`,
      `**Expires:** <t:${Math.floor(post.expiresAt / 1000)}:R>`,
      '',
      `**Joined**\n${participantMentions(participants)}`,
      '',
      `**Requirements / Notes**\n${post.notes}${closeLine}`,
    ].join('\n'))
    .setFooter({ text: `HIT LFG #${post.id} | Created ${new Date(post.createdAt).toLocaleString()}` });
}

function postControls(post: LfgPost, participants: LfgParticipant[]): ActionRowBuilder<ButtonBuilder> {
  const totalPlayers = 1 + participants.length;
  if (post.status === 'closed' || post.status === 'expired') {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(REOPEN_BUTTON_ID).setLabel('Reopen').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(DELETE_BUTTON_ID).setLabel('Delete').setStyle(ButtonStyle.Danger),
    );
  }
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(JOIN_BUTTON_ID)
      .setLabel(post.status === 'full' ? `Full ${totalPlayers}/${post.maxPlayers}` : `Join ${totalPlayers}/${post.maxPlayers}`)
      .setStyle(post.status === 'full' ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(post.status === 'full'),
    new ButtonBuilder().setCustomId(LEAVE_BUTTON_ID).setLabel('Leave').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CLOSE_BUTTON_ID).setLabel('Close').setStyle(ButtonStyle.Danger),
  );
}

async function fetchForum(guild: Guild, settings: LfgSettings): Promise<ForumChannel> {
  const channel = await guild.channels.fetch(settings.forumChannelId);
  if (!channel || channel.type !== ChannelType.GuildForum) throw new Error('The configured LFG forum no longer exists.');
  return channel;
}

async function fetchThread(guild: Guild, threadId: string): Promise<ThreadChannel> {
  const channel = await guild.channels.fetch(threadId);
  if (!channel || !channel.isThread()) throw new Error('The LFG thread no longer exists.');
  return channel;
}

function wantedTagNames(post: Pick<LfgPost, 'game' | 'platform' | 'region' | 'status'>): string[] {
  return [post.game, post.platform, post.region, statusLabel(post.status), 'LFG']
    .map(normalizeTag)
    .filter(Boolean);
}

function initialTags(forum: ForumChannel, input: LfgCreateInput): string[] {
  const wanted = [input.game, input.platform, input.region, 'Open', 'LFG'].map(normalizeTag);
  const ids: string[] = [];
  for (const name of wanted) {
    const match = forum.availableTags.find((tag) => normalizeTag(tag.name) === name);
    if (match && !ids.includes(match.id)) ids.push(match.id);
    if (ids.length >= 5) break;
  }
  if (!ids.length && forum.availableTags.length) {
    const fallback = forum.availableTags[0];
    if (fallback) ids.push(fallback.id);
  }
  return ids;
}

async function updateThreadTags(thread: ThreadChannel, forum: ForumChannel, post: LfgPost): Promise<void> {
  const stateTagIds = forum.availableTags
    .filter((tag) => STATUS_TAG_NAMES.has(normalizeTag(tag.name)))
    .map((tag) => tag.id);
  const next = thread.appliedTags.filter((id) => !stateTagIds.includes(id));
  for (const wanted of wantedTagNames(post)) {
    const match = forum.availableTags.find((tag) => normalizeTag(tag.name) === wanted);
    if (match && !next.includes(match.id)) next.push(match.id);
    if (next.length >= 5) break;
  }
  if (!next.length && forum.availableTags.length) {
    const fallback = forum.availableTags[0];
    if (fallback) next.push(fallback.id);
  }
  await thread.setAppliedTags(next.slice(0, 5), `HIT LFG status changed to ${post.status}`).catch(() => undefined);
}

async function refreshPost(guild: Guild, settings: LfgSettings, post: LfgPost, store: Store): Promise<void> {
  const thread = await fetchThread(guild, post.threadId);
  const participants = store.listLfgParticipants(post.id);
  const starter = await thread.messages.fetch(post.starterMessageId).catch(() => null)
    ?? await thread.fetchStarterMessage().catch(() => null);
  if (starter) {
    await starter.edit({
      embeds: [buildLfgEmbed(post, participants)],
      components: [postControls(post, participants)],
      allowedMentions: { parse: [] },
    });
  }
  const forum = await fetchForum(guild, settings);
  await updateThreadTags(thread, forum, post);
}

async function sendLfgLog(guild: Guild, settings: LfgSettings, title: string, description: string, color = COLOR): Promise<void> {
  const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  await channel.send({
    embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()],
    allowedMentions: { parse: [] },
  }).catch(() => undefined);
}

async function createLfg(guild: Guild, ownerId: string, input: LfgCreateInput, store: Store): Promise<LfgPost> {
  const settings = requireLfgSettings(store, guild.id);
  const active = store.countActiveLfgPostsForOwner(guild.id, ownerId);
  if (active >= settings.maxOpenPerUser) {
    throw new Error(`You already have ${active} active LFG post(s). Close one before creating another.`);
  }
  const forum = await fetchForum(guild, settings);
  const expiresAt = Date.now() + input.expiryMinutes * 60_000;
  const temporaryEmbed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(`${input.game} | ${input.mode}`.slice(0, 256))
    .setDescription(`Creating HIT LFG for <@${ownerId}>...`);
  const thread = await forum.threads.create({
    name: `[${input.game}] [${input.region}] ${input.mode} | ${input.maxPlayers} players`.slice(0, 100),
    appliedTags: initialTags(forum, input),
    autoArchiveDuration: 1440,
    message: {
      content: `Owner: <@${ownerId}>`,
      embeds: [temporaryEmbed],
      allowedMentions: { parse: [] },
    },
    reason: `HIT LFG created by ${ownerId}`,
  });
  const starter = await thread.fetchStarterMessage();
  if (!starter) {
    await thread.delete('HIT could not resolve the LFG starter message').catch(() => undefined);
    throw new Error('HIT could not fetch the LFG starter message. Please try again.');
  }
  let post: LfgPost;
  try {
    post = store.createLfgPost({
      guildId: guild.id,
      threadId: thread.id,
      starterMessageId: starter.id,
      ownerId,
      game: input.game,
      mode: input.mode,
      platform: input.platform,
      region: input.region,
      notes: input.notes,
      maxPlayers: input.maxPlayers,
      expiresAt,
    });
  } catch (error) {
    await thread.delete('HIT rolled back failed LFG database creation').catch(() => undefined);
    throw error;
  }
  store.recordLfgEvent(post.id, guild.id, ownerId, 'lfg_created', { threadId: thread.id });
  await refreshPost(guild, settings, post, store);
  await sendLfgLog(guild, settings, 'LFG CREATED', `**Post:** #${post.id}\n**Owner:** <@${ownerId}>\n**Thread:** <#${thread.id}>\n**Game:** ${post.game}\n**Mode:** ${post.mode}`, 0x22c55e);
  return post;
}

function requireThreadPost(store: Store, threadId: string): LfgPost {
  const post = store.getLfgPostByThread(threadId);
  if (!post) throw new Error('This is not a tracked HIT LFG thread.');
  return post;
}

async function closePost(guild: Guild, member: GuildMember, post: LfgPost, store: Store, reason: string): Promise<LfgPost> {
  if (!canManageLfg(member, post)) throw new Error('Only the LFG owner or staff can close this post.');
  if (post.status === 'closed' || post.status === 'expired') throw new Error('This LFG post is already closed.');
  const settings = requireLfgSettings(store, guild.id);
  const updated = store.setLfgStatus(post.id, 'closed', member.id, reason);
  store.recordLfgEvent(post.id, guild.id, member.id, 'lfg_closed', { reason });
  await refreshPost(guild, settings, updated, store);
  const thread = await fetchThread(guild, post.threadId);
  await thread.setLocked(true, `HIT LFG closed: ${reason}`).catch(() => undefined);
  await thread.setArchived(true, `HIT LFG closed: ${reason}`).catch(() => undefined);
  await sendLfgLog(guild, settings, 'LFG CLOSED', `**Post:** #${post.id}\n**Actor:** <@${member.id}>\n**Thread:** <#${post.threadId}>\n**Reason:** ${reason}`, 0x64748b);
  return updated;
}

async function reopenPost(guild: Guild, member: GuildMember, post: LfgPost, store: Store): Promise<LfgPost> {
  if (!canManageLfg(member, post)) throw new Error('Only the LFG owner or staff can reopen this post.');
  if (post.status === 'open' || post.status === 'full') throw new Error('This LFG post is already active.');
  const settings = requireLfgSettings(store, guild.id);
  const thread = await fetchThread(guild, post.threadId);
  await thread.setArchived(false, 'HIT LFG reopened');
  await thread.setLocked(false, 'HIT LFG reopened');
  const currentPlayers = 1 + store.countLfgParticipants(post.id);
  const status: LfgStatus = currentPlayers >= post.maxPlayers ? 'full' : 'open';
  const updated = store.setLfgStatus(post.id, status, null, null, Date.now() + settings.defaultExpiryMinutes * 60_000);
  store.recordLfgEvent(post.id, guild.id, member.id, 'lfg_reopened');
  await refreshPost(guild, settings, updated, store);
  await sendLfgLog(guild, settings, 'LFG REOPENED', `**Post:** #${post.id}\n**Actor:** <@${member.id}>\n**Thread:** <#${post.threadId}>`, 0x22c55e);
  return updated;
}

async function showMine(guild: Guild, userId: string, store: Store): Promise<EmbedBuilder> {
  const posts = store.listActiveLfgPostsForOwner(guild.id, userId, 10);
  const description = posts.length
    ? posts.map((post) => `**#${post.id}** | ${post.game} / ${post.mode} | ${statusLabel(post.status)} | <#${post.threadId}>`).join('\n')
    : 'You do not have any active LFG posts.';
  return new EmbedBuilder().setColor(COLOR).setTitle('MY ACTIVE LFG POSTS').setDescription(description);
}

export async function handleHitLfgAdminCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<boolean> {
  if (!interaction.guildId || !interaction.guild || interaction.commandName !== 'hit') return false;
  const subcommand = interaction.options.getSubcommand();
  if (!subcommand.startsWith('lfg-')) return false;

  if (subcommand === 'lfg-setup') {
    const forum = interaction.options.getChannel('forum', true);
    const requestedPanelChannel = interaction.options.getChannel('panel_channel', true);
    const logChannel = interaction.options.getChannel('log_channel', true);
    if (forum.type !== ChannelType.GuildForum) throw new Error('The LFG destination must be a Forum channel.');
    if (requestedPanelChannel.id !== GUIDED_LFG_CHANNEL_ID) {
      throw new Error(`Choose <#${GUIDED_LFG_CHANNEL_ID}> as the LFG panel channel.`);
    }
    const panelChannel = await fetchGuidedPanelChannel(interaction.guild);
    if (logChannel.type !== ChannelType.GuildText) throw new Error('The log destination must be a text channel.');
    await enforceGuidedPanelPermissions(panelChannel);
    const existing = store.getLfgSettings(interaction.guildId);
    const settings = store.upsertLfgSettings({
      guildId: interaction.guildId,
      forumChannelId: forum.id,
      panelChannelId: panelChannel.id,
      logChannelId: logChannel.id,
      maxOpenPerUser: interaction.options.getInteger('max_open_per_user') ?? existing?.maxOpenPerUser ?? 2,
      defaultExpiryMinutes: interaction.options.getInteger('default_expiry_minutes') ?? existing?.defaultExpiryMinutes ?? 180,
    });
    await interaction.reply({
      content: `HIT LFG configured. Forum: <#${settings.forumChannelId}> | Panel: <#${settings.panelChannelId}> | Logs: <#${settings.logChannelId}>`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const settings = requireLfgSettings(store, interaction.guildId);
  if (subcommand === 'lfg-panel') {
    const requested = interaction.options.getChannel('channel');
    if (requested && requested.id !== GUIDED_LFG_CHANNEL_ID) {
      throw new Error(`The guided LFG panel can only be posted in <#${GUIDED_LFG_CHANNEL_ID}>.`);
    }
    const channel = await fetchGuidedPanelChannel(interaction.guild);
    await postOnlyGuidedPanel(channel);
    await interaction.reply({ content: `The guided LFG panel is now the only message in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (subcommand === 'lfg-config') {
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(COLOR)
        .setTitle('HIT LFG CONFIGURATION')
        .setDescription([
          `**Forum:** <#${settings.forumChannelId}>`,
          `**Guided panel:** <#${settings.panelChannelId}>`,
          `**Panel mode:** Read-only; non-panel messages are removed`,
          `**Logs:** <#${settings.logChannelId}>`,
          `**Maximum active posts per member:** ${settings.maxOpenPerUser}`,
          `**Default expiration:** ${settings.defaultExpiryMinutes} minutes`,
        ].join('\n'))],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (subcommand === 'lfg-diagnose') {
    const botMember = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
    const forum = await interaction.guild.channels.fetch(settings.forumChannelId).catch(() => null);
    const panel = await interaction.guild.channels.fetch(settings.panelChannelId).catch(() => null);
    const log = await interaction.guild.channels.fetch(settings.logChannelId).catch(() => null);
    const forumPermissions = forum?.permissionsFor(botMember);
    const panelPermissions = panel?.permissionsFor(botMember);
    const logPermissions = log?.permissionsFor(botMember);
    const checks = [
      { ok: forum?.type === ChannelType.GuildForum, label: 'LFG forum', detail: forum ? `Using #${forum.name}.` : 'Configured forum is missing.' },
      { ok: panel?.type === ChannelType.GuildText && panel.id === GUIDED_LFG_CHANNEL_ID, label: 'Guided panel channel', detail: panel ? `Using #${panel.name} (${panel.id}).` : 'Configured guided panel is missing.' },
      {
        ok: panel?.type === ChannelType.GuildText && panel.permissionOverwrites.cache.get(interaction.guild.roles.everyone.id)?.deny.has(PermissionFlagsBits.SendMessages) === true,
        label: 'Panel is read-only',
        detail: 'The @everyone role must be denied Send Messages in the guided panel channel.',
      },
      { ok: log?.type === ChannelType.GuildText, label: 'Log channel', detail: log ? `Using #${log.name}.` : 'Configured log channel is missing.' },
      {
        ok: Boolean(forumPermissions?.has([
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.CreatePublicThreads,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.ManageThreads,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ])),
        label: 'Forum permissions',
        detail: 'View, Send, Create Public Threads, Send in Threads, Manage Threads, Embed Links, and Read History are required.',
      },
      {
        ok: Boolean(panelPermissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])),
        label: 'Panel permissions',
        detail: 'View, Send, Embed Links, Manage Messages, and Read History are required.',
      },
      {
        ok: Boolean(logPermissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])),
        label: 'Log permissions',
        detail: 'View, Send, and Embed Links are required.',
      },
    ];
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(checks.every((check) => check.ok) ? 0x22c55e : 0xef4444)
        .setTitle('HIT LFG DIAGNOSTICS')
        .setDescription(checks.map((check) => `${check.ok ? 'PASS' : 'FAIL'} **${check.label}** - ${check.detail}`).join('\n'))],
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  return false;
}

export async function handleLfgSlashCommand(interaction: ChatInputCommandInteraction, store: Store): Promise<void> {
  if (!interaction.guildId || !interaction.guild) throw new Error('This command can only be used inside a server.');
  const subcommand = interaction.options.getSubcommand();
  const settings = requireLfgSettings(store, interaction.guildId);

  if (subcommand === 'create') {
    await interaction.showModal(createModal(settings.defaultExpiryMinutes));
    return;
  }
  if (subcommand === 'mine') {
    await interaction.reply({ embeds: [await showMine(interaction.guild, interaction.user.id, store)], flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.channelId) throw new Error('Use this command inside a HIT LFG thread.');
  const post = requireThreadPost(store, interaction.channelId);
  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (subcommand === 'status') {
    const participants = store.listLfgParticipants(post.id);
    await interaction.reply({ embeds: [buildLfgEmbed(post, participants)], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }
  if (subcommand === 'close') {
    const reason = interaction.options.getString('reason') ?? 'Closed by owner or staff.';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await closePost(interaction.guild, member, post, store, cleanText(reason, 300));
    await interaction.editReply('LFG closed.');
    return;
  }
  if (subcommand === 'reopen') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await reopenPost(interaction.guild, member, post, store);
    await interaction.editReply('LFG reopened with a fresh expiration timer.');
    return;
  }
  if (subcommand === 'delete') {
    if (!canManageLfg(member, post)) throw new Error('Only the LFG owner or staff can delete this post.');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(DELETE_CONFIRM_BUTTON_ID).setLabel('Permanently Delete').setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({ content: 'This permanently deletes the LFG thread and its stored record.', components: [row], flags: MessageFlags.Ephemeral });
  }
}

export async function handleLfgInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  store: Store,
): Promise<boolean> {
  if (!interaction.guildId || !interaction.guild) return false;

  if (interaction.isModalSubmit()) {
    if (interaction.customId !== CREATE_MODAL_ID) return false;
    const settings = requireLfgSettings(store, interaction.guildId);
    const details = parseModalDetails(interaction.fields.getTextInputValue('details'), settings.defaultExpiryMinutes);
    const input: LfgCreateInput = {
      game: cleanText(interaction.fields.getTextInputValue('game'), 50),
      mode: cleanText(interaction.fields.getTextInputValue('mode'), 50),
      platform: cleanText(interaction.fields.getTextInputValue('platform'), 30),
      region: cleanText(interaction.fields.getTextInputValue('region'), 30),
      ...details,
    };
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const post = await createLfg(interaction.guild, interaction.user.id, input, store);
    await interaction.editReply(`Your LFG is live: <#${post.threadId}>`);
    return true;
  }

  if (interaction.customId === CREATE_BUTTON_ID) {
    const settings = requireLfgSettings(store, interaction.guildId);
    await interaction.showModal(createModal(settings.defaultExpiryMinutes));
    return true;
  }
  if (interaction.customId === MINE_BUTTON_ID) {
    await interaction.reply({ embeds: [await showMine(interaction.guild, interaction.user.id, store)], flags: MessageFlags.Ephemeral });
    return true;
  }
  if (![JOIN_BUTTON_ID, LEAVE_BUTTON_ID, CLOSE_BUTTON_ID, REOPEN_BUTTON_ID, DELETE_BUTTON_ID, DELETE_CONFIRM_BUTTON_ID].includes(interaction.customId)) return false;
  if (!interaction.channelId) return false;
  const post = requireThreadPost(store, interaction.channelId);
  const settings = requireLfgSettings(store, interaction.guildId);
  const member = await interaction.guild.members.fetch(interaction.user.id);

  if (interaction.customId === JOIN_BUTTON_ID) {
    if (post.ownerId === member.id) throw new Error('You already own this LFG post.');
    if (post.status === 'closed' || post.status === 'expired') throw new Error('This LFG post is closed.');
    if (store.listLfgParticipants(post.id).some((participant) => participant.userId === member.id)) throw new Error('You already joined this LFG.');
    const currentPlayers = 1 + store.countLfgParticipants(post.id);
    if (currentPlayers >= post.maxPlayers) throw new Error('This LFG group is full.');
    store.addLfgParticipant(post.id, member.id);
    const nextPlayers = 1 + store.countLfgParticipants(post.id);
    if (nextPlayers > post.maxPlayers) {
      store.removeLfgParticipant(post.id, member.id);
      throw new Error('This LFG group filled before your join was processed.');
    }
    const updated = nextPlayers >= post.maxPlayers ? store.setLfgStatus(post.id, 'full') : post;
    store.recordLfgEvent(post.id, interaction.guildId, member.id, 'lfg_joined');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await refreshPost(interaction.guild, settings, updated, store);
    await interaction.editReply('You joined this LFG.');
    if (interaction.channel?.isThread()) {
      await interaction.channel.send({
        content: `<@${member.id}> joined. <@${post.ownerId}> now has ${nextPlayers}/${post.maxPlayers} players.`,
        allowedMentions: { users: [member.id, post.ownerId] },
      }).catch(() => undefined);
    }
    return true;
  }

  if (interaction.customId === LEAVE_BUTTON_ID) {
    if (post.status === 'closed' || post.status === 'expired') throw new Error('This LFG post is closed.');
    if (post.ownerId === member.id) throw new Error('The owner cannot leave their own LFG. Close it instead.');
    if (!store.removeLfgParticipant(post.id, member.id)) throw new Error('You are not in this LFG group.');
    const nextPlayers = 1 + store.countLfgParticipants(post.id);
    const updated = post.status === 'full' ? store.setLfgStatus(post.id, 'open') : post;
    store.recordLfgEvent(post.id, interaction.guildId, member.id, 'lfg_left');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await refreshPost(interaction.guild, settings, updated, store);
    await interaction.editReply('You left this LFG.');
    if (interaction.channel?.isThread()) {
      await interaction.channel.send({ content: `<@${member.id}> left the group. ${nextPlayers}/${post.maxPlayers} players remain.`, allowedMentions: { users: [member.id] } }).catch(() => undefined);
    }
    return true;
  }

  if (interaction.customId === CLOSE_BUTTON_ID) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await closePost(interaction.guild, member, post, store, 'Closed from the LFG controls.');
    await interaction.editReply('LFG closed.');
    return true;
  }

  if (interaction.customId === REOPEN_BUTTON_ID) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await reopenPost(interaction.guild, member, post, store);
    await interaction.editReply('LFG reopened.');
    return true;
  }

  if (interaction.customId === DELETE_BUTTON_ID) {
    if (!canManageLfg(member, post)) throw new Error('Only the LFG owner or staff can delete this post.');
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(DELETE_CONFIRM_BUTTON_ID).setLabel('Permanently Delete').setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({ content: 'Permanently delete this LFG thread?', components: [row], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (interaction.customId === DELETE_CONFIRM_BUTTON_ID) {
    if (!canManageLfg(member, post)) throw new Error('Only the LFG owner or staff can delete this post.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    store.recordLfgEvent(post.id, interaction.guildId, member.id, 'lfg_deleted');
    store.deleteLfgPost(post.id);
    await sendLfgLog(interaction.guild, settings, 'LFG DELETED', `**Post:** #${post.id}\n**Actor:** <@${member.id}>\n**Game:** ${post.game}\n**Mode:** ${post.mode}`, 0xef4444);
    await interaction.editReply('Deleting LFG thread...');
    if (interaction.channel?.isThread()) await interaction.channel.delete(`HIT LFG deleted by ${member.user.tag}`);
    return true;
  }

  return false;
}

export async function handleLfgPrefixCommand(message: Message, store: Store, defaultPrefix: string): Promise<void> {
  if (!message.guild || !message.member || message.author.bot) return;
  const prefix = store.getGuildSettings(message.guild.id)?.prefix ?? defaultPrefix;
  if (!message.content.startsWith(prefix)) return;
  const body = message.content.slice(prefix.length).trim();
  const firstSpace = body.indexOf(' ');
  const command = (firstSpace === -1 ? body : body.slice(0, firstSpace)).toLowerCase();
  if (command !== 'lfg') return;
  const rest = firstSpace === -1 ? '' : body.slice(firstSpace + 1).trim();
  const actionSpace = rest.indexOf(' ');
  const action = (actionSpace === -1 ? rest : rest.slice(0, actionSpace)).toLowerCase() || 'help';
  const payload = actionSpace === -1 ? '' : rest.slice(actionSpace + 1).trim();
  const settings = requireLfgSettings(store, message.guild.id);

  if (action === 'create') {
    const input = parsePrefixCreate(payload, settings.defaultExpiryMinutes);
    const post = await createLfg(message.guild, message.author.id, input, store);
    await message.reply(`Your LFG is live: <#${post.threadId}>`);
    return;
  }
  if (action === 'mine') {
    await message.reply({ embeds: [await showMine(message.guild, message.author.id, store)] });
    return;
  }
  if (!message.channel.isThread()) {
    const helpReply = await message.reply([
      `\`${prefix}lfg create Game | Mode | Platform | Region | Players | Expiry minutes | Notes\``,
      `\`${prefix}lfg mine\``,
      `Inside an LFG thread: \`${prefix}lfg status\`, \`${prefix}lfg close [reason]\`, \`${prefix}lfg reopen\``,
      `You can also use \`/lfg create\` for the guided form.`,
      '',
      'This help message will be removed automatically.',
    ].join('\n'));
    setTimeout(() => {
      void helpReply.delete().catch(() => undefined);
      void message.delete().catch(() => undefined);
    }, 15_000);
    return;
  }
  const post = requireThreadPost(store, message.channel.id);
  if (action === 'status') {
    await message.reply({ embeds: [buildLfgEmbed(post, store.listLfgParticipants(post.id))], allowedMentions: { parse: [] } });
    return;
  }
  if (action === 'close') {
    await message.reply('Closing this LFG...');
    await closePost(message.guild, message.member, post, store, cleanText(payload, 300) || 'Closed by owner or staff.');
    return;
  }
  if (action === 'reopen') {
    await reopenPost(message.guild, message.member, post, store);
    await message.reply('LFG reopened with a fresh expiration timer.');
    return;
  }
  await message.reply(`Use \`${prefix}lfg status\`, \`${prefix}lfg close [reason]\`, or \`${prefix}lfg reopen\` inside an LFG thread.`);
}

async function expirePost(client: Client, post: LfgPost, store: Store): Promise<void> {
  const guild = await client.guilds.fetch(post.guildId).catch(() => null);
  if (!guild) return;
  const settings = store.getLfgSettings(post.guildId);
  if (!settings) return;
  const current = store.getLfgPostById(post.guildId, post.id);
  if (!current || (current.status !== 'open' && current.status !== 'full') || current.expiresAt > Date.now()) return;
  const updated = store.setLfgStatus(post.id, 'expired', client.user?.id ?? 'HIT', 'Automatic expiration timer reached.');
  store.recordLfgEvent(post.id, post.guildId, client.user?.id ?? 'HIT', 'lfg_expired');
  await refreshPost(guild, settings, updated, store).catch(() => undefined);
  const thread = await guild.channels.fetch(post.threadId).catch(() => null);
  if (thread?.isThread()) {
    await thread.setLocked(true, 'HIT LFG expired').catch(() => undefined);
    await thread.setArchived(true, 'HIT LFG expired').catch(() => undefined);
  }
  await sendLfgLog(guild, settings, 'LFG EXPIRED', `**Post:** #${post.id}\n**Owner:** <@${post.ownerId}>\n**Thread:** <#${post.threadId}>`, 0xef4444);
}

export function startLfgWorker(client: Client, store: Store): NodeJS.Timeout {
  const run = async (): Promise<void> => {
    for (const post of store.listExpiredLfgPosts()) {
      try {
        await expirePost(client, post, store);
      } catch (error) {
        logger.warn('Failed to expire LFG post', { guildId: post.guildId, lfgId: post.id, error: String(error) });
      }
    }
  };
  void run();
  return setInterval(() => void run(), 60_000);
}

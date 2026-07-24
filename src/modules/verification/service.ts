import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  MessageFlags,
  ModalBuilder,
  ModalSubmitInteraction,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { logger } from '../../core/logger.js';
import type { GuildSettings, Store } from '../../core/store.js';
import { compareAnswer, generateCode, hashAnswer, renderCaptchaPng } from './captcha.js';
import { diagnoseGuild } from '../diagnostics/permissions.js';

const COLOR = 0x7c3aed;
const START_BUTTON_ID = 'hit:verify:start';
const ANSWER_BUTTON_ID = 'hit:verify:answer';
const ANSWER_MODAL_ID = 'hit:verify:submit';
const ANSWER_INPUT_ID = 'code';

function panelComponents(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(START_BUTTON_ID)
      .setLabel('Verify')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Primary),
  );
}

function answerComponents(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(ANSWER_BUTTON_ID)
      .setLabel('Enter Code')
      .setStyle(ButtonStyle.Success),
  );
}

function verificationPanelEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('VERIFICATION GATE')
    .setDescription([
      '**Access is restricted until verification is complete.**',
      '',
      'Press **Verify** and complete the security challenge.',
      '',
      '• Use your own Discord account.',
      '• Never share passwords or authentication codes.',
      '• Verification does not exempt anyone from the rules.',
    ].join('\n'))
    .setFooter({ text: 'HIT Security • One account. One verification.' });
}

function requireSettings(store: Store, guildId: string): GuildSettings {
  const settings = store.getGuildSettings(guildId);
  if (!settings) throw new Error('HIT verification is not configured for this server.');
  return settings;
}

async function fetchMember(guild: Guild, userId: string): Promise<GuildMember> {
  return guild.members.fetch(userId);
}

async function logToDiscord(guild: Guild, settings: GuildSettings, message: string): Promise<void> {
  if (!settings.verificationLogChannelId) return;
  const channel = await guild.channels.fetch(settings.verificationLogChannelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return;
  await channel.send({ embeds: [new EmbedBuilder().setColor(COLOR).setDescription(message).setTimestamp()] }).catch(() => undefined);
}

async function applyVerifiedRoles(member: GuildMember, settings: GuildSettings): Promise<void> {
  const botMember = member.guild.members.me ?? await member.guild.members.fetchMe();
  const verified = await member.guild.roles.fetch(settings.verifiedRoleId);
  const unverified = await member.guild.roles.fetch(settings.unverifiedRoleId);
  if (!verified || !unverified) throw new Error('The configured verification roles no longer exist.');
  if (botMember.roles.highest.comparePositionTo(verified) <= 0 || botMember.roles.highest.comparePositionTo(unverified) <= 0) {
    throw new Error('Move the HIT role above both YV and NV.');
  }

  const alreadyVerified = member.roles.cache.has(verified.id);
  if (!alreadyVerified) await member.roles.add(verified, 'HIT verification completed');

  try {
    if (member.roles.cache.has(unverified.id)) {
      await member.roles.remove(unverified, 'HIT verification completed');
    }
  } catch (error) {
    if (!alreadyVerified) {
      await member.roles.remove(verified, 'HIT verification rollback').catch(() => undefined);
    }
    throw error;
  }
}

export async function postVerificationPanel(guild: Guild, channelId: string): Promise<void> {
  const channel = await guild.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) throw new Error('Choose a standard text channel.');
  await channel.send({ embeds: [verificationPanelEmbed()], components: [panelComponents()] });
}

export async function onMemberJoin(member: GuildMember, store: Store): Promise<void> {
  if (member.user.bot) return;
  const settings = store.getGuildSettings(member.guild.id);
  if (!settings) return;
  const role = await member.guild.roles.fetch(settings.unverifiedRoleId).catch(() => null);
  if (!role) {
    logger.warn('Unverified role missing', { guildId: member.guild.id, roleId: settings.unverifiedRoleId });
    return;
  }
  try {
    await member.roles.add(role, 'HIT automatic unverified role');
    store.addPending(member.guild.id, member.id, member.joinedTimestamp ?? Date.now());
    store.recordEvent(member.guild.id, member.id, 'unverified_role_added');
  } catch (error) {
    logger.error('Failed to add unverified role', { guildId: member.guild.id, userId: member.id, error: String(error) });
  }
}

async function startChallenge(interaction: ButtonInteraction, store: Store): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;
  const settings = requireSettings(store, interaction.guildId);
  const member = await fetchMember(interaction.guild, interaction.user.id);

  if (member.roles.cache.has(settings.verifiedRoleId)) {
    if (member.roles.cache.has(settings.unverifiedRoleId)) {
      await applyVerifiedRoles(member, settings);
      store.clearPending(interaction.guildId, interaction.user.id);
      store.recordEvent(interaction.guildId, interaction.user.id, 'stale_unverified_role_removed');
      await interaction.reply({ content: '✓ You were already verified. The leftover NV role was removed.', flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: '✓ You are already verified.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  const ageMs = Date.now() - interaction.user.createdTimestamp;
  const requiredAgeMs = settings.minAccountAgeDays * 86_400_000;
  if (ageMs < requiredAgeMs) {
    store.recordEvent(interaction.guildId, interaction.user.id, 'account_too_new', { minDays: settings.minAccountAgeDays });
    await interaction.reply({ content: `✖ Your account must be at least ${settings.minAccountAgeDays} day(s) old.`, flags: MessageFlags.Ephemeral });
    return;
  }

  const state = store.getVerificationState(interaction.guildId, interaction.user.id);
  if (state?.lockedUntil && state.lockedUntil > Date.now()) {
    const seconds = Math.ceil((state.lockedUntil - Date.now()) / 1000);
    await interaction.reply({ content: `⚠ Too many failed attempts. Try again in ${seconds} seconds.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (state?.lockedUntil && state.lockedUntil <= Date.now()) store.resetFailures(interaction.guildId, interaction.user.id);

  const code = generateCode(5);
  const { hash, salt } = hashAnswer(code);
  store.saveChallenge(interaction.guildId, interaction.user.id, hash, salt, Date.now() + 5 * 60_000);
  store.recordEvent(interaction.guildId, interaction.user.id, 'challenge_started');

  const image = renderCaptchaPng(code);
  const attachment = new AttachmentBuilder(image, { name: 'hit-captcha.png' });
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle('SECURITY CHALLENGE')
    .setDescription('Read the five-character code, then press **Enter Code**. The challenge expires in five minutes.')
    .setImage('attachment://hit-captcha.png')
    .setFooter({ text: 'HIT will never ask for your password or authentication code.' });

  await interaction.reply({ embeds: [embed], files: [attachment], components: [answerComponents()], flags: MessageFlags.Ephemeral });
}

async function showAnswerModal(interaction: ButtonInteraction, store: Store): Promise<void> {
  if (!interaction.guildId) return;
  const state = store.getVerificationState(interaction.guildId, interaction.user.id);
  if (!state?.answerHash || !state.salt || !state.expiresAt || state.expiresAt <= Date.now()) {
    await interaction.reply({ content: '⚠ Your challenge expired. Press **Verify** again.', flags: MessageFlags.Ephemeral });
    return;
  }
  const modal = new ModalBuilder().setCustomId(ANSWER_MODAL_ID).setTitle('HIT Verification');
  const input = new TextInputBuilder()
    .setCustomId(ANSWER_INPUT_ID)
    .setLabel('Enter the five-character code')
    .setPlaceholder('Example: A7K3T')
    .setMinLength(5)
    .setMaxLength(8)
    .setRequired(true)
    .setStyle(TextInputStyle.Short);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function submitAnswer(interaction: ModalSubmitInteraction, store: Store): Promise<void> {
  if (!interaction.guildId || !interaction.guild) return;
  const settings = requireSettings(store, interaction.guildId);
  const state = store.getVerificationState(interaction.guildId, interaction.user.id);
  if (!state?.answerHash || !state.salt || !state.expiresAt || state.expiresAt <= Date.now()) {
    await interaction.reply({ content: '⚠ Your challenge expired. Press **Verify** again.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (state.lockedUntil && state.lockedUntil > Date.now()) {
    await interaction.reply({ content: '⚠ Verification is temporarily locked for this account.', flags: MessageFlags.Ephemeral });
    return;
  }

  const answer = interaction.fields.getTextInputValue(ANSWER_INPUT_ID);
  if (!compareAnswer(answer, state.salt, state.answerHash)) {
    const updated = store.recordFailure(interaction.guildId, interaction.user.id, settings.maxAttempts, settings.lockoutMinutes);
    store.recordEvent(interaction.guildId, interaction.user.id, 'challenge_failed');
    if (updated.lockedUntil && updated.lockedUntil > Date.now()) {
      await interaction.reply({ content: `✖ Incorrect. Verification is locked for ${settings.lockoutMinutes} minute(s).`, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content: '✖ Incorrect code. Press **Verify** to generate a new challenge.', flags: MessageFlags.Ephemeral });
    }
    return;
  }

  try {
    const member = await fetchMember(interaction.guild, interaction.user.id);
    await applyVerifiedRoles(member, settings);
    store.clearVerificationState(interaction.guildId, interaction.user.id);
    store.clearPending(interaction.guildId, interaction.user.id);
    store.recordEvent(interaction.guildId, interaction.user.id, 'verified');
    await logToDiscord(interaction.guild, settings, `✅ <@${interaction.user.id}> completed verification. NV removed; YV added.`);
    await interaction.reply({ content: '✓ Verified. The server is now unlocked.', flags: MessageFlags.Ephemeral });
  } catch (error) {
    store.recordEvent(interaction.guildId, interaction.user.id, 'verification_role_error', { error: String(error) });
    await interaction.reply({ content: `✖ Verification passed, but roles could not be updated: ${String(error)}`, flags: MessageFlags.Ephemeral });
  }
}

export async function handleVerificationInteraction(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  store: Store,
): Promise<boolean> {
  if (interaction.isButton() && interaction.customId === START_BUTTON_ID) {
    await startChallenge(interaction, store);
    return true;
  }
  if (interaction.isButton() && interaction.customId === ANSWER_BUTTON_ID) {
    await showAnswerModal(interaction, store);
    return true;
  }
  if (interaction.isModalSubmit() && interaction.customId === ANSWER_MODAL_ID) {
    await submitAnswer(interaction, store);
    return true;
  }
  return false;
}

export async function handleHitSlashCommand(interaction: ChatInputCommandInteraction, store: Store, defaultPrefix: string): Promise<void> {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({ content: 'This command can only be used inside a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'setup') {
    const member = await fetchMember(interaction.guild, interaction.user.id);
    if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: '✖ Manage Server is required.', flags: MessageFlags.Ephemeral });
      return;
    }
    const unverified = interaction.options.getRole('unverified_role', true);
    const verified = interaction.options.getRole('verified_role', true);
    const verificationChannel = interaction.options.getChannel('verification_channel', true);
    const logChannel = interaction.options.getChannel('log_channel');
    const minAge = interaction.options.getInteger('minimum_account_age_days') ?? 0;
    const timeout = interaction.options.getInteger('verification_timeout_minutes') ?? 0;
    if (unverified.id === verified.id) throw new Error('NV and YV must be different roles.');
    if (verificationChannel.type !== ChannelType.GuildText) throw new Error('Verification channel must be a standard text channel.');
    if (logChannel && logChannel.type !== ChannelType.GuildText) throw new Error('Log channel must be a standard text channel.');

    store.upsertGuildSettings({
      guildId: interaction.guildId,
      prefix: defaultPrefix,
      unverifiedRoleId: unverified.id,
      verifiedRoleId: verified.id,
      verificationChannelId: verificationChannel.id,
      verificationLogChannelId: logChannel?.id ?? null,
      minAccountAgeDays: minAge,
      maxAttempts: 5,
      lockoutMinutes: 15,
      verifyTimeoutMinutes: timeout,
    });
    await interaction.reply({
      content: [
        '✓ HIT verification configured.',
        `NV: <@&${unverified.id}>`,
        `YV: <@&${verified.id}>`,
        `Channel: <#${verificationChannel.id}>`,
        `Prefix: \`${defaultPrefix}\``,
        '',
        'Run `/hit diagnose`, then `/hit panel`.',
      ].join('\n'),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const settings = requireSettings(store, interaction.guildId);

  if (subcommand === 'panel') {
    const channel = interaction.options.getChannel('channel') ?? await interaction.guild.channels.fetch(settings.verificationChannelId);
    if (!channel || channel.type !== ChannelType.GuildText) throw new Error('Choose a standard text channel.');
    await postVerificationPanel(interaction.guild, channel.id);
    await interaction.reply({ content: `✓ Verification panel posted in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === 'diagnose') {
    const results = await diagnoseGuild(interaction.guild, settings);
    const description = results.map((item) => `${item.ok ? '✅' : '❌'} **${item.label}** — ${item.detail}`).join('\n');
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(results.every((item) => item.ok) ? 0x22c55e : 0xef4444).setTitle('HIT DIAGNOSTICS').setDescription(description)], flags: MessageFlags.Ephemeral });
    return;
  }

  if (subcommand === 'config') {
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(COLOR).setTitle('HIT VERIFICATION CONFIG').addFields(
        { name: 'Prefix', value: `\`${settings.prefix}\``, inline: true },
        { name: 'NV', value: `<@&${settings.unverifiedRoleId}>`, inline: true },
        { name: 'YV', value: `<@&${settings.verifiedRoleId}>`, inline: true },
        { name: 'Verification', value: `<#${settings.verificationChannelId}>`, inline: true },
        { name: 'Account age', value: `${settings.minAccountAgeDays} day(s)`, inline: true },
        { name: 'Timeout', value: settings.verifyTimeoutMinutes ? `${settings.verifyTimeoutMinutes} minutes` : 'Disabled', inline: true },
      )],
      flags: MessageFlags.Ephemeral,
    });
  }
}

export async function handlePrefixCommand(message: Message, store: Store, defaultPrefix: string): Promise<void> {
  if (!message.guild || message.author.bot) return;
  const settings = store.getGuildSettings(message.guild.id);
  const prefix = settings?.prefix ?? defaultPrefix;
  if (!message.content.startsWith(prefix)) return;
  const [rawCommand] = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = rawCommand?.toLowerCase();
  if (!command) return;

  if (command === 'version') {
    await message.reply('HIT v97.21.43');
    return;
  }
  if (command === 'ping') {
    await message.reply(`✓ ${message.client.ws.ping}ms`);
    return;
  }
  if (command === 'help') {
    await message.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('HIT v97.21.43 COMMANDS').setDescription([
      `\`${prefix}help\` — show commands`,
      `\`${prefix}version\` — show the running HIT version`,
      `\`${prefix}ping\` — connection check`,
      `\`${prefix}panel\` — post verification panel (Manage Server)`,
      `\`${prefix}diagnose\` — check verification permissions (Manage Server)`,
      `\`${prefix}ticket\` — open a general support ticket`,
      `\`${prefix}ticket open report\` — open a report ticket`,
      `\`${prefix}ticket close\` — close the current ticket`,
      `\`${prefix}warn @member reason\` — create a warning`,
      `\`${prefix}timeout @member 10m reason\` — timeout a member`,
      `\`${prefix}purge 25\` — clean recent messages`,
      `\`${prefix}lock\` / \`${prefix}unlock\` — control channel chat`,
      `\`${prefix}security\` — security status`,
      `\`${prefix}lockdown reason\` — emergency server lockdown`,
      `\`${prefix}unlockdown reason\` — restore saved permissions`,
      `\`${prefix}lfg\` — show LFG commands`,
      `\`${prefix}lfg mine\` — show your active LFG posts`,
      `\`${prefix}voice\` — show temporary voice room commands`,
      `\`${prefix}rank\` — show your XP rank`,
      `\`${prefix}leaderboard\` — show the XP leaderboard`,
      `\`${prefix}levels rewards\` — show level reward roles`,
      `\`${prefix}recreation active\` — show active giveaways and events`,
      `\`${prefix}giveaway active\` — show active giveaways`,
      `\`${prefix}event active\` — show scheduled events`,
      '',
      'Use `/hit` for core modules and `/recreation setup` for giveaways and events.',
    ].join('\n'))] });
    return;
  }
  if (command === 'panel' || command === 'diagnose') {
    if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await message.reply('✖ Manage Server is required.');
      return;
    }
    if (!settings) {
      await message.reply('✖ Run `/hit setup` first.');
      return;
    }
    if (command === 'panel') {
      await postVerificationPanel(message.guild, settings.verificationChannelId);
      await message.reply('✓ Verification panel posted.');
    } else {
      const results = await diagnoseGuild(message.guild, settings);
      await message.reply(results.map((item) => `${item.ok ? '✅' : '❌'} **${item.label}** — ${item.detail}`).join('\n'));
    }
  }
}

export function startVerificationTimeoutWorker(client: Client, store: Store): NodeJS.Timeout {
  return setInterval(async () => {
    for (const pending of store.getExpiredPending()) {
      try {
        const guild = await client.guilds.fetch(pending.guildId);
        const settings = store.getGuildSettings(pending.guildId);
        if (!settings) continue;
        const member = await guild.members.fetch(pending.userId).catch(() => null);
        if (!member) {
          store.clearPending(pending.guildId, pending.userId);
          continue;
        }
        if (member.roles.cache.has(settings.verifiedRoleId)) {
          store.clearPending(pending.guildId, pending.userId);
          continue;
        }
        await member.kick(`HIT verification not completed within ${pending.verifyTimeoutMinutes} minutes`);
        store.clearPending(pending.guildId, pending.userId);
        store.recordEvent(pending.guildId, pending.userId, 'verification_timeout_kick');
      } catch (error) {
        logger.warn('Verification timeout worker failed', { guildId: pending.guildId, userId: pending.userId, error: String(error) });
      }
    }
  }, 60_000);
}

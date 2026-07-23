import { ChannelType, Guild, GuildMember, PermissionFlagsBits, Role } from 'discord.js';
import type { GuildSettings } from '../../core/store.js';

export interface DiagnosticItem {
  ok: boolean;
  label: string;
  detail: string;
}

function manageable(botMember: GuildMember, role: Role): boolean {
  return !role.managed && role.id !== role.guild.id && botMember.roles.highest.comparePositionTo(role) > 0;
}

export async function diagnoseGuild(guild: Guild, settings: GuildSettings): Promise<DiagnosticItem[]> {
  const botMember = guild.members.me ?? await guild.members.fetchMe();
  const unverified = await guild.roles.fetch(settings.unverifiedRoleId);
  const verified = await guild.roles.fetch(settings.verifiedRoleId);
  const verificationChannel = await guild.channels.fetch(settings.verificationChannelId);
  const results: DiagnosticItem[] = [];

  results.push({
    ok: botMember.permissions.has(PermissionFlagsBits.ManageRoles),
    label: 'Manage Roles',
    detail: 'Required to add YV and remove NV.',
  });

  results.push({
    ok: Boolean(unverified && manageable(botMember, unverified)),
    label: 'Unverified role hierarchy',
    detail: unverified ? `HIT must be above ${unverified.name}.` : 'Configured role no longer exists.',
  });

  results.push({
    ok: Boolean(verified && manageable(botMember, verified)),
    label: 'Verified role hierarchy',
    detail: verified ? `HIT must be above ${verified.name}.` : 'Configured role no longer exists.',
  });

  const supportedChannel = verificationChannel && (
    verificationChannel.type === ChannelType.GuildText
    || verificationChannel.type === ChannelType.GuildAnnouncement
  );
  results.push({
    ok: Boolean(supportedChannel),
    label: 'Verification channel',
    detail: supportedChannel ? `Using #${verificationChannel.name}.` : 'Channel is missing or is not a text channel.',
  });

  if (supportedChannel) {
    const permissions = verificationChannel.permissionsFor(botMember);
    const required = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
    ];
    results.push({
      ok: Boolean(permissions?.has(required)),
      label: 'Verification channel permissions',
      detail: 'View, Send, Embed, Attach Files, and Read History are required.',
    });
  }

  if (settings.verifyTimeoutMinutes > 0) {
    results.push({
      ok: botMember.permissions.has(PermissionFlagsBits.KickMembers),
      label: 'Kick Members',
      detail: 'Required because verification timeout kicking is enabled.',
    });
  }

  return results;
}

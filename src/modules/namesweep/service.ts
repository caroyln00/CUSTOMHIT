import {
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import {
  getCategoryCount,
  getCategoryLabel,
  getTopCandidates,
  isNameSweepCategory,
} from './generator.js';

const COLOR = 0x7c3aed;
const PREVIEW_LIMIT = 25;
const MAX_REFRESH_GUILD_SIZE = 25_000;
const SNAPSHOT_TTL_MS = 10 * 60 * 1000;

interface VisibleUsernameSnapshot {
  expiresAt: number;
  usernames: Set<string>;
  guildsRefreshed: number;
  guildsCacheOnly: number;
}

let visibleUsernameSnapshot: VisibleUsernameSnapshot | null = null;

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

async function collectVisibleUsernames(
  interaction: ChatInputCommandInteraction,
): Promise<VisibleUsernameSnapshot> {
  const now = Date.now();

  if (visibleUsernameSnapshot && visibleUsernameSnapshot.expiresAt > now) {
    return visibleUsernameSnapshot;
  }

  const usernames = new Set<string>();
  let guildsRefreshed = 0;
  let guildsCacheOnly = 0;

  for (const user of interaction.client.users.cache.values()) {
    usernames.add(normalizeUsername(user.username));
  }

  for (const guild of interaction.client.guilds.cache.values()) {
    let refreshed = false;

    if (guild.memberCount <= MAX_REFRESH_GUILD_SIZE) {
      const members = await guild.members.fetch().catch(() => null);

      if (members) {
        refreshed = true;
        guildsRefreshed += 1;

        for (const member of members.values()) {
          usernames.add(normalizeUsername(member.user.username));
        }
      }
    }

    if (!refreshed) {
      guildsCacheOnly += 1;

      for (const member of guild.members.cache.values()) {
        usernames.add(normalizeUsername(member.user.username));
      }
    }
  }

  visibleUsernameSnapshot = {
    expiresAt: now + SNAPSHOT_TTL_MS,
    usernames,
    guildsRefreshed,
    guildsCacheOnly,
  };

  return visibleUsernameSnapshot;
}

export async function handleNameSweepSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const rawCategory = interaction.options.getString('category', true);

  if (!isNameSweepCategory(rawCategory)) {
    throw new Error('Choose a valid name-sweep category.');
  }

  const requestedCount = interaction.options.getInteger('count') ?? 25;
  const count = Math.max(1, Math.min(1000, requestedCount));

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const visible = await collectVisibleUsernames(interaction);
  const poolSize = Math.min(1000, Math.max(count, count * 5));
  const rankedPool = getTopCandidates(rawCategory, poolSize);

  const confirmedVisible = rankedPool.filter((candidate) =>
    visible.usernames.has(normalizeUsername(candidate.name)),
  );

  const candidates = rankedPool
    .filter((candidate) => !visible.usernames.has(normalizeUsername(candidate.name)))
    .slice(0, count);

  const preview = candidates.slice(0, PREVIEW_LIMIT);
  const description = preview.length > 0
    ? preview
      .map(
        (candidate, index) =>
          `**${index + 1}.** \`${candidate.name}\` | estimated chance ${candidate.score}/100`,
      )
      .join('\n')
    : 'No names remained after checking the usernames currently visible to HIT.';

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`HIT NAME SWEEP - ${getCategoryLabel(rawCategory).toUpperCase()}`)
    .setDescription(description)
    .addFields(
      {
        name: 'Candidate pool',
        value:
          `${getCategoryCount(rawCategory).toLocaleString('en-US')} mathematical possibilities. ` +
          `${rankedPool.length.toLocaleString('en-US')} top candidates inspected.`,
      },
      {
        name: 'Discord visibility check',
        value:
          `${visible.usernames.size.toLocaleString('en-US')} visible usernames scanned. ` +
          `${confirmedVisible.length.toLocaleString('en-US')} exact match(es) removed. ` +
          `${visible.guildsRefreshed} server member list(s) refreshed; ` +
          `${visible.guildsCacheOnly} used cached members.`,
      },
    )
    .setFooter({
      text: 'Exact visible matches are removed. Remaining names are not seen by HIT, not guaranteed available.',
    })
    .setTimestamp();

  const files: AttachmentBuilder[] = [];

  if (candidates.length > PREVIEW_LIMIT) {
    const report = [
      `HIT NAME SWEEP - ${getCategoryLabel(rawCategory)}`,
      `Generated: ${new Date().toISOString()}`,
      `Visible usernames scanned: ${visible.usernames.size}`,
      `Exact visible matches removed: ${confirmedVisible.length}`,
      'Status: NOT SEEN BY HIT - NOT GUARANTEED AVAILABLE',
      '',
      ...candidates.map(
        (candidate, index) =>
          `${String(index + 1).padStart(4, '0')} | ${candidate.name} | estimate ${candidate.score}/100`,
      ),
      '',
    ].join('\n');

    files.push(
      new AttachmentBuilder(Buffer.from(report, 'utf8'), {
        name: `namesweep-${rawCategory}-${candidates.length}.txt`,
      }),
    );
  }

  await interaction.editReply({
    embeds: [embed],
    files,
  });
}

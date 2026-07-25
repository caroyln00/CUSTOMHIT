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
import {
  checkExternalPlatforms,
  isNameCheckPlatform,
  type PlatformLookupResult,
} from './platforms.js';

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

const LOOKUP_STATUS_LABELS: Record<PlatformLookupResult['status'], string> = {
  found: 'FOUND / TAKEN',
  not_found: 'NO PUBLIC ACCOUNT',
  unknown: 'UNKNOWN',
  invalid: 'INVALID NAME',
  error: 'CHECK FAILED',
};

function formatLookupLine(result: PlatformLookupResult): string {
  const profile = result.profileUrl
    ? ` [Open](${result.profileUrl})`
    : '';

  return `**${result.label}: ${LOOKUP_STATUS_LABELS[result.status]}**${profile}`;
}

export async function handleNameCheckSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const username = interaction.options
    .getString('username', true)
    .replace(/[\r\n\t]/g, ' ')
    .trim();

  const rawPlatform = interaction.options.getString('platform') ?? 'all';

  if (username.length < 1 || username.length > 64) {
    throw new Error('The username must contain between 1 and 64 characters.');
  }

  if (!isNameCheckPlatform(rawPlatform)) {
    throw new Error('Choose a valid lookup platform.');
  }

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const results: PlatformLookupResult[] = [];

  if (rawPlatform === 'all' || rawPlatform === 'discord') {
    const visible = await collectVisibleUsernames(interaction);
    const found = visible.usernames.has(normalizeUsername(username));

    results.push({
      platform: 'discord',
      label: 'Discord',
      status: found ? 'found' : 'unknown',
      detail: found
        ? `An exact username match is visible to HIT among ${visible.usernames.size.toLocaleString('en-US')} cached or refreshed Discord users.`
        : `No exact match was visible among ${visible.usernames.size.toLocaleString('en-US')} users. This does not prove global Discord availability.`,
    });
  }

  if (rawPlatform !== 'discord') {
    results.push(...await checkExternalPlatforms(username, rawPlatform));
  }

  const counts = {
    found: results.filter((result) => result.status === 'found').length,
    notFound: results.filter((result) => result.status === 'not_found').length,
    unknown: results.filter((result) =>
      ['unknown', 'invalid', 'error'].includes(result.status),
    ).length,
  };

  const selectedDetail = rawPlatform === 'all'
    ? 'Run a single-platform check to see its full explanation.'
    : results[0]?.detail ?? 'No lookup result was returned.';

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`HIT NAME CHECK - ${username}`)
    .setDescription(results.map(formatLookupLine).join('\n'))
    .addFields(
      {
        name: 'Summary',
        value:
          `${counts.found} found/taken | ` +
          `${counts.notFound} no public account | ` +
          `${counts.unknown} unknown/blocked`,
      },
      {
        name: 'Result details',
        value: selectedDetail.slice(0, 1024),
      },
    )
    .setFooter({
      text: 'NO PUBLIC ACCOUNT and UNKNOWN do not guarantee that a name can be registered.',
    })
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
  });
}
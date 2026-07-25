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
const MAX_RESULTS = 1000;

export async function handleNameSweepSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const rawCategory = interaction.options.getString('category', true);

  if (!isNameSweepCategory(rawCategory)) {
    throw new Error('Choose a valid name-sweep category.');
  }

  const requestedCount = interaction.options.getInteger('count') ?? 25;
  const count = Math.max(1, Math.min(MAX_RESULTS, requestedCount));

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const candidates = getTopCandidates(rawCategory, count);
  const preview = candidates.slice(0, PREVIEW_LIMIT);

  const description = preview
    .map(
      (candidate, index) =>
        `**${index + 1}.** \`${candidate.name}\` - availability estimate ` +
        `**${candidate.score}/100**`,
    )
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`HIT NAME SWEEP - ${getCategoryLabel(rawCategory).toUpperCase()}`)
    .setDescription(description || 'No candidates were generated.')
    .addFields(
      {
        name: 'Mathematical candidate pool',
        value:
          `Ranked ${candidates.length.toLocaleString('en-US')} candidate(s) from ` +
          `${getCategoryCount(rawCategory).toLocaleString('en-US')} possibilities.`,
      },
      {
        name: 'Ranking model',
        value:
          'Uses category scarcity, character popularity, Shannon entropy, ' +
          'diversity, repetition, sequences, common language patterns, ' +
          'numeric patterns, pronounceability demand, and deterministic tie-breaking.',
      },
    )
    .setFooter({
      text:
        'Estimate only - this is not a live Discord username availability check',
    })
    .setTimestamp();

  const files: AttachmentBuilder[] = [];

  if (candidates.length > PREVIEW_LIMIT) {
    const reportLines = [
      'HIT NAME SWEEP',
      `Category: ${getCategoryLabel(rawCategory)}`,
      `Requested: ${count}`,
      `Generated: ${candidates.length}`,
      `Candidate pool: ${getCategoryCount(rawCategory)}`,
      '',
      'IMPORTANT: Scores are mathematical estimates, not confirmed Discord availability.',
      '',
      'Rank\tName\tEstimate\tEntropy\tDemand penalty\tPronounceable',
      ...candidates.map(
        (candidate, index) =>
          `${index + 1}\t${candidate.name}\t${candidate.score}/100\t` +
          `${candidate.entropy}\t${candidate.demandPenalty}\t` +
          `${candidate.pronounceable ? 'yes' : 'no'}`,
      ),
    ];

    files.push(
      new AttachmentBuilder(Buffer.from(reportLines.join('\n'), 'utf8'), {
        name: `namesweep-${rawCategory}-${candidates.length}.txt`,
      }),
    );
  }

  await interaction.editReply({
    embeds: [embed],
    files,
  });
}
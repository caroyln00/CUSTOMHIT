import {
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

export async function handleNameSweepSlashCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const rawCategory = interaction.options.getString('category', true);

  if (!isNameSweepCategory(rawCategory)) {
    throw new Error('Choose a valid name-sweep category.');
  }

  const count = interaction.options.getInteger('count') ?? 25;

  await interaction.deferReply({
    flags: MessageFlags.Ephemeral,
  });

  const candidates = getTopCandidates(rawCategory, count);

  const description = candidates
    .map(
      (candidate, index) =>
        `**${index + 1}.** \`${candidate.name}\` — score ${candidate.score}`,
    )
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`HIT NAME SWEEP — ${getCategoryLabel(rawCategory).toUpperCase()}`)
    .setDescription(description)
    .addFields({
      name: 'Local candidate pool',
      value:
        `Showing ${candidates.length} ranked candidates from ` +
        `${getCategoryCount(rawCategory).toLocaleString('en-US')} possibilities.`,
    })
    .setFooter({
      text: 'Local generation only • Username availability is not checked',
    })
    .setTimestamp();

  await interaction.editReply({
    embeds: [embed],
  });
}
import {
  EmbedBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type User,
} from 'discord.js';

const COLOR = 0x8b5cf6;
const GOOD = 0x22c55e;
const BAD = 0xef4444;

const EIGHT_BALL = [
  'Yes.', 'Definitely.', 'Without a doubt.', 'Most likely.', 'Signs point to yes.',
  'Ask again later.', 'I cannot tell you yet.', 'Maybe.', 'Do not count on it.',
  'Probably not.', 'No.', 'Absolutely not.',
] as const;

const TRUTHS = [
  'What is the most embarrassing song in your playlist?',
  'What is a harmless secret you have never told the server?',
  'What was your worst gaming rage moment?',
  'Who was your first fictional crush?',
  'What is the weirdest food combination you actually like?',
  'What is the longest you have stayed awake gaming?',
  'What is a skill you pretend to be better at than you are?',
  'What is your most-used excuse?',
] as const;

const DARES = [
  'Use only GIFs for your next three replies.',
  'Change your nickname to “Certified NPC” for ten minutes.',
  'Send the last clean meme saved on your device.',
  'Type your next message with your eyes closed.',
  'Compliment the last person who messaged in this channel.',
  'Use a dramatic narrator voice in VC for two minutes.',
  'Let the server choose your status for ten minutes.',
  'Post your most-played song this week.',
] as const;

const WOULD_YOU_RATHER = [
  'Have perfect aim but terrible movement, or perfect movement but terrible aim?',
  'Only play one game forever, or never replay the same game twice?',
  'Lose your entire inventory, or lose your highest rank?',
  'Always have 200 ping, or always play at 30 FPS?',
  'Be famous online but anonymous in real life, or famous in real life but unknown online?',
  'Get every cosmetic for one game, or every game for free?',
  'Always know when someone is lying, or always get away with lying?',
  'Have unlimited money for clothes, or unlimited money for gaming equipment?',
] as const;

const COMPLIMENTS = [
  'has elite taste.', 'is carrying the server’s aura.', 'is genuinely easy to respect.',
  'has main-character confidence.', 'makes the chat better by being here.',
  'has top-tier energy.', 'is built different in the best way.',
  'has a rare combination of style and personality.',
] as const;

const ROASTS = [
  'loads into the match after the scoreboard appears.',
  'has aim assist turned on in real life and still misses.',
  'treats the tutorial like ranked finals.',
  'could lose a 1v1 against the settings menu.',
  'has a reaction time measured in business days.',
  'brings spectator-mode energy to every conversation.',
  'would blame ping during an offline game.',
  'has more excuses than completed missions.',
] as const;

const TRIVIA = [
  { q: 'What planet is known as the Red Planet?', a: 'Mars' },
  { q: 'What is the largest ocean on Earth?', a: 'The Pacific Ocean' },
  { q: 'How many sides does a dodecagon have?', a: '12' },
  { q: 'What does CPU stand for?', a: 'Central Processing Unit' },
  { q: 'Which chess piece can only move diagonally?', a: 'The bishop' },
  { q: 'What year did the first iPhone release?', a: '2007' },
  { q: 'What is the chemical symbol for gold?', a: 'Au' },
  { q: 'Which country is home to the city of Kyoto?', a: 'Japan' },
  { q: 'What is the square root of 144?', a: '12' },
  { q: 'What gas do plants absorb from the atmosphere?', a: 'Carbon dioxide' },
] as const;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function stableScore(input: string): number {
  let hash = 2166136261;
  for (const char of input) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 101;
}

function progressBar(score: number): string {
  const filled = Math.round(score / 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

function userName(user: User): string {
  return user.globalName ?? user.username;
}

export async function handleFunSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (interaction.commandName !== 'fun') return;
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === '8ball') {
    const question = interaction.options.getString('question', true);
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('MAGIC 8-BALL').addFields(
      { name: 'Question', value: question.slice(0, 1024) },
      { name: 'Answer', value: pick(EIGHT_BALL) },
    )] });
    return;
  }

  if (subcommand === 'coinflip') {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    await interaction.reply(`🪙 **${result}**`);
    return;
  }

  if (subcommand === 'dice') {
    const sides = interaction.options.getInteger('sides') ?? 6;
    const count = interaction.options.getInteger('count') ?? 1;
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((sum, value) => sum + value, 0);
    await interaction.reply(`🎲 Rolled ${count}d${sides}: **${rolls.join(', ')}**${count > 1 ? ` — total **${total}**` : ''}`);
    return;
  }

  if (subcommand === 'choose') {
    const raw = interaction.options.getString('options', true);
    const choices = raw.split('|').map((item) => item.trim()).filter(Boolean).slice(0, 30);
    if (choices.length < 2) throw new Error('Separate at least two choices with `|`.');
    await interaction.reply(`I choose: **${pick(choices).slice(0, 200)}**`);
    return;
  }

  if (subcommand === 'random') {
    const min = interaction.options.getInteger('min') ?? 1;
    const max = interaction.options.getInteger('max') ?? 100;
    if (min > max) throw new Error('Minimum cannot be greater than maximum.');
    const number = Math.floor(Math.random() * (max - min + 1)) + min;
    await interaction.reply(`🔢 Random number: **${number}**`);
    return;
  }

  if (subcommand === 'rate') {
    const thing = interaction.options.getString('thing', true).trim();
    const score = stableScore(`${interaction.guildId ?? 'dm'}:${thing.toLowerCase()}`);
    await interaction.reply(`**${thing.slice(0, 150)}** gets **${score}/100**\n${progressBar(score)}`);
    return;
  }

  if (subcommand === 'ship') {
    const first = interaction.options.getUser('first', true);
    const second = interaction.options.getUser('second', true);
    const ids = [first.id, second.id].sort().join(':');
    const score = first.id === second.id ? 100 : stableScore(ids);
    const verdict = score >= 90 ? 'Perfect match' : score >= 70 ? 'Strong chemistry' : score >= 45 ? 'There is potential' : score >= 20 ? 'Complicated' : 'Better as friends';
    await interaction.reply({ embeds: [new EmbedBuilder()
      .setColor(score >= 60 ? GOOD : score >= 35 ? COLOR : BAD)
      .setTitle('SHIP METER')
      .setDescription(`**${userName(first)} × ${userName(second)}**\n${progressBar(score)} **${score}%**\n${verdict}`)] });
    return;
  }

  if (subcommand === 'rps') {
    const player = interaction.options.getString('choice', true) as 'rock' | 'paper' | 'scissors';
    const bot = pick(['rock', 'paper', 'scissors'] as const);
    const beats: Record<typeof player, typeof player> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
    const result = player === bot ? 'Tie.' : beats[player] === bot ? 'You win.' : 'HIT wins.';
    await interaction.reply(`You chose **${player}**. HIT chose **${bot}**. **${result}**`);
    return;
  }

  if (subcommand === 'slots') {
    const symbols = ['🍒', '🍋', '💎', '7️⃣', '🔔', '⭐'] as const;
    const result = [pick(symbols), pick(symbols), pick(symbols)];
    const win = result[0] === result[1] && result[1] === result[2];
    await interaction.reply(`🎰 ┃ ${result.join(' ┃ ')} ┃\n**${win ? 'JACKPOT!' : 'Try again.'}**`);
    return;
  }

  if (subcommand === 'trivia') {
    const item = pick(TRIVIA);
    await interaction.reply(`🧠 **Trivia:** ${item.q}\nAnswer: ||${item.a}||`);
    return;
  }

  if (subcommand === 'wyr') {
    await interaction.reply(`🤔 **Would you rather…**\n${pick(WOULD_YOU_RATHER)}`);
    return;
  }

  if (subcommand === 'truth') {
    await interaction.reply(`🗣️ **Truth:** ${pick(TRUTHS)}`);
    return;
  }

  if (subcommand === 'dare') {
    await interaction.reply(`🔥 **Dare:** ${pick(DARES)}`);
    return;
  }

  if (subcommand === 'compliment' || subcommand === 'roast') {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const text = subcommand === 'compliment' ? pick(COMPLIMENTS) : pick(ROASTS);
    await interaction.reply(`${target} ${text}`);
    return;
  }

  if (subcommand === 'avatar') {
    const target = interaction.options.getUser('user') ?? interaction.user;
    await interaction.reply({ embeds: [new EmbedBuilder()
      .setColor(COLOR)
      .setTitle(`${userName(target)}'s avatar`)
      .setImage(target.displayAvatarURL({ size: 1024 }))] });
    return;
  }

  await interaction.reply({ content: 'Unknown fun command.', flags: MessageFlags.Ephemeral });
}

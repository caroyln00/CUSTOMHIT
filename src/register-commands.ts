import { REST, Routes } from 'discord.js';
import { env } from './core/env.js';
import { logger } from './core/logger.js';
import { slashCommands } from './commands/slash.js';

const rest = new REST({ version: '10' }).setToken(env.token);

try {
  if (env.guildId) {
    await rest.put(Routes.applicationGuildCommands(env.clientId, env.guildId), { body: slashCommands });
    logger.info('Registered development guild commands', { guildId: env.guildId, count: slashCommands.length });
  } else {
    await rest.put(Routes.applicationCommands(env.clientId), { body: slashCommands });
    logger.info('Registered global commands', { count: slashCommands.length });
  }
} catch (error) {
  logger.error('Command registration failed', { error: String(error) });
  process.exitCode = 1;
}

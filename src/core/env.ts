import 'dotenv/config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

const logLevel = (optional('LOG_LEVEL') ?? 'info') as LogLevel;
if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
  throw new Error('LOG_LEVEL must be debug, info, warn, or error.');
}

export const env = Object.freeze({
  token: required('DISCORD_BOT_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: optional('DISCORD_GUILD_ID'),
  defaultPrefix: optional('HIT_PREFIX') ?? ';',
  databasePath: optional('DATABASE_PATH') ?? './data/hit.sqlite',
  logLevel,
});

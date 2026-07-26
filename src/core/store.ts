import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface GuildSettings {
  guildId: string;
  prefix: string;
  unverifiedRoleId: string;
  verifiedRoleId: string;
  verificationChannelId: string;
  verificationLogChannelId: string | null;
  minAccountAgeDays: number;
  maxAttempts: number;
  lockoutMinutes: number;
  verifyTimeoutMinutes: number;
  updatedAt: number;
}

export interface VerificationState {
  guildId: string;
  userId: string;
  answerHash: string | null;
  salt: string | null;
  expiresAt: number | null;
  failures: number;
  lockedUntil: number | null;
  updatedAt: number;
}

export interface ExpiredPendingVerification {
  guildId: string;
  userId: string;
  verifyTimeoutMinutes: number;
}

export interface TicketSettings {
  guildId: string;
  categoryId: string;
  panelChannelId: string;
  supportRoleId: string;
  logChannelId: string;
  maxOpenPerUser: number;
  updatedAt: number;
}

export type TicketStatus = 'open' | 'closed';


export interface ModerationSettings {
  guildId: string;
  logChannelId: string;
  updatedAt: number;
}

export interface ModerationCase {
  id: number;
  guildId: string;
  moderatorId: string;
  targetId: string | null;
  action: string;
  reason: string;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface WarningRecord {
  id: number;
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: number;
  clearedAt: number | null;
  clearedBy: string | null;
}


export interface SecuritySettings {
  guildId: string;
  logChannelId: string;
  quarantineRoleId: string | null;
  antiSpamEnabled: boolean;
  antiPhishingEnabled: boolean;
  antiRaidEnabled: boolean;
  antiNukeEnabled: boolean;
  autoLockdownEnabled: boolean;
  spamMessageLimit: number;
  spamWindowSeconds: number;
  duplicateMessageLimit: number;
  mentionLimit: number;
  autoTimeoutMinutes: number;
  raidJoinLimit: number;
  raidWindowSeconds: number;
  nukeActionLimit: number;
  nukeWindowSeconds: number;
  lockdownMinutes: number;
  updatedAt: number;
}

export interface SecurityEventRecord {
  id: number;
  guildId: string;
  actorId: string | null;
  targetId: string | null;
  eventType: string;
  severity: string;
  detail: Record<string, unknown> | null;
  createdAt: number;
}

export interface SecurityLockdown {
  guildId: string;
  active: boolean;
  actorId: string;
  reason: string;
  startedAt: number;
  expiresAt: number | null;
}

export interface LockdownSnapshot {
  guildId: string;
  channelId: string;
  overwriteExisted: boolean;
  permissions: Record<string, boolean | null>;
}








export interface CommunitySettings {
  guildId: string;
  logChannelId: string;
  currencyName: string;
  startingBalance: number;
  dailyReward: number;
  dailyCooldownHours: number;
  workMin: number;
  workMax: number;
  workCooldownMinutes: number;
  countingChannelId: string | null;
  countingResetOnMistake: boolean;
  countingDeleteInvalid: boolean;
  starboardChannelId: string | null;
  starThreshold: number;
  starEmoji: string;
  allowSelfStar: boolean;
  updatedAt: number;
}

export interface EconomyAccount {
  guildId: string;
  userId: string;
  balance: number;
  lastDailyAt: number | null;
  lastWorkAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface EconomyClaimResult {
  account: EconomyAccount;
  claimed: boolean;
  amount: number;
  nextAt: number | null;
}

export interface EconomyTransferResult {
  sender: EconomyAccount;
  recipient: EconomyAccount;
  amount: number;
}

export interface CountingState {
  guildId: string;
  currentNumber: number;
  lastUserId: string | null;
  currentMessageId: string | null;
  highScore: number;
  updatedAt: number;
}

export type CountProcessStatus = 'accepted' | 'wrong' | 'same_user';

export interface CountProcessResult {
  status: CountProcessStatus;
  expected: number;
  state: CountingState;
  reset: boolean;
}

export interface StarboardRecord {
  guildId: string;
  sourceMessageId: string;
  sourceChannelId: string;
  starboardMessageId: string;
  authorId: string;
  starCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface RecreationSettings {
  guildId: string;
  giveawayChannelId: string;
  eventChannelId: string;
  logChannelId: string;
  notificationRoleId: string | null;
  defaultGiveawayMinutes: number;
  defaultEventReminderMinutes: number;
  updatedAt: number;
}

export type GiveawayStatus = 'active' | 'ended' | 'cancelled';

export interface GiveawayRecord {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string;
  hostId: string;
  prize: string;
  description: string;
  winnerCount: number;
  requiredRoleId: string | null;
  minimumLevel: number;
  status: GiveawayStatus;
  createdAt: number;
  endsAt: number;
  endedAt: number | null;
  endedBy: string | null;
}

export interface GiveawayEntry {
  giveawayId: number;
  userId: string;
  enteredAt: number;
}

export interface GiveawayWinner {
  giveawayId: number;
  userId: string;
  drawNumber: number;
  selectedAt: number;
}

export type RecreationEventStatus = 'scheduled' | 'completed' | 'cancelled';
export type RecreationEventResponse = 'going' | 'maybe' | 'declined';

export interface RecreationEventRecord {
  id: number;
  guildId: string;
  channelId: string;
  messageId: string;
  hostId: string;
  title: string;
  description: string;
  location: string;
  capacity: number;
  status: RecreationEventStatus;
  startsAt: number;
  endsAt: number;
  reminderMinutes: number;
  reminderSent: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RecreationEventRsvp {
  eventId: number;
  userId: string;
  response: RecreationEventResponse;
  updatedAt: number;
}

export interface LevelSettings {
  guildId: string;
  enabled: boolean;
  announceChannelId: string | null;
  logChannelId: string;
  messageXpMin: number;
  messageXpMax: number;
  messageCooldownSeconds: number;
  voiceXpPerMinute: number;
  voiceMinMembers: number;
  announceLevelUps: boolean;
  stackRewardRoles: boolean;
  updatedAt: number;
}

export interface LevelProfile {
  guildId: string;
  userId: string;
  xp: number;
  messageCount: number;
  voiceMinutes: number;
  lastMessageXpAt: number | null;
  updatedAt: number;
}

export interface LevelReward {
  guildId: string;
  level: number;
  roleId: string;
  createdAt: number;
}

export interface LevelXpChange {
  before: LevelProfile;
  after: LevelProfile;
  amount: number;
}

export interface VoiceSettings {
  guildId: string;
  lobbyChannelId: string;
  categoryId: string;
  logChannelId: string;
  defaultUserLimit: number;
  updatedAt: number;
}

export interface TempVoiceChannel {
  guildId: string;
  channelId: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
}

export interface LfgSettings {
  guildId: string;
  forumChannelId: string;
  panelChannelId: string;
  logChannelId: string;
  maxOpenPerUser: number;
  defaultExpiryMinutes: number;
  updatedAt: number;
}

export type LfgStatus = 'open' | 'full' | 'closed' | 'expired';

export interface LfgPost {
  id: number;
  guildId: string;
  threadId: string;
  starterMessageId: string;
  ownerId: string;
  game: string;
  mode: string;
  platform: string;
  region: string;
  notes: string;
  maxPlayers: number;
  status: LfgStatus;
  createdAt: number;
  expiresAt: number;
  closedAt: number | null;
  closedBy: string | null;
  closeReason: string | null;
}

export interface LfgParticipant {
  lfgId: number;
  userId: string;
  joinedAt: number;
}

export interface TicketRecord {
  id: number;
  guildId: string;
  channelId: string;
  openerId: string;
  type: string;
  status: TicketStatus;
  claimedBy: string | null;
  createdAt: number;
  closedAt: number | null;
}

function rowToSettings(row: Record<string, unknown>): GuildSettings {
  return {
    guildId: String(row.guild_id),
    prefix: String(row.prefix),
    unverifiedRoleId: String(row.unverified_role_id),
    verifiedRoleId: String(row.verified_role_id),
    verificationChannelId: String(row.verification_channel_id),
    verificationLogChannelId: row.verification_log_channel_id ? String(row.verification_log_channel_id) : null,
    minAccountAgeDays: Number(row.min_account_age_days),
    maxAttempts: Number(row.max_attempts),
    lockoutMinutes: Number(row.lockout_minutes),
    verifyTimeoutMinutes: Number(row.verify_timeout_minutes),
    updatedAt: Number(row.updated_at),
  };
}

function rowToState(row: Record<string, unknown>): VerificationState {
  return {
    guildId: String(row.guild_id),
    userId: String(row.user_id),
    answerHash: row.answer_hash ? String(row.answer_hash) : null,
    salt: row.salt ? String(row.salt) : null,
    expiresAt: row.expires_at === null ? null : Number(row.expires_at),
    failures: Number(row.failures),
    lockedUntil: row.locked_until === null ? null : Number(row.locked_until),
    updatedAt: Number(row.updated_at),
  };
}

function rowToTicketSettings(row: Record<string, unknown>): TicketSettings {
  return {
    guildId: String(row.guild_id),
    categoryId: String(row.category_id),
    panelChannelId: String(row.panel_channel_id),
    supportRoleId: String(row.support_role_id),
    logChannelId: String(row.log_channel_id),
    maxOpenPerUser: Number(row.max_open_per_user),
    updatedAt: Number(row.updated_at),
  };
}



function rowToModerationSettings(row: Record<string, unknown>): ModerationSettings {
  return {
    guildId: String(row.guild_id),
    logChannelId: String(row.log_channel_id),
    updatedAt: Number(row.updated_at),
  };
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(String(value)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function rowToModerationCase(row: Record<string, unknown>): ModerationCase {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    moderatorId: String(row.moderator_id),
    targetId: row.target_id ? String(row.target_id) : null,
    action: String(row.action),
    reason: String(row.reason),
    metadata: parseMetadata(row.metadata),
    createdAt: Number(row.created_at),
  };
}

function rowToWarning(row: Record<string, unknown>): WarningRecord {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    userId: String(row.user_id),
    moderatorId: String(row.moderator_id),
    reason: String(row.reason),
    createdAt: Number(row.created_at),
    clearedAt: row.cleared_at === null ? null : Number(row.cleared_at),
    clearedBy: row.cleared_by ? String(row.cleared_by) : null,
  };
}


function rowToSecuritySettings(row: Record<string, unknown>): SecuritySettings {
  return {
    guildId: String(row.guild_id),
    logChannelId: String(row.log_channel_id),
    quarantineRoleId: row.quarantine_role_id ? String(row.quarantine_role_id) : null,
    antiSpamEnabled: Boolean(Number(row.anti_spam_enabled)),
    antiPhishingEnabled: Boolean(Number(row.anti_phishing_enabled)),
    antiRaidEnabled: Boolean(Number(row.anti_raid_enabled)),
    antiNukeEnabled: Boolean(Number(row.anti_nuke_enabled)),
    autoLockdownEnabled: Boolean(Number(row.auto_lockdown_enabled)),
    spamMessageLimit: Number(row.spam_message_limit),
    spamWindowSeconds: Number(row.spam_window_seconds),
    duplicateMessageLimit: Number(row.duplicate_message_limit),
    mentionLimit: Number(row.mention_limit),
    autoTimeoutMinutes: Number(row.auto_timeout_minutes),
    raidJoinLimit: Number(row.raid_join_limit),
    raidWindowSeconds: Number(row.raid_window_seconds),
    nukeActionLimit: Number(row.nuke_action_limit),
    nukeWindowSeconds: Number(row.nuke_window_seconds),
    lockdownMinutes: Number(row.lockdown_minutes),
    updatedAt: Number(row.updated_at),
  };
}

function rowToSecurityEvent(row: Record<string, unknown>): SecurityEventRecord {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    targetId: row.target_id ? String(row.target_id) : null,
    eventType: String(row.event_type),
    severity: String(row.severity),
    detail: parseMetadata(row.detail),
    createdAt: Number(row.created_at),
  };
}

function rowToLockdown(row: Record<string, unknown>): SecurityLockdown {
  return {
    guildId: String(row.guild_id),
    active: Boolean(Number(row.active)),
    actorId: String(row.actor_id),
    reason: String(row.reason),
    startedAt: Number(row.started_at),
    expiresAt: row.expires_at === null ? null : Number(row.expires_at),
  };
}








function rowToCommunitySettings(row: Record<string, unknown>): CommunitySettings {
  return {
    guildId: String(row.guild_id),
    logChannelId: String(row.log_channel_id),
    currencyName: String(row.currency_name),
    startingBalance: Number(row.starting_balance),
    dailyReward: Number(row.daily_reward),
    dailyCooldownHours: Number(row.daily_cooldown_hours),
    workMin: Number(row.work_min),
    workMax: Number(row.work_max),
    workCooldownMinutes: Number(row.work_cooldown_minutes),
    countingChannelId: row.counting_channel_id ? String(row.counting_channel_id) : null,
    countingResetOnMistake: Boolean(Number(row.counting_reset_on_mistake)),
    countingDeleteInvalid: Boolean(Number(row.counting_delete_invalid)),
    starboardChannelId: row.starboard_channel_id ? String(row.starboard_channel_id) : null,
    starThreshold: Number(row.star_threshold),
    starEmoji: String(row.star_emoji),
    allowSelfStar: Boolean(Number(row.allow_self_star)),
    updatedAt: Number(row.updated_at),
  };
}

function rowToEconomyAccount(row: Record<string, unknown>): EconomyAccount {
  return {
    guildId: String(row.guild_id),
    userId: String(row.user_id),
    balance: Number(row.balance),
    lastDailyAt: row.last_daily_at === null ? null : Number(row.last_daily_at),
    lastWorkAt: row.last_work_at === null ? null : Number(row.last_work_at),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToCountingState(row: Record<string, unknown>): CountingState {
  return {
    guildId: String(row.guild_id),
    currentNumber: Number(row.current_number),
    lastUserId: row.last_user_id ? String(row.last_user_id) : null,
    currentMessageId: row.current_message_id ? String(row.current_message_id) : null,
    highScore: Number(row.high_score),
    updatedAt: Number(row.updated_at),
  };
}

function rowToStarboardRecord(row: Record<string, unknown>): StarboardRecord {
  return {
    guildId: String(row.guild_id),
    sourceMessageId: String(row.source_message_id),
    sourceChannelId: String(row.source_channel_id),
    starboardMessageId: String(row.starboard_message_id),
    authorId: String(row.author_id),
    starCount: Number(row.star_count),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToRecreationSettings(row: Record<string, unknown>): RecreationSettings {
  return {
    guildId: String(row.guild_id),
    giveawayChannelId: String(row.giveaway_channel_id),
    eventChannelId: String(row.event_channel_id),
    logChannelId: String(row.log_channel_id),
    notificationRoleId: row.notification_role_id ? String(row.notification_role_id) : null,
    defaultGiveawayMinutes: Number(row.default_giveaway_minutes),
    defaultEventReminderMinutes: Number(row.default_event_reminder_minutes),
    updatedAt: Number(row.updated_at),
  };
}

function rowToGiveaway(row: Record<string, unknown>): GiveawayRecord {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    channelId: String(row.channel_id),
    messageId: String(row.message_id),
    hostId: String(row.host_id),
    prize: String(row.prize),
    description: String(row.description),
    winnerCount: Number(row.winner_count),
    requiredRoleId: row.required_role_id ? String(row.required_role_id) : null,
    minimumLevel: Number(row.minimum_level),
    status: String(row.status) as GiveawayStatus,
    createdAt: Number(row.created_at),
    endsAt: Number(row.ends_at),
    endedAt: row.ended_at === null ? null : Number(row.ended_at),
    endedBy: row.ended_by ? String(row.ended_by) : null,
  };
}

function rowToGiveawayEntry(row: Record<string, unknown>): GiveawayEntry {
  return {
    giveawayId: Number(row.giveaway_id),
    userId: String(row.user_id),
    enteredAt: Number(row.entered_at),
  };
}

function rowToGiveawayWinner(row: Record<string, unknown>): GiveawayWinner {
  return {
    giveawayId: Number(row.giveaway_id),
    userId: String(row.user_id),
    drawNumber: Number(row.draw_number),
    selectedAt: Number(row.selected_at),
  };
}

function rowToRecreationEvent(row: Record<string, unknown>): RecreationEventRecord {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    channelId: String(row.channel_id),
    messageId: String(row.message_id),
    hostId: String(row.host_id),
    title: String(row.title),
    description: String(row.description),
    location: String(row.location),
    capacity: Number(row.capacity),
    status: String(row.status) as RecreationEventStatus,
    startsAt: Number(row.starts_at),
    endsAt: Number(row.ends_at),
    reminderMinutes: Number(row.reminder_minutes),
    reminderSent: Boolean(Number(row.reminder_sent)),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToRecreationEventRsvp(row: Record<string, unknown>): RecreationEventRsvp {
  return {
    eventId: Number(row.event_id),
    userId: String(row.user_id),
    response: String(row.response) as RecreationEventResponse,
    updatedAt: Number(row.updated_at),
  };
}

function rowToLevelSettings(row: Record<string, unknown>): LevelSettings {
  return {
    guildId: String(row.guild_id),
    enabled: Boolean(Number(row.enabled)),
    announceChannelId: row.announce_channel_id ? String(row.announce_channel_id) : null,
    logChannelId: String(row.log_channel_id),
    messageXpMin: Number(row.message_xp_min),
    messageXpMax: Number(row.message_xp_max),
    messageCooldownSeconds: Number(row.message_cooldown_seconds),
    voiceXpPerMinute: Number(row.voice_xp_per_minute),
    voiceMinMembers: Number(row.voice_min_members),
    announceLevelUps: Boolean(Number(row.announce_level_ups)),
    stackRewardRoles: Boolean(Number(row.stack_reward_roles)),
    updatedAt: Number(row.updated_at),
  };
}

function rowToLevelProfile(row: Record<string, unknown>): LevelProfile {
  return {
    guildId: String(row.guild_id),
    userId: String(row.user_id),
    xp: Number(row.xp),
    messageCount: Number(row.message_count),
    voiceMinutes: Number(row.voice_minutes),
    lastMessageXpAt: row.last_message_xp_at === null ? null : Number(row.last_message_xp_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToLevelReward(row: Record<string, unknown>): LevelReward {
  return {
    guildId: String(row.guild_id),
    level: Number(row.level),
    roleId: String(row.role_id),
    createdAt: Number(row.created_at),
  };
}

function rowToVoiceSettings(row: Record<string, unknown>): VoiceSettings {
  return {
    guildId: String(row.guild_id),
    lobbyChannelId: String(row.lobby_channel_id),
    categoryId: String(row.category_id),
    logChannelId: String(row.log_channel_id),
    defaultUserLimit: Number(row.default_user_limit),
    updatedAt: Number(row.updated_at),
  };
}

function rowToTempVoiceChannel(row: Record<string, unknown>): TempVoiceChannel {
  return {
    guildId: String(row.guild_id),
    channelId: String(row.channel_id),
    ownerId: String(row.owner_id),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function rowToLfgSettings(row: Record<string, unknown>): LfgSettings {
  return {
    guildId: String(row.guild_id),
    forumChannelId: String(row.forum_channel_id),
    panelChannelId: String(row.panel_channel_id),
    logChannelId: String(row.log_channel_id),
    maxOpenPerUser: Number(row.max_open_per_user),
    defaultExpiryMinutes: Number(row.default_expiry_minutes),
    updatedAt: Number(row.updated_at),
  };
}

function rowToLfgPost(row: Record<string, unknown>): LfgPost {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    threadId: String(row.thread_id),
    starterMessageId: String(row.starter_message_id),
    ownerId: String(row.owner_id),
    game: String(row.game),
    mode: String(row.mode),
    platform: String(row.platform),
    region: String(row.region),
    notes: String(row.notes),
    maxPlayers: Number(row.max_players),
    status: String(row.status) as LfgStatus,
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    closedAt: row.closed_at === null ? null : Number(row.closed_at),
    closedBy: row.closed_by ? String(row.closed_by) : null,
    closeReason: row.close_reason ? String(row.close_reason) : null,
  };
}

function rowToLfgParticipant(row: Record<string, unknown>): LfgParticipant {
  return {
    lfgId: Number(row.lfg_id),
    userId: String(row.user_id),
    joinedAt: Number(row.joined_at),
  };
}

function rowToTicket(row: Record<string, unknown>): TicketRecord {
  return {
    id: Number(row.id),
    guildId: String(row.guild_id),
    channelId: String(row.channel_id),
    openerId: String(row.opener_id),
    type: String(row.type),
    status: String(row.status) as TicketStatus,
    claimedBy: row.claimed_by ? String(row.claimed_by) : null,
    createdAt: Number(row.created_at),
    closedAt: row.closed_at === null ? null : Number(row.closed_at),
  };
}

export class Store {
  private readonly db: DatabaseSync;

  constructor(databasePath: string) {
    const absolutePath = resolve(databasePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    this.db = new DatabaseSync(absolutePath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        prefix TEXT NOT NULL DEFAULT ';',
        unverified_role_id TEXT NOT NULL,
        verified_role_id TEXT NOT NULL,
        verification_channel_id TEXT NOT NULL,
        verification_log_channel_id TEXT,
        min_account_age_days INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        lockout_minutes INTEGER NOT NULL DEFAULT 15,
        verify_timeout_minutes INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS verification_state (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        answer_hash TEXT,
        salt TEXT,
        expires_at INTEGER,
        failures INTEGER NOT NULL DEFAULT 0,
        locked_until INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS pending_verifications (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS verification_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        detail TEXT,
        created_at INTEGER NOT NULL
      );




      CREATE TABLE IF NOT EXISTS security_settings (
        guild_id TEXT PRIMARY KEY,
        log_channel_id TEXT NOT NULL,
        quarantine_role_id TEXT,
        anti_spam_enabled INTEGER NOT NULL DEFAULT 1,
        anti_phishing_enabled INTEGER NOT NULL DEFAULT 1,
        anti_raid_enabled INTEGER NOT NULL DEFAULT 1,
        anti_nuke_enabled INTEGER NOT NULL DEFAULT 1,
        auto_lockdown_enabled INTEGER NOT NULL DEFAULT 0,
        spam_message_limit INTEGER NOT NULL DEFAULT 6,
        spam_window_seconds INTEGER NOT NULL DEFAULT 6,
        duplicate_message_limit INTEGER NOT NULL DEFAULT 3,
        mention_limit INTEGER NOT NULL DEFAULT 5,
        auto_timeout_minutes INTEGER NOT NULL DEFAULT 10,
        raid_join_limit INTEGER NOT NULL DEFAULT 8,
        raid_window_seconds INTEGER NOT NULL DEFAULT 10,
        nuke_action_limit INTEGER NOT NULL DEFAULT 3,
        nuke_window_seconds INTEGER NOT NULL DEFAULT 30,
        lockdown_minutes INTEGER NOT NULL DEFAULT 10,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        actor_id TEXT,
        target_id TEXT,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        detail TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS security_trusted_users (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        added_by TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS security_lockdowns (
        guild_id TEXT PRIMARY KEY,
        active INTEGER NOT NULL DEFAULT 0,
        actor_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS security_lockdown_snapshots (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        overwrite_existed INTEGER NOT NULL,
        permissions TEXT NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
      );

      CREATE TABLE IF NOT EXISTS moderation_settings (
        guild_id TEXT PRIMARY KEY,
        log_channel_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS moderation_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        target_id TEXT,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        cleared_at INTEGER,
        cleared_by TEXT
      );








      CREATE TABLE IF NOT EXISTS community_settings (
        guild_id TEXT PRIMARY KEY,
        log_channel_id TEXT NOT NULL,
        currency_name TEXT NOT NULL DEFAULT 'credits',
        starting_balance INTEGER NOT NULL DEFAULT 0 CHECK(starting_balance >= 0),
        daily_reward INTEGER NOT NULL DEFAULT 250 CHECK(daily_reward >= 0),
        daily_cooldown_hours INTEGER NOT NULL DEFAULT 24 CHECK(daily_cooldown_hours >= 1),
        work_min INTEGER NOT NULL DEFAULT 50 CHECK(work_min >= 0),
        work_max INTEGER NOT NULL DEFAULT 150 CHECK(work_max >= work_min),
        work_cooldown_minutes INTEGER NOT NULL DEFAULT 60 CHECK(work_cooldown_minutes >= 1),
        counting_channel_id TEXT,
        counting_reset_on_mistake INTEGER NOT NULL DEFAULT 1,
        counting_delete_invalid INTEGER NOT NULL DEFAULT 1,
        starboard_channel_id TEXT,
        star_threshold INTEGER NOT NULL DEFAULT 3 CHECK(star_threshold >= 1),
        star_emoji TEXT NOT NULL DEFAULT 'â­',
        allow_self_star INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS economy_accounts (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
        last_daily_at INTEGER,
        last_work_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS economy_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        counterparty_id TEXT,
        detail TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_economy_leaderboard ON economy_accounts(guild_id, balance DESC, updated_at ASC);
      CREATE INDEX IF NOT EXISTS idx_economy_transactions_user ON economy_transactions(guild_id, user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS counting_state (
        guild_id TEXT PRIMARY KEY,
        current_number INTEGER NOT NULL DEFAULT 0 CHECK(current_number >= 0),
        last_user_id TEXT,
        current_message_id TEXT,
        high_score INTEGER NOT NULL DEFAULT 0 CHECK(high_score >= 0),
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS starboard_records (
        guild_id TEXT NOT NULL,
        source_message_id TEXT NOT NULL,
        source_channel_id TEXT NOT NULL,
        starboard_message_id TEXT NOT NULL UNIQUE,
        author_id TEXT NOT NULL,
        star_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, source_message_id)
      );

      CREATE INDEX IF NOT EXISTS idx_starboard_source ON starboard_records(source_message_id);
      CREATE INDEX IF NOT EXISTS idx_starboard_board ON starboard_records(starboard_message_id);

      CREATE TABLE IF NOT EXISTS recreation_settings (
        guild_id TEXT PRIMARY KEY,
        giveaway_channel_id TEXT NOT NULL,
        event_channel_id TEXT NOT NULL,
        log_channel_id TEXT NOT NULL,
        notification_role_id TEXT,
        default_giveaway_minutes INTEGER NOT NULL DEFAULT 1440,
        default_event_reminder_minutes INTEGER NOT NULL DEFAULT 60,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL UNIQUE,
        host_id TEXT NOT NULL,
        prize TEXT NOT NULL,
        description TEXT NOT NULL,
        winner_count INTEGER NOT NULL,
        required_role_id TEXT,
        minimum_level INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        ended_at INTEGER,
        ended_by TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_giveaways_due ON giveaways(status, ends_at);
      CREATE INDEX IF NOT EXISTS idx_giveaways_guild ON giveaways(guild_id, status, created_at);

      CREATE TABLE IF NOT EXISTS giveaway_entries (
        giveaway_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        entered_at INTEGER NOT NULL,
        PRIMARY KEY (giveaway_id, user_id),
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS giveaway_winners (
        giveaway_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        draw_number INTEGER NOT NULL,
        selected_at INTEGER NOT NULL,
        PRIMARY KEY (giveaway_id, draw_number, user_id),
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS recreation_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL UNIQUE,
        host_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        capacity INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'scheduled',
        starts_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        reminder_minutes INTEGER NOT NULL DEFAULT 60,
        reminder_sent INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recreation_events_due ON recreation_events(status, starts_at, ends_at);
      CREATE INDEX IF NOT EXISTS idx_recreation_events_guild ON recreation_events(guild_id, status, starts_at);

      CREATE TABLE IF NOT EXISTS recreation_event_rsvps (
        event_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        response TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (event_id, user_id),
        FOREIGN KEY (event_id) REFERENCES recreation_events(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS level_settings (
        guild_id TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 1,
        announce_channel_id TEXT,
        log_channel_id TEXT NOT NULL,
        message_xp_min INTEGER NOT NULL DEFAULT 15,
        message_xp_max INTEGER NOT NULL DEFAULT 40,
        message_cooldown_seconds INTEGER NOT NULL DEFAULT 60,
        voice_xp_per_minute INTEGER NOT NULL DEFAULT 0,
        voice_min_members INTEGER NOT NULL DEFAULT 2,
        announce_level_ups INTEGER NOT NULL DEFAULT 1,
        stack_reward_roles INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS level_profiles (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0 CHECK(xp >= 0),
        message_count INTEGER NOT NULL DEFAULT 0 CHECK(message_count >= 0),
        voice_minutes INTEGER NOT NULL DEFAULT 0 CHECK(voice_minutes >= 0),
        last_message_xp_at INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS level_rewards (
        guild_id TEXT NOT NULL,
        level INTEGER NOT NULL CHECK(level > 0),
        role_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, level),
        UNIQUE (guild_id, role_id)
      );

      CREATE TABLE IF NOT EXISTS level_excluded_channels (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, channel_id)
      );

      CREATE TABLE IF NOT EXISTS level_excluded_roles (
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, role_id)
      );

      CREATE TABLE IF NOT EXISTS voice_settings (
        guild_id TEXT PRIMARY KEY,
        lobby_channel_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        log_channel_id TEXT NOT NULL,
        default_user_limit INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS temp_voice_channels (
        channel_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(guild_id, owner_id)
      );

      CREATE TABLE IF NOT EXISTS lfg_settings (
        guild_id TEXT PRIMARY KEY,
        forum_channel_id TEXT NOT NULL,
        panel_channel_id TEXT NOT NULL,
        log_channel_id TEXT NOT NULL,
        max_open_per_user INTEGER NOT NULL DEFAULT 2,
        default_expiry_minutes INTEGER NOT NULL DEFAULT 180,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS lfg_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        thread_id TEXT NOT NULL UNIQUE,
        starter_message_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        game TEXT NOT NULL,
        mode TEXT NOT NULL,
        platform TEXT NOT NULL,
        region TEXT NOT NULL,
        notes TEXT NOT NULL,
        max_players INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('open', 'full', 'closed', 'expired')),
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        closed_at INTEGER,
        closed_by TEXT,
        close_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS lfg_participants (
        lfg_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        joined_at INTEGER NOT NULL,
        PRIMARY KEY (lfg_id, user_id),
        FOREIGN KEY(lfg_id) REFERENCES lfg_posts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS lfg_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lfg_id INTEGER,
        guild_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        detail TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(lfg_id) REFERENCES lfg_posts(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS ticket_settings (
        guild_id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        panel_channel_id TEXT NOT NULL,
        support_role_id TEXT NOT NULL,
        log_channel_id TEXT NOT NULL,
        max_open_per_user INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL UNIQUE,
        opener_id TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('open', 'closed')),
        claimed_by TEXT,
        created_at INTEGER NOT NULL,
        closed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS ticket_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER,
        guild_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        detail TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(ticket_id) REFERENCES tickets(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_verification_events_guild_created
        ON verification_events (guild_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_tickets_guild_opener_status
        ON tickets (guild_id, opener_id, status);

      CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_created
        ON ticket_events (ticket_id, created_at);







      CREATE INDEX IF NOT EXISTS idx_level_profiles_leaderboard
        ON level_profiles (guild_id, xp DESC, message_count DESC);

      CREATE INDEX IF NOT EXISTS idx_level_rewards_guild_level
        ON level_rewards (guild_id, level ASC);

      CREATE INDEX IF NOT EXISTS idx_temp_voice_channels_guild_owner
        ON temp_voice_channels (guild_id, owner_id);

      CREATE INDEX IF NOT EXISTS idx_lfg_posts_guild_owner_status
        ON lfg_posts (guild_id, owner_id, status);

      CREATE INDEX IF NOT EXISTS idx_lfg_posts_status_expires
        ON lfg_posts (status, expires_at);

      CREATE INDEX IF NOT EXISTS idx_lfg_participants_lfg
        ON lfg_participants (lfg_id, joined_at);

      CREATE INDEX IF NOT EXISTS idx_lfg_events_lfg_created
        ON lfg_events (lfg_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_security_events_guild_created
        ON security_events (guild_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_security_events_actor_created
        ON security_events (guild_id, actor_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_moderation_cases_guild_target_created
        ON moderation_cases (guild_id, target_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_warnings_guild_user_active
        ON warnings (guild_id, user_id, cleared_at);

    `);
  }

  close(): void {
    this.db.close();
  }

  getGuildSettings(guildId: string): GuildSettings | null {
    const row = this.db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToSettings(row) : null;
  }

  upsertGuildSettings(input: Omit<GuildSettings, 'updatedAt'>): GuildSettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO guild_settings (
        guild_id, prefix, unverified_role_id, verified_role_id,
        verification_channel_id, verification_log_channel_id,
        min_account_age_days, max_attempts, lockout_minutes,
        verify_timeout_minutes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        prefix = excluded.prefix,
        unverified_role_id = excluded.unverified_role_id,
        verified_role_id = excluded.verified_role_id,
        verification_channel_id = excluded.verification_channel_id,
        verification_log_channel_id = excluded.verification_log_channel_id,
        min_account_age_days = excluded.min_account_age_days,
        max_attempts = excluded.max_attempts,
        lockout_minutes = excluded.lockout_minutes,
        verify_timeout_minutes = excluded.verify_timeout_minutes,
        updated_at = excluded.updated_at
    `).run(
      input.guildId,
      input.prefix,
      input.unverifiedRoleId,
      input.verifiedRoleId,
      input.verificationChannelId,
      input.verificationLogChannelId,
      input.minAccountAgeDays,
      input.maxAttempts,
      input.lockoutMinutes,
      input.verifyTimeoutMinutes,
      now,
    );
    return { ...input, updatedAt: now };
  }

  addPending(guildId: string, userId: string, joinedAt = Date.now()): void {
    this.db.prepare(`
      INSERT INTO pending_verifications (guild_id, user_id, joined_at)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET joined_at = excluded.joined_at
    `).run(guildId, userId, joinedAt);
  }

  clearPending(guildId: string, userId: string): void {
    this.db.prepare('DELETE FROM pending_verifications WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  }

  getExpiredPending(now = Date.now()): ExpiredPendingVerification[] {
    const rows = this.db.prepare(`
      SELECT p.guild_id, p.user_id, g.verify_timeout_minutes
      FROM pending_verifications p
      JOIN guild_settings g ON g.guild_id = p.guild_id
      WHERE g.verify_timeout_minutes > 0
        AND p.joined_at <= (? - (g.verify_timeout_minutes * 60000))
    `).all(now) as Record<string, unknown>[];
    return rows.map((row) => ({
      guildId: String(row.guild_id),
      userId: String(row.user_id),
      verifyTimeoutMinutes: Number(row.verify_timeout_minutes),
    }));
  }

  getVerificationState(guildId: string, userId: string): VerificationState | null {
    const row = this.db.prepare(`
      SELECT * FROM verification_state WHERE guild_id = ? AND user_id = ?
    `).get(guildId, userId) as Record<string, unknown> | undefined;
    return row ? rowToState(row) : null;
  }

  saveChallenge(guildId: string, userId: string, answerHash: string, salt: string, expiresAt: number): void {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO verification_state (
        guild_id, user_id, answer_hash, salt, expires_at, failures, locked_until, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        answer_hash = excluded.answer_hash,
        salt = excluded.salt,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `).run(guildId, userId, answerHash, salt, expiresAt, now);
  }

  resetFailures(guildId: string, userId: string): void {
    this.db.prepare(`
      UPDATE verification_state
      SET failures = 0, locked_until = NULL, updated_at = ?
      WHERE guild_id = ? AND user_id = ?
    `).run(Date.now(), guildId, userId);
  }

  recordFailure(guildId: string, userId: string, maxAttempts: number, lockoutMinutes: number): VerificationState {
    const existing = this.getVerificationState(guildId, userId);
    if (!existing) throw new Error('Verification state does not exist.');
    const failures = existing.failures + 1;
    const lockedUntil = failures >= maxAttempts ? Date.now() + lockoutMinutes * 60_000 : existing.lockedUntil;
    const storedFailures = failures >= maxAttempts ? 0 : failures;
    this.db.prepare(`
      UPDATE verification_state
      SET failures = ?, locked_until = ?, updated_at = ?
      WHERE guild_id = ? AND user_id = ?
    `).run(storedFailures, lockedUntil, Date.now(), guildId, userId);
    const updated = this.getVerificationState(guildId, userId);
    if (!updated) throw new Error('Failed to update verification state.');
    return updated;
  }

  clearVerificationState(guildId: string, userId: string): void {
    this.db.prepare('DELETE FROM verification_state WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
  }

  recordEvent(guildId: string, userId: string, eventType: string, detail?: Record<string, unknown>): void {
    this.db.prepare(`
      INSERT INTO verification_events (guild_id, user_id, event_type, detail, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(guildId, userId, eventType, detail ? JSON.stringify(detail) : null, Date.now());
  }

  getTicketSettings(guildId: string): TicketSettings | null {
    const row = this.db.prepare('SELECT * FROM ticket_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToTicketSettings(row) : null;
  }

  upsertTicketSettings(input: Omit<TicketSettings, 'updatedAt'>): TicketSettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO ticket_settings (
        guild_id, category_id, panel_channel_id, support_role_id,
        log_channel_id, max_open_per_user, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        category_id = excluded.category_id,
        panel_channel_id = excluded.panel_channel_id,
        support_role_id = excluded.support_role_id,
        log_channel_id = excluded.log_channel_id,
        max_open_per_user = excluded.max_open_per_user,
        updated_at = excluded.updated_at
    `).run(
      input.guildId,
      input.categoryId,
      input.panelChannelId,
      input.supportRoleId,
      input.logChannelId,
      input.maxOpenPerUser,
      now,
    );
    return { ...input, updatedAt: now };
  }

  createTicket(input: Omit<TicketRecord, 'id' | 'status' | 'claimedBy' | 'createdAt' | 'closedAt'>): TicketRecord {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO tickets (
        guild_id, channel_id, opener_id, type, status, claimed_by, created_at, closed_at
      ) VALUES (?, ?, ?, ?, 'open', NULL, ?, NULL)
    `).run(input.guildId, input.channelId, input.openerId, input.type, now);
    const id = Number(result.lastInsertRowid);
    const ticket = this.getTicketById(id);
    if (!ticket) throw new Error('Failed to create ticket record.');
    return ticket;
  }

  getTicketById(id: number): TicketRecord | null {
    const row = this.db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? rowToTicket(row) : null;
  }

  getTicketByChannel(channelId: string): TicketRecord | null {
    const row = this.db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(channelId) as Record<string, unknown> | undefined;
    return row ? rowToTicket(row) : null;
  }

  countOpenTicketsForUser(guildId: string, openerId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS total FROM tickets
      WHERE guild_id = ? AND opener_id = ? AND status = 'open'
    `).get(guildId, openerId) as Record<string, unknown>;
    return Number(row.total);
  }

  getOpenTicketForUser(guildId: string, openerId: string): TicketRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM tickets
      WHERE guild_id = ? AND opener_id = ? AND status = 'open'
      ORDER BY created_at DESC LIMIT 1
    `).get(guildId, openerId) as Record<string, unknown> | undefined;
    return row ? rowToTicket(row) : null;
  }

  setTicketClaim(ticketId: number, claimedBy: string | null): TicketRecord {
    this.db.prepare('UPDATE tickets SET claimed_by = ? WHERE id = ?').run(claimedBy, ticketId);
    const ticket = this.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket no longer exists.');
    return ticket;
  }

  setTicketStatus(ticketId: number, status: TicketStatus): TicketRecord {
    const closedAt = status === 'closed' ? Date.now() : null;
    this.db.prepare('UPDATE tickets SET status = ?, closed_at = ? WHERE id = ?').run(status, closedAt, ticketId);
    const ticket = this.getTicketById(ticketId);
    if (!ticket) throw new Error('Ticket no longer exists.');
    return ticket;
  }

  deleteTicket(ticketId: number): void {
    this.db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);
  }

  recordTicketEvent(
    ticketId: number | null,
    guildId: string,
    actorId: string,
    eventType: string,
    detail?: Record<string, unknown>,
  ): void {
    this.db.prepare(`
      INSERT INTO ticket_events (ticket_id, guild_id, actor_id, event_type, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ticketId, guildId, actorId, eventType, detail ? JSON.stringify(detail) : null, Date.now());
  }

  getModerationSettings(guildId: string): ModerationSettings | null {
    const row = this.db.prepare('SELECT * FROM moderation_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToModerationSettings(row) : null;
  }

  upsertModerationSettings(input: Omit<ModerationSettings, 'updatedAt'>): ModerationSettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO moderation_settings (guild_id, log_channel_id, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        log_channel_id = excluded.log_channel_id,
        updated_at = excluded.updated_at
    `).run(input.guildId, input.logChannelId, now);
    return { ...input, updatedAt: now };
  }

  createModerationCase(input: Omit<ModerationCase, 'id' | 'createdAt'>): ModerationCase {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO moderation_cases (
        guild_id, moderator_id, target_id, action, reason, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.guildId,
      input.moderatorId,
      input.targetId,
      input.action,
      input.reason,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
    );
    const row = this.db.prepare('SELECT * FROM moderation_cases WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to create moderation case.');
    return rowToModerationCase(row);
  }

  getModerationCase(guildId: string, caseId: number): ModerationCase | null {
    const row = this.db.prepare(`
      SELECT * FROM moderation_cases WHERE guild_id = ? AND id = ?
    `).get(guildId, caseId) as Record<string, unknown> | undefined;
    return row ? rowToModerationCase(row) : null;
  }

  listModerationCasesForTarget(guildId: string, targetId: string, limit = 10): ModerationCase[] {
    const rows = this.db.prepare(`
      SELECT * FROM moderation_cases
      WHERE guild_id = ? AND target_id = ?
      ORDER BY created_at DESC LIMIT ?
    `).all(guildId, targetId, Math.max(1, Math.min(limit, 25))) as Record<string, unknown>[];
    return rows.map(rowToModerationCase);
  }

  addWarning(guildId: string, userId: string, moderatorId: string, reason: string): WarningRecord {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO warnings (guild_id, user_id, moderator_id, reason, created_at, cleared_at, cleared_by)
      VALUES (?, ?, ?, ?, ?, NULL, NULL)
    `).run(guildId, userId, moderatorId, reason, now);
    const row = this.db.prepare('SELECT * FROM warnings WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to create warning.');
    return rowToWarning(row);
  }

  listActiveWarnings(guildId: string, userId: string, limit = 20): WarningRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM warnings
      WHERE guild_id = ? AND user_id = ? AND cleared_at IS NULL
      ORDER BY created_at DESC LIMIT ?
    `).all(guildId, userId, Math.max(1, Math.min(limit, 50))) as Record<string, unknown>[];
    return rows.map(rowToWarning);
  }

  clearActiveWarnings(guildId: string, userId: string, clearedBy: string): number {
    const result = this.db.prepare(`
      UPDATE warnings SET cleared_at = ?, cleared_by = ?
      WHERE guild_id = ? AND user_id = ? AND cleared_at IS NULL
    `).run(Date.now(), clearedBy, guildId, userId);
    return Number(result.changes);
  }






  getLevelSettings(guildId: string): LevelSettings | null {
    const row = this.db.prepare('SELECT * FROM level_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToLevelSettings(row) : null;
  }

  upsertLevelSettings(input: Omit<LevelSettings, 'updatedAt'>): LevelSettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO level_settings (
        guild_id, enabled, announce_channel_id, log_channel_id,
        message_xp_min, message_xp_max, message_cooldown_seconds,
        voice_xp_per_minute, voice_min_members, announce_level_ups,
        stack_reward_roles, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        enabled = excluded.enabled,
        announce_channel_id = excluded.announce_channel_id,
        log_channel_id = excluded.log_channel_id,
        message_xp_min = excluded.message_xp_min,
        message_xp_max = excluded.message_xp_max,
        message_cooldown_seconds = excluded.message_cooldown_seconds,
        voice_xp_per_minute = excluded.voice_xp_per_minute,
        voice_min_members = excluded.voice_min_members,
        announce_level_ups = excluded.announce_level_ups,
        stack_reward_roles = excluded.stack_reward_roles,
        updated_at = excluded.updated_at
    `).run(
      input.guildId,
      input.enabled ? 1 : 0,
      input.announceChannelId,
      input.logChannelId,
      input.messageXpMin,
      input.messageXpMax,
      input.messageCooldownSeconds,
      input.voiceXpPerMinute,
      input.voiceMinMembers,
      input.announceLevelUps ? 1 : 0,
      input.stackRewardRoles ? 1 : 0,
      now,
    );
    return { ...input, updatedAt: now };
  }

  getLevelProfile(guildId: string, userId: string): LevelProfile | null {
    const row = this.db.prepare(`
      SELECT * FROM level_profiles WHERE guild_id = ? AND user_id = ?
    `).get(guildId, userId) as Record<string, unknown> | undefined;
    return row ? rowToLevelProfile(row) : null;
  }

  private emptyLevelProfile(guildId: string, userId: string, now = Date.now()): LevelProfile {
    return {
      guildId,
      userId,
      xp: 0,
      messageCount: 0,
      voiceMinutes: 0,
      lastMessageXpAt: null,
      updatedAt: now,
    };
  }

  tryAwardMessageXp(
    guildId: string,
    userId: string,
    amount: number,
    cooldownMs: number,
    now = Date.now(),
  ): LevelXpChange | null {
    const before = this.getLevelProfile(guildId, userId) ?? this.emptyLevelProfile(guildId, userId, now);
    if (before.lastMessageXpAt !== null && now - before.lastMessageXpAt < cooldownMs) return null;
    const safeAmount = Math.max(0, Math.trunc(amount));
    this.db.prepare(`
      INSERT INTO level_profiles (
        guild_id, user_id, xp, message_count, voice_minutes, last_message_xp_at, updated_at
      ) VALUES (?, ?, ?, 1, 0, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        xp = level_profiles.xp + excluded.xp,
        message_count = level_profiles.message_count + 1,
        last_message_xp_at = excluded.last_message_xp_at,
        updated_at = excluded.updated_at
    `).run(guildId, userId, safeAmount, now, now);
    const after = this.getLevelProfile(guildId, userId);
    if (!after) throw new Error('Failed to award message XP.');
    return { before, after, amount: safeAmount };
  }

  awardVoiceXp(
    guildId: string,
    userId: string,
    amount: number,
    minutes: number,
    now = Date.now(),
  ): LevelXpChange {
    const before = this.getLevelProfile(guildId, userId) ?? this.emptyLevelProfile(guildId, userId, now);
    const safeAmount = Math.max(0, Math.trunc(amount));
    const safeMinutes = Math.max(0, Math.trunc(minutes));
    this.db.prepare(`
      INSERT INTO level_profiles (
        guild_id, user_id, xp, message_count, voice_minutes, last_message_xp_at, updated_at
      ) VALUES (?, ?, ?, 0, ?, NULL, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        xp = level_profiles.xp + excluded.xp,
        voice_minutes = level_profiles.voice_minutes + excluded.voice_minutes,
        updated_at = excluded.updated_at
    `).run(guildId, userId, safeAmount, safeMinutes, now);
    const after = this.getLevelProfile(guildId, userId);
    if (!after) throw new Error('Failed to award voice XP.');
    return { before, after, amount: safeAmount };
  }

  setLevelXp(guildId: string, userId: string, xp: number, now = Date.now()): LevelXpChange {
    const before = this.getLevelProfile(guildId, userId) ?? this.emptyLevelProfile(guildId, userId, now);
    const safeXp = Math.max(0, Math.trunc(xp));
    this.db.prepare(`
      INSERT INTO level_profiles (
        guild_id, user_id, xp, message_count, voice_minutes, last_message_xp_at, updated_at
      ) VALUES (?, ?, ?, 0, 0, NULL, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        xp = excluded.xp,
        updated_at = excluded.updated_at
    `).run(guildId, userId, safeXp, now);
    const after = this.getLevelProfile(guildId, userId);
    if (!after) throw new Error('Failed to update level XP.');
    return { before, after, amount: safeXp - before.xp };
  }

  adjustLevelXp(guildId: string, userId: string, delta: number, now = Date.now()): LevelXpChange {
    const before = this.getLevelProfile(guildId, userId) ?? this.emptyLevelProfile(guildId, userId, now);
    return this.setLevelXp(guildId, userId, Math.max(0, before.xp + Math.trunc(delta)), now);
  }

  listLevelLeaderboard(guildId: string, limit = 10, offset = 0): LevelProfile[] {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const safeOffset = Math.max(0, Math.trunc(offset));
    const rows = this.db.prepare(`
      SELECT * FROM level_profiles
      WHERE guild_id = ?
      ORDER BY xp DESC, message_count DESC, updated_at ASC, user_id ASC
      LIMIT ? OFFSET ?
    `).all(guildId, safeLimit, safeOffset) as Record<string, unknown>[];
    return rows.map(rowToLevelProfile);
  }

  getLevelRank(guildId: string, userId: string): number | null {
    const profile = this.getLevelProfile(guildId, userId);
    if (!profile) return null;
    const row = this.db.prepare(`
      SELECT COUNT(*) + 1 AS rank
      FROM level_profiles
      WHERE guild_id = ? AND xp > ?
    `).get(guildId, profile.xp) as Record<string, unknown> | undefined;
    return row ? Number(row.rank) : null;
  }

  upsertLevelReward(guildId: string, level: number, roleId: string): LevelReward {
    const safeLevel = Math.max(1, Math.trunc(level));
    const now = Date.now();
    this.db.prepare(`
      DELETE FROM level_rewards WHERE guild_id = ? AND role_id = ? AND level <> ?
    `).run(guildId, roleId, safeLevel);
    this.db.prepare(`
      INSERT INTO level_rewards (guild_id, level, role_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, level) DO UPDATE SET
        role_id = excluded.role_id,
        created_at = excluded.created_at
    `).run(guildId, safeLevel, roleId, now);
    const row = this.db.prepare(`
      SELECT * FROM level_rewards WHERE guild_id = ? AND level = ?
    `).get(guildId, safeLevel) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to save level reward.');
    return rowToLevelReward(row);
  }

  deleteLevelReward(guildId: string, level: number): boolean {
    const result = this.db.prepare(`
      DELETE FROM level_rewards WHERE guild_id = ? AND level = ?
    `).run(guildId, Math.max(1, Math.trunc(level)));
    return Number(result.changes) > 0;
  }

  listLevelRewards(guildId: string): LevelReward[] {
    const rows = this.db.prepare(`
      SELECT * FROM level_rewards WHERE guild_id = ? ORDER BY level ASC
    `).all(guildId) as Record<string, unknown>[];
    return rows.map(rowToLevelReward);
  }

  addLevelExcludedChannel(guildId: string, channelId: string): void {
    this.db.prepare(`
      INSERT INTO level_excluded_channels (guild_id, channel_id, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, channel_id) DO NOTHING
    `).run(guildId, channelId, Date.now());
  }

  removeLevelExcludedChannel(guildId: string, channelId: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM level_excluded_channels WHERE guild_id = ? AND channel_id = ?
    `).run(guildId, channelId);
    return Number(result.changes) > 0;
  }

  listLevelExcludedChannels(guildId: string): string[] {
    const rows = this.db.prepare(`
      SELECT channel_id FROM level_excluded_channels WHERE guild_id = ? ORDER BY created_at ASC
    `).all(guildId) as Record<string, unknown>[];
    return rows.map((row) => String(row.channel_id));
  }

  isLevelChannelExcluded(guildId: string, channelId: string): boolean {
    const row = this.db.prepare(`
      SELECT 1 AS found FROM level_excluded_channels WHERE guild_id = ? AND channel_id = ?
    `).get(guildId, channelId) as Record<string, unknown> | undefined;
    return Boolean(row);
  }

  addLevelExcludedRole(guildId: string, roleId: string): void {
    this.db.prepare(`
      INSERT INTO level_excluded_roles (guild_id, role_id, created_at)
      VALUES (?, ?, ?)
      ON CONFLICT(guild_id, role_id) DO NOTHING
    `).run(guildId, roleId, Date.now());
  }

  removeLevelExcludedRole(guildId: string, roleId: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM level_excluded_roles WHERE guild_id = ? AND role_id = ?
    `).run(guildId, roleId);
    return Number(result.changes) > 0;
  }

  listLevelExcludedRoles(guildId: string): string[] {
    const rows = this.db.prepare(`
      SELECT role_id FROM level_excluded_roles WHERE guild_id = ? ORDER BY created_at ASC
    `).all(guildId) as Record<string, unknown>[];
    return rows.map((row) => String(row.role_id));
  }

  isLevelRoleExcluded(guildId: string, roleIds: Iterable<string>): boolean {
    const excluded = new Set(this.listLevelExcludedRoles(guildId));
    for (const roleId of roleIds) {
      if (excluded.has(roleId)) return true;
    }
    return false;
  }

  getVoiceSettings(guildId: string): VoiceSettings | null {
    const row = this.db.prepare('SELECT * FROM voice_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToVoiceSettings(row) : null;
  }

  upsertVoiceSettings(input: Omit<VoiceSettings, 'updatedAt'>): VoiceSettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO voice_settings (
        guild_id, lobby_channel_id, category_id, log_channel_id, default_user_limit, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        lobby_channel_id = excluded.lobby_channel_id,
        category_id = excluded.category_id,
        log_channel_id = excluded.log_channel_id,
        default_user_limit = excluded.default_user_limit,
        updated_at = excluded.updated_at
    `).run(
      input.guildId,
      input.lobbyChannelId,
      input.categoryId,
      input.logChannelId,
      input.defaultUserLimit,
      now,
    );
    return { ...input, updatedAt: now };
  }

  createTempVoiceChannel(input: Omit<TempVoiceChannel, 'createdAt' | 'updatedAt'>): TempVoiceChannel {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO temp_voice_channels (guild_id, channel_id, owner_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, owner_id) DO UPDATE SET
        channel_id = excluded.channel_id,
        updated_at = excluded.updated_at
    `).run(input.guildId, input.channelId, input.ownerId, now, now);
    const record = this.getTempVoiceChannelByChannel(input.channelId);
    if (!record) throw new Error('Failed to create temporary voice channel record.');
    return record;
  }

  getTempVoiceChannelByChannel(channelId: string): TempVoiceChannel | null {
    const row = this.db.prepare('SELECT * FROM temp_voice_channels WHERE channel_id = ?').get(channelId) as Record<string, unknown> | undefined;
    return row ? rowToTempVoiceChannel(row) : null;
  }

  getTempVoiceChannelByOwner(guildId: string, ownerId: string): TempVoiceChannel | null {
    const row = this.db.prepare(`
      SELECT * FROM temp_voice_channels WHERE guild_id = ? AND owner_id = ?
    `).get(guildId, ownerId) as Record<string, unknown> | undefined;
    return row ? rowToTempVoiceChannel(row) : null;
  }

  listTempVoiceChannels(guildId?: string): TempVoiceChannel[] {
    const rows = guildId
      ? this.db.prepare('SELECT * FROM temp_voice_channels WHERE guild_id = ? ORDER BY created_at ASC').all(guildId)
      : this.db.prepare('SELECT * FROM temp_voice_channels ORDER BY created_at ASC').all();
    return (rows as Record<string, unknown>[]).map(rowToTempVoiceChannel);
  }

  transferTempVoiceOwnership(channelId: string, ownerId: string): TempVoiceChannel {
    const existing = this.getTempVoiceChannelByChannel(channelId);
    if (!existing) throw new Error('Temporary voice room no longer exists.');
    const conflict = this.getTempVoiceChannelByOwner(existing.guildId, ownerId);
    if (conflict && conflict.channelId !== channelId) {
      throw new Error('That member already owns another temporary voice room.');
    }
    this.db.prepare(`
      UPDATE temp_voice_channels SET owner_id = ?, updated_at = ? WHERE channel_id = ?
    `).run(ownerId, Date.now(), channelId);
    const updated = this.getTempVoiceChannelByChannel(channelId);
    if (!updated) throw new Error('Failed to transfer temporary voice ownership.');
    return updated;
  }

  deleteTempVoiceChannel(channelId: string): boolean {
    const result = this.db.prepare('DELETE FROM temp_voice_channels WHERE channel_id = ?').run(channelId);
    return Number(result.changes) > 0;
  }

  getLfgSettings(guildId: string): LfgSettings | null {
    const row = this.db.prepare('SELECT * FROM lfg_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToLfgSettings(row) : null;
  }

  upsertLfgSettings(input: Omit<LfgSettings, 'updatedAt'>): LfgSettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO lfg_settings (
        guild_id, forum_channel_id, panel_channel_id, log_channel_id,
        max_open_per_user, default_expiry_minutes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        forum_channel_id = excluded.forum_channel_id,
        panel_channel_id = excluded.panel_channel_id,
        log_channel_id = excluded.log_channel_id,
        max_open_per_user = excluded.max_open_per_user,
        default_expiry_minutes = excluded.default_expiry_minutes,
        updated_at = excluded.updated_at
    `).run(
      input.guildId,
      input.forumChannelId,
      input.panelChannelId,
      input.logChannelId,
      input.maxOpenPerUser,
      input.defaultExpiryMinutes,
      now,
    );
    return { ...input, updatedAt: now };
  }

  createLfgPost(input: Omit<LfgPost, 'id' | 'status' | 'createdAt' | 'closedAt' | 'closedBy' | 'closeReason'>): LfgPost {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO lfg_posts (
        guild_id, thread_id, starter_message_id, owner_id, game, mode,
        platform, region, notes, max_players, status, created_at,
        expires_at, closed_at, closed_by, close_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, NULL, NULL, NULL)
    `).run(
      input.guildId,
      input.threadId,
      input.starterMessageId,
      input.ownerId,
      input.game,
      input.mode,
      input.platform,
      input.region,
      input.notes,
      input.maxPlayers,
      now,
      input.expiresAt,
    );
    const row = this.db.prepare('SELECT * FROM lfg_posts WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to create LFG post.');
    return rowToLfgPost(row);
  }

  getLfgPostById(guildId: string, id: number): LfgPost | null {
    const row = this.db.prepare('SELECT * FROM lfg_posts WHERE guild_id = ? AND id = ?').get(guildId, id) as Record<string, unknown> | undefined;
    return row ? rowToLfgPost(row) : null;
  }

  getLfgPostByThread(threadId: string): LfgPost | null {
    const row = this.db.prepare('SELECT * FROM lfg_posts WHERE thread_id = ?').get(threadId) as Record<string, unknown> | undefined;
    return row ? rowToLfgPost(row) : null;
  }

  countActiveLfgPostsForOwner(guildId: string, ownerId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count FROM lfg_posts
      WHERE guild_id = ? AND owner_id = ? AND status IN ('open', 'full')
    `).get(guildId, ownerId) as Record<string, unknown> | undefined;
    return Number(row?.count ?? 0);
  }

  listActiveLfgPostsForOwner(guildId: string, ownerId: string, limit = 10): LfgPost[] {
    const rows = this.db.prepare(`
      SELECT * FROM lfg_posts
      WHERE guild_id = ? AND owner_id = ? AND status IN ('open', 'full')
      ORDER BY created_at DESC LIMIT ?
    `).all(guildId, ownerId, Math.max(1, Math.min(limit, 25))) as Record<string, unknown>[];
    return rows.map(rowToLfgPost);
  }

  listExpiredLfgPosts(now = Date.now()): LfgPost[] {
    const rows = this.db.prepare(`
      SELECT * FROM lfg_posts
      WHERE status IN ('open', 'full') AND expires_at <= ?
      ORDER BY expires_at ASC
    `).all(now) as Record<string, unknown>[];
    return rows.map(rowToLfgPost);
  }

  setLfgStatus(
    lfgId: number,
    status: LfgStatus,
    actorId: string | null = null,
    reason: string | null = null,
    expiresAt?: number,
  ): LfgPost {
    const closed = status === 'closed' || status === 'expired';
    const nextExpiry = expiresAt ?? null;
    this.db.prepare(`
      UPDATE lfg_posts SET
        status = ?,
        expires_at = CASE WHEN ? IS NULL THEN expires_at ELSE ? END,
        closed_at = ?,
        closed_by = ?,
        close_reason = ?
      WHERE id = ?
    `).run(
      status,
      nextExpiry,
      nextExpiry,
      closed ? Date.now() : null,
      closed ? actorId : null,
      closed ? reason : null,
      lfgId,
    );
    const row = this.db.prepare('SELECT * FROM lfg_posts WHERE id = ?').get(lfgId) as Record<string, unknown> | undefined;
    if (!row) throw new Error('LFG post no longer exists.');
    return rowToLfgPost(row);
  }

  listLfgParticipants(lfgId: number): LfgParticipant[] {
    const rows = this.db.prepare(`
      SELECT * FROM lfg_participants WHERE lfg_id = ? ORDER BY joined_at ASC
    `).all(lfgId) as Record<string, unknown>[];
    return rows.map(rowToLfgParticipant);
  }

  countLfgParticipants(lfgId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM lfg_participants WHERE lfg_id = ?').get(lfgId) as Record<string, unknown> | undefined;
    return Number(row?.count ?? 0);
  }

  addLfgParticipant(lfgId: number, userId: string): boolean {
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO lfg_participants (lfg_id, user_id, joined_at)
      VALUES (?, ?, ?)
    `).run(lfgId, userId, Date.now());
    return Number(result.changes) > 0;
  }

  removeLfgParticipant(lfgId: number, userId: string): boolean {
    const result = this.db.prepare('DELETE FROM lfg_participants WHERE lfg_id = ? AND user_id = ?').run(lfgId, userId);
    return Number(result.changes) > 0;
  }

  recordLfgEvent(
    lfgId: number | null,
    guildId: string,
    actorId: string,
    eventType: string,
    detail?: Record<string, unknown>,
  ): void {
    this.db.prepare(`
      INSERT INTO lfg_events (lfg_id, guild_id, actor_id, event_type, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(lfgId, guildId, actorId, eventType, detail ? JSON.stringify(detail) : null, Date.now());
  }

  deleteLfgPost(lfgId: number): void {
    this.db.prepare('DELETE FROM lfg_posts WHERE id = ?').run(lfgId);
  }

  getSecuritySettings(guildId: string): SecuritySettings | null {
    const row = this.db.prepare('SELECT * FROM security_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToSecuritySettings(row) : null;
  }

  upsertSecuritySettings(input: Omit<SecuritySettings, 'updatedAt'>): SecuritySettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO security_settings (
        guild_id, log_channel_id, quarantine_role_id, anti_spam_enabled,
        anti_phishing_enabled, anti_raid_enabled, anti_nuke_enabled,
        auto_lockdown_enabled, spam_message_limit, spam_window_seconds,
        duplicate_message_limit, mention_limit, auto_timeout_minutes,
        raid_join_limit, raid_window_seconds, nuke_action_limit,
        nuke_window_seconds, lockdown_minutes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        log_channel_id = excluded.log_channel_id,
        quarantine_role_id = excluded.quarantine_role_id,
        anti_spam_enabled = excluded.anti_spam_enabled,
        anti_phishing_enabled = excluded.anti_phishing_enabled,
        anti_raid_enabled = excluded.anti_raid_enabled,
        anti_nuke_enabled = excluded.anti_nuke_enabled,
        auto_lockdown_enabled = excluded.auto_lockdown_enabled,
        spam_message_limit = excluded.spam_message_limit,
        spam_window_seconds = excluded.spam_window_seconds,
        duplicate_message_limit = excluded.duplicate_message_limit,
        mention_limit = excluded.mention_limit,
        auto_timeout_minutes = excluded.auto_timeout_minutes,
        raid_join_limit = excluded.raid_join_limit,
        raid_window_seconds = excluded.raid_window_seconds,
        nuke_action_limit = excluded.nuke_action_limit,
        nuke_window_seconds = excluded.nuke_window_seconds,
        lockdown_minutes = excluded.lockdown_minutes,
        updated_at = excluded.updated_at
    `).run(
      input.guildId, input.logChannelId, input.quarantineRoleId,
      input.antiSpamEnabled ? 1 : 0, input.antiPhishingEnabled ? 1 : 0,
      input.antiRaidEnabled ? 1 : 0, input.antiNukeEnabled ? 1 : 0,
      input.autoLockdownEnabled ? 1 : 0, input.spamMessageLimit,
      input.spamWindowSeconds, input.duplicateMessageLimit, input.mentionLimit,
      input.autoTimeoutMinutes, input.raidJoinLimit, input.raidWindowSeconds,
      input.nukeActionLimit, input.nukeWindowSeconds, input.lockdownMinutes, now,
    );
    return { ...input, updatedAt: now };
  }

  recordSecurityEvent(input: Omit<SecurityEventRecord, 'id' | 'createdAt'>): SecurityEventRecord {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO security_events (guild_id, actor_id, target_id, event_type, severity, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.guildId, input.actorId, input.targetId, input.eventType, input.severity,
      input.detail ? JSON.stringify(input.detail) : null, now,
    );
    const row = this.db.prepare('SELECT * FROM security_events WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to create security event.');
    return rowToSecurityEvent(row);
  }

  addSecurityTrustedUser(guildId: string, userId: string, addedBy: string): void {
    this.db.prepare(`
      INSERT INTO security_trusted_users (guild_id, user_id, added_by, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET added_by = excluded.added_by, created_at = excluded.created_at
    `).run(guildId, userId, addedBy, Date.now());
  }

  removeSecurityTrustedUser(guildId: string, userId: string): boolean {
    const result = this.db.prepare('DELETE FROM security_trusted_users WHERE guild_id = ? AND user_id = ?').run(guildId, userId);
    return Number(result.changes) > 0;
  }

  isSecurityTrustedUser(guildId: string, userId: string): boolean {
    const row = this.db.prepare('SELECT 1 AS found FROM security_trusted_users WHERE guild_id = ? AND user_id = ?').get(guildId, userId) as Record<string, unknown> | undefined;
    return Boolean(row);
  }

  listSecurityTrustedUsers(guildId: string): string[] {
    const rows = this.db.prepare('SELECT user_id FROM security_trusted_users WHERE guild_id = ? ORDER BY created_at ASC').all(guildId) as Record<string, unknown>[];
    return rows.map((row) => String(row.user_id));
  }

  setSecurityLockdown(input: SecurityLockdown): void {
    this.db.prepare(`
      INSERT INTO security_lockdowns (guild_id, active, actor_id, reason, started_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        active = excluded.active, actor_id = excluded.actor_id, reason = excluded.reason,
        started_at = excluded.started_at, expires_at = excluded.expires_at
    `).run(input.guildId, input.active ? 1 : 0, input.actorId, input.reason, input.startedAt, input.expiresAt);
  }

  getSecurityLockdown(guildId: string): SecurityLockdown | null {
    const row = this.db.prepare('SELECT * FROM security_lockdowns WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToLockdown(row) : null;
  }

  listExpiredSecurityLockdowns(now = Date.now()): SecurityLockdown[] {
    const rows = this.db.prepare(`
      SELECT * FROM security_lockdowns WHERE active = 1 AND expires_at IS NOT NULL AND expires_at <= ?
    `).all(now) as Record<string, unknown>[];
    return rows.map(rowToLockdown);
  }

  replaceLockdownSnapshots(guildId: string, snapshots: LockdownSnapshot[]): void {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db.prepare('DELETE FROM security_lockdown_snapshots WHERE guild_id = ?').run(guildId);
      const statement = this.db.prepare(`
        INSERT INTO security_lockdown_snapshots (guild_id, channel_id, overwrite_existed, permissions)
        VALUES (?, ?, ?, ?)
      `);
      for (const snapshot of snapshots) {
        statement.run(guildId, snapshot.channelId, snapshot.overwriteExisted ? 1 : 0, JSON.stringify(snapshot.permissions));
      }
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  getLockdownSnapshots(guildId: string): LockdownSnapshot[] {
    const rows = this.db.prepare('SELECT * FROM security_lockdown_snapshots WHERE guild_id = ?').all(guildId) as Record<string, unknown>[];
    return rows.map((row) => ({
      guildId: String(row.guild_id),
      channelId: String(row.channel_id),
      overwriteExisted: Boolean(Number(row.overwrite_existed)),
      permissions: parseMetadata(row.permissions) as Record<string, boolean | null> ?? {},
    }));
  }

  clearLockdownSnapshots(guildId: string): void {
    this.db.prepare('DELETE FROM security_lockdown_snapshots WHERE guild_id = ?').run(guildId);
  }


  getRecreationSettings(guildId: string): RecreationSettings | null {
    const row = this.db.prepare('SELECT * FROM recreation_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToRecreationSettings(row) : null;
  }

  upsertRecreationSettings(input: Omit<RecreationSettings, 'updatedAt'>): RecreationSettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO recreation_settings (
        guild_id, giveaway_channel_id, event_channel_id, log_channel_id,
        notification_role_id, default_giveaway_minutes, default_event_reminder_minutes, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        giveaway_channel_id = excluded.giveaway_channel_id,
        event_channel_id = excluded.event_channel_id,
        log_channel_id = excluded.log_channel_id,
        notification_role_id = excluded.notification_role_id,
        default_giveaway_minutes = excluded.default_giveaway_minutes,
        default_event_reminder_minutes = excluded.default_event_reminder_minutes,
        updated_at = excluded.updated_at
    `).run(
      input.guildId,
      input.giveawayChannelId,
      input.eventChannelId,
      input.logChannelId,
      input.notificationRoleId,
      input.defaultGiveawayMinutes,
      input.defaultEventReminderMinutes,
      now,
    );
    return { ...input, updatedAt: now };
  }

  createGiveaway(input: Omit<GiveawayRecord, 'id' | 'status' | 'createdAt' | 'endedAt' | 'endedBy'>): GiveawayRecord {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO giveaways (
        guild_id, channel_id, message_id, host_id, prize, description,
        winner_count, required_role_id, minimum_level, status,
        created_at, ends_at, ended_at, ended_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NULL, NULL)
    `).run(
      input.guildId,
      input.channelId,
      input.messageId,
      input.hostId,
      input.prize,
      input.description,
      input.winnerCount,
      input.requiredRoleId,
      input.minimumLevel,
      now,
      input.endsAt,
    );
    const row = this.db.prepare('SELECT * FROM giveaways WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to create giveaway.');
    return rowToGiveaway(row);
  }

  getGiveaway(guildId: string, giveawayId: number): GiveawayRecord | null {
    const row = this.db.prepare('SELECT * FROM giveaways WHERE guild_id = ? AND id = ?').get(guildId, giveawayId) as Record<string, unknown> | undefined;
    return row ? rowToGiveaway(row) : null;
  }

  getGiveawayByMessageId(messageId: string): GiveawayRecord | null {
    const row = this.db.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId) as Record<string, unknown> | undefined;
    return row ? rowToGiveaway(row) : null;
  }

  listActiveGiveaways(guildId: string, limit = 20): GiveawayRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM giveaways WHERE guild_id = ? AND status = 'active'
      ORDER BY ends_at ASC LIMIT ?
    `).all(guildId, Math.max(1, Math.min(100, Math.trunc(limit)))) as Record<string, unknown>[];
    return rows.map(rowToGiveaway);
  }

  listDueGiveaways(now = Date.now()): GiveawayRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM giveaways WHERE status = 'active' AND ends_at <= ? ORDER BY ends_at ASC
    `).all(now) as Record<string, unknown>[];
    return rows.map(rowToGiveaway);
  }

  setGiveawayStatusIfActive(giveawayId: number, status: Exclude<GiveawayStatus, 'active'>, actorId: string, now = Date.now()): GiveawayRecord | null {
    const result = this.db.prepare(`
      UPDATE giveaways SET status = ?, ended_at = ?, ended_by = ?
      WHERE id = ? AND status = 'active'
    `).run(status, now, actorId, giveawayId);
    if (Number(result.changes) === 0) return null;
    const row = this.db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveawayId) as Record<string, unknown> | undefined;
    return row ? rowToGiveaway(row) : null;
  }

  addGiveawayEntry(giveawayId: number, userId: string, now = Date.now()): boolean {
    const result = this.db.prepare(`
      INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, entered_at) VALUES (?, ?, ?)
    `).run(giveawayId, userId, now);
    return Number(result.changes) > 0;
  }

  removeGiveawayEntry(giveawayId: number, userId: string): boolean {
    const result = this.db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveawayId, userId);
    return Number(result.changes) > 0;
  }

  hasGiveawayEntry(giveawayId: number, userId: string): boolean {
    const row = this.db.prepare('SELECT 1 AS found FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').get(giveawayId, userId) as Record<string, unknown> | undefined;
    return Boolean(row);
  }

  toggleGiveawayEntryIfActive(giveawayId: number, userId: string, now = Date.now()): 'entered' | 'left' | null {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const giveaway = this.db.prepare(`
        SELECT status, ends_at FROM giveaways WHERE id = ?
      `).get(giveawayId) as Record<string, unknown> | undefined;
      if (!giveaway || String(giveaway.status) !== 'active' || Number(giveaway.ends_at) <= now) {
        this.db.exec('ROLLBACK;');
        return null;
      }
      const existing = this.db.prepare(`
        SELECT 1 AS found FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?
      `).get(giveawayId, userId) as Record<string, unknown> | undefined;
      if (existing) {
        this.db.prepare('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?').run(giveawayId, userId);
        this.db.exec('COMMIT;');
        return 'left';
      }
      this.db.prepare(`
        INSERT INTO giveaway_entries (giveaway_id, user_id, entered_at) VALUES (?, ?, ?)
      `).run(giveawayId, userId, now);
      this.db.exec('COMMIT;');
      return 'entered';
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  countGiveawayEntries(giveawayId: number): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM giveaway_entries WHERE giveaway_id = ?').get(giveawayId) as Record<string, unknown> | undefined;
    return Number(row?.count ?? 0);
  }

  listGiveawayEntries(giveawayId: number): GiveawayEntry[] {
    const rows = this.db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ? ORDER BY entered_at ASC').all(giveawayId) as Record<string, unknown>[];
    return rows.map(rowToGiveawayEntry);
  }

  nextGiveawayDrawNumber(giveawayId: number): number {
    const row = this.db.prepare('SELECT COALESCE(MAX(draw_number), 0) + 1 AS next_draw FROM giveaway_winners WHERE giveaway_id = ?').get(giveawayId) as Record<string, unknown> | undefined;
    return Number(row?.next_draw ?? 1);
  }

  addGiveawayWinners(giveawayId: number, userIds: string[], drawNumber: number, now = Date.now()): GiveawayWinner[] {
    const statement = this.db.prepare(`
      INSERT INTO giveaway_winners (giveaway_id, user_id, draw_number, selected_at) VALUES (?, ?, ?, ?)
    `);
    const winners: GiveawayWinner[] = [];
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      for (const userId of userIds) {
        statement.run(giveawayId, userId, drawNumber, now);
        winners.push({ giveawayId, userId, drawNumber, selectedAt: now });
      }
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
    return winners;
  }

  recordGiveawayWinners(giveawayId: number, userIds: string[], now = Date.now()): GiveawayWinner[] {
    const statement = this.db.prepare(`
      INSERT INTO giveaway_winners (giveaway_id, user_id, draw_number, selected_at) VALUES (?, ?, ?, ?)
    `);
    const winners: GiveawayWinner[] = [];
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const row = this.db.prepare(`
        SELECT COALESCE(MAX(draw_number), 0) + 1 AS next_draw FROM giveaway_winners WHERE giveaway_id = ?
      `).get(giveawayId) as Record<string, unknown> | undefined;
      const drawNumber = Number(row?.next_draw ?? 1);
      for (const userId of userIds) {
        statement.run(giveawayId, userId, drawNumber, now);
        winners.push({ giveawayId, userId, drawNumber, selectedAt: now });
      }
      this.db.exec('COMMIT;');
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
    return winners;
  }

  listLatestGiveawayWinners(giveawayId: number): GiveawayWinner[] {
    const draw = this.db.prepare('SELECT MAX(draw_number) AS draw_number FROM giveaway_winners WHERE giveaway_id = ?').get(giveawayId) as Record<string, unknown> | undefined;
    const drawNumber = Number(draw?.draw_number ?? 0);
    if (drawNumber <= 0) return [];
    const rows = this.db.prepare(`
      SELECT * FROM giveaway_winners WHERE giveaway_id = ? AND draw_number = ? ORDER BY selected_at ASC, user_id ASC
    `).all(giveawayId, drawNumber) as Record<string, unknown>[];
    return rows.map(rowToGiveawayWinner);
  }

  createRecreationEvent(input: Omit<RecreationEventRecord, 'id' | 'status' | 'reminderSent' | 'createdAt' | 'updatedAt'>): RecreationEventRecord {
    const now = Date.now();
    const result = this.db.prepare(`
      INSERT INTO recreation_events (
        guild_id, channel_id, message_id, host_id, title, description, location,
        capacity, status, starts_at, ends_at, reminder_minutes, reminder_sent,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, 0, ?, ?)
    `).run(
      input.guildId,
      input.channelId,
      input.messageId,
      input.hostId,
      input.title,
      input.description,
      input.location,
      input.capacity,
      input.startsAt,
      input.endsAt,
      input.reminderMinutes,
      now,
      now,
    );
    const row = this.db.prepare('SELECT * FROM recreation_events WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to create event.');
    return rowToRecreationEvent(row);
  }

  getRecreationEvent(guildId: string, eventId: number): RecreationEventRecord | null {
    const row = this.db.prepare('SELECT * FROM recreation_events WHERE guild_id = ? AND id = ?').get(guildId, eventId) as Record<string, unknown> | undefined;
    return row ? rowToRecreationEvent(row) : null;
  }

  getRecreationEventByMessageId(messageId: string): RecreationEventRecord | null {
    const row = this.db.prepare('SELECT * FROM recreation_events WHERE message_id = ?').get(messageId) as Record<string, unknown> | undefined;
    return row ? rowToRecreationEvent(row) : null;
  }

  listScheduledRecreationEvents(guildId: string, limit = 20): RecreationEventRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM recreation_events WHERE guild_id = ? AND status = 'scheduled'
      ORDER BY starts_at ASC LIMIT ?
    `).all(guildId, Math.max(1, Math.min(100, Math.trunc(limit)))) as Record<string, unknown>[];
    return rows.map(rowToRecreationEvent);
  }

  listDueRecreationEventReminders(now = Date.now()): RecreationEventRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM recreation_events
      WHERE status = 'scheduled' AND reminder_sent = 0 AND reminder_minutes > 0
        AND (starts_at - (reminder_minutes * 60000)) <= ?
        AND starts_at > ?
      ORDER BY starts_at ASC
    `).all(now, now) as Record<string, unknown>[];
    return rows.map(rowToRecreationEvent);
  }

  listCompletedRecreationEvents(now = Date.now()): RecreationEventRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM recreation_events WHERE status = 'scheduled' AND ends_at <= ? ORDER BY ends_at ASC
    `).all(now) as Record<string, unknown>[];
    return rows.map(rowToRecreationEvent);
  }

  markRecreationEventReminderSent(eventId: number): void {
    this.db.prepare('UPDATE recreation_events SET reminder_sent = 1, updated_at = ? WHERE id = ?').run(Date.now(), eventId);
  }

  setRecreationEventStatus(eventId: number, status: Exclude<RecreationEventStatus, 'scheduled'>): RecreationEventRecord | null {
    const result = this.db.prepare(`
      UPDATE recreation_events SET status = ?, updated_at = ? WHERE id = ? AND status = 'scheduled'
    `).run(status, Date.now(), eventId);
    if (Number(result.changes) === 0) return null;
    const row = this.db.prepare('SELECT * FROM recreation_events WHERE id = ?').get(eventId) as Record<string, unknown> | undefined;
    return row ? rowToRecreationEvent(row) : null;
  }

  upsertRecreationEventRsvp(eventId: number, userId: string, response: RecreationEventResponse): RecreationEventRsvp {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO recreation_event_rsvps (event_id, user_id, response, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(event_id, user_id) DO UPDATE SET response = excluded.response, updated_at = excluded.updated_at
    `).run(eventId, userId, response, now);
    return { eventId, userId, response, updatedAt: now };
  }

  tryUpsertRecreationEventRsvp(
    eventId: number,
    userId: string,
    response: RecreationEventResponse,
    capacity: number,
    now = Date.now(),
  ): RecreationEventRsvp | null {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const event = this.db.prepare(`
        SELECT status, ends_at FROM recreation_events WHERE id = ?
      `).get(eventId) as Record<string, unknown> | undefined;
      if (!event || String(event.status) !== 'scheduled' || Number(event.ends_at) <= now) {
        this.db.exec('ROLLBACK;');
        return null;
      }
      if (response === 'going' && capacity > 0) {
        const existing = this.db.prepare(`
          SELECT response FROM recreation_event_rsvps WHERE event_id = ? AND user_id = ?
        `).get(eventId, userId) as Record<string, unknown> | undefined;
        if (String(existing?.response ?? '') !== 'going') {
          const count = this.db.prepare(`
            SELECT COUNT(*) AS count FROM recreation_event_rsvps WHERE event_id = ? AND response = 'going'
          `).get(eventId) as Record<string, unknown> | undefined;
          if (Number(count?.count ?? 0) >= capacity) {
            this.db.exec('ROLLBACK;');
            return null;
          }
        }
      }
      this.db.prepare(`
        INSERT INTO recreation_event_rsvps (event_id, user_id, response, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(event_id, user_id) DO UPDATE SET response = excluded.response, updated_at = excluded.updated_at
      `).run(eventId, userId, response, now);
      this.db.exec('COMMIT;');
      return { eventId, userId, response, updatedAt: now };
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  getRecreationEventRsvp(eventId: number, userId: string): RecreationEventRsvp | null {
    const row = this.db.prepare('SELECT * FROM recreation_event_rsvps WHERE event_id = ? AND user_id = ?').get(eventId, userId) as Record<string, unknown> | undefined;
    return row ? rowToRecreationEventRsvp(row) : null;
  }

  listRecreationEventRsvps(eventId: number): RecreationEventRsvp[] {
    const rows = this.db.prepare('SELECT * FROM recreation_event_rsvps WHERE event_id = ? ORDER BY updated_at ASC').all(eventId) as Record<string, unknown>[];
    return rows.map(rowToRecreationEventRsvp);
  }

  countRecreationEventRsvps(eventId: number, response: RecreationEventResponse): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM recreation_event_rsvps WHERE event_id = ? AND response = ?').get(eventId, response) as Record<string, unknown> | undefined;
    return Number(row?.count ?? 0);
  }



  getCommunitySettings(guildId: string): CommunitySettings | null {
    const row = this.db.prepare('SELECT * FROM community_settings WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    return row ? rowToCommunitySettings(row) : null;
  }

  upsertCommunitySettings(input: Omit<CommunitySettings, 'updatedAt'>): CommunitySettings {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO community_settings (
        guild_id, log_channel_id, currency_name, starting_balance, daily_reward,
        daily_cooldown_hours, work_min, work_max, work_cooldown_minutes,
        counting_channel_id, counting_reset_on_mistake, counting_delete_invalid,
        starboard_channel_id, star_threshold, star_emoji, allow_self_star, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        log_channel_id = excluded.log_channel_id,
        currency_name = excluded.currency_name,
        starting_balance = excluded.starting_balance,
        daily_reward = excluded.daily_reward,
        daily_cooldown_hours = excluded.daily_cooldown_hours,
        work_min = excluded.work_min,
        work_max = excluded.work_max,
        work_cooldown_minutes = excluded.work_cooldown_minutes,
        counting_channel_id = excluded.counting_channel_id,
        counting_reset_on_mistake = excluded.counting_reset_on_mistake,
        counting_delete_invalid = excluded.counting_delete_invalid,
        starboard_channel_id = excluded.starboard_channel_id,
        star_threshold = excluded.star_threshold,
        star_emoji = excluded.star_emoji,
        allow_self_star = excluded.allow_self_star,
        updated_at = excluded.updated_at
    `).run(
      input.guildId, input.logChannelId, input.currencyName, input.startingBalance,
      input.dailyReward, input.dailyCooldownHours, input.workMin, input.workMax,
      input.workCooldownMinutes, input.countingChannelId,
      input.countingResetOnMistake ? 1 : 0, input.countingDeleteInvalid ? 1 : 0,
      input.starboardChannelId, input.starThreshold, input.starEmoji,
      input.allowSelfStar ? 1 : 0, now,
    );
    this.getCountingState(input.guildId);
    return { ...input, updatedAt: now };
  }

  private recordEconomyTransaction(
    guildId: string,
    userId: string,
    actorId: string,
    transactionType: string,
    amount: number,
    balanceAfter: number,
    counterpartyId: string | null,
    detail: string | null,
    now: number,
  ): void {
    this.db.prepare(`
      INSERT INTO economy_transactions (
        guild_id, user_id, actor_id, transaction_type, amount,
        balance_after, counterparty_id, detail, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(guildId, userId, actorId, transactionType, amount, balanceAfter, counterpartyId, detail, now);
  }

  getOrCreateEconomyAccount(guildId: string, userId: string, startingBalance = 0, now = Date.now()): EconomyAccount {
    this.db.prepare(`
      INSERT OR IGNORE INTO economy_accounts (
        guild_id, user_id, balance, last_daily_at, last_work_at, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, NULL, ?, ?)
    `).run(guildId, userId, Math.max(0, Math.floor(startingBalance)), now, now);
    const row = this.db.prepare('SELECT * FROM economy_accounts WHERE guild_id = ? AND user_id = ?').get(guildId, userId) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to load economy account.');
    return rowToEconomyAccount(row);
  }

  claimEconomyDaily(
    guildId: string,
    userId: string,
    startingBalance: number,
    reward: number,
    cooldownHours: number,
    now = Date.now(),
  ): EconomyClaimResult {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const account = this.getOrCreateEconomyAccount(guildId, userId, startingBalance, now);
      const cooldownMs = Math.max(1, cooldownHours) * 3_600_000;
      const nextAt = account.lastDailyAt === null ? null : account.lastDailyAt + cooldownMs;
      if (nextAt !== null && now < nextAt) {
        this.db.exec('COMMIT;');
        return { account, claimed: false, amount: 0, nextAt };
      }
      const amount = Math.max(0, Math.floor(reward));
      const balance = account.balance + amount;
      this.db.prepare(`
        UPDATE economy_accounts SET balance = ?, last_daily_at = ?, updated_at = ?
        WHERE guild_id = ? AND user_id = ?
      `).run(balance, now, now, guildId, userId);
      this.recordEconomyTransaction(guildId, userId, userId, 'daily', amount, balance, null, null, now);
      const updated = this.getOrCreateEconomyAccount(guildId, userId, startingBalance, now);
      this.db.exec('COMMIT;');
      return { account: updated, claimed: true, amount, nextAt: now + cooldownMs };
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  claimEconomyWork(
    guildId: string,
    userId: string,
    startingBalance: number,
    amount: number,
    cooldownMinutes: number,
    now = Date.now(),
  ): EconomyClaimResult {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const account = this.getOrCreateEconomyAccount(guildId, userId, startingBalance, now);
      const cooldownMs = Math.max(1, cooldownMinutes) * 60_000;
      const nextAt = account.lastWorkAt === null ? null : account.lastWorkAt + cooldownMs;
      if (nextAt !== null && now < nextAt) {
        this.db.exec('COMMIT;');
        return { account, claimed: false, amount: 0, nextAt };
      }
      const earned = Math.max(0, Math.floor(amount));
      const balance = account.balance + earned;
      this.db.prepare(`
        UPDATE economy_accounts SET balance = ?, last_work_at = ?, updated_at = ?
        WHERE guild_id = ? AND user_id = ?
      `).run(balance, now, now, guildId, userId);
      this.recordEconomyTransaction(guildId, userId, userId, 'work', earned, balance, null, null, now);
      const updated = this.getOrCreateEconomyAccount(guildId, userId, startingBalance, now);
      this.db.exec('COMMIT;');
      return { account: updated, claimed: true, amount: earned, nextAt: now + cooldownMs };
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  transferEconomy(
    guildId: string,
    senderId: string,
    recipientId: string,
    amount: number,
    startingBalance: number,
    now = Date.now(),
  ): EconomyTransferResult | null {
    const transferAmount = Math.floor(amount);
    if (transferAmount <= 0 || senderId === recipientId) return null;
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const sender = this.getOrCreateEconomyAccount(guildId, senderId, startingBalance, now);
      const recipient = this.getOrCreateEconomyAccount(guildId, recipientId, startingBalance, now);
      if (sender.balance < transferAmount) {
        this.db.exec('ROLLBACK;');
        return null;
      }
      const senderBalance = sender.balance - transferAmount;
      const recipientBalance = recipient.balance + transferAmount;
      this.db.prepare('UPDATE economy_accounts SET balance = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?').run(senderBalance, now, guildId, senderId);
      this.db.prepare('UPDATE economy_accounts SET balance = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?').run(recipientBalance, now, guildId, recipientId);
      this.recordEconomyTransaction(guildId, senderId, senderId, 'transfer_out', -transferAmount, senderBalance, recipientId, null, now);
      this.recordEconomyTransaction(guildId, recipientId, senderId, 'transfer_in', transferAmount, recipientBalance, senderId, null, now);
      const updatedSender = this.getOrCreateEconomyAccount(guildId, senderId, startingBalance, now);
      const updatedRecipient = this.getOrCreateEconomyAccount(guildId, recipientId, startingBalance, now);
      this.db.exec('COMMIT;');
      return { sender: updatedSender, recipient: updatedRecipient, amount: transferAmount };
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  adjustEconomyBalance(
    guildId: string,
    userId: string,
    actorId: string,
    operation: 'add' | 'remove' | 'set',
    amount: number,
    startingBalance: number,
    now = Date.now(),
  ): EconomyAccount {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const account = this.getOrCreateEconomyAccount(guildId, userId, startingBalance, now);
      const value = Math.max(0, Math.floor(amount));
      const balance = operation === 'set'
        ? value
        : operation === 'add'
          ? account.balance + value
          : Math.max(0, account.balance - value);
      const delta = balance - account.balance;
      this.db.prepare('UPDATE economy_accounts SET balance = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?').run(balance, now, guildId, userId);
      this.recordEconomyTransaction(guildId, userId, actorId, `admin_${operation}`, delta, balance, null, null, now);
      const updated = this.getOrCreateEconomyAccount(guildId, userId, startingBalance, now);
      this.db.exec('COMMIT;');
      return updated;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  listEconomyLeaderboard(guildId: string, limit = 10, offset = 0): EconomyAccount[] {
    const rows = this.db.prepare(`
      SELECT * FROM economy_accounts WHERE guild_id = ?
      ORDER BY balance DESC, updated_at ASC, user_id ASC LIMIT ? OFFSET ?
    `).all(guildId, Math.max(1, limit), Math.max(0, offset)) as Record<string, unknown>[];
    return rows.map(rowToEconomyAccount);
  }

  getEconomyRank(guildId: string, userId: string): number | null {
    const account = this.db.prepare('SELECT balance FROM economy_accounts WHERE guild_id = ? AND user_id = ?').get(guildId, userId) as Record<string, unknown> | undefined;
    if (!account) return null;
    const row = this.db.prepare(`
      SELECT COUNT(*) + 1 AS rank FROM economy_accounts
      WHERE guild_id = ? AND balance > ?
    `).get(guildId, Number(account.balance)) as Record<string, unknown> | undefined;
    return Number(row?.rank ?? 1);
  }

  getCountingState(guildId: string, now = Date.now()): CountingState {
    this.db.prepare(`
      INSERT OR IGNORE INTO counting_state (guild_id, current_number, last_user_id, current_message_id, high_score, updated_at)
      VALUES (?, 0, NULL, NULL, 0, ?)
    `).run(guildId, now);
    const row = this.db.prepare('SELECT * FROM counting_state WHERE guild_id = ?').get(guildId) as Record<string, unknown> | undefined;
    if (!row) throw new Error('Failed to load counting state.');
    return rowToCountingState(row);
  }

  processCount(
    guildId: string,
    userId: string,
    number: number,
    resetOnMistake: boolean,
    now = Date.now(),
    messageId: string | null = null,
  ): CountProcessResult {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const state = this.getCountingState(guildId, now);
      const expected = state.currentNumber + 1;
      if (state.lastUserId === userId) {
        this.db.exec('COMMIT;');
        return { status: 'same_user', expected, state, reset: false };
      }
      if (number !== expected) {
        let nextState = state;
        if (resetOnMistake && state.currentNumber > 0) {
          this.db.prepare(`
            UPDATE counting_state SET current_number = 0, last_user_id = NULL, current_message_id = NULL, updated_at = ? WHERE guild_id = ?
          `).run(now, guildId);
          nextState = this.getCountingState(guildId, now);
        }
        this.db.exec('COMMIT;');
        return { status: 'wrong', expected, state: nextState, reset: resetOnMistake && state.currentNumber > 0 };
      }
      const highScore = Math.max(state.highScore, number);
      this.db.prepare(`
        UPDATE counting_state SET current_number = ?, last_user_id = ?, current_message_id = ?, high_score = ?, updated_at = ? WHERE guild_id = ?
      `).run(number, userId, messageId, highScore, now, guildId);
      const updated = this.getCountingState(guildId, now);
      this.db.exec('COMMIT;');
      return { status: 'accepted', expected, state: updated, reset: false };
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  resetCountingState(guildId: string, now = Date.now()): CountingState {
    const previous = this.getCountingState(guildId, now);
    this.db.prepare(`
      UPDATE counting_state SET current_number = 0, last_user_id = NULL, current_message_id = NULL, high_score = ?, updated_at = ? WHERE guild_id = ?
    `).run(previous.highScore, now, guildId);
    return this.getCountingState(guildId, now);
  }

  resetCountingIfCurrentMessage(guildId: string, messageId: string, now = Date.now()): CountingState | null {
    const state = this.getCountingState(guildId, now);
    if (state.currentMessageId !== messageId) return null;
    return this.resetCountingState(guildId, now);
  }

  getStarboardRecord(guildId: string, sourceMessageId: string): StarboardRecord | null {
    const row = this.db.prepare('SELECT * FROM starboard_records WHERE guild_id = ? AND source_message_id = ?').get(guildId, sourceMessageId) as Record<string, unknown> | undefined;
    return row ? rowToStarboardRecord(row) : null;
  }

  getStarboardRecordByBoardMessage(starboardMessageId: string): StarboardRecord | null {
    const row = this.db.prepare('SELECT * FROM starboard_records WHERE starboard_message_id = ?').get(starboardMessageId) as Record<string, unknown> | undefined;
    return row ? rowToStarboardRecord(row) : null;
  }

  upsertStarboardRecord(input: Omit<StarboardRecord, 'createdAt' | 'updatedAt'>, now = Date.now()): StarboardRecord {
    this.db.prepare(`
      INSERT INTO starboard_records (
        guild_id, source_message_id, source_channel_id, starboard_message_id,
        author_id, star_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, source_message_id) DO UPDATE SET
        source_channel_id = excluded.source_channel_id,
        starboard_message_id = excluded.starboard_message_id,
        author_id = excluded.author_id,
        star_count = excluded.star_count,
        updated_at = excluded.updated_at
    `).run(
      input.guildId, input.sourceMessageId, input.sourceChannelId,
      input.starboardMessageId, input.authorId, input.starCount, now, now,
    );
    const record = this.getStarboardRecord(input.guildId, input.sourceMessageId);
    if (!record) throw new Error('Failed to save starboard record.');
    return record;
  }

  deleteStarboardRecord(guildId: string, sourceMessageId: string): boolean {
    const result = this.db.prepare('DELETE FROM starboard_records WHERE guild_id = ? AND source_message_id = ?').run(guildId, sourceMessageId);
    return Number(result.changes) > 0;
  }

  deleteStarboardRecordByBoardMessage(starboardMessageId: string): boolean {
    const result = this.db.prepare('DELETE FROM starboard_records WHERE starboard_message_id = ?').run(starboardMessageId);
    return Number(result.changes) > 0;
  }

}

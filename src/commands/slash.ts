import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const hitCommand = new SlashCommandBuilder()
  .setName('hit')
  .setDescription('Configure and manage HIT.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) => subcommand
    .setName('setup')
    .setDescription('Configure verification and automatic role cleanup.')
    .addRoleOption((option) => option.setName('unverified_role').setDescription('Role given when a member joins.').setRequired(true))
    .addRoleOption((option) => option.setName('verified_role').setDescription('Role given after verification.').setRequired(true))
    .addChannelOption((option) => option.setName('verification_channel').setDescription('Channel containing the verification panel.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((option) => option.setName('log_channel').setDescription('Optional private verification log channel.').addChannelTypes(ChannelType.GuildText))
    .addIntegerOption((option) => option.setName('minimum_account_age_days').setDescription('Minimum account age; 0 disables this check.').setMinValue(0).setMaxValue(365))
    .addIntegerOption((option) => option.setName('verification_timeout_minutes').setDescription('Kick unverified members after this many minutes; 0 disables.').setMinValue(0).setMaxValue(10080)))
  .addSubcommand((subcommand) => subcommand
    .setName('panel')
    .setDescription('Post the HIT verification panel.')
    .addChannelOption((option) => option.setName('channel').setDescription('Optional panel channel.').addChannelTypes(ChannelType.GuildText)))
  .addSubcommand((subcommand) => subcommand.setName('diagnose').setDescription('Check HIT verification permissions, roles, and channels.'))
  .addSubcommand((subcommand) => subcommand.setName('config').setDescription('Show the active HIT verification configuration.'))
  .addSubcommand((subcommand) => subcommand
    .setName('tickets-setup')
    .setDescription('Configure HIT support tickets.')
    .addChannelOption((option) => option.setName('category').setDescription('Category where private ticket channels are created.').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addChannelOption((option) => option.setName('panel_channel').setDescription('Channel where the ticket panel is posted.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption((option) => option.setName('support_role').setDescription('Staff role allowed to manage tickets.').setRequired(true))
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private channel for transcripts and ticket logs.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addIntegerOption((option) => option.setName('max_open_per_user').setDescription('Maximum open tickets per member.').setMinValue(1).setMaxValue(5)))
  .addSubcommand((subcommand) => subcommand
    .setName('tickets-panel')
    .setDescription('Post the HIT support ticket panel.')
    .addChannelOption((option) => option.setName('channel').setDescription('Optional panel channel override.').addChannelTypes(ChannelType.GuildText)))
  .addSubcommand((subcommand) => subcommand.setName('tickets-diagnose').setDescription('Check HIT ticket permissions and configuration.'))
  .addSubcommand((subcommand) => subcommand.setName('tickets-config').setDescription('Show the active HIT ticket configuration.'))
  .addSubcommand((subcommand) => subcommand
    .setName('moderation-setup')
    .setDescription('Configure HIT moderation logging.')
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private channel for moderation cases and actions.').addChannelTypes(ChannelType.GuildText).setRequired(true)))
  .addSubcommand((subcommand) => subcommand.setName('moderation-diagnose').setDescription('Check HIT moderation permissions and logging.'))
  .addSubcommand((subcommand) => subcommand.setName('moderation-config').setDescription('Show the active HIT moderation configuration.'))
  .addSubcommand((subcommand) => subcommand
    .setName('security-setup')
    .setDescription('Configure HIT security protection and incident logging.')
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private security alert and incident channel.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption((option) => option.setName('quarantine_role').setDescription('Optional restricted role added during anti-nuke containment.'))
    .addBooleanOption((option) => option.setName('anti_spam').setDescription('Delete spam and timeout repeat offenders.'))
    .addBooleanOption((option) => option.setName('anti_phishing').setDescription('Delete high-confidence phishing and tracking links.'))
    .addBooleanOption((option) => option.setName('anti_raid').setDescription('Detect mass joins and raise raid alerts.'))
    .addBooleanOption((option) => option.setName('anti_nuke').setDescription('Contain untrusted accounts performing destructive actions.'))
    .addBooleanOption((option) => option.setName('auto_lockdown').setDescription('Automatically lock the server during confirmed raids or nukes.')))
  .addSubcommand((subcommand) => subcommand.setName('security-diagnose').setDescription('Check HIT security permissions, roles, and logging.'))
  .addSubcommand((subcommand) => subcommand.setName('security-config').setDescription('Show the active HIT security configuration.'))
  .addSubcommand((subcommand) => subcommand
    .setName('lfg-setup')
    .setDescription('Configure HIT looking-for-group posts.')
    .addChannelOption((option) => option.setName('forum').setDescription('Forum channel where LFG posts are created.').addChannelTypes(ChannelType.GuildForum).setRequired(true))
    .addChannelOption((option) => option.setName('panel_channel').setDescription('Text channel for the Create LFG panel.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private channel for LFG activity logs.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addIntegerOption((option) => option.setName('max_open_per_user').setDescription('Maximum active LFG posts per member.').setMinValue(1).setMaxValue(5))
    .addIntegerOption((option) => option.setName('default_expiry_minutes').setDescription('Default post lifetime in minutes.').setMinValue(15).setMaxValue(10080)))
  .addSubcommand((subcommand) => subcommand
    .setName('lfg-panel')
    .setDescription('Post the HIT LFG creation panel.')
    .addChannelOption((option) => option.setName('channel').setDescription('Optional panel channel override.').addChannelTypes(ChannelType.GuildText)))
  .addSubcommand((subcommand) => subcommand.setName('lfg-diagnose').setDescription('Check HIT LFG channels and permissions.'))
  .addSubcommand((subcommand) => subcommand.setName('lfg-config').setDescription('Show the active HIT LFG configuration.'))
  .addSubcommand((subcommand) => subcommand
    .setName('voice-setup')
    .setDescription('Configure HIT join-to-create temporary voice rooms.')
    .addChannelOption((option) => option.setName('lobby').setDescription('Voice channel members join to create a room.').addChannelTypes(ChannelType.GuildVoice).setRequired(true))
    .addChannelOption((option) => option.setName('category').setDescription('Category where temporary rooms are created.').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private channel for temporary voice activity logs.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addIntegerOption((option) => option.setName('default_user_limit').setDescription('Default room capacity; 0 is unlimited.').setMinValue(0).setMaxValue(99)))
  .addSubcommand((subcommand) => subcommand.setName('voice-diagnose').setDescription('Check HIT temporary voice permissions and configuration.'))
  .addSubcommand((subcommand) => subcommand.setName('voice-config').setDescription('Show the active HIT temporary voice configuration.'))
  .addSubcommand((subcommand) => subcommand
    .setName('levels-setup')
    .setDescription('Configure HIT message and voice XP.')
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private channel for level activity logs.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    .addChannelOption((option) => option.setName('announce_channel').setDescription('Optional channel for level-up announcements.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addIntegerOption((option) => option.setName('message_xp_min').setDescription('Minimum XP awarded per eligible message.').setMinValue(1).setMaxValue(100))
    .addIntegerOption((option) => option.setName('message_xp_max').setDescription('Maximum XP awarded per eligible message.').setMinValue(1).setMaxValue(100))
    .addIntegerOption((option) => option.setName('message_cooldown_seconds').setDescription('Message XP cooldown in seconds.').setMinValue(10).setMaxValue(600))
    .addIntegerOption((option) => option.setName('voice_xp_per_minute').setDescription('XP awarded per eligible voice minute; 0 disables.').setMinValue(0).setMaxValue(100))
    .addIntegerOption((option) => option.setName('voice_min_members').setDescription('Active non-bot members required in voice.').setMinValue(1).setMaxValue(10))
    .addBooleanOption((option) => option.setName('announce_level_ups').setDescription('Post level-up announcements.'))
    .addBooleanOption((option) => option.setName('stack_reward_roles').setDescription('Keep every earned reward role instead of only the highest.')))
  .addSubcommand((subcommand) => subcommand.setName('levels-diagnose').setDescription('Check HIT level channels, permissions, and reward roles.'))
  .addSubcommand((subcommand) => subcommand.setName('levels-config').setDescription('Show the active HIT levels configuration.'))
  .addSubcommand((subcommand) => subcommand
    .setName('levels-manage')
    .setDescription('Manage XP exclusions, status, or a memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s XP.')
    .addStringOption((option) => option.setName('action').setDescription('Management action.').setRequired(true).addChoices(
      { name: 'Enable levels', value: 'enable' },
      { name: 'Disable levels', value: 'disable' },
      { name: 'Exclude channel or category', value: 'exclude-channel' },
      { name: 'Include channel or category', value: 'include-channel' },
      { name: 'Exclude role', value: 'exclude-role' },
      { name: 'Include role', value: 'include-role' },
      { name: 'Add XP', value: 'add-xp' },
      { name: 'Remove XP', value: 'remove-xp' },
      { name: 'Set XP', value: 'set-xp' },
      { name: 'Reset user XP', value: 'reset-user' },
      { name: 'Sync user reward roles', value: 'sync-user' },
        { name: 'Sync all member reward roles', value: 'sync-all' },
      { name: 'Add reward role', value: 'add-reward' },
      { name: 'Remove reward role', value: 'remove-reward' },
      { name: 'List reward roles', value: 'list-rewards' },
    ))
    .addChannelOption((option) => option.setName('channel').setDescription('Channel or category for an exclusion action.').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.GuildCategory, ChannelType.GuildForum))
    .addRoleOption((option) => option.setName('role').setDescription('Role for an exclusion or reward action.'))
    .addIntegerOption((option) => option.setName('level').setDescription('Level for a reward action.').setMinValue(1).setMaxValue(500))
    .addUserOption((option) => option.setName('user').setDescription('Member for an XP action.'))
    .addIntegerOption((option) => option.setName('amount').setDescription('XP amount for add, remove, or set.').setMinValue(0).setMaxValue(1000000000)));

export const ticketCommand = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Open and manage HIT support tickets.')
  .addSubcommand((subcommand) => subcommand
    .setName('open')
    .setDescription('Open a private support ticket.')
    .addStringOption((option) => option
      .setName('type')
      .setDescription('Choose the ticket category.')
      .setRequired(true)
      .addChoices(
        { name: 'General Support', value: 'general' },
        { name: 'Report Member', value: 'report' },
        { name: 'Punishment Appeal', value: 'appeal' },
        { name: 'Verification Help', value: 'verification' },
        { name: 'Business / Partnership', value: 'partnership' },
      )))
  .addSubcommand((subcommand) => subcommand.setName('claim').setDescription('Claim the current ticket.'))
  .addSubcommand((subcommand) => subcommand.setName('close').setDescription('Close the current ticket and save a transcript.'))
  .addSubcommand((subcommand) => subcommand.setName('reopen').setDescription('Reopen the current ticket.'))
  .addSubcommand((subcommand) => subcommand
    .setName('add')
    .setDescription('Add a member to the current ticket.')
    .addUserOption((option) => option.setName('user').setDescription('Member to add.').setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('remove')
    .setDescription('Remove a member from the current ticket.')
    .addUserOption((option) => option.setName('user').setDescription('Member to remove.').setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('rename')
    .setDescription('Rename the current ticket.')
    .addStringOption((option) => option.setName('name').setDescription('New ticket name.').setMinLength(1).setMaxLength(60).setRequired(true)))
  .addSubcommand((subcommand) => subcommand.setName('transcript').setDescription('Save a transcript of the current ticket.'));



export const modCommand = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('HIT moderation, cases, warnings, and channel controls.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand((subcommand) => subcommand
    .setName('warn')
    .setDescription('Warn a member and create a permanent moderation case.')
    .addUserOption((option) => option.setName('user').setDescription('Member to warn.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the warning.').setMinLength(2).setMaxLength(500).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('warnings')
    .setDescription('View a memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s active warnings.')
    .addUserOption((option) => option.setName('user').setDescription('Member to inspect.').setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('clearwarnings')
    .setDescription('Clear all active warnings for a member.')
    .addUserOption((option) => option.setName('user').setDescription('Member whose warnings will be cleared.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for clearing the warnings.').setMinLength(2).setMaxLength(500).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('timeout')
    .setDescription('Timeout a member for up to 28 days.')
    .addUserOption((option) => option.setName('user').setDescription('Member to timeout.').setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription('Examples: 10m, 2h, 3d, 1w.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the timeout.').setMinLength(2).setMaxLength(500).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('untimeout')
    .setDescription('Remove a memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s timeout.')
    .addUserOption((option) => option.setName('user').setDescription('Member whose timeout will be removed.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for removing the timeout.').setMinLength(2).setMaxLength(500).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('kick')
    .setDescription('Kick a member after confirmation.')
    .addUserOption((option) => option.setName('user').setDescription('Member to kick.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the kick.').setMinLength(2).setMaxLength(500).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('ban')
    .setDescription('Ban a user after confirmation.')
    .addUserOption((option) => option.setName('user').setDescription('User to ban.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the ban.').setMinLength(2).setMaxLength(500).setRequired(true))
    .addIntegerOption((option) => option.setName('delete_days').setDescription('Delete 0ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Å“7 days of recent messages.').setMinValue(0).setMaxValue(7)))
  .addSubcommand((subcommand) => subcommand
    .setName('unban')
    .setDescription('Unban a user by Discord ID.')
    .addStringOption((option) => option.setName('user_id').setDescription('Discord user ID.').setMinLength(17).setMaxLength(20).setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the unban.').setMinLength(2).setMaxLength(500).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('purge')
    .setDescription('Delete recent messages in this channel.')
    .addIntegerOption((option) => option.setName('amount').setDescription('Messages to delete.').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption((option) => option.setName('user').setDescription('Optional member filter.')))
  .addSubcommand((subcommand) => subcommand
    .setName('slowmode')
    .setDescription('Set or disable channel slowmode.')
    .addIntegerOption((option) => option.setName('seconds').setDescription('0 disables slowmode; maximum 21600.').setMinValue(0).setMaxValue(21600).setRequired(true)))
  .addSubcommand((subcommand) => subcommand.setName('lock').setDescription('Lock the current channel for @everyone.'))
  .addSubcommand((subcommand) => subcommand.setName('unlock').setDescription('Restore inherited messaging permissions for @everyone.'))
  .addSubcommand((subcommand) => subcommand
    .setName('nick')
    .setDescription('Change or reset a memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s nickname.')
    .addUserOption((option) => option.setName('user').setDescription('Member to update.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the nickname change.').setMinLength(2).setMaxLength(500).setRequired(true))
    .addStringOption((option) => option.setName('nickname').setDescription('New nickname; omit to reset.').setMaxLength(32)))
  .addSubcommand((subcommand) => subcommand
    .setName('role-add')
    .setDescription('Add a manageable role to a member.')
    .addUserOption((option) => option.setName('user').setDescription('Member to update.').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Role to add.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the role change.').setMinLength(2).setMaxLength(500).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('role-remove')
    .setDescription('Remove a manageable role from a member.')
    .addUserOption((option) => option.setName('user').setDescription('Member to update.').setRequired(true))
    .addRoleOption((option) => option.setName('role').setDescription('Role to remove.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason for the role change.').setMinLength(2).setMaxLength(500).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('case')
    .setDescription('View one moderation case by ID.')
    .addIntegerOption((option) => option.setName('id').setDescription('Case ID.').setMinValue(1).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('history')
    .setDescription('View a memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s recent moderation history.')
    .addUserOption((option) => option.setName('user').setDescription('Member to inspect.').setRequired(true))
    .addIntegerOption((option) => option.setName('limit').setDescription('Cases to show.').setMinValue(1).setMaxValue(25)));




export const lfgCommand = new SlashCommandBuilder()
  .setName('lfg')
  .setDescription('Create and manage HIT looking-for-group posts.')
  .addSubcommand((subcommand) => subcommand
    .setName('create')
    .setDescription('Open the guided LFG creation form.'))
  .addSubcommand((subcommand) => subcommand
    .setName('mine')
    .setDescription('Show your active LFG posts.'))
  .addSubcommand((subcommand) => subcommand
    .setName('status')
    .setDescription('Show the current LFG thread status.'))
  .addSubcommand((subcommand) => subcommand
    .setName('close')
    .setDescription('Close the current LFG thread.')
    .addStringOption((option) => option.setName('reason').setDescription('Optional close reason.').setMinLength(2).setMaxLength(300)))
  .addSubcommand((subcommand) => subcommand
    .setName('reopen')
    .setDescription('Reopen the current LFG thread with a fresh timer.'))
  .addSubcommand((subcommand) => subcommand
    .setName('delete')
    .setDescription('Permanently delete the current LFG thread.'));



export const voiceCommand = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('Manage your HIT temporary voice room.')
  .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show the current temporary room status.'))
  .addSubcommand((subcommand) => subcommand
    .setName('rename')
    .setDescription('Rename your temporary voice room.')
    .addStringOption((option) => option.setName('name').setDescription('New room name.').setMinLength(1).setMaxLength(80).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('limit')
    .setDescription('Set the room capacity; 0 is unlimited.')
    .addIntegerOption((option) => option.setName('amount').setDescription('User limit from 0 to 99.').setMinValue(0).setMaxValue(99).setRequired(true)))
  .addSubcommand((subcommand) => subcommand.setName('lock').setDescription('Prevent regular members from connecting.'))
  .addSubcommand((subcommand) => subcommand.setName('unlock').setDescription('Allow regular members to connect again.'))
  .addSubcommand((subcommand) => subcommand.setName('hide').setDescription('Hide the room from regular members.'))
  .addSubcommand((subcommand) => subcommand.setName('show').setDescription('Make the room visible again.'))
  .addSubcommand((subcommand) => subcommand
    .setName('permit')
    .setDescription('Allow a member to view and connect to your room.')
    .addUserOption((option) => option.setName('user').setDescription('Member to permit.').setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('reject')
    .setDescription('Remove a member and prevent them from reconnecting.')
    .addUserOption((option) => option.setName('user').setDescription('Member to reject.').setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('transfer')
    .setDescription('Transfer ownership to a member in the room.')
    .addUserOption((option) => option.setName('user').setDescription('New room owner.').setRequired(true)))
  .addSubcommand((subcommand) => subcommand.setName('claim').setDescription('Claim an ownerless room when the owner has left.'))
  .addSubcommand((subcommand) => subcommand.setName('close').setDescription('Close and delete your temporary voice room.'));



export const levelCommand = new SlashCommandBuilder()
  .setName('level')
  .setDescription('View HIT levels, rankings, and rewards.')
  .addSubcommand((subcommand) => subcommand
    .setName('rank')
    .setDescription('Show your rank or another memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s rank.')
    .addUserOption((option) => option.setName('user').setDescription('Optional member to inspect.')))
  .addSubcommand((subcommand) => subcommand
    .setName('leaderboard')
    .setDescription('Show the server XP leaderboard.')
    .addIntegerOption((option) => option.setName('page').setDescription('Leaderboard page.').setMinValue(1).setMaxValue(100)))
  .addSubcommand((subcommand) => subcommand
    .setName('rewards')
    .setDescription('Show configured level reward roles.')
    .addIntegerOption((option) => option
      .setName('page')
      .setDescription('Reward page.')
      .setMinValue(1)
      .setMaxValue(100)));


export const recreationCommand = new SlashCommandBuilder()
  .setName('recreation')
  .setDescription('Create and manage HIT giveaways and community events.')
  .addSubcommand((subcommand) => subcommand
    .setName('setup')
    .setDescription('Configure giveaway, event, notification, and log channels.')
    .addChannelOption((option) => option.setName('giveaway_channel').setDescription('Default channel for giveaways.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((option) => option.setName('event_channel').setDescription('Default channel for community events.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private channel for giveaway and event logs.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption((option) => option.setName('notification_role').setDescription('Optional role pinged for new giveaways and events.'))
    .addIntegerOption((option) => option.setName('default_giveaway_minutes').setDescription('Default giveaway duration in minutes.').setMinValue(1).setMaxValue(43200))
    .addIntegerOption((option) => option.setName('default_event_reminder_minutes').setDescription('Default event reminder lead time.').setMinValue(0).setMaxValue(10080)))
  .addSubcommand((subcommand) => subcommand.setName('diagnose').setDescription('Check recreation channels and HIT permissions.'))
  .addSubcommand((subcommand) => subcommand.setName('config').setDescription('Show the active recreation configuration.'))
  .addSubcommand((subcommand) => subcommand.setName('active').setDescription('Show active giveaways and scheduled events.'))
  .addSubcommand((subcommand) => subcommand
    .setName('giveaway-create')
    .setDescription('Create a button-entry giveaway.')
    .addStringOption((option) => option.setName('prize').setDescription('Prize or reward.').setMinLength(1).setMaxLength(150).setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription('Duration such as 30m, 2h, 3d, or 1w.'))
    .addIntegerOption((option) => option.setName('winners').setDescription('Number of winners.').setMinValue(1).setMaxValue(20))
    .addStringOption((option) => option.setName('description').setDescription('Giveaway details.').setMaxLength(1000))
    .addRoleOption((option) => option.setName('required_role').setDescription('Optional role required to enter.'))
    .addIntegerOption((option) => option.setName('minimum_level').setDescription('Optional HIT level required to enter.').setMinValue(0).setMaxValue(500))
    .addChannelOption((option) => option.setName('channel').setDescription('Optional channel override.').addChannelTypes(ChannelType.GuildText)))
  .addSubcommand((subcommand) => subcommand
    .setName('giveaway-end')
    .setDescription('End an active giveaway and draw winners now.')
    .addIntegerOption((option) => option.setName('id').setDescription('Giveaway ID.').setMinValue(1).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('giveaway-reroll')
    .setDescription('Draw replacement winners for an ended giveaway.')
    .addIntegerOption((option) => option.setName('id').setDescription('Giveaway ID.').setMinValue(1).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('giveaway-cancel')
    .setDescription('Cancel an active giveaway without winners.')
    .addIntegerOption((option) => option.setName('id').setDescription('Giveaway ID.').setMinValue(1).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('event-create')
    .setDescription('Create a community event with RSVP buttons.')
    .addStringOption((option) => option.setName('title').setDescription('Event title.').setMinLength(1).setMaxLength(150).setRequired(true))
    .addStringOption((option) => option.setName('starts_in').setDescription('Time until start, such as 2h, 1d, or 1w.').setRequired(true))
    .addIntegerOption((option) => option.setName('duration_minutes').setDescription('Event duration in minutes.').setMinValue(1).setMaxValue(10080))
    .addStringOption((option) => option.setName('description').setDescription('Event details.').setMaxLength(1000))
    .addStringOption((option) => option.setName('location').setDescription('Voice channel, game lobby, or meeting location.').setMaxLength(200))
    .addIntegerOption((option) => option.setName('capacity').setDescription('Maximum Going RSVPs; 0 is unlimited.').setMinValue(0).setMaxValue(10000))
    .addIntegerOption((option) => option.setName('reminder_minutes').setDescription('Reminder lead time in minutes.').setMinValue(0).setMaxValue(10080))
    .addChannelOption((option) => option.setName('channel').setDescription('Optional channel override.').addChannelTypes(ChannelType.GuildText)))
  .addSubcommand((subcommand) => subcommand
    .setName('event-cancel')
    .setDescription('Cancel a scheduled event.')
    .addIntegerOption((option) => option.setName('id').setDescription('Event ID.').setMinValue(1).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('event-remind')
    .setDescription('Send an event reminder immediately.')
    .addIntegerOption((option) => option.setName('id').setDescription('Event ID.').setMinValue(1).setRequired(true)));


export const communityCommand = new SlashCommandBuilder()
  .setName('community')
  .setDescription('Configure HIT economy, counting, and starboard systems.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) => subcommand
    .setName('setup')
    .setDescription('Configure economy, counting, starboard, and logging.')
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private channel for economy, counting, and starboard logs.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption((option) => option.setName('currency_name').setDescription('Currency name, such as credits or coins.').setMinLength(1).setMaxLength(24))
    .addIntegerOption((option) => option.setName('starting_balance').setDescription('Balance assigned when a member first uses the economy.').setMinValue(0).setMaxValue(1000000000))
    .addIntegerOption((option) => option.setName('daily_reward').setDescription('Reward from /economy daily.').setMinValue(0).setMaxValue(1000000000))
    .addIntegerOption((option) => option.setName('daily_cooldown_hours').setDescription('Hours between daily claims.').setMinValue(1).setMaxValue(168))
    .addIntegerOption((option) => option.setName('work_min').setDescription('Minimum work reward.').setMinValue(0).setMaxValue(1000000000))
    .addIntegerOption((option) => option.setName('work_max').setDescription('Maximum work reward.').setMinValue(0).setMaxValue(1000000000))
    .addIntegerOption((option) => option.setName('work_cooldown_minutes').setDescription('Minutes between work claims.').setMinValue(1).setMaxValue(10080))
    .addChannelOption((option) => option.setName('counting_channel').setDescription('Optional channel used only for sequential counting.').addChannelTypes(ChannelType.GuildText))
    .addBooleanOption((option) => option.setName('counting_reset_on_mistake').setDescription('Reset the count to zero after a mistake.'))
    .addBooleanOption((option) => option.setName('counting_delete_invalid').setDescription('Delete invalid messages from the counting channel.'))
    .addChannelOption((option) => option.setName('starboard_channel').setDescription('Optional destination for starred messages.').addChannelTypes(ChannelType.GuildText))
    .addIntegerOption((option) => option.setName('star_threshold').setDescription('Eligible reactions required for starboard.').setMinValue(1).setMaxValue(100))
    .addStringOption((option) => option.setName('star_emoji').setDescription('Unicode emoji or custom emoji used for starboard.').setMinLength(1).setMaxLength(100))
    .addBooleanOption((option) => option.setName('allow_self_star').setDescription('Count reactions from the message author.')))
  .addSubcommand((subcommand) => subcommand.setName('diagnose').setDescription('Check community channels and HIT permissions.'))
  .addSubcommand((subcommand) => subcommand.setName('config').setDescription('Show economy, counting, and starboard configuration.'))
  .addSubcommand((subcommand) => subcommand.setName('counting-reset').setDescription('Reset the current count while preserving the high score.'))
  .addSubcommand((subcommand) => subcommand.setName('counting-disable').setDescription('Disable the counting channel without deleting the high score.'))
  .addSubcommand((subcommand) => subcommand.setName('starboard-disable').setDescription('Disable new starboard posts while preserving existing records.'))
  .addSubcommand((subcommand) => subcommand
    .setName('economy-manage')
    .setDescription('Add, remove, or set a memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s economy balance.')
    .addStringOption((option) => option.setName('action').setDescription('Balance operation.').setRequired(true).addChoices(
      { name: 'Add', value: 'add' },
      { name: 'Remove', value: 'remove' },
      { name: 'Set', value: 'set' },
    ))
    .addUserOption((option) => option.setName('user').setDescription('Member whose balance will change.').setRequired(true))
    .addIntegerOption((option) => option.setName('amount').setDescription('Amount for the operation.').setMinValue(0).setMaxValue(1000000000).setRequired(true)));

export const economyCommand = new SlashCommandBuilder()
  .setName('economy')
  .setDescription('Use the HIT server economy.')
  .addSubcommand((subcommand) => subcommand
    .setName('balance')
    .setDescription('Show your balance or another memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s balance.')
    .addUserOption((option) => option.setName('user').setDescription('Optional member to inspect.')))
  .addSubcommand((subcommand) => subcommand.setName('daily').setDescription('Claim your daily economy reward.'))
  .addSubcommand((subcommand) => subcommand.setName('work').setDescription('Work for a random economy reward.'))
  .addSubcommand((subcommand) => subcommand
    .setName('pay')
    .setDescription('Transfer currency to another member.')
    .addUserOption((option) => option.setName('user').setDescription('Member to pay.').setRequired(true))
    .addIntegerOption((option) => option.setName('amount').setDescription('Amount to transfer.').setMinValue(1).setMaxValue(1000000000).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('leaderboard')
    .setDescription('Show the server economy leaderboard.')
    .addIntegerOption((option) => option.setName('page').setDescription('Leaderboard page.').setMinValue(1).setMaxValue(100)));

export const countingCommand = new SlashCommandBuilder()
  .setName('counting')
  .setDescription('Show the current HIT counting status.')
  .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show the current count, next number, and high score.'));

export const starboardCommand = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('Show the active HIT starboard configuration.')
  .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show the starboard channel, threshold, and reaction.'));

export const securityCommand = new SlashCommandBuilder()
  .setName('security')
  .setDescription('HIT security status, trusted users, and emergency lockdown.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show active protection and lockdown status.'))
  .addSubcommand((subcommand) => subcommand
    .setName('lockdown')
    .setDescription('Emergency-lock server text and voice channels.')
    .addStringOption((option) => option.setName('reason').setDescription('Reason for emergency lockdown.').setMinLength(2).setMaxLength(300).setRequired(true))
    .addIntegerOption((option) => option.setName('minutes').setDescription('Automatic unlock time; 0 means manual.').setMinValue(0).setMaxValue(1440)))
  .addSubcommand((subcommand) => subcommand
    .setName('unlock')
    .setDescription('Restore permissions saved before lockdown.')
    .addStringOption((option) => option.setName('reason').setDescription('Reason for ending lockdown.').setMinLength(2).setMaxLength(300).setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('trust')
    .setDescription('Trust a staff account so anti-nuke does not contain it.')
    .addUserOption((option) => option.setName('user').setDescription('Staff account to trust.').setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('untrust')
    .setDescription('Remove a staff account from the anti-nuke trust list.')
    .addUserOption((option) => option.setName('user').setDescription('Account to remove.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand
        .setName('access-audit')
        .setDescription('Audit restricted-channel writing and visibility.'))
    .addSubcommand((subcommand) => subcommand
        .setName('access-fix')
        .setDescription('Apply the restricted-channel access policy.')
        .addStringOption((option) => option
            .setName('confirm')
            .setDescription('Type FIX to confirm the permission changes.')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(3)));


export const passiveCommand = new SlashCommandBuilder()
  .setName('passive')
  .setDescription('Configure HIT passive automod, logging, welcome, goodbye, and autorole systems.')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((subcommand) => subcommand
    .setName('setup')
    .setDescription('Configure passive protection and server automation.')
    .addChannelOption((option) => option.setName('log_channel').setDescription('Private channel for passive logs and automod actions.').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addChannelOption((option) => option.setName('welcome_channel').setDescription('Optional public welcome and goodbye channel.').addChannelTypes(ChannelType.GuildText))
    .addRoleOption((option) => option.setName('autorole').setDescription('Optional role automatically given to new members.'))
    .addBooleanOption((option) => option.setName('welcome').setDescription('Send welcome messages.'))
    .addBooleanOption((option) => option.setName('goodbye').setDescription('Send goodbye messages.'))
    .addBooleanOption((option) => option.setName('message_logs').setDescription('Log edited and deleted messages.'))
    .addBooleanOption((option) => option.setName('server_logs').setDescription('Log member, role, and channel changes.'))
    .addBooleanOption((option) => option.setName('anti_caps').setDescription('Remove excessive all-caps messages.'))
    .addBooleanOption((option) => option.setName('anti_emoji').setDescription('Remove excessive emoji spam.'))
    .addBooleanOption((option) => option.setName('anti_invites').setDescription('Remove Discord invite links from non-staff.'))
    .addBooleanOption((option) => option.setName('anti_attachments').setDescription('Remove potentially dangerous executable attachments.'))
    .addBooleanOption((option) => option.setName('anti_repeat').setDescription('Remove repeated-character spam.'))
    .addIntegerOption((option) => option.setName('caps_percent').setDescription('Uppercase percentage that triggers automod.').setMinValue(50).setMaxValue(100))
    .addIntegerOption((option) => option.setName('emoji_limit').setDescription('Maximum emojis allowed in one message.').setMinValue(1).setMaxValue(50))
    .addStringOption((option) => option.setName('welcome_message').setDescription('Supports {user}, {username}, {server}, and {membercount}.').setMaxLength(1000))
    .addStringOption((option) => option.setName('goodbye_message').setDescription('Supports {username}, {server}, and {membercount}.').setMaxLength(1000)))
  .addSubcommand((subcommand) => subcommand.setName('status').setDescription('Show the active passive configuration.'))
  .addSubcommand((subcommand) => subcommand.setName('disable').setDescription('Disable all passive systems while preserving settings.'));

export const funCommand = new SlashCommandBuilder()
  .setName('fun')
  .setDescription('Games, randomizers, social commands, and entertainment.')
  .addSubcommand((subcommand) => subcommand
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question.')
    .addStringOption((option) => option.setName('question').setDescription('Your question.').setRequired(true).setMaxLength(500)))
  .addSubcommand((subcommand) => subcommand.setName('coinflip').setDescription('Flip a coin.'))
  .addSubcommand((subcommand) => subcommand
    .setName('dice')
    .setDescription('Roll one or more dice.')
    .addIntegerOption((option) => option.setName('sides').setDescription('Sides per die.').setMinValue(2).setMaxValue(1000))
    .addIntegerOption((option) => option.setName('count').setDescription('Number of dice.').setMinValue(1).setMaxValue(20)))
  .addSubcommand((subcommand) => subcommand
    .setName('choose')
    .setDescription('Choose one option from a list separated with |.')
    .addStringOption((option) => option.setName('options').setDescription('Example: red | blue | green').setRequired(true).setMaxLength(1500)))
  .addSubcommand((subcommand) => subcommand
    .setName('random')
    .setDescription('Generate a random whole number.')
    .addIntegerOption((option) => option.setName('min').setDescription('Minimum value.').setMinValue(-1000000000).setMaxValue(1000000000))
    .addIntegerOption((option) => option.setName('max').setDescription('Maximum value.').setMinValue(-1000000000).setMaxValue(1000000000)))
  .addSubcommand((subcommand) => subcommand
    .setName('rate')
    .setDescription('Rate anything from 0 to 100.')
    .addStringOption((option) => option.setName('thing').setDescription('Thing to rate.').setRequired(true).setMaxLength(200)))
  .addSubcommand((subcommand) => subcommand
    .setName('ship')
    .setDescription('Calculate a fun compatibility score.')
    .addUserOption((option) => option.setName('first').setDescription('First person.').setRequired(true))
    .addUserOption((option) => option.setName('second').setDescription('Second person.').setRequired(true)))
  .addSubcommand((subcommand) => subcommand
    .setName('rps')
    .setDescription('Play rock-paper-scissors against HIT.')
    .addStringOption((option) => option.setName('choice').setDescription('Your move.').setRequired(true).addChoices(
      { name: 'Rock', value: 'rock' },
      { name: 'Paper', value: 'paper' },
      { name: 'Scissors', value: 'scissors' },
    )))
  .addSubcommand((subcommand) => subcommand.setName('slots').setDescription('Spin the HIT slot machine.'))
  .addSubcommand((subcommand) => subcommand.setName('trivia').setDescription('Get a random trivia question with a hidden answer.'))
  .addSubcommand((subcommand) => subcommand.setName('wyr').setDescription('Get a random would-you-rather question.'))
  .addSubcommand((subcommand) => subcommand.setName('truth').setDescription('Get a random truth question.'))
  .addSubcommand((subcommand) => subcommand.setName('dare').setDescription('Get a random safe dare.'))
  .addSubcommand((subcommand) => subcommand
    .setName('compliment')
    .setDescription('Compliment yourself or another member.')
    .addUserOption((option) => option.setName('user').setDescription('Optional member.')))
  .addSubcommand((subcommand) => subcommand
    .setName('roast')
    .setDescription('Give yourself or another member a playful roast.')
    .addUserOption((option) => option.setName('user').setDescription('Optional member.')))
  .addSubcommand((subcommand) => subcommand
    .setName('avatar')
    .setDescription('Show a memberÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢s avatar.')
    .addUserOption((option) => option.setName('user').setDescription('Optional member.')));

export const slashCommands = [
  hitCommand.toJSON(),
  ticketCommand.toJSON(),
  modCommand.toJSON(),
  securityCommand.toJSON(),
  lfgCommand.toJSON(),
  voiceCommand.toJSON(),
  levelCommand.toJSON(),
  recreationCommand.toJSON(),
  communityCommand.toJSON(),
  economyCommand.toJSON(),
  countingCommand.toJSON(),
  starboardCommand.toJSON(),
  passiveCommand.toJSON(),
  funCommand.toJSON(),
];

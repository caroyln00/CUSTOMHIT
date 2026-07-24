# HIT v97.21.43

HIT is a private all-in-one Discord bot with one universal prefix: `;`.

## Active modules

- verification with image CAPTCHA, NV/YV roles, lockouts, timeouts, and logs
- private tickets with claims, transcripts, closing, reopening, and staff controls
- moderation cases, warnings, timeouts, bans, purging, roles, nicknames, and channel controls
- anti-spam, anti-phishing, anti-raid, anti-nuke containment, trusted staff, quarantine, and reversible lockdown
- persistent Forum-based LFG posts with guided creation, join and leave controls, limits, expiration, and logs
- multiple join-to-create temporary voice lobbies with ownership, cleanup, limits, locking, hiding, permits, rejects, transfers, and claims
- persistent message and voice XP with cooldowns, anti-farming rules, ranks, leaderboards, exclusions, reward roles, announcements, and staff controls
- timed giveaways with button entry, requirements, automatic winner drawing, cancellation, ending, and rerolls
- scheduled events with Attending, Maybe, and Not Attending responses, capacities, reminders, completion, and logs
- persistent economy with balances, daily and work cooldowns, transfers, leaderboards, staff adjustments, and transaction logs
- strict sequential counting with anti-double-counting, mistake handling, automatic cleanup, resets, and high scores
- configurable starboard with reaction thresholds, self-star protection, live updates, source links, and cleanup

## Economy, counting, and starboard

Configure:

```text
/community setup
/community diagnose
/community config
```

Public commands:

```text
/economy balance
/economy daily
/economy work
/economy pay
/economy leaderboard
/counting status
/starboard status
```

Prefix alternatives:

```text
;balance
;daily
;work
;pay @member amount
;rich
;counting
;starboard
```

Staff controls:

```text
/community economy-manage
/community counting-reset
/community counting-disable
/community starboard-disable
```

The starboard reaction is configurable. The default is the standard star reaction. No decorative emojis are added by the new module.

## Giveaways and events

```text
/recreation setup
/recreation diagnose
/recreation config
/recreation active
/recreation giveaway-create
/recreation giveaway-end
/recreation giveaway-reroll
/recreation giveaway-cancel
/recreation event-create
/recreation event-cancel
/recreation event-remind
```

Events use Attending, Maybe, and Not Attending labels.

## Levels and XP

```text
/hit levels-setup
/hit levels-diagnose
/hit levels-config
/level rank
/level leaderboard
/level rewards
```

## Multiple join-to-create voice lobbies

The active exact lobby IDs are:

```text
1528860389323051160
1528858835358584913
1528863063862939720
```

Each lobby creates rooms inside its own parent category.

## LFG

The guided LFG creation panel remains locked to Discord channel ID `1528950639596408842`.

## Install an update

Copy everything in this update folder into the live HIT folder and replace existing files. Keep the live `.env` and `data` folder.

Run:

```bat
install-and-check.bat
```

After checks pass:

```bat
taskkill /F /IM node.exe
npm run register
npm start
```

Keep only one HIT terminal open.

## 24/7 cloud operation

Use `CLOUD-DEPLOYMENT-24-7.md` to deploy HIT to Railway. The package includes a Dockerfile, automatic command registration on cloud startup, persistent SQLite volume support, and an automatic restart policy. Once the cloud instance is confirmed online, stop the Windows instance so only one bot process handles Discord events.

# HIT v97.21.43 — 24/7 Cloud Deployment

This package is prepared for Railway using Docker. After deployment, HIT runs on Railway instead of the home computer, so verification, tickets, moderation, security, anti-spam, anti-phishing, anti-raid, anti-nuke, LFG, temporary voice rooms, levels, giveaways, events, economy, counting, and starboard continue while the computer is off.

## Important rules

- Never upload `.env` to GitHub.
- Never paste the bot token into source code, screenshots, chat messages, or Discord.
- Run exactly one HIT instance. Do not keep the Windows copy running after the cloud copy is online.
- Keep exactly one Railway replica because HIT uses one SQLite database and Discord event handlers must not run twice.
- Attach persistent storage before using the cloud deployment in production.

## Files included

- `Dockerfile` builds and runs HIT with Node.js 24.
- `railway.json` selects Docker and restarts HIT automatically.
- `.dockerignore` prevents local secrets and databases from entering the image.
- `.env.example` lists the variables without containing the real token.

## Railway setup

1. Create a private GitHub repository named `HIT`.
2. Upload the contents of this extracted folder to the repository.
3. Do not upload `.env`, `data`, `node_modules`, or any ZIP files.
4. In Railway, create a new project from the private GitHub repository.
5. Open the HIT service and add these Variables:

```env
DISCORD_BOT_TOKEN=your_private_bot_token
DISCORD_CLIENT_ID=1529683069290811452
DISCORD_GUILD_ID=1528835957510373537
HIT_PREFIX=;
DATABASE_PATH=/app/data/hit.sqlite
LOG_LEVEL=info
```

6. Add a Railway Volume to the HIT service.
7. Set its mount path to:

```text
/app/data
```

8. Keep the service at one replica.
9. Deploy the service.
10. Watch the deployment logs for:

```text
Registered development guild commands
HIT is online
```

11. Confirm HIT appears online in Discord and run:

```text
;version
/security status
/hit security-diagnose
```

12. After the cloud copy passes, close the Windows HIT terminal and do not start it again unless the cloud service is stopped.

## Automatic restart

`railway.json` requests the `ALWAYS` restart policy. Railway paid plans support the Always policy. Free and trial plans limit restart behavior, so they are not suitable for dependable nonstop moderation.

## Updating HIT later

1. Apply and test the update on the Windows copy.
2. Upload the changed source files to the private GitHub repository.
3. Railway automatically rebuilds and deploys the new version.
4. Confirm the new deployment says `HIT is online` before considering the update complete.

## Moving the existing database

The local database is normally:

```text
data/hit.sqlite
```

The new cloud database is:

```text
/app/data/hit.sqlite
```

A fresh cloud database requires the setup commands to be run again. To preserve all settings and records, the existing `hit.sqlite` file must be uploaded into the Railway volume before the final switch. Do not run the local and cloud copies at the same time during this migration.

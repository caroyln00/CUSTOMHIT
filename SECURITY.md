# HIT Security Model — v7.56.0

## Trust boundaries

The server owner and HIT are permanently trusted. Other administrators must be explicitly added through `/security trust` before bulk administrative work.

## Anti-nuke containment

HIT observes Discord audit-log events and scores destructive actions inside a short window. When an untrusted executor reaches the configured threshold, HIT attempts to:

1. Remove manageable roles that grant dangerous administrative permissions.
2. Add the configured quarantine role.
3. Remove an untrusted newly added bot when possible.
4. Post a critical incident record.
5. Start reversible lockdown only when automatic lockdown is enabled.

HIT never attempts to punish the server owner. It cannot remove roles positioned above HIT.

## Lockdown recovery

Before changing channel overwrites, HIT records the relevant `@everyone` permission state in SQLite. Unlock restores those saved values. If a channel cannot be restored, HIT keeps its snapshot for another attempt and reports the failure.

## Phishing limitations

The anti-phishing module uses local high-confidence patterns for known IP-grabber hosts, fake Discord/Nitro domains, leaked webhook tokens, QR-code takeover language, and untrusted Nitro claims. It is intentionally conservative to reduce false positives and is not a general antivirus.

## Operational rules

- Keep `.env` private.
- Back up `data/hit.sqlite` while HIT is stopped or use a SQLite-safe backup process.
- Restrict security and moderation log channels to trusted staff.
- Test lockdown restoration before enabling automatic lockdown.
- Use a separate test server for anti-nuke drills.

## v7.56.0 community safeguards

- economy claims and transfers use immediate SQLite transactions to prevent double claims and overspending
- balances cannot become negative
- bot accounts cannot receive normal economy actions
- counting updates are atomic, block consecutive counts by one member, and can reset when the current count is edited or deleted
- starboard ignores bot reactions and self-reactions by default
- starboard will not republish messages from channels hidden from `@everyone`
- starboard skips NSFW source channels

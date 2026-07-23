const TRACKING_HOSTS = new Set([
  'grabify.link',
  'iplogger.org',
  'iplogger.com',
  '2no.co',
  'yip.su',
  'blasze.com',
  'whatstheirip.com',
]);

const OFFICIAL_DISCORD_HOSTS = new Set([
  'discord.com',
  'www.discord.com',
  'discordapp.com',
  'www.discordapp.com',
  'discord.gg',
  'discord.gift',
  'www.discord.gift',
  'cdn.discordapp.com',
  'media.discordapp.net',
]);

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>()]+/giu;

export interface PhishingDetection {
  detected: boolean;
  reason: string | null;
  host: string | null;
}

export function normalizeMessage(content: string): string {
  return content
    .toLowerCase()
    .replace(/https?:\/\/\S+/giu, '<url>')
    .replace(/<@!?\d+>/gu, '<user>')
    .replace(/<@&\d+>/gu, '<role>')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function extractUrls(content: string): URL[] {
  const matches = content.match(URL_PATTERN) ?? [];
  const urls: URL[] = [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[),.!?;:]+$/gu, '');
    try {
      urls.push(new URL(cleaned.startsWith('www.') ? `https://${cleaned}` : cleaned));
    } catch {
      // Ignore malformed URLs. Discord will not make them clickable reliably.
    }
  }
  return urls;
}

function isSubdomainOf(host: string, parent: string): boolean {
  return host === parent || host.endsWith(`.${parent}`);
}

function resemblesDiscordGift(host: string, pathname: string): boolean {
  if (OFFICIAL_DISCORD_HOSTS.has(host)) return false;
  const normalized = host.replace(/[^a-z0-9]/gu, '');
  const discordLike = normalized.includes('discord') || normalized.includes('disc0rd');
  const giftLike = normalized.includes('gift') || normalized.includes('nitro') || pathname.toLowerCase().includes('nitro');
  return discordLike && giftLike;
}

export function detectPhishing(content: string): PhishingDetection {
  const lower = content.toLowerCase();
  const urls = extractUrls(content);

  for (const url of urls) {
    const host = url.hostname.toLowerCase().replace(/\.$/u, '');

    if ([...TRACKING_HOSTS].some((blocked) => isSubdomainOf(host, blocked))) {
      return { detected: true, reason: 'Known IP-tracking or grabber domain', host };
    }

    if (resemblesDiscordGift(host, url.pathname)) {
      return { detected: true, reason: 'Discord/Nitro impersonation domain', host };
    }

    if (isSubdomainOf(host, 'discord.com') && url.pathname.toLowerCase().startsWith('/api/webhooks/')) {
      return { detected: true, reason: 'Exposed Discord webhook token', host };
    }
  }

  if (urls.length > 0 && /(scan|open).{0,18}(qr|code)/u.test(lower) && /(verify|verification|discord|account)/u.test(lower)) {
    return { detected: true, reason: 'QR-code account takeover pattern', host: urls[0]?.hostname ?? null };
  }

  if (urls.length > 0 && /(free|claim|gift).{0,18}(nitro|discord premium)/u.test(lower)) {
    const allOfficial = urls.every((url) => OFFICIAL_DISCORD_HOSTS.has(url.hostname.toLowerCase()));
    if (!allOfficial) return { detected: true, reason: 'Untrusted free-Nitro claim pattern', host: urls[0]?.hostname ?? null };
  }

  return { detected: false, reason: null, host: null };
}

export function isBurstSpam(timestamps: number[], now: number, limit: number, windowSeconds: number): boolean {
  const cutoff = now - windowSeconds * 1000;
  return timestamps.filter((timestamp) => timestamp >= cutoff).length >= limit;
}

export function isDuplicateSpam(
  messages: Array<{ normalized: string; timestamp: number }>,
  normalized: string,
  now: number,
  limit: number,
  windowSeconds = 20,
): boolean {
  if (!normalized || normalized === '<url>') return false;
  const cutoff = now - windowSeconds * 1000;
  return messages.filter((entry) => entry.timestamp >= cutoff && entry.normalized === normalized).length >= limit;
}

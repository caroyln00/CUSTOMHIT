export const NAME_CHECK_PLATFORMS = [
  'all',
  'discord',
  'github',
  'reddit',
  'roblox',
  'twitch',
  'youtube',
  'steam',
  'bluesky',
  'xbox',
  'playstation',
  'x',
  'instagram',
  'tiktok',
  'threads',
  'facebook',
  'snapchat',
  'pinterest',
  'tumblr',
  'soundcloud',
  'kick',
  'linkedin',
  'telegram',
] as const;

export type NameCheckPlatform = typeof NAME_CHECK_PLATFORMS[number];
export type NameCheckExternalPlatform = Exclude<
  NameCheckPlatform,
  'all' | 'discord'
>;

export type PlatformLookupStatus =
  | 'found'
  | 'not_found'
  | 'unknown'
  | 'invalid'
  | 'error';

export interface PlatformLookupResult {
  platform: Exclude<NameCheckPlatform, 'all'>;
  label: string;
  status: PlatformLookupStatus;
  detail: string;
  profileUrl?: string | undefined;
}

const REQUEST_TIMEOUT_MS = 8_000;
const USER_AGENT = 'CUSTOMHIT/97.21.43 username-check';

export const NAME_CHECK_EXTERNAL_PLATFORMS:
readonly NameCheckExternalPlatform[] = [
  'github',
  'reddit',
  'roblox',
  'twitch',
  'youtube',
  'steam',
  'bluesky',
  'xbox',
  'playstation',
  'x',
  'instagram',
  'tiktok',
  'threads',
  'facebook',
  'snapchat',
  'pinterest',
  'tumblr',
  'soundcloud',
  'kick',
  'linkedin',
  'telegram',
];

type ManualPlatform =
  | 'twitch'
  | 'youtube'
  | 'steam'
  | 'xbox'
  | 'playstation'
  | 'x'
  | 'instagram'
  | 'tiktok'
  | 'threads'
  | 'facebook'
  | 'snapchat'
  | 'pinterest'
  | 'tumblr'
  | 'soundcloud'
  | 'kick'
  | 'linkedin'
  | 'telegram';

interface ManualPlatformDefinition {
  label: string;
  detail: string;
  profileUrl?: (username: string) => string;
}

const MANUAL_PLATFORMS: Record<
  ManualPlatform,
  ManualPlatformDefinition
> = {
  twitch: {
    label: 'Twitch',
    detail: 'The public Twitch profile link is manual evidence only.',
    profileUrl: (username) =>
      `https://www.twitch.tv/${encodeURIComponent(username)}`,
  },
  youtube: {
    label: 'YouTube',
    detail: 'The YouTube handle link is manual evidence only.',
    profileUrl: (username) =>
      `https://www.youtube.com/@${encodeURIComponent(username.replace(/^@/, ''))}`,
  },
  steam: {
    label: 'Steam',
    detail: 'The Steam vanity URL is manual evidence only.',
    profileUrl: (username) =>
      `https://steamcommunity.com/id/${encodeURIComponent(username)}`,
  },
  xbox: {
    label: 'Xbox',
    detail:
      'Xbox requires authenticated Xbox services for authoritative account lookup.',
    profileUrl: (username) =>
      `https://www.xbox.com/play/user/${encodeURIComponent(username)}`,
  },
  playstation: {
    label: 'PlayStation',
    detail:
      'No credential-free authoritative PlayStation username lookup is configured.',
  },
  x: {
    label: 'X / Twitter',
    detail:
      'Public profiles may be blocked, suspended, reserved, renamed, or hidden.',
    profileUrl: (username) =>
      `https://x.com/${encodeURIComponent(username)}`,
  },
  instagram: {
    label: 'Instagram',
    detail:
      'Instagram does not provide this bot with an authoritative public availability response.',
    profileUrl: (username) =>
      `https://www.instagram.com/${encodeURIComponent(username)}/`,
  },
  tiktok: {
    label: 'TikTok',
    detail:
      'TikTok profile responses can be blocked or ambiguous.',
    profileUrl: (username) =>
      `https://www.tiktok.com/@${encodeURIComponent(username)}`,
  },
  threads: {
    label: 'Threads',
    detail:
      'Threads profile pages are manual evidence only.',
    profileUrl: (username) =>
      `https://www.threads.net/@${encodeURIComponent(username)}`,
  },
  facebook: {
    label: 'Facebook',
    detail:
      'Facebook profile slugs and privacy restrictions make automatic conclusions unreliable.',
    profileUrl: (username) =>
      `https://www.facebook.com/${encodeURIComponent(username)}`,
  },
  snapchat: {
    label: 'Snapchat',
    detail:
      'Snapchat does not expose an authoritative credential-free username checker.',
    profileUrl: (username) =>
      `https://www.snapchat.com/add/${encodeURIComponent(username)}`,
  },
  pinterest: {
    label: 'Pinterest',
    detail:
      'The public Pinterest profile link is manual evidence only.',
    profileUrl: (username) =>
      `https://www.pinterest.com/${encodeURIComponent(username)}/`,
  },
  tumblr: {
    label: 'Tumblr',
    detail:
      'Tumblr blog names can differ from account identities.',
    profileUrl: (username) =>
      `https://${encodeURIComponent(username)}.tumblr.com/`,
  },
  soundcloud: {
    label: 'SoundCloud',
    detail:
      'SoundCloud redirects and custom profile slugs can be ambiguous.',
    profileUrl: (username) =>
      `https://soundcloud.com/${encodeURIComponent(username)}`,
  },
  kick: {
    label: 'Kick',
    detail:
      'The public Kick profile link is manual evidence only.',
    profileUrl: (username) =>
      `https://kick.com/${encodeURIComponent(username)}`,
  },
  linkedin: {
    label: 'LinkedIn',
    detail:
      'LinkedIn profile slugs are not guaranteed to represent usernames.',
    profileUrl: (username) =>
      `https://www.linkedin.com/in/${encodeURIComponent(username)}/`,
  },
  telegram: {
    label: 'Telegram',
    detail:
      'The public Telegram link does not guarantee registration availability.',
    profileUrl: (username) =>
      `https://t.me/${encodeURIComponent(username)}`,
  },
};

export function isNameCheckPlatform(
  value: string,
): value is NameCheckPlatform {
  return NAME_CHECK_PLATFORMS.includes(value as NameCheckPlatform);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function failedResult(
  platform: NameCheckExternalPlatform,
  label: string,
  profileUrl?: string,
): PlatformLookupResult {
  return {
    platform,
    label,
    status: 'error',
    detail:
      'The request failed or timed out. No availability conclusion was made.',
    profileUrl,
  };
}

async function checkGitHub(
  username: string,
): Promise<PlatformLookupResult> {
  const profileUrl =
    `https://github.com/${encodeURIComponent(username)}`;

  try {
    const response = await fetchWithTimeout(
      `https://api.github.com/users/${encodeURIComponent(username)}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': USER_AGENT,
        },
      },
    );

    if (response.status === 200) {
      return {
        platform: 'github',
        label: 'GitHub',
        status: 'found',
        detail: 'GitHub returned an exact public user account.',
        profileUrl,
      };
    }

    if (response.status === 404) {
      return {
        platform: 'github',
        label: 'GitHub',
        status: 'not_found',
        detail:
          'GitHub returned no public account. This is not a registration guarantee.',
        profileUrl,
      };
    }

    if (response.status === 422) {
      return {
        platform: 'github',
        label: 'GitHub',
        status: 'invalid',
        detail: 'GitHub rejected the supplied username format.',
        profileUrl,
      };
    }

    return {
      platform: 'github',
      label: 'GitHub',
      status: 'unknown',
      detail: `GitHub returned HTTP ${response.status}.`,
      profileUrl,
    };
  } catch {
    return failedResult('github', 'GitHub', profileUrl);
  }
}

async function checkReddit(
  username: string,
): Promise<PlatformLookupResult> {
  const profileUrl =
    `https://www.reddit.com/user/${encodeURIComponent(username)}/`;

  try {
    const response = await fetchWithTimeout(
      `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
      },
    );

    if (response.status === 200) {
      return {
        platform: 'reddit',
        label: 'Reddit',
        status: 'found',
        detail: 'Reddit returned an exact public account.',
        profileUrl,
      };
    }

    if (response.status === 404) {
      return {
        platform: 'reddit',
        label: 'Reddit',
        status: 'not_found',
        detail:
          'Reddit returned no public account. This is not a registration guarantee.',
        profileUrl,
      };
    }

    return {
      platform: 'reddit',
      label: 'Reddit',
      status: 'unknown',
      detail: `Reddit returned HTTP ${response.status}.`,
      profileUrl,
    };
  } catch {
    return failedResult('reddit', 'Reddit', profileUrl);
  }
}

async function checkRoblox(
  username: string,
): Promise<PlatformLookupResult> {
  try {
    const response = await fetchWithTimeout(
      'https://users.roblox.com/v1/usernames/users',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: false,
        }),
      },
    );

    if (response.ok) {
      const payload = await response.json() as {
        data?: Array<{
          id: number;
          name: string;
        }>;
      };

      const match = payload.data?.find(
        (user) => user.name.toLowerCase() === username.toLowerCase(),
      );

      if (match) {
        return {
          platform: 'roblox',
          label: 'Roblox',
          status: 'found',
          detail: `Roblox returned account ID ${match.id}.`,
          profileUrl: `https://www.roblox.com/users/${match.id}/profile`,
        };
      }

      return {
        platform: 'roblox',
        label: 'Roblox',
        status: 'not_found',
        detail:
          'Roblox returned no exact account. This does not guarantee registration acceptance.',
      };
    }

    if (response.status === 400) {
      return {
        platform: 'roblox',
        label: 'Roblox',
        status: 'invalid',
        detail: 'Roblox rejected the supplied username format.',
      };
    }

    return {
      platform: 'roblox',
      label: 'Roblox',
      status: 'unknown',
      detail: `Roblox returned HTTP ${response.status}.`,
    };
  } catch {
    return failedResult('roblox', 'Roblox');
  }
}

async function checkBluesky(
  username: string,
): Promise<PlatformLookupResult> {
  const handle = username.includes('.')
    ? username.replace(/^@/, '')
    : `${username.replace(/^@/, '')}.bsky.social`;

  const profileUrl =
    `https://bsky.app/profile/${encodeURIComponent(handle)}`;

  try {
    const response = await fetchWithTimeout(
      'https://public.api.bsky.app/xrpc/' +
        'com.atproto.identity.resolveHandle?' +
        `handle=${encodeURIComponent(handle)}`,
    );

    if (response.ok) {
      return {
        platform: 'bluesky',
        label: 'Bluesky',
        status: 'found',
        detail: 'Bluesky resolved this handle.',
        profileUrl,
      };
    }

    if (response.status === 400 || response.status === 404) {
      return {
        platform: 'bluesky',
        label: 'Bluesky',
        status: 'not_found',
        detail:
          'Bluesky could not resolve this handle. This is not a registration guarantee.',
        profileUrl,
      };
    }

    return {
      platform: 'bluesky',
      label: 'Bluesky',
      status: 'unknown',
      detail: `Bluesky returned HTTP ${response.status}.`,
      profileUrl,
    };
  } catch {
    return failedResult('bluesky', 'Bluesky', profileUrl);
  }
}

function manualResult(
  username: string,
  platform: ManualPlatform,
): PlatformLookupResult {
  const definition = MANUAL_PLATFORMS[platform];

  return {
    platform,
    label: definition.label,
    status: 'unknown',
    detail: definition.detail,
    profileUrl: definition.profileUrl?.(username),
  };
}

async function checkOnePlatform(
  username: string,
  platform: NameCheckExternalPlatform,
): Promise<PlatformLookupResult> {
  switch (platform) {
    case 'github':
      return checkGitHub(username);
    case 'reddit':
      return checkReddit(username);
    case 'roblox':
      return checkRoblox(username);
    case 'bluesky':
      return checkBluesky(username);
    default:
      return manualResult(username, platform as ManualPlatform);
  }
}

export async function checkExternalPlatforms(
  username: string,
  platform: NameCheckPlatform,
): Promise<PlatformLookupResult[]> {
  if (platform === 'discord') return [];

  const selected: readonly NameCheckExternalPlatform[] =
    platform === 'all'
      ? NAME_CHECK_EXTERNAL_PLATFORMS
      : [platform];

  return Promise.all(
    selected.map((entry) => checkOnePlatform(username, entry)),
  );
}
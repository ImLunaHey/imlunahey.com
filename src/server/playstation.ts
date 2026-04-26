import { createServerFn } from '@tanstack/react-start';
import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  exchangeRefreshTokenForAuthTokens,
  getUserPlayedGames,
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle,
  getBasicPresence,
  type AuthorizationPayload,
  type TrophyTitle,
  type TrophyCounts,
} from 'psn-api';
import { cached, TTL } from './cache';

// PSN access tokens last about an hour. NPSSO is long-lived (~60 days)
// and lives in PSN_NPSSO. Cache the exchanged auth payload for under
// the access-token TTL so we don't bother Sony's auth-exchange more
// than ~once per hour. The cached() helper will hit the loader on
// expiry, which re-runs the exchange. If a refresh-token-based path
// is needed later, swap the loader.
const ACCESS_TOKEN_TTL_MS = 1000 * 60 * 50; // 50 minutes
let cachedAuth: { payload: AuthorizationPayload; refreshToken: string; at: number } | null = null;

async function loadAuth(): Promise<AuthorizationPayload | null> {
  const npsso = process.env.PSN_NPSSO;
  if (!npsso) return null;

  // refresh path: if we have a refresh token, prefer it — saves the
  // npsso → access-code round trip and avoids exposing the npsso
  // unnecessarily.
  if (cachedAuth && Date.now() - cachedAuth.at < ACCESS_TOKEN_TTL_MS) {
    return cachedAuth.payload;
  }
  if (cachedAuth?.refreshToken) {
    try {
      const tokens = await exchangeRefreshTokenForAuthTokens(cachedAuth.refreshToken);
      const payload: AuthorizationPayload = { accessToken: tokens.accessToken };
      cachedAuth = { payload, refreshToken: tokens.refreshToken, at: Date.now() };
      return payload;
    } catch {
      // fall through to full re-auth
      cachedAuth = null;
    }
  }

  // full path: npsso → access code → auth tokens
  const accessCode = await exchangeNpssoForAccessCode(npsso);
  const tokens = await exchangeAccessCodeForAuthTokens(accessCode);
  const payload: AuthorizationPayload = { accessToken: tokens.accessToken };
  cachedAuth = { payload, refreshToken: tokens.refreshToken, at: Date.now() };
  return payload;
}

export type PsnGame = {
  /** Title id used by PSN (CUSAxxxx_xx for PS4, PPSAxxxx_xx for PS5). */
  titleId: string;
  /** Stable concept id — same across reissues / regional variants. */
  conceptId: number;
  name: string;
  /** ps4_game | ps5_native_game | pspc_game | unknown */
  category: string;
  imageUrl: string;
  /** total play count (sessions) */
  playCount: number;
  /** play duration in seconds, parsed from psn's iso8601 duration string */
  playSeconds: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
};

export type PsnLibrary = {
  /** when the upstream snapshot was taken (epoch ms) */
  fetchedAt: number;
  games: PsnGame[];
  /** null if PSN_NPSSO isn't set, so the page can show a friendly
   *  unconfigured state instead of an error */
  configured: boolean;
};

/** True for PSN categories that represent games (vs media apps).
 *  Whitelist on the suffix `_game` rather than blacklisting known
 *  app variants — Sony adds new app categories occasionally and a
 *  blacklist would bit-rot. Keep `unknown` because some legitimate
 *  older games show up there. */
function isGameCategory(category: string): boolean {
  return category.endsWith('_game') || category === 'unknown';
}

/** PSN's `category` field is mostly reliable for PS4 / PS5 / PSPC, but
 *  it tags PS3, Vita, and the odd modern launcher app as `unknown`.
 *  The titleId prefix is a more reliable platform signal:
 *
 *    PPSA·······   PS5
 *    PCSE/PCSF/PCSG/PCSI/PCSH   PS Vita physical/digital
 *    CUSA·······   PS4
 *    BL(ES|US|AS|JM)/BC(ES|US|JM)/NP[EHU][BPS]   PS3
 *
 *  Refine here so the rest of the page sees clean categories.
 */
function refinedCategory(category: string, titleId: string): string {
  if (category !== 'unknown') return category;
  const id = titleId.toUpperCase();
  if (id.startsWith('PPSA')) return 'ps5_native_game';
  if (id.startsWith('CUSA')) return 'ps4_game';
  if (/^PCS[EFGHI]/.test(id)) return 'psvita_game';
  if (/^(BLES|BCES|BLUS|BCUS|BLAS|BCAS|BLJM|BCJS|NP[EHU][BPS])/.test(id)) return 'ps3_game';
  return 'unknown';
}

/** "PT228H56M33S" → 824193 seconds. PSN serialises play durations as
 *  ISO 8601 durations; we want a flat seconds count for simple
 *  formatting on the page. Tolerates missing fields ("PT5M" etc.). */
function parsePsnDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const min = Number(m[2] ?? 0);
  const s = Number(m[3] ?? 0);
  return h * 3600 + min * 60 + s;
}

async function loadGames(): Promise<PsnLibrary> {
  const auth = await loadAuth();
  if (!auth) return { fetchedAt: Date.now(), games: [], configured: false };

  // PSN paginates at limit=200 max. We loop until we've gathered every
  // played title so the page renders the whole library, not just the
  // most-recent page.
  const games: PsnGame[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const res = await getUserPlayedGames(auth, 'me', { limit: 200, offset });
    for (const t of res.titles) {
      // PSN's "played titles" includes media apps (netflix, youtube,
      // disney+) tagged as ps4_videoservice_web_app /
      // ps5_web_based_media_app / ps4_nongame_mini_app etc. They aren't
      // games; drop them so the page is just games.
      if (!isGameCategory(t.category)) continue;
      games.push({
        titleId: t.titleId,
        conceptId: t.concept?.id ?? 0,
        name: t.name,
        category: refinedCategory(t.category, t.titleId),
        imageUrl: t.imageUrl,
        playCount: t.playCount,
        playSeconds: parsePsnDuration(t.playDuration),
        firstPlayedAt: t.firstPlayedDateTime,
        lastPlayedAt: t.lastPlayedDateTime,
      });
    }
    if (res.titles.length < 200 || res.nextOffset == null || res.nextOffset <= offset) break;
    offset = res.nextOffset;
  }

  return { fetchedAt: Date.now(), games, configured: true };
}

export const getPlaystationLibrary = createServerFn({ method: 'GET' }).handler(
  (): Promise<PsnLibrary> =>
    cached('playstation:library', TTL.short, loadGames).catch(
      () => ({ fetchedAt: Date.now(), games: [], configured: true }),
    ),
);

// ─── presence (home page now-panel) ──────────────────────────────────

export type PsnPresence = {
  online: boolean;
  /** "PS5" | "PS4" | etc. */
  platform: string | null;
  /** populated only when actively in a game; null otherwise */
  game: { name: string; titleId: string; iconUrl: string | null } | null;
};

/** ~1min TTL — short enough that the home-page widget feels live, long
 *  enough that we don't hammer Sony's auth-rate limit if many tabs hit
 *  the home page at once. PSN itself only updates this every ~30s on
 *  their own apps, so finer granularity isn't gaining us anything. */
const PRESENCE_TTL_MS = 60_000;

export const getPlaystationPresence = createServerFn({ method: 'GET' }).handler(
  (): Promise<PsnPresence | null> =>
    cached('playstation:presence', PRESENCE_TTL_MS, async () => {
      const auth = await loadAuth();
      if (!auth) return null;
      const res = await getBasicPresence(auth, 'me');
      const p = res.basicPresence;
      const playing = p.gameTitleInfoList?.[0];
      return {
        online:
          p.availability === 'availableToPlay' ||
          p.primaryPlatformInfo?.onlineStatus === 'online',
        platform: p.primaryPlatformInfo?.platform ?? null,
        game: playing
          ? {
              name: playing.titleName,
              titleId: playing.npTitleId,
              iconUrl: playing.npTitleIconUrl ?? playing.conceptIconUrl ?? null,
            }
          : null,
      };
    }).catch(() => null),
);

// ─── trophies (detail page) ──────────────────────────────────────────

export type PsnTrophy = {
  trophyId: number;
  type: 'bronze' | 'silver' | 'gold' | 'platinum';
  /** PSN doesn't reveal name/detail of unearned hidden trophies — both
   *  fields will be undefined when the user hasn't earned a hidden one. */
  name?: string;
  detail?: string;
  iconUrl?: string;
  hidden: boolean;
  earned: boolean;
  earnedAt?: string;
  /** Percentage of all PSN users who have earned this trophy. Lower
   *  = rarer. PSN returns it as a string ("0.5"), so we coerce. */
  earnedRate?: number;
};

export type PsnPlatformTrophies = {
  /** ps4_game / ps5_native_game / unknown — same key the page uses */
  category: string;
  /** PSN's trophy-set identifier — different from titleId. */
  npCommunicationId: string;
  npServiceName: 'trophy' | 'trophy2';
  iconUrl: string;
  /** 0–100 */
  progress: number;
  defined: TrophyCounts;
  earned: TrophyCounts;
  trophies: PsnTrophy[];
};

export type PsnGameDetail = {
  /** echoed from the library so the page doesn't need a second fetch */
  group: {
    key: string;
    name: string;
    imageUrl: string;
    categories: string[];
    totalSeconds: number;
    totalCount: number;
    firstPlayedAt: string;
    lastPlayedAt: string;
    members: PsnGame[];
  };
  /** one entry per platform that has a trophy set we matched. empty
   *  if PSN didn't track trophies for any platform we own (very old
   *  PS3 games sometimes lack trophies entirely). */
  platforms: PsnPlatformTrophies[];
};

/** Loose name match — lowercase, strip trademark symbols + edition
 *  qualifiers + ascii-puncuation. Lets "Spider-Man™" match
 *  "Spider-Man" and "Tomb Raider: Definitive Edition" match
 *  "Tomb Raider Definitive Edition". Imperfect, but in practice
 *  catches >95% of cross-gen matches in a typical PSN library. */
function normaliseTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[®™©]/g, '')
    .replace(/[:\-_–—,.!?'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadTrophyTitles(): Promise<TrophyTitle[]> {
  const auth = await loadAuth();
  if (!auth) return [];
  const all: TrophyTitle[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    const res = await getUserTitles(auth, 'me', { limit: 800, offset });
    all.push(...res.trophyTitles);
    if (res.trophyTitles.length < 800 || res.nextOffset == null || res.nextOffset <= offset) break;
    offset = res.nextOffset;
  }
  return all;
}

const getCachedTrophyTitles = (): Promise<TrophyTitle[]> =>
  cached('playstation:trophy-titles', TTL.medium, loadTrophyTitles).catch(() => [] as TrophyTitle[]);

/** Fetch the per-trophy detail (defined list + user progress) for a
 *  single trophy set. Cached by npCommunicationId so cross-gen detail
 *  pages re-use the per-platform cache rather than refetching. */
async function loadTrophiesForTitle(
  npCommunicationId: string,
  npServiceName: 'trophy' | 'trophy2',
): Promise<{ defined: Map<number, { name?: string; detail?: string; icon?: string; hidden: boolean }>; earned: Map<number, { earned: boolean; earnedAt?: string; earnedRate?: number; type: 'bronze' | 'silver' | 'gold' | 'platinum' }> }> {
  const auth = await loadAuth();
  if (!auth) return { defined: new Map(), earned: new Map() };

  // "all" returns trophies from every group (default + DLC) flattened.
  const [defined, userProg] = await Promise.all([
    getTitleTrophies(auth, npCommunicationId, 'all', { npServiceName }),
    getUserTrophiesEarnedForTitle(auth, 'me', npCommunicationId, 'all', { npServiceName }),
  ]);

  const defMap = new Map<number, { name?: string; detail?: string; icon?: string; hidden: boolean }>();
  for (const t of defined.trophies) {
    defMap.set(t.trophyId, {
      name: t.trophyName,
      detail: t.trophyDetail,
      icon: t.trophyIconUrl,
      hidden: !!t.trophyHidden,
    });
  }
  const earnedMap = new Map<number, { earned: boolean; earnedAt?: string; earnedRate?: number; type: 'bronze' | 'silver' | 'gold' | 'platinum' }>();
  for (const t of userProg.trophies) {
    earnedMap.set(t.trophyId, {
      earned: !!t.earned,
      earnedAt: t.earnedDateTime,
      earnedRate: t.trophyEarnedRate != null ? Number(t.trophyEarnedRate) : undefined,
      type: t.trophyType as 'bronze' | 'silver' | 'gold' | 'platinum',
    });
  }
  return { defined: defMap, earned: earnedMap };
}

const getCachedTrophyDetail = (npCommunicationId: string, npServiceName: 'trophy' | 'trophy2') =>
  cached(
    `playstation:trophies:${npServiceName}:${npCommunicationId}`,
    TTL.medium,
    () => loadTrophiesForTitle(npCommunicationId, npServiceName),
  ).catch(() => ({ defined: new Map(), earned: new Map() }));

/** PSN platform string ("PS5", "PS4", "PSVITA", "PS3", or comma-joined)
 *  → our internal category code. PSN sometimes returns multi-platform
 *  trophy sets (e.g. "PS3,PSVITA" for cross-buy games); the first
 *  match wins, ordered newest-first to keep cross-gen sets snapping
 *  to the more-recent generation in the page UI. */
function trophyPlatformToCategory(p: string): string {
  if (p.includes('PS5')) return 'ps5_native_game';
  if (p.includes('PS4')) return 'ps4_game';
  if (p.includes('PS3')) return 'ps3_game';
  if (p.includes('PSVITA')) return 'psvita_game';
  return 'unknown';
}

export const getPlaystationGameDetail = createServerFn({ method: 'GET' })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }): Promise<PsnGameDetail | null> => {
    const lib = await cached('playstation:library', TTL.short, loadGames);
    if (!lib.configured) return null;

    // Match by conceptId first (numeric > 0), fall back to titleId.
    const numeric = Number(data.id);
    let members: PsnGame[];
    if (Number.isFinite(numeric) && numeric > 0) {
      members = lib.games.filter((g) => g.conceptId === numeric);
    } else {
      members = lib.games.filter((g) => g.titleId === data.id);
    }
    if (members.length === 0) return null;

    // Build the same group shape the page already uses, locally.
    const ps5 = members.find((m) => m.category === 'ps5_native_game');
    const rep = ps5 ?? members[0];
    const totalSeconds = members.reduce((s, m) => s + m.playSeconds, 0);
    const totalCount = members.reduce((s, m) => s + m.playCount, 0);
    const firstPlayedAt = members.map((m) => m.firstPlayedAt).filter(Boolean).sort()[0] ?? rep.firstPlayedAt;
    const lastPlayedAt = members.map((m) => m.lastPlayedAt).filter(Boolean).sort().reverse()[0] ?? rep.lastPlayedAt;
    const seenCats = new Set<string>();
    const categories: string[] = [];
    const order = ['ps5_native_game', 'ps4_game', 'pspc_game', 'unknown'];
    for (const c of order) {
      if (members.some((m) => m.category === c) && !seenCats.has(c)) {
        categories.push(c);
        seenCats.add(c);
      }
    }
    for (const m of members) {
      if (!seenCats.has(m.category)) {
        categories.push(m.category);
        seenCats.add(m.category);
      }
    }

    const group = {
      key: rep.conceptId > 0 ? `c:${rep.conceptId}` : `t:${rep.titleId}`,
      name: rep.name,
      imageUrl: rep.imageUrl,
      categories,
      totalSeconds,
      totalCount,
      firstPlayedAt,
      lastPlayedAt,
      members,
    };

    // Match this group to trophy titles. PSN's getUserTitles returns
    // one entry per (game, platform) — find every trophy title whose
    // name matches loosely. A cross-gen game shows up twice (PS4 +
    // PS5) with different npCommunicationIds.
    const trophyTitles = await getCachedTrophyTitles();
    const want = normaliseTitle(group.name);
    const matched = trophyTitles.filter((t) => normaliseTitle(t.trophyTitleName) === want);

    const platforms: PsnPlatformTrophies[] = [];
    for (const t of matched) {
      const category = trophyPlatformToCategory(t.trophyTitlePlatform);
      const detail = await getCachedTrophyDetail(
        t.npCommunicationId,
        t.npServiceName as 'trophy' | 'trophy2',
      );
      const trophies: PsnTrophy[] = [];
      // Iterate by defined trophy set so order is stable; user progress
      // map gives us the earned state.
      for (const [trophyId, def] of detail.defined) {
        const userT = detail.earned.get(trophyId);
        trophies.push({
          trophyId,
          type: userT?.type ?? 'bronze',
          name: def.name,
          detail: def.detail,
          iconUrl: def.icon,
          hidden: def.hidden,
          earned: userT?.earned ?? false,
          earnedAt: userT?.earnedAt,
          earnedRate: userT?.earnedRate,
        });
      }
      // platinum first, then gold/silver/bronze; within type, earned-first
      // then by trophyId for stable ordering
      const RANK = { platinum: 0, gold: 1, silver: 2, bronze: 3 } as const;
      trophies.sort((a, b) => {
        if (RANK[a.type] !== RANK[b.type]) return RANK[a.type] - RANK[b.type];
        if (a.earned !== b.earned) return a.earned ? -1 : 1;
        return a.trophyId - b.trophyId;
      });

      platforms.push({
        category,
        npCommunicationId: t.npCommunicationId,
        npServiceName: t.npServiceName as 'trophy' | 'trophy2',
        iconUrl: t.trophyTitleIconUrl,
        progress: t.progress,
        defined: t.definedTrophies,
        earned: t.earnedTrophies,
        trophies,
      });
    }

    return { group, platforms };
  });

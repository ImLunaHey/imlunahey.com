import { createServerFn } from '@tanstack/react-start';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { cached, TTL } from './cache';

/**
 * Twitch Helix proxy — mints an app access token via the
 * Client Credentials flow, caches it (~4h lifetime), and wraps calls
 * to the public-data endpoints.
 *
 * Client secret must stay server-side. Configure via .env.local:
 *   TWITCH_CLIENT_ID=...
 *   TWITCH_CLIENT_SECRET=...
 */

const HELIX = 'https://api.twitch.tv/helix';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getAppToken(): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('twitch credentials not configured (TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET)');

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  if (!r.ok) throw new Error(`twitch token ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = { token: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
  return j.access_token;
}

async function helix<T>(path: string, params: Record<string, string | string[] | undefined>): Promise<T> {
  const token = await getAppToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;
  const url = new URL(HELIX + path);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const x of v) url.searchParams.append(k, x);
    else url.searchParams.set(k, v);
  }
  const r = await fetch(url.toString(), {
    headers: { 'client-id': clientId, authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`twitch ${path} ${r.status}${body ? ': ' + body.slice(0, 200) : ''}`);
  }
  return r.json() as Promise<T>;
}

// ─── streams ───────────────────────────────────────────────────────────────

export type Stream = {
  id: string;
  user_id: string;
  user_login: string;
  user_name: string;
  game_id: string;
  game_name: string;
  type: 'live' | '';
  title: string;
  viewer_count: number;
  started_at: string;
  language: string;
  thumbnail_url: string; // contains {width} + {height} placeholders
  tags: string[];
};

export type StreamsResponse = {
  data: Stream[];
  pagination: { cursor?: string };
};

export const getTopStreams = createServerFn({ method: 'GET' })
  .inputValidator((data: { language?: string; gameId?: string; after?: string; first?: number }) => data)
  .handler(async ({ data }): Promise<StreamsResponse> => {
    const first = Math.min(Math.max(1, data.first ?? 48), 100);
    const key = `twitch:streams:${data.language ?? ''}:${data.gameId ?? ''}:${data.after ?? ''}:${first}`;
    return cached(key, TTL.live, () =>
      helix<StreamsResponse>('/streams', {
        first: String(first),
        language: data.language,
        game_id: data.gameId,
        after: data.after,
      }),
    );
  });

// ─── top games ─────────────────────────────────────────────────────────────

export type Game = {
  id: string;
  name: string;
  box_art_url: string; // contains {width} + {height}
  igdb_id?: string;
};

export const getTopGames = createServerFn({ method: 'GET' })
  .inputValidator((data: { first?: number }) => data)
  .handler(async ({ data }): Promise<{ data: Game[] }> => {
    const first = Math.min(Math.max(1, data.first ?? 24), 100);
    return cached(`twitch:top-games:${first}`, TTL.short, () =>
      helix<{ data: Game[] }>('/games/top', { first: String(first) }),
    );
  });

// ─── category search ───────────────────────────────────────────────────────

export const searchCategories = createServerFn({ method: 'GET' })
  .inputValidator((data: { q: string }) => data)
  .handler(async ({ data }): Promise<{ data: Game[] }> => {
    const q = data.q.trim();
    if (!q) return { data: [] };
    return cached(`twitch:search-cat:${q.toLowerCase()}`, TTL.short, () =>
      helix<{ data: Game[] }>('/search/categories', { query: q, first: '20' }),
    );
  });

// ─── preferred language ────────────────────────────────────────────────────

// Twitch's `language` filter takes ISO 639-1 codes. We map the broader
// Accept-Language set down to this subset; anything outside becomes
// "all languages" (empty string).
const SUPPORTED_LANGS = new Set(['en', 'ja', 'ko', 'es', 'de', 'fr', 'ru', 'pt', 'zh', 'it', 'pl', 'tr', 'th', 'cs', 'nl', 'sv', 'fi', 'da', 'no', 'vi', 'id', 'ar']);

function parseAcceptLanguage(raw: string | null): string {
  if (!raw) return '';
  // "en-US,en;q=0.9,fr;q=0.8" → sorted primary tags by q-value
  const parts = raw.split(',').map((s) => {
    const [tag, ...params] = s.trim().split(';');
    const qParam = params.find((p) => p.trim().startsWith('q='));
    const q = qParam ? Number(qParam.trim().slice(2)) : 1;
    return { tag: tag.toLowerCase().split('-')[0], q: Number.isFinite(q) ? q : 1 };
  });
  parts.sort((a, b) => b.q - a.q);
  for (const { tag } of parts) {
    if (SUPPORTED_LANGS.has(tag)) return tag;
  }
  return '';
}

export const getPreferredLang = createServerFn({ method: 'GET' }).handler(async (): Promise<{ lang: string }> => {
  const h = getRequestHeaders();
  return { lang: parseAcceptLanguage(h.get('accept-language')) };
});

// ─── users / channel / detail ──────────────────────────────────────────────

export type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: 'partner' | 'affiliate' | '';
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  created_at: string;
};

export type ChannelInfo = {
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  broadcaster_language: string;
  game_id: string;
  game_name: string;
  title: string;
  delay: number;
  tags: string[];
  content_classification_labels: string[];
  is_branded_content: boolean;
};

export type Clip = {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
  is_featured: boolean;
};

export type Video = {
  id: string;
  stream_id: string | null;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: string;
  view_count: number;
  language: string;
  type: 'upload' | 'archive' | 'highlight';
  duration: string;
};

export type StreamDetail = {
  user: TwitchUser;
  channel: ChannelInfo | null;
  stream: Stream | null;
  clips: Clip[];
  videos: Video[];
};

export const getStreamDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: { login: string }) => data)
  .handler(async ({ data }): Promise<StreamDetail> => {
    const login = data.login.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,25}$/.test(login)) throw new Error('invalid login');

    return cached(`twitch:detail:${login}`, TTL.live, async () => {
      const userResp = await helix<{ data: TwitchUser[] }>('/users', { login });
      const user = userResp.data[0];
      if (!user) throw new Error(`no twitch user "${login}"`);

      const [channelResp, streamResp, clipsResp, videosResp] = await Promise.all([
        helix<{ data: ChannelInfo[] }>('/channels', { broadcaster_id: user.id }),
        helix<{ data: Stream[] }>('/streams', { user_id: user.id }),
        helix<{ data: Clip[] }>('/clips', { broadcaster_id: user.id, first: '12' }),
        helix<{ data: Video[] }>('/videos', { user_id: user.id, first: '10', type: 'archive' }),
      ]);

      return {
        user,
        channel: channelResp.data[0] ?? null,
        stream: streamResp.data[0] ?? null,
        clips: clipsResp.data,
        videos: videosResp.data,
      };
    });
  });

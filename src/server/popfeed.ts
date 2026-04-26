import { createServerFn } from '@tanstack/react-start';
import { BSKY_ACCOUNTS } from '../data';
import { resolveIdentity } from './atproto';
import { cached, TTL } from './cache';

const WATCH_TYPES = new Set(['movie', 'tv_show', 'tvShow', 'episode']);
const GAME_TYPES = new Set(['video_game', 'videoGame', 'game']);

type ReviewRecord = {
  uri: string;
  cid: string;
  value: {
    title: string;
    creativeWorkType: string;
    rating?: number;
    createdAt: string;
    text?: string;
    mainCredit?: string;
    mainCreditRole?: string;
    genres?: string[];
    posterUrl?: string;
    backdropUrl?: string;
    identifiers?: { tmdbId?: string; imdbId?: string; igdbId?: string };
    tags?: string[];
  };
};

type ListRecordsResp = { records: ReviewRecord[]; cursor?: string };

export type Watch = {
  rkey: string;
  title: string;
  kind: string;
  rating: number | null;
  text?: string;
  credit?: string;
  genres?: string[];
  poster?: string;
  backdrop?: string;
  url?: string;
  /** External ids carried through from the lexicon record so callers
   *  (e.g. /library) can cross-reference reviewed items against other
   *  ID-keyed datasets without re-resolving via tmdb. */
  imdbId?: string;
  tmdbId?: string;
  createdAt: string;
};

function isTv(kind: string): boolean {
  return kind === 'tv_show' || kind === 'tvShow' || kind === 'episode';
}

function tmdbUrl(kind: string, id?: string): string | undefined {
  if (!id) return undefined;
  const path = kind === 'movie' ? 'movie' : isTv(kind) ? 'tv' : null;
  return path ? `https://www.themoviedb.org/${path}/${id}` : undefined;
}

export type PopfeedData = {
  items: Watch[];
  thisYear: number;
};

async function fetchAllReviews(): Promise<ReviewRecord[]> {
  const handle = BSKY_ACCOUNTS[0];
  if (!handle) return [];
  const identity = await resolveIdentity(handle);
  if (!identity) return [];
  const { did, pds } = identity;

  const all: ReviewRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const u = new URL(`${pds}/xrpc/com.atproto.repo.listRecords`);
    u.searchParams.set('repo', did);
    u.searchParams.set('collection', 'social.popfeed.feed.review');
    u.searchParams.set('limit', '100');
    if (cursor) u.searchParams.set('cursor', cursor);
    const res = await fetch(u);
    if (!res.ok) break;
    const data = (await res.json()) as ListRecordsResp;
    all.push(...data.records);
    if (!data.cursor || data.records.length === 0) break;
    cursor = data.cursor;
  }
  return all;
}

function normalizeWatch(r: ReviewRecord): Watch {
  return {
    rkey: r.uri.split('/').pop() ?? '',
    title: r.value.title,
    kind: r.value.creativeWorkType,
    rating: typeof r.value.rating === 'number' ? r.value.rating : null,
    text: r.value.text,
    credit: r.value.mainCredit,
    genres: r.value.genres,
    poster: r.value.posterUrl,
    backdrop: r.value.backdropUrl,
    url: tmdbUrl(r.value.creativeWorkType, r.value.identifiers?.tmdbId),
    imdbId: r.value.identifiers?.imdbId,
    tmdbId: r.value.identifiers?.tmdbId,
    createdAt: r.value.createdAt,
  };
}

function thisYearCount(items: Array<{ createdAt: string }>): number {
  const year = String(new Date().getFullYear());
  return items.filter((i) => i.createdAt.startsWith(year)).length;
}

async function loadWatches(): Promise<PopfeedData> {
  const all = await fetchAllReviews();
  const items = all
    .filter((r) => WATCH_TYPES.has(r.value.creativeWorkType))
    .map(normalizeWatch)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, thisYear: thisYearCount(items) };
}

async function loadGames(): Promise<PopfeedData> {
  const all = await fetchAllReviews();
  const items = all
    .filter((r) => GAME_TYPES.has(r.value.creativeWorkType))
    .map(normalizeWatch)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items, thisYear: thisYearCount(items) };
}

export const getPopfeedWatches = createServerFn({ method: 'GET' }).handler((): Promise<PopfeedData> =>
  cached('popfeed:watches', TTL.short, loadWatches).catch(() => ({ items: [], thisYear: 0 })),
);

export const getPopfeedGames = createServerFn({ method: 'GET' }).handler((): Promise<PopfeedData> =>
  cached('popfeed:games', TTL.short, loadGames).catch(() => ({ items: [], thisYear: 0 })),
);

export type ReviewedIds = {
  imdbIds: string[];
  tmdbIds: string[];
};

/** Both IMDb and TMDB ids of every popfeed review record, used by
 *  /library to mark which shelf titles have been watched. Both lists
 *  are needed because popfeed records carry tmdbId reliably (~99% of
 *  reviews) but imdbId only sometimes (~30%) — matching on either
 *  catches everything. tmdb ids are emitted as strings to match how
 *  the popfeed lexicon stores them; library.json holds the numeric
 *  form, so the consumer coerces with String(item.tmdbId). */
export const getReviewedIds = createServerFn({ method: 'GET' }).handler(
  (): Promise<ReviewedIds> =>
    cached('popfeed:reviewed-ids', TTL.short, async () => {
      const all = await fetchAllReviews();
      const imdbIds = new Set<string>();
      const tmdbIds = new Set<string>();
      for (const r of all) {
        const ids = r.value.identifiers ?? {};
        if (ids.imdbId) imdbIds.add(ids.imdbId);
        if (ids.tmdbId) tmdbIds.add(String(ids.tmdbId));
      }
      return { imdbIds: [...imdbIds], tmdbIds: [...tmdbIds] };
    }).catch(() => ({ imdbIds: [], tmdbIds: [] })),
);

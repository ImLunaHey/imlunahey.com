#!/usr/bin/env node
/**
 * Convert a CLZ Movies CSV export into the JSON the /library page imports,
 * enriched with TMDB metadata (director, genres, poster, runtime, plot).
 *
 *   data/library.csv               (CLZ export, build input)
 *   data/library-tmdb-cache.json   (per-imdb-id TMDB responses, committed
 *                                   so re-runs are instant + reproducible)
 *   src/data/library.json          (build output, committed, page imports)
 *
 * Run with `pnpm library:build`. Subsequent runs only fetch IDs that
 * aren't in the cache, so adding a few rows to the CSV costs only those
 * lookups.
 *
 * The CSV format expected (CLZ Movies "All Movies" export, comma + double-
 * quote, header row):
 *   Title, Release Date, IMDb Url, Format, Distributor, Added Date
 *
 * Same IMDb ID can appear on multiple rows (e.g. owning two physical
 * editions of the same series) — each row becomes its own entry in the
 * output JSON, sharing TMDB metadata but with its own format/distributor.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// package.json declares "type": "module", so __dirname doesn't exist —
// derive it from import.meta.url like the other scripts do.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CSV_PATH = join(ROOT, 'data/library.csv');
const CACHE_PATH = join(ROOT, 'data/library-tmdb-cache.json');
const OUT_PATH = join(ROOT, 'src/data/library.json');

// TMDB v4 read-access token. Same one already inlined in
// src/hooks/use-themoviedb-image.ts — read-only public, fine to reuse.
const TMDB_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxMmMzYzZiZjgyZTA1OTY2MDZmMWNiN2NmOTE1YTNkNiIsIm5iZiI6MTQyMzA2MDUwMy4zNTM5OTk5LCJzdWIiOiI1NGQyMmUxN2MzYTM2ODc2MDAwMDI3YTUiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.FBMl7xmohHZDt3qLP3NgbYjElE1gaPRtNL_6Fx9NIQ8';
// be a courteous client: TMDB allows ~50 req/s, we do 5.
const REQ_DELAY_MS = 200;

type CsvRow = {
  title: string;
  releaseYear: number | null;
  imdbId: string;
  format: string;
  distributor: string;
  addedDate: string;
};

type TmdbHit = {
  mediaType: 'movie' | 'tv';
  id: number;
};

type TmdbDetails = {
  // movie shape and tv shape differ; we normalise on output
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  runtime?: number;
  episode_run_time?: number[];
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  origin_country?: string[];
};

type TmdbCredits = {
  crew?: Array<{ id: number; name: string; job: string }>;
  created_by?: Array<{ id: number; name: string }>;
};

/** Slim cache entry — only the TMDB-derived fields the page actually
 *  reads. Earlier versions of this script stored the raw TMDB responses
 *  (find + details + credits), which ballooned to ~34MB because credits
 *  payloads include the full cast (50+ actors with biographies). The
 *  detail page (when added) fetches TMDB on-demand via useQuery, so the
 *  build script doesn't need to cache anything beyond what's in the
 *  output JSON. */
type CacheEntry = {
  imdbId: string;
  fetchedAt: string;
  tmdbId: number | null;
  mediaType: 'movie' | 'tv' | null;
  posterPath: string | null;
  director: string | null;
  genres: string[];
  runtime: number | null;
  countries: string[];
  overview: string | null;
};

type Cache = Record<string, CacheEntry>;

/** Migrate any entries from the old fat shape (raw responses) to the
 *  new slim shape. Idempotent — re-running on an already-migrated cache
 *  is a no-op. */
function migrateCache(raw: unknown): Cache {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: Cache = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'object' || v === null) continue;
    const entry = v as Record<string, unknown>;

    // already-slim entries pass through unchanged.
    if ('tmdbId' in entry && 'genres' in entry) {
      out[k] = entry as unknown as CacheEntry;
      continue;
    }

    // old fat shape: { imdbId, fetchedAt, hit, details, credits }.
    const hit = (entry.hit ?? null) as TmdbHit | null;
    const details = (entry.details ?? null) as TmdbDetails | null;
    const credits = (entry.credits ?? null) as TmdbCredits | null;
    out[k] = {
      imdbId: k,
      fetchedAt: typeof entry.fetchedAt === 'string' ? entry.fetchedAt : new Date().toISOString(),
      tmdbId: hit?.id ?? null,
      mediaType: hit?.mediaType ?? null,
      posterPath: details?.poster_path ?? null,
      director: directorFrom(hit, credits),
      genres: (details?.genres ?? []).map((g) => g.name),
      runtime: runtimeFrom(hit, details),
      countries: countriesFrom(hit, details),
      overview: details?.overview ?? null,
    };
  }
  return out;
}

export type LibraryItem = {
  /** unique row id — same imdb can repeat for multiple physical
   *  editions, so include the index too. */
  id: string;
  // physical (CLZ)
  title: string;
  releaseYear: number | null;
  imdbId: string;
  format: string;
  distributor: string | null;
  addedDate: string;
  // tmdb-derived
  tmdbId: number | null;
  mediaType: 'movie' | 'tv' | null;
  posterPath: string | null;
  director: string | null;
  genres: string[];
  runtime: number | null;
  countries: string[];
  overview: string | null;
};

// ─── csv ──────────────────────────────────────────────────────────────

/** Minimal CSV parser for our well-known shape: comma-delimited, double-
 *  quote enclosed, header row. Handles embedded commas inside quoted
 *  fields and escaped quotes ("") inside quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuote = true;
      } else if (c === ',') {
        cur.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        cur.push(field);
        field = '';
        if (cur.length > 1 || cur[0] !== '') rows.push(cur);
        cur = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

function imdbIdFromUrl(url: string): string | null {
  const m = url.match(/tt\d{7,10}/);
  return m ? m[0] : null;
}

function readCsvRows(): CsvRow[] {
  const raw = readFileSync(CSV_PATH, 'utf8');
  const rows = parseCsv(raw);
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());
  const iTitle = idx('title');
  const iRelease = idx('release date');
  const iImdb = idx('imdb url');
  const iFormat = idx('format');
  const iDist = idx('distributor');
  const iAdded = idx('added date');

  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const imdb = imdbIdFromUrl(row[iImdb] ?? '');
    if (!imdb) continue;
    const yearStr = (row[iRelease] ?? '').trim();
    const year = /^\d{4}$/.test(yearStr) ? Number(yearStr) : null;
    out.push({
      title: (row[iTitle] ?? '').trim(),
      releaseYear: year,
      imdbId: imdb,
      format: (row[iFormat] ?? '').trim(),
      distributor: (row[iDist] ?? '').trim(),
      addedDate: (row[iAdded] ?? '').trim(),
    });
  }
  return out;
}

// ─── tmdb ─────────────────────────────────────────────────────────────

async function tmdb<T>(path: string): Promise<T | null> {
  const res = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookupTmdb(imdbId: string): Promise<CacheEntry> {
  const empty: CacheEntry = {
    imdbId,
    fetchedAt: new Date().toISOString(),
    tmdbId: null,
    mediaType: null,
    posterPath: null,
    director: null,
    genres: [],
    runtime: null,
    countries: [],
    overview: null,
  };

  type FindResp = {
    movie_results: Array<{ id: number }>;
    tv_results: Array<{ id: number }>;
  };
  const find = await tmdb<FindResp>(`/find/${imdbId}?external_source=imdb_id`);
  if (!find) return empty;

  let hit: TmdbHit | null = null;
  if (find.movie_results.length > 0) {
    hit = { mediaType: 'movie', id: find.movie_results[0].id };
  } else if (find.tv_results.length > 0) {
    hit = { mediaType: 'tv', id: find.tv_results[0].id };
  }
  if (!hit) return empty;

  await sleep(REQ_DELAY_MS);
  const details = await tmdb<TmdbDetails>(`/${hit.mediaType}/${hit.id}`);
  await sleep(REQ_DELAY_MS);
  const credits = await tmdb<TmdbCredits>(`/${hit.mediaType}/${hit.id}/credits`);

  return {
    imdbId,
    fetchedAt: new Date().toISOString(),
    tmdbId: hit.id,
    mediaType: hit.mediaType,
    posterPath: details?.poster_path ?? null,
    director: directorFrom(hit, credits),
    genres: (details?.genres ?? []).map((g) => g.name),
    runtime: runtimeFrom(hit, details),
    countries: countriesFrom(hit, details),
    overview: details?.overview ?? null,
  };
}

// ─── normalise + write ────────────────────────────────────────────────

function directorFrom(hit: TmdbHit | null, credits: TmdbCredits | null): string | null {
  if (!credits) return null;
  if (hit?.mediaType === 'tv') {
    const created = credits.created_by?.[0]?.name;
    if (created) return created;
  }
  const dir = credits.crew?.find((c) => c.job === 'Director');
  return dir?.name ?? null;
}

function runtimeFrom(hit: TmdbHit | null, details: TmdbDetails | null): number | null {
  if (!details) return null;
  if (hit?.mediaType === 'tv') {
    return details.episode_run_time?.[0] ?? null;
  }
  return details.runtime ?? null;
}

function countriesFrom(hit: TmdbHit | null, details: TmdbDetails | null): string[] {
  if (!details) return [];
  if (hit?.mediaType === 'tv') {
    return details.origin_country ?? [];
  }
  return (details.production_countries ?? []).map((p) => p.iso_3166_1);
}

function buildItem(row: CsvRow, idx: number, entry: CacheEntry): LibraryItem {
  return {
    id: `${row.imdbId}-${idx}`,
    title: row.title,
    releaseYear: row.releaseYear,
    imdbId: row.imdbId,
    format: row.format,
    distributor: row.distributor || null,
    addedDate: row.addedDate,
    tmdbId: entry.tmdbId,
    mediaType: entry.mediaType,
    posterPath: entry.posterPath,
    director: entry.director,
    genres: entry.genres,
    runtime: entry.runtime,
    countries: entry.countries,
    overview: entry.overview,
  };
}

// ─── main ─────────────────────────────────────────────────────────────

async function main() {
  const csvRows = readCsvRows();
  console.log(`csv: ${csvRows.length} rows`);

  const cache: Cache = existsSync(CACHE_PATH)
    ? migrateCache(JSON.parse(readFileSync(CACHE_PATH, 'utf8')))
    : {};
  const cachedBefore = Object.keys(cache).length;
  console.log(`cache: ${cachedBefore} entries`);

  const uniqueImdbIds = [...new Set(csvRows.map((r) => r.imdbId))];
  const toFetch = uniqueImdbIds.filter((id) => !cache[id]);
  console.log(`fetching: ${toFetch.length} new tmdb lookups`);

  let done = 0;
  for (const imdbId of toFetch) {
    try {
      cache[imdbId] = await lookupTmdb(imdbId);
    } catch (err) {
      console.error(`  ${imdbId} failed:`, err);
      cache[imdbId] = {
        imdbId,
        fetchedAt: new Date().toISOString(),
        tmdbId: null,
        mediaType: null,
        posterPath: null,
        director: null,
        genres: [],
        runtime: null,
        countries: [],
        overview: null,
      };
    }
    done++;
    if (done % 25 === 0) {
      console.log(`  ${done}/${toFetch.length}`);
      // flush cache periodically so an interrupt doesn't lose progress
      writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    }
    await sleep(REQ_DELAY_MS);
  }
  writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));

  const items: LibraryItem[] = csvRows.map((row, idx) => {
    const entry = cache[row.imdbId];
    return buildItem(row, idx, entry);
  });

  const missing = items.filter((i) => i.tmdbId == null).length;
  console.log(`done. ${items.length} items, ${missing} without a tmdb match.`);

  writeFileSync(OUT_PATH, JSON.stringify(items, null, 2));
  console.log(`wrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

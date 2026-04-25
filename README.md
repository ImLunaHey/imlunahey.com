# imlunahey.com

Personal site / data-dashboard. Pulls recent work, writing, scrobbles,
reviews and watching history from various APIs and renders them into a
phosphor-green terminal aesthetic. Also hosts ~100 small interactive labs
— atproto tooling, dev utilities, data explorers on UK-gov / Twitch /
Mastodon firehoses, in-browser media tools, games.

Live: [imlunahey.com](https://imlunahey.com)

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19 + Vite + file-based router)
- [Tailwind v4](https://tailwindcss.com) for design tokens; most components use plain CSS via `<style>` blocks
- [React Query](https://tanstack.com/query) for client-side data fetching (most pages render the shell instantly, data streams in after hydration)
- Deployed to [Cloudflare Workers](https://workers.cloudflare.com) via `@cloudflare/vite-plugin`
- Optional Cloudflare R2 for the gallery (see `docs/gallery-setup.md`)
- Package manager: [pnpm](https://pnpm.io) (pinned via `packageManager` in `package.json`)

## Data sources

| Section | Source |
| --- | --- |
| `/` recent repos, commit counts, contribution heatmap | GitHub REST + GraphQL |
| `/blog`, `/blog/$rkey` | [WhiteWind](https://whtwnd.com) (`com.whtwnd.blog.entry` on atproto) |
| `/projects`, `/projects/$name` | GitHub |
| `/watching`, `/games` | [Popfeed](https://popfeed.social) (`social.popfeed.feed.review`) |
| `/music` scrobbles + now-playing | last.fm `user.getrecenttracks` |
| NOW panel weather | [Open-Meteo](https://open-meteo.com) |
| `/gallery` | R2 bucket + Cloudflare Image Resizing |
| `/globe` | world-atlas topojson |
| `/ai` token-usage breakdown | [Tokscale](https://tokscale.com) |
| Guestbook | visitor's own PDS (`com.imlunahey.guestbook.entry`) |

### Labs by source (~100 labs at `/labs`)

| API | Labs |
| --- | --- |
| atproto appview + [constellation](https://constellation.microcosm.blue) | backlinks, top-posts, list-memberships, engagement-timeline, labels, quote-tree, reply-ratio, top-domains, thread-tree, feed, jetstream, firehose-stats, car-explorer, plc-log, did-log, handle-sniper, bsky-cards, bsky-composer, whtwnd editor, pdf-uploader, list-cleaner, year-in-review, labels cross-referenced against community labelers (skywatch, laelaps, etc.) |
| TfL Unified API | tfl-status, tfl-cycles, tfl-arrivals, tfl-air, tfl-roads, tfl-tube-map |
| UK open data | crime (police.uk), mp (commonsvotes-api.parliament.uk), hygiene (FSA) |
| Twitch Helix (Client Credentials) | twitch-live, twitch-live/$login |
| Mastodon SSE firehose (via worker proxy) | mastodon |
| Culture / media public APIs | met-museum, aic (Art Institute), poetry (PoetryDB), scryfall, xkcd, open-library, tvmaze, f1 (Ergast/Jolpica mirror) |
| Media in-browser ([mediabunny](https://mediabunny.dev) + WebCodecs) | media-inspector, frame-extractor, audio-extractor, clipper, converter |
| Markets | crypto (CoinGecko) |
| Infra / dev utilities | certs (crt.sh, with 5xx retry), dns (DoH), whois (RDAP), pds-health, http-headers, http-status, ids, jwt, cron, regex, diff, encode, hash, ua, curl-to-fetch, subnet, csv, json, schema, dist, exif, spectrogram, png-chunks, ascii, units, colour, timestamp, tid, lexicon, lexicon-validator, at-uri, og-preview, fingerprint, browser |
| Games / misc | snake, wordle, life, typing, matrix, terminal, periodic, screenshot-maker, infinite-canvas, verse-reveal, css-battles, iss (live ISS position), lightning (Open-Meteo storm risk) |

Every server-side fetch goes through a shared in-memory `cached(key, ttl)`
helper (`src/server/cache.ts`) with stale-on-error fallback, so external APIs
get hit at most once per TTL per worker isolate.

## Local dev

```bash
pnpm install
pnpm dev
```

Dev server runs on `http://localhost:5173` (vite + tanstack-start). Binds
on `0.0.0.0` so both `localhost` and `127.0.0.1` resolve — atproto's
loopback OAuth flow requires `127.0.0.1`.

### Environment variables

Create `.env.local`. Every var is optional — unset vars make the
corresponding panel / lab degrade gracefully instead of crashing:

```
GITHUB_TOKEN=<github PAT with public_repo + read:user>
LASTFM_API_KEY=<last.fm api key>
R2_PUBLIC_URL=<https://your-r2-bucket.domain>
TWITCH_CLIENT_ID=<dev.twitch.tv app id, for /labs/twitch-live>
TWITCH_CLIENT_SECRET=<dev.twitch.tv app secret — stays server-side>
BRRR_SECRET=<api.brrr.now bearer token for push-notifying new guestbook entries>
LEADERBOARD_HMAC_SECRET=<hmac key for signing leaderboard score submissions>
```

## Commands

| Command | Notes |
| --- | --- |
| `pnpm dev` | Local dev server |
| `pnpm build` | Production build (client + worker + prerender) |
| `pnpm analyse` | Build + emit `dist/stats.html` treemap of every chunk (gzip/brotli sizes) |
| `pnpm typecheck` | `tsc -b` |
| `pnpm lint` | ESLint |
| `pnpm lint:oxc` | oxlint (jsx-a11y rules) |
| `pnpm test` | Vitest |
| `pnpm start` | Run the built worker locally |

## Deploy

The build outputs a Cloudflare Worker at `dist/server/`. `wrangler.jsonc`
points at `@tanstack/react-start/server-entry`, with `nodejs_compat`
enabled for the atproto/SSR deps. CI runs `pnpm install --frozen-lockfile`
then `pnpm test`; deploy is `npx wrangler deploy`.

Set secrets in the CF dashboard (or `wrangler secret put`):

- `GITHUB_TOKEN`
- `LASTFM_API_KEY`
- `R2_PUBLIC_URL` (optional)
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `BRRR_SECRET` (optional)
- `LEADERBOARD_HMAC_SECRET`

## Public files & endpoints

| Path | Contents |
| --- | --- |
| `/sitemap.xml` | Every static page + every OG-registered lab + live blog entries. Edge-cached 1h. |
| `/rss.xml` | RSS 2.0 feed of public blog posts, ~320-char plaintext excerpts. Edge-cached 1h. |
| `/humans.txt` | [humanstxt.org](https://humanstxt.org) — sourced from `data.ts`, stamped with the HEAD commit date at build time. |
| `/oauth/client-metadata.json` | Dynamic atproto OAuth client metadata driven by `ALL_SCOPES` (`src/lib/oauth.ts`). |
| `/api/mastodon-stream` | SSE proxy for the Mastodon lab — validates hostname, forwards the upstream public-timeline stream with permissive CORS. |
| `/og/{slug}` | Per-page OG card rendered server-side via resvg. |

## SEO + performance

- **Canonical links** emitted on every route via `pageMeta()`. Dynamic detail pages (`/blog/$rkey`, `/projects/$name`, etc.) emit per-URL canonicals; lab detail pages keep the parent canonical on purpose.
- **Long-form meta descriptions** on every page via the optional `description` field on each OG registry entry (~150 chars).
- **Blog post excerpts** fetched SSR-side by a TanStack Router `loader` on `/blog/$rkey`, then stamped into `<meta name="description">` + `og:description`.
- **Critical CSS inlined** (~3 kB) in the document head so first paint doesn't wait on the main stylesheet.
- **Edge cache**: worker wraps SSR HTML responses with `cache-control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`. First visitor pays the SSR cost; subsequent visitors within the window get ~30 ms TTFB from Cloudflare's edge.
- **Devtools stripped** from production bundles — `@tanstack/react-query-devtools` is behind a dev-only lazy import.
- **Command palette lazy-loaded** — only fetches its ~30 kB chunk after the first ⌘K / `/` keypress.

## IndieWeb

- `<link rel="webmention">` + `<link rel="pingback">` point at the [webmention.io](https://webmention.io) endpoint — other IndieWeb sites can notify this domain of replies / likes / reposts.
- `<link rel="alternate" type="application/rss+xml">` on every page for feed-reader autodiscovery.
- `<link rel="author" href="/humans.txt">` for the humanstxt convention.
- `data.ts` socials are the source of truth for any RelMeAuth identity links.

## Layout

```
src/
  pages/            # route components (Home, Blog, Projects, …)
    labs/           # ~100 labs — atproto tooling, dev utilities, data
                    #   explorers, in-browser media tools, games
  routes/           # file-based router shells mapping urls → page components
    api/            # edge endpoints (mastodon-stream SSE proxy)
    oauth/          # atproto client-metadata + callback
  components/       # shared UI (NavBar, Layout, ErrorBoundary, CommandPalette, …)
  server/           # createServerFn endpoints: github, lastfm, popfeed,
                    #   whitewind, twitch, xkcd, certs, guestbook, …
  lib/              # small utils (atproto-helpers, critical-css, og helpers,
                    #   leaderboard-sig, wordle-judge, …)
  tests/setup/      # vitest cloudflare:workers + resvg wasm stubs
  data.ts           # static config: SITE, USES, SOCIALS, GITHUB_ACCOUNTS, …
```

## Why client-side data fetching (mostly)

Earlier versions ran SSR with deferred loader promises + `<Await>` streaming.
TanStack Start's SSR pipeline buffers the whole response until all
promises resolve, so cold loads blocked on the slowest upstream (~2–3 s of
blank page). Stripping most loaders and moving data sources to `useQuery`
gives TTFB ≈ 20 ms and a shell-first paint. The caches still live on the
server, behind the same `createServerFn` endpoints — the client just hits
them via RPC.

Exceptions where SSR loaders are still used on purpose: `/blog/$rkey` loads
the post record SSR-side so the post title + excerpt make it into `<meta
name="description">` before any bot reads the page.

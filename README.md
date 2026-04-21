# imlunahey.com

Personal site / data-dashboard. Pulls recent work, writing, scrobbles,
reviews and watching history from various APIs and renders them into a
phosphor-green terminal aesthetic.

Live: [imlunahey.com](https://imlunahey.com)

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19 + Vite + file-based router)
- [Tailwind v4](https://tailwindcss.com) for design tokens; most components use plain CSS via `<style>` blocks
- [React Query](https://tanstack.com/query) for client-side data fetching (all pages render the shell instantly, data streams in after hydration)
- Deployed to [Cloudflare Workers](https://workers.cloudflare.com) via `@cloudflare/vite-plugin`
- Optional Cloudflare R2 for the gallery (see `docs/gallery-setup.md`)

## Data sources

| Section | Source |
| --- | --- |
| `/` recent repos, commit counts, contribution heatmap | GitHub REST + GraphQL |
| `/blog` writing | [WhiteWind](https://whtwnd.com) (`com.whtwnd.blog.entry` on atproto) |
| `/projects` and `/projects/$name` | GitHub |
| `/watching` movies & tv, `/games` | [Popfeed](https://popfeed.social) (`social.popfeed.feed.review`) |
| `/music` scrobbles + live now-playing | last.fm `user.getrecenttracks` |
| NOW panel weather | [Open-Meteo](https://open-meteo.com) (no key) |
| `/gallery` | R2 bucket + Cloudflare Image Resizing |

Every server-side fetch goes through a shared in-memory `cached(key, ttl)`
helper (`src/server/cache.ts`) with stale-on-error fallback, so external APIs
get hit at most once per TTL per worker isolate.

## Local dev

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:3000` (vite + tanstack-start).

### Environment variables

Create `.env.local`:

```
GITHUB_TOKEN=<github PAT with public_repo + read:user>
LASTFM_API_KEY=<last.fm api key>
R2_PUBLIC_URL=<optional — https://your-r2-bucket.domain>
```

Without these, the corresponding panels render "unavailable" states
instead of crashing.

## Commands

| Command | Notes |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build (client + worker + prerender) |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run start` | Run the built worker locally |

## Deploy

The build outputs a Cloudflare Worker at `dist/server/`. `wrangler.jsonc`
points at `@tanstack/react-start/server-entry`, with `nodejs_compat`
enabled for the atproto/SSR deps.

Set secrets in the CF dashboard (or `wrangler secret put`):

- `GITHUB_TOKEN`
- `LASTFM_API_KEY`
- `R2_PUBLIC_URL` (optional)

## Layout

```
src/
  pages/            # route components (Home, Blog, Projects, …)
    labs/           # experiments: css-battles, verse-reveal, infinite-canvas,
                    #   pdf-uploader, car-explorer, feed, screenshot-maker, list-cleaner
  routes/           # file-based router shells — just map urls → page components
  components/       # shared UI (NavBar, Layout, ErrorBoundary, LiveMusicPanel, …)
  server/           # createServerFn endpoints: github, lastfm, popfeed, whtwnd, …
  lib/              # small utils (format, markdown helpers)
  data.ts           # static config: SITE, USES, SOCIALS, GITHUB_ACCOUNTS, …
```

## Why client-side data fetching

Earlier versions ran SSR with deferred loader promises + `<Await>` streaming.
TanStack Start's SSR pipeline buffers the whole response until all
promises resolve, so cold loads blocked on the slowest upstream (~2–3 s of
blank page). Stripping the loaders and moving every data source to
`useQuery` gives TTFB ≈ 20 ms and a shell-first paint. The caches still
live on the server, behind the same `createServerFn` endpoints — the
client just hits them via RPC.

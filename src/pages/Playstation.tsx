import { Link, getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { PsnGame, PsnLibrary } from '../server/playstation';

const route = getRouteApi('/_main/playstation/');

// pretty platform label for the chip + meta lines. PSN's `category`
// values are technical strings — these are the human forms.
const PLATFORM_LABEL: Record<string, string> = {
  ps5_native_game: 'ps5',
  ps4_game: 'ps4',
  ps3_game: 'ps3',
  psvita_game: 'vita',
  pspc_game: 'pc (psn)',
  // After server-side prefix refinement (see refinedCategory in
  // src/server/playstation.ts) only truly-unidentified entries
  // remain — odd launcher apps and the like.
  unknown: 'other',
};

/** Resolve PSN's snake-case category to a chip-friendly label. Falls
 *  back to a humanised version of the raw string ("ps3_game" →
 *  "ps3") for any future categories Sony introduces. */
function platformLabel(category: string): string {
  if (PLATFORM_LABEL[category]) return PLATFORM_LABEL[category];
  // strip the trailing `_game`, then any psN_ prefix → 'ps3', 'pspc' etc.
  return category
    .replace(/_native_game$/, '')
    .replace(/_game$/, '')
    .replace(/_/g, ' ');
}

function fmtPlaytime(seconds: number): string {
  if (seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const h = Math.floor(seconds / 3600);
  const d = Math.floor(seconds / 86400);
  const w = Math.floor(d / 7);
  // Step up the unit each time we cross a natural threshold so
  // 2005 hours reads as "11w 6d" instead of an unhelpful integer.
  // Stops at weeks — months are ambiguous-length and feel weird for
  // game-playtime context anyway.
  if (w >= 1) {
    const remD = d - w * 7;
    return remD > 0 ? `${w}w ${remD}d` : `${w}w`;
  }
  if (d >= 1) {
    const remH = h - d * 24;
    return remH > 0 ? `${d}d ${remH}h` : `${d}d`;
  }
  if (h >= 1) {
    const remM = m - h * 60;
    return remM > 0 ? `${h}h ${remM}m` : `${h}h`;
  }
  return `${m}m`;
}

function fmtAge(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '—';
  const dt = (Date.now() - ms) / 1000;
  if (dt < 86400) return 'today';
  if (dt < 86400 * 2) return 'yesterday';
  if (dt < 86400 * 30) return `${Math.round(dt / 86400)}d ago`;
  if (dt < 86400 * 365) return `${Math.round(dt / 86400 / 30)}mo ago`;
  return `${(dt / 86400 / 365).toFixed(1)}y ago`;
}

type SortKey = 'last-played' | 'playtime' | 'name' | 'first-played';

/** A merged "card" — one row per concept (PSN's stable id across
 *  PS4/PS5/regional reissues), with stats summed across every titleId
 *  in the group and a list of distinct platform categories. */
type GameGroup = {
  /** stable key for React + lookups */
  key: string;
  name: string;
  imageUrl: string;
  categories: string[];
  totalSeconds: number;
  totalCount: number;
  /** earliest firstPlayedAt across the group */
  firstPlayedAt: string;
  /** latest lastPlayedAt across the group */
  lastPlayedAt: string;
  members: PsnGame[];
};

function groupGames(games: PsnGame[]): GameGroup[] {
  const map = new Map<string, PsnGame[]>();
  for (const g of games) {
    // conceptId 0 means PSN didn't return a concept for this title —
    // fall back to titleId so unmatched ones still get their own card.
    const key = g.conceptId > 0 ? `c:${g.conceptId}` : `t:${g.titleId}`;
    const list = map.get(key) ?? [];
    list.push(g);
    map.set(key, list);
  }
  const out: GameGroup[] = [];
  for (const [key, members] of map) {
    // Prefer PS5 art over PS4 — PS5 covers usually have higher-res
    // localised images.
    const ps5 = members.find((m) => m.category === 'ps5_native_game');
    const rep = ps5 ?? members[0];
    const totalSeconds = members.reduce((s, m) => s + m.playSeconds, 0);
    const totalCount = members.reduce((s, m) => s + m.playCount, 0);
    const firstPlayedAt = members
      .map((m) => m.firstPlayedAt)
      .filter(Boolean)
      .sort()[0] ?? rep.firstPlayedAt;
    const lastPlayedAt = members
      .map((m) => m.lastPlayedAt)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? rep.lastPlayedAt;
    // Stable platform order: newest gen first, then anything else by
    // appearance order in the members list.
    const seen = new Set<string>();
    const categories: string[] = [];
    const order = ['ps5_native_game', 'ps4_game', 'ps3_game', 'psvita_game', 'pspc_game', 'unknown'];
    for (const c of order) {
      if (members.some((m) => m.category === c)) {
        categories.push(c);
        seen.add(c);
      }
    }
    for (const m of members) {
      if (!seen.has(m.category)) {
        categories.push(m.category);
        seen.add(m.category);
      }
    }
    out.push({
      key,
      name: rep.name,
      imageUrl: rep.imageUrl,
      categories,
      totalSeconds,
      totalCount,
      firstPlayedAt,
      lastPlayedAt,
      members,
    });
  }
  return out;
}

export default function PlaystationPage() {
  const data = route.useLoaderData() as PsnLibrary;

  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<string | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('last-played');

  const groups = useMemo(() => groupGames(data.games), [data.games]);

  const facets = useMemo(() => {
    // Counts are per-group (a card with both ps4 + ps5 increments
    // both); matches the "platform = ps4 → show every group with a
    // ps4 copy" filter behaviour below.
    const platforms = new Map<string, number>();
    for (const g of groups) {
      for (const c of g.categories) {
        platforms.set(c, (platforms.get(c) ?? 0) + 1);
      }
    }
    // Order by generation (newest first) rather than by count, so
    // chips read left-to-right as ps5 → ps4 → ps3 → vita → pc. Anything
    // not in the canonical list falls in by count after.
    const ORDER = ['ps5_native_game', 'ps4_game', 'ps3_game', 'psvita_game', 'pspc_game', 'unknown'];
    const rank = (cat: string) => {
      const i = ORDER.indexOf(cat);
      return i === -1 ? Infinity : i;
    };
    return {
      platforms: [...platforms.entries()].sort((a, b) => {
        const ar = rank(a[0]);
        const br = rank(b[0]);
        if (ar !== br) return ar - br;
        return b[1] - a[1];
      }),
    };
  }, [groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = groups.filter((g) => {
      if (platform !== 'all' && !g.categories.includes(platform)) return false;
      if (q && !g.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortBy === 'last-played') {
      out = [...out].sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
    } else if (sortBy === 'first-played') {
      out = [...out].sort((a, b) => b.firstPlayedAt.localeCompare(a.firstPlayedAt));
    } else if (sortBy === 'playtime') {
      out = [...out].sort((a, b) => b.totalSeconds - a.totalSeconds);
    } else {
      out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    }
    return out;
  }, [groups, search, platform, sortBy]);

  const totalSeconds = data.games.reduce((s, g) => s + g.playSeconds, 0);
  const totalHours = totalSeconds / 3600;

  if (!data.configured) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-psn">
          <header className="page-hd">
            <div className="label" style={{ marginBottom: 8 }}>
              ~/playstation
            </div>
            <h1>
              playstation<span className="dot">.</span>
            </h1>
            <p className="sub">
              this page surfaces every title from luna&apos;s playstation library — playtime, last-played, platform.
              currently unconfigured: <code className="inline">PSN_NPSSO</code> isn&apos;t set on the worker, so we
              can&apos;t talk to sony&apos;s api.
            </p>
            <p className="sub t-faint">
              setup is a one-time copy-paste of the <code className="inline">npsso</code> cookie value from
              playstation.com → wrangler secret put. then the page repopulates on next load.
            </p>
          </header>
          <footer className="psn-footer">
            <span>
              src: <span className="t-accent">psn-api · unconfigured</span>
            </span>
            <span>
              ←{' '}
              <Link to="/" className="t-accent">
                home
              </Link>
            </span>
          </footer>
        </main>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-psn">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/playstation
          </div>
          <h1>
            playstation<span className="dot">.</span>
          </h1>
          <p className="sub">
            every title from my playstation library — playtime, last played, platform. straight from sony&apos;s api,
            cached 5 min server-side so the page is fast even when the upstream is sleepy.
          </p>
          <div className="meta">
            <span>
              titles <b className="t-accent">{groups.length}</b>
            </span>
            {data.games.length !== groups.length ? (
              <span className="t-faint">
                ({data.games.length} copies)
              </span>
            ) : null}
            <span>
              total <b>{Math.round(totalHours).toLocaleString()}h</b>
            </span>
            {facets.platforms.map(([cat, n]) => (
              <span key={cat}>
                {platformLabel(cat)} <b>{n}</b>
              </span>
            ))}
            <span className="t-faint">
              fetched <b>{fmtAge(new Date(data.fetchedAt).toISOString())}</b>
            </span>
          </div>
        </header>

        <section className="controls">
          <div className="control-row">
            <input
              type="search"
              className="search"
              placeholder="search title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="search playstation library"
            />
            <div className="sort-row">
              <span className="control-label">sort</span>
              {(
                [
                  ['last-played', 'last played'],
                  ['playtime', 'playtime'],
                  ['name', 'name'],
                  ['first-played', 'first played'],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  className={'chip' + (sortBy === k ? ' on' : '')}
                  onClick={() => setSortBy(k)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-row">
            <span className="control-label">platform</span>
            <button
              className={'chip' + (platform === 'all' ? ' on' : '')}
              onClick={() => setPlatform('all')}
              type="button"
            >
              all
            </button>
            {facets.platforms.map(([cat, n]) => (
              <button
                key={cat}
                className={'chip' + (platform === cat ? ' on' : '')}
                onClick={() => setPlatform(cat)}
                type="button"
              >
                {platformLabel(cat)} <span className="chip-n">{n}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="psn-shelf">
          {filtered.map((g) => (
            <PsnTile key={g.key} group={g} />
          ))}
          {filtered.length === 0 ? (
            <div className="empty">no titles match that filter.</div>
          ) : null}
        </section>

        <footer className="psn-footer">
          <span>
            src:{' '}
            <span className="t-accent">
              psn-api · TTL.short · {data.games.length} titles
            </span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function PsnTile({ group }: { group: GameGroup }) {
  // url id is the conceptId for matched groups, the raw titleId
  // otherwise. The detail-page server fn coerces back to the right
  // lookup ('c:N' / 't:CUSAxxx') so consumers don't need to know.
  const linkId =
    group.key.startsWith('c:')
      ? group.key.slice(2)
      : group.members[0]?.titleId ?? '';
  return (
    <Link
      to="/playstation/$id"
      params={{ id: linkId }}
      className="psn-tile psn-tile-link"
    >
      <div className="psn-art">
        {group.imageUrl ? (
          <img src={group.imageUrl} alt={group.name} loading="lazy" />
        ) : (
          <div className="psn-art-fallback">{group.name.slice(0, 2)}</div>
        )}
        {/* multiple platforms read as separate pills so each one is
            individually scannable instead of running together. */}
        <div className="psn-platforms">
          {group.categories.map((c) => (
            <span key={c} className="psn-platform">
              {platformLabel(c)}
            </span>
          ))}
        </div>
      </div>
      <div className="psn-meta">
        <div className="psn-name">{group.name}</div>
        <div className="psn-stats">
          <span className="t-accent">{fmtPlaytime(group.totalSeconds)}</span>
          <span className="psn-dot">·</span>
          <span>last {fmtAge(group.lastPlayedAt)}</span>
        </div>
      </div>
    </Link>
  );
}

const CSS = `
  .shell-psn { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub code.inline {
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: 0.95em;
    padding: 0 4px;
    background: var(--color-bg-raised);
  }
  .page-hd .meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }

  .controls {
    padding: var(--sp-4) 0 var(--sp-5);
    display: flex; flex-direction: column; gap: var(--sp-2);
    border-bottom: 1px solid var(--color-border);
  }
  .control-row {
    display: flex; align-items: center; flex-wrap: wrap;
    gap: 6px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .control-label {
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
    font-size: 10px;
    min-width: 56px;
  }
  .chip {
    padding: 4px 10px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    text-transform: lowercase; letter-spacing: 0.06em;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .chip:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .chip.on {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
  }
  .chip-n {
    font-size: 9px; padding: 1px 5px;
    background: var(--color-bg-raised);
    color: var(--color-fg-dim);
  }
  .search {
    flex: 1; min-width: 220px;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 12px;
  }
  .search:focus { outline: none; border-color: var(--color-accent); }
  .sort-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  /* shelf — wider tiles than /library because PSN art is 16:9 not 2:3 */
  .psn-shelf {
    padding: var(--sp-5) 0 var(--sp-8);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--sp-4) var(--sp-3);
  }
  .psn-tile {
    display: flex; flex-direction: column;
    gap: var(--sp-2);
    /* same trick as the library grid — skip layout for off-screen
       tiles. PSN libraries can run into the hundreds. */
    content-visibility: auto;
    contain-intrinsic-size: auto 200px;
  }
  .psn-tile-link { text-decoration: none; color: inherit; }
  .psn-tile-link:hover { text-decoration: none; }
  .psn-tile-link:hover .psn-art { border-color: var(--color-accent-dim); }
  .psn-tile-link:hover .psn-name { color: var(--color-accent); }
  .psn-art {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .psn-art img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .psn-art-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-display);
    font-size: 32px;
    color: var(--color-fg-faint);
    text-transform: lowercase;
  }
  /* platform pills sit horizontally in the top-right corner — keeps
     the bottom-right of the art clear for the title strip below.
     wraps to a new line if a card somehow has 4+ platforms. */
  .psn-platforms {
    position: absolute;
    top: 6px; right: 6px;
    display: flex; gap: 4px;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: calc(100% - 12px);
  }
  .psn-platform {
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.7);
    color: var(--color-accent);
    font-family: var(--font-mono); font-size: 9px;
    text-transform: uppercase; letter-spacing: 0.12em;
    border: 1px solid var(--color-accent-dim);
  }

  .psn-meta { padding: 0 2px; }
  .psn-name {
    font-family: var(--font-display);
    font-size: 14px; line-height: 1.2;
    color: var(--color-fg);
    letter-spacing: -0.01em;
    /* psn names get long ("dirt rally 2.0 game of the year edition") —
       cap to two lines so tiles stay grid-aligned */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .psn-stats {
    margin-top: 4px;
    display: flex; gap: 6px; align-items: baseline;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
  }
  .psn-stats .t-accent { color: var(--color-accent); }
  .psn-dot { color: var(--color-fg-ghost); }

  .empty {
    grid-column: 1 / -1;
    padding: var(--sp-10) var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }

  .psn-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-4);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 760px) {
    .psn-shelf { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
    .psn-name { font-size: 13px; }
    .psn-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;

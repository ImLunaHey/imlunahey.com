import { Link, getRouteApi } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type {
  TimelineData,
  TimelineEvent,
  CommitEvent,
  ScrobbleEvent,
  BlogEvent,
  GuestbookEvent,
  ReviewEvent,
  GalleryEvent,
} from '../server/timeline';

// Unified chronological feed: blog posts, guestbook entries, commits,
// scrobbles. Source data comes from the loader (see
// src/routes/_main/timeline.tsx → getTimelineEvents). The page handles:
//   - filter chips per source (toggle on/off)
//   - day grouping (one date heading per day)
//   - clustering of firehose-noisy sources within a single day
//     (commits per-repo, scrobbles all together) — otherwise the page
//     becomes a log dump where 50 scrobbles drown a single blog post

const route = getRouteApi('/_main/timeline');

type Kind = TimelineEvent['kind'];
const KIND_LABEL: Record<Kind, string> = {
  blog: 'writing',
  guestbook: 'guestbook',
  commit: 'commits',
  scrobble: 'music',
  review: 'reviews',
  gallery: 'gallery',
};
const KIND_GLYPH: Record<Kind, string> = {
  blog: '✎',
  guestbook: '✦',
  commit: '◆',
  scrobble: '♪',
  review: '★',
  gallery: '▦',
};
// chip order — left to right. matches roughly slow→fast cadence so
// the high-signal sources read first.
const KIND_ORDER: Kind[] = ['blog', 'review', 'guestbook', 'gallery', 'commit', 'scrobble'];

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function fmtDay(key: string): string {
  // ISO yyyy-mm-dd → "Mon 25 Apr 2026" — short enough to fit in a
  // sidebar without truncating, includes year for the "back catalog"
  // entries far down the page
  const d = new Date(key + 'T00:00:00Z');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** A "row" on the timeline. Either a singleton event (blog, guestbook,
 *  individual commit if expanded) or a cluster of firehose events
 *  collapsed into one summary line. */
type Row =
  | { kind: 'blog'; event: BlogEvent }
  | { kind: 'guestbook'; event: GuestbookEvent }
  | { kind: 'review'; event: ReviewEvent }
  | { kind: 'gallery-cluster'; events: GalleryEvent[] }
  | { kind: 'commit-cluster'; repo: string; events: CommitEvent[] }
  | { kind: 'scrobble-cluster'; events: ScrobbleEvent[] };

type Day = { key: string; rows: Row[] };

function groupIntoDays(events: TimelineEvent[]): Day[] {
  const byDay = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const k = dayKey(e.ts);
    const list = byDay.get(k) ?? [];
    list.push(e);
    byDay.set(k, list);
  }
  // map iteration follows insertion order, and the input is already
  // sorted newest-first, so days come out newest-first too.
  return [...byDay.entries()].map(([key, dayEvents]) => {
    const rows: Row[] = [];

    // singletons: blog + guestbook + reviews each get their own row
    for (const e of dayEvents) {
      if (e.kind === 'blog') rows.push({ kind: 'blog', event: e });
      else if (e.kind === 'guestbook') rows.push({ kind: 'guestbook', event: e });
      else if (e.kind === 'review') rows.push({ kind: 'review', event: e });
    }

    // gallery: cluster per day so a 30-photo dump from one shoot
    // doesn't push everything else off the screen
    const galleryEvents = dayEvents.filter((e): e is GalleryEvent => e.kind === 'gallery');
    if (galleryEvents.length > 0) {
      rows.push({ kind: 'gallery-cluster', events: galleryEvents });
    }

    // commits: cluster per repo. one row per repo per day.
    const commitsByRepo = new Map<string, CommitEvent[]>();
    for (const e of dayEvents) {
      if (e.kind === 'commit') {
        const list = commitsByRepo.get(e.repo) ?? [];
        list.push(e);
        commitsByRepo.set(e.repo, list);
      }
    }
    for (const [repo, evs] of commitsByRepo) {
      rows.push({ kind: 'commit-cluster', repo, events: evs });
    }

    // scrobbles: one cluster per day, no matter how many tracks
    const scrobbles = dayEvents.filter((e): e is ScrobbleEvent => e.kind === 'scrobble');
    if (scrobbles.length > 0) {
      rows.push({ kind: 'scrobble-cluster', events: scrobbles });
    }

    return { key, rows };
  });
}

export default function TimelinePage() {
  const data = route.useLoaderData() as TimelineData;
  const [active, setActive] = useState<Set<Kind>>(new Set(KIND_ORDER));

  const filtered = useMemo(
    () => data.events.filter((e) => active.has(e.kind)),
    [data.events, active],
  );
  const days = useMemo(() => groupIntoDays(filtered), [filtered]);

  function toggle(k: Kind) {
    setActive((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      // keep at least one source on; otherwise the page goes blank
      // and the only way out is to reload
      if (next.size === 0) next.add(k);
      return next;
    });
  }

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-tl">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/timeline
          </div>
          <h1>
            timeline<span className="dot">.</span>
          </h1>
          <p className="sub">
            everything i publish, in one chronology. blog posts, guestbook entries, commits to the repos i actually
            push to, and lastfm scrobbles. firehose-y sources (commits + scrobbles) are clustered per day so the
            slower streams don&apos;t get drowned.
          </p>
          <div className="meta">
            <span>
              <b className="t-accent">{data.events.length}</b> events
            </span>
            <span>
              <b className="t-accent">{days.length}</b> days
            </span>
            <span className="t-faint">cached 5m · refreshes from constellation + github + lastfm</span>
          </div>

          <div className="chips">
            {KIND_ORDER.map((k) => {
              const on = active.has(k);
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(k)}
                  className={'chip-btn' + (on ? ' on' : '')}
                  aria-pressed={on}
                >
                  <span className="chip-glyph" aria-hidden="true">
                    {KIND_GLYPH[k]}
                  </span>
                  {KIND_LABEL[k]}
                  <span className="chip-count">{data.counts[k]}</span>
                </button>
              );
            })}
          </div>
        </header>

        <section className="timeline">
          {days.length === 0 ? (
            <div className="empty">
              no events match the current filter — toggle a source back on to see something here.
            </div>
          ) : (
            days.map((d) => (
              <div key={d.key} className="day">
                <div className="day-hd">
                  <span className="day-rule" />
                  <span className="day-label">{fmtDay(d.key)}</span>
                  <span className="day-rule" />
                </div>
                <div className="day-rows">
                  {d.rows.map((row, i) => (
                    <RowView key={i} row={row} />
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <footer className="tl-footer">
          <span>
            src:{' '}
            <span className="t-accent">whtwnd · constellation · github · lastfm → /api (server fns) → this page</span>
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

function RowView({ row }: { row: Row }) {
  switch (row.kind) {
    case 'blog':
      return <BlogRow event={row.event} />;
    case 'guestbook':
      return <GuestbookRow event={row.event} />;
    case 'review':
      return <ReviewRow event={row.event} />;
    case 'gallery-cluster':
      return <GalleryClusterRow events={row.events} />;
    case 'commit-cluster':
      return <CommitClusterRow repo={row.repo} events={row.events} />;
    case 'scrobble-cluster':
      return <ScrobbleClusterRow events={row.events} />;
  }
}

function BlogRow({ event }: { event: BlogEvent }) {
  return (
    <article className="row row-blog">
      <div className="row-glyph" aria-hidden="true">
        {KIND_GLYPH.blog}
      </div>
      <div className="row-body">
        <div className="row-top">
          <span className="row-kind">{KIND_LABEL.blog}</span>
          <span className="row-time">{fmtTime(event.ts)}</span>
        </div>
        <Link to={`/blog/${event.rkey}` as never} className="row-title">
          {event.title}
        </Link>
        {event.excerpt ? <p className="row-excerpt">{event.excerpt}</p> : null}
        <div className="row-foot t-faint">{event.readMin} min read</div>
      </div>
    </article>
  );
}

function GuestbookRow({ event }: { event: GuestbookEvent }) {
  const initials = event.displayName.slice(0, 2).toLowerCase();
  return (
    <article className="row row-guestbook">
      <div className="row-glyph" aria-hidden="true">
        {KIND_GLYPH.guestbook}
      </div>
      <div className="row-body">
        <div className="row-top">
          <span className="row-kind">{KIND_LABEL.guestbook}</span>
          <span className="row-time">{fmtTime(event.ts)}</span>
        </div>
        <div className="gb-line">
          {event.avatar ? (
            <img src={event.avatar} alt="" className="gb-avatar" loading="lazy" />
          ) : (
            <span className="gb-avatar gb-avatar-fallback">{initials}</span>
          )}
          <a
            href={`https://bsky.app/profile/${event.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="gb-name"
          >
            {event.displayName}
          </a>
          <span className="gb-handle">@{event.handle}</span>
        </div>
        <p className="row-excerpt">{event.text}</p>
      </div>
    </article>
  );
}

function ReviewRow({ event }: { event: ReviewEvent }) {
  // films link to /watching/<rkey>, games to /games/<rkey>. The rkey is
  // the same atproto record key used everywhere else, so deep-linking
  // back into the relevant section page lets the user click through to
  // the full review.
  const detailHref = event.media === 'film' ? `/watching/${event.rkey}` : `/games/${event.rkey}`;
  return (
    <article className={'row row-review row-review-' + event.media}>
      <div className="row-glyph" aria-hidden="true">
        {KIND_GLYPH.review}
      </div>
      <div className="row-body">
        <div className="row-top">
          <span className="row-kind">
            {event.media === 'film' ? 'film/tv' : 'game'}
          </span>
          {event.rating != null ? (
            <span className="review-rating">
              {event.rating}<span className="t-faint">/10</span>
            </span>
          ) : null}
          <span className="row-time">{fmtTime(event.ts)}</span>
        </div>
        <div className="review-line">
          {event.poster ? (
            <img src={event.poster} alt="" className="review-poster" loading="lazy" />
          ) : null}
          <div className="review-text-wrap">
            <Link to={detailHref as never} className="row-title">
              {event.title}
            </Link>
            {event.text ? <p className="row-excerpt">{event.text}</p> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function GalleryClusterRow({ events }: { events: GalleryEvent[] }) {
  const [open, setOpen] = useState(false);
  const photos = events.filter((e) => e.itemKind === 'photo').length;
  const mj = events.filter((e) => e.itemKind === 'mj').length;
  // shape the summary for whichever kind dominates the day; mixed days
  // get both counts spelled out
  const summary =
    photos > 0 && mj > 0
      ? `${photos} photo${photos === 1 ? '' : 's'} + ${mj} render${mj === 1 ? '' : 's'}`
      : photos > 0
      ? `${photos} ${photos === 1 ? 'photo' : 'photos'}`
      : `${mj} ${mj === 1 ? 'render' : 'renders'}`;
  return (
    <article className="row row-gallery">
      <div className="row-glyph" aria-hidden="true">
        {KIND_GLYPH.gallery}
      </div>
      <div className="row-body">
        <div className="row-top">
          <span className="row-kind">{KIND_LABEL.gallery}</span>
          <span className="row-time">{fmtTime(events[0].ts)}</span>
        </div>
        <button
          type="button"
          className="cluster-summary"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <b className="t-accent">{summary}</b>{' '}
          <span className="t-faint">{open ? '▾' : '▸'}</span>
        </button>
        {open ? (
          <div className="gallery-grid">
            {events.map((g) => (
              <Link
                key={g.thumbUrl}
                to={'/gallery' as never}
                className="gallery-thumb"
                aria-label={g.prompt ?? 'gallery item'}
              >
                <img
                  src={g.thumbUrl}
                  alt=""
                  loading="lazy"
                  width={g.w}
                  height={g.h}
                />
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CommitClusterRow({ repo, events }: { repo: string; events: CommitEvent[] }) {
  const [open, setOpen] = useState(false);
  const earliest = events[events.length - 1];
  const latest = events[0];
  const window = earliest.ts === latest.ts ? fmtTime(latest.ts) : `${fmtTime(earliest.ts)} → ${fmtTime(latest.ts)}`;
  return (
    <article className="row row-commit">
      <div className="row-glyph" aria-hidden="true">
        {KIND_GLYPH.commit}
      </div>
      <div className="row-body">
        <div className="row-top">
          <span className="row-kind">{KIND_LABEL.commit}</span>
          <span className="row-time">{window}</span>
        </div>
        <button
          type="button"
          className="cluster-summary"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <b className="t-accent">{events.length}</b>{' '}
          {events.length === 1 ? 'commit' : 'commits'} to{' '}
          <b>{repo}</b>{' '}
          <span className="t-faint">{open ? '▾' : '▸'}</span>
        </button>
        {!open && events[0] ? (
          <p className="cluster-latest t-dim">latest: {events[0].msg}</p>
        ) : null}
        {open ? (
          <ul className="commit-list">
            {events.map((c) => (
              <li key={c.sha}>
                <a
                  href={`https://github.com/ImLunaHey/${repo}/commit/${c.sha}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="commit-sha"
                >
                  {c.sha}
                </a>
                <span className="commit-msg">{c.msg}</span>
                <span className="commit-time t-faint">{fmtTime(c.ts)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

function ScrobbleClusterRow({ events }: { events: ScrobbleEvent[] }) {
  const [open, setOpen] = useState(false);
  // top artist of the day — purely as flavour. counts ties resolve to
  // whichever artist's first appearance was earliest in the array,
  // which is fine for a one-line summary.
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.artist, (counts.get(e.artist) ?? 0) + 1);
  const topArtist = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const earliest = events[events.length - 1];
  const latest = events[0];
  const window = earliest.ts === latest.ts ? fmtTime(latest.ts) : `${fmtTime(earliest.ts)} → ${fmtTime(latest.ts)}`;

  return (
    <article className="row row-scrobble">
      <div className="row-glyph" aria-hidden="true">
        {KIND_GLYPH.scrobble}
      </div>
      <div className="row-body">
        <div className="row-top">
          <span className="row-kind">{KIND_LABEL.scrobble}</span>
          <span className="row-time">{window}</span>
        </div>
        <button
          type="button"
          className="cluster-summary"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <b className="t-accent">{events.length}</b>{' '}
          {events.length === 1 ? 'scrobble' : 'scrobbles'}
          {topArtist ? (
            <>
              {' '}
              · top: <b>{topArtist}</b>
            </>
          ) : null}{' '}
          <span className="t-faint">{open ? '▾' : '▸'}</span>
        </button>
        {open ? (
          <ul className="scrobble-list">
            {events.map((s, i) => (
              <li key={i}>
                {s.art ? <img src={s.art} alt="" className="scrobble-art" loading="lazy" /> : null}
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="scrobble-track">
                  {s.track}
                </a>
                <span className="scrobble-artist t-dim">— {s.artist}</span>
                <span className="scrobble-time t-faint">{fmtTime(s.ts)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

const CSS = `
  .shell-tl { max-width: 920px; margin: 0 auto; padding: 0 var(--sp-6); }

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
  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }

  /* filter chips */
  .chips {
    display: flex; gap: var(--sp-2); flex-wrap: wrap;
    margin-top: var(--sp-4);
  }
  .chip-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 10px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    text-transform: lowercase; letter-spacing: 0.08em;
    cursor: pointer;
  }
  .chip-btn:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .chip-btn.on {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
  }
  .chip-glyph { font-family: var(--font-display); font-size: 14px; }
  .chip-count {
    font-size: 10px;
    padding: 1px 5px;
    background: var(--color-bg-raised);
    color: var(--color-fg-dim);
    margin-left: 2px;
  }

  /* day grouping */
  .timeline { padding: var(--sp-5) 0 var(--sp-8); }
  .day { margin-bottom: var(--sp-6); }
  .day-hd {
    display: flex; align-items: center; gap: var(--sp-3);
    padding: var(--sp-3) 0;
  }
  .day-rule {
    flex: 1; height: 1px;
    background: var(--color-border);
  }
  .day-label {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.14em;
  }
  .day-rows {
    display: flex; flex-direction: column;
    gap: var(--sp-2);
  }

  /* shared row layout */
  .row {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: var(--sp-3);
    padding: var(--sp-3) 0;
    border-bottom: 1px dashed var(--color-border);
  }
  .row:last-child { border-bottom: none; }
  .row-glyph {
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--color-fg-faint);
    text-align: center; line-height: 1.2;
  }
  .row-blog .row-glyph { color: var(--color-accent); }
  .row-guestbook .row-glyph { color: var(--color-accent); }
  .row-review .row-glyph { color: var(--color-accent); }
  .row-gallery .row-glyph { color: var(--color-accent); }
  .row-top {
    display: flex; gap: var(--sp-2); align-items: baseline;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  .row-time { margin-left: auto; }
  .row-kind { color: var(--color-accent); }

  .row-title {
    display: block;
    font-family: var(--font-display);
    font-size: 22px; line-height: 1.15;
    color: var(--color-fg);
    letter-spacing: -0.01em;
    text-decoration: none;
    margin-top: 4px;
  }
  .row-title:hover { color: var(--color-accent); text-decoration: none; }
  .row-excerpt {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.55;
    margin-top: 4px;
  }
  .row-foot {
    margin-top: 6px;
    font-family: var(--font-mono); font-size: 10px;
  }

  /* guestbook line */
  .gb-line {
    display: flex; gap: 6px; align-items: center;
    margin-top: 4px;
  }
  .gb-avatar {
    width: 18px; height: 18px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 0 0 1px var(--color-border);
    display: inline-flex; align-items: center; justify-content: center;
    font-family: var(--font-display); font-size: 9px;
    color: #fff;
  }
  .gb-avatar-fallback {
    background: linear-gradient(135deg, var(--color-accent-dim), var(--color-accent-faint));
  }
  .gb-name {
    font-family: var(--font-display); font-size: 14px;
    color: var(--color-fg);
    text-decoration: none;
  }
  .gb-name:hover { color: var(--color-accent); }
  .gb-handle {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
  }

  /* cluster summary buttons (commits, scrobbles) */
  .cluster-summary {
    display: inline-block;
    background: transparent;
    border: none;
    padding: 4px 0;
    margin-top: 2px;
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-align: left;
  }
  .cluster-summary:hover { color: var(--color-fg); }
  .cluster-summary b { color: var(--color-fg); font-weight: 400; }
  .cluster-summary b.t-accent { color: var(--color-accent); }
  .cluster-latest {
    margin-top: 2px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }

  .commit-list, .scrobble-list {
    list-style: none;
    margin: var(--sp-2) 0 0; padding: 0;
    border-left: 1px dashed var(--color-border);
    padding-left: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .commit-list li {
    display: flex; gap: var(--sp-2); align-items: baseline;
    padding: 2px 0;
    flex-wrap: wrap;
  }
  .commit-sha {
    color: var(--color-accent);
    font-size: 10px;
    text-decoration: none;
  }
  .commit-sha:hover { text-decoration: underline; }
  .commit-msg {
    color: var(--color-fg-dim);
    flex: 1; min-width: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .commit-time { font-size: 10px; }

  .scrobble-list li {
    display: flex; gap: var(--sp-2); align-items: center;
    padding: 3px 0;
  }
  .scrobble-art {
    width: 20px; height: 20px;
    object-fit: cover;
    flex-shrink: 0;
  }
  .scrobble-track {
    color: var(--color-fg);
    text-decoration: none;
  }
  .scrobble-track:hover { color: var(--color-accent); }
  .scrobble-artist { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .scrobble-time { font-size: 10px; }

  /* review */
  .review-rating {
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    margin-right: var(--sp-2);
  }
  .review-line {
    display: flex; gap: var(--sp-3); align-items: flex-start;
    margin-top: 4px;
  }
  .review-poster {
    width: 56px; height: 84px;
    object-fit: cover;
    flex-shrink: 0;
    border: 1px solid var(--color-border);
  }
  .review-text-wrap { min-width: 0; flex: 1; }

  /* gallery cluster */
  .gallery-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: var(--sp-2);
    margin-top: var(--sp-2);
  }
  .gallery-thumb {
    display: block;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .gallery-thumb img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .gallery-thumb:hover { border-color: var(--color-accent-dim); }

  .empty {
    padding: var(--sp-10) var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }

  .tl-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-5);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 760px) {
    .row { grid-template-columns: 24px 1fr; gap: var(--sp-2); }
    .row-glyph { font-size: 14px; }
    .row-title { font-size: 18px; }
    .tl-footer { flex-direction: column; gap: var(--sp-3); }
  }
`;

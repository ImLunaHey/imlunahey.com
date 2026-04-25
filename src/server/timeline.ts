import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';
import { getBlogEntries, type BlogEntry } from './whitewind';
import { getGuestbookEntries, type GuestbookEntry } from './guestbook';
import { getRecentCommits, type RecentCommit } from './commits';
import { getRecentTracks, type LastFmTrack } from './lastfm';
import { getPopfeedWatches, getPopfeedGames, type Watch } from './popfeed';
import { getGallery, type GalleryItem } from './gallery';

// One unified chronological feed merging the four content streams the
// site already publishes. Server fans out to existing fetchers in
// parallel — each one has its own cache, plus this aggregator caches
// the merged result for TTL.short so the page doesn't pay 4× external
// API round trips per request.
//
// The page does the day-grouping + clustering of firehose-noisy
// streams (commits + scrobbles); this fn just returns a flat
// chronologically-sorted array.

export type BlogEvent = {
  kind: 'blog';
  ts: string;
  rkey: string;
  title: string;
  excerpt: string;
  readMin: number;
};
export type GuestbookEvent = {
  kind: 'guestbook';
  ts: string;
  uri: string;
  did: string;
  handle: string;
  displayName: string;
  avatar: string | null;
  text: string;
};
export type CommitEvent = {
  kind: 'commit';
  ts: string;
  sha: string;
  repo: string;
  msg: string;
};
export type ScrobbleEvent = {
  kind: 'scrobble';
  ts: string;
  track: string;
  artist: string;
  album: string;
  url: string;
  art: string | null;
};
export type ReviewEvent = {
  kind: 'review';
  ts: string;
  rkey: string;
  /** broad media bucket — drives the icon + the link target on the page. */
  media: 'film' | 'game';
  title: string;
  rating: number | null;
  text?: string;
  poster?: string;
  url?: string;
};
export type GalleryEvent = {
  kind: 'gallery';
  ts: string;
  /** 'photo' for camera shots, 'mj' for midjourney/sd renders. */
  itemKind: 'photo' | 'mj';
  /** Pre-resolved cloudflare-image-resizing thumbnail URL. Computed
   *  server-side because the page doesn't know about R2_PUBLIC_URL. */
  thumbUrl: string;
  prompt?: string;
  series?: string;
  w: number;
  h: number;
};

export type TimelineEvent =
  | BlogEvent
  | GuestbookEvent
  | CommitEvent
  | ScrobbleEvent
  | ReviewEvent
  | GalleryEvent;

// Repos to surface commit activity for. Hand-maintained because GitHub's
// /users/<u>/events endpoint mixes in too much noise (issue comments,
// stars, watches, etc.) and rate-limits aggressively. Add a repo here
// when it becomes one you push to often enough to want timeline coverage.
const COMMIT_REPOS: Array<{ owner: string; name: string }> = [
  { owner: 'ImLunaHey', name: 'imlunahey.com' },
  { owner: 'ImLunaHey', name: 'nixos-configs' },
];

export type TimelineData = {
  events: TimelineEvent[];
  /** counts per source — used for filter-chip labels */
  counts: {
    blog: number;
    guestbook: number;
    commit: number;
    scrobble: number;
    review: number;
    gallery: number;
  };
};

function blogToEvents(entries: BlogEntry[]): BlogEvent[] {
  return entries.map((b) => ({
    kind: 'blog',
    ts: b.createdAt,
    rkey: b.rkey,
    title: b.title,
    excerpt: b.excerpt,
    readMin: b.readMin,
  }));
}

function guestbookToEvents(entries: GuestbookEntry[]): GuestbookEvent[] {
  return entries.map((g) => ({
    kind: 'guestbook',
    ts: g.createdAt,
    uri: g.uri,
    did: g.did,
    handle: g.handle,
    displayName: g.displayName,
    avatar: g.avatar,
    text: g.text,
  }));
}

function commitsToEvents(repo: string, commits: RecentCommit[]): CommitEvent[] {
  return commits.map((c) => ({
    kind: 'commit',
    ts: c.date,
    sha: c.sha,
    repo,
    msg: c.msg,
  }));
}

function scrobblesToEvents(tracks: LastFmTrack[]): ScrobbleEvent[] {
  return tracks
    // skip the live "now playing" track — it has no ts and would jump
    // around the timeline on each reload.
    .filter((t): t is LastFmTrack & { ts: string } => t.ts != null)
    .map((t) => ({
      kind: 'scrobble',
      ts: t.ts,
      track: t.track,
      artist: t.artist,
      album: t.album,
      url: t.url,
      art: t.art,
    }));
}

function reviewsToEvents(media: 'film' | 'game', items: Watch[]): ReviewEvent[] {
  return items.map((w) => ({
    kind: 'review',
    ts: w.createdAt,
    rkey: w.rkey,
    media,
    title: w.title,
    rating: w.rating,
    text: w.text,
    poster: w.poster,
    url: w.url,
  }));
}

function galleryToEvents(publicUrl: string, items: GalleryItem[]): GalleryEvent[] {
  // matches the thumbUrl helper in src/pages/Gallery.tsx — keep these
  // in sync if either changes; cf-image-resizing path is fixed.
  const origin = publicUrl.replace(/\/$/, '');
  return items.map((g) => {
    const path = g.key.replace(/^\//, '');
    return {
      kind: 'gallery',
      ts: g.createdAt,
      itemKind: g.kind === 'mj' ? 'mj' : 'photo',
      thumbUrl: `${origin}/cdn-cgi/image/width=240,format=auto,fit=cover/${path}`,
      prompt: g.prompt,
      series: g.series,
      w: g.w,
      h: g.h,
    };
  });
}

export const getTimelineEvents = createServerFn({ method: 'GET' }).handler(
  (): Promise<TimelineData> =>
    cached('timeline:all', TTL.short, async (): Promise<TimelineData> => {
      // Fan out everything that can run concurrently. Each underlying
      // fetcher already has its own cache + its own catch handler — but
      // we re-wrap with `.catch(() => fallback)` defensively so a single
      // upstream failure can't reject the whole timeline.
      const [
        blog,
        guestbook,
        watches,
        games,
        gallery,
        tracks,
        ...commitArrays
      ] = await Promise.all([
        getBlogEntries().catch(() => ({ entries: [] as BlogEntry[], totalWords: 0, since: 0 })),
        getGuestbookEntries().catch(() => [] as GuestbookEntry[]),
        getPopfeedWatches().catch(() => ({ items: [] as Watch[], thisYear: 0 })),
        getPopfeedGames().catch(() => ({ items: [] as Watch[], thisYear: 0 })),
        getGallery().catch(
          () =>
            ({ status: 'error', publicUrl: '', items: [], generatedAt: null }) as Awaited<
              ReturnType<typeof getGallery>
            >,
        ),
        getRecentTracks().catch(() => ({ tracks: [] as LastFmTrack[], total: 0 })),
        ...COMMIT_REPOS.map((r) =>
          getRecentCommits({ data: r })
            .then((c) => ({ repo: r.name, commits: c }))
            .catch(() => ({ repo: r.name, commits: [] as RecentCommit[] })),
        ),
      ]);

      const events: TimelineEvent[] = [
        ...blogToEvents(blog.entries),
        ...guestbookToEvents(guestbook),
        ...reviewsToEvents('film', watches.items),
        ...reviewsToEvents('game', games.items),
        ...galleryToEvents(gallery.publicUrl, gallery.items),
        ...commitArrays.flatMap((c) => commitsToEvents(c.repo, c.commits)),
        ...scrobblesToEvents(tracks.tracks),
      ];

      // newest first
      events.sort((a, b) => b.ts.localeCompare(a.ts));

      const counts = {
        blog: events.filter((e) => e.kind === 'blog').length,
        guestbook: events.filter((e) => e.kind === 'guestbook').length,
        commit: events.filter((e) => e.kind === 'commit').length,
        scrobble: events.filter((e) => e.kind === 'scrobble').length,
        review: events.filter((e) => e.kind === 'review').length,
        gallery: events.filter((e) => e.kind === 'gallery').length,
      };

      return { events, counts };
    }),
);

import { iterateAtpRepo } from '@atcute/car';
import { getPdsEndpoint } from '@atcute/identity';
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

const handleResolver = new CompositeHandleResolver({
  strategy: 'race',
  methods: {
    dns: new DohJsonHandleResolver({ dohUrl: 'https://mozilla.cloudflare-dns.com/dns-query' }),
    http: new WellKnownHandleResolver(),
  },
});
const docResolver = new CompositeDidDocumentResolver({
  methods: { plc: new PlcDidDocumentResolver(), web: new WebDidDocumentResolver() },
});

type Progress = { received: number; total: number; phase: 'resolve' | 'fetch' | 'parse' | 'done' };

type PostRecord = {
  $type: string;
  text?: string;
  createdAt?: string;
  langs?: string[];
  reply?: unknown;
  embed?: { $type?: string };
  facets?: Array<{ features?: Array<{ $type: string; tag?: string; did?: string; uri?: string }> }>;
};

type PostRef = { text: string; chars: number; createdAt: string; rkey: string };

type PostEngagement = { likes: number; reposts: number; replies: number; quotes: number };

type Enrichment = {
  followerCount: number | null;
  crossApp: { total: number; nonBsky: Array<[string, number]> } | null;
  postStats: Map<string, PostEngagement>;
};

type Summary = {
  did: string;
  pds: string;
  year: number | null; // null = all time
  totals: { posts: number; likes: number; reposts: number; follows: number; blocks: number; lists: number; starter: number };
  byMonth: number[]; // 12
  byDow: number[]; // 7, sun=0
  byHour: number[]; // 24
  byYear: Array<[number, number]>; // [year, posts] sorted ascending
  replyCount: number;
  media: { images: number; video: number; external: number; quote: number; record: number };
  postLengths: number[];
  longest: PostRef | null;
  shortest: PostRef | null;
  hashtags: Array<[string, number]>;
  mentions: Array<[string, number]>;
  langs: Array<[string, number]>;
  byCollection: Array<[string, number]>;
  byCollectionAllTime: Array<[string, number]>;
  totalChars: number;
  totalGraphemes: number;
  busiestDay: { date: string; count: number } | null;
  firstOfYearPost: PostRef | null;
  mostActiveYear: { year: number; count: number } | null;
};

function countGraphemes(s: string): number {
  try {
    let n = 0;
    for (const _ of new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)) n++;
    return n;
  } catch { return s.length; }
}

async function resolve(handleOrDid: string): Promise<{ did: string; pds: string }> {
  let did: string;
  if (handleOrDid.startsWith('did:')) did = handleOrDid;
  else did = await handleResolver.resolve(handleOrDid as never);
  const doc = await docResolver.resolve(did as never);
  const pds = getPdsEndpoint(doc);
  if (!pds) throw new Error('no pds found in did document');
  return { did, pds };
}

async function fetchCar(pds: string, did: string, onProgress: (p: Progress) => void): Promise<Uint8Array> {
  const url = `${pds}/xrpc/com.atproto.sync.getRepo?did=${encodeURIComponent(did)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`getRepo ${res.status}`);
  const total = Number(res.headers.get('content-length') ?? 0);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('no response body');
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress({ received, total, phase: 'fetch' });
    }
  }
  const all = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { all.set(c, offset); offset += c.length; }
  return all;
}

type PreparedPost = {
  text: string;
  graphemes: number;
  hasReply: boolean;
  embedType: string | null;
  langs: string[];
  hashtags: string[];
  mentions: string[];
};

type RepoRec = {
  collection: string;
  rkey: string;
  createdAt: string;
  year: number | null;
  post: PreparedPost | null;
};

/**
 * Expand the CAR into a flat record array once per account. All expensive
 * per-record derivations (grapheme count, facet extraction, embed type) happen
 * here so `analyze` can iterate cheaply for any year filter.
 */
function expandCar(bytes: Uint8Array): RepoRec[] {
  const out: RepoRec[] = [];
  for (const { collection, rkey, record } of iterateAtpRepo(bytes)) {
    const r = record as Record<string, unknown>;
    const createdAt = (r.createdAt as string | undefined) ?? '';
    const yearNum = createdAt.length >= 4 ? Number(createdAt.slice(0, 4)) : NaN;
    const year = Number.isFinite(yearNum) ? yearNum : null;

    let post: PreparedPost | null = null;
    if (collection === 'app.bsky.feed.post') {
      const p = r as PostRecord;
      const text = p.text ?? '';
      const hashtags: string[] = [];
      const mentions: string[] = [];
      for (const facet of p.facets ?? []) {
        for (const feat of facet.features ?? []) {
          if (feat.$type === 'app.bsky.richtext.facet#tag' && feat.tag) hashtags.push(feat.tag);
          else if (feat.$type === 'app.bsky.richtext.facet#mention' && feat.did) mentions.push(feat.did);
        }
      }
      if (!p.facets) {
        for (const m of text.matchAll(/#(\w+)/g)) hashtags.push(m[1]);
      }
      post = {
        text,
        graphemes: countGraphemes(text),
        hasReply: !!p.reply,
        embedType: (p.embed?.$type as string | undefined) ?? null,
        langs: p.langs ?? [],
        hashtags,
        mentions,
      };
    }

    out.push({ collection, rkey, createdAt, year, post });
  }
  return out;
}

function analyze(records: RepoRec[], did: string, pds: string, year: number | null): Summary {
  const totals = { posts: 0, likes: 0, reposts: 0, follows: 0, blocks: 0, lists: 0, starter: 0 };
  const byMonth = new Array(12).fill(0);
  const byDow = new Array(7).fill(0);
  const byHour = new Array(24).fill(0);
  const media = { images: 0, video: 0, external: 0, quote: 0, record: 0 };
  const postLengths: number[] = [];
  const hashtagCount = new Map<string, number>();
  const mentionCount = new Map<string, number>();
  const langCount = new Map<string, number>();
  const byDayCount = new Map<string, number>();
  const byCollection = new Map<string, number>();
  const byCollectionAllTime = new Map<string, number>();
  const byYearCount = new Map<number, number>();
  let replyCount = 0;
  let longest: Summary['longest'] = null;
  let shortest: Summary['shortest'] = null;
  let totalChars = 0;
  let totalGraphemes = 0;
  let firstOfYearPost: Summary['firstOfYearPost'] = null;
  const isAllTime = year === null;

  for (const rec of records) {
    const { collection, rkey, createdAt, post } = rec;
    const inScope = createdAt.length > 0 && (isAllTime || rec.year === year);

    byCollectionAllTime.set(collection, (byCollectionAllTime.get(collection) ?? 0) + 1);
    if (inScope) byCollection.set(collection, (byCollection.get(collection) ?? 0) + 1);

    if (!inScope) continue;

    if (post) {
      // app.bsky.feed.post
      totals.posts++;
      const d = new Date(createdAt);
      byMonth[d.getUTCMonth()]++;
      byDow[d.getUTCDay()]++;
      byHour[d.getUTCHours()]++;
      if (rec.year !== null) byYearCount.set(rec.year, (byYearCount.get(rec.year) ?? 0) + 1);
      const day = createdAt.slice(0, 10);
      byDayCount.set(day, (byDayCount.get(day) ?? 0) + 1);

      if (post.hasReply) replyCount++;
      const text = post.text;
      const graphemes = post.graphemes;
      postLengths.push(graphemes);
      totalChars += text.length;
      totalGraphemes += graphemes;
      if (!firstOfYearPost && text) firstOfYearPost = { text, chars: graphemes, createdAt, rkey };
      if (!longest || graphemes > longest.chars) longest = { text, chars: graphemes, createdAt, rkey };
      if (text && (!shortest || graphemes < shortest.chars)) shortest = { text, chars: graphemes, createdAt, rkey };

      switch (post.embedType) {
        case 'app.bsky.embed.images': media.images++; break;
        case 'app.bsky.embed.video': media.video++; break;
        case 'app.bsky.embed.external': media.external++; break;
        case 'app.bsky.embed.record': media.quote++; break;
        case 'app.bsky.embed.recordWithMedia': media.record++; break;
      }
      for (const l of post.langs) langCount.set(l, (langCount.get(l) ?? 0) + 1);
      for (const tag of post.hashtags) hashtagCount.set(tag, (hashtagCount.get(tag) ?? 0) + 1);
      for (const did of post.mentions) mentionCount.set(did, (mentionCount.get(did) ?? 0) + 1);
    } else if (collection === 'app.bsky.feed.like') totals.likes++;
    else if (collection === 'app.bsky.feed.repost') totals.reposts++;
    else if (collection === 'app.bsky.graph.follow') totals.follows++;
    else if (collection === 'app.bsky.graph.block') totals.blocks++;
    else if (collection === 'app.bsky.graph.list') totals.lists++;
    else if (collection === 'app.bsky.graph.starterpack') totals.starter++;
  }

  let busiest: { date: string; count: number } | null = null;
  for (const [date, count] of byDayCount) {
    if (!busiest || count > busiest.count) busiest = { date, count };
  }

  let mostActive: { year: number; count: number } | null = null;
  for (const [y, count] of byYearCount) {
    if (!mostActive || count > mostActive.count) mostActive = { year: y, count };
  }

  const hashtags = [...hashtagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const mentions = [...mentionCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const langs = [...langCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const colls = [...byCollection.entries()].sort((a, b) => b[1] - a[1]);
  const collsAll = [...byCollectionAllTime.entries()].sort((a, b) => b[1] - a[1]);
  const byYearSorted = [...byYearCount.entries()].sort((a, b) => a[0] - b[0]);

  return {
    did, pds, year, totals, byMonth, byDow, byHour,
    byYear: byYearSorted,
    replyCount, media,
    postLengths, longest, shortest, hashtags, mentions, langs,
    byCollection: colls, byCollectionAllTime: collsAll,
    totalChars, totalGraphemes, busiestDay: busiest, firstOfYearPost,
    mostActiveYear: mostActive,
  };
}

const CURRENT_YEAR = new Date().getUTCFullYear();
const YEAR_OPTIONS: Array<{ value: string; label: string; num: number | null }> = [
  { value: 'all', label: 'all time', num: null },
  { value: String(CURRENT_YEAR), label: String(CURRENT_YEAR), num: CURRENT_YEAR },
  { value: String(CURRENT_YEAR - 1), label: String(CURRENT_YEAR - 1), num: CURRENT_YEAR - 1 },
  { value: String(CURRENT_YEAR - 2), label: String(CURRENT_YEAR - 2), num: CURRENT_YEAR - 2 },
  { value: String(CURRENT_YEAR - 3), label: String(CURRENT_YEAR - 3), num: CURRENT_YEAR - 3 },
  { value: String(CURRENT_YEAR - 4), label: String(CURRENT_YEAR - 4), num: CURRENT_YEAR - 4 },
];
const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const DOW_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseYearParam(v: string | undefined): string | null {
  if (!v) return null;
  if (v === 'all') return 'all';
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return String(n);
}

function yearSelectionToNum(selection: string): number | null {
  return selection === 'all' ? null : Number(selection);
}

export default function YearInReviewPage() {
  const params = useParams({ strict: false }) as { handle?: string; year?: string };
  const navigate = useNavigate();

  const urlHandle = params.handle;
  const urlYear = parseYearParam(params.year); // 'all' | '2024' | null

  const [handleInput, setHandleInput] = useState(urlHandle ?? 'imlunahey.com');
  const [yearInput, setYearInput] = useState<string>(urlYear ?? String(CURRENT_YEAR - 1));
  const [progress, setProgress] = useState<Progress | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);

  // Keep the dropdown synced to the URL — navigating (e.g. back/forward buttons
  // or a link) should update the displayed selection.
  useEffect(() => {
    if (urlYear && urlYear !== yearInput) setYearInput(urlYear);
    if (urlHandle && urlHandle !== handleInput) setHandleInput(urlHandle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlYear, urlHandle]);

  // What we're actively showing a review for (derived from URL).
  const activeHandle = urlHandle ?? null;
  const activeYear: number | null = urlYear ? yearSelectionToNum(urlYear) : null;
  const hasActiveRequest = !!(urlHandle && urlYear);

  // Step 1: resolve handle → {did, pds}. Cached by handle.
  const resolveQuery = useQuery({
    queryKey: ['yr-resolve', activeHandle],
    queryFn: async () => {
      try {
        setResolveErr(null);
        return await resolve(activeHandle!);
      } catch (e) {
        setResolveErr(e instanceof Error ? e.message : 'resolve failed');
        throw e;
      }
    },
    enabled: !!activeHandle && hasActiveRequest,
    retry: false,
    staleTime: 1000 * 60 * 10,
  });

  // Step 2: fetch CAR. Cached by DID — so changing year doesn't redownload.
  const carQuery = useQuery({
    queryKey: ['yr-car', resolveQuery.data?.did],
    queryFn: async () => {
      setProgress({ received: 0, total: 0, phase: 'fetch' });
      const bytes = await fetchCar(
        resolveQuery.data!.pds,
        resolveQuery.data!.did,
        (p) => setProgress(p),
      );
      setProgress({ received: bytes.length, total: bytes.length, phase: 'parse' });
      return bytes;
    },
    enabled: !!resolveQuery.data,
    retry: false,
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 30,
  });

  const did = resolveQuery.data?.did;

  // Authoritative floor: when did the account actually exist? PLC audit log
  // gives us the true creation timestamp (for did:plc:...); did:web fallback
  // still uses the atproto epoch.
  const plcCreatedQuery = useQuery({
    queryKey: ['yr-plc-created', did],
    queryFn: async (): Promise<number | null> => {
      if (!did?.startsWith('did:plc:')) return null;
      const res = await fetch(`https://plc.directory/${did}/log/audit`);
      if (!res.ok) return null;
      const log = (await res.json()) as Array<{ createdAt: string }>;
      if (log.length === 0) return null;
      const oldest = log.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
      const y = Number(oldest.createdAt.slice(0, 4));
      return Number.isFinite(y) ? y : null;
    },
    enabled: !!did,
    staleTime: 1000 * 60 * 60,
  });

  // Step 3a: expand CAR to a flat records array once per CAR.
  const records = useMemo(() => {
    if (!carQuery.data) return null;
    return expandCar(carQuery.data);
  }, [carQuery.data]);

  // Step 3b: compute which years actually have activity — used for the dropdown.
  // `createdAt` on records is user-asserted and can be anything; gate it with
  // the authoritative PLC account-creation year as a floor so nobody's
  // backdated "i was here in 2014" record leaks into the dropdown.
  const activeYears = useMemo<number[]>(() => {
    if (!records) return [];
    const NOW_YEAR = new Date().getUTCFullYear();
    const floor = plcCreatedQuery.data ?? 2022;
    const seen = new Set<number>();
    for (const r of records) {
      if (r.year === null) continue;
      if (r.year < floor || r.year > NOW_YEAR) continue;
      seen.add(r.year);
    }
    return [...seen].sort((a, b) => b - a);
  }, [records, plcCreatedQuery.data]);

  // Step 3c: analyze per year — fast filter over the pre-parsed array.
  const summary = useMemo(() => {
    if (!records || !resolveQuery.data || !hasActiveRequest) return null;
    return analyze(records, resolveQuery.data.did, resolveQuery.data.pds, activeYear);
  }, [records, resolveQuery.data, hasActiveRequest, activeYear]);

  // Enrichment 1: follower count via Constellation (cheap single query)
  const followerQuery = useQuery({
    queryKey: ['yr-followers', did],
    queryFn: async () => {
      const u = new URL('https://constellation.microcosm.blue/links');
      u.searchParams.set('target', did!);
      u.searchParams.set('collection', 'app.bsky.graph.follow');
      u.searchParams.set('path', '.subject');
      u.searchParams.set('limit', '1');
      const res = await fetch(u);
      if (!res.ok) return null;
      const j = (await res.json()) as { total?: number };
      return j.total ?? 0;
    },
    enabled: !!did,
    staleTime: 1000 * 60 * 10,
  });

  // Enrichment 2: cross-app backlinks (all incoming references across atproto)
  const crossAppQuery = useQuery({
    queryKey: ['yr-cross', did],
    queryFn: async () => {
      const u = new URL('https://constellation.microcosm.blue/links');
      u.searchParams.set('target', did!);
      u.searchParams.set('limit', '100');
      const res = await fetch(u);
      if (!res.ok) return null;
      const j = (await res.json()) as { total?: number; linking_records?: Array<{ collection: string }> };
      // group sample by collection to surface non-bsky lexicons
      const sample = new Map<string, number>();
      for (const r of j.linking_records ?? []) {
        sample.set(r.collection, (sample.get(r.collection) ?? 0) + 1);
      }
      const nonBsky = [...sample.entries()]
        .filter(([c]) => !c.startsWith('app.bsky.'))
        .sort((a, b) => b[1] - a[1]);
      return { total: j.total ?? 0, nonBsky };
    },
    enabled: !!did,
    staleTime: 1000 * 60 * 10,
  });

  // Enrichment 3: engagement on highlighted posts via appview
  const highlightedUris = (() => {
    const out: string[] = [];
    if (did && summary?.longest) out.push(`at://${did}/app.bsky.feed.post/${summary.longest.rkey}`);
    if (did && summary?.firstOfYearPost && summary.firstOfYearPost.rkey !== summary.longest?.rkey) {
      out.push(`at://${did}/app.bsky.feed.post/${summary.firstOfYearPost.rkey}`);
    }
    return out;
  })();
  const postStatsQuery = useQuery({
    queryKey: ['yr-post-stats', highlightedUris.join('|')],
    queryFn: async () => {
      const u = new URL('https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts');
      for (const uri of highlightedUris) u.searchParams.append('uris', uri);
      const res = await fetch(u);
      if (!res.ok) return new Map<string, PostEngagement>();
      const j = (await res.json()) as { posts?: Array<{ uri: string; likeCount?: number; repostCount?: number; replyCount?: number; quoteCount?: number }> };
      const map = new Map<string, PostEngagement>();
      for (const p of j.posts ?? []) {
        map.set(p.uri, {
          likes: p.likeCount ?? 0,
          reposts: p.repostCount ?? 0,
          replies: p.replyCount ?? 0,
          quotes: p.quoteCount ?? 0,
        });
      }
      return map;
    },
    enabled: highlightedUris.length > 0,
    staleTime: 1000 * 60 * 5,
  });

  const running = resolveQuery.isFetching || carQuery.isFetching;
  const error = resolveErr ?? (carQuery.error instanceof Error ? carQuery.error.message : null);

  // Clear transient progress once we have a summary.
  useEffect(() => {
    if (summary) setProgress(null);
  }, [summary]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = handleInput.trim();
    if (!h || running) return;
    navigate({
      to: `/labs/year-in-review/${encodeURIComponent(h)}/${encodeURIComponent(yearInput)}` as never,
    });
  };

  const shareUrl = summary && urlHandle && urlYear
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/labs/year-in-review/${encodeURIComponent(urlHandle)}/${encodeURIComponent(urlYear)}`
    : null;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-yr">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">year in review</span>
        </div>

        <header className="yr-hd">
          <h1>year in review<span className="dot">.</span></h1>
          <p className="sub">
            enter any bluesky handle — we fetch their whole atproto repo (signed{' '}
            <code>com.atproto.sync.getRepo</code> car file), parse it with{' '}
            <code>@atcute/car</code>, and count everything posted / liked / followed in a given year.
            nothing leaves your browser. the url is shareable: <code>/labs/year-in-review/handle.bsky.social/2024</code>.
          </p>
        </header>

        <form className="yr-form" onSubmit={onSubmit}>
          <div className="yr-input-row">
            <input
              className="yr-input"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
              placeholder="handle.bsky.social or did:plc:…"
              spellCheck={false}
              autoComplete="off"
              disabled={running}
            />
            <select
              className="yr-year"
              value={yearInput}
              onChange={(e) => {
                const v = e.target.value;
                setYearInput(v);
                // once a result is loaded, just flip the url — the param-effect
                // reruns analyze against the cached car.
                if (urlHandle) {
                  navigate({
                    to: `/labs/year-in-review/${encodeURIComponent(urlHandle)}/${encodeURIComponent(v)}` as never,
                  });
                }
              }}
              disabled={running}
              title={activeYears.length > 0 ? 'years with activity for this account' : 'years'}
            >
              {(activeYears.length > 0
                ? [{ value: 'all', label: 'all time' }, ...activeYears.map((y) => ({ value: String(y), label: String(y) }))]
                : YEAR_OPTIONS.map(({ value, label }) => ({ value, label }))
              ).map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
            </select>
            <button
              className="yr-btn"
              type="submit"
              disabled={running || !handleInput.trim()}
            >
              {running ? 'running…' : 'generate'}
            </button>
          </div>
          {progress && !summary ? <ProgressBar p={progress} /> : null}
          {error ? <div className="yr-err">✗ {error}</div> : null}
          {shareUrl ? (
            <button
              type="button"
              className="yr-share"
              onClick={() => { try { navigator.clipboard.writeText(shareUrl); } catch { /* noop */ } }}
              title="copy shareable url"
            >
              ⎘ {shareUrl.replace(/^https?:\/\//, '')}
            </button>
          ) : null}
        </form>

        {summary ? (
          <Review
            s={summary}
            enrich={{
              followerCount: followerQuery.data ?? null,
              crossApp: crossAppQuery.data ?? null,
              postStats: postStatsQuery.data ?? new Map(),
            }}
          />
        ) : null}
      </main>
    </>
  );
}

function ProgressBar({ p }: { p: Progress }) {
  const label =
    p.phase === 'resolve' ? 'resolving handle + pds…' :
      p.phase === 'fetch' ? (p.total
        ? `downloading car · ${Math.round(p.received / 1024)} / ${Math.round(p.total / 1024)} kb`
        : `downloading car · ${Math.round(p.received / 1024)} kb`) :
        p.phase === 'parse' ? 'parsing + analyzing…' :
          'done';
  const pct = p.total > 0 ? Math.min(100, (p.received / p.total) * 100) : p.phase === 'done' ? 100 : null;
  return (
    <div className="yr-prog">
      <div className="yr-prog-lbl">{label}</div>
      <div className="yr-prog-bar">
        <div className={`yr-prog-fill ${pct === null ? 'indet' : ''}`} style={{ width: pct === null ? '100%' : `${pct}%` }} />
      </div>
    </div>
  );
}

function Review({ s, enrich }: { s: Summary; enrich: Enrichment }) {
  const { totals, byMonth, byDow, byHour, media, postLengths, year } = s;
  const isAllTime = year === null;
  const avg = postLengths.length ? Math.round(postLengths.reduce((a, b) => a + b, 0) / postLengths.length) : 0;
  const hasAnyActivity = totals.posts + totals.likes + totals.reposts + totals.follows > 0;

  if (!hasAnyActivity) {
    return (
      <div className="yr-empty">
        no activity from <code>{s.did.slice(0, 40)}</code> {isAllTime ? 'at all' : `in ${year}`}. try a different {isAllTime ? 'handle' : 'year'}.
      </div>
    );
  }

  return (
    <>
      <section className="yr-hero">
        <div className={`yr-hero-year ${isAllTime ? 'lifetime' : ''}`}>{isAllTime ? 'lifetime' : year}</div>
        <div className="yr-hero-sub">
          {isAllTime ? 'whole account' : 'in review'} ·{' '}
          <Link to={`/labs/did-log` as never} search={{ actor: s.did } as never} className="yr-hero-link">
            <code>{s.did}</code>
          </Link>
        </div>
        <div className="yr-hero-links">
          <Link to={`/labs/did-log` as never} search={{ actor: s.did } as never} className="yr-hero-pill">did log</Link>
          <Link to={`/labs/pds-health` as never} search={{ url: s.pds } as never} className="yr-hero-pill">
            pds · {new URL(s.pds).hostname}
          </Link>
          <a href={`https://bsky.app/profile/${s.did}`} target="_blank" rel="noopener noreferrer" className="yr-hero-pill ext">
            bsky.app ↗
          </a>
          <a href={`https://plc.directory/${s.did}`} target="_blank" rel="noopener noreferrer" className="yr-hero-pill ext">
            plc ↗
          </a>
        </div>
      </section>

      <section className="yr-big">
        <BigStat label="posts" value={totals.posts.toLocaleString()} accent />
        <BigStat label="likes given" value={totals.likes.toLocaleString()} />
        <BigStat label="reposts" value={totals.reposts.toLocaleString()} />
        <BigStat label="new follows" value={totals.follows.toLocaleString()} />
      </section>

      {enrich.followerCount != null || enrich.crossApp ? (
        <section className="yr-big secondary">
          {enrich.followerCount != null ? (
            <SmallStat k="followers" v={enrich.followerCount.toLocaleString()} sub="current · via constellation" />
          ) : null}
          {enrich.crossApp ? (
            <SmallStat
              k="atproto backlinks"
              v={enrich.crossApp.total.toLocaleString()}
              sub={enrich.crossApp.nonBsky.length > 0
                ? `${enrich.crossApp.nonBsky.length} non-bsky lexicon${enrich.crossApp.nonBsky.length === 1 ? '' : 's'}`
                : 'all within bsky'}
            />
          ) : null}
        </section>
      ) : null}

      <section className="yr-big secondary">
        <SmallStat k="replies" v={totals.posts ? `${Math.round((s.replyCount / totals.posts) * 100)}%` : '—'} sub={`${s.replyCount} of ${totals.posts}`} />
        <SmallStat k="avg post length" v={`${avg} graphemes`} sub={`${(s.totalGraphemes / 1000).toFixed(1)}k total`} />
        <SmallStat k="blocks" v={String(totals.blocks)} />
        <SmallStat k="lists + starters" v={String(totals.lists + totals.starter)} />
        {s.busiestDay ? (
          <SmallStat k="busiest day" v={s.busiestDay.date} sub={`${s.busiestDay.count} posts`} />
        ) : null}
        {isAllTime && s.mostActiveYear ? (
          <SmallStat k="most active year" v={String(s.mostActiveYear.year)} sub={`${s.mostActiveYear.count} posts`} />
        ) : null}
      </section>

      {isAllTime && s.byYear.length > 1 ? (
        <section className="yr-charts">
          <Chart title={`posts per year · ${s.byYear.length} years active`}>
            <BarChart
              values={s.byYear.map(([, n]) => n)}
              labels={s.byYear.map(([y]) => String(y))}
              height={140}
            />
          </Chart>
        </section>
      ) : null}

      <section className="yr-charts">
        <Chart title={isAllTime ? 'posts per month (any year)' : `posts per month · ${year}`}>
          <BarChart values={byMonth} labels={MONTH_NAMES} height={120} />
        </Chart>
        <Chart title="day of week">
          <BarChart values={byDow} labels={DOW_NAMES} height={100} />
        </Chart>
        <Chart title="hour of day (utc)">
          <BarChart values={byHour} labels={Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))} height={100} compact />
        </Chart>
      </section>

      {s.byCollection.length > 0 ? (
        <section className="yr-charts">
          <Chart title={
            isAllTime
              ? `lexicons used · ${s.byCollection.length} collections`
              : `lexicons used in ${year} · ${s.byCollection.length} collections`
          }>
            <LexiconBreakdown items={s.byCollection} />
          </Chart>
        </section>
      ) : null}

      <section className="yr-row-two">
        <Chart title="embeds">
          <div className="yr-embeds">
            <EmbedCell label="images" count={media.images} icon="▣" />
            <EmbedCell label="video" count={media.video} icon="▶" />
            <EmbedCell label="external" count={media.external} icon="↗" />
            <EmbedCell label="quotes" count={media.quote} icon="❝" />
            <EmbedCell label="record+media" count={media.record} icon="⊞" />
          </div>
        </Chart>
        <Chart title="languages">
          <div className="yr-langs">
            {s.langs.length === 0 ? <div className="yr-empty-inline">no langs tagged</div> : null}
            {s.langs.map(([lang, count]) => (
              <div key={lang} className="yr-lang">
                <span className="yr-lang-k">{lang}</span>
                <span className="yr-lang-bar">
                  <span
                    className="yr-lang-fill"
                    style={{ width: `${(count / s.langs[0][1]) * 100}%` }}
                  />
                </span>
                <span className="yr-lang-v">{count}</span>
              </div>
            ))}
          </div>
        </Chart>
      </section>

      {s.hashtags.length > 0 || s.mentions.length > 0 ? (
        <section className="yr-row-two">
          {s.hashtags.length > 0 ? (
            <Chart title={`top hashtags · ${s.hashtags.length}`}>
              <ul className="yr-toplist">
                {s.hashtags.map(([tag, count]) => (
                  <li key={tag}>
                    <a
                      href={`https://bsky.app/hashtag/${encodeURIComponent(tag)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="yr-hashtag"
                    >#{tag}</a>
                    <b>{count}</b>
                  </li>
                ))}
              </ul>
            </Chart>
          ) : null}
          {s.mentions.length > 0 ? (
            <Chart title={`top mentions · ${s.mentions.length}`}>
              <MentionList mentions={s.mentions} />
            </Chart>
          ) : null}
        </section>
      ) : null}

      {enrich.crossApp && enrich.crossApp.nonBsky.length > 0 ? (
        <section className="yr-charts">
          <Chart title={`cross-app references · ${enrich.crossApp.nonBsky.length} non-bsky lexicons`}>
            <LexiconBreakdown items={enrich.crossApp.nonBsky} />
            <p className="yr-cross-note">
              records in other atproto apps that reference this did (sample of the first 100 incoming backlinks).
            </p>
          </Chart>
        </section>
      ) : null}

      {s.longest ? (
        <PostBlock
          title={`longest post · ${s.longest.chars} graphemes`}
          post={s.longest}
          did={s.did}
          engagement={enrich.postStats.get(`at://${s.did}/app.bsky.feed.post/${s.longest.rkey}`)}
        />
      ) : null}

      {s.firstOfYearPost ? (
        <PostBlock
          title={isAllTime ? 'first post ever' : `first post of ${year}`}
          post={s.firstOfYearPost}
          did={s.did}
          engagement={enrich.postStats.get(`at://${s.did}/app.bsky.feed.post/${s.firstOfYearPost.rkey}`)}
        />
      ) : null}
    </>
  );
}

function PostBlock({ title, post, did, engagement }: { title: string; post: PostRef; did: string; engagement?: PostEngagement }) {
  const atUri = `at://${did}/app.bsky.feed.post/${post.rkey}`;
  return (
    <Chart title={title}>
      <p className="yr-post">{post.text}</p>
      {engagement ? (
        <div className="yr-post-engage">
          <span title="likes">♥ <b>{engagement.likes.toLocaleString()}</b></span>
          <span title="reposts">🔁 <b>{engagement.reposts.toLocaleString()}</b></span>
          <span title="replies">💬 <b>{engagement.replies.toLocaleString()}</b></span>
          {engagement.quotes > 0 ? <span title="quotes">❝ <b>{engagement.quotes.toLocaleString()}</b></span> : null}
        </div>
      ) : null}
      <div className="yr-post-meta">
        <span>{post.createdAt.slice(0, 10)}</span>
        <span className="yr-post-links">
          <Link to={`/labs/thread-tree` as never} search={{ uri: atUri } as never} className="yr-post-link">view thread →</Link>
          <a
            href={`https://bsky.app/profile/${did}/post/${post.rkey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="yr-post-link"
          >bsky.app ↗</a>
        </span>
      </div>
    </Chart>
  );
}

function lexiconAuthorityDomain(nsid: string): string | null {
  const parts = nsid.split('.');
  if (parts.length < 2) return null;
  return `${parts[1]}.${parts[0]}`;
}

function LexiconBreakdown({ items, muted }: { items: Array<[string, number]>; muted?: boolean }) {
  const max = items[0]?.[1] ?? 1;
  return (
    <ul className={`yr-coll-list ${muted ? 'muted' : ''}`}>
      {items.map(([nsid, count]) => {
        const domain = lexiconAuthorityDomain(nsid);
        return (
          <li key={nsid} className="yr-coll">
            <span className="yr-coll-icon">
              {domain ? (
                <img
                  src={`https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`}
                  alt=""
                  width={16}
                  height={16}
                  loading="lazy"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                  }}
                />
              ) : null}
            </span>
            <Link
              to={`/labs/lexicon/$nsid` as never}
              params={{ nsid } as never}
              className="yr-coll-name"
              title={`open ${nsid} in the lexicon browser`}
            >{nsid}</Link>
            <span className="yr-coll-bar">
              <span className="yr-coll-fill" style={{ width: `${(count / max) * 100}%` }} />
            </span>
            <span className="yr-coll-v">{count.toLocaleString()}</span>
          </li>
        );
      })}
    </ul>
  );
}

type BskyProfile = { did: string; handle: string; displayName?: string; avatar?: string };

function MentionList({ mentions }: { mentions: Array<[string, number]> }) {
  // getProfiles supports up to 25 actors per call; we have ≤ 8.
  const dids = mentions.map(([d]) => d);
  const { data: profiles } = useQuery({
    queryKey: ['yr-mentions', dids.join(',')],
    queryFn: async () => {
      const url = new URL('https://public.api.bsky.app/xrpc/app.bsky.actor.getProfiles');
      for (const d of dids) url.searchParams.append('actors', d);
      const res = await fetch(url);
      if (!res.ok) return [] as BskyProfile[];
      const j = (await res.json()) as { profiles?: BskyProfile[] };
      return j.profiles ?? [];
    },
    enabled: dids.length > 0,
    staleTime: 1000 * 60 * 10,
  });
  const byDid = new Map<string, BskyProfile>();
  for (const p of profiles ?? []) byDid.set(p.did, p);

  return (
    <ul className="yr-toplist">
      {mentions.map(([did, count]) => {
        const p = byDid.get(did);
        const handle = p?.handle;
        const display = p?.displayName || handle;
        return (
          <li key={did}>
            <a
              href={handle ? `https://bsky.app/profile/${handle}` : `https://bsky.app/profile/${did}`}
              target="_blank"
              rel="noopener noreferrer"
              className="yr-mention"
            >
              {p?.avatar ? <img className="yr-mention-av" src={p.avatar} alt="" /> : <span className="yr-mention-av fallback" />}
              <span className="yr-mention-txt">
                {display ? <b>{display}</b> : null}
                <span className="yr-mention-handle">{handle ? `@${handle}` : `${did.slice(0, 24)}…`}</span>
              </span>
            </a>
            <b>{count}</b>
          </li>
        );
      })}
    </ul>
  );
}

function BigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="yr-stat">
      <div className="yr-stat-k">{label}</div>
      <div className={`yr-stat-v ${accent ? 'accent' : ''}`}>{value}</div>
    </div>
  );
}

function SmallStat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="yr-s">
      <div className="yr-s-k">{k}</div>
      <div className="yr-s-v">{v}</div>
      {sub ? <div className="yr-s-sub">{sub}</div> : null}
    </div>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="yr-chart">
      <header className="yr-chart-hd">── {title}</header>
      <div className="yr-chart-body">{children}</div>
    </article>
  );
}

function BarChart({ values, labels, height, compact }: { values: number[]; labels: string[]; height: number; compact?: boolean }) {
  const max = Math.max(...values, 1);
  return (
    <div className={`yr-bars ${compact ? 'compact' : ''}`} style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="yr-bar-col" title={`${labels[i]} · ${v}`}>
          <div className="yr-bar-wrap">
            <div className="yr-bar" style={{ height: `${(v / max) * 100}%` }} />
            {v > 0 ? <span className="yr-bar-num">{v}</span> : null}
          </div>
          <span className="yr-bar-lbl">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function EmbedCell({ label, count, icon }: { label: string; count: number; icon: string }) {
  return (
    <div className="yr-e">
      <div className="yr-e-icon">{icon}</div>
      <div className="yr-e-v">{count}</div>
      <div className="yr-e-k">{label}</div>
    </div>
  );
}

const CSS = `
  .shell-yr { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .crumbs { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .yr-hd { padding: 48px 0 var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .yr-hd h1 { font-family: var(--font-display); font-size: clamp(48px, 8vw, 96px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .yr-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .yr-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 66ch; margin-top: var(--sp-3); }
  .yr-hd code { font-family: var(--font-mono); color: var(--color-accent); }

  .yr-form { padding: var(--sp-5) 0; }
  .yr-input-row {
    display: flex;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .yr-input {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    padding: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    min-width: 0;
  }
  .yr-year {
    background: var(--color-bg-raised);
    color: var(--color-accent);
    border: 0;
    border-left: 1px solid var(--color-border);
    padding: 0 var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    outline: 0;
    cursor: pointer;
  }
  .yr-btn {
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 0 var(--sp-5);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    text-transform: lowercase;
  }
  .yr-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .yr-prog { margin-top: var(--sp-3); }
  .yr-prog-lbl {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    margin-bottom: 6px;
  }
  .yr-prog-bar {
    height: 8px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .yr-prog-fill {
    height: 100%;
    background: var(--color-accent);
    box-shadow: 0 0 10px var(--accent-glow);
    transition: width 0.2s ease;
  }
  .yr-prog-fill.indet {
    background: linear-gradient(90deg,
      transparent 0%,
      var(--color-accent) 50%,
      transparent 100%);
    background-size: 40% 100%;
    animation: yr-indet 1.2s linear infinite;
  }
  @keyframes yr-indet {
    from { background-position: -40% 0; }
    to { background-position: 140% 0; }
  }

  .yr-err {
    margin-top: var(--sp-3);
    padding: var(--sp-3);
    color: var(--color-alert);
    border: 1px solid var(--color-alert-dim);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }

  .yr-empty {
    padding: var(--sp-6);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }

  .yr-hero {
    padding: var(--sp-5) 0;
    text-align: center;
    border-top: 1px solid var(--color-border);
  }
  .yr-hero-year {
    font-family: var(--font-display);
    font-size: clamp(80px, 14vw, 180px);
    font-weight: 500;
    color: var(--color-accent);
    line-height: 0.9;
    letter-spacing: -0.04em;
    text-shadow: 0 0 40px var(--accent-glow), 0 0 80px color-mix(in oklch, var(--color-accent) 30%, transparent);
  }
  .yr-hero-year.lifetime {
    font-size: clamp(56px, 10vw, 128px);
    letter-spacing: -0.03em;
  }
  .yr-hero-sub {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-faint);
    margin-top: var(--sp-2);
  }
  .yr-hero-sub code { color: var(--color-fg); word-break: break-all; }
  .yr-hero-link { text-decoration: none; }
  .yr-hero-link:hover code { color: var(--color-accent); }
  .yr-hero-links {
    display: flex; gap: 6px; flex-wrap: wrap;
    justify-content: center;
    margin-top: var(--sp-3);
  }
  .yr-hero-pill {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    background: transparent;
    border: 1px solid var(--color-border-bright);
    padding: 3px 10px;
    text-decoration: none;
    text-transform: lowercase;
  }
  .yr-hero-pill:hover { color: var(--color-accent); border-color: var(--color-accent-dim); text-decoration: none; }
  .yr-hero-pill.ext { color: var(--color-fg-faint); }

  .yr-share {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: var(--sp-3);
    padding: 4px 10px;
    background: var(--color-bg-panel);
    border: 1px dashed var(--color-border-bright);
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-transform: lowercase;
  }
  .yr-share:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .yr-big {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--sp-3);
    margin-bottom: var(--sp-4);
  }
  .yr-big.secondary {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }
  .yr-stat {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: 4px;
  }
  .yr-stat-k {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint); text-transform: lowercase;
  }
  .yr-stat-v {
    font-family: var(--font-display); font-size: clamp(32px, 4vw, 48px);
    font-weight: 500; color: var(--color-fg); line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .yr-stat-v.accent { color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow); }

  .yr-s {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-3);
    display: flex; flex-direction: column; gap: 2px;
    font-family: var(--font-mono);
  }
  .yr-s-k { font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: lowercase; }
  .yr-s-v { font-size: var(--fs-lg); color: var(--color-fg); }
  .yr-s-sub { font-size: 10px; color: var(--color-fg-faint); }

  .yr-charts { display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-3); }
  .yr-row-two { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); margin-bottom: var(--sp-3); }

  .yr-chart {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .yr-chart-hd {
    padding: 8px var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .yr-chart-body { padding: var(--sp-3); }

  .yr-bars {
    display: flex;
    gap: 4px;
    align-items: stretch;
  }
  .yr-bars.compact { gap: 2px; }
  .yr-bar-col { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .yr-bar-wrap {
    flex: 1;
    position: relative;
    display: flex;
    align-items: flex-end;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 2px;
  }
  .yr-bar {
    width: 100%;
    background: linear-gradient(to top, var(--color-accent-dim), var(--color-accent));
    box-shadow: 0 0 6px color-mix(in oklch, var(--color-accent) 40%, transparent);
    transition: height 0.4s cubic-bezier(0.2, 0.7, 0.2, 1);
    min-height: 0;
  }
  .yr-bar-num {
    position: absolute;
    top: 2px;
    left: 50%;
    transform: translateX(-50%);
    padding: 0 4px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.7);
    font-family: var(--font-mono);
    font-size: 10px;
    color: #fff;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    line-height: 1.2;
  }
  .yr-bars.compact .yr-bar-num { font-size: 9px; padding: 0 3px; top: 1px; }
  .yr-bar-lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-align: center;
    text-transform: lowercase;
  }
  .yr-bars.compact .yr-bar-lbl { font-size: 9px; }

  .yr-embeds {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: var(--sp-2);
  }
  .yr-e {
    text-align: center;
    padding: var(--sp-3);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
  }
  .yr-e-icon {
    font-size: 20px;
    color: var(--color-accent);
    margin-bottom: 2px;
  }
  .yr-e-v {
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    font-weight: 500;
    color: var(--color-fg);
    line-height: 1;
  }
  .yr-e-k {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: lowercase;
    margin-top: 4px;
  }

  .yr-langs { display: flex; flex-direction: column; gap: 6px; }
  .yr-lang {
    display: grid;
    grid-template-columns: 40px 1fr 40px;
    gap: var(--sp-2);
    align-items: center;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .yr-lang-k { color: var(--color-accent); text-transform: uppercase; }
  .yr-lang-bar {
    display: block;
    height: 10px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .yr-lang-fill {
    display: block;
    height: 100%;
    background: var(--color-accent);
    box-shadow: 0 0 8px var(--accent-glow);
  }
  .yr-lang-v { color: var(--color-fg-dim); text-align: right; }

  .yr-toplist { list-style: none; display: flex; flex-direction: column; gap: 2px; }
  .yr-toplist li {
    display: flex; justify-content: space-between; gap: var(--sp-2);
    padding: 4px var(--sp-2);
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .yr-toplist li:hover { background: var(--color-bg-raised); }
  .yr-toplist b { color: var(--color-accent); font-weight: 400; font-variant-numeric: tabular-nums; }
  .yr-mention {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--color-fg-dim);
    text-decoration: none;
    word-break: break-all;
    min-width: 0;
    flex: 1;
  }
  .yr-mention:hover { color: var(--color-accent); text-decoration: none; }
  .yr-mention-av {
    width: 22px; height: 22px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--color-bg-raised);
  }
  .yr-mention-av.fallback {
    background: linear-gradient(135deg, var(--color-border-bright), var(--color-bg-raised));
  }
  .yr-mention-txt {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow: hidden;
  }
  .yr-mention-txt b {
    color: var(--color-fg);
    font-weight: 500;
    font-size: var(--fs-sm);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .yr-mention-handle {
    color: var(--color-fg-faint);
    font-size: 11px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .yr-mention:hover .yr-mention-handle { color: var(--color-accent-dim); }
  .yr-hashtag {
    color: var(--color-accent);
    text-decoration: none;
  }
  .yr-hashtag:hover { text-decoration: underline; text-underline-offset: 2px; }
  .yr-empty-inline { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-sm); padding: var(--sp-2); }

  .yr-coll-list {
    list-style: none;
    display: flex; flex-direction: column; gap: 2px;
  }
  .yr-coll-list.muted { opacity: 0.75; }
  .yr-coll {
    display: grid;
    grid-template-columns: 16px minmax(220px, 1fr) minmax(120px, 2fr) 70px;
    gap: var(--sp-3);
    align-items: center;
    padding: 4px var(--sp-2);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .yr-coll:hover { background: var(--color-bg-raised); }
  .yr-coll-icon {
    width: 16px; height: 16px;
    display: inline-flex; align-items: center; justify-content: center;
    opacity: 0.85;
  }
  .yr-coll-icon img { display: block; width: 16px; height: 16px; image-rendering: -webkit-optimize-contrast; }
  .yr-coll-name {
    color: var(--color-fg);
    text-decoration: none;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .yr-coll-name:hover { color: var(--color-accent); }
  .yr-coll-bar {
    display: block;
    height: 8px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .yr-coll-fill {
    display: block;
    height: 100%;
    background: var(--color-accent);
    box-shadow: 0 0 6px color-mix(in oklch, var(--color-accent) 40%, transparent);
  }
  .yr-coll-v { color: var(--color-accent); text-align: right; font-variant-numeric: tabular-nums; }

  .yr-post {
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    color: var(--color-fg);
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    padding: var(--sp-3);
    background: var(--color-bg);
    border-left: 2px solid var(--color-accent-dim);
  }
  .yr-post-meta {
    margin-top: var(--sp-2);
    display: flex;
    justify-content: space-between;
    gap: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    flex-wrap: wrap;
  }
  .yr-post-links { display: flex; gap: var(--sp-3); }
  .yr-post-link {
    color: var(--color-fg-dim);
    text-decoration: none;
    border-bottom: 1px dashed var(--color-border-bright);
  }
  .yr-post-link:hover { color: var(--color-accent); border-color: var(--color-accent-dim); text-decoration: none; }

  .yr-post-engage {
    display: flex;
    gap: var(--sp-4);
    padding: var(--sp-2) var(--sp-3);
    margin-top: var(--sp-2);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
  }
  .yr-post-engage b { color: var(--color-accent); font-weight: 400; font-variant-numeric: tabular-nums; }

  .yr-cross-note {
    margin-top: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    line-height: 1.5;
    max-width: 70ch;
  }

  @media (max-width: 800px) {
    .yr-row-two { grid-template-columns: 1fr; }
  }
`;

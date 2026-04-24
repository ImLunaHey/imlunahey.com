import { simpleFetchHandler, XRPC } from '@atcute/client';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

// Public AppView handler — no auth needed for getPosts / getProfiles.
const pubRpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

// ─── type detection ───────────────────────────────────────────────────────

type SubjectKind = 'post' | 'did' | 'url' | 'at-record' | 'unknown';

function detectSubject(raw: string): { kind: SubjectKind; normalised: string } {
  const s = raw.trim();
  if (!s) return { kind: 'unknown', normalised: '' };
  if (s.startsWith('did:')) return { kind: 'did', normalised: s };
  if (s.startsWith('at://')) {
    // split out the collection to decide whether this is a post or a
    // generic record — post at-uris are much more interesting for the
    // likes/reposts/replies presets.
    const parts = s.slice(5).split('/');
    const collection = parts[1] ?? '';
    if (collection === 'app.bsky.feed.post') return { kind: 'post', normalised: s };
    return { kind: 'at-record', normalised: s };
  }
  if (/^https?:\/\//.test(s)) return { kind: 'url', normalised: s };
  return { kind: 'unknown', normalised: s };
}

// ─── preset queries ───────────────────────────────────────────────────────

type Preset = {
  id: string;
  label: string;
  glyph: string;
  description: string;
  /**
   * constellation source(s). multiple when a single "logical" reference
   * (like "this post links to this url") can be stored at different json
   * paths on-record — for bluesky posts, that's:
   *   - facets.features.uri: a link inside the post text body
   *   - embed.external.uri: an auto-generated link-card embed
   * we query every listed source in parallel + dedupe so neither shape
   * of reference is missed.
   */
  sources: string[];
  /** which subject shapes this preset applies to */
  appliesTo: SubjectKind[];
  /** for result hydration / rendering */
  resultKind: 'post-author' | 'post-content' | 'profile-subject';
};

const PRESETS: Preset[] = [
  // post subject: how did others interact with this post?
  {
    id: 'likes',
    label: 'likes',
    glyph: '♡',
    description: 'who liked this post',
    sources: ['app.bsky.feed.like:subject.uri'],
    appliesTo: ['post'],
    resultKind: 'post-author',
  },
  {
    id: 'reposts',
    label: 'reposts',
    glyph: '↻',
    description: 'who reposted this',
    sources: ['app.bsky.feed.repost:subject.uri'],
    appliesTo: ['post'],
    resultKind: 'post-author',
  },
  {
    id: 'quotes',
    label: 'quotes',
    glyph: '❝',
    description: 'posts that quoted this one',
    sources: ['app.bsky.feed.post:embed.record.uri'],
    appliesTo: ['post'],
    resultKind: 'post-content',
  },
  {
    id: 'replies',
    label: 'replies',
    glyph: '↳',
    description: 'posts replying to this one',
    sources: ['app.bsky.feed.post:reply.parent.uri'],
    appliesTo: ['post'],
    resultKind: 'post-content',
  },
  // did subject: graph + mentions
  {
    id: 'followers',
    label: 'followers',
    glyph: '+',
    description: 'people following this account',
    sources: ['app.bsky.graph.follow:subject'],
    appliesTo: ['did'],
    resultKind: 'profile-subject',
  },
  {
    id: 'mentions',
    label: 'mentions',
    glyph: '@',
    description: 'posts mentioning this account',
    sources: ['app.bsky.feed.post:facets.features.did'],
    appliesTo: ['did'],
    resultKind: 'post-content',
  },
  {
    id: 'blocks',
    label: 'blocks',
    glyph: '⊘',
    description: 'accounts blocking this one',
    sources: ['app.bsky.graph.block:subject'],
    appliesTo: ['did'],
    resultKind: 'profile-subject',
  },
  // url subject: who linked to it — two shapes, see Preset.sources docs.
  {
    id: 'linked-from-posts',
    label: 'posts linking',
    glyph: '🔗',
    description: 'bluesky posts with a link or link-card pointing at this url',
    sources: [
      'app.bsky.feed.post:facets.features.uri',
      'app.bsky.feed.post:embed.external.uri',
    ],
    appliesTo: ['url'],
    resultKind: 'post-content',
  },
  // at-record subject: generic fallback for non-post at-uris
  {
    id: 'linked-from-any-post',
    label: 'posts referencing',
    glyph: '→',
    description: 'any post with a link, mention, or embed pointing at this record',
    sources: [
      'app.bsky.feed.post:facets.features.uri',
      'app.bsky.feed.post:embed.external.uri',
      'app.bsky.feed.post:embed.record.uri',
    ],
    appliesTo: ['at-record'],
    resultKind: 'post-content',
  },
];

// ─── constellation fetch ──────────────────────────────────────────────────

type Backlink = { did: string; collection: string; rkey: string };

async function fetchOne(subject: string, source: string): Promise<{ records: Backlink[]; total: number }> {
  const url = new URL('https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks');
  url.searchParams.set('subject', subject);
  url.searchParams.set('source', source);
  url.searchParams.set('limit', '100');
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`constellation ${r.status}`);
  const j = (await r.json()) as { records?: Backlink[]; total?: number };
  return { records: j.records ?? [], total: j.total ?? (j.records?.length ?? 0) };
}

/**
 * Query every source path in parallel, merge, and dedupe by
 * (did, collection, rkey). Totals sum across sources *before* dedupe —
 * so the "total" we surface matches what constellation knows about,
 * even if the rendered list is smaller due to cross-path duplicates.
 * (A record could show up in both `facets.features.uri` and
 * `embed.external.uri` if someone both typed the url AND had a
 * link-card auto-generated — rare but possible.)
 */
async function fetchBacklinks(subject: string, sources: string[]): Promise<{ records: Backlink[]; total: number }> {
  const results = await Promise.all(sources.map((s) => fetchOne(subject, s)));
  const totalSum = results.reduce((n, r) => n + r.total, 0);
  const seen = new Set<string>();
  const records: Backlink[] = [];
  for (const { records: rs } of results) {
    for (const b of rs) {
      const key = `${b.did}/${b.collection}/${b.rkey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      records.push(b);
    }
  }
  return { records, total: totalSum };
}

// ─── hydration (appview) ──────────────────────────────────────────────────

type ProfileView = { did: string; handle: string; displayName?: string; avatar?: string };
type PostView = {
  uri: string;
  cid: string;
  author: ProfileView;
  record: { text?: string; createdAt?: string };
  indexedAt?: string;
};

async function fetchProfiles(dids: string[]): Promise<Map<string, ProfileView>> {
  const out = new Map<string, ProfileView>();
  for (let i = 0; i < dids.length; i += 25) {
    const batch = dids.slice(i, i + 25);
    try {
      const r = await pubRpc.get('app.bsky.actor.getProfiles', { params: { actors: batch } });
      for (const p of (r.data as unknown as { profiles: ProfileView[] }).profiles) out.set(p.did, p);
    } catch { /* tolerate partial hydration failures */ }
  }
  return out;
}

async function fetchPosts(uris: string[]): Promise<Map<string, PostView>> {
  const out = new Map<string, PostView>();
  for (let i = 0; i < uris.length; i += 25) {
    const batch = uris.slice(i, i + 25);
    try {
      const r = await pubRpc.get('app.bsky.feed.getPosts', { params: { uris: batch } });
      for (const p of (r.data as unknown as { posts: PostView[] }).posts) out.set(p.uri, p);
    } catch { /* tolerate partial hydration failures */ }
  }
  return out;
}

function bskyPostUrl(uri: string, authorDid: string): string {
  const rkey = uri.split('/').pop() ?? '';
  return `https://bsky.app/profile/${authorDid}/post/${rkey}`;
}

function bskyProfileUrl(did: string): string {
  return `https://bsky.app/profile/${did}`;
}

// ─── page ─────────────────────────────────────────────────────────────────

const EXAMPLES: Array<{ label: string; q: string; p: string }> = [
  { label: '@bsky.app — followers', q: 'did:plc:z72i7hdynmk6r22z27h6tvur', p: 'followers' },
  {
    label: 'a popular bsky post — likes',
    q: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.post/3l6oveex3ii2l',
    p: 'likes',
  },
  { label: 'en.wikipedia.org — posts linking', q: 'https://en.wikipedia.org/wiki/Bluesky_(social_network)', p: 'linked-from-posts' },
];

export default function BacklinksPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string; p?: string };
  const [input, setInput] = useState(search.q ?? '');
  useEffect(() => { setInput(search.q ?? ''); }, [search.q]);

  const submitted = search.q ?? '';
  const detection = useMemo(() => detectSubject(submitted), [submitted]);
  const applicablePresets = useMemo(
    () => PRESETS.filter((p) => p.appliesTo.includes(detection.kind)),
    [detection.kind],
  );
  const activePreset = useMemo(
    () => applicablePresets.find((p) => p.id === search.p) ?? applicablePresets[0] ?? null,
    [applicablePresets, search.p],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    navigate({ to: '/labs/backlinks' as never, search: { q, p: undefined } as never });
  };

  const pickExample = (ex: (typeof EXAMPLES)[number]) => {
    setInput(ex.q);
    navigate({ to: '/labs/backlinks' as never, search: { q: ex.q, p: ex.p } as never });
  };

  const pickPreset = (id: string) => {
    navigate({ to: '/labs/backlinks' as never, search: { q: submitted, p: id } as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-bl">
        <header className="page-hd">
          <div className="label">~/labs/backlinks</div>
          <h1>backlinks<span className="dot">.</span></h1>
          <p className="sub">
            paste any at-uri, did, or url — see every record on atproto that references it. likes,
            reposts, quotes, replies, follows, mentions, posts linking to a url. queries{' '}
            <a href="https://constellation.microcosm.blue/" target="_blank" rel="noopener noreferrer" className="t-accent">
              constellation.microcosm.blue
            </a>
            , hydrates bluesky records via the public appview.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="at://did:plc:… | did:plc:… | https://example.com"
            aria-label="subject to query backlinks for"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">look →</button>
        </form>

        {!submitted ? (
          <section className="examples">
            <div className="examples-lbl">try an example:</div>
            <div className="examples-row">
              {EXAMPLES.map((ex) => (
                <button key={ex.q} type="button" className="example" onClick={() => pickExample(ex)}>
                  {ex.label}
                </button>
              ))}
            </div>
          </section>
        ) : detection.kind === 'unknown' ? (
          <div className="err">
            doesn&apos;t look like an at-uri, did, or http url. try something like{' '}
            <code>at://did:plc:.../app.bsky.feed.post/...</code> or <code>did:plc:…</code>.
          </div>
        ) : (
          <>
            <section className="detected">
              <div className="det-row">
                <span className="det-kind">{detection.kind}</span>
                <code className="det-subject">{detection.normalised}</code>
              </div>
              <div className="preset-row" role="tablist" aria-label="preset queries">
                {applicablePresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={activePreset?.id === p.id}
                    className={`preset ${activePreset?.id === p.id ? 'on' : ''}`}
                    onClick={() => pickPreset(p.id)}
                    title={p.description}
                  >
                    <span className="preset-glyph" aria-hidden="true">{p.glyph}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {activePreset ? (
              <Results subject={detection.normalised} preset={activePreset} />
            ) : null}
          </>
        )}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">constellation.microcosm.blue · public.api.bsky.app</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

// ─── results ──────────────────────────────────────────────────────────────

type HydratedRow =
  | { kind: 'post'; post: PostView; backlink: Backlink }
  | { kind: 'profile'; profile: ProfileView; backlink: Backlink }
  | { kind: 'raw'; backlink: Backlink };

function Results({ subject, preset }: { subject: string; preset: Preset }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [rows, setRows] = useState<HydratedRow[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setRows([]);
    setTotal(0);
    setErr('');
    (async () => {
      try {
        const { records, total } = await fetchBacklinks(subject, preset.sources);
        if (cancelled) return;
        setTotal(total);

        // hydration strategy depends on preset's resultKind:
        //  - post-author: each backlink record (like/repost) has an author
        //    DID — fetch the author profile and render a profile row.
        //  - post-content: each backlink is itself a post we want to render
        //    the content of — fetch posts.
        //  - profile-subject: each backlink is a graph record (follow,
        //    block) whose AUTHOR is the interesting party — fetch author
        //    profiles.
        let hydrated: HydratedRow[] = [];
        if (preset.resultKind === 'post-author' || preset.resultKind === 'profile-subject') {
          const dids = [...new Set(records.map((r) => r.did))];
          const profiles = await fetchProfiles(dids);
          if (cancelled) return;
          hydrated = records.map((b) => {
            const p = profiles.get(b.did);
            return p ? { kind: 'profile', profile: p, backlink: b } : { kind: 'raw', backlink: b };
          });
        } else if (preset.resultKind === 'post-content') {
          // only attempt post hydration for actual bsky posts — other
          // collections (custom "post-shaped" records) fall through to raw.
          const postUris = records
            .filter((r) => r.collection === 'app.bsky.feed.post')
            .map((r) => `at://${r.did}/${r.collection}/${r.rkey}`);
          const posts = await fetchPosts(postUris);
          if (cancelled) return;
          hydrated = records.map((b) => {
            const uri = `at://${b.did}/${b.collection}/${b.rkey}`;
            const p = posts.get(uri);
            return p ? { kind: 'post', post: p, backlink: b } : { kind: 'raw', backlink: b };
          });
        }
        setRows(hydrated);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [subject, preset.sources, preset.resultKind]);

  return (
    <section className="results">
      <div className="results-hd">
        <span>
          <b className="t-accent">{preset.label}</b> · {preset.description}
        </span>
        {state === 'ready' ? (
          <span className="t-faint">
            {total.toLocaleString()} total{total > rows.length ? ` · first ${rows.length}` : ''}
          </span>
        ) : null}
      </div>
      {state === 'loading' ? (
        <div className="loading">querying constellation + hydrating…</div>
      ) : state === 'error' ? (
        <div className="err">constellation error: {err}</div>
      ) : rows.length === 0 ? (
        <div className="empty">
          no references found. constellation backfill covers ~the last 22 days — older references
          may not be indexed yet.
        </div>
      ) : (
        <ul className="rows" aria-label={preset.label}>
          {rows.map((row, i) => (
            <Row key={`${row.backlink.did}/${row.backlink.rkey}/${i}`} row={row} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ row }: { row: HydratedRow }) {
  if (row.kind === 'post') {
    const text = row.post.record.text ?? '';
    const snippet = text.length > 260 ? text.slice(0, 257) + '…' : text;
    return (
      <li className="row">
        <a className="row-link" href={bskyPostUrl(row.post.uri, row.post.author.did)} target="_blank" rel="noopener noreferrer">
          {row.post.author.avatar ? (
            <img src={row.post.author.avatar} alt="" className="row-avatar" />
          ) : (
            <div className="row-avatar empty" />
          )}
          <div className="row-body">
            <div className="row-who">
              <b>{row.post.author.displayName || row.post.author.handle}</b>
              <span className="row-handle">@{row.post.author.handle}</span>
              {row.post.indexedAt ? <span className="row-when">· {row.post.indexedAt.slice(0, 10)}</span> : null}
            </div>
            {snippet ? <div className="row-text">{snippet}</div> : null}
          </div>
        </a>
      </li>
    );
  }
  if (row.kind === 'profile') {
    return (
      <li className="row">
        <a className="row-link" href={bskyProfileUrl(row.profile.did)} target="_blank" rel="noopener noreferrer">
          {row.profile.avatar ? (
            <img src={row.profile.avatar} alt="" className="row-avatar" />
          ) : (
            <div className="row-avatar empty" />
          )}
          <div className="row-body">
            <div className="row-who">
              <b>{row.profile.displayName || row.profile.handle}</b>
              <span className="row-handle">@{row.profile.handle}</span>
            </div>
          </div>
        </a>
      </li>
    );
  }
  // fallback: render the at-uri + a jump to the inspector lab.
  const uri = `at://${row.backlink.did}/${row.backlink.collection}/${row.backlink.rkey}`;
  return (
    <li className="row">
      <Link
        to={`/labs/at-uri/${uri.replace('at://', '')}` as never}
        className="row-link row-link-raw"
      >
        <div className="row-body">
          <div className="row-who">
            <b>{row.backlink.collection}</b>
            <span className="row-handle">{row.backlink.did}</span>
          </div>
          <div className="row-text mono-break">{uri}</div>
        </div>
      </Link>
    </li>
  );
}

const CSS = `
  .shell-bl { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); line-height: 1.55; }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input {
    flex: 1;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    font-family: var(--font-mono); font-size: var(--fs-md);
    padding: 10px var(--sp-3); outline: 0;
  }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button {
    background: var(--color-accent); color: var(--color-bg);
    border: 0; padding: 0 var(--sp-4);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    cursor: pointer; font-weight: 500;
  }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .err, .loading, .empty {
    margin-top: var(--sp-4); padding: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    line-height: 1.55;
  }
  .err { border: 1px solid var(--color-alert); color: var(--color-alert); }
  .loading { border: 1px solid var(--color-border); background: var(--color-bg-panel); color: var(--color-fg-dim); }
  .empty { border: 1px dashed var(--color-border); color: var(--color-fg-faint); text-align: center; }
  .err code { background: var(--color-bg-raised); padding: 1px 4px; border: 1px solid var(--color-border); }

  .examples {
    margin-top: var(--sp-5);
    padding: var(--sp-4);
    border: 1px dashed var(--color-border);
    background: var(--color-bg-panel);
  }
  .examples-lbl { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .examples-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .example {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 6px 12px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    cursor: pointer;
    text-transform: lowercase; letter-spacing: 0.04em;
  }
  .example:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  .detected {
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .det-row {
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    display: flex; align-items: center; gap: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    flex-wrap: wrap;
  }
  .det-kind {
    padding: 2px 8px;
    background: color-mix(in oklch, var(--color-accent) 10%, transparent);
    color: var(--color-accent);
    border: 1px solid var(--color-accent-dim);
    text-transform: uppercase; letter-spacing: 0.1em;
    font-size: 10px;
  }
  .det-subject {
    color: var(--color-fg-dim);
    word-break: break-all;
    flex: 1; min-width: 0;
  }

  .preset-row {
    display: flex; gap: 0;
    flex-wrap: wrap;
  }
  .preset {
    background: transparent; border: 0;
    border-right: 1px solid var(--color-border);
    padding: 10px var(--sp-4);
    color: var(--color-fg-faint);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 8px;
    text-transform: lowercase; letter-spacing: 0.04em;
    flex: 1 0 auto;
  }
  .preset:last-child { border-right: 0; }
  .preset:hover { color: var(--color-fg); background: color-mix(in oklch, var(--color-accent) 4%, transparent); }
  .preset.on {
    color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 10%, transparent);
  }
  .preset-glyph { font-size: 14px; color: var(--color-accent-dim); }
  .preset.on .preset-glyph { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }

  .results {
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .results-hd {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: var(--sp-3); flex-wrap: wrap;
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim);
  }
  .results-hd b { font-weight: 400; }
  .results-hd .t-accent { color: var(--color-accent); }
  .results-hd .t-faint { color: var(--color-fg-faint); }
  .results .loading, .results .err, .results .empty { margin: 0; border: 0; border-top: 1px dashed var(--color-border); background: transparent; padding: var(--sp-4); }

  .rows { list-style: none; }
  .row { border-bottom: 1px dashed var(--color-border); }
  .row:last-child { border-bottom: 0; }

  .row-link {
    display: grid;
    grid-template-columns: 40px 1fr;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    text-decoration: none;
    color: inherit;
    transition: background 0.1s ease-out;
  }
  /* explicit no-underline override — the site's global a:hover rule would
     otherwise underline the whole post body, which reads as one giant
     link block. */
  .row-link:hover { text-decoration: none; background: color-mix(in oklch, var(--color-accent) 5%, transparent); }
  .row-link:hover .row-who b { color: var(--color-accent); }
  .row-link:focus-visible { outline: 1px solid var(--color-accent); outline-offset: -1px; }
  .row-link-raw { grid-template-columns: 1fr; }

  .row-avatar {
    width: 40px; height: 40px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    object-fit: cover;
  }
  .row-avatar.empty {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .row-body { min-width: 0; }
  .row-who {
    display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .row-who b { color: var(--color-fg); font-weight: 400; }
  .row-handle { color: var(--color-fg-faint); }
  .row-when { color: var(--color-fg-faint); }
  .row-text {
    color: var(--color-fg-dim);
    font-size: var(--fs-xs);
    line-height: 1.55;
    margin-top: 4px;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }
  .row-text.mono-break { word-break: break-all; }

  .labs-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    flex-wrap: wrap; gap: var(--sp-3);
  }
`;

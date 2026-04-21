import { simpleFetchHandler, XRPC } from '@atcute/client';
import { AppBskyActorDefs, AppBskyFeedPost, AppBskyGraphList } from '@atcute/client/lexicons';
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  DohJsonHandleResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import { getPdsEndpoint } from '@atcute/identity';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { CodeBlock } from '../../components/CodeBlock';

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

type ParsedUri = {
  input: string;
  repo: string; // did or handle
  collection: string | null;
  rkey: string | null;
};

/** Accepts `at://…`, bare `did:plc:…/…/…`, bare `<handle>/<collection>/<rkey>`, or just `<handle>` / `<did>`. */
function parseUri(raw: string): ParsedUri | null {
  const trimmed = raw.trim().replace(/^at:\/\//, '').replace(/^@/, '');
  if (!trimmed) return null;
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  return {
    input: raw.trim(),
    repo: parts[0],
    collection: parts[1] ?? null,
    rkey: parts[2] ?? null,
  };
}

async function resolveDid(repo: string): Promise<string> {
  if (repo.startsWith('did:')) return repo;
  return await handleResolver.resolve(repo as `${string}.${string}`);
}

async function resolvePds(did: string): Promise<string> {
  if (!did.startsWith('did:plc:') && !did.startsWith('did:web:')) {
    throw new Error(`unsupported did method: ${did}`);
  }
  const doc = await docResolver.resolve(did as `did:plc:${string}` | `did:web:${string}`);
  if (!doc) throw new Error('could not resolve did document');
  const pds = getPdsEndpoint(doc);
  if (!pds) throw new Error('did document has no pds endpoint');
  return pds;
}

async function fetchProfile(handleOrDid: string): Promise<AppBskyActorDefs.ProfileViewDetailed> {
  const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });
  const { data } = await rpc.get('app.bsky.actor.getProfile', { params: { actor: handleOrDid } });
  return data;
}

async function fetchRecord(
  pds: string,
  did: string,
  collection: string,
  rkey: string,
): Promise<{ uri: string; cid: string; value: unknown }> {
  const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
  url.searchParams.set('repo', did);
  url.searchParams.set('collection', collection);
  url.searchParams.set('rkey', rkey);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${collection}/${rkey}: ${res.status}`);
  return (await res.json()) as { uri: string; cid: string; value: unknown };
}

function compactNumber(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}m`;
}

function fmtRel(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2_592_000) return `${Math.floor(diff / 86_400)}d ago`;
  return iso.slice(0, 10);
}

export default function AtUriPage() {
  const rawParams = useParams({ strict: false }) as { _splat?: string };
  const splat = rawParams._splat ?? '';
  const parsed = splat ? parseUri(splat) : null;
  const navigate = useNavigate();
  const [input, setInput] = useState(splat ? `at://${splat}` : '');

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const p = parseUri(input);
    if (!p) return;
    const path = p.rkey ? `${p.repo}/${p.collection}/${p.rkey}` : p.collection ? `${p.repo}/${p.collection}` : p.repo;
    navigate({ to: `/labs/at-uri/${path}` as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-au">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          {parsed ? (
            <>
              <Link to="/labs/at-uri">at-uri</Link>
              <span className="sep">/</span>
              <span className="last">{parsed.rkey ? 'record' : parsed.collection ? 'collection' : 'actor'}</span>
            </>
          ) : (
            <span className="last">at-uri</span>
          )}
        </div>

        <header className="au-hd">
          <h1>
            at-uri<span className="dot">.</span>
          </h1>
          <p className="sub">
            paste any <code className="inline">at://</code> uri (or a bare <code className="inline">handle</code>,{' '}
            <code className="inline">did</code>, or <code className="inline">handle/nsid/rkey</code>) to see what it
            points at — profile, post, list, blog entry, or any custom record — plus a grab-bag of deep links into the
            other labs.
          </p>
          <form onSubmit={onSubmit} className="au-form">
            <input
              className="inp"
              type="text"
              placeholder="at://imlunahey.com/app.bsky.feed.post/3kz…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="go" disabled={!parseUri(input)}>
              resolve →
            </button>
          </form>
        </header>

        {!parsed ? <Landing /> : <Resolver key={splat} parsed={parsed} />}

        <footer className="au-footer">
          <span>
            src: <span className="t-accent">@atcute resolvers · public.api · pds getRecord</span>
          </span>
          <span>
            ←{' '}
            <Link to="/labs" className="t-accent">
              all labs
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function Landing() {
  return (
    <section className="empty">
      <div className="empty-glyph">▯</div>
      <div className="empty-ttl">paste an at-uri to resolve it</div>
      <div className="empty-sub">
        try <span className="t-accent">at://imlunahey.com</span> (profile) or{' '}
        <span className="t-accent">at://imlunahey.com/com.whtwnd.blog.entry/3lh…</span> (record)
      </div>
    </section>
  );
}

function Resolver({ parsed }: { parsed: ParsedUri }) {
  const didQuery = useQuery({
    queryKey: ['at-uri', 'did', parsed.repo],
    queryFn: () => resolveDid(parsed.repo),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const did = didQuery.data ?? null;

  const pdsQuery = useQuery({
    queryKey: ['at-uri', 'pds', did],
    queryFn: () => resolvePds(did!),
    enabled: !!did,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const recordQuery = useQuery({
    queryKey: ['at-uri', 'record', pdsQuery.data, did, parsed.collection, parsed.rkey],
    queryFn: () => fetchRecord(pdsQuery.data!, did!, parsed.collection!, parsed.rkey!),
    enabled: !!pdsQuery.data && !!did && !!parsed.collection && !!parsed.rkey,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const profileQuery = useQuery({
    queryKey: ['at-uri', 'profile', parsed.repo],
    queryFn: () => fetchProfile(parsed.repo),
    enabled: !parsed.collection,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const error = didQuery.error ?? pdsQuery.error ?? recordQuery.error ?? profileQuery.error;
  const isFetching =
    didQuery.isFetching || pdsQuery.isFetching || recordQuery.isFetching || profileQuery.isFetching;

  return (
    <>
      {isFetching ? <LoadingPanel label="resolving…" /> : null}
      {error ? <ErrorPanel msg={error instanceof Error ? error.message : String(error)} /> : null}

      {!parsed.collection && profileQuery.data ? (
        <ProfileView profile={profileQuery.data} />
      ) : null}

      {parsed.collection && !parsed.rkey && did ? (
        <CollectionView did={did} handle={parsed.repo} collection={parsed.collection} />
      ) : null}

      {parsed.rkey && recordQuery.data ? (
        <RecordView
          did={did ?? parsed.repo}
          handle={parsed.repo}
          collection={parsed.collection!}
          rkey={parsed.rkey}
          record={recordQuery.data.value}
          cid={recordQuery.data.cid}
        />
      ) : null}

      {did || pdsQuery.data ? <MetaPanel did={did} pds={pdsQuery.data ?? null} parsed={parsed} /> : null}
    </>
  );
}

function MetaPanel({ did, pds, parsed }: { did: string | null; pds: string | null; parsed: ParsedUri }) {
  const links: { label: string; to?: string; href?: string }[] = [];
  if (parsed.repo) {
    links.push({ label: 'bluesky profile', href: `https://bsky.app/profile/${parsed.repo}` });
    links.push({ label: 'lab · feed', to: `/labs/feed/${parsed.repo}` });
    links.push({ label: 'lab · car-explorer', to: `/labs/car-explorer/${parsed.repo}` });
    if (did?.startsWith('did:plc:')) {
      links.push({ label: 'lab · plc log', to: `/labs/plc-log/${parsed.repo}` });
    }
  }
  if (parsed.collection && did) {
    links.push({ label: 'car-explorer · this collection', to: `/labs/car-explorer/${parsed.repo}/${parsed.collection}` });
  }
  if (parsed.collection === 'app.bsky.feed.post' && parsed.rkey) {
    links.push({ label: 'lab · thread view', to: `/labs/feed/${parsed.repo}/post/${parsed.rkey}` });
    links.push({ label: 'bsky.app · post', href: `https://bsky.app/profile/${parsed.repo}/post/${parsed.rkey}` });
  }
  if (parsed.collection === 'app.bsky.graph.list' && parsed.rkey && did) {
    links.push({ label: 'bsky.app · list', href: `https://bsky.app/profile/${did}/lists/${parsed.rkey}` });
  }
  if (pds && did && parsed.collection && parsed.rkey) {
    const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', parsed.collection);
    url.searchParams.set('rkey', parsed.rkey);
    links.push({ label: 'raw · pds getRecord', href: url.toString() });
  }

  return (
    <section className="meta">
      <div className="meta-hd">// identity</div>
      <dl className="meta-dl">
        <dt>input</dt>
        <dd>
          <code className="inline">{parsed.input.startsWith('at://') ? parsed.input : `at://${parsed.input}`}</code>
        </dd>
        <dt>repo</dt>
        <dd>{parsed.repo}</dd>
        {did ? (
          <>
            <dt>did</dt>
            <dd>{did}</dd>
          </>
        ) : null}
        {pds ? (
          <>
            <dt>pds</dt>
            <dd>{pds}</dd>
          </>
        ) : null}
        {parsed.collection ? (
          <>
            <dt>collection</dt>
            <dd>{parsed.collection}</dd>
          </>
        ) : null}
        {parsed.rkey ? (
          <>
            <dt>rkey</dt>
            <dd>{parsed.rkey}</dd>
          </>
        ) : null}
      </dl>
      {links.length > 0 ? (
        <>
          <div className="meta-hd" style={{ marginTop: 'var(--sp-4)' }}>
            // open elsewhere
          </div>
          <div className="meta-links">
            {links.map((l) =>
              l.to ? (
                <Link key={l.label} to={l.to as never} className="meta-link">
                  {l.label} →
                </Link>
              ) : (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="meta-link">
                  {l.label} ↗
                </a>
              ),
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}

function ProfileView({ profile }: { profile: AppBskyActorDefs.ProfileViewDetailed }) {
  return (
    <section className="profile">
      {profile.banner ? (
        <div className="profile-banner" style={{ backgroundImage: `url(${profile.banner})` }} />
      ) : (
        <div className="profile-banner empty-banner" />
      )}
      <div className="profile-body">
        {profile.avatar ? (
          <img src={profile.avatar} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar empty-avatar" />
        )}
        <div className="profile-meta">
          <div className="profile-name">
            {profile.displayName ?? profile.handle}
            <span className="dot">.</span>
          </div>
          <div className="profile-handle">@{profile.handle}</div>
          {profile.description ? <div className="profile-desc">{profile.description}</div> : null}
          <div className="profile-stats">
            <span>
              <b>{compactNumber(profile.postsCount ?? 0)}</b> posts
            </span>
            <span>
              <b>{compactNumber(profile.followersCount ?? 0)}</b> followers
            </span>
            <span>
              <b>{compactNumber(profile.followsCount ?? 0)}</b> following
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CollectionView({ did, handle, collection }: { did: string; handle: string; collection: string }) {
  return (
    <section className="coll">
      <div className="coll-kind">// collection</div>
      <div className="coll-name">{collection}</div>
      <div className="coll-sub">
        <span>
          repo <b>{did}</b>
        </span>
      </div>
      <div className="coll-cta">
        <Link to={`/labs/car-explorer/${handle}/${collection}` as never} className="cta">
          browse records via car-explorer →
        </Link>
      </div>
    </section>
  );
}

function RecordView({
  did,
  handle,
  collection,
  rkey,
  record,
  cid,
}: {
  did: string;
  handle: string;
  collection: string;
  rkey: string;
  record: unknown;
  cid: string;
}) {
  // typed rendering for the common lexicons
  if (collection === 'app.bsky.feed.post' && isPost(record)) {
    return <PostPreview did={did} handle={handle} rkey={rkey} record={record} cid={cid} raw={record} />;
  }
  if (collection === 'app.bsky.graph.list' && isList(record)) {
    return <ListPreview did={did} rkey={rkey} record={record} raw={record} />;
  }
  if (collection === 'app.bsky.actor.profile') {
    return <GenericRecord collection={collection} rkey={rkey} cid={cid} record={record} label="profile record" />;
  }
  if (collection === 'com.whtwnd.blog.entry' && isWhtwndEntry(record)) {
    return <WhtwndPreview rkey={rkey} record={record} raw={record} />;
  }
  return <GenericRecord collection={collection} rkey={rkey} cid={cid} record={record} label="record" />;
}

function isPost(x: unknown): x is AppBskyFeedPost.Record {
  return !!x && typeof x === 'object' && '$type' in x && (x as { $type: string }).$type === 'app.bsky.feed.post';
}
function isList(x: unknown): x is AppBskyGraphList.Record {
  return !!x && typeof x === 'object' && '$type' in x && (x as { $type: string }).$type === 'app.bsky.graph.list';
}
function isWhtwndEntry(x: unknown): x is { title?: string; content?: string; createdAt?: string } {
  return !!x && typeof x === 'object' && '$type' in x && (x as { $type: string }).$type === 'com.whtwnd.blog.entry';
}

function PostPreview({
  did,
  handle,
  rkey,
  record,
  cid,
  raw,
}: {
  did: string;
  handle: string;
  rkey: string;
  record: AppBskyFeedPost.Record;
  cid: string;
  raw: unknown;
}) {
  return (
    <>
      <section className="tt">
        <div className="tt-kind">// app.bsky.feed.post</div>
        <div className="tt-title">post</div>
        <p className="tt-text">{record.text}</p>
        <div className="tt-meta">
          <span suppressHydrationWarning>{fmtRel(record.createdAt)}</span>
          <span className="sep-dot">·</span>
          <span className="t-mono t-faint">{cid}</span>
        </div>
        <div className="tt-actions">
          <Link to={`/labs/feed/${handle}/post/${rkey}` as never} className="cta">
            open thread view →
          </Link>
          <a
            href={`https://bsky.app/profile/${did}/post/${rkey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cta ghost"
          >
            open on bsky.app ↗
          </a>
        </div>
      </section>
      <RawPane raw={raw} filename={`post.${rkey}.json`} />
    </>
  );
}

function ListPreview({
  did,
  rkey,
  record,
  raw,
}: {
  did: string;
  rkey: string;
  record: AppBskyGraphList.Record;
  raw: unknown;
}) {
  return (
    <>
      <section className="tt">
        <div className="tt-kind">// app.bsky.graph.list</div>
        <div className="tt-title">{record.name ?? '(unnamed list)'}</div>
        {record.description ? <p className="tt-text">{record.description}</p> : null}
        <div className="tt-meta">
          <span>
            purpose <b>{record.purpose}</b>
          </span>
        </div>
        <div className="tt-actions">
          <a
            href={`https://bsky.app/profile/${did}/lists/${rkey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="cta"
          >
            open on bsky.app ↗
          </a>
        </div>
      </section>
      <RawPane raw={raw} filename={`list.${rkey}.json`} />
    </>
  );
}

function WhtwndPreview({
  rkey,
  record,
  raw,
}: {
  rkey: string;
  record: { title?: string; content?: string; createdAt?: string };
  raw: unknown;
}) {
  return (
    <>
      <section className="tt">
        <div className="tt-kind">// com.whtwnd.blog.entry</div>
        <div className="tt-title">{record.title ?? '(untitled)'}</div>
        {record.createdAt ? (
          <div className="tt-meta">
            <span suppressHydrationWarning>{fmtRel(record.createdAt)}</span>
          </div>
        ) : null}
        {record.content ? <p className="tt-text tt-excerpt">{record.content.slice(0, 300)}…</p> : null}
        <div className="tt-actions">
          <Link to={`/blog/${rkey}` as never} className="cta">
            read on /blog →
          </Link>
        </div>
      </section>
      <RawPane raw={raw} filename={`entry.${rkey}.json`} />
    </>
  );
}

function GenericRecord({
  collection,
  rkey,
  cid,
  record,
  label,
}: {
  collection: string;
  rkey: string;
  cid: string;
  record: unknown;
  label: string;
}) {
  return (
    <>
      <section className="tt">
        <div className="tt-kind">// {collection}</div>
        <div className="tt-title">{label}</div>
        <div className="tt-meta">
          <span>
            rkey <b>{rkey}</b>
          </span>
          <span className="sep-dot">·</span>
          <span className="t-mono t-faint">{cid}</span>
        </div>
      </section>
      <RawPane raw={record} filename={`${collection}.${rkey}.json`} />
    </>
  );
}

function RawPane({ raw, filename }: { raw: unknown; filename: string }) {
  return (
    <section className="raw">
      <CodeBlock code={JSON.stringify(raw, null, 2)} filename={filename} language="json" />
    </section>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="prog">
      <div className="prog-line">
        <span>{label}</span>
      </div>
      <div className="prog-bar">
        <div className="prog-bar-indeterminate" />
      </div>
    </section>
  );
}

function ErrorPanel({ msg }: { msg: string }) {
  return (
    <section className="err">
      <div className="err-hd">// error</div>
      <div className="err-body">{msg}</div>
    </section>
  );
}

const CSS = `
  .shell-au { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding-top: var(--sp-6);
    margin-bottom: var(--sp-4);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; color: var(--color-border-bright); }
  .crumbs .last { color: var(--color-accent); }

  .au-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .au-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .au-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .au-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .au-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .au-form { display: flex; gap: 6px; margin-top: var(--sp-5); flex-wrap: wrap; }
  .inp {
    flex: 1; min-width: 220px;
    padding: 10px 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: var(--color-fg);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .inp:focus { outline: none; border-color: var(--color-accent-dim); }
  .inp::placeholder { color: var(--color-fg-ghost); }
  .go {
    padding: 10px 18px;
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel));
    color: var(--color-accent);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .go:hover:not(:disabled) { background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel)); }
  .go:disabled { opacity: 0.4; cursor: not-allowed; }

  /* typed preview panels */
  .tt {
    margin-top: var(--sp-6);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
  }
  .tt-kind {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: var(--sp-3);
  }
  .tt-title {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    line-height: 1.1;
    word-break: break-word;
  }
  .tt-text {
    color: var(--color-fg);
    font-size: var(--fs-md);
    line-height: 1.6;
    margin-top: var(--sp-3);
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  .tt-excerpt { color: var(--color-fg-dim); font-size: var(--fs-sm); }
  .tt-meta {
    display: flex; gap: var(--sp-3); flex-wrap: wrap; align-items: center;
    margin-top: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .tt-meta b { color: var(--color-fg); font-weight: 400; }
  .tt-meta .sep-dot { color: var(--color-border-bright); }
  .tt-meta .t-mono { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
  .tt-actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-4); }
  .cta {
    display: inline-flex; align-items: center;
    padding: 6px 14px;
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel));
    color: var(--color-accent);
    text-decoration: none;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .cta:hover { background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel)); text-decoration: none; }
  .cta.ghost {
    border-color: var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
  }
  .cta.ghost:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }

  /* collection preview */
  .coll {
    margin-top: var(--sp-6);
    padding: var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .coll-kind { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: var(--sp-2); }
  .coll-name { font-family: var(--font-display); font-size: 28px; color: var(--color-accent); letter-spacing: -0.02em; word-break: break-all; }
  .coll-sub { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: var(--sp-2); }
  .coll-sub b { color: var(--color-fg); font-weight: 400; word-break: break-all; }
  .coll-cta { margin-top: var(--sp-4); }

  .raw { margin-top: var(--sp-5); }

  /* profile card (same look as feed lab) */
  .profile {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    overflow: hidden;
  }
  .profile-banner {
    height: 120px;
    background-size: cover;
    background-position: center;
    background-color: var(--color-bg-raised);
    border-bottom: 1px solid var(--color-border);
  }
  .profile-banner.empty-banner {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .profile-body {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
    align-items: start;
  }
  .profile-avatar {
    width: 80px; height: 80px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-raised);
    margin-top: -52px;
    object-fit: cover;
  }
  .profile-avatar.empty-avatar {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .profile-meta { min-width: 0; }
  .profile-name {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    line-height: 1.05;
    overflow-wrap: break-word;
  }
  .profile-name .dot { color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow); }
  .profile-handle {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-top: 2px;
  }
  .profile-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.55;
    margin-top: var(--sp-3);
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  .profile-stats {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    align-items: center;
  }
  .profile-stats b { color: var(--color-accent); font-weight: 400; }

  /* meta panel */
  .meta {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
  }
  .meta-hd {
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: var(--sp-2);
  }
  .meta-dl { display: grid; grid-template-columns: auto 1fr; gap: 4px var(--sp-3); font-size: var(--fs-xs); }
  .meta-dl dt { color: var(--color-fg-faint); }
  .meta-dl dd { color: var(--color-fg); word-break: break-all; }
  .meta-dl dd .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 11px;
    color: var(--color-accent);
  }
  .meta-links { display: flex; gap: 6px; flex-wrap: wrap; }
  .meta-link {
    display: inline-block;
    padding: 4px 10px;
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    text-decoration: none;
    font-size: var(--fs-xs);
    text-transform: lowercase;
  }
  .meta-link:hover { color: var(--color-accent); border-color: var(--color-accent-dim); text-decoration: none; }

  /* progress + error + empty */
  .prog {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .prog-line { margin-bottom: var(--sp-2); }
  .prog-bar { height: 4px; background: var(--color-border); overflow: hidden; }
  .prog-bar-indeterminate {
    height: 100%; width: 30%;
    background: var(--color-accent);
    box-shadow: 0 0 6px var(--accent-glow);
    animation: prog-slide 1.2s ease-in-out infinite;
  }
  @keyframes prog-slide {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }

  .err {
    margin-top: var(--sp-6);
    border: 1px solid color-mix(in oklch, var(--color-alert) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-alert) 5%, var(--color-bg-panel));
    font-family: var(--font-mono);
  }
  .err-hd {
    padding: 6px 12px;
    border-bottom: 1px solid color-mix(in oklch, var(--color-alert) 30%, var(--color-border));
    font-size: 10px;
    color: var(--color-alert);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .err-body { padding: var(--sp-4) var(--sp-5); font-size: var(--fs-sm); color: var(--color-fg); line-height: 1.55; word-break: break-word; }

  .empty {
    margin-top: var(--sp-8);
    padding: var(--sp-10) var(--sp-6);
    border: 1px dashed var(--color-border-bright);
    text-align: center;
    font-family: var(--font-mono);
  }
  .empty-glyph { font-size: 40px; color: var(--color-accent-dim); margin-bottom: var(--sp-3); line-height: 1; }
  .empty-ttl { font-size: var(--fs-sm); color: var(--color-fg); margin-bottom: 4px; }
  .empty-sub { font-size: var(--fs-xs); color: var(--color-fg-faint); word-break: break-all; }

  .au-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;

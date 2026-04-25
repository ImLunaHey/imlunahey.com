import { simpleFetchHandler, XRPC } from '@atcute/client';
import { AppBskyActorDefs } from '@atcute/client/lexicons';
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

type GermDeclaration = {
  $type?: string;
  version: string;
  currentKey: { $bytes: string } | string;
  keyPackage?: { $bytes: string } | string;
  continuityProofs?: ({ $bytes: string } | string)[];
  messageMe?: {
    showButtonTo: 'none' | 'usersIFollow' | 'everyone' | string;
    messageMeUrl: string;
  };
};

function bytesString(v: { $bytes: string } | string | undefined): string {
  if (!v) return '';
  return typeof v === 'string' ? v : v.$bytes;
}

function bytesLength(v: { $bytes: string } | string | undefined): number {
  const s = bytesString(v);
  if (!s) return 0;
  // base64 → bytes
  const padding = (s.match(/=+$/) ?? [''])[0].length;
  return Math.floor((s.length * 3) / 4) - padding;
}

function bytesToHex(v: { $bytes: string } | string | undefined, max = 16): string {
  const s = bytesString(v);
  if (!s) return '';
  try {
    const bin = atob(s);
    const out: string[] = [];
    for (let i = 0; i < Math.min(bin.length, max); i++) {
      out.push(bin.charCodeAt(i).toString(16).padStart(2, '0'));
    }
    return out.join(' ') + (bin.length > max ? ' …' : '');
  } catch {
    return '(invalid base64)';
  }
}

function normaliseInput(raw: string): string | null {
  const trimmed = raw.trim().replace(/^at:\/\//, '').replace(/^@/, '');
  if (!trimmed) return null;
  return trimmed.split('/').filter(Boolean)[0] ?? null;
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

async function fetchProfile(handleOrDid: string): Promise<AppBskyActorDefs.ProfileViewDetailed | null> {
  try {
    const rpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });
    const { data } = await rpc.get('app.bsky.actor.getProfile', { params: { actor: handleOrDid } });
    return data;
  } catch {
    return null;
  }
}

async function fetchDeclaration(
  pds: string,
  did: string,
): Promise<{ found: true; record: GermDeclaration; cid: string; uri: string } | { found: false }> {
  const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
  url.searchParams.set('repo', did);
  url.searchParams.set('collection', 'com.germnetwork.declaration');
  url.searchParams.set('rkey', 'self');
  const res = await fetch(url);
  if (res.status === 404 || res.status === 400) return { found: false };
  if (!res.ok) throw new Error(`getRecord com.germnetwork.declaration: ${res.status}`);
  const json = (await res.json()) as { uri: string; cid: string; value: GermDeclaration };
  return { found: true, record: json.value, cid: json.cid, uri: json.uri };
}

export default function GermCardPage() {
  const rawParams = useParams({ strict: false }) as { _splat?: string };
  const splat = rawParams._splat ?? '';
  const handle = splat ? normaliseInput(splat) : null;
  const navigate = useNavigate();
  const [input, setInput] = useState(handle ?? '');

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const target = normaliseInput(input);
    if (!target) return;
    navigate({ to: `/labs/germ-card/${target}` as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-gc">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">germ card</span>
        </div>

        <header className="gc-hd">
          <h1>
            germ card<span className="dot">.</span>
          </h1>
          <p className="sub">
            paste any bluesky handle or <code className="inline">did</code> to fetch its{' '}
            <code className="inline">com.germnetwork.declaration</code> record. shows whether the account is reachable
            on <a href="https://www.germnetwork.com" target="_blank" rel="noopener noreferrer">germ</a> end-to-end
            encrypted dms, who's allowed to message them, and the keys their app advertises for the mls handshake.
          </p>
          <form onSubmit={onSubmit} className="gc-form">
            <input
              className="inp"
              type="text"
              placeholder="imlunahey.com"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="go" disabled={!normaliseInput(input)}>
              fetch →
            </button>
          </form>
        </header>

        {!handle ? <Landing /> : <Resolver key={handle} handle={handle} />}

        <footer className="gc-footer">
          <span>
            src:{' '}
            <a
              href="https://github.com/germ-network/lexicon"
              target="_blank"
              rel="noopener noreferrer"
              className="t-accent"
            >
              germ-network/lexicon
            </a>{' '}
            · pds <span className="t-accent">com.atproto.repo.getRecord</span>
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
      <div className="empty-ttl">paste a handle to look up its germ card</div>
      <div className="empty-sub">
        try <span className="t-accent">imlunahey.com</span>, or any bluesky handle / did:plc you suspect uses germ.
      </div>
    </section>
  );
}

function Resolver({ handle }: { handle: string }) {
  const didQuery = useQuery({
    queryKey: ['germ-card', 'did', handle],
    queryFn: () => resolveDid(handle),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const did = didQuery.data ?? null;

  const pdsQuery = useQuery({
    queryKey: ['germ-card', 'pds', did],
    queryFn: () => resolvePds(did!),
    enabled: !!did,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const declQuery = useQuery({
    queryKey: ['germ-card', 'decl', pdsQuery.data, did],
    queryFn: () => fetchDeclaration(pdsQuery.data!, did!),
    enabled: !!pdsQuery.data && !!did,
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const profileQuery = useQuery({
    queryKey: ['germ-card', 'profile', handle],
    queryFn: () => fetchProfile(handle),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const error = didQuery.error ?? pdsQuery.error ?? declQuery.error;
  const isFetching = didQuery.isFetching || pdsQuery.isFetching || declQuery.isFetching;

  return (
    <>
      {profileQuery.data ? <ProfileCard profile={profileQuery.data} /> : null}
      {isFetching ? <LoadingPanel label="fetching com.germnetwork.declaration…" /> : null}
      {error ? <ErrorPanel msg={error instanceof Error ? error.message : String(error)} /> : null}

      {declQuery.data?.found === false ? <NotOnGerm handle={handle} /> : null}
      {declQuery.data?.found === true ? (
        <DeclarationView decl={declQuery.data.record} cid={declQuery.data.cid} uri={declQuery.data.uri} did={did!} />
      ) : null}

      {did || pdsQuery.data ? (
        <MetaPanel did={did} pds={pdsQuery.data ?? null} handle={handle} found={declQuery.data?.found ?? null} />
      ) : null}
    </>
  );
}

function ProfileCard({ profile }: { profile: AppBskyActorDefs.ProfileViewDetailed }) {
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
        </div>
      </div>
    </section>
  );
}

function NotOnGerm({ handle }: { handle: string }) {
  return (
    <section className="not-found">
      <div className="nf-kind">// no com.germnetwork.declaration record</div>
      <div className="nf-title">not on germ yet</div>
      <p className="nf-text">
        <code className="inline">{handle}</code> hasn't published a{' '}
        <code className="inline">com.germnetwork.declaration</code> record at{' '}
        <code className="inline">/self</code> on their pds. either they've never linked their bluesky handle to germ, or
        they've torn the record back down.
      </p>
      <div className="nf-cta">
        <a href="https://www.germnetwork.com" target="_blank" rel="noopener noreferrer" className="cta">
          what is germ? ↗
        </a>
      </div>
    </section>
  );
}

function DeclarationView({
  decl,
  cid,
  uri,
  did,
}: {
  decl: GermDeclaration;
  cid: string;
  uri: string;
  did: string;
}) {
  const showButtonTo = decl.messageMe?.showButtonTo ?? 'none';
  const policyLabel: Record<string, string> = {
    none: "no one (germ button hidden from everyone)",
    usersIFollow: 'people they follow back',
    everyone: 'anyone with the app',
  };
  const messageMeUrl = decl.messageMe?.messageMeUrl;
  const sampleFragment = `${did}:did:plc:VIEWER…`;

  return (
    <section className="decl">
      <div className="decl-hd">
        <span className="decl-kind">// com.germnetwork.declaration</span>
        <span className="decl-pill">germ-ready</span>
      </div>

      <div className="decl-policy">
        <div className="policy-row">
          <span className="policy-label">message-me policy</span>
          <code className="policy-val">{showButtonTo}</code>
        </div>
        <p className="policy-help">
          {policyLabel[showButtonTo] ?? 'unrecognised policy value'}
        </p>
      </div>

      <dl className="decl-dl">
        <dt>declaration version</dt>
        <dd>
          <code className="inline">{decl.version}</code>
        </dd>

        <dt>current key</dt>
        <dd>
          <code className="inline mono-block">{bytesToHex(decl.currentKey, 16)}</code>{' '}
          <span className="t-faint">({bytesLength(decl.currentKey)} bytes, ed25519 + tag)</span>
        </dd>

        {decl.keyPackage ? (
          <>
            <dt>key package</dt>
            <dd>
              <span className="t-faint">{bytesLength(decl.keyPackage)} bytes</span>{' '}
              <span className="t-faint">— mls keypackage(s), signed by current key</span>
            </dd>
          </>
        ) : null}

        {decl.continuityProofs && decl.continuityProofs.length > 0 ? (
          <>
            <dt>continuity proofs</dt>
            <dd>
              <span className="t-faint">
                {decl.continuityProofs.length} proof{decl.continuityProofs.length === 1 ? '' : 's'} — historic key roll
                chain
              </span>
            </dd>
          </>
        ) : null}

        {messageMeUrl ? (
          <>
            <dt>message-me url</dt>
            <dd>
              <a href={messageMeUrl} target="_blank" rel="noopener noreferrer" className="msg-link">
                {messageMeUrl}
              </a>
              <div className="msg-help">
                germ apps append a fragment{' '}
                <code className="inline">#{sampleFragment}</code> to launch a chat between two dids.
              </div>
            </dd>
          </>
        ) : null}

        <dt>record uri</dt>
        <dd>
          <code className="inline mono-block">{uri}</code>
        </dd>
        <dt>cid</dt>
        <dd>
          <code className="inline mono-block">{cid}</code>
        </dd>
      </dl>

      <CodeBlock code={JSON.stringify(decl, null, 2)} filename="declaration.self.json" language="json" />
    </section>
  );
}

function MetaPanel({
  did,
  pds,
  handle,
  found,
}: {
  did: string | null;
  pds: string | null;
  handle: string;
  found: boolean | null;
}) {
  const links: { label: string; to?: string; href?: string }[] = [];
  links.push({ label: 'bluesky profile', href: `https://bsky.app/profile/${handle}` });
  links.push({ label: 'lab · at-uri', to: `/labs/at-uri/${handle}` });
  if (did) {
    links.push({ label: 'lab · car-explorer', to: `/labs/car-explorer/${handle}` });
    if (did.startsWith('did:plc:')) {
      links.push({ label: 'lab · plc log', to: `/labs/plc-log/${handle}` });
    }
  }
  if (found && pds && did) {
    const url = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', 'com.germnetwork.declaration');
    url.searchParams.set('rkey', 'self');
    links.push({ label: 'raw · pds getRecord', href: url.toString() });
  }
  links.push({ label: 'lexicon · com.germnetwork.declaration', to: `/labs/lexicon/com.germnetwork.declaration` });

  return (
    <section className="meta">
      <div className="meta-hd">// identity</div>
      <dl className="meta-dl">
        <dt>handle</dt>
        <dd>{handle}</dd>
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
      </dl>
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
  .shell-gc { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .gc-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .gc-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .gc-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .gc-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .gc-hd .sub a { color: var(--color-accent); text-decoration: none; border-bottom: 1px dashed var(--color-accent-dim); }
  .gc-hd .sub a:hover { border-bottom-style: solid; }
  .gc-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .gc-form { display: flex; gap: 6px; margin-top: var(--sp-5); flex-wrap: wrap; }
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

  /* declaration card */
  .decl {
    margin-top: var(--sp-6);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
  }
  .decl-hd {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: var(--sp-4);
  }
  .decl-kind {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.14em;
  }
  .decl-pill {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    padding: 3px 10px;
    border: 1px solid var(--color-accent-dim);
    color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
  }

  .decl-policy {
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    margin-bottom: var(--sp-4);
  }
  .policy-row { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-3); }
  .policy-label {
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--color-fg-faint);
  }
  .policy-val {
    font-family: var(--font-mono);
    color: var(--color-accent);
    font-size: var(--fs-sm);
  }
  .policy-help {
    margin-top: 6px;
    color: var(--color-fg-dim);
    font-size: var(--fs-xs);
    font-family: var(--font-mono);
  }

  .decl-dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sp-3) var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    margin-bottom: var(--sp-5);
  }
  .decl-dl dt { color: var(--color-fg-faint); align-self: start; }
  .decl-dl dd { color: var(--color-fg); word-break: break-all; min-width: 0; }
  .decl-dl dd .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 11px;
    color: var(--color-accent);
  }
  .decl-dl dd .inline.mono-block {
    display: inline-block;
    word-break: break-all;
    line-height: 1.55;
  }
  .decl-dl dd .t-faint { color: var(--color-fg-faint); }
  .msg-link { color: var(--color-accent); text-decoration: none; word-break: break-all; }
  .msg-link:hover { text-decoration: underline; }
  .msg-help { color: var(--color-fg-faint); margin-top: 4px; font-size: 11px; }
  .msg-help .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 10px;
    color: var(--color-fg-dim);
  }

  /* not-on-germ panel */
  .not-found {
    margin-top: var(--sp-6);
    padding: var(--sp-5);
    border: 1px dashed var(--color-border-bright);
    background: var(--color-bg-panel);
  }
  .nf-kind {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    margin-bottom: var(--sp-3);
  }
  .nf-title {
    font-family: var(--font-display);
    font-size: 28px;
    color: var(--color-fg);
    letter-spacing: -0.02em;
  }
  .nf-text {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.6;
    margin-top: var(--sp-3);
  }
  .nf-text .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 11px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }
  .nf-cta { margin-top: var(--sp-4); }
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

  /* profile card (parity with at-uri) */
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

  .gc-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .gc-footer a { color: var(--color-accent); text-decoration: none; }
  .gc-footer a:hover { text-decoration: underline; }
`;

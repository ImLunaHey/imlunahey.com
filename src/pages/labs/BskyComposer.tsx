import { XRPC } from '@atcute/client';
import type { ActorIdentifier } from '@atcute/lexicons';
import { createAuthorizationUrl, deleteStoredSession, OAuthUserAgent } from '@atcute/oauth-browser-client';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAtprotoSession } from '../../hooks/use-atproto-session';
import { BSKY_POST_SCOPE, BSKY_POST_WRITE_SCOPE, ensureOAuthConfigured, sessionHasScope } from '../../lib/oauth';
import { fetchImageBytes } from '../../server/fetch-image';
import { getOgMeta, type OgMeta } from '../../server/og-preview';

const BSKY_MAX_GRAPHEMES = 300;
const DEFAULT_HANDLE = 'imlunahey.com';

type Profile = {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  description?: string;
};

async function fetchProfile(actor: string): Promise<Profile | null> {
  if (!actor) return null;
  const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as Profile;
  } catch {
    return null;
  }
}

function countGraphemes(s: string): number {
  if (!s) return 0;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    try {
      const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
      let n = 0;
      for (const _ of seg.segment(s)) n++;
      return n;
    } catch { /* fall through */ }
  }
  return Array.from(s).length;
}

const URL_RE = /https?:\/\/[^\s<>"')\]}]+/g;
const MENTION_RE = /(?:^|(?<=[\s(]))@([a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9])/g;
const HASHTAG_RE = /(?:^|(?<=[\s(]))#([a-zA-Z0-9_]+)/g;

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'url'; value: string }
  | { kind: 'mention'; value: string }
  | { kind: 'hashtag'; value: string };

type Span = {
  kind: 'url' | 'mention' | 'hashtag';
  value: string;
  start: number;
  end: number;
};

function tokenize(text: string): Token[] {
  const spans: Span[] = [];
  for (const m of text.matchAll(URL_RE)) {
    spans.push({ kind: 'url', value: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  for (const m of text.matchAll(MENTION_RE)) {
    const at = m.index! + m[0].indexOf('@');
    spans.push({ kind: 'mention', value: m[0].slice(m[0].indexOf('@')), start: at, end: at + m[1].length + 1 });
  }
  for (const m of text.matchAll(HASHTAG_RE)) {
    const hash = m.index! + m[0].indexOf('#');
    spans.push({ kind: 'hashtag', value: m[0].slice(m[0].indexOf('#')), start: hash, end: hash + m[1].length + 1 });
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const tokens: Token[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    if (span.start > cursor) {
      tokens.push({ kind: 'text', value: text.slice(cursor, span.start) });
    }
    tokens.push({ kind: span.kind, value: span.value });
    cursor = span.end;
  }
  if (cursor < text.length) tokens.push({ kind: 'text', value: text.slice(cursor) });
  return tokens;
}

function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(URL_RE)) out.push(m[0]);
  return out;
}

function prettyDomain(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; }
}

function truncate(s: string | undefined, n: number): string | undefined {
  if (!s) return s;
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + '…';
}

type PostState =
  | { kind: 'idle' }
  | { kind: 'posting' }
  | { kind: 'success'; uri: string; handle: string }
  | { kind: 'error'; message: string };

function postUrlFromAtUri(uri: string, handle: string): string {
  const rkey = uri.split('/').pop();
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

function buildFacets(
  text: string,
  mentionDids: Map<string, string>,
): Array<Record<string, unknown>> {
  const enc = new TextEncoder();
  const toByteOffset = (charIdx: number) => enc.encode(text.slice(0, charIdx)).length;
  const facets: Array<Record<string, unknown>> = [];

  for (const m of text.matchAll(URL_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    facets.push({
      index: { byteStart: toByteOffset(start), byteEnd: toByteOffset(end) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    });
  }

  for (const m of text.matchAll(HASHTAG_RE)) {
    const hash = m.index! + m[0].indexOf('#');
    const end = hash + m[1].length + 1;
    facets.push({
      index: { byteStart: toByteOffset(hash), byteEnd: toByteOffset(end) },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[1] }],
    });
  }

  for (const m of text.matchAll(MENTION_RE)) {
    const handle = m[1];
    const did = mentionDids.get(handle);
    if (!did) continue;
    const at = m.index! + m[0].indexOf('@');
    const end = at + handle.length + 1;
    facets.push({
      index: { byteStart: toByteOffset(at), byteEnd: toByteOffset(end) },
      features: [{ $type: 'app.bsky.richtext.facet#mention', did }],
    });
  }

  return facets;
}

async function resolveMentionDids(text: string): Promise<Map<string, string>> {
  const handles = new Set<string>();
  for (const m of text.matchAll(MENTION_RE)) handles.add(m[1]);
  const out = new Map<string, string>();
  await Promise.all(
    Array.from(handles).map(async (h) => {
      try {
        const res = await fetch(
          `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(h)}`,
        );
        if (res.ok) {
          const j = (await res.json()) as { did: string };
          if (j.did) out.set(h, j.did);
        }
      } catch { /* noop */ }
    }),
  );
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default function BskyComposerPage() {
  const [text, setText] = useState("just pushed a new lab — a bluesky post composer with live OG preview. try pasting any url below 👇 https://imlunahey.com");
  const [actor, setActor] = useState(DEFAULT_HANDLE);
  const [cardEnabled, setCardEnabled] = useState(true);
  const [activeUrlIdx, setActiveUrlIdx] = useState(0);
  const [signInHandle, setSignInHandle] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [postState, setPostState] = useState<PostState>({ kind: 'idle' });
  const taRef = useRef<HTMLTextAreaElement>(null);

  const { session, loading: sessionLoading, refresh: refreshSession } = useAtprotoSession();
  const canPost = sessionHasScope(session, BSKY_POST_WRITE_SCOPE);
  const signedIn = session !== null && canPost;

  // When signed in, the composer previews AS the signed-in user.
  // When signed out, it previews as whatever handle was typed into the override.
  const previewActor = signedIn && session ? session.info.sub : actor;

  const { data: profile } = useQuery({
    queryKey: ['bsky-profile', previewActor],
    queryFn: () => fetchProfile(previewActor),
    enabled: !!previewActor,
    staleTime: 1000 * 60 * 10,
  });

  const graphemes = useMemo(() => countGraphemes(text), [text]);
  const remaining = BSKY_MAX_GRAPHEMES - graphemes;
  const pct = Math.min(1, graphemes / BSKY_MAX_GRAPHEMES);
  const urls = useMemo(() => extractUrls(text), [text]);
  const tokens = useMemo(() => tokenize(text), [text]);
  const activeUrl = cardEnabled ? urls[activeUrlIdx] ?? urls[0] : undefined;

  useEffect(() => {
    if (activeUrlIdx >= urls.length && urls.length > 0) setActiveUrlIdx(0);
  }, [urls.length, activeUrlIdx]);

  const { data: og, isFetching: ogFetching } = useQuery({
    queryKey: ['bsky-compose-og', activeUrl],
    queryFn: () => getOgMeta({ data: { url: activeUrl! } }),
    enabled: !!activeUrl,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const autogrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 500) + 'px';
  };
  useEffect(autogrow, [text]);

  const copy = () => {
    try { navigator.clipboard.writeText(text); } catch { /* noop */ }
  };

  async function startSignIn(handle: string) {
    setSignInError(null);
    setSigningIn(true);
    try {
      ensureOAuthConfigured();
      const url = await createAuthorizationUrl({
        target: { type: 'account', identifier: handle.trim() as ActorIdentifier },
        scope: BSKY_POST_SCOPE,
        state: { returnTo: window.location.pathname },
      });
      window.location.assign(url.toString());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSignInError(msg);
      setSigningIn(false);
    }
  }

  async function signOut() {
    if (!session) return;
    try {
      const agent = new OAuthUserAgent(session);
      await agent.signOut();
    } catch {
      try { deleteStoredSession(session.info.sub); } catch { /* ignore */ }
    }
    await refreshSession();
  }

  async function publishPost() {
    if (!session || !signedIn || postState.kind === 'posting') return;
    if (remaining < 0) return;
    const body = text.trim();
    if (!body) return;

    setPostState({ kind: 'posting' });
    try {
      const agent = new OAuthUserAgent(session);
      const xrpc = new XRPC({ handler: agent });

      // facets (URLs + hashtags + resolved mentions)
      const mentionDids = await resolveMentionDids(body);
      const facets = buildFacets(body, mentionDids);

      // external embed from OG (upload thumb if we have an image)
      let embed: Record<string, unknown> | undefined;
      if (cardEnabled && activeUrl && og) {
        type BlobRef = { $type: 'blob'; ref: { $link: string }; mimeType: string; size: number };
        let thumb: BlobRef | undefined;
        const imageUrl = og.image ?? og.twitterImage;
        if (imageUrl) {
          try {
            const fetched = await fetchImageBytes({ data: { url: imageUrl } });
            const bytes = base64ToBytes(fetched.base64);
            const upload = await xrpc.call('com.atproto.repo.uploadBlob', {
              data: bytes,
              headers: { 'content-type': fetched.mimeType },
            });
            const u = upload.data as { blob?: BlobRef };
            if (u.blob) thumb = u.blob;
          } catch { /* embed without thumb if upload fails */ }
        }
        embed = {
          $type: 'app.bsky.embed.external',
          external: {
            uri: og.finalUrl,
            title: og.title || og.twitterTitle || og.finalUrl,
            description: og.description || og.twitterDescription || '',
            ...(thumb ? { thumb } : {}),
          },
        };
      }

      const record: Record<string, unknown> = {
        $type: 'app.bsky.feed.post',
        text: body,
        createdAt: new Date().toISOString(),
      };
      if (facets.length > 0) record.facets = facets;
      if (embed) record.embed = embed;

      const res = await xrpc.call('com.atproto.repo.createRecord', {
        data: {
          repo: session.info.sub,
          collection: 'app.bsky.feed.post',
          record,
        },
      });
      const uri = (res.data as { uri: string }).uri;
      const handle = profile?.handle ?? session.info.sub;
      setPostState({ kind: 'success', uri, handle });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPostState({ kind: 'error', message: msg });
    }
  }

  const displayName = profile?.displayName || profile?.handle || previewActor;
  const handleDisplay = profile?.handle || previewActor;
  const avatar = profile?.avatar;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cmp">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">bsky composer</span>
        </div>

        <header className="cmp-hd">
          <h1>bsky composer<span className="dot">.</span></h1>
          <p className="sub">
            a bluesky post composer with a live link-card preview. type anything, paste a url, see
            how it would render. grapheme-accurate character count (bluesky limit: 300).
          </p>
        </header>

        <div className="cmp-grid">
          <section className="cmp-col">
            <div className="cmp-label">── compose</div>
            <div className="cmp-card">
              <div className="cmp-row">
                <Avatar src={avatar} alt={handleDisplay} />
                <div className="cmp-text-wrap">
                  <textarea
                    ref={taRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="what's up?"
                    spellCheck
                    className="cmp-textarea"
                    rows={4}
                  />
                </div>
              </div>

              <div className="cmp-footer">
                <div className="cmp-footer-l">
                  {urls.length > 1 && cardEnabled ? (
                    <div className="cmp-url-switch">
                      <span className="cmp-url-lbl">card url</span>
                      {urls.map((u, i) => (
                        <button
                          key={`${i}-${u}`}
                          className={`cmp-url-pick ${i === activeUrlIdx ? 'on' : ''}`}
                          onClick={() => setActiveUrlIdx(i)}
                          title={u}
                        >{prettyDomain(u)}</button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="cmp-footer-r">
                  <CharRing pct={pct} remaining={remaining} />
                  <span className={`cmp-count ${remaining < 0 ? 'over' : remaining < 20 ? 'warn' : ''}`}>
                    {remaining}
                  </span>
                  <button className="cmp-btn" onClick={copy} title="copy post text">copy</button>
                  <button
                    className="cmp-btn primary"
                    onClick={publishPost}
                    disabled={!signedIn || remaining < 0 || !text.trim() || postState.kind === 'posting'}
                    title={signedIn ? 'post to bluesky' : 'sign in to post'}
                  >
                    {postState.kind === 'posting' ? 'posting…' : 'post'}
                  </button>
                </div>
              </div>
            </div>

            {postState.kind === 'success' ? (
              <div className="cmp-banner ok">
                <span>✓ posted</span>
                <a href={postUrlFromAtUri(postState.uri, postState.handle)} target="_blank" rel="noopener noreferrer">
                  view on bluesky ↗
                </a>
                <button className="cmp-banner-btn" onClick={() => { setPostState({ kind: 'idle' }); setText(''); }}>
                  new post
                </button>
              </div>
            ) : null}
            {postState.kind === 'error' ? (
              <div className="cmp-banner err">
                <span>✗ {postState.message}</span>
                <button className="cmp-banner-btn" onClick={() => setPostState({ kind: 'idle' })}>dismiss</button>
              </div>
            ) : null}

            <div className="cmp-label" style={{ marginTop: 24 }}>── account</div>
            {sessionLoading ? (
              <div className="cmp-ident"><span className="cmp-ident-hint">checking session…</span></div>
            ) : signedIn && session ? (
              <div className="cmp-ident">
                <label className="cmp-ident-lbl">signed in</label>
                <span className="cmp-ident-input" style={{ padding: 0 }}>@{profile?.handle ?? session.info.sub}</span>
                <button className="cmp-btn" onClick={signOut}>sign out</button>
              </div>
            ) : (
              <form
                className="cmp-ident signin"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (signInHandle.trim()) void startSignIn(signInHandle);
                }}
              >
                <label className="cmp-ident-lbl">sign in</label>
                <input
                  className="cmp-ident-input"
                  type="text"
                  placeholder="your.handle.bsky.social"
                  value={signInHandle}
                  onChange={(e) => setSignInHandle(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                />
                <button className="cmp-btn primary" type="submit" disabled={!signInHandle.trim() || signingIn}>
                  {signingIn ? 'redirecting…' : 'sign in'}
                </button>
              </form>
            )}
            {signInError ? <div className="cmp-banner err" style={{ marginTop: 8 }}><span>✗ {signInError}</span></div> : null}

            {!signedIn ? (
              <>
                <div className="cmp-label" style={{ marginTop: 16 }}>── preview as</div>
                <div className="cmp-ident">
                  <label className="cmp-ident-lbl">handle</label>
                  <input
                    className="cmp-ident-input"
                    value={actor}
                    onChange={(e) => setActor(e.target.value.trim())}
                    placeholder="handle.bsky.social"
                    spellCheck={false}
                  />
                  <span className="cmp-ident-hint">
                    {profile === null ? '✗ not found' : profile ? '✓ loaded' : '…'}
                  </span>
                </div>
                <p className="cmp-note">sign in to post for real — otherwise this is a preview-only playground.</p>
              </>
            ) : null}
          </section>

          <section className="cmp-col">
            <div className="cmp-label">── preview</div>

            <BskyPost
              displayName={displayName}
              handle={handleDisplay}
              avatar={avatar}
              tokens={tokens}
              og={cardEnabled ? og : undefined}
              loading={ogFetching && !!activeUrl}
              showCardSlot={!!activeUrl && cardEnabled}
              onRemoveCard={() => setCardEnabled(false)}
              onRestoreCard={() => setCardEnabled(true)}
              cardDisabled={!cardEnabled && urls.length > 0}
            />

            {og?.raw ? (
              <details className="cmp-raw">
                <summary>raw og meta</summary>
                <pre>{JSON.stringify(
                  {
                    title: og.title,
                    description: og.description,
                    image: og.image,
                    siteName: og.siteName,
                    finalUrl: og.finalUrl,
                  },
                  null,
                  2,
                )}</pre>
              </details>
            ) : null}
          </section>
        </div>
      </main>
    </>
  );
}

function Avatar({ src, alt }: { src?: string; alt: string }) {
  return (
    <div className="bsky-avatar" aria-label={alt}>
      {src ? <img src={src} alt="" /> : <div className="bsky-avatar-fallback">{alt.slice(0, 1).toUpperCase()}</div>}
    </div>
  );
}

function CharRing({ pct, remaining }: { pct: number; remaining: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const over = remaining < 0;
  const warn = remaining >= 0 && remaining < 20;
  const stroke = over ? '#ec4899' : warn ? '#f59e0b' : '#208bfe';
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" className="cmp-ring">
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--color-border-bright)" strokeWidth="2" />
      <circle
        cx="11" cy="11" r={r} fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(pct, 1))}
        strokeLinecap="round"
        transform="rotate(-90 11 11)"
        style={{ transition: 'stroke-dashoffset 0.12s, stroke 0.12s' }}
      />
    </svg>
  );
}

function BskyPost({
  displayName, handle, avatar, tokens, og, loading, showCardSlot, onRemoveCard, onRestoreCard, cardDisabled,
}: {
  displayName: string;
  handle: string;
  avatar?: string;
  tokens: Token[];
  og?: OgMeta;
  loading: boolean;
  showCardSlot: boolean;
  onRemoveCard: () => void;
  onRestoreCard: () => void;
  cardDisabled: boolean;
}) {
  return (
    <article className="bsky">
      <header className="bsky-hd">
        <Avatar src={avatar} alt={handle} />
        <div className="bsky-hd-text">
          <div className="bsky-name-row">
            <span className="bsky-display">{displayName}</span>
            <span className="bsky-handle">@{handle}</span>
            <span className="bsky-dot">·</span>
            <span className="bsky-time">now</span>
          </div>
          <div className="bsky-body">
            {tokens.length === 0 ? <span className="bsky-placeholder">start typing…</span> : renderTokens(tokens)}
          </div>
          {showCardSlot ? (
            loading && !og ? (
              <div className="bsky-card bsky-card-skel">
                <div className="bsky-card-skel-thumb" />
                <div className="bsky-card-body">
                  <div className="skel" style={{ width: '40%', height: 10, marginBottom: 6 }} />
                  <div className="skel" style={{ width: '80%', height: 14, marginBottom: 6 }} />
                  <div className="skel" style={{ width: '100%', height: 10 }} />
                </div>
              </div>
            ) : og ? (
              <div className="bsky-card-wrap">
                <BskyLinkCard og={og} />
                <button className="bsky-card-close" onClick={onRemoveCard} aria-label="remove link card" title="remove link card">×</button>
              </div>
            ) : null
          ) : cardDisabled ? (
            <button className="bsky-card-restore" onClick={onRestoreCard}>+ add link card back</button>
          ) : null}

          <div className="bsky-actions">
            <BskyAction label="reply" path="M7 8h10M7 12h7" />
            <BskyAction label="repost" path="M7 8h8l-3-3M17 16H7l3 3" />
            <BskyAction label="like" path="M12 20s-7-4.35-7-10a4 4 0 018-1 4 4 0 018 1c0 5.65-7 10-7 10z" fill />
            <BskyAction label="share" path="M4 12v6a2 2 0 002 2h12a2 2 0 002-2v-6M16 6l-4-4-4 4M12 2v14" />
          </div>
        </div>
      </header>
    </article>
  );
}

function BskyAction({ label, path, fill }: { label: string; path: string; fill?: boolean }) {
  return (
    <button className="bsky-action" aria-label={label}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill={fill ? 'none' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
      <span>0</span>
    </button>
  );
}

function BskyLinkCard({ og }: { og: OgMeta }) {
  const image = og.image ?? og.twitterImage;
  const title = og.title || og.twitterTitle || og.finalUrl;
  const desc = og.description || og.twitterDescription;
  return (
    <a className="bsky-card" href={og.finalUrl} target="_blank" rel="noopener noreferrer">
      {image ? <div className="bsky-card-thumb" style={{ backgroundImage: `url(${image})` }} /> : null}
      <div className="bsky-card-body">
        <div className="bsky-card-domain">{prettyDomain(og.finalUrl)}</div>
        <div className="bsky-card-title">{truncate(title, 120)}</div>
        {desc ? <div className="bsky-card-desc">{truncate(desc, 200)}</div> : null}
      </div>
    </a>
  );
}

function renderTokens(tokens: Token[]): ReactNode {
  return tokens.map((t, i) => {
    if (t.kind === 'text') return <span key={i}>{t.value}</span>;
    if (t.kind === 'url') {
      const short = (() => {
        try {
          const u = new URL(t.value);
          const tail = (u.pathname + u.search).replace(/\/$/, '');
          return tail ? `${u.hostname.replace(/^www\./, '')}${tail}` : u.hostname.replace(/^www\./, '');
        } catch { return t.value; }
      })();
      return <span key={i} className="bsky-url">{truncate(short, 30)}</span>;
    }
    if (t.kind === 'mention') return <span key={i} className="bsky-mention">{t.value}</span>;
    return <span key={i} className="bsky-hashtag">{t.value}</span>;
  });
}

const CSS = `
  .shell-cmp { max-width: 1160px; margin: 0 auto; padding: 0 var(--sp-6); }

  .crumbs {
    padding-top: var(--sp-6);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .cmp-hd { padding: 48px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .cmp-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(48px, 7vw, 88px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .cmp-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .cmp-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }

  .cmp-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sp-6);
    padding: var(--sp-6) 0 var(--sp-10);
  }

  .cmp-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-3);
    letter-spacing: 0.05em;
  }

  .cmp-card {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-4);
  }

  .cmp-row {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: var(--sp-3);
  }
  .cmp-text-wrap { min-width: 0; }
  .cmp-textarea {
    width: 100%;
    background: transparent;
    border: 0;
    outline: 0;
    resize: none;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    line-height: 1.5;
    padding: 6px 0;
    min-height: 90px;
    overflow-y: auto;
  }
  .cmp-textarea::placeholder { color: var(--color-fg-faint); }

  .cmp-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--sp-3);
    padding-top: var(--sp-3);
    margin-top: var(--sp-3);
    border-top: 1px solid var(--color-border);
    flex-wrap: wrap;
  }
  .cmp-footer-l { display: flex; align-items: center; gap: var(--sp-2); }
  .cmp-footer-r { display: flex; align-items: center; gap: var(--sp-2); }

  .cmp-url-switch { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .cmp-url-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; font-size: 9px; }
  .cmp-url-pick {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border); padding: 2px 7px;
    cursor: pointer; text-transform: lowercase;
  }
  .cmp-url-pick.on { border-color: var(--color-accent-dim); color: var(--color-accent); }

  .cmp-count {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    min-width: 3ch; text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .cmp-count.warn { color: #f59e0b; }
  .cmp-count.over { color: #ec4899; }

  .cmp-ring { flex-shrink: 0; }

  .cmp-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    padding: 5px 12px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .cmp-btn:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .cmp-btn.primary { background: #208bfe; color: white; border-color: #208bfe; }
  .cmp-btn.primary:disabled, .cmp-btn.primary.disabled {
    opacity: 0.5; cursor: not-allowed;
  }

  .cmp-ident {
    display: flex; gap: var(--sp-2); align-items: center;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .cmp-ident-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .cmp-ident-input {
    flex: 1; background: transparent; border: 0; outline: 0;
    color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .cmp-ident-hint { color: var(--color-fg-faint); font-size: 10px; }
  .cmp-ident.signin { padding: var(--sp-3); gap: var(--sp-3); }

  .cmp-banner {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin-top: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    border: 1px solid;
  }
  .cmp-banner.ok { color: var(--color-accent); border-color: var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 5%, transparent); }
  .cmp-banner.err { color: var(--color-alert); border-color: var(--color-alert-dim); background: color-mix(in srgb, var(--color-alert) 5%, transparent); }
  .cmp-banner a { color: inherit; text-decoration: underline; }
  .cmp-banner-btn {
    margin-left: auto;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    background: transparent; color: inherit;
    border: 1px solid currentColor; padding: 2px 8px;
    cursor: pointer; text-transform: lowercase;
  }

  .cmp-note {
    margin-top: var(--sp-2);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-fg-faint);
  }

  .cmp-raw {
    margin-top: var(--sp-4);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .cmp-raw summary { cursor: pointer; user-select: none; }
  .cmp-raw pre {
    margin-top: var(--sp-2);
    padding: var(--sp-3);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    color: var(--color-fg-dim);
    white-space: pre-wrap;
    overflow: auto;
  }

  /* ─── BLUESKY CARD — isolated visual language ─────────────────────── */

  .bsky {
    --bsky-bg: #161e27;
    --bsky-panel: #1e2732;
    --bsky-border: #2f3d4e;
    --bsky-border-bright: #41505e;
    --bsky-fg: #e9edf1;
    --bsky-dim: #8c95a2;
    --bsky-muted: #5a6373;
    --bsky-link: #208bfe;
    --bsky-red: #ec4899;

    background: var(--bsky-bg);
    border: 1px solid var(--bsky-border);
    border-radius: 6px;
    padding: var(--sp-4);
    font-family: "Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    color: var(--bsky-fg);
    font-size: 15px;
    line-height: 1.4;
  }
  .bsky-hd {
    display: grid;
    grid-template-columns: 44px 1fr;
    gap: var(--sp-3);
    align-items: start;
  }
  .bsky-avatar {
    width: 44px; height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--bsky-panel);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .bsky-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .bsky-avatar-fallback {
    font-family: "Inter", system-ui, sans-serif;
    font-weight: 600; font-size: 20px; color: var(--bsky-fg);
  }
  .bsky-hd-text { min-width: 0; }
  .bsky-name-row {
    display: flex; align-items: baseline; flex-wrap: wrap;
    gap: 4px;
    font-size: 14px;
  }
  .bsky-display { font-weight: 700; color: var(--bsky-fg); }
  .bsky-handle { color: var(--bsky-dim); }
  .bsky-dot { color: var(--bsky-muted); margin: 0 2px; }
  .bsky-time { color: var(--bsky-dim); }

  .bsky-body {
    margin-top: 4px;
    font-size: 15px;
    color: var(--bsky-fg);
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .bsky-placeholder { color: var(--bsky-muted); font-style: italic; }
  .bsky-url, .bsky-mention, .bsky-hashtag {
    color: var(--bsky-link);
    text-decoration: none;
  }

  .bsky-card-wrap {
    position: relative;
    margin-top: var(--sp-3);
  }
  .bsky-card {
    display: block;
    border: 1px solid var(--bsky-border-bright);
    border-radius: 8px;
    overflow: hidden;
    background: var(--bsky-panel);
    text-decoration: none;
    color: inherit;
    transition: background 0.12s;
  }
  .bsky-card:hover { background: #24303f; text-decoration: none; }
  .bsky-card-thumb {
    width: 100%;
    aspect-ratio: 1.91 / 1;
    background-size: cover;
    background-position: center;
    background-color: var(--bsky-panel);
    border-bottom: 1px solid var(--bsky-border);
  }
  .bsky-card-body {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bsky-card-domain {
    font-size: 12px;
    color: var(--bsky-dim);
  }
  .bsky-card-title {
    font-weight: 600;
    color: var(--bsky-fg);
    font-size: 14px;
    line-height: 1.3;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .bsky-card-desc {
    font-size: 13px;
    color: var(--bsky-dim);
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .bsky-card-skel {
    background: var(--bsky-panel);
    pointer-events: none;
  }
  .bsky-card-skel-thumb {
    aspect-ratio: 1.91 / 1;
    background: linear-gradient(90deg,
      var(--bsky-panel) 0%,
      var(--bsky-border-bright) 50%,
      var(--bsky-panel) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.8s linear infinite;
  }
  .bsky-card-close {
    position: absolute;
    top: 8px; right: 8px;
    width: 26px; height: 26px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.75);
    color: white;
    border: 0;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    display: flex; align-items: center; justify-content: center;
  }
  .bsky-card-close:hover { background: rgba(0, 0, 0, 0.9); }
  .bsky-card-restore {
    margin-top: var(--sp-3);
    background: transparent;
    border: 1px dashed var(--bsky-border-bright);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--bsky-dim);
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    width: 100%;
  }
  .bsky-card-restore:hover { color: var(--bsky-fg); border-color: var(--bsky-dim); }

  .bsky-actions {
    display: flex;
    gap: var(--sp-6);
    margin-top: var(--sp-3);
    color: var(--bsky-dim);
  }
  .bsky-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    padding: 0;
  }
  .bsky-action:hover { color: var(--bsky-link); }

  @media (max-width: 900px) {
    .cmp-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 560px) {
    .shell-cmp { padding: 0 var(--sp-4); }
    .cmp-footer-r { gap: 6px; }
    .cmp-btn, .cmp-btn.primary { padding: 5px 10px; }
  }
`;

import { simpleFetchHandler, XRPC } from '@atcute/client';
import type { ActorIdentifier } from '@atcute/lexicons';
import { createAuthorizationUrl, deleteStoredSession, OAuthUserAgent } from '@atcute/oauth-browser-client';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAtprotoSession } from '../../hooks/use-atproto-session';
import { useProfile } from '../../hooks/use-profile';
import { ensureOAuthConfigured, PDF_DELETE_SCOPE, PDF_SCOPE, PDF_WRITE_SCOPE, sessionHasScopes } from '../../lib/oauth';

const COLLECTION = 'com.imlunahey.pdf' as const;

type Phase = 'idle' | 'uploading-pdf' | 'writing-record' | 'done' | 'error';
const PHASE_LABEL: Record<Phase, string> = {
  idle: 'ready',
  'uploading-pdf': 'uploading pdf',
  'writing-record': 'writing record',
  done: 'done',
  error: 'error',
};

type BlobRef = { $type: 'blob'; ref: { $link: string }; mimeType: string; size: number };

type PdfRecordValue = {
  $type: 'com.imlunahey.pdf';
  pdf: BlobRef;
  // filename + createdAt aren't in any formal lexicon — this collection is
  // informal. storing them makes the sidebar useful (show a filename + a
  // sort key) without changing anything downstream that already reads
  // these records.
  name?: string;
  createdAt?: string;
};

type PdfEntry = { uri: string; cid: string; value: PdfRecordValue };

type Mode =
  | { kind: 'new' }
  | { kind: 'view'; rkey: string };

function parseRkey(uri: string): string {
  return uri.split('/').pop() ?? '';
}

function fmtSize(bytes: number | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes}b`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}kb`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
}

async function generatePdfPreview(source: File | ArrayBuffer | Uint8Array): Promise<Blob> {
  const { resolvePDFJS } = await import('pdfjs-serverless');
  const { getDocument } = await resolvePDFJS();
  const buf = source instanceof File
    ? await source.arrayBuffer()
    : source instanceof Uint8Array
      ? source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength)
      : source;
  const pdf = await getDocument(buf).promise;
  const page = await pdf.getPage(1);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas 2d context');

  // render the full page at its natural aspect ratio. the old version
  // cropped to 16:9 which mangled portrait pdfs — css can size the
  // resulting image however the caller wants, but the blob itself should
  // be a faithful rendering of the page.
  const srcVp = page.getViewport({ scale: 1 });
  const targetWidth = 1600;
  const scale = targetWidth / srcVp.width;
  const viewport = page.getViewport({ scale });

  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    transform: [1, 0, 0, 1, 0, 0],
  }).promise;

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('canvas.toBlob returned null');
  return blob;
}

/**
 * Resolve a user's PDS URL from their DID. did:plc goes through
 * plc.directory; did:web dereferences the host's well-known did document.
 * Result is used to build the com.atproto.sync.getBlob URL for the PDF
 * preview + download link — those endpoints are public-readable, no auth
 * needed.
 */
async function resolvePds(did: string): Promise<string | null> {
  type Doc = { service?: Array<{ id: string; serviceEndpoint: string }> };
  try {
    if (did.startsWith('did:plc:')) {
      const r = await fetch(`https://plc.directory/${did}`);
      if (!r.ok) return null;
      const j = (await r.json()) as Doc;
      return j.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint ?? null;
    }
    if (did.startsWith('did:web:')) {
      const host = did.slice('did:web:'.length);
      const r = await fetch(`https://${host}/.well-known/did.json`);
      if (!r.ok) return null;
      const j = (await r.json()) as Doc;
      return j.service?.find((s) => s.id === '#atproto_pds')?.serviceEndpoint ?? null;
    }
  } catch { /* unreachable host / network error */ }
  return null;
}

function blobUrl(pds: string, did: string, cid: string): string {
  return `${pds.replace(/\/$/, '')}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

/**
 * Compute the content-addressed CID that the PDS will assign to this
 * blob. atproto blobs are CIDv1 with raw codec (0x55) and sha-256
 * multihash (0x12, len 0x20). Constructing the prefix manually + base32-
 * encoding gives a byte-exact match to whatever `com.atproto.repo.
 * uploadBlob` would return, without the round-trip.
 *
 * Used for pre-upload dedupe: compare against existing records before
 * burning bandwidth on a duplicate upload. SubtleCrypto handles multi-
 * megabyte files comfortably; for huge pdfs this might spend a beat on
 * the main thread but still finishes well inside a pick→preview cycle.
 */
async function sha256Cid(bytes: Uint8Array): Promise<string> {
  const sha = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const prefixed = new Uint8Array(4 + sha.length);
  prefixed[0] = 0x01; // CIDv1
  prefixed[1] = 0x55; // raw codec
  prefixed[2] = 0x12; // sha-256 multihash
  prefixed[3] = 0x20; // length = 32 bytes
  prefixed.set(sha, 4);
  return 'b' + base32LowerNoPad(prefixed);
}

// RFC 4648 base32, lowercase, no padding — the multibase flavour used by
// CIDv1. not using atcute's helper here because the dep for this one
// lookup would bring in far more surface than it's worth.
function base32LowerNoPad(bytes: Uint8Array): string {
  const ALPHA = 'abcdefghijklmnopqrstuvwxyz234567';
  let bits = 0;
  let val = 0;
  let out = '';
  for (const b of bytes) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHA[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHA[(val << (5 - bits)) & 31];
  return out;
}

// Public AppView — used by the backlinks panel for reading post details.
// no auth needed; these are all public-readable endpoints.
const pubRpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

type Backlink = { did: string; collection: string; rkey: string };

/**
 * Ask constellation for every known record whose `<source>` field equals
 * `<subject>`. Silent-fail on any network / 4xx / 5xx — constellation is
 * a community service on limited hardware and the rest of the viewer
 * should keep working if it's offline.
 */
async function constellationBacklinks(subject: string, source: string): Promise<Backlink[]> {
  try {
    const url = new URL('https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks');
    url.searchParams.set('subject', subject);
    url.searchParams.set('source', source);
    url.searchParams.set('limit', '100');
    const r = await fetch(url.toString());
    if (!r.ok) return [];
    const j = (await r.json()) as { records?: Backlink[] };
    return j.records ?? [];
  } catch {
    return [];
  }
}

/**
 * Find every bluesky-adjacent record that references this pdf — either
 * by blob url or by at-uri. Queries the three most common places users
 * paste links in posts (facet features, external embed, raw text) against
 * both possible shapes, then dedupes.
 */
async function findReferences(blobLink: string, atUri: string): Promise<Backlink[]> {
  const subjects = [blobLink, atUri];
  // Covers the three canonical spots an http/at url shows up in bluesky
  // records: facet links in post text, external-embed cards, and raw
  // text bodies. missing a lexicon here means we miss its references —
  // but it's safe to extend later.
  const sources = [
    'app.bsky.feed.post:facets.features.uri',
    'app.bsky.feed.post:embed.external.uri',
    'app.bsky.feed.post:text',
  ];
  const all: Backlink[] = [];
  await Promise.all(
    subjects.flatMap((subject) =>
      sources.map((source) => constellationBacklinks(subject, source).then((bs) => all.push(...bs))),
    ),
  );
  const seen = new Set<string>();
  return all.filter((b) => {
    const k = `${b.did}/${b.collection}/${b.rkey}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

type PostView = {
  uri: string;
  cid: string;
  author: { did: string; handle: string; displayName?: string; avatar?: string };
  record: { text?: string; createdAt?: string };
  indexedAt?: string;
};

async function hydratePosts(backlinks: Backlink[]): Promise<PostView[]> {
  const postUris = backlinks
    .filter((b) => b.collection === 'app.bsky.feed.post')
    .map((b) => `at://${b.did}/${b.collection}/${b.rkey}`);
  if (postUris.length === 0) return [];
  const out: PostView[] = [];
  for (let i = 0; i < postUris.length; i += 25) {
    const batch = postUris.slice(i, i + 25);
    try {
      const r = await pubRpc.get('app.bsky.feed.getPosts', { params: { uris: batch } });
      const posts = (r.data as unknown as { posts: PostView[] }).posts ?? [];
      out.push(...posts);
    } catch { /* tolerate partial fetch failures */ }
  }
  return out;
}

function bskyPostWebUrl(p: PostView): string {
  // bsky.app uses the handle + rkey in its canonical url, but handles
  // change; the did-backed url always resolves even after a handle swap.
  const rkey = p.uri.split('/').pop() ?? '';
  return `https://bsky.app/profile/${p.author.did}/post/${rkey}`;
}

export default function PdfUploaderPage() {
  const { session, loading: sessionLoading, refresh } = useAtprotoSession();
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  // the lab does both create + delete, so require both scopes at the gate.
  // a session authorised before the delete scope was added will lack it
  // and be bounced to re-authorise here rather than failing mid-delete
  // with ScopeMissingError.
  const hasRequiredScopes = sessionHasScopes(session, [PDF_WRITE_SCOPE, PDF_DELETE_SCOPE]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-pdf">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">pdf-uploader</span>
        </div>

        <header className="pdf-hd">
          <h1>
            pdf uploader<span className="dot">.</span>
          </h1>
          <p className="sub">
            upload pdfs to your bluesky pds as <code className="inline">com.imlunahey.pdf</code> records. the sidebar
            lists everything you&apos;ve uploaded; click an entry to view its metadata or × to delete it. the record
            just holds a blob ref to the raw pdf on your own repo.
          </p>
        </header>

        {sessionLoading ? (
          <div className="loading">checking session…</div>
        ) : !session || !hasRequiredScopes ? (
          <SignInGate existingSession={!!session} onSignedIn={() => void refresh()} />
        ) : (
          <Manager session={session} handle={profile?.handle} onSignOut={() => void refresh()} />
        )}

        <footer className="pdf-footer">
          <span>
            src: <span className="t-accent">pdfjs-serverless · atproto oauth · com.imlunahey.pdf</span>
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

// ─── sign-in gate ──────────────────────────────────────────────────────────

function SignInGate({ existingSession, onSignedIn }: { existingSession: boolean; onSignedIn: () => void }) {
  const [handle, setHandle] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setErr(null);
    setSigning(true);
    try {
      ensureOAuthConfigured();
      const url = await createAuthorizationUrl({
        target: { type: 'account', identifier: handle.trim() as ActorIdentifier },
        scope: PDF_SCOPE,
        state: { returnTo: window.location.pathname },
      });
      window.location.assign(url.toString());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setSigning(false);
    }
  }

  return (
    <section className="gate">
      <div className="gate-title">sign in to upload</div>
      <p className="gate-sub">
        {existingSession
          ? 'you\'re signed in, but this tab needs the pdf-scope (create + delete). re-authorising grants only what\'s needed — other features you\'ve signed into stay intact.'
          : 'oauth sign-in via your handle. the redirect will ask for permission to create and delete com.imlunahey.pdf records in your own repo, nothing else.'}
      </p>
      <form className="gate-form" onSubmit={(e) => void go(e)}>
        <input
          className="gate-input"
          placeholder="your.handle.bsky.social"
          aria-label="bluesky handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          autoComplete="username"
          spellCheck={false}
          disabled={signing}
        />
        <button className="gate-btn primary" type="submit" disabled={!handle.trim() || signing}>
          {signing ? 'redirecting…' : 'sign in'}
        </button>
      </form>
      {err ? <div className="err">{err}</div> : null}
      <button type="button" className="gate-btn" onClick={onSignedIn} title="i already signed in in another tab — re-check my session">
        already signed in? recheck
      </button>
    </section>
  );
}

// ─── manager (signed-in state) ─────────────────────────────────────────────

function Manager({
  session,
  handle,
  onSignOut,
}: {
  session: { info: { sub: string } };
  handle?: string;
  onSignOut: () => void;
}) {
  const did = session.info.sub;
  const agent = useMemo(
    () => new OAuthUserAgent(session as unknown as ConstructorParameters<typeof OAuthUserAgent>[0]),
    [session],
  );
  const rpc = useMemo(() => new XRPC({ handler: agent }), [agent]);
  const { confirm, dialog } = useConfirm();

  const [entries, setEntries] = useState<PdfEntry[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listing, setListing] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: 'new' });
  // Resolve the user's PDS once at mount so the viewer can fetch blobs +
  // show a download link. Same source of truth the pds uses internally,
  // pulled from plc.directory / .well-known/did.json.
  const [pds, setPds] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void resolvePds(did).then((v) => { if (!cancelled) setPds(v); });
    return () => { cancelled = true; };
  }, [did]);

  async function signOut() {
    try {
      await agent.signOut();
    } catch {
      try { deleteStoredSession(did as Parameters<typeof deleteStoredSession>[0]); } catch { /* ignore */ }
    }
    onSignOut();
  }

  const loadList = useCallback(async () => {
    setListing(true);
    setListErr(null);
    try {
      const r = await rpc.get('com.atproto.repo.listRecords', {
        params: { repo: did as ActorIdentifier, collection: COLLECTION, limit: 100 },
      });
      const data = r.data as unknown as { records: PdfEntry[] };
      // sort newest first by createdAt if present, else by rkey (which is
      // a tid and sorts lexicographically by time too).
      const sorted = [...(data.records ?? [])].sort((a, b) => {
        const aKey = a.value?.createdAt ?? parseRkey(a.uri);
        const bKey = b.value?.createdAt ?? parseRkey(b.uri);
        return bKey.localeCompare(aKey);
      });
      setEntries(sorted);
    } catch (err) {
      setListErr(err instanceof Error ? err.message : String(err));
    } finally {
      setListing(false);
    }
  }, [rpc, did]);

  useEffect(() => { void loadList(); }, [loadList]);

  async function del(entry: PdfEntry) {
    const label = entry.value.name || parseRkey(entry.uri);
    const ok = await confirm({
      title: `delete "${label}"?`,
      body: (
        <>
          removes the <code style={{ color: 'var(--color-accent)' }}>com.imlunahey.pdf</code> record from your pds.
          the blob itself may linger as an unreferenced blob until your pds garbage-collects it. cannot be undone
          from here.
        </>
      ),
      confirmLabel: 'delete',
      cancelLabel: 'keep',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await rpc.call('com.atproto.repo.deleteRecord', {
        data: { repo: did as ActorIdentifier, collection: COLLECTION, rkey: parseRkey(entry.uri) },
      });
      // if the deleted entry was being viewed, flip back to "new" mode so
      // the form isn't pointing at a dead record.
      if (mode.kind === 'view' && mode.rkey === parseRkey(entry.uri)) setMode({ kind: 'new' });
      void loadList();
    } catch (err) {
      setListErr(err instanceof Error ? err.message : String(err));
    }
  }

  const selectedEntry = mode.kind === 'view'
    ? entries?.find((e) => parseRkey(e.uri) === mode.rkey) ?? null
    : null;

  /**
   * Group existing records by their blob CID. Any group with >1 records
   * is a duplicate set — multiple records pointing at the same blob,
   * usually from before client-side dedupe existed or from uploading
   * across different sessions.
   *
   * "canonical" for a group = the oldest record (lowest rkey, since
   * rkeys are tids and sort lexicographically by creation time).
   * "extras" = every other record in the group — the ones we'd offer
   * to delete on cleanup.
   */
  const dupeInfo = useMemo(() => {
    const groups = new Map<string, PdfEntry[]>();
    for (const e of entries ?? []) {
      const cid = e.value.pdf?.ref?.$link;
      if (!cid) continue;
      const arr = groups.get(cid);
      if (arr) arr.push(e); else groups.set(cid, [e]);
    }
    const extras: PdfEntry[] = [];
    for (const group of groups.values()) {
      if (group.length <= 1) continue;
      const sorted = [...group].sort((a, b) => parseRkey(a.uri).localeCompare(parseRkey(b.uri)));
      extras.push(...sorted.slice(1));
    }
    const extraUris = new Set(extras.map((e) => e.uri));
    return {
      extras,
      isExtra: (e: PdfEntry) => extraUris.has(e.uri),
    };
  }, [entries]);

  async function removeAllDuplicates() {
    if (dupeInfo.extras.length === 0) return;
    const n = dupeInfo.extras.length;
    const ok = await confirm({
      title: `remove ${n} duplicate record${n === 1 ? '' : 's'}?`,
      body: (
        <>
          these records all point at blobs you already have under other records (same sha-256,
          byte-exact duplicates). the oldest copy of each file stays; the {n} newer copy
          {n === 1 ? '' : 'ies'} get{n === 1 ? 's' : ''} deleted. the underlying blobs stay on
          your pds until it garbage-collects unreferenced blobs. cannot be undone from here.
        </>
      ),
      confirmLabel: `delete ${n}`,
      cancelLabel: 'keep',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      // sequentially so a rate-limit or transient error bubbles up cleanly
      // — parallel deletes would be faster but harder to recover from.
      for (const e of dupeInfo.extras) {
        await rpc.call('com.atproto.repo.deleteRecord', {
          data: { repo: did as ActorIdentifier, collection: COLLECTION, rkey: parseRkey(e.uri) },
        });
        if (mode.kind === 'view' && mode.rkey === parseRkey(e.uri)) setMode({ kind: 'new' });
      }
      void loadList();
    } catch (err) {
      setListErr(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      {dialog}
      <div className="signed-bar">
        <span className="t-faint">signed in as</span>{' '}
        <b className="t-accent">@{handle ?? did}</b>
        <button type="button" className="signout-btn" onClick={() => void signOut()}>
          sign out
        </button>
      </div>

      <section className="grid">
        <aside className="sidebar">
          <div className="sidebar-hd">
            <span>uploaded <span className="t-faint">({entries?.length ?? '—'})</span></span>
            <div className="sidebar-hd-actions">
              {dupeInfo.extras.length > 0 ? (
                <button
                  type="button"
                  className="dedupe-btn"
                  onClick={() => void removeAllDuplicates()}
                  title={`${dupeInfo.extras.length} record${dupeInfo.extras.length === 1 ? '' : 's'} point at blobs you already have — click to delete the extras`}
                >
                  dedupe {dupeInfo.extras.length}
                </button>
              ) : null}
              <button
                type="button"
                className="new-btn"
                onClick={() => setMode({ kind: 'new' })}
                disabled={mode.kind === 'new'}
                title={mode.kind === 'new' ? 'already on the upload form' : 'show the upload form'}
              >
                + new
              </button>
            </div>
          </div>
          {listing ? (
            <div className="loading-row">loading…</div>
          ) : listErr ? (
            <div className="err sidebar-err">{listErr}</div>
          ) : entries && entries.length > 0 ? (
            <ul className="entries" aria-label="your pdf records">
              {entries.map((e) => {
                const rkey = parseRkey(e.uri);
                const active = mode.kind === 'view' && mode.rkey === rkey;
                const label = e.value.name || rkey;
                const isDupe = dupeInfo.isExtra(e);
                return (
                  <li key={e.uri} className={`entry${active ? ' active' : ''}${isDupe ? ' is-dupe' : ''}`}>
                    <button
                      type="button"
                      className="entry-pick"
                      onClick={() => setMode({ kind: 'view', rkey })}
                      aria-label={isDupe ? `view duplicate "${label}"` : `view "${label}"`}
                    >
                      <span className="entry-title">{label}</span>
                      <span className="entry-meta">
                        {isDupe ? <span className="pill pill-dupe" title="same sha-256 as an older record in your repo">dupe</span> : null}
                        <span className="pill">{fmtSize(e.value.pdf?.size)}</span>
                        <span>{(e.value.createdAt ?? '').slice(0, 10) || rkey.slice(0, 10)}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="entry-del"
                      onClick={() => void del(e)}
                      title="delete"
                      aria-label={`delete "${label}"`}
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="empty">no pdfs yet — drop one on the right.</div>
          )}
        </aside>

        <div className="panel">
          {mode.kind === 'new' ? (
            <Uploader
              rpc={rpc}
              did={did}
              handle={handle}
              // findDuplicate is called at pick time with the file's
              // content-addressed CID; returns the existing rkey (if any)
              // so the uploader can steer the user to their existing
              // record instead of wasting bandwidth on an identical upload.
              findDuplicate={(cid) => {
                const hit = entries?.find((e) => e.value.pdf?.ref?.$link === cid);
                return hit ? { rkey: parseRkey(hit.uri), name: hit.value.name } : null;
              }}
              onOpenExisting={(rkey) => setMode({ kind: 'view', rkey })}
              onPublished={(rkey) => {
                setMode({ kind: 'view', rkey });
                void loadList();
              }}
            />
          ) : selectedEntry ? (
            <Viewer
              entry={selectedEntry}
              did={did}
              pds={pds}
              onDelete={() => void del(selectedEntry)}
            />
          ) : (
            <div className="viewer-missing">record not found — may have been deleted.</div>
          )}
        </div>
      </section>
    </>
  );
}

// ─── uploader (new-entry panel) ────────────────────────────────────────────

function Uploader({
  rpc,
  did,
  handle,
  findDuplicate,
  onOpenExisting,
  onPublished,
}: {
  rpc: XRPC;
  did: string;
  handle?: string;
  findDuplicate: (cid: string) => { rkey: string; name?: string } | null;
  onOpenExisting: (rkey: string) => void;
  onPublished: (rkey: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState('');
  // Precomputed CID of the currently-picked file + dedupe lookup result.
  // set when we hash at pick-time, cleared on file change.
  const [duplicate, setDuplicate] = useState<{ rkey: string; name?: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const pickFile = async (f: File) => {
    setFile(f);
    setMsg('');
    setPhase('idle');
    setDuplicate(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    try {
      // hash + preview in parallel — both read the file bytes, but this
      // is fine on modern hardware. the hash gates the submit button, so
      // starting it immediately keeps the dedupe check fast.
      const bytes = new Uint8Array(await f.arrayBuffer());
      const [blob, cid] = await Promise.all([
        generatePdfPreview(bytes),
        sha256Cid(bytes),
      ]);
      setPreviewUrl(URL.createObjectURL(blob));
      setDuplicate(findDuplicate(cid));
    } catch (err) {
      setPhase('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void pickFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === 'application/pdf') void pickFile(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setPhase('error');
      setMsg('pick a pdf first.');
      return;
    }
    setMsg('');
    try {
      setPhase('uploading-pdf');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const upload = await rpc.call('com.atproto.repo.uploadBlob', {
        data: bytes,
        headers: { 'content-type': 'application/pdf' },
      });
      const blob = (upload.data as { blob?: BlobRef }).blob;
      if (!blob) throw new Error('upload returned no blob ref');

      setPhase('writing-record');
      const record: PdfRecordValue = {
        $type: 'com.imlunahey.pdf',
        pdf: blob,
        name: file.name,
        createdAt: new Date().toISOString(),
      };
      const res = await rpc.call('com.atproto.repo.createRecord', {
        data: { repo: did as ActorIdentifier, collection: COLLECTION, record },
      });
      const uri = (res.data as unknown as { uri?: string }).uri ?? '';
      setPhase('done');
      setMsg(`uploaded to @${handle ?? did}`);
      // reset inputs then notify parent so the sidebar refreshes + auto-
      // selects the new record.
      setFile(null);
      if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
      onPublished(uri.split('/').pop() ?? '');
    } catch (err) {
      setPhase('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'error';
  // a duplicate blocks the submit button — you can still open the existing
  // record instead via the "view existing" button.
  const canSubmit = !!file && !busy && !duplicate;

  return (
    <form onSubmit={submit} className="uploader">
      <div className="panel-hd">
        <span>new upload</span>
        <span className="t-faint">com.imlunahey.pdf</span>
      </div>

      <label
        className={'dropzone' + (file ? ' has-file' : '')}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="preview" />
        ) : (
          <div className="dz-body">
            <div className="dz-icon" aria-hidden="true">◱</div>
            <div className="dz-ttl">{file ? file.name : 'drop a pdf here'}</div>
            <div className="dz-sub">{file ? `${fmtSize(file.size)}` : 'or click to browse'}</div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={onFileChange}
          className="file-input"
          aria-label="pdf file"
        />
      </label>

      {duplicate ? (
        <div className="dupe">
          <div className="dupe-msg">
            <b>already uploaded.</b> a pdf with this exact content already exists in your repo
            {duplicate.name ? <> as <b className="t-accent">{duplicate.name}</b></> : null}.
            atproto is content-addressed, so re-uploading would just write another record pointing
            at the same blob.
          </div>
          <button
            type="button"
            className="dupe-btn"
            onClick={() => onOpenExisting(duplicate.rkey)}
          >
            view existing →
          </button>
        </div>
      ) : null}

      <div className="actions">
        <button type="submit" disabled={!canSubmit} className="go">
          {busy ? `${PHASE_LABEL[phase]}…` : duplicate ? 'already uploaded' : 'post to bluesky'}
        </button>
        <span className="t-faint">
          phase · <b className={`ph ph-${phase}`}>{PHASE_LABEL[phase]}</b>
        </span>
      </div>

      {msg ? (
        <div className={`status ${phase === 'error' ? 'is-error' : ''}`}>
          <div className="msg">{msg}</div>
        </div>
      ) : null}
    </form>
  );
}

// ─── viewer (existing record panel) ────────────────────────────────────────

function Viewer({
  entry,
  did,
  pds,
  onDelete,
}: {
  entry: PdfEntry;
  did: string;
  pds: string | null;
  onDelete: () => void;
}) {
  const rkey = parseRkey(entry.uri);
  const cid = entry.value.pdf?.ref?.$link ?? '';
  // Which of the two copy buttons just flashed "copied". null = neither.
  const [copiedKind, setCopiedKind] = useState<'url' | 'aturi' | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [previewErr, setPreviewErr] = useState<string>('');

  const downloadUrl = pds && cid ? blobUrl(pds, did, cid) : null;

  useEffect(() => {
    // rebuild preview whenever the selected record (or its pds/cid)
    // changes. the blob fetch can be big — tens of MB for a document
    // pdf — so we show a loading state and only render the first page.
    let cancelled = false;
    setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
    setPreviewErr('');
    if (!downloadUrl) {
      setPreviewState(pds === null ? 'loading' : 'error');
      if (pds !== null) setPreviewErr('no pds resolved for this did');
      return;
    }
    setPreviewState('loading');
    (async () => {
      try {
        const res = await fetch(downloadUrl);
        if (!res.ok) throw new Error(`pds returned ${res.status}`);
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;
        const jpeg = await generatePdfPreview(bytes);
        if (cancelled) return;
        const url = URL.createObjectURL(jpeg);
        setPreviewUrl(url);
        setPreviewState('ready');
      } catch (err) {
        if (cancelled) return;
        setPreviewErr(err instanceof Error ? err.message : String(err));
        setPreviewState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [downloadUrl, pds]);

  // clean up the object url when the component unmounts or url changes
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const copy = async (s: string, kind: 'url' | 'aturi') => {
    try {
      await navigator.clipboard.writeText(s);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind((k) => (k === kind ? null : k)), 1200);
    } catch { /* ignore */ }
  };

  return (
    <section className="viewer">
      <div className="panel-hd">
        <span>viewing @{rkey}</span>
        <button type="button" className="viewer-del" onClick={onDelete} aria-label="delete">
          delete ×
        </button>
      </div>

      <div className="viewer-preview">
        {previewState === 'loading' ? (
          <div className="preview-status">fetching pdf + rendering page 1…</div>
        ) : previewState === 'error' ? (
          <div className="preview-status error">couldn&apos;t render preview{previewErr ? ` — ${previewErr}` : ''}</div>
        ) : previewUrl ? (
          <img src={previewUrl} alt={`first page of ${entry.value.name ?? rkey}`} className="preview" />
        ) : null}
      </div>

      <dl className="meta">
        <dt>filename</dt>
        <dd>{entry.value.name ?? <span className="t-faint">unset (uploaded before filename was stored)</span>}</dd>
        <dt>size</dt>
        <dd>{fmtSize(entry.value.pdf?.size)}</dd>
        <dt>mime</dt>
        <dd>{entry.value.pdf?.mimeType ?? '—'}</dd>
        <dt>created</dt>
        <dd>{entry.value.createdAt ?? <span className="t-faint">unset</span>}</dd>
        <dt>blob cid</dt>
        <dd className="mono-break">{cid || '—'}</dd>
        <dt>rkey</dt>
        <dd>{rkey}</dd>
        <dt>at-uri</dt>
        <dd className="mono-break">
          <Link
            to={`/labs/at-uri/${entry.uri.replace('at://', '')}` as never}
            className="t-accent"
          >
            {entry.uri}
          </Link>
        </dd>
      </dl>

      <div className="viewer-actions">
        {downloadUrl ? (
          <>
            {/* Copy-to-clipboard share URL: the pds's public getBlob
                endpoint. anyone can open this in a browser to view/download
                the pdf — paste it into bluesky, discord, slack, etc. plain
                https, no atproto client required. unfurls aren't pretty
                (most clients don't preview raw pdfs) but the link works. */}
            <button
              type="button"
              className={'copy primary' + (copiedKind === 'url' ? ' flash' : '')}
              onClick={() => void copy(downloadUrl, 'url')}
              title="public https url to the blob — paste anywhere"
            >
              {copiedKind === 'url' ? 'copied url' : 'copy share url'}
            </button>
            <a className="copy" href={downloadUrl} target="_blank" rel="noopener noreferrer">
              open →
            </a>
          </>
        ) : null}
        <button
          type="button"
          className={'copy' + (copiedKind === 'aturi' ? ' flash' : '')}
          onClick={() => void copy(entry.uri, 'aturi')}
        >
          {copiedKind === 'aturi' ? 'copied at-uri' : 'copy at-uri'}
        </button>
      </div>

      {downloadUrl ? <BacklinksPanel atUri={entry.uri} blobLink={downloadUrl} /> : null}
    </section>
  );
}

// ─── backlinks (where's this pdf been posted?) ────────────────────────────

function BacklinksPanel({ atUri, blobLink }: { atUri: string; blobLink: string }) {
  const [posts, setPosts] = useState<PostView[] | null>(null);
  const [otherCount, setOtherCount] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setPosts(null);
    setOtherCount(0);
    (async () => {
      try {
        const backlinks = await findReferences(blobLink, atUri);
        if (cancelled) return;
        const hydrated = await hydratePosts(backlinks);
        if (cancelled) return;
        // newest first by indexedAt (fall back to createdAt on the record)
        hydrated.sort((a, b) => {
          const ka = a.indexedAt ?? a.record.createdAt ?? '';
          const kb = b.indexedAt ?? b.record.createdAt ?? '';
          return kb.localeCompare(ka);
        });
        setPosts(hydrated);
        // anything constellation returned that wasn't a bluesky post — blog
        // comments, custom collections, etc. — just get a count for now.
        setOtherCount(backlinks.length - hydrated.length);
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [atUri, blobLink]);

  return (
    <section className="backlinks">
      <div className="backlinks-hd">
        <span>posts linking to this pdf</span>
        <span className="t-faint">
          by blob cid · via{' '}
          <a href="https://constellation.microcosm.blue/" target="_blank" rel="noopener noreferrer">constellation</a>
        </span>
      </div>
      {state === 'loading' ? (
        <div className="bl-empty">scanning atproto for references…</div>
      ) : state === 'error' ? (
        <div className="bl-empty error">couldn&apos;t reach constellation.</div>
      ) : (posts && posts.length > 0) || otherCount > 0 ? (
        <>
          <ul className="bl-list">
            {(posts ?? []).map((p) => {
              const text = p.record.text ?? '';
              const snippet = text.length > 220 ? text.slice(0, 217) + '…' : text;
              return (
                <li key={p.uri} className="bl-item">
                  <a
                    className="bl-row"
                    href={bskyPostWebUrl(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {p.author.avatar ? (
                      <img src={p.author.avatar} alt="" className="bl-avatar" />
                    ) : (
                      <div className="bl-avatar empty" />
                    )}
                    <div className="bl-body">
                      <div className="bl-who">
                        <b>{p.author.displayName || p.author.handle}</b>
                        <span className="bl-handle">@{p.author.handle}</span>
                        {p.indexedAt ? <span className="bl-when">· {p.indexedAt.slice(0, 10)}</span> : null}
                      </div>
                      {snippet ? <div className="bl-text">{snippet}</div> : null}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          {otherCount > 0 ? (
            <div className="bl-foot">
              + {otherCount} non-bluesky reference{otherCount === 1 ? '' : 's'} (other atproto collections)
            </div>
          ) : null}
        </>
      ) : (
        <div className="bl-empty">no references indexed yet — constellation&apos;s backfill covers the last ~22 days.</div>
      )}
    </section>
  );
}

const CSS = `
  .shell-pdf { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .pdf-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .pdf-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .pdf-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .pdf-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .pdf-hd .sub .inline {
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 1px 6px;
    font-size: 12px;
    color: var(--color-accent);
    font-family: var(--font-mono);
  }

  .loading {
    margin-top: var(--sp-4);
    padding: var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim);
  }
  .loading-row { padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .err { margin-top: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .sidebar-err { margin: var(--sp-3); }

  .gate {
    margin: var(--sp-6) auto 0;
    max-width: 520px;
    display: flex; flex-direction: column; gap: var(--sp-3);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 5%, var(--color-bg-panel));
  }
  .gate-title { font-family: var(--font-display); font-size: 28px; color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow); }
  .gate-sub { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); line-height: 1.55; }
  .gate-form { display: flex; gap: 6px; }
  .gate-input { flex: 1; min-width: 0; background: var(--color-bg); border: 1px solid var(--color-border-bright); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm); padding: 8px 10px; }
  .gate-input:focus { outline: none; border-color: var(--color-accent); }
  .gate-btn { font-family: var(--font-mono); font-size: var(--fs-xs); padding: 8px 14px; background: transparent; border: 1px solid var(--color-border-bright); color: var(--color-fg-dim); cursor: pointer; text-transform: lowercase; letter-spacing: 0.06em; }
  .gate-btn:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .gate-btn.primary { background: var(--color-accent); border-color: var(--color-accent); color: var(--color-bg); }
  .gate-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .signed-bar {
    margin-top: var(--sp-4);
    padding: 8px 12px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    display: flex; align-items: center; gap: 8px;
  }
  .signed-bar b { font-weight: 400; }
  .signout-btn {
    margin-left: auto;
    background: transparent;
    color: var(--color-fg-faint);
    border: 1px solid var(--color-border-bright);
    padding: 3px 10px;
    font-family: var(--font-mono); font-size: 10px;
    cursor: pointer; text-transform: lowercase; letter-spacing: 0.06em;
  }
  .signout-btn:hover { color: var(--color-alert); border-color: var(--color-alert); }

  .grid {
    margin-top: var(--sp-3);
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--sp-4);
    align-items: stretch;
    height: clamp(500px, 75vh, 900px);
  }
  .grid > * { min-height: 0; }
  @media (max-width: 760px) {
    .grid { grid-template-columns: 1fr; height: auto; }
  }

  /* ─── sidebar ─────────────────────────────────────────────────────── */
  .sidebar {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    display: flex; flex-direction: column;
    min-height: 0;
    min-width: 0;
    overflow-x: hidden;
  }
  .sidebar-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px var(--sp-3);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .sidebar-hd .t-faint { color: var(--color-fg-faint); }
  .sidebar-hd-actions { display: inline-flex; gap: 4px; align-items: center; }
  .new-btn { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 3px 8px; font-family: var(--font-mono); font-size: 10px; cursor: pointer; font-weight: 500; text-transform: lowercase; }
  .new-btn:hover:not(:disabled) { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .new-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  /* warn-toned button — only appears when content-addressed duplicates
     exist in the repo. counts in the label so it's obvious whether it's
     a 1-click minor cleanup or a 30-click disaster. */
  .dedupe-btn {
    background: transparent;
    border: 1px solid color-mix(in oklch, var(--color-warn) 50%, var(--color-border));
    color: var(--color-warn);
    padding: 3px 8px;
    font-family: var(--font-mono); font-size: 10px;
    cursor: pointer; font-weight: 500;
    text-transform: lowercase;
  }
  .dedupe-btn:hover { background: color-mix(in oklch, var(--color-warn) 10%, transparent); }
  .empty { padding: var(--sp-4); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); text-align: center; line-height: 1.5; }

  .entries { list-style: none; overflow-y: auto; min-width: 0; }
  .entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    border-bottom: 1px dashed var(--color-border);
    min-width: 0;
  }
  .entry:last-child { border-bottom: 0; }
  .entry.active { background: color-mix(in oklch, var(--color-accent) 8%, transparent); border-left: 2px solid var(--color-accent); }
  .entry-pick {
    all: unset;
    cursor: pointer;
    display: flex; flex-direction: column; gap: 3px;
    padding: 8px 10px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    min-width: 0; max-width: 100%;
  }
  .entry-pick:hover { color: var(--color-fg); }
  .entry-title { color: var(--color-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .entry.active .entry-title { color: var(--color-accent); }
  .entry-meta { display: inline-flex; gap: 6px; color: var(--color-fg-faint); font-size: 10px; }
  .pill { padding: 0 4px; border: 1px solid var(--color-border-bright); text-transform: uppercase; letter-spacing: 0.08em; font-size: 9px; color: var(--color-fg-dim); }
  .pill-dupe { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border-bright)); }
  .entry.is-dupe .entry-title { color: var(--color-fg-faint); font-style: italic; }
  .entry.is-dupe.active .entry-title { color: var(--color-accent); font-style: normal; }
  .entry-del {
    background: transparent; border: 0;
    color: var(--color-fg-faint);
    padding: 0 10px; height: 100%;
    cursor: pointer; font-size: 16px;
    font-family: var(--font-mono);
  }
  .entry-del:hover { color: var(--color-alert); }

  /* ─── main panel (uploader OR viewer) ────────────────────────────── */
  .panel {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    display: flex; flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }
  .panel-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim);
    text-transform: uppercase; letter-spacing: 0.08em;
  }
  .panel-hd .t-faint { color: var(--color-fg-faint); text-transform: none; letter-spacing: 0; }

  .uploader {
    display: flex; flex-direction: column; gap: var(--sp-3);
    padding: var(--sp-4);
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .dropzone {
    position: relative;
    display: flex; align-items: center; justify-content: center;
    min-height: 200px;
    /* tighter padding when a preview is rendered so the image has more
       room to fill the box. the non-preview state keeps generous
       padding around the drop hint. */
    padding: var(--sp-5);
    border: 1px dashed var(--color-border-bright);
    background: var(--color-bg);
    cursor: pointer;
    overflow: hidden;
    text-align: center;
    flex: 1;
    min-height: 0;
  }
  .dropzone.has-file { padding: var(--sp-2); }
  .dropzone:hover { border-color: var(--color-accent-dim); }
  .dropzone.has-file { border-style: solid; border-color: var(--color-accent-dim); }
  .file-input {
    position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
  }
  .dz-body { display: flex; flex-direction: column; gap: 6px; align-items: center; }
  .dz-icon { font-size: 40px; color: var(--color-accent); text-shadow: 0 0 12px var(--accent-glow); line-height: 1; }
  .dz-ttl { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg); }
  .dz-sub { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  /* generic preview (viewer panel keeps a modest cap so it sits above
     the metadata without pushing it offscreen). */
  .preview {
    display: block; max-width: 100%; max-height: 320px;
    margin: 0 auto; border: 1px solid var(--color-border);
  }
  /* in the dropzone we want the image to fill the available box so the
     full page shows without wasted whitespace. object-fit: contain on a
     sized wrapper keeps aspect correct regardless of portrait / landscape. */
  .dropzone .preview {
    max-width: 100%;
    max-height: 100%;
    height: 100%;
    width: 100%;
    object-fit: contain;
    border: 0;
    margin: 0;
  }

  .actions {
    display: flex; align-items: center; justify-content: space-between;
    gap: var(--sp-4); flex-wrap: wrap;
  }
  .go {
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel));
    color: var(--color-accent);
    font: inherit; font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 8px 18px;
    cursor: pointer; text-transform: lowercase; letter-spacing: 0.06em;
  }
  .go:hover:not(:disabled) { background: color-mix(in oklch, var(--color-accent) 16%, var(--color-bg-panel)); }
  .go:disabled { opacity: 0.4; cursor: not-allowed; }
  .ph { color: var(--color-fg); font-weight: 400; }
  .ph.ph-error { color: var(--color-alert); }
  .ph.ph-done { color: var(--color-accent); }

  /* duplicate banner — triggered when the file's sha256 matches an
     existing record. warn-yellow to signal "not an error, just fyi". */
  .dupe {
    display: flex; gap: var(--sp-3); align-items: flex-start;
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-warn) 6%, var(--color-bg));
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    line-height: 1.55;
  }
  .dupe-msg { flex: 1; min-width: 0; }
  .dupe-msg b { color: var(--color-warn); font-weight: 400; }
  .dupe-msg .t-accent { color: var(--color-accent); }
  .dupe-btn {
    background: transparent;
    color: var(--color-accent);
    border: 1px solid var(--color-accent-dim);
    padding: 4px 12px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    cursor: pointer; text-transform: lowercase; letter-spacing: 0.06em;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .dupe-btn:hover { background: color-mix(in oklch, var(--color-accent) 10%, transparent); }

  .status {
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    color: var(--color-fg);
  }
  .status.is-error { border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); }
  .status.is-error .msg { color: var(--color-alert); }

  /* ─── viewer panel ───────────────────────────────────────────────── */
  .viewer {
    flex: 1;
    overflow-y: auto;
    display: flex; flex-direction: column;
  }
  .viewer-preview {
    padding: var(--sp-4) var(--sp-5) 0;
    display: flex; justify-content: center; align-items: center;
    min-height: 160px;
  }
  .viewer-preview .preview {
    max-width: 100%;
    max-height: 320px;
    border: 1px solid var(--color-border);
    display: block;
  }
  .preview-status {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding: var(--sp-3) 0;
  }
  .preview-status.error { color: var(--color-alert); }
  .viewer-del {
    background: transparent;
    border: 1px solid color-mix(in oklch, var(--color-alert) 40%, var(--color-border));
    color: var(--color-alert);
    font-family: var(--font-mono); font-size: 10px;
    padding: 3px 10px; cursor: pointer;
    text-transform: lowercase; letter-spacing: 0.06em;
  }
  .viewer-del:hover { background: color-mix(in oklch, var(--color-alert) 10%, transparent); }
  .meta {
    padding: var(--sp-4) var(--sp-5);
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 6px var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .meta dt { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; }
  .meta dd { color: var(--color-fg); margin: 0; word-break: break-word; }
  .meta dd.mono-break { word-break: break-all; }
  .meta dd .t-faint { color: var(--color-fg-faint); }
  .meta dd .t-accent { color: var(--color-accent); }
  .viewer-actions {
    padding: 0 var(--sp-5) var(--sp-4);
    display: flex; gap: var(--sp-2);
  }
  .copy {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit; font-size: 10px;
    padding: 4px 12px; cursor: pointer;
    font-family: var(--font-mono);
    text-transform: lowercase; letter-spacing: 0.06em;
  }
  .copy:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .copy.flash { color: var(--color-accent); border-color: var(--color-accent); background: var(--color-bg-raised); }
  /* the "copy share url" is the primary action for people who just want
     to post their pdf somewhere — elevate it with an accent fill. */
  .copy.primary {
    background: var(--color-accent); color: var(--color-bg);
    border-color: var(--color-accent);
  }
  .copy.primary:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); color: var(--color-bg); }
  .copy.primary.flash { background: var(--color-accent); color: var(--color-bg); }
  .viewer-missing { padding: var(--sp-5); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-sm); }

  /* ─── backlinks panel ────────────────────────────────────────────── */
  .backlinks {
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
    border-top: 1px dashed var(--color-border);
  }
  .backlinks-hd {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    text-transform: uppercase; letter-spacing: 0.08em;
    margin-bottom: var(--sp-3);
  }
  .backlinks-hd .t-faint { color: var(--color-fg-faint); text-transform: none; letter-spacing: 0; font-size: 10px; }
  .backlinks-hd .t-faint a { color: var(--color-accent-dim); text-decoration: none; }
  .backlinks-hd .t-faint a:hover { color: var(--color-accent); }

  .bl-empty {
    padding: var(--sp-3) 0;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .bl-empty.error { color: var(--color-alert); }

  .bl-list { list-style: none; display: flex; flex-direction: column; gap: 1px; }
  .bl-item { border-bottom: 1px dashed var(--color-border); }
  .bl-item:last-child { border-bottom: 0; }

  .bl-row {
    display: grid;
    grid-template-columns: 32px 1fr;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-3);
    margin: 0 calc(-1 * var(--sp-3));
    text-decoration: none;
    color: inherit;
    transition: background 0.1s ease-out;
  }
  /* explicit no-underline on hover to override App.css's global
     a:hover rule — otherwise the whole post preview reads as one big
     underlined link, which is ugly for multi-line content. */
  .bl-row:hover { text-decoration: none; background: color-mix(in oklch, var(--color-accent) 5%, transparent); }
  .bl-row:hover .bl-who b { color: var(--color-accent); }
  .bl-row:focus-visible { outline: 1px solid var(--color-accent); outline-offset: -1px; }
  .bl-avatar {
    width: 32px; height: 32px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    object-fit: cover;
  }
  .bl-avatar.empty {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .bl-body { min-width: 0; }
  .bl-who {
    display: flex; gap: 6px; align-items: baseline;
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .bl-who b { color: var(--color-fg); font-weight: 400; }
  .bl-handle { color: var(--color-fg-faint); }
  .bl-when { color: var(--color-fg-faint); }
  .bl-text {
    color: var(--color-fg-dim);
    font-size: var(--fs-xs);
    line-height: 1.55;
    margin-top: 4px;
    overflow-wrap: break-word;
    white-space: pre-wrap;
  }
  .bl-foot {
    padding: var(--sp-2) 0 0;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
  }

  .pdf-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;

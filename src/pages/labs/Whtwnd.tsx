import { XRPC } from '@atcute/client';
import { deleteStoredSession, OAuthUserAgent, createAuthorizationUrl } from '@atcute/oauth-browser-client';
import { MarkdownPreview } from '../../components/MarkdownPreview';
import { useConfirm } from '../../components/ConfirmDialog';
import type { ActorIdentifier } from '@atcute/lexicons';
import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtprotoSession } from '../../hooks/use-atproto-session';
import { useProfile } from '../../hooks/use-profile';
import {
  ensureOAuthConfigured,
  sessionHasScopes,
  WHTWND_DELETE_SCOPE,
  WHTWND_SCOPE,
  WHTWND_UPDATE_SCOPE,
  WHTWND_WRITE_SCOPE,
} from '../../lib/oauth';

const COLLECTION = 'com.whtwnd.blog.entry' as const;

// Matches the real lexicon enum (see @atcute/whitewind). 'public' is
// indexable on whtwnd + everywhere; 'url' is unlisted (reachable only via
// direct link); 'author' is author-only, functionally a draft.
type Visibility = 'public' | 'url' | 'author';

const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: 'public — listable + indexable',
  url: 'unlisted — reachable by link only',
  author: 'author-only — draft, hidden from everyone',
};

// Lexicon content cap. Saves before this are rejected by the pds.
const MAX_CONTENT_LEN = 100_000;
const MAX_TITLE_LEN = 1_000;

type Ogp = { url: string; width?: number; height?: number };

type WhtwndEntryValue = {
  $type: 'com.whtwnd.blog.entry';
  content: string;
  title?: string;
  createdAt?: string;
  visibility?: Visibility;
  theme?: 'github-light';
  ogp?: Ogp;
  comments?: string;
};

type WhtwndEntry = {
  uri: string;
  cid: string;
  value: WhtwndEntryValue;
};

type DraftState =
  | { mode: 'new' }
  | { mode: 'edit'; rkey: string; cid: string; createdAt: string };

function parseRkey(uri: string): string {
  // at://<did>/<collection>/<rkey>
  return uri.split('/').pop() ?? '';
}

/**
 * The lexicon stores title + content as separate fields. The editor
 * treats the first H1 at the top of the markdown as the title so the
 * authoring experience is "just markdown" — no weirdly empty title slot
 * next to the content. On save we split; on load we recombine. What ends
 * up on your pds remains 100% lexicon-compliant.
 *
 * Rules:
 *  - skip leading blank lines
 *  - if the first non-blank line is `# Something`, strip it + one
 *    following blank line
 *  - otherwise return the markdown as-is with no title
 */
function extractFirstHeading(md: string): { title?: string; body: string } {
  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return { body: md };
  const m = /^#\s+(.+?)\s*$/.exec(lines[i]);
  if (!m) return { body: md };
  const rest = lines.slice(i + 1);
  // drop a single blank line immediately after the title line so the
  // round trip `# title\n\nbody` → split → rejoin doesn't keep growing
  // blank lines between title and body.
  if (rest.length > 0 && rest[0].trim() === '') rest.shift();
  return { title: m[1].trim(), body: rest.join('\n') };
}

function combineTitle(title: string | undefined, body: string): string {
  if (!title) return body;
  return `# ${title}\n\n${body}`;
}

export default function WhtwndPage() {
  const { session, loading: sessionLoading, refresh } = useAtprotoSession();
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  // the editor does create + update + delete, so require all three at
  // the gate. stale sessions authorised with a narrower bundle get
  // bounced to re-auth here rather than failing mid-edit with
  // ScopeMissingError.
  const hasRequiredScopes = sessionHasScopes(session, [
    WHTWND_WRITE_SCOPE,
    WHTWND_UPDATE_SCOPE,
    WHTWND_DELETE_SCOPE,
  ]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-whtwnd">
        <header className="page-hd">
          <div className="label">~/labs/whtwnd</div>
          <h1>whtwnd<span className="dot">.</span></h1>
          <p className="sub">
            write, edit, and publish whitewind blog posts directly from your own pds. oauth sign-in
            grants this tab write access to <code>com.whtwnd.blog.entry</code> records in your repo
            — nothing else. revoke at any time via your pds.
          </p>
        </header>

        {sessionLoading ? (
          <div className="loading">checking session…</div>
        ) : !session || !hasRequiredScopes ? (
          <SignInGate existingSession={!!session} onSignedIn={() => void refresh()} />
        ) : (
          <Editor session={session} handle={profile?.handle} onSignOut={() => void refresh()} />
        )}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">atproto oauth · your pds · com.whtwnd.blog.entry</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
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
        scope: WHTWND_SCOPE,
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
      <div className="gate-title">sign in to edit</div>
      <p className="gate-sub">
        {existingSession
          ? 'you\'re signed in, but this tab needs the whtwnd-write scope. signing in again with this scope grants only what\'s needed — other features you\'ve authorised stay intact.'
          : 'use your bluesky / atproto handle. the oauth popup will ask for permission to create, update, and delete your own com.whtwnd.blog.entry records. nothing else.'}
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
      <button
        type="button"
        className="gate-btn"
        onClick={onSignedIn}
        title="i already signed in in another tab — re-check my session"
      >
        already signed in? recheck
      </button>
    </section>
  );
}

// ─── editor (signed-in state) ──────────────────────────────────────────────

function Editor({
  session,
  handle,
  onSignOut,
}: {
  // atcute Session — reuse the shape other labs already pass around
  session: { info: { sub: string } };
  handle?: string;
  onSignOut: () => void;
}) {
  const did = session.info.sub;
  const agent = useMemo(() => new OAuthUserAgent(session as unknown as ConstructorParameters<typeof OAuthUserAgent>[0]), [session]);
  const rpc = useMemo(() => new XRPC({ handler: agent }), [agent]);
  // Site's themed confirm dialog — matches the ConfirmDialog pattern used
  // elsewhere (focus trap, keyboard a11y, variant styling).
  const { confirm, dialog } = useConfirm();

  // follows the same pattern as guestbook/wordle: try the agent's signOut
  // (which revokes the refresh token on the pds), fall back to purging the
  // local session if that fails. either way, refresh the session hook so
  // the sign-in gate re-renders.
  async function signOut() {
    try {
      await agent.signOut();
    } catch {
      // deleteStoredSession wants a typed DID — the runtime value is
      // always a did: URI, but the session hook types it as plain string.
      try { deleteStoredSession(did as Parameters<typeof deleteStoredSession>[0]); } catch { /* ignore */ }
    }
    onSignOut();
  }

  const [entries, setEntries] = useState<WhtwndEntry[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [listing, setListing] = useState(true);

  const [draft, setDraft] = useState<DraftState>({ mode: 'new' });
  // Title isn't a separate form field any more — the first `# heading`
  // line in `content` becomes the record's title on save (see
  // extractFirstHeading). Simplifies the authoring UX to "just markdown".
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [ogpUrl, setOgpUrl] = useState('');
  const [ogpWidth, setOgpWidth] = useState('');
  const [ogpHeight, setOgpHeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  // published state: uri of the just-saved record so we can link to it
  // (via our own /labs/at-uri inspector, which is stable across whtwnd
  // front-ends and doesn't assume the user publishes to whtwnd.com).
  const [published, setPublished] = useState<{ uri: string; action: 'created' | 'updated' } | null>(null);

  // What's currently in localStorage, mirrored in react state so the
  // sidebar can show a "draft" row even when the form is showing
  // something else (e.g. viewing/editing a published entry). null when
  // no draft is saved.
  type SavedDraft = {
    content: string;
    visibility: Visibility;
    ogpUrl?: string;
    ogpWidth?: string;
    ogpHeight?: string;
  };
  const [savedDraft, setSavedDraft] = useState<SavedDraft | null>(null);

  // ─── draft autosave (localStorage) ──────────────────────────────────
  // Persist the in-progress new-entry draft so a refresh or accidental
  // tab close doesn't wipe unpublished writing. Only runs when draft.mode
  // is 'new'; edits-in-progress aren't stored because reopening the entry
  // re-reads the source of truth from the pds.
  const DRAFT_KEY = `whtwnd:draft:${did}`;

  // Restore exactly once per did: on mount, if the form is empty and a
  // stored draft exists, hydrate the fields. Running any later than this
  // would risk stomping fresh typing.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    if (restored) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          // legacy shape had a separate `title` field before the
          // first-# convention; merge it back into content on read so
          // older drafts migrate cleanly.
          title?: string; content?: string; visibility?: Visibility;
          ogpUrl?: string; ogpWidth?: string; ogpHeight?: string;
        };
        const mergedContent = s.title
          ? combineTitle(s.title, s.content ?? '')
          : (s.content ?? '');
        // only hydrate form state if it's empty + we're in new-entry mode —
        // don't stomp fresh typing.
        if (draft.mode === 'new' && !content && !ogpUrl && mergedContent) {
          setContent(mergedContent);
          if (s.visibility) setVisibility(s.visibility);
          if (s.ogpUrl) setOgpUrl(s.ogpUrl);
          if (s.ogpWidth) setOgpWidth(s.ogpWidth);
          if (s.ogpHeight) setOgpHeight(s.ogpHeight);
        }
        // Always mirror the stored draft into react state so the sidebar
        // "draft" row is visible even when the form is showing an edit.
        if (mergedContent || s.ogpUrl) {
          setSavedDraft({
            content: mergedContent,
            visibility: s.visibility ?? 'public',
            ogpUrl: s.ogpUrl,
            ogpWidth: s.ogpWidth,
            ogpHeight: s.ogpHeight,
          });
        }
      }
    } catch { /* corrupt/unavailable storage — carry on */ }
    setRestored(true);
  }, [restored, draft.mode, DRAFT_KEY, content, ogpUrl]);

  // Autosave: only *write* when there's actual content in new-entry mode.
  // We deliberately never clear from an empty-state event — if we did,
  // clicking an existing entry then "+ new" would empty the fields and
  // wipe the stored draft as a side effect. Explicit clears happen at
  // publish success + discard confirm below.
  useEffect(() => {
    if (!restored || draft.mode !== 'new') return;
    if (!content && !ogpUrl && !ogpWidth && !ogpHeight) return;
    const payload: SavedDraft = { content, visibility, ogpUrl, ogpWidth, ogpHeight };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch { /* quota exceeded / sandboxed storage — best-effort */ }
    // mirror into react state so the sidebar "draft" row updates live
    // as the user types.
    setSavedDraft(payload);
  }, [restored, draft.mode, DRAFT_KEY, content, visibility, ogpUrl, ogpWidth, ogpHeight]);

  const clearStoredDraft = useCallback(() => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    setSavedDraft(null);
  }, [DRAFT_KEY]);

  const loadList = useCallback(async () => {
    setListing(true);
    setListErr(null);
    try {
      const r = await rpc.get('com.atproto.repo.listRecords', {
        params: { repo: did as ActorIdentifier, collection: COLLECTION, limit: 100 },
      });
      const data = r.data as unknown as { records: WhtwndEntry[] };
      // newest first — listRecords defaults to ascending rkey; sort by createdAt desc
      const sorted = [...(data.records ?? [])].sort((a, b) =>
        (b.value?.createdAt ?? '').localeCompare(a.value?.createdAt ?? ''),
      );
      setEntries(sorted);
    } catch (err) {
      setListErr(err instanceof Error ? err.message : String(err));
    } finally {
      setListing(false);
    }
  }, [rpc, did]);

  useEffect(() => { void loadList(); }, [loadList]);

  function resetDraft() {
    setDraft({ mode: 'new' });
    setContent('');
    setVisibility('public');
    setOgpUrl('');
    setOgpWidth('');
    setOgpHeight('');
    setSaveErr(null);
    setPublished(null);
  }

  function loadIntoDraft(entry: WhtwndEntry) {
    setDraft({
      mode: 'edit',
      rkey: parseRkey(entry.uri),
      cid: entry.cid,
      createdAt: entry.value.createdAt ?? new Date().toISOString(),
    });
    // combine stored title back into content so the editor is unified
    // markdown. on save, extractFirstHeading splits them apart again.
    setContent(combineTitle(entry.value.title, entry.value.content ?? ''));
    setVisibility(entry.value.visibility ?? 'public');
    setOgpUrl(entry.value.ogp?.url ?? '');
    setOgpWidth(entry.value.ogp?.width ? String(entry.value.ogp.width) : '');
    setOgpHeight(entry.value.ogp?.height ? String(entry.value.ogp.height) : '');
    setSaveErr(null);
    setPublished(null);
  }

  // Load the localStorage-backed new-entry draft into the form. Called
  // from the sidebar "draft" row when the user has navigated away to look
  // at an existing entry and wants to jump back to their unfinished draft.
  function openSavedDraft() {
    if (!savedDraft) return;
    setDraft({ mode: 'new' });
    setContent(savedDraft.content);
    setVisibility(savedDraft.visibility);
    setOgpUrl(savedDraft.ogpUrl ?? '');
    setOgpWidth(savedDraft.ogpWidth ?? '');
    setOgpHeight(savedDraft.ogpHeight ?? '');
    setSaveErr(null);
    setPublished(null);
    setMode('write');
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // content is the only required field per the lexicon. block if
    // content is empty OR either field busts its length. title is
    // extracted from the first `# heading` in content.
    if (!content.trim() || saving) return;
    const { title: extractedTitle, body } = extractFirstHeading(content);
    if (body.length > MAX_CONTENT_LEN) {
      setSaveErr(`content exceeds ${MAX_CONTENT_LEN.toLocaleString()} character limit`);
      return;
    }
    if (extractedTitle && extractedTitle.length > MAX_TITLE_LEN) {
      setSaveErr(`title (first # heading) exceeds ${MAX_TITLE_LEN.toLocaleString()} character limit`);
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      // build the OGP object only if the url is set — lexicon expects the
      // url field, width + height are optional numbers.
      let ogp: Ogp | undefined;
      if (ogpUrl.trim()) {
        ogp = { url: ogpUrl.trim() };
        const w = Number(ogpWidth);
        const h = Number(ogpHeight);
        if (Number.isFinite(w) && w > 0) ogp.width = w;
        if (Number.isFinite(h) && h > 0) ogp.height = h;
      }
      const record: WhtwndEntryValue = {
        $type: 'com.whtwnd.blog.entry',
        content: body,
        visibility,
        // new posts get the current time; edits keep the original creation
        // stamp so the entry doesn't jump to the top of the feed every time
        // it's touched.
        createdAt: draft.mode === 'edit' ? draft.createdAt : new Date().toISOString(),
      };
      // only include fields the user set — keeps the stored record clean.
      if (extractedTitle) record.title = extractedTitle;
      if (ogp) record.ogp = ogp;

      if (draft.mode === 'edit') {
        await rpc.call('com.atproto.repo.putRecord', {
          data: { repo: did, collection: COLLECTION, rkey: draft.rkey, record },
        });
        const uri = `at://${did}/${COLLECTION}/${draft.rkey}`;
        setPublished({ uri, action: 'updated' });
      } else {
        const r = await rpc.call('com.atproto.repo.createRecord', {
          data: { repo: did, collection: COLLECTION, record },
        });
        const uri = (r.data as unknown as { uri?: string }).uri ?? '';
        setPublished({ uri, action: 'created' });
        // reset the form but keep the published banner visible — they
        // probably want to click through to confirm the entry looks right.
        setDraft({ mode: 'new' });
        setContent('');
        setVisibility('public');
        setOgpUrl('');
        setOgpWidth('');
        setOgpHeight('');
        // successful publish — the stored draft is now published, so wipe
        // it so a reload doesn't bring back already-saved content.
        clearStoredDraft();
      }
      void loadList();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function del(entry: WhtwndEntry) {
    const ok = await confirm({
      title: `delete "${entry.value.title || '(untitled)'}"?`,
      body: 'removes the record from your pds. cannot be undone from here — recovery would require restoring from a repo backup.',
      confirmLabel: 'delete',
      cancelLabel: 'keep',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await rpc.call('com.atproto.repo.deleteRecord', {
        data: { repo: did, collection: COLLECTION, rkey: parseRkey(entry.uri) },
      });
      if (draft.mode === 'edit' && draft.rkey === parseRkey(entry.uri)) resetDraft();
      void loadList();
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
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
          <span>entries <span className="t-faint">({entries?.length ?? '—'})</span></span>
          <button
            type="button"
            className="new-btn"
            onClick={resetDraft}
            disabled={draft.mode === 'new'}
            title={draft.mode === 'new' ? 'already on a new entry' : 'clear form + start a new entry'}
          >
            + new
          </button>
        </div>
        {listing ? (
          <div className="loading-row">loading…</div>
        ) : listErr ? (
          <div className="err">{listErr}</div>
        ) : (savedDraft || (entries && entries.length > 0)) ? (
          <ul className="entries" aria-label="your whtwnd entries">
            {savedDraft ? (() => {
              // extract a display title from the draft's first # line, or
              // fall back to the first ~40 chars of body if no heading yet.
              const { title: dt, body } = extractFirstHeading(savedDraft.content);
              const display = dt || body.trim().slice(0, 40) || '(empty draft)';
              // active when we're currently editing the draft (new mode +
              // content mirrors savedDraft). clicking "+ new" clears
              // content, so the draft row un-activates until reopened.
              const active = draft.mode === 'new' && content === savedDraft.content;
              return (
                <li key="__draft__" className={`entry draft${active ? ' active' : ''}`}>
                  <button
                    type="button"
                    className="entry-pick"
                    onClick={openSavedDraft}
                    aria-label={`open unsaved draft "${display}"`}
                  >
                    <span className="entry-title">{display}</span>
                    <span className="entry-meta">
                      <span className="pill pill-draft-ls">unsaved</span>
                      <span>draft</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="entry-del"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'discard this draft?',
                        body: 'unsaved content will be lost. this does not affect any published entries.',
                        confirmLabel: 'discard',
                        cancelLabel: 'keep',
                        variant: 'danger',
                      });
                      if (!ok) return;
                      // if the user is currently editing the draft, also
                      // clear the form so the discard feels consistent.
                      if (draft.mode === 'new' && content === savedDraft.content) resetDraft();
                      clearStoredDraft();
                    }}
                    title="discard draft"
                    aria-label={`discard draft "${display}"`}
                  >
                    ×
                  </button>
                </li>
              );
            })() : null}
            {(entries ?? []).map((e) => {
              const rkey = parseRkey(e.uri);
              const active = draft.mode === 'edit' && draft.rkey === rkey;
              return (
                <li key={e.uri} className={`entry${active ? ' active' : ''}`}>
                  <button
                    type="button"
                    className="entry-pick"
                    onClick={() => loadIntoDraft(e)}
                    aria-label={`edit "${e.value.title || 'untitled'}"`}
                  >
                    <span className="entry-title">{e.value.title || '(untitled)'}</span>
                    <span className="entry-meta">
                      {(() => {
                        const v = e.value.visibility ?? 'public';
                        const short = v === 'author' ? 'draft' : v === 'url' ? 'unlisted' : 'public';
                        return <span className={`pill pill-${v}`}>{short}</span>;
                      })()}
                      <span>{e.value.createdAt?.slice(0, 10)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="entry-del"
                    onClick={() => void del(e)}
                    title="delete"
                    aria-label={`delete "${e.value.title || 'untitled'}"`}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">no entries yet — start your first post on the right.</div>
        )}
      </aside>

      <form className="editor" onSubmit={(e) => void save(e)}>
        <div className="editor-hd">
          <span className="editor-title-row">
            <span>{draft.mode === 'edit' ? `editing @${handle}/${draft.rkey}` : 'new entry'}</span>
            <span className="editor-tabs" role="tablist" aria-label="editor mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'write'}
                className={`ed-tab ${mode === 'write' ? 'on' : ''}`}
                onClick={() => setMode('write')}
              >
                write
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'preview'}
                className={`ed-tab ${mode === 'preview' ? 'on' : ''}`}
                onClick={() => setMode('preview')}
                disabled={!content.trim()}
                title={!content.trim() ? 'nothing to preview yet' : 'render markdown'}
              >
                preview
              </button>
            </span>
          </span>
          <span className="t-faint">stored as com.whtwnd.blog.entry on your pds</span>
        </div>

        {mode === 'write' ? (
          <>
            <label className="f-row grow">
              <span className="f-lbl">
                markdown
                <span className="f-hint">
                  first <code>#</code> heading becomes the title
                </span>
                <span className={`f-hint ${content.length > MAX_CONTENT_LEN * 0.9 ? 'warn' : ''}`}>
                  {content.length.toLocaleString()} / {MAX_CONTENT_LEN.toLocaleString()}
                </span>
              </span>
              <textarea
                className="f-area"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# a title

write markdown here. whitewind renders it on their side when visitors open the entry."
                rows={20}
                spellCheck={false}
                maxLength={MAX_CONTENT_LEN}
                required
              />
            </label>

            <details className="f-ogp">
              <summary>
                social card (ogp) <span className="f-hint">optional — image shown when the post is shared</span>
              </summary>
              <div className="f-ogp-grid">
                <label className="f-row">
                  <span className="f-lbl">image url</span>
                  <input
                    className="f-input"
                    value={ogpUrl}
                    onChange={(e) => setOgpUrl(e.target.value)}
                    placeholder="https://…"
                    spellCheck={false}
                    type="url"
                  />
                </label>
                <label className="f-row">
                  <span className="f-lbl">width</span>
                  <input
                    className="f-input"
                    value={ogpWidth}
                    onChange={(e) => setOgpWidth(e.target.value.replace(/\D/g, ''))}
                    placeholder="1200"
                    inputMode="numeric"
                  />
                </label>
                <label className="f-row">
                  <span className="f-lbl">height</span>
                  <input
                    className="f-input"
                    value={ogpHeight}
                    onChange={(e) => setOgpHeight(e.target.value.replace(/\D/g, ''))}
                    placeholder="630"
                    inputMode="numeric"
                  />
                </label>
              </div>
            </details>
          </>
        ) : (
          // Preview mode: render the in-progress entry the way it'd appear
          // once published. Uses the same MarkdownPreview component the
          // blog uses so preview fidelity matches the live rendered page.
          // The first `# heading` renders as an h1 naturally — no need to
          // pull it out and display separately.
          <div className="f-preview">
            <MarkdownPreview content={content} />
          </div>
        )}

        <div className="f-ctrls">
          <label className="f-vis">
            <span className="f-lbl">visibility</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
              className="f-select"
              aria-label="visibility"
              title={VISIBILITY_LABELS[visibility]}
            >
              {(Object.keys(VISIBILITY_LABELS) as Visibility[]).map((v) => (
                <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
              ))}
            </select>
          </label>
          <div className="f-spacer" />
          {draft.mode === 'edit' ? (
            <button type="button" className="btn-ghost" onClick={resetDraft} disabled={saving}>
              cancel edit
            </button>
          ) : (content.trim() || ogpUrl.trim()) ? (
            // new-entry mode with unsaved content: a symmetric escape hatch.
            // confirms before wiping so a stray click doesn't lose a
            // half-written post.
            <button
              type="button"
              className="btn-ghost"
              onClick={async () => {
                const ok = await confirm({
                  title: 'discard this draft?',
                  body: 'the unsaved title + content will be lost. this does not affect any published entries.',
                  confirmLabel: 'discard',
                  cancelLabel: 'keep writing',
                  variant: 'danger',
                });
                if (ok) {
                  resetDraft();
                  clearStoredDraft();
                }
              }}
              disabled={saving}
            >
              discard draft
            </button>
          ) : null}
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !content.trim() || content.length > MAX_CONTENT_LEN}
          >
            {saving ? (draft.mode === 'edit' ? 'saving…' : 'publishing…') : draft.mode === 'edit' ? 'save' : 'publish'}
          </button>
        </div>

        {published ? (
          <div className="flash" role="status">
            <span>
              ✓ {published.action} ·{' '}
              <Link
                to={`/labs/at-uri/${published.uri.replace('at://', '')}` as never}
                className="flash-link"
              >
                view record →
              </Link>
            </span>
          </div>
        ) : null}
        {saveErr ? <div className="err">{saveErr}</div> : null}
      </form>
      </section>
      {dialog}
    </>
  );
}

const CSS = `
  .shell-whtwnd { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }
  .page-hd code { font-family: var(--font-mono); background: var(--color-bg-raised); padding: 1px 5px; font-size: 11px; }

  .loading { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }
  .loading-row { padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .err { margin-top: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .flash { margin: var(--sp-3) var(--sp-4) 0; padding: var(--sp-3); border: 1px solid var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 8%, var(--color-bg-panel)); color: var(--color-accent); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .flash-link { color: var(--color-accent); text-decoration: underline; text-underline-offset: 3px; }
  .flash-link:hover { text-decoration: underline; }

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
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .signout-btn:hover { color: var(--color-alert); border-color: var(--color-alert); }

  .grid {
    margin-top: var(--sp-3);
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: var(--sp-4);
    align-items: stretch;
    /* fixed viewport-relative height (with sensible floor + ceiling) so
       the preview + entry list scroll internally instead of growing the
       page. min-height: 0 on the grid cells below lets the children
       actually clip and scroll. */
    height: clamp(500px, 75vh, 900px);
  }
  .grid > * { min-height: 0; }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
      /* on mobile two panels stacked vertically — let it be as tall as
         needed; no point constraining to vh when the user's scrolling
         the page anyway. */
      height: auto;
    }
  }

  .sidebar {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    display: flex; flex-direction: column;
    min-height: 0;
    /* contain the whole sidebar horizontally so a long entry title
       truncates via ellipsis instead of scrolling the panel sideways. */
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
  .new-btn { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 3px 8px; font-family: var(--font-mono); font-size: 10px; cursor: pointer; font-weight: 500; text-transform: lowercase; }
  .new-btn:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .new-btn:disabled { opacity: 0.4; cursor: not-allowed; }
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
    /* critical for flex/grid ellipsis: without min-width: 0 the child
       grows to its content width and breaks truncation. */
    min-width: 0;
    max-width: 100%;
  }
  .entry-pick:hover { color: var(--color-fg); }
  .entry-title { color: var(--color-fg); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .entry.active .entry-title { color: var(--color-accent); }
  .entry-meta { display: inline-flex; gap: 6px; color: var(--color-fg-faint); font-size: 10px; }
  .pill { padding: 0 4px; border: 1px solid var(--color-border-bright); text-transform: uppercase; letter-spacing: 0.1em; font-size: 9px; }
  .pill-public { color: var(--color-fg-dim); }
  .pill-url { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .pill-author { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border-bright)); }
  .pill-draft-ls { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border-bright)); }

  /* Sidebar "draft" row — the localStorage-backed in-progress new entry.
     dashed left edge + faint phosphor tint signals "in flight, not saved
     to your pds yet". collapses into a normal entry look when active. */
  .entry.draft {
    background: color-mix(in oklch, var(--color-warn) 4%, transparent);
    border-left: 2px dashed color-mix(in oklch, var(--color-warn) 60%, var(--color-border-bright));
  }
  .entry.draft.active {
    background: color-mix(in oklch, var(--color-warn) 10%, transparent);
    border-left-style: solid;
    border-left-color: var(--color-warn);
  }
  .entry.draft .entry-title { color: var(--color-fg-dim); font-style: italic; }
  .entry.draft.active .entry-title { color: var(--color-warn); font-style: normal; }
  .entry-del {
    background: transparent; border: 0;
    color: var(--color-fg-faint);
    padding: 0 10px; height: 100%;
    cursor: pointer; font-size: 16px;
    font-family: var(--font-mono);
  }
  .entry-del:hover { color: var(--color-alert); }

  .editor {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    display: flex; flex-direction: column;
    min-height: 0;
  }
  .editor-hd {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim);
    text-transform: uppercase; letter-spacing: 0.08em;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .editor-title-row { display: inline-flex; align-items: center; gap: var(--sp-3); }
  .editor-hd .t-faint { color: var(--color-fg-faint); text-transform: none; letter-spacing: 0; }

  .editor-tabs { display: inline-flex; border: 1px solid var(--color-border-bright); }
  .ed-tab {
    background: transparent; border: 0;
    color: var(--color-fg-faint);
    padding: 3px 12px;
    font-family: var(--font-mono); font-size: 10px;
    text-transform: lowercase; letter-spacing: 0.08em;
    cursor: pointer;
  }
  .ed-tab + .ed-tab { border-left: 1px solid var(--color-border-bright); }
  .ed-tab:hover:not(:disabled) { color: var(--color-fg); }
  .ed-tab.on { color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 10%, transparent); }
  .ed-tab:disabled { opacity: 0.4; cursor: not-allowed; }

  .f-preview {
    flex: 1;
    overflow-y: auto;
    padding: var(--sp-5) var(--sp-5) var(--sp-4);
    background: var(--color-bg);
    border-top: 1px solid var(--color-border);
    /* minimal prose-ish styling for the rendered markdown. the preview
       component already sets colours + link styles — we just handle
       rhythm + heading scales. */
    color: var(--color-fg-dim);
    line-height: 1.65;
    font-size: var(--fs-md);
  }
  .f-preview p { margin-bottom: var(--sp-3); color: var(--color-fg-dim); }
  .f-preview h1, .f-preview h2, .f-preview h3 { color: var(--color-fg); margin: var(--sp-5) 0 var(--sp-3); font-family: var(--font-display); letter-spacing: -0.01em; }
  .f-preview h1 { font-size: 32px; }
  .f-preview h2 { font-size: 22px; }
  .f-preview h3 { font-size: 17px; }
  .f-preview pre { background: var(--color-bg-raised); padding: var(--sp-3); overflow-x: auto; border: 1px solid var(--color-border); font-size: var(--fs-xs); margin-bottom: var(--sp-3); }
  .f-preview code { background: var(--color-bg-raised); padding: 1px 4px; font-size: 0.9em; font-family: var(--font-mono); }
  .f-preview ul, .f-preview ol { padding-left: var(--sp-5); margin-bottom: var(--sp-3); }
  .f-preview li { margin-bottom: 4px; }
  .f-preview blockquote { border-left: 2px solid var(--color-accent-dim); padding-left: var(--sp-3); color: var(--color-fg-faint); font-style: italic; margin-bottom: var(--sp-3); }
  .f-preview a { color: var(--color-accent); }
  .f-preview img { max-width: 100%; margin: var(--sp-3) 0; }
  .preview-title {
    font-family: var(--font-display);
    font-size: 36px;
    color: var(--color-fg);
    letter-spacing: -0.02em;
    line-height: 1.1;
    margin: 0 0 var(--sp-5);
  }
  .f-row { display: flex; flex-direction: column; gap: 4px; padding: var(--sp-3) var(--sp-4) 0; }
  .f-row.grow { flex: 1; min-height: 0; }
  .f-lbl {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.1em;
    display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
  }
  .f-hint { color: var(--color-fg-ghost); text-transform: none; letter-spacing: 0; font-size: 10px; font-variant-numeric: tabular-nums; }
  .f-hint.warn { color: var(--color-warn); }

  .f-ogp { padding: 0 var(--sp-4); margin-top: var(--sp-3); }
  .f-ogp > summary {
    cursor: pointer;
    list-style: none;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.1em;
    padding: 4px 0;
    user-select: none;
  }
  .f-ogp > summary::before { content: '▸ '; color: var(--color-fg-ghost); }
  .f-ogp[open] > summary::before { content: '▾ '; }
  .f-ogp > summary::-webkit-details-marker { display: none; }
  .f-ogp-grid {
    display: grid;
    grid-template-columns: 1fr 110px 110px;
    gap: var(--sp-2);
    padding-top: 6px;
  }
  .f-ogp-grid .f-row { padding: 0; }
  @media (max-width: 600px) { .f-ogp-grid { grid-template-columns: 1fr 1fr; } .f-ogp-grid > :first-child { grid-column: 1 / -1; } }
  .f-input {
    background: var(--color-bg); border: 1px solid var(--color-border-bright);
    color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 8px 10px;
  }
  .f-input:focus { outline: 0; border-color: var(--color-accent); }
  .f-area {
    flex: 1;
    /* no min-height: with a fixed-height editor panel, a baseline
       textarea height can overflow the card on short viewports. flex:1
       sizes it to whatever space is left after the other rows. */
    min-height: 0;
    background: var(--color-bg); border: 1px solid var(--color-border-bright);
    color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: var(--sp-3);
    resize: none;
    line-height: 1.55;
  }
  .f-area:focus { outline: 0; border-color: var(--color-accent); }

  .f-ctrls {
    display: flex; align-items: flex-end; gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px dashed var(--color-border);
  }
  .f-vis { display: flex; flex-direction: column; gap: 4px; }
  .f-select {
    background: var(--color-bg); color: var(--color-fg);
    border: 1px solid var(--color-border-bright);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 6px 8px;
  }
  .f-spacer { flex: 1; }
  .btn-ghost {
    background: transparent; color: var(--color-fg-dim);
    border: 1px solid var(--color-border-bright);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 8px 14px; cursor: pointer; text-transform: lowercase;
  }
  .btn-ghost:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .btn-primary {
    background: var(--color-accent); color: var(--color-bg);
    border: 0; padding: 8px 16px;
    font-family: var(--font-mono); font-size: var(--fs-xs); font-weight: 500;
    cursor: pointer; text-transform: lowercase;
  }
  .btn-primary:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;

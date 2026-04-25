import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { XRPC } from '@atcute/client';
import { OAuthUserAgent, createAuthorizationUrl, deleteStoredSession } from '@atcute/oauth-browser-client';
import type { ActorIdentifier } from '@atcute/lexicons';
import { SITE } from '../data';
import { useAtprotoSession } from '../hooks/use-atproto-session';
import { useProfile } from '../hooks/use-profile';
import { ensureOAuthConfigured, GUESTBOOK_SCOPE, GUESTBOOK_WRITE_SCOPE, sessionHasScope } from '../lib/oauth';
import { getGuestbookEntries, GUESTBOOK_ENTRY_COLLECTION, GUESTBOOK_MARKER_URI, notifyGuestbookEntry, type GuestbookEntry } from '../server/guestbook';

// Each entry is a record on the visitor's own pds with
// `subject = GUESTBOOK_MARKER_URI`. We find them by asking
// constellation.microcosm.blue which records link to the marker.
// Records live on their authors' pds — i can't delete them, only
// hide them from this view.

const GUESTBOOK_NSID = GUESTBOOK_ENTRY_COLLECTION;

// Stable pseudo-random tint per did so the avatar fallback (when a profile
// has no avatar) feels distinct per person.
function tintForDid(did: string): string {
  let h = 0;
  for (let i = 0; i < did.length; i++) h = (h * 31 + did.charCodeAt(i)) | 0;
  const hue = ((h % 360) + 360) % 360;
  return `oklch(0.72 0.16 ${hue})`;
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return iso.slice(0, 10);
}

export default function GuestbookPage() {
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const { session, loading: sessionLoading, refresh: refreshSession } = useAtprotoSession();
  // a session is only useful here if it actually carries the guestbook
  // write scope. a leaderboard-only session (e.g. signed in via /labs/snake
  // first) can't createRecord on guestbook entries, so we treat it as
  // signed-out and prompt for a fresh sign-in.
  const canPublishEntry = sessionHasScope(session, GUESTBOOK_WRITE_SCOPE);
  const signedIn = session !== null && canPublishEntry;
  const queryClient = useQueryClient();

  // Resolve the signed-in DID to a handle / display name / avatar so the
  // "signed in as …" line shows something readable instead of `did:plc:…`.
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  const signedInLabel = profile?.handle ? `@${profile.handle}` : (session?.info.sub ?? '');

  const { data: entries, isLoading } = useQuery({
    queryKey: ['guestbook', 'entries'],
    queryFn: () => getGuestbookEntries(),
  });

  async function startSignIn(handle: string) {
    setSignInError(null);
    setSigningIn(true);
    try {
      ensureOAuthConfigured();
      const url = await createAuthorizationUrl({
        target: { type: 'account', identifier: handle.trim() as ActorIdentifier },
        scope: GUESTBOOK_SCOPE,
        state: { returnTo: window.location.pathname },
      });
      // leave signingIn=true; navigation replaces the page anyway. if it
      // somehow fails silently, the stuck button is a feature — the user
      // knows something's hung instead of thinking nothing happened.
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
      // agent signOut failed (e.g. refresh token already dead); purge local copy regardless
      try {
        deleteStoredSession(session.info.sub);
      } catch {
        /* ignore */
      }
    }
    await refreshSession();
  }

  async function publish() {
    if (!session || publishing) return;
    const text = draft.trim();
    if (text.length === 0) return;
    setPublishing(true);
    try {
      const agent = new OAuthUserAgent(session);
      const xrpc = new XRPC({ handler: agent });
      await xrpc.call('com.atproto.repo.createRecord', {
        data: {
          repo: session.info.sub,
          collection: GUESTBOOK_ENTRY_COLLECTION,
          record: {
            $type: GUESTBOOK_ENTRY_COLLECTION,
            text,
            subject: GUESTBOOK_MARKER_URI,
            createdAt: new Date().toISOString(),
          },
        },
      });
      setDraft('');
      setDrafting(false);
      // give constellation a beat to index, then re-query
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['guestbook', 'entries'] }), 2000);
      // fire-and-forget: ping brrr so luna gets a push on her phone.
      // failure here (secret unset, brrr down) should never surface to
      // the visitor — their entry is already safely on their own pds.
      void notifyGuestbookEntry({
        data: { did: session.info.sub, handle: profile?.handle, text },
      }).catch(() => { /* ignored */ });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSignInError(msg);
    } finally {
      setPublishing(false);
    }
  }

  const count = entries?.length ?? 0;
  const newest = entries?.[0]?.createdAt;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-gb">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/guestbook
          </div>
          <h1>
            guestbook<span className="dot">.</span>
          </h1>
          <p className="sub">
            leave a trace. every entry is a record on your own pds — no account on my server, no comment moderation
            queue. i can&apos;t delete what you wrote, only hide it from this view.
          </p>
          <div className="lex-line">
            <span className="lex-key">lexicon</span>
            <code>{GUESTBOOK_NSID}</code>
            <span className="lex-k2">·</span>
            <span className="lex-key">subject</span>
            <code>{GUESTBOOK_MARKER_URI}</code>
          </div>
          <div className="meta">
            <span>
              entries <b className="t-accent">{isLoading ? '—' : count}</b>
            </span>
            <span>
              newest <b>{newest ? relative(newest) : '—'}</b>
            </span>
            <span>
              index <b className="t-accent">constellation.microcosm.blue</b>
            </span>
          </div>
        </header>

        <section className="compose">
          {sessionLoading ? (
            <div className="gb-loading">checking session…</div>
          ) : !signedIn ? (
            <form
              className="signin-card"
              onSubmit={(e) => {
                e.preventDefault();
                if (handleInput.trim()) void startSignIn(handleInput);
              }}
            >
              <div className="signin-copy">
                <h3>sign the book.</h3>
                <p>
                  entries are written to your own pds as a <code>{GUESTBOOK_NSID}</code> record. you can delete it any
                  time via your client — i can&apos;t, i can only hide it from this view.
                </p>
              </div>
              <div className="signin-actions">
                <input
                  className="handle-input"
                  type="text"
                  placeholder="your.handle.bsky.social"
                  aria-label="bluesky handle"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  disabled={signingIn}
                />
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={!handleInput.trim() || signingIn}
                >
                  {signingIn ? 'redirecting…' : 'sign in'}
                </button>
                {signInError ? <span className="signin-err">{signInError}</span> : null}
              </div>
            </form>
          ) : !drafting ? (
            <div className="signed-row">
              <button className="btn-primary" onClick={() => setDrafting(true)} type="button">
                + leave an entry
              </button>
              <div className="signed-as">
                signed in as <b className="t-accent">{signedInLabel}</b>{' '}
                <button className="btn-ghost tiny" onClick={() => void signOut()} type="button">
                  sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="drafter">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="say hi, leave a thought, point out a bug…"
                aria-label="guestbook entry"
                maxLength={1000}
                rows={4}
                autoFocus
              />
              <div className="drafter-foot">
                <span className="t-faint">
                  {draft.length} / 1000 · posted as <b className="t-accent">{signedInLabel}</b> · revocable
                </span>
                <div className="drafter-btns">
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setDrafting(false);
                      setDraft('');
                    }}
                    type="button"
                    disabled={publishing}
                  >
                    cancel
                  </button>
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() => void publish()}
                    disabled={publishing || draft.trim().length === 0}
                  >
                    {publishing ? 'signing…' : 'sign + publish'}
                  </button>
                </div>
              </div>
              {signInError ? <div className="signin-err">{signInError}</div> : null}
            </div>
          )}
        </section>

        <section className="entries">
          {isLoading ? (
            <div className="gb-loading">loading entries from constellation…</div>
          ) : count === 0 ? (
            <div className="gb-empty">
              no entries yet. sign in and be the first.
            </div>
          ) : (
            entries!.map((e) => <EntryRow key={e.uri} entry={e} />)
          )}
        </section>

        <section className="lex-block">
          <div className="lex-hd">
            <span className="t-accent">./lexicon</span>
            <span className="t-faint">{GUESTBOOK_NSID}</span>
          </div>
          <pre className="lex-pre">{`{
  "lexicon": 1,
  "id": "com.imlunahey.guestbook.entry",
  "defs": {
    "main": {
      "type": "record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": ["text", "createdAt", "subject"],
        "properties": {
          "text":      { "type": "string", "maxLength": 1000 },
          "subject":   { "type": "string", "format": "at-uri" },
          "createdAt": { "type": "string", "format": "datetime" }
        }
      }
    }
  }
}`}</pre>
        </section>

        <footer className="gb-footer">
          <span>
            src: <span className="t-accent">constellation backlinks → this page · records live on your pds</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
        <div className="sig">
          <span className="t-faint">personal site · {SITE.name}</span>
        </div>
      </main>
    </>
  );
}

function EntryRow({ entry }: { entry: GuestbookEntry }) {
  const tint = tintForDid(entry.did);
  const initials = entry.displayName.slice(0, 2);
  return (
    <article className="entry">
      <div className="entry-gutter">
        {entry.avatar ? (
          <img src={entry.avatar} alt={entry.handle} className="entry-avatar entry-avatar-img" loading="lazy" />
        ) : (
          <div
            className="entry-avatar"
            style={{ background: `linear-gradient(135deg, ${tint}, color-mix(in oklch, ${tint} 60%, black))` }}
          >
            {initials}
          </div>
        )}
        <div className="entry-line" />
      </div>
      <div className="entry-body">
        <header className="entry-hd">
          <a
            href={`https://bsky.app/profile/${entry.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="entry-name"
          >
            {entry.displayName}
          </a>
          <span className="entry-handle">@{entry.handle}</span>
          <span className="entry-badge">did:plc ✓</span>
          <span className="entry-time">{relative(entry.createdAt)}</span>
        </header>
        <p className="entry-text">{entry.text}</p>
        <footer className="entry-ft">
          <span className="entry-uri">{entry.uri}</span>
          <Link
            className="entry-link"
            to={`/labs/at-uri/${entry.uri.replace('at://', '')}` as never}
          >
            view record →
          </Link>
        </footer>
      </div>
    </article>
  );
}

const CSS = `
  .shell-gb { max-width: 860px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 58ch; margin-top: var(--sp-3); line-height: 1.55; }

  .lex-line {
    margin-top: var(--sp-4);
    padding: var(--sp-3);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: flex; flex-wrap: wrap; gap: 8px;
    align-items: baseline;
  }
  .lex-key { color: var(--color-accent); text-transform: uppercase; letter-spacing: 0.12em; font-size: 10px; }
  .lex-line code { color: var(--color-fg); background: transparent; padding: 0; }
  .lex-k2 { color: var(--color-fg-faint); }

  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5); font-family: var(--font-mono);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }
  .page-hd .meta b.t-warn { color: var(--color-warn); }

  /* compose */
  .compose { padding: var(--sp-6) 0 var(--sp-4); }
  .signin-card {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--sp-4);
    padding: var(--sp-5);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
    align-items: center;
  }
  .signin-card h3 {
    font-family: var(--font-display);
    font-size: 22px; font-weight: 500;
    color: var(--color-fg); letter-spacing: -0.01em;
    margin-bottom: 4px;
  }
  .signin-card p { color: var(--color-fg-dim); font-size: var(--fs-sm); line-height: 1.5; }
  .signin-card code { font-family: var(--font-mono); font-size: 11px; color: var(--color-accent); }
  .signin-actions { display: flex; flex-direction: column; gap: 6px; align-items: stretch; min-width: 260px; }
  .handle-input {
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 10px;
  }
  .handle-input:focus { outline: none; border-color: var(--color-accent); }
  .signin-err {
    color: var(--color-alert);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    margin-top: 4px;
  }
  .signed-row {
    display: flex; gap: var(--sp-3); align-items: center; flex-wrap: wrap;
  }
  .signed-as {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    display: inline-flex; gap: 6px; align-items: center;
    flex-wrap: wrap;
  }
  .signed-as b { color: var(--color-accent); font-weight: 400; word-break: break-all; }
  .btn-ghost.tiny { padding: 2px 8px; font-size: 10px; }

  .btn-primary, .btn-ghost {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 8px 16px;
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.08em;
  }
  .btn-primary:disabled, .btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-primary {
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    color: var(--color-bg);
    box-shadow: 0 0 12px var(--accent-glow);
    font-weight: 500;
  }
  .btn-primary:hover {
    background: color-mix(in oklch, var(--color-accent) 85%, white);
  }
  .btn-ghost {
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-faint);
  }
  .btn-ghost:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }

  .drafter {
    border: 1px solid var(--color-accent-dim);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: var(--sp-3);
  }
  .drafter textarea {
    width: 100%;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: var(--sp-3); line-height: 1.5;
    resize: vertical;
  }
  .drafter textarea:focus { outline: none; border-color: var(--color-accent); }
  .drafter-foot {
    display: flex; justify-content: space-between; align-items: center;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .drafter-btns { display: flex; gap: 6px; }

  /* entries */
  .entries { padding: var(--sp-4) 0; }
  .entry {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: var(--sp-4);
    padding: var(--sp-4) 0;
  }
  .entry-gutter {
    display: flex; flex-direction: column; align-items: center;
    gap: 6px;
  }
  .entry-avatar {
    width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    font-family: var(--font-display); font-size: 16px;
    text-transform: lowercase;
    letter-spacing: -0.02em;
    box-shadow: 0 0 0 1px var(--color-border);
    overflow: hidden;
  }
  .entry-avatar-img { object-fit: cover; }
  .gb-loading, .gb-empty {
    padding: var(--sp-10) var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
    margin: var(--sp-4) 0;
  }
  .entry-line {
    flex: 1;
    width: 1px;
    background: var(--color-border);
  }
  .entry:last-child .entry-line { display: none; }

  .entry-body { padding-bottom: var(--sp-4); }
  .entry-hd {
    display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline;
  }
  .entry-name {
    font-family: var(--font-display);
    font-size: 18px; color: var(--color-fg);
    letter-spacing: -0.01em;
    text-decoration: none;
  }
  .entry-name:hover { color: var(--color-accent); }
  .entry-handle {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .entry-badge {
    font-family: var(--font-mono); font-size: 9px;
    color: var(--color-accent);
    padding: 1px 5px;
    border: 1px solid var(--color-accent-dim);
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  .entry-time {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-ghost); margin-left: auto;
  }
  .entry-text {
    color: var(--color-fg);
    font-size: var(--fs-md);
    line-height: 1.6;
    margin-top: 6px;
  }
  .entry-ft {
    display: flex; justify-content: space-between; gap: var(--sp-3);
    margin-top: 10px; padding-top: 8px;
    border-top: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
  }
  .entry-uri { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .entry-link { color: var(--color-accent); text-decoration: none; white-space: nowrap; }
  .entry-link:hover { text-decoration: underline; }

  /* lexicon block */
  .lex-block {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    overflow: hidden;
  }
  .lex-hd {
    display: flex; justify-content: space-between;
    padding: var(--sp-2) var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.14em;
  }
  .lex-pre {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    padding: var(--sp-4);
    margin: 0;
    overflow: auto;
    line-height: 1.55;
  }

  .gb-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-4);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .sig { text-align: center; padding-bottom: var(--sp-10); font-family: var(--font-mono); font-size: 10px; }

  @media (max-width: 760px) {
    .signin-card { grid-template-columns: 1fr; }
    .signin-actions { align-items: flex-start; }
  }
`;

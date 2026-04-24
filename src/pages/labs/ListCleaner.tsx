import { simpleFetchHandler, XRPC } from '@atcute/client';
import { AppBskyActorDefs, AppBskyGraphDefs } from '@atcute/client/lexicons';
import type { ActorIdentifier } from '@atcute/lexicons';
import { createAuthorizationUrl, deleteStoredSession, OAuthUserAgent } from '@atcute/oauth-browser-client';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import { useAtprotoSession } from '../../hooks/use-atproto-session';
import { useProfile } from '../../hooks/use-profile';
import { ensureOAuthConfigured, LISTBLOCK_DELETE_SCOPE, LISTBLOCK_SCOPE, sessionHasScope } from '../../lib/oauth';

type Phase = 'idle' | 'fetching-lists' | 'ready' | 'deleting' | 'error';

type Creator = AppBskyActorDefs.ProfileViewDetailed | AppBskyActorDefs.ProfileView | null;

type Entry = {
  uri: string;
  list: AppBskyGraphDefs.ListView | null;
  creator: Creator;
  rkey: string;
};

type ListblockRecord = {
  uri: string;
  cid: string;
  value: { $type: 'app.bsky.graph.listblock'; subject: string; createdAt: string };
};

// Public AppView — used for list lookups (app.bsky.graph.getList) so we
// don't need an authed call for read-only data about lists. Writes
// (deleteRecord) still go through the authed session's XRPC below.
const pubRpc = new XRPC({ handler: simpleFetchHandler({ service: 'https://public.api.bsky.app' }) });

export default function ListCleanerPage() {
  const { session, loading: sessionLoading, refresh } = useAtprotoSession();
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  const canDelete = sessionHasScope(session, LISTBLOCK_DELETE_SCOPE);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-lc">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">list-cleaner</span>
        </div>

        <header className="lc-hd">
          <h1>
            list cleaner<span className="dot">.</span>
          </h1>
          <p className="sub">
            sweep away dead moderation-list subscriptions from your bluesky account. finds every{' '}
            <code className="inline">app.bsky.graph.listblock</code> record you&apos;ve written, then pings{' '}
            <code className="inline">app.bsky.graph.getList</code> on each to see if the source still resolves. lists
            whose creator is deleted, deactivated, or took the list down are flagged — delete individually or in bulk.
          </p>
        </header>

        {sessionLoading ? (
          <div className="loading">checking session…</div>
        ) : !session || !canDelete ? (
          <SignInGate existingSession={!!session} onSignedIn={() => void refresh()} />
        ) : (
          <Cleaner session={session} profile={profile ?? null} onSignOut={() => void refresh()} />
        )}

        <footer className="lc-footer">
          <span>
            src: <span className="t-accent">atproto oauth · com.atproto.repo.listRecords · app.bsky.graph.getList</span>
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
        scope: LISTBLOCK_SCOPE,
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
      <div className="gate-title">sign in to clean up</div>
      <p className="gate-sub">
        {existingSession
          ? 'you\'re signed in, but this tab needs the listblock-delete scope. re-authorising grants only what\'s needed — other features you\'ve signed into stay intact.'
          : 'oauth sign-in via your handle. the redirect will ask for permission to delete your own app.bsky.graph.listblock records — nothing else.'}
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

// ─── cleaner (signed-in state) ─────────────────────────────────────────────

type MiniProfile = { did: string; handle: string; displayName?: string; avatar?: string };

function Cleaner({
  session,
  profile,
  onSignOut,
}: {
  session: { info: { sub: string } };
  profile: MiniProfile | null;
  onSignOut: () => void;
}) {
  const did = session.info.sub;
  const agent = useMemo(
    () => new OAuthUserAgent(session as unknown as ConstructorParameters<typeof OAuthUserAgent>[0]),
    [session],
  );
  const rpc = useMemo(() => new XRPC({ handler: agent }), [agent]);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [phase, setPhase] = useState<Phase>('fetching-lists');
  const [msg, setMsg] = useState('');
  const { confirm, dialog: confirmDialog } = useConfirm();

  async function signOut() {
    try {
      await agent.signOut();
    } catch {
      try { deleteStoredSession(did as Parameters<typeof deleteStoredSession>[0]); } catch { /* ignore */ }
    }
    onSignOut();
  }

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setPhase('fetching-lists');
      setMsg('');
      try {
        const res = await rpc.get('com.atproto.repo.listRecords', {
          params: { repo: did as ActorIdentifier, collection: 'app.bsky.graph.listblock', limit: 100 },
        });
        const records = (res.data as { records: ListblockRecord[] }).records
          .sort((a, b) => b.value.createdAt.localeCompare(a.value.createdAt));
        // dedupe by subject (list uri) — a user might re-subscribe and leave
        // two listblock records pointing at the same list; show each list
        // once.
        const seen = new Set<string>();
        const deduped = records.filter((r) => {
          if (seen.has(r.value.subject)) return false;
          seen.add(r.value.subject);
          return true;
        });

        const out: Entry[] = [];
        for (const rec of deduped) {
          if (cancelled) return;
          const rkey = rec.uri.split('/').pop() ?? '';
          try {
            // public AppView — no auth needed to look up a list's metadata.
            const { data } = await pubRpc.get('app.bsky.graph.getList', { params: { list: rec.value.subject } });
            out.push({ uri: rec.value.subject, list: data.list, creator: data.list.creator, rkey });
          } catch {
            // list deleted / source gone — try to look up the creator anyway
            // so we can still name the account the list used to belong to.
            const creatorDid = rec.value.subject.split('//').pop()?.split('/')[0] ?? '';
            let creator: Creator = null;
            try {
              const { data } = await pubRpc.get('app.bsky.actor.getProfile', { params: { actor: creatorDid } });
              creator = data;
            } catch {
              /* creator also gone */
            }
            out.push({ uri: rec.value.subject, list: null, creator, rkey });
          }
        }
        if (!cancelled) {
          setEntries(out);
          setPhase('ready');
        }
      } catch (err) {
        if (!cancelled) {
          setPhase('error');
          setMsg(err instanceof Error ? err.message : String(err));
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [rpc, did]);

  const removeOne = async (rkey: string) => {
    const entry = entries.find((e) => e.rkey === rkey);
    const label = entry?.list?.name ?? 'this deleted list';
    const ok = await confirm({
      title: 'unsubscribe?',
      body: (
        <>
          removes your <code style={{ color: 'var(--color-accent)' }}>app.bsky.graph.listblock</code> record for{' '}
          <b style={{ color: 'var(--color-fg)' }}>{label}</b>. this can&apos;t be undone from here — you&apos;d have to
          re-block the list on bluesky.
        </>
      ),
      confirmLabel: 'unsubscribe',
      variant: 'danger',
    });
    if (!ok) return;
    setPhase('deleting');
    setMsg('');
    try {
      await rpc.call('com.atproto.repo.deleteRecord', {
        data: { collection: 'app.bsky.graph.listblock', repo: did as ActorIdentifier, rkey },
      });
      setEntries((es) => es.filter((e) => e.rkey !== rkey));
      setPhase('ready');
    } catch (err) {
      setPhase('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const deadEntries = entries.filter((e) => !e.list);
  const removeAllDead = async () => {
    if (deadEntries.length === 0) return;
    const n = deadEntries.length;
    const ok = await confirm({
      title: `unsubscribe from ${n} dead list${n === 1 ? '' : 's'}?`,
      body: (
        <>
          deletes {n} <code style={{ color: 'var(--color-accent)' }}>app.bsky.graph.listblock</code> record
          {n === 1 ? '' : 's'} whose source list no longer resolves. will run sequentially and can&apos;t be undone
          from here.
        </>
      ),
      confirmLabel: `remove ${n}`,
      variant: 'danger',
    });
    if (!ok) return;
    setPhase('deleting');
    setMsg('');
    try {
      for (const entry of deadEntries) {
        await rpc.call('com.atproto.repo.deleteRecord', {
          data: { collection: 'app.bsky.graph.listblock', repo: did as ActorIdentifier, rkey: entry.rkey },
        });
      }
      setEntries((es) => es.filter((e) => e.list));
      setPhase('ready');
    } catch (err) {
      setPhase('error');
      setMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const busy = phase === 'fetching-lists' || phase === 'deleting';

  return (
    <>
      {confirmDialog}

      <section className="profile">
        {profile?.avatar ? (
          <img src={profile.avatar} alt="" className="profile-avatar" />
        ) : (
          <div className="profile-avatar empty-avatar" />
        )}
        <div className="profile-meta">
          <div className="profile-name">
            {profile?.displayName ?? profile?.handle ?? did}
            <span className="dot">.</span>
          </div>
          <div className="profile-handle">@{profile?.handle ?? did}</div>
        </div>
        <button type="button" className="logout" onClick={() => void signOut()}>
          sign out
        </button>
      </section>

      <div className="lc-meta">
        <span>
          listblocks <b>{entries.length}</b>
        </span>
        <span>
          dead <b className={deadEntries.length > 0 ? 't-warn' : ''}>{deadEntries.length}</b>
        </span>
        {deadEntries.length > 0 ? (
          <button type="button" className="bulk" onClick={() => void removeAllDead()} disabled={busy}>
            {phase === 'deleting' ? 'deleting…' : `remove all ${deadEntries.length} dead →`}
          </button>
        ) : null}
      </div>

      {phase === 'fetching-lists' && entries.length === 0 ? (
        <LoadingPanel label="scanning your listblocks…" />
      ) : entries.length === 0 ? (
        <section className="empty">
          <div className="empty-glyph" aria-hidden="true">◌</div>
          <div className="empty-ttl">no listblocks found</div>
          <div className="empty-sub">you haven&apos;t subscribed to any moderation lists.</div>
        </section>
      ) : (
        <section className="entries">
          {entries.map((entry) => (
            <EntryRow key={entry.rkey} entry={entry} onRemove={(rk) => void removeOne(rk)} busy={busy} />
          ))}
        </section>
      )}

      {msg ? (
        <section className={`status ${phase === 'error' ? 'is-error' : ''}`}>
          <div className="msg">{msg}</div>
        </section>
      ) : null}
    </>
  );
}

function EntryRow({ entry, onRemove, busy }: { entry: Entry; onRemove: (rkey: string) => void; busy: boolean }) {
  const dead = !entry.list;
  const creator = entry.creator ?? entry.list?.creator ?? null;
  const creatorName = creator?.displayName ?? creator?.handle ?? entry.uri.split('//').pop()?.split('/')[0] ?? 'unknown';
  const listName = entry.list?.name ?? 'list deleted';
  const desc = entry.list?.description ?? '';

  return (
    <article className={'entry' + (dead ? ' dead' : '')}>
      {creator?.avatar ? (
        <img src={creator.avatar} alt="" className="entry-avatar" />
      ) : (
        <div className="entry-avatar empty-avatar" />
      )}
      <div className="entry-meta">
        <div className="entry-hd">
          <span className="entry-name">{listName}</span>
          {dead ? <span className="entry-flag">dead</span> : null}
        </div>
        <div className="entry-by">
          moderation list by <b>{creatorName}</b>
          {creator?.handle ? <span className="t-faint"> @{creator.handle}</span> : null}
        </div>
        {desc ? <div className="entry-desc">{desc}</div> : null}
      </div>
      <button
        type="button"
        className="entry-rm"
        onClick={() => onRemove(entry.rkey)}
        disabled={busy}
        aria-label="remove"
        title="unsubscribe from this list"
      >
        ✕
      </button>
    </article>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <section className="prog">
      <div className="prog-line">
        <span className="prog-lbl">{label}</span>
      </div>
      <div className="prog-bar">
        <div className="prog-bar-indeterminate" />
      </div>
    </section>
  );
}

const CSS = `
  .shell-lc { max-width: 860px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .lc-hd { padding-bottom: var(--sp-5); border-bottom: 1px solid var(--color-border); }
  .lc-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 7vw, 84px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.95;
  }
  .lc-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .lc-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .lc-hd .sub .inline {
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
  .err { margin-top: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }

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

  /* profile bar (post-login) */
  .profile {
    margin-top: var(--sp-6);
    display: grid;
    grid-template-columns: 48px 1fr auto;
    gap: var(--sp-3);
    align-items: center;
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel));
  }
  .profile-avatar {
    width: 48px; height: 48px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-raised);
    object-fit: cover;
  }
  .profile-avatar.empty-avatar {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .profile-meta { min-width: 0; }
  .profile-name {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    line-height: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .profile-name .dot { color: var(--color-accent); text-shadow: 0 0 8px var(--accent-glow); }
  .profile-handle {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-top: 2px;
  }
  .logout {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: 4px 12px;
    cursor: pointer;
  }
  .logout:hover { color: var(--color-alert); border-color: var(--color-alert); }

  .lc-meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-5);
    padding-bottom: var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    align-items: center;
  }
  .lc-meta b { color: var(--color-fg); font-weight: 400; }
  .lc-meta .t-warn { color: var(--color-warn); }
  .bulk {
    margin-left: auto;
    border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    background: color-mix(in oklch, var(--color-warn) 8%, var(--color-bg-panel));
    color: var(--color-warn);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: 6px 14px;
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .bulk:hover:not(:disabled) { background: color-mix(in oklch, var(--color-warn) 16%, var(--color-bg-panel)); }
  .bulk:disabled { opacity: 0.5; cursor: not-allowed; }

  /* entries */
  .entries { display: flex; flex-direction: column; margin-top: var(--sp-3); }
  .entry {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    gap: var(--sp-3);
    padding: var(--sp-3) 0;
    border-bottom: 1px dashed var(--color-border);
    align-items: start;
  }
  .entry:last-child { border-bottom: 0; }
  .entry.dead { opacity: 0.75; }
  .entry-avatar {
    width: 40px; height: 40px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-raised);
    object-fit: cover;
    flex-shrink: 0;
  }
  .entry-avatar.empty-avatar {
    background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px);
  }
  .entry-meta { min-width: 0; }
  .entry-hd { display: flex; gap: var(--sp-2); align-items: baseline; flex-wrap: wrap; }
  .entry-name {
    color: var(--color-fg);
    font-size: var(--fs-md);
    line-height: 1.3;
    overflow-wrap: break-word;
    word-break: break-word;
  }
  .entry.dead .entry-name { color: var(--color-fg-dim); }
  .entry-flag {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-warn);
    border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border));
    padding: 1px 6px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .entry-by {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-top: 2px;
  }
  .entry-by b { color: var(--color-fg); font-weight: 400; }
  .entry-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.55;
    margin-top: 6px;
    white-space: pre-wrap;
    overflow-wrap: break-word;
  }
  .entry-rm {
    border: 1px solid var(--color-border-bright);
    background: transparent;
    color: var(--color-fg-dim);
    font: inherit;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: 4px 10px;
    cursor: pointer;
    align-self: start;
  }
  .entry-rm:hover:not(:disabled) { color: var(--color-alert); border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); }
  .entry-rm:disabled { opacity: 0.4; cursor: not-allowed; }

  /* progress / empty / error */
  .prog {
    margin-top: var(--sp-6);
    padding: var(--sp-4) var(--sp-5);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .prog-line { display: flex; justify-content: space-between; color: var(--color-fg-faint); margin-bottom: var(--sp-2); }
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

  .empty {
    margin-top: var(--sp-6);
    padding: var(--sp-10) var(--sp-6);
    border: 1px dashed var(--color-border-bright);
    text-align: center;
    font-family: var(--font-mono);
  }
  .empty-glyph { font-size: 40px; color: var(--color-accent-dim); margin-bottom: var(--sp-3); line-height: 1; }
  .empty-ttl { font-size: var(--fs-sm); color: var(--color-fg); margin-bottom: 4px; }
  .empty-sub { font-size: var(--fs-xs); color: var(--color-fg-faint); }

  .status {
    margin-top: var(--sp-4);
    padding: var(--sp-3) var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg);
  }
  .status.is-error { border-color: color-mix(in oklch, var(--color-alert) 40%, var(--color-border)); }
  .status.is-error .msg { color: var(--color-alert); }

  .lc-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;

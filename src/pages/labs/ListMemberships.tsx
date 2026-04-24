import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  bskyProfileWebUrl,
  fetchBacklinks,
  fetchProfile,
  pubRpc,
  resolveToDid,
  type ProfileView,
} from '../../lib/atproto-helpers';

type ListView = {
  uri: string;
  cid: string;
  name: string;
  purpose: string;
  description?: string;
  avatar?: string;
  creator: ProfileView;
  listItemCount?: number;
  indexedAt?: string;
};

type Membership = { rkey: string; list: ListView | null };

function listWebUrl(list: ListView): string {
  const rkey = list.uri.split('/').pop() ?? '';
  return `https://bsky.app/profile/${list.creator.did}/lists/${rkey}`;
}

const PURPOSE_LABEL: Record<string, string> = {
  'app.bsky.graph.defs#modlist': 'moderation list',
  'app.bsky.graph.defs#curatelist': 'curation list',
  'app.bsky.graph.defs#referencelist': 'reference list',
};

export default function ListMembershipsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? '');
  useEffect(() => { setInput(search.q ?? ''); }, [search.q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim().replace(/^@/, '');
    if (!q) return;
    navigate({ to: '/labs/list-memberships' as never, search: { q } as never });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-lm">
        <header className="page-hd">
          <div className="label">~/labs/list-memberships</div>
          <h1>list memberships<span className="dot">.</span></h1>
          <p className="sub">
            every public moderation / curation list that includes this account. queries
            constellation for <code className="inline">app.bsky.graph.listitem:subject</code>{' '}
            pointing at your did, hydrates each list via the appview. bluesky has no built-in way
            to see this.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="handle or did"
            aria-label="handle or did"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">check →</button>
        </form>

        {search.q ? <Results handle={search.q} /> : (
          <div className="empty">paste a handle above — e.g. your own — to see which lists include you.</div>
        )}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">constellation.microcosm.blue · public.api.bsky.app</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Results({ handle }: { handle: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setMemberships([]);
    setProfile(null);
    setErr('');
    (async () => {
      try {
        const did = await resolveToDid(handle);
        if (cancelled) return;
        if (!did) { setErr(`couldn't resolve @${handle} to a did`); setState('error'); return; }
        const prof = await fetchProfile(did);
        if (cancelled) return;
        setProfile(prof);

        const { records } = await fetchBacklinks(did, 'app.bsky.graph.listitem:subject', { limit: 100 });
        if (cancelled) return;
        if (records.length === 0) {
          setMemberships([]);
          setState('ready');
          return;
        }

        // each listitem's at-uri points at a list via the record's
        // `list` field. we need to fetch each listitem record to get the
        // list uri, THEN hydrate the list. two hops per membership.
        // skip the first hop + inline via getList directly on the
        // listitem's parent? actually — constellation's backlink is the
        // listitem itself (collection=app.bsky.graph.listitem). we don't
        // have the list uri without fetching the listitem record.
        // cheapest: getListItemRecord batch isn't a thing, so we fetch
        // each via the creator's pds public read endpoint.
        const listItemUris = records.map((r) => `at://${r.did}/${r.collection}/${r.rkey}`);
        // fetch the listitem records in parallel, then dedupe by list uri
        // (a user can appear on the same list once per listitem record).
        const listUris = await Promise.all(
          listItemUris.map(async (uri) => {
            try {
              const [, authority, collection, rkey] = uri.replace('at://', '').match(/^([^/]+)\/([^/]+)\/(.+)$/) ?? [];
              if (!authority || !collection || !rkey) return null;
              // public AppView's getRecord proxies to the author's pds
              const r = await pubRpc.get('com.atproto.repo.getRecord', {
                params: { repo: authority as `did:${string}:${string}`, collection, rkey },
              });
              const v = (r.data as unknown as { value?: { list?: string } }).value;
              return v?.list ?? null;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        const uniqueLists = [...new Set(listUris.filter((u): u is string => !!u))];

        // hydrate each list via bsky AppView getList — one call per list.
        const hydrated = await Promise.all(
          uniqueLists.map(async (listUri, i) => {
            try {
              const r = await pubRpc.get('app.bsky.graph.getList', { params: { list: listUri, limit: 1 } });
              const list = (r.data as unknown as { list: ListView }).list;
              return { rkey: String(i), list } satisfies Membership;
            } catch {
              return { rkey: String(i), list: null } satisfies Membership;
            }
          }),
        );
        if (cancelled) return;
        hydrated.sort((a, b) => (b.list?.listItemCount ?? 0) - (a.list?.listItemCount ?? 0));
        setMemberships(hydrated);
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  if (state === 'loading') return <div className="loading">resolving + querying constellation…</div>;
  if (state === 'error' || !profile) return <div className="err">{err || 'unknown error'}</div>;

  const modCount = memberships.filter((m) => m.list?.purpose === 'app.bsky.graph.defs#modlist').length;
  const curateCount = memberships.filter((m) => m.list?.purpose === 'app.bsky.graph.defs#curatelist').length;

  return (
    <>
      <section className="profile">
        {profile.avatar ? <img src={profile.avatar} alt="" className="profile-avatar" /> : <div className="profile-avatar empty" />}
        <div className="profile-meta">
          <div className="profile-name">{profile.displayName || profile.handle}</div>
          <div className="profile-handle">@{profile.handle}</div>
        </div>
      </section>
      <section className="stats">
        <div><span className="k">total lists</span><b>{memberships.length}</b></div>
        <div><span className="k">moderation</span><b>{modCount}</b></div>
        <div><span className="k">curation</span><b>{curateCount}</b></div>
      </section>
      {memberships.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>
          no public list memberships indexed. you might be on private lists (not visible) or the
          indexer hasn&apos;t seen them — constellation backfill covers ~the last 22 days.
        </div>
      ) : (
        <ul className="lists">
          {memberships.map((m, i) => (
            m.list ? (
              <li key={i} className="l-item">
                <a href={listWebUrl(m.list)} target="_blank" rel="noopener noreferrer" className="l-link">
                  {m.list.avatar ? <img src={m.list.avatar} alt="" className="l-avatar" /> : <div className="l-avatar empty" />}
                  <div className="l-body">
                    <div className="l-hd">
                      <b>{m.list.name || '(unnamed)'}</b>
                      <span className={'l-pill ' + (m.list.purpose === 'app.bsky.graph.defs#modlist' ? 'mod' : 'curate')}>
                        {PURPOSE_LABEL[m.list.purpose] ?? m.list.purpose.replace('app.bsky.graph.defs#', '')}
                      </span>
                    </div>
                    <div className="l-by">
                      by <a href={bskyProfileWebUrl(m.list.creator.did)} className="l-by-link" target="_blank" rel="noopener noreferrer">
                        {m.list.creator.displayName || `@${m.list.creator.handle}`}
                      </a>
                      <span className="t-faint"> · {m.list.listItemCount ?? '?'} members</span>
                    </div>
                    {m.list.description ? <div className="l-desc">{m.list.description}</div> : null}
                  </div>
                </a>
              </li>
            ) : null
          ))}
        </ul>
      )}
    </>
  );
}

const CSS = `
  .shell-lm { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(48px, 8vw, 96px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .empty, .loading, .err { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; }
  .empty { border: 1px dashed var(--color-border); color: var(--color-fg-faint); text-align: center; }
  .loading { border: 1px solid var(--color-border); background: var(--color-bg-panel); color: var(--color-fg-dim); }
  .err { border: 1px solid var(--color-alert); color: var(--color-alert); }

  .profile { margin-top: var(--sp-5); display: grid; grid-template-columns: 48px 1fr; gap: var(--sp-3); align-items: center; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel)); }
  .profile-avatar { width: 48px; height: 48px; border: 1px solid var(--color-border-bright); background: var(--color-bg-raised); object-fit: cover; }
  .profile-avatar.empty { background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .profile-name { font-family: var(--font-display); font-size: 20px; color: var(--color-fg); letter-spacing: -0.01em; line-height: 1.1; }
  .profile-handle { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: 2px; }

  .stats { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .stats .k { color: var(--color-fg-faint); display: block; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
  .stats b { color: var(--color-fg); font-size: var(--fs-md); font-weight: 400; font-variant-numeric: tabular-nums; }

  .lists { list-style: none; margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .l-item { border-bottom: 1px dashed var(--color-border); }
  .l-item:last-child { border-bottom: 0; }
  .l-link { display: grid; grid-template-columns: 40px 1fr; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); text-decoration: none; color: inherit; transition: background 0.1s ease-out; }
  .l-link:hover { text-decoration: none; background: color-mix(in oklch, var(--color-accent) 5%, transparent); }
  .l-link:hover .l-hd b { color: var(--color-accent); }
  .l-avatar { width: 40px; height: 40px; border: 1px solid var(--color-border); background: var(--color-bg); object-fit: cover; }
  .l-avatar.empty { background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .l-body { min-width: 0; }
  .l-hd { display: flex; gap: var(--sp-2); align-items: baseline; flex-wrap: wrap; font-family: var(--font-mono); font-size: var(--fs-sm); }
  .l-hd b { color: var(--color-fg); font-weight: 400; }
  .l-pill { padding: 1px 6px; border: 1px solid var(--color-border-bright); font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; }
  .l-pill.mod { color: var(--color-warn); border-color: color-mix(in oklch, var(--color-warn) 40%, var(--color-border-bright)); }
  .l-pill.curate { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .l-by { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: 2px; }
  .l-by-link { color: var(--color-fg-dim); text-decoration: none; }
  .l-by-link:hover { color: var(--color-accent); }
  .l-by .t-faint { color: var(--color-fg-ghost); }
  .l-desc { margin-top: 6px; color: var(--color-fg-dim); font-size: var(--fs-xs); line-height: 1.55; white-space: pre-wrap; overflow-wrap: break-word; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;

import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  bskyProfileWebUrl,
  fetchProfile,
  fetchProfiles,
  pubRpc,
  queryLabelerForSubject,
  resolveLabeler,
  resolveToDid,
  type LabelFromLabeler,
  type ProfileView,
} from '../../lib/atproto-helpers';

/**
 * Well-known community labelers we query in addition to whatever the
 * public appview already surfaces. Users can add/remove via the input —
 * the list is persisted into the url so shares preserve the scan.
 *
 * Curation: moderation-oriented labelers only. novelty / tagging
 * labelers (sorting hat, eras, shiny posts, etc.) are intentionally
 * excluded — people land on this lab to investigate moderation state,
 * not to collect fursonas. users can still add any labeler by hand.
 *
 * Requests go out in parallel, so total latency is max() not sum(),
 * but each entry costs one plc.directory + one ozone roundtrip per
 * check, so 8 is a reasonable ceiling for "defaults".
 *
 * Source list: github.com/mary-ext/bluesky-labeler-scraping
 */
const DEFAULT_EXTRA_LABELERS = [
  'skywatch.blue',                 // general moderation / inauthentic behavior
  'xblock.aendra.dev',             // twitter / x screenshot labeller
  'laelaps.fyi',                   // anti-zoophilia
  'moderation.blacksky.app',       // blacksky community moderation
  'asukafield.xyz',                // anti-transphobia
  'profile-labels.bossett.social', // automatic profile-based labels
  'stechlab-labels.bsky.social',   // cornell tech account-activity context
  'perisai.bsky.social',           // indonesian-language moderation
];

/**
 * atproto labels are emitted by labelers via their ozone service, not
 * stored in repos. The public appview surfaces labels only from the
 * labelers *it* subscribes to — so community labelers (e.g. skywatch)
 * are invisible unless we query each labeler's ozone directly.
 *
 * This lab:
 *  1. pulls the "default" label set from getProfile / getPosts
 *  2. also asks each extra labeler (url-persisted) for labels on the
 *     same subject in parallel, via com.atproto.label.queryLabels
 *  3. merges both and shows which labeler emitted each label.
 */

type Label = {
  src: string;       // DID of the labeler
  uri: string;       // subject URI
  val: string;       // label value, e.g. 'porn', 'spam', 'suspect-inauthentic'
  cts: string;       // ISO timestamp
  neg?: boolean;
  ver?: number;
  cid?: string;
};

type SubjectKind = 'did' | 'post' | 'unknown';

function detect(raw: string): { kind: SubjectKind; value: string } {
  const s = raw.trim().replace(/^@/, '');
  if (!s) return { kind: 'unknown', value: '' };
  if (s.startsWith('did:')) return { kind: 'did', value: s };
  if (s.startsWith('at://')) {
    const parts = s.slice(5).split('/');
    if (parts[1] === 'app.bsky.feed.post') return { kind: 'post', value: s };
  }
  const m = /^https?:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(s);
  if (m && m[1].startsWith('did:')) return { kind: 'post', value: `at://${m[1]}/app.bsky.feed.post/${m[2]}` };
  return { kind: 'did', value: s };
}

function parseLabelersParam(s: string | undefined): string[] {
  if (!s) return DEFAULT_EXTRA_LABELERS;
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

function serializeLabelers(list: string[]): string | undefined {
  const cleaned = list.map((x) => x.trim()).filter(Boolean);
  if (cleaned.length === 0) return undefined;
  // omit the param when it exactly matches the default, so shareable urls
  // stay clean for the common case.
  const same = cleaned.length === DEFAULT_EXTRA_LABELERS.length
    && cleaned.every((x, i) => x === DEFAULT_EXTRA_LABELERS[i]);
  return same ? undefined : cleaned.join(',');
}

export default function LabelsPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string; labelers?: string };
  const [input, setInput] = useState(search.q ?? '');
  useEffect(() => { setInput(search.q ?? ''); }, [search.q]);

  const labelerList = useMemo(() => parseLabelersParam(search.labelers), [search.labelers]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    navigate({
      to: '/labs/labels' as never,
      search: { q, labelers: search.labelers } as never,
    });
  };

  const updateLabelers = (next: string[]) => {
    navigate({
      to: '/labs/labels' as never,
      search: { q: search.q, labelers: serializeLabelers(next) } as never,
    });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-lab">
        <header className="page-hd">
          <div className="label">~/labs/labels</div>
          <h1>labels<span className="dot">.</span></h1>
          <p className="sub">
            every moderation label applied to an account or post, with the labeler that emitted it.
            the public appview only surfaces labels from labelers <em>it</em> subscribes to — so
            community labelers like <code className="inline">skywatch.blue</code> stay invisible unless
            we ask them directly. this lab queries <code className="inline">app.bsky.actor.getProfile</code>{' '}
            / <code className="inline">app.bsky.feed.getPosts</code> <em>and</em> each extra
            labeler&apos;s <code className="inline">com.atproto.label.queryLabels</code> in parallel,
            then merges.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="handle, did, or post at-uri / bsky url"
            aria-label="subject"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">check →</button>
        </form>

        <LabelerList list={labelerList} onChange={updateLabelers} />

        {search.q ? <Results raw={search.q} labelerList={labelerList} /> : (
          <div className="empty">
            paste a handle (for account labels) or a post uri (for post labels).
          </div>
        )}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">public.api.bsky.app</span> + ozone</span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function LabelerList({ list, onChange }: { list: string[]; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = adding.trim().replace(/^@/, '');
    if (!v) return;
    if (list.includes(v)) { setAdding(''); return; }
    onChange([...list, v]);
    setAdding('');
  };
  const remove = (h: string) => onChange(list.filter((x) => x !== h));
  return (
    <section className="labelers">
      <div className="lab-hd">
        <span className="lab-hd-title">labelers queried</span>
        <span className="lab-hd-hint">default labeler (bsky) is always included via getProfile/getPosts</span>
      </div>
      <div className="lab-chips">
        {list.map((h) => (
          <span key={h} className="chip">
            <span>{h}</span>
            <button type="button" className="chip-x" aria-label={`remove ${h}`} onClick={() => remove(h)}>×</button>
          </span>
        ))}
        {list.length === 0 ? <span className="chip-empty">none — only the default labeler will be queried</span> : null}
      </div>
      <form className="lab-add" onSubmit={submit}>
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="add labeler handle or did (e.g. skywatch.blue)"
          aria-label="add labeler"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit">+ add</button>
      </form>
    </section>
  );
}

type ResolvedLabeler = { did: string; handle: string; endpoint: string };

// Per-labeler streaming state. Each row transitions:
//   resolving → (querying → done) | unresolved
// The UI renders all rows continuously; the merged label list reads
// only from rows with `labels !== null`. Decoupling resolve/query
// means a slow or dead labeler never blocks faster ones.
type LabelerRow = {
  input: string;
  state: 'resolving' | 'querying' | 'done' | 'unresolved';
  resolved: ResolvedLabeler | null;
  labels: LabelFromLabeler[] | null;
};

function Results({ raw, labelerList }: { raw: string; labelerList: string[] }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [defaultLabels, setDefaultLabels] = useState<Label[]>([]);
  const [rows, setRows] = useState<LabelerRow[]>([]);
  const [subjectProfile, setSubjectProfile] = useState<ProfileView | null>(null);
  const [subjectUri, setSubjectUri] = useState<string>('');
  const [labelerProfiles, setLabelerProfiles] = useState<Map<string, ProfileView>>(new Map());
  const [subjectKind, setSubjectKind] = useState<SubjectKind>('unknown');
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setDefaultLabels([]);
    setRows(labelerList.map((h) => ({ input: h, state: 'resolving', resolved: null, labels: null })));
    setLabelerProfiles(new Map());
    setErr('');
    (async () => {
      try {
        const { kind, value } = detect(raw);
        if (cancelled) return;
        setSubjectKind(kind);

        let subject = '';
        let fetched: Label[] = [];
        if (kind === 'post') {
          const r = await pubRpc.get('app.bsky.feed.getPosts', { params: { uris: [value] } });
          const posts = (r.data as unknown as { posts: Array<{ uri: string; author: ProfileView; labels?: Label[] }> }).posts ?? [];
          if (cancelled) return;
          const post = posts[0];
          if (!post) { setErr('post not found'); setState('error'); return; }
          setSubjectProfile(post.author);
          subject = post.uri;
          fetched = post.labels ?? [];
        } else {
          const did = await resolveToDid(value);
          if (cancelled) return;
          if (!did) { setErr(`couldn't resolve "${value}"`); setState('error'); return; }
          const prof = await fetchProfile(did);
          if (cancelled) return;
          if (!prof) { setErr(`couldn't fetch profile for ${did}`); setState('error'); return; }
          setSubjectProfile(prof);
          subject = did;
          fetched = (prof as unknown as { labels?: Label[] }).labels ?? [];
        }
        setSubjectUri(subject);
        setDefaultLabels(fetched);

        // appview labels are in — flip to 'ready' so the subject card +
        // default labels paint now. extra labelers stream in after.
        setState('ready');

        // hydrate default-label labeler profiles immediately (they're
        // typically just moderation.bsky.app).
        if (fetched.length > 0) {
          const dids = [...new Set(fetched.map((l) => l.src))];
          fetchProfiles(dids).then((profiles) => {
            if (cancelled) return;
            setLabelerProfiles((prev) => {
              const next = new Map(prev);
              for (const [k, v] of profiles) next.set(k, v);
              return next;
            });
          });
        }

        // fire each labeler as an independent chain so the slow / dead
        // ones never block the others. state updates progressively.
        for (const h of labelerList) {
          void (async () => {
            const resolved = await resolveLabeler(h);
            if (cancelled) return;
            if (!resolved) {
              setRows((prev) => prev.map((r) => r.input === h ? { ...r, state: 'unresolved' } : r));
              return;
            }
            setRows((prev) => prev.map((r) => r.input === h ? { ...r, state: 'querying', resolved } : r));
            // seed the labeler's own profile from resolveLabeler (we
            // already know did + handle) so the "by @x" link renders
            // immediately once labels arrive, without a round-trip.
            setLabelerProfiles((prev) => {
              if (prev.has(resolved.did)) return prev;
              const next = new Map(prev);
              next.set(resolved.did, { did: resolved.did, handle: resolved.handle });
              return next;
            });
            const labels = await queryLabelerForSubject(resolved.endpoint, subject);
            if (cancelled) return;
            setRows((prev) => prev.map((r) => r.input === h ? { ...r, state: 'done', labels } : r));
          })();
        }
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [raw, labelerList]);

  // merged, deduped, newest-first view. dedupe key is (src, val, uri)
  // — when the default appview already surfaced a label we don't want
  // it re-appearing from the direct ozone query.
  const merged = useMemo(() => {
    type Row = Label & { via: 'appview' | 'direct' };
    const seen = new Map<string, Row>();
    for (const l of defaultLabels) {
      const k = `${l.src}::${l.val}::${l.uri}`;
      if (!seen.has(k)) seen.set(k, { ...l, via: 'appview' });
    }
    for (const r of rows) {
      if (!r.labels) continue;
      for (const l of r.labels) {
        const row: Row = {
          src: l.src,
          uri: l.uri,
          val: l.val,
          cts: l.cts,
          neg: l.neg,
          ver: l.ver,
          cid: l.cid,
          via: 'direct',
        };
        const k = `${row.src}::${row.val}::${row.uri}`;
        if (!seen.has(k)) seen.set(k, row);
      }
    }
    return [...seen.values()].sort((a, b) => (b.cts ?? '').localeCompare(a.cts ?? ''));
  }, [defaultLabels, rows]);

  if (state === 'loading') return <div className="loading">fetching appview…</div>;
  if (state === 'error') return <div className="err">{err}</div>;

  const unresolved = rows.filter((r) => r.state === 'unresolved').map((r) => r.input);
  const pending = rows.some((r) => r.state === 'resolving' || r.state === 'querying');
  const directHit = rows.some((r) => r.labels && r.labels.length > 0);

  return (
    <>
      {subjectProfile ? (
        <section className="subject">
          {subjectProfile.avatar ? <img src={subjectProfile.avatar} alt="" className="s-avatar" /> : <div className="s-avatar empty" />}
          <div className="s-body">
            <div className="s-kind">{subjectKind === 'post' ? 'post by' : 'account'}</div>
            <div className="s-name">{subjectProfile.displayName || subjectProfile.handle}</div>
            <div className="s-handle">@{subjectProfile.handle}</div>
          </div>
          <div className="s-count">
            <b>{merged.length}</b>
            <span className="t-faint">label{merged.length === 1 ? '' : 's'}</span>
          </div>
        </section>
      ) : null}

      {unresolved.length > 0 ? (
        <div className="warn">
          couldn&apos;t resolve labeler{unresolved.length === 1 ? '' : 's'}:{' '}
          {unresolved.map((h, i) => (
            <span key={h}>
              <code className="inline">{h}</code>{i < unresolved.length - 1 ? ', ' : ''}
            </span>
          ))}
          {' '}— not a labeler identity, or no{' '}
          <code className="inline">#atproto_labeler</code> service in the did doc.
        </div>
      ) : null}

      {/* per-labeler status: streams as each labeler resolves + replies.
          distinguishes "not queried yet" (·) from "queried, clean" (0)
          from "has labels" (N). */}
      {rows.length > 0 ? (
        <section className="checked">
          <div className="checked-hd">
            queried labelers {pending ? <span className="t-faint">· streaming…</span> : null}
          </div>
          <ul className="checked-list">
            {rows.map((r) => {
              const name = r.resolved ? `@${r.resolved.handle}` : r.input;
              const count = r.labels?.length ?? null;
              return (
                <li key={r.input}>
                  <span className={'row-state ' + r.state}>
                    {r.state === 'resolving' ? '○' : r.state === 'querying' ? '◐' : r.state === 'done' ? '●' : '✕'}
                  </span>
                  {r.resolved ? (
                    <a href={bskyProfileWebUrl(r.resolved.did)} target="_blank" rel="noopener noreferrer" className="l-by-link">
                      {name}
                    </a>
                  ) : (
                    <span className="mono-break">{name}</span>
                  )}
                  {' — '}
                  {r.state === 'resolving' ? <span className="t-faint">resolving…</span>
                    : r.state === 'querying' ? <span className="t-faint">querying ozone…</span>
                    : r.state === 'unresolved' ? <span className="t-alert">not a labeler</span>
                    : count === 0 ? <span className="t-faint">0 labels</span>
                    : <span className="t-accent">{count} label{count === 1 ? '' : 's'}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {merged.length === 0 && !pending ? (
        <div className="empty" style={{ marginTop: 20 }}>
          no labels from the default appview or any queried labeler
          {subjectUri ? <><br /><span className="mono-break">{subjectUri}</span></> : null}
        </div>
      ) : merged.length === 0 ? null : (
        <ul className="labels">
          {merged.map((l, i) => {
            const labeler = labelerProfiles.get(l.src);
            return (
              <li key={i} className={'l-item' + (l.neg ? ' l-neg' : '')}>
                <div className="l-val-row">
                  <span className={'l-val' + (l.neg ? ' neg' : '')}>{l.val}</span>
                  {l.neg ? <span className="l-neg-badge">negated</span> : null}
                  <span className={'l-via ' + (l.via === 'direct' ? 'direct' : 'appview')}>
                    {l.via === 'direct' ? 'direct' : 'appview'}
                  </span>
                  {l.cts ? <span className="l-when">{l.cts.slice(0, 10)}</span> : null}
                </div>
                <div className="l-by">
                  by{' '}
                  {labeler ? (
                    <a href={bskyProfileWebUrl(labeler.did)} target="_blank" rel="noopener noreferrer" className="l-by-link">
                      {labeler.displayName || `@${labeler.handle}`}
                    </a>
                  ) : (
                    <span className="mono-break">{l.src}</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!directHit && !pending && rows.length > 0 && merged.length === defaultLabels.length ? (
        <div className="hint">
          tip: if you expect a label from a community labeler, make sure it&apos;s in the list above.
          you can find labeler handles via{' '}
          <a href="https://github.com/mary-ext/bluesky-labeler-scraping" target="_blank" rel="noopener noreferrer" className="t-accent">
            mary-ext/bluesky-labeler-scraping
          </a>
          .
        </div>
      ) : null}
    </>
  );
}

const CSS = `
  .shell-lab { max-width: 840px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .labelers { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); }
  .lab-hd { display: flex; justify-content: space-between; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .lab-hd-title { color: var(--color-fg-dim); text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; }
  .lab-hd-hint { color: var(--color-fg-faint); font-size: 10px; }
  .lab-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: var(--sp-2) 0; }
  .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--color-border-bright); background: var(--color-bg-raised); padding: 3px 8px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg); }
  .chip-x { background: transparent; border: 0; color: var(--color-fg-faint); cursor: pointer; padding: 0 2px; font-size: 14px; line-height: 1; }
  .chip-x:hover { color: var(--color-alert); }
  .chip-empty { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); padding: 4px 0; }
  .lab-add { display: flex; gap: 6px; }
  .lab-add input { flex: 1; background: var(--color-bg); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-xs); padding: 6px 8px; outline: 0; }
  .lab-add input:focus { border-color: var(--color-accent-dim); }
  .lab-add button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 0 10px; font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .lab-add button:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .empty, .loading, .err, .hint, .warn { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; }
  .empty { border: 1px dashed var(--color-border); color: var(--color-fg-faint); text-align: center; }
  .loading { border: 1px solid var(--color-border); background: var(--color-bg-panel); color: var(--color-fg-dim); }
  .err { border: 1px solid var(--color-alert); color: var(--color-alert); }
  .warn { border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); color: var(--color-warn); background: color-mix(in oklch, var(--color-warn) 4%, var(--color-bg-panel)); }
  .hint { border: 1px dashed var(--color-border); color: var(--color-fg-faint); }

  .subject { margin-top: var(--sp-5); display: grid; grid-template-columns: 48px 1fr auto; gap: var(--sp-3); align-items: center; padding: var(--sp-3) var(--sp-4); border: 1px solid var(--color-accent-dim); background: color-mix(in oklch, var(--color-accent) 4%, var(--color-bg-panel)); }
  .s-avatar { width: 48px; height: 48px; border: 1px solid var(--color-border-bright); background: var(--color-bg-raised); object-fit: cover; }
  .s-avatar.empty { background-image: repeating-linear-gradient(45deg, var(--color-border) 0 4px, transparent 4px 8px); }
  .s-kind { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; }
  .s-name { font-family: var(--font-display); font-size: 20px; color: var(--color-fg); letter-spacing: -0.01em; line-height: 1.1; margin-top: 2px; }
  .s-handle { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-top: 2px; }
  .s-count { text-align: right; font-family: var(--font-mono); }
  .s-count b { display: block; font-size: 24px; color: var(--color-accent); font-weight: 400; font-variant-numeric: tabular-nums; }
  .s-count .t-faint { font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; }

  .checked { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); padding: var(--sp-3) var(--sp-4); }
  .checked-hd { font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-dim); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
  .checked-list { list-style: none; display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .row-state { display: inline-block; width: 14px; color: var(--color-fg-faint); margin-right: 6px; font-size: 10px; }
  .row-state.resolving, .row-state.querying { color: var(--color-accent); animation: pulse 1.2s ease-in-out infinite; }
  .row-state.done { color: var(--color-accent); }
  .row-state.unresolved { color: var(--color-alert); }
  .t-alert { color: var(--color-alert); }
  @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

  .labels { list-style: none; margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .l-item { padding: var(--sp-3) var(--sp-4); border-bottom: 1px dashed var(--color-border); }
  .l-item:last-child { border-bottom: 0; }
  .l-item.l-neg { opacity: 0.7; }
  .l-val-row { display: flex; gap: var(--sp-2); align-items: center; flex-wrap: wrap; font-family: var(--font-mono); }
  .l-val { font-size: var(--fs-sm); color: var(--color-warn); border: 1px solid color-mix(in oklch, var(--color-warn) 40%, var(--color-border)); padding: 2px 10px; letter-spacing: 0.04em; }
  .l-val.neg { color: var(--color-fg-faint); border-color: var(--color-border); text-decoration: line-through; }
  .l-neg-badge { font-size: 10px; color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.1em; }
  .l-via { font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 6px; border: 1px solid var(--color-border); color: var(--color-fg-faint); }
  .l-via.direct { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .l-when { font-size: var(--fs-xs); color: var(--color-fg-faint); margin-left: auto; }
  .l-by { margin-top: 6px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .l-by-link { color: var(--color-fg-dim); text-decoration: none; }
  .l-by-link:hover { color: var(--color-accent); }
  .mono-break { word-break: break-all; color: var(--color-fg-ghost); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-8); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;

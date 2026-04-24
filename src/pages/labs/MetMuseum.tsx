import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * Met Museum's open collection API — no key, permissive CORS, 470k
 * objects with public-domain images. Search returns just object IDs;
 * details are a separate per-object call, so we lazily hydrate a page
 * at a time.
 *
 * Default landing view is the `isHighlight=true` set — the Met's own
 * curated marquee pieces.
 */

const API = 'https://collectionapi.metmuseum.org/public/collection/v1';
const PAGE = 24;

type Obj = {
  objectID: number;
  title: string;
  artistDisplayName?: string;
  artistDisplayBio?: string;
  objectDate?: string;
  medium?: string;
  culture?: string;
  department?: string;
  classification?: string;
  dimensions?: string;
  creditLine?: string;
  primaryImage?: string;
  primaryImageSmall?: string;
  objectURL?: string;
  isPublicDomain?: boolean;
  repository?: string;
};

async function searchIds(q: string): Promise<number[]> {
  const url = new URL(`${API}/search`);
  url.searchParams.set('hasImages', 'true');
  if (q.trim()) {
    url.searchParams.set('q', q.trim());
  } else {
    url.searchParams.set('isHighlight', 'true');
    url.searchParams.set('q', '*');
  }
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  const j = (await r.json()) as { objectIDs: number[] | null };
  return j.objectIDs ?? [];
}

async function fetchObject(id: number): Promise<Obj | null> {
  try {
    const r = await fetch(`${API}/objects/${id}`);
    if (!r.ok) return null;
    return (await r.json()) as Obj;
  } catch {
    return null;
  }
}

export default function MetMuseumPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const q = search.q ?? '';
  const [input, setInput] = useState(q);
  useEffect(() => { setInput(q); }, [q]);

  const [ids, setIds] = useState<number[]>([]);
  const [items, setItems] = useState<Obj[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<Obj | null>(null);

  // reset + search when query changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    setIds([]);
    setItems([]);
    setPage(0);
    (async () => {
      try {
        const found = await searchIds(q);
        if (cancelled) return;
        setIds(found);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [q]);

  // hydrate the current page
  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    const start = page * PAGE;
    const slice = ids.slice(start, start + PAGE);
    (async () => {
      const hydrated = await Promise.all(slice.map(fetchObject));
      if (cancelled) return;
      // only keep ones with at least a small image
      const usable = hydrated.filter((o): o is Obj => !!o && !!o.primaryImageSmall);
      setItems((prev) => [...prev, ...usable]);
    })();
    return () => { cancelled = true; };
  }, [ids, page]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: '/labs/met-museum' as never, search: { q: input.trim() || undefined } as never });
  };

  const pickRandom = () => {
    if (ids.length === 0) return;
    const randId = ids[Math.floor(Math.random() * ids.length)];
    fetchObject(randId).then((o) => o && setSelected(o));
  };

  const total = ids.length;
  const shown = items.length;
  const hasMore = page * PAGE + PAGE < ids.length;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-met">
        <header className="page-hd">
          <div className="label">~/labs/met-museum</div>
          <h1>met museum<span className="dot">.</span></h1>
          <p className="sub">
            470,000 objects from the metropolitan museum of art, new york. search by artist, medium, culture,
            or period — images are public domain where marked. data from the
            {' '}<code className="inline">metmuseum.github.io</code> open access api, no key.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. van gogh · ukiyo-e · silver · egypt · picasso"
            aria-label="search"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">search →</button>
          <button type="button" onClick={pickRandom} title="random object" disabled={ids.length === 0}>⚄</button>
        </form>

        {err ? <div className="err">{err}</div> : null}
        {loading ? <div className="loading">searching…</div> : null}

        {!loading && !err ? (
          <div className="meta">
            {q ? <>results for <b>{q}</b></> : <>curated highlights</>}
            <span className="t-faint"> · {total.toLocaleString()} object{total === 1 ? '' : 's'}{shown > 0 ? ` · showing ${shown}` : ''}</span>
          </div>
        ) : null}

        <section className="grid">
          {items.map((o) => (
            <button
              key={o.objectID}
              type="button"
              className="card"
              onClick={() => setSelected(o)}
              aria-label={`view ${o.title || 'untitled'}`}
            >
              <img src={o.primaryImageSmall} alt="" loading="lazy" />
              <div className="card-meta">
                <div className="c-title" title={o.title}>{o.title || 'untitled'}</div>
                <div className="c-artist" title={o.artistDisplayName}>{o.artistDisplayName || o.culture || '—'}</div>
                <div className="c-date">{o.objectDate || ''}</div>
              </div>
            </button>
          ))}
        </section>

        {hasMore ? (
          <div className="more">
            <button type="button" onClick={() => setPage((p) => p + 1)}>load more ↓</button>
          </div>
        ) : null}

        {!loading && shown === 0 && total === 0 && !err ? (
          <div className="empty">nothing found. try a simpler term, a medium (silver, marble, oil), or a culture (greek, persian, nigerian).</div>
        ) : null}

        {selected ? <Detail obj={selected} onClose={() => setSelected(null)} /> : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">collectionapi.metmuseum.org</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Detail({ obj, onClose }: { obj: Obj; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const fields: Array<[string, string | undefined]> = [
    ['artist', obj.artistDisplayName],
    ['bio', obj.artistDisplayBio],
    ['date', obj.objectDate],
    ['medium', obj.medium],
    ['culture', obj.culture],
    ['classification', obj.classification],
    ['department', obj.department],
    ['dimensions', obj.dimensions],
    ['credit', obj.creditLine],
  ];
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={obj.title} onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" type="button" onClick={onClose} aria-label="close">×</button>
        {obj.primaryImage ? (
          <img src={obj.primaryImage} alt={obj.title} className="modal-img" />
        ) : obj.primaryImageSmall ? (
          <img src={obj.primaryImageSmall} alt={obj.title} className="modal-img" />
        ) : null}
        <div className="modal-info">
          <div className="m-title">{obj.title || 'untitled'}</div>
          <dl className="m-fields">
            {fields.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="m-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {obj.objectURL ? (
            <a href={obj.objectURL} target="_blank" rel="noopener noreferrer" className="m-link">
              view on metmuseum.org →
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .shell-met { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
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
  .inp button[disabled] { opacity: 0.4; cursor: not-allowed; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .inp button[type=button] { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 0 var(--sp-3); font-size: var(--fs-md); }
  .inp button[type=button]:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .meta { margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .loading, .err, .empty { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; border: 1px solid var(--color-border); background: var(--color-bg-panel); color: var(--color-fg-dim); }
  .err { border-color: var(--color-alert); color: var(--color-alert); }
  .empty { border-style: dashed; text-align: center; color: var(--color-fg-faint); }

  .grid { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--sp-3); }
  .card { text-align: left; padding: 0; border: 1px solid var(--color-border); background: var(--color-bg-panel); cursor: pointer; display: flex; flex-direction: column; color: inherit; transition: border-color 120ms ease; overflow: hidden; }
  .card:hover { border-color: var(--color-accent-dim); }
  .card:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .card img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; background: var(--color-bg-raised); display: block; }
  .card-meta { padding: var(--sp-2) var(--sp-3); font-family: var(--font-mono); font-size: 11px; display: flex; flex-direction: column; gap: 2px; }
  .c-title { color: var(--color-fg); font-size: var(--fs-xs); font-family: var(--font-display); letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .c-artist { color: var(--color-fg-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .c-date { color: var(--color-fg-faint); font-size: 10px; }

  .more { margin-top: var(--sp-5); display: flex; justify-content: center; }
  .more button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 10px var(--sp-5); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .more button:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .modal { position: fixed; inset: 0; background: color-mix(in oklch, black 80%, transparent); z-index: 60; display: flex; align-items: center; justify-content: center; padding: var(--sp-4); overflow: auto; }
  .modal-body { background: var(--color-bg); border: 1px solid var(--color-accent-dim); max-width: 960px; width: 100%; max-height: 92vh; overflow: auto; position: relative; display: grid; grid-template-columns: 1fr 320px; }
  @media (max-width: 720px) { .modal-body { grid-template-columns: 1fr; } }
  .modal-x { position: absolute; top: 8px; right: 12px; background: transparent; border: 0; color: var(--color-fg-faint); font-size: 28px; cursor: pointer; z-index: 2; line-height: 1; }
  .modal-x:hover { color: var(--color-accent); }
  .modal-img { width: 100%; height: 100%; object-fit: contain; background: var(--color-bg); max-height: 92vh; }
  .modal-info { padding: var(--sp-5) var(--sp-4); border-left: 1px solid var(--color-border); overflow: auto; }
  @media (max-width: 720px) { .modal-info { border-left: 0; border-top: 1px solid var(--color-border); } }
  .m-title { font-family: var(--font-display); font-size: var(--fs-lg); color: var(--color-fg); letter-spacing: -0.01em; line-height: 1.2; margin-bottom: var(--sp-3); }
  .m-fields { display: flex; flex-direction: column; gap: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .m-row { display: grid; grid-template-columns: 92px 1fr; gap: var(--sp-2); line-height: 1.5; }
  .m-row dt { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; padding-top: 2px; }
  .m-row dd { color: var(--color-fg-dim); }
  .m-link { display: inline-block; margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); text-decoration: none; border-bottom: 1px solid var(--color-accent-dim); padding-bottom: 2px; }
  .m-link:hover { color: var(--color-fg); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;

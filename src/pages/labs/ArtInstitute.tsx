import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * Art Institute of Chicago — api.artic.edu — 120k objects, IIIF image
 * server (so we can request arbitrary sizes from a single image_id).
 * No key, permissive CORS.
 *
 * Smaller than the Met, but cleaner metadata + better provenance notes,
 * and the IIIF image URLs mean we never over-fetch thumbnails.
 */

const API = 'https://api.artic.edu/api/v1';
const IIIF = 'https://www.artic.edu/iiif/2';

type Hit = {
  id: number;
  title: string;
  artist_title?: string;
  date_display?: string;
  image_id?: string | null;
  thumbnail?: { alt_text?: string } | null;
};

type Full = Hit & {
  medium_display?: string;
  dimensions?: string;
  credit_line?: string;
  place_of_origin?: string;
  classification_title?: string;
  department_title?: string;
  artwork_type_title?: string;
  is_public_domain?: boolean;
  description?: string;
  short_description?: string;
};

async function searchHits(q: string, page: number): Promise<{ hits: Hit[]; total: number }> {
  const url = new URL(q.trim() ? `${API}/artworks/search` : `${API}/artworks`);
  if (q.trim()) url.searchParams.set('q', q.trim());
  url.searchParams.set('limit', '24');
  url.searchParams.set('page', String(page));
  url.searchParams.set('fields', 'id,title,artist_title,date_display,image_id,thumbnail');
  const r = await fetch(url.toString());
  if (!r.ok) return { hits: [], total: 0 };
  const j = (await r.json()) as { data: Hit[]; pagination?: { total?: number } };
  return { hits: j.data ?? [], total: j.pagination?.total ?? 0 };
}

async function fetchFull(id: number): Promise<Full | null> {
  try {
    const r = await fetch(`${API}/artworks/${id}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { data: Full };
    return j.data;
  } catch {
    return null;
  }
}

const thumb = (image_id: string, width: number) => `${IIIF}/${image_id}/full/${width},/0/default.jpg`;

export default function ArtInstitutePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const q = search.q ?? '';
  const [input, setInput] = useState(q);
  useEffect(() => { setInput(q); }, [q]);

  const [hits, setHits] = useState<Hit[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedFull, setSelectedFull] = useState<Full | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr('');
    setHits([]);
    setPage(1);
    searchHits(q, 1)
      .then((r) => {
        if (cancelled) return;
        setHits(r.hits);
        setTotal(r.total);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [q]);

  const loadMore = async () => {
    const next = page + 1;
    const r = await searchHits(q, next);
    setPage(next);
    setHits((prev) => [...prev, ...r.hits]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: '/labs/aic' as never, search: { q: input.trim() || undefined } as never });
  };

  useEffect(() => {
    if (selectedId === null) { setSelectedFull(null); return; }
    fetchFull(selectedId).then(setSelectedFull);
  }, [selectedId]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-aic">
        <header className="page-hd">
          <div className="label">~/labs/aic</div>
          <h1>aic<span className="dot">.</span></h1>
          <p className="sub">
            art institute of chicago — 120k works, iiif-backed images, searchable metadata. sister lab to{' '}
            <Link to="/labs/met-museum" className="t-accent">met museum</Link>. data from{' '}
            <code className="inline">api.artic.edu</code>, no key.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. hopper · woodblock · abstract · sargent"
            aria-label="search"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">search →</button>
        </form>

        {err ? <div className="err">{err}</div> : null}
        {loading ? <div className="loading">loading…</div> : null}
        {!loading && !err ? (
          <div className="meta">
            {q ? <>results for <b>{q}</b></> : <>recent accessions</>}
            <span className="t-faint"> · {total.toLocaleString()} work{total === 1 ? '' : 's'}</span>
          </div>
        ) : null}

        <section className="grid">
          {hits.filter((h) => h.image_id).map((h) => (
            <button
              key={h.id}
              type="button"
              className="card"
              onClick={() => setSelectedId(h.id)}
              aria-label={h.title}
            >
              <img src={thumb(h.image_id!, 400)} alt="" loading="lazy" />
              <div className="card-meta">
                <div className="c-title" title={h.title}>{h.title}</div>
                <div className="c-artist" title={h.artist_title}>{h.artist_title || '—'}</div>
                <div className="c-date">{h.date_display || ''}</div>
              </div>
            </button>
          ))}
        </section>

        {!loading && hits.length > 0 && hits.length < total ? (
          <div className="more">
            <button type="button" onClick={loadMore}>load more ↓</button>
          </div>
        ) : null}

        {!loading && hits.length === 0 && !err ? (
          <div className="empty">no results. try a single name, medium (oil, woodblock, bronze), or movement (impressionism, cubism).</div>
        ) : null}

        {selectedId !== null ? <Detail id={selectedId} full={selectedFull} onClose={() => setSelectedId(null)} /> : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">api.artic.edu</span> · iiif</span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Detail({ id, full, onClose }: { id: number; full: Full | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows: Array<[string, string | undefined]> = full ? [
    ['artist', full.artist_title],
    ['date', full.date_display],
    ['medium', full.medium_display],
    ['dimensions', full.dimensions],
    ['place', full.place_of_origin],
    ['classification', full.classification_title],
    ['department', full.department_title],
    ['type', full.artwork_type_title],
    ['credit', full.credit_line],
  ] : [];

  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" type="button" onClick={onClose} aria-label="close">×</button>
        {full?.image_id ? (
          <img src={thumb(full.image_id, 1200)} alt={full.title} className="modal-img" />
        ) : <div className="modal-img modal-img-empty">loading…</div>}
        <div className="modal-info">
          {full ? <>
            <div className="m-title">{full.title}</div>
            {full.short_description ? <div className="m-short">{full.short_description}</div> : null}
            <dl className="m-fields">
              {rows.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="m-row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <a href={`https://www.artic.edu/artworks/${id}`} target="_blank" rel="noopener noreferrer" className="m-link">
              view on artic.edu →
            </a>
          </> : <div className="loading">loading…</div>}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .shell-aic { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
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

  .meta { margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .loading, .err, .empty { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); }
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
  .modal-body { background: var(--color-bg); border: 1px solid var(--color-accent-dim); max-width: 1100px; width: 100%; max-height: 92vh; overflow: auto; position: relative; display: grid; grid-template-columns: 1fr 360px; }
  @media (max-width: 720px) { .modal-body { grid-template-columns: 1fr; } }
  .modal-x { position: absolute; top: 8px; right: 12px; background: transparent; border: 0; color: var(--color-fg-faint); font-size: 28px; cursor: pointer; z-index: 2; line-height: 1; }
  .modal-x:hover { color: var(--color-accent); }
  .modal-img { width: 100%; height: 100%; object-fit: contain; background: var(--color-bg); max-height: 92vh; }
  .modal-img-empty { display: flex; align-items: center; justify-content: center; color: var(--color-fg-faint); font-family: var(--font-mono); }
  .modal-info { padding: var(--sp-5) var(--sp-4); border-left: 1px solid var(--color-border); overflow: auto; }
  @media (max-width: 720px) { .modal-info { border-left: 0; border-top: 1px solid var(--color-border); } }
  .m-title { font-family: var(--font-display); font-size: var(--fs-lg); color: var(--color-fg); letter-spacing: -0.01em; line-height: 1.2; margin-bottom: var(--sp-3); }
  .m-short { color: var(--color-fg-dim); font-size: var(--fs-xs); margin-bottom: var(--sp-3); line-height: 1.55; }
  .m-fields { display: flex; flex-direction: column; gap: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .m-row { display: grid; grid-template-columns: 92px 1fr; gap: var(--sp-2); line-height: 1.5; }
  .m-row dt { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; padding-top: 2px; }
  .m-row dd { color: var(--color-fg-dim); }
  .m-link { display: inline-block; margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); text-decoration: none; border-bottom: 1px solid var(--color-accent-dim); padding-bottom: 2px; }
  .m-link:hover { color: var(--color-fg); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;

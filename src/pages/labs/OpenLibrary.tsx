import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * Open Library — openlibrary.org — internet archive's open book
 * catalog. Search by title, author, or isbn. Covers served via
 * covers.openlibrary.org as CDN images. No key, permissive CORS.
 */

const API = 'https://openlibrary.org';
const COVERS = 'https://covers.openlibrary.org';

type Hit = {
  key: string; // e.g. "/works/OL123W"
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  edition_count?: number;
  ebook_access?: string;
  subject?: string[];
  publisher?: string[];
  language?: string[];
};

type Work = {
  title?: string;
  description?: string | { value: string };
  subjects?: string[];
  created?: { value: string };
  first_publish_date?: string;
  covers?: number[];
};

async function searchBooks(q: string, page: number): Promise<{ hits: Hit[]; total: number }> {
  const url = new URL(`${API}/search.json`);
  url.searchParams.set('q', q.trim());
  url.searchParams.set('limit', '24');
  url.searchParams.set('page', String(page));
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,isbn,edition_count,ebook_access,subject,publisher,language');
  const r = await fetch(url.toString());
  if (!r.ok) return { hits: [], total: 0 };
  const j = (await r.json()) as { docs?: Hit[]; numFound?: number };
  return { hits: j.docs ?? [], total: j.numFound ?? 0 };
}

async function fetchWork(key: string): Promise<Work | null> {
  try {
    const r = await fetch(`${API}${key}.json`);
    if (!r.ok) return null;
    return (await r.json()) as Work;
  } catch {
    return null;
  }
}

const coverUrl = (cover_i: number, size: 'S' | 'M' | 'L' = 'M') => `${COVERS}/b/id/${cover_i}-${size}.jpg`;

export default function OpenLibraryPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const q = search.q ?? '';
  const [input, setInput] = useState(q);
  useEffect(() => { setInput(q); }, [q]);

  const [hits, setHits] = useState<Hit[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Hit | null>(null);
  const [work, setWork] = useState<Work | null>(null);

  useEffect(() => {
    if (!q) { setHits([]); setTotal(0); return; }
    let cancelled = false;
    setLoading(true);
    setHits([]);
    setPage(1);
    searchBooks(q, 1).then((r) => {
      if (cancelled) return;
      setHits(r.hits);
      setTotal(r.total);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [q]);

  useEffect(() => {
    if (!selected) { setWork(null); return; }
    fetchWork(selected.key).then(setWork);
  }, [selected]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: '/labs/open-library' as never, search: { q: input.trim() || undefined } as never });
  };

  const loadMore = async () => {
    const next = page + 1;
    const r = await searchBooks(q, next);
    setPage(next);
    setHits((prev) => [...prev, ...r.hits]);
  };

  const description = work?.description
    ? typeof work.description === 'string' ? work.description : work.description.value
    : null;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ol">
        <header className="page-hd">
          <div className="label">~/labs/open-library</div>
          <h1>open library<span className="dot">.</span></h1>
          <p className="sub">
            internet archive&apos;s open book catalog. search by title, author, or isbn — browse covers + editions
            + subjects. data from <code className="inline">openlibrary.org</code>, no key.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. ursula le guin · 9780441013593 · cryptonomicon"
            aria-label="search"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">search →</button>
        </form>

        {loading ? <div className="loading">loading…</div> : null}
        {!loading && q && hits.length === 0 ? (
          <div className="empty">no books matched. try an author last name, a full title, or an isbn-10/13.</div>
        ) : null}
        {!q ? (
          <div className="empty">search by title, author, or isbn.</div>
        ) : null}
        {total > 0 ? (
          <div className="meta">{total.toLocaleString()} match{total === 1 ? '' : 'es'}</div>
        ) : null}

        <section className="grid">
          {hits.map((h) => (
            <button
              key={h.key}
              type="button"
              className="card"
              onClick={() => setSelected(h)}
              aria-label={h.title}
            >
              {h.cover_i ? (
                <img src={coverUrl(h.cover_i, 'M')} alt="" loading="lazy" />
              ) : (
                <div className="c-nocover">no cover</div>
              )}
              <div className="card-meta">
                <div className="c-title" title={h.title}>{h.title}</div>
                <div className="c-author">{h.author_name?.slice(0, 2).join(', ') || '—'}</div>
                <div className="c-year">{h.first_publish_year || ''}</div>
              </div>
            </button>
          ))}
        </section>

        {hits.length > 0 && hits.length < total ? (
          <div className="more">
            <button type="button" onClick={loadMore}>load more ↓</button>
          </div>
        ) : null}

        {selected ? (
          <Detail hit={selected} work={work} description={description} onClose={() => setSelected(null)} />
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">openlibrary.org</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Detail({ hit, work, description, onClose }: { hit: Hit; work: Work | null; description: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cover = hit.cover_i ?? work?.covers?.[0];
  const fields: Array<[string, string | undefined]> = [
    ['author', hit.author_name?.join(', ')],
    ['first published', String(hit.first_publish_year ?? work?.first_publish_date ?? '')],
    ['editions', hit.edition_count ? String(hit.edition_count) : undefined],
    ['publishers', hit.publisher?.slice(0, 3).join(', ')],
    ['languages', hit.language?.slice(0, 5).join(', ')],
    ['isbn', hit.isbn?.[0]],
    ['subjects', (work?.subjects ?? hit.subject)?.slice(0, 8).join(', ')],
  ];
  return (
    <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" type="button" onClick={onClose} aria-label="close">×</button>
        {cover ? (
          <img src={coverUrl(cover, 'L')} alt={hit.title} className="modal-img" />
        ) : (
          <div className="modal-img modal-img-empty">no cover</div>
        )}
        <div className="modal-info">
          <div className="m-title">{hit.title}</div>
          <dl className="m-fields">
            {fields.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="m-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {description ? <p className="m-desc">{description}</p> : null}
          <a href={`https://openlibrary.org${hit.key}`} target="_blank" rel="noopener noreferrer" className="m-link">
            view on openlibrary.org →
          </a>
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .shell-ol { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
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
  .loading, .empty { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); }
  .empty { border-style: dashed; text-align: center; color: var(--color-fg-faint); }

  .grid { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--sp-3); }
  .card { text-align: left; padding: 0; border: 1px solid var(--color-border); background: var(--color-bg-panel); cursor: pointer; display: flex; flex-direction: column; color: inherit; transition: border-color 120ms ease; overflow: hidden; }
  .card:hover { border-color: var(--color-accent-dim); }
  .card:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .card img { width: 100%; aspect-ratio: 2 / 3; object-fit: cover; background: var(--color-bg-raised); display: block; }
  .c-nocover { width: 100%; aspect-ratio: 2 / 3; background: var(--color-bg-raised); display: flex; align-items: center; justify-content: center; color: var(--color-fg-faint); font-family: var(--font-mono); font-size: 11px; border-bottom: 1px dashed var(--color-border); }
  .card-meta { padding: var(--sp-2) var(--sp-3); font-family: var(--font-mono); font-size: 11px; display: flex; flex-direction: column; gap: 2px; }
  .c-title { color: var(--color-fg); font-size: var(--fs-xs); font-family: var(--font-display); letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c-author { color: var(--color-fg-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .c-year { color: var(--color-fg-faint); font-size: 10px; }

  .more { margin-top: var(--sp-5); display: flex; justify-content: center; }
  .more button { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 10px var(--sp-5); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .more button:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .modal { position: fixed; inset: 0; background: color-mix(in oklch, black 80%, transparent); z-index: 60; display: flex; align-items: center; justify-content: center; padding: var(--sp-4); overflow: auto; }
  .modal-body { background: var(--color-bg); border: 1px solid var(--color-accent-dim); max-width: 900px; width: 100%; max-height: 92vh; overflow: auto; position: relative; display: grid; grid-template-columns: 280px 1fr; }
  @media (max-width: 720px) { .modal-body { grid-template-columns: 1fr; } }
  .modal-x { position: absolute; top: 8px; right: 12px; background: transparent; border: 0; color: var(--color-fg-faint); font-size: 28px; cursor: pointer; z-index: 2; line-height: 1; }
  .modal-x:hover { color: var(--color-accent); }
  .modal-img { width: 100%; height: 100%; object-fit: contain; background: var(--color-bg); max-height: 92vh; padding: var(--sp-3); }
  .modal-img-empty { display: flex; align-items: center; justify-content: center; color: var(--color-fg-faint); font-family: var(--font-mono); min-height: 300px; }
  .modal-info { padding: var(--sp-5) var(--sp-4); border-left: 1px solid var(--color-border); overflow: auto; }
  @media (max-width: 720px) { .modal-info { border-left: 0; border-top: 1px solid var(--color-border); } }
  .m-title { font-family: var(--font-display); font-size: var(--fs-lg); color: var(--color-fg); letter-spacing: -0.01em; line-height: 1.2; margin-bottom: var(--sp-3); }
  .m-fields { display: flex; flex-direction: column; gap: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: var(--sp-3); }
  .m-row { display: grid; grid-template-columns: 110px 1fr; gap: var(--sp-2); line-height: 1.5; }
  .m-row dt { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; padding-top: 2px; }
  .m-row dd { color: var(--color-fg-dim); }
  .m-desc { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); line-height: 1.6; padding: var(--sp-3); background: var(--color-bg-panel); border-left: 2px solid var(--color-accent-dim); margin-bottom: var(--sp-3); white-space: pre-wrap; }
  .m-link { display: inline-block; margin-top: var(--sp-2); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); text-decoration: none; border-bottom: 1px solid var(--color-accent-dim); padding-bottom: 2px; }
  .m-link:hover { color: var(--color-fg); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;

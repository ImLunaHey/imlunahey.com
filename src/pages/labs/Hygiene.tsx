import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

type Establishment = {
  FHRSID: number;
  BusinessName: string;
  BusinessType: string;
  AddressLine1?: string;
  AddressLine2?: string;
  AddressLine3?: string;
  AddressLine4?: string;
  PostCode?: string;
  RatingValue: string;          // "0"-"5" or "Pass"/"Improvement Required"/"Exempt" or "AwaitingInspection"
  RatingDate: string | null;
  LocalAuthorityName: string;
  scores?: {
    Hygiene: number | null;
    Structural: number | null;
    ConfidenceInManagement: number | null;
  };
};

type Response = {
  establishments: Establishment[];
  meta?: { totalCount?: number };
};

async function searchEstablishments(q: string): Promise<Response> {
  const url = new URL('https://api.ratings.food.gov.uk/establishments');
  // name search matches partial substrings; api accepts a freeform `name` param
  url.searchParams.set('name', q);
  url.searchParams.set('pageSize', '40');
  const r = await fetch(url.toString(), { headers: { 'x-api-version': '2' } });
  if (!r.ok) throw new Error(`fsa ${r.status}`);
  return r.json();
}

function ratingDisplay(r: string): { label: string; tone: 'good' | 'mid' | 'bad' | 'neutral'; big: string } {
  const n = Number(r);
  if (!isNaN(n)) {
    const tone = n >= 4 ? 'good' : n >= 3 ? 'mid' : 'bad';
    return { label: `${n} / 5`, tone, big: String(n) };
  }
  if (r === 'Pass') return { label: 'Pass', tone: 'good', big: '✓' };
  if (r === 'Improvement Required') return { label: 'Improvement required', tone: 'bad', big: '!' };
  if (r === 'Exempt') return { label: 'Exempt', tone: 'neutral', big: '—' };
  if (r === 'AwaitingInspection') return { label: 'Awaiting', tone: 'neutral', big: '?' };
  return { label: r, tone: 'neutral', big: '?' };
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return s;
  }
}

function addressLine(e: Establishment): string {
  return [e.AddressLine1, e.AddressLine2, e.AddressLine3, e.AddressLine4, e.PostCode]
    .filter(Boolean)
    .join(', ');
}

export default function HygienePage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const [input, setInput] = useState(search.q ?? '');
  const q = search.q ?? '';

  // debounced auto-search as they type after the form has been submitted once
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(input.trim()), 350);
    return () => window.clearTimeout(t);
  }, [input]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: '/labs/hygiene' as never, search: { q: input.trim() } as never });
  };

  // prefer the URL-bound query when present (shareable), fall back to
  // debounced local input
  const activeQ = q || debounced;

  const query = useQuery({
    queryKey: ['fsa', activeQ],
    queryFn: () => searchEstablishments(activeQ),
    enabled: activeQ.length >= 3,
    staleTime: 60 * 60 * 1000,
  });

  const results = query.data?.establishments ?? [];
  const total = query.data?.meta?.totalCount ?? results.length;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-hyg">
        <header className="page-hd">
          <div className="label">~/labs/hygiene</div>
          <h1>hygiene<span className="dot">.</span></h1>
          <p className="sub">
            food standards agency ratings for every registered uk food business. 0–5 in england /
            wales / northern ireland; pass / improvement required in scotland. last inspection date
            included so you can tell if it&apos;s fresh.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="search a restaurant, café, takeaway, shop…"
            spellCheck={false}
            autoComplete="off"
          />
          <button type="submit">search →</button>
        </form>

        {activeQ.length < 3 ? (
          <div className="hint">type at least 3 characters to search</div>
        ) : null}

        {query.isError ? <div className="err">fsa api unreachable — try again shortly.</div> : null}
        {query.isLoading ? <div className="loading">searching…</div> : null}

        {activeQ.length >= 3 && !query.isLoading && results.length === 0 && !query.isError ? (
          <div className="empty">no establishments match &quot;{activeQ}&quot;.</div>
        ) : null}

        {results.length > 0 ? (
          <>
            <div className="meta-line">
              <span>{results.length} of {total.toLocaleString()} establishments</span>
              {total > results.length ? <span className="t-faint">— refine your search to narrow down</span> : null}
            </div>
            <section className="list">
              {results.map((e) => {
                const r = ratingDisplay(e.RatingValue);
                return (
                  <article key={e.FHRSID} className={`row tone-${r.tone}`}>
                    <div className="badge">{r.big}</div>
                    <div className="body">
                      <div className="biz">{e.BusinessName}</div>
                      <div className="sub">{e.BusinessType} · {e.LocalAuthorityName}</div>
                      <div className="addr">{addressLine(e)}</div>
                    </div>
                    <div className="info">
                      <div className="rating">{r.label}</div>
                      <div className="inspected">inspected {fmtDate(e.RatingDate)}</div>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">api.ratings.food.gov.uk</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-hyg { max-width: 1000px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); }
  .inp input { flex: 1; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }

  .hint { margin-top: var(--sp-4); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .loading { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }
  .empty { margin-top: var(--sp-5); padding: var(--sp-6); text-align: center; color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-sm); border: 1px dashed var(--color-border); }
  .meta-line { margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); display: flex; gap: var(--sp-2); flex-wrap: wrap; }

  .list { margin-top: var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); }
  .row {
    display: grid;
    grid-template-columns: 56px 1fr auto;
    gap: var(--sp-4);
    padding: var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    align-items: center;
  }
  .badge {
    width: 48px; height: 48px;
    display: grid; place-items: center;
    border: 2px solid currentColor;
    font-family: var(--font-display);
    font-size: 24px;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .tone-good .badge { color: var(--color-accent); }
  .tone-mid .badge { color: #ffd166; }
  .tone-bad .badge { color: var(--color-alert); }
  .tone-neutral .badge { color: var(--color-fg-faint); }

  .biz { font-family: var(--font-display); font-size: 20px; color: var(--color-fg); letter-spacing: -0.02em; line-height: 1.2; }
  .sub { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 3px; text-transform: lowercase; }
  .addr { color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 4px; }

  .info { text-align: right; font-family: var(--font-mono); font-size: var(--fs-xs); display: flex; flex-direction: column; gap: 2px; }
  .rating { color: var(--color-fg); }
  .tone-good .rating { color: var(--color-accent); }
  .tone-mid .rating { color: #ffd166; }
  .tone-bad .rating { color: var(--color-alert); }
  .inspected { color: var(--color-fg-faint); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;

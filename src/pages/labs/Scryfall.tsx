import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

/**
 * Scryfall — api.scryfall.com — Magic: The Gathering, every card ever
 * printed. Rich metadata: mana cost, type line, oracle text, flavour,
 * artist, rarity, prices (usd + eur), all legalities, high-res art.
 *
 * Their search accepts Scryfall's query DSL verbatim — e.g.
 *   `t:dragon c:r cmc<=5`, `set:neo`, `is:commander`, `a:"rebecca guay"`.
 */

const API = 'https://api.scryfall.com';

type Card = {
  id: string;
  name: string;
  mana_cost?: string;
  type_line?: string;
  oracle_text?: string;
  flavor_text?: string;
  artist?: string;
  set_name?: string;
  set?: string;
  released_at?: string;
  rarity?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  keywords?: string[];
  image_uris?: { small?: string; normal?: string; large?: string; png?: string; art_crop?: string; border_crop?: string };
  // double-faced cards stash images here instead:
  card_faces?: Array<{ name: string; type_line?: string; oracle_text?: string; mana_cost?: string; image_uris?: Card['image_uris'] }>;
  prices?: { usd?: string | null; usd_foil?: string | null; eur?: string | null; tix?: string | null };
  scryfall_uri?: string;
  color_identity?: string[];
};

async function searchCards(q: string): Promise<Card[]> {
  const url = new URL(`${API}/cards/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('unique', 'cards');
  url.searchParams.set('order', 'edhrec');
  const r = await fetch(url.toString());
  if (!r.ok) return [];
  const j = (await r.json()) as { data?: Card[] };
  return j.data ?? [];
}

async function randomCard(): Promise<Card | null> {
  const r = await fetch(`${API}/cards/random`);
  if (!r.ok) return null;
  return (await r.json()) as Card;
}

function cardImage(c: Card, size: 'small' | 'normal' | 'large' = 'normal'): string | undefined {
  return c.image_uris?.[size] ?? c.card_faces?.[0]?.image_uris?.[size];
}

export default function ScryfallPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { q?: string };
  const q = search.q ?? '';
  const [input, setInput] = useState(q);
  useEffect(() => { setInput(q); }, [q]);

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<Card | null>(null);

  useEffect(() => {
    if (!q) { setCards([]); return; }
    let cancelled = false;
    setLoading(true);
    setErr('');
    searchCards(q)
      .then((c) => { if (!cancelled) { setCards(c); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setErr(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: '/labs/scryfall' as never, search: { q: input.trim() || undefined } as never });
  };

  const loadRandom = async () => {
    const c = await randomCard();
    if (c) setSelected(c);
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-scryfall">
        <header className="page-hd">
          <div className="label">~/labs/scryfall</div>
          <h1>scryfall<span className="dot">.</span></h1>
          <p className="sub">
            every magic: the gathering card ever printed. scryfall&apos;s query dsl works verbatim — try{' '}
            <code className="inline">t:dragon c:r cmc&lt;=5</code>,{' '}
            <code className="inline">set:neo is:commander</code>, or{' '}
            <code className="inline">a:&quot;rebecca guay&quot;</code>. data from{' '}
            <code className="inline">api.scryfall.com</code>, no key.
          </p>
        </header>

        <form className="inp" onSubmit={submit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="scryfall query — e.g. t:planeswalker c:wubrg"
            aria-label="scryfall query"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">search →</button>
          <button type="button" className="random" onClick={loadRandom}>⚄ random</button>
        </form>

        {err ? <div className="err">{err}</div> : null}
        {loading ? <div className="loading">querying…</div> : null}

        {!loading && !err && cards.length > 0 ? (
          <div className="meta">{cards.length.toLocaleString()} card{cards.length === 1 ? '' : 's'}</div>
        ) : null}

        {!loading && !err && q && cards.length === 0 ? (
          <div className="empty">no cards matched. scryfall dsl reference: <a href="https://scryfall.com/docs/syntax" target="_blank" rel="noopener noreferrer" className="t-accent">scryfall.com/docs/syntax</a></div>
        ) : null}

        {!q && cards.length === 0 ? (
          <div className="empty">start with a query — or click random.</div>
        ) : null}

        <section className="grid">
          {cards.map((c) => {
            const img = cardImage(c, 'normal');
            if (!img) return null;
            return (
              <button key={c.id} type="button" className="card" onClick={() => setSelected(c)} aria-label={c.name}>
                <img src={img} alt={c.name} loading="lazy" />
              </button>
            );
          })}
        </section>

        {selected ? <Detail card={selected} onClose={() => setSelected(null)} /> : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">api.scryfall.com</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

function Detail({ card, onClose }: { card: Card; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const faces = card.card_faces && card.card_faces.length > 0 && !card.image_uris
    ? card.card_faces
    : [{ name: card.name, type_line: card.type_line, oracle_text: card.oracle_text, mana_cost: card.mana_cost, image_uris: card.image_uris }];

  const prices: string[] = [];
  if (card.prices?.usd) prices.push(`$${card.prices.usd}`);
  if (card.prices?.usd_foil) prices.push(`$${card.prices.usd_foil} foil`);
  if (card.prices?.eur) prices.push(`€${card.prices.eur}`);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={card.name} onClick={onClose}>
      <div className="modal-body" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" type="button" onClick={onClose} aria-label="close">×</button>
        <div className="modal-imgs">
          {faces.map((f, i) => f.image_uris?.large ? (
            <img key={i} src={f.image_uris.large} alt={f.name} className="modal-img" />
          ) : null)}
        </div>
        <div className="modal-info">
          <div className="m-title">{card.name}</div>
          {card.mana_cost ? <div className="m-mana">{card.mana_cost}</div> : null}
          <div className="m-type">{card.type_line}</div>
          {faces.map((f, i) => f.oracle_text ? (
            <pre key={i} className="m-oracle">{f.oracle_text}</pre>
          ) : null)}
          {card.power || card.toughness ? (
            <div className="m-pt">{card.power}/{card.toughness}</div>
          ) : null}
          {card.loyalty ? <div className="m-pt">loyalty {card.loyalty}</div> : null}
          {card.flavor_text ? <div className="m-flavor">“{card.flavor_text}”</div> : null}
          <dl className="m-fields">
            <div className="m-row"><dt>set</dt><dd>{card.set_name} ({card.set?.toUpperCase()})</dd></div>
            {card.released_at ? <div className="m-row"><dt>released</dt><dd>{card.released_at}</dd></div> : null}
            {card.rarity ? <div className="m-row"><dt>rarity</dt><dd>{card.rarity}</dd></div> : null}
            {card.artist ? <div className="m-row"><dt>artist</dt><dd>{card.artist}</dd></div> : null}
            {prices.length > 0 ? <div className="m-row"><dt>prices</dt><dd>{prices.join(' · ')}</dd></div> : null}
          </dl>
          {card.scryfall_uri ? (
            <a href={card.scryfall_uri} target="_blank" rel="noopener noreferrer" className="m-link">
              view on scryfall →
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .shell-scryfall { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 66ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .inline { background: var(--color-bg-raised); border: 1px solid var(--color-border); padding: 1px 5px; font-size: 11px; color: var(--color-accent); font-family: var(--font-mono); }

  .inp { margin-top: var(--sp-5); display: flex; gap: var(--sp-2); flex-wrap: wrap; }
  .inp input { flex: 1; min-width: 220px; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); font-family: var(--font-mono); font-size: var(--fs-md); padding: 10px var(--sp-3); outline: 0; }
  .inp input:focus { border-color: var(--color-accent-dim); }
  .inp button[type=submit] { background: var(--color-accent); color: var(--color-bg); border: 0; padding: 0 var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-sm); cursor: pointer; font-weight: 500; }
  .inp button[type=submit]:hover { background: color-mix(in oklch, var(--color-accent) 85%, white 15%); }
  .random { background: transparent; color: var(--color-accent); border: 1px solid var(--color-accent-dim); padding: 0 var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; }
  .random:hover { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }

  .meta { margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); }
  .loading, .err, .empty { margin-top: var(--sp-4); padding: var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.55; border: 1px solid var(--color-border); color: var(--color-fg-dim); background: var(--color-bg-panel); }
  .err { border-color: var(--color-alert); color: var(--color-alert); }
  .empty { border-style: dashed; text-align: center; color: var(--color-fg-faint); }

  .grid { margin-top: var(--sp-4); display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--sp-3); }
  .card { padding: 0; border: 1px solid var(--color-border); background: transparent; cursor: pointer; border-radius: 12px; overflow: hidden; transition: transform 120ms ease, border-color 120ms ease; }
  .card:hover { border-color: var(--color-accent-dim); transform: translateY(-2px); }
  .card:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .card img { width: 100%; aspect-ratio: 488 / 680; object-fit: cover; display: block; background: var(--color-bg-raised); }

  .modal { position: fixed; inset: 0; background: color-mix(in oklch, black 80%, transparent); z-index: 60; display: flex; align-items: center; justify-content: center; padding: var(--sp-4); overflow: auto; }
  .modal-body { background: var(--color-bg); border: 1px solid var(--color-accent-dim); max-width: 1100px; width: 100%; max-height: 92vh; overflow: auto; position: relative; display: grid; grid-template-columns: 1fr 360px; gap: 0; }
  @media (max-width: 720px) { .modal-body { grid-template-columns: 1fr; } }
  .modal-x { position: absolute; top: 8px; right: 12px; background: transparent; border: 0; color: var(--color-fg-faint); font-size: 28px; cursor: pointer; z-index: 2; line-height: 1; }
  .modal-x:hover { color: var(--color-accent); }
  .modal-imgs { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-4); background: var(--color-bg); align-items: center; }
  .modal-img { max-width: 100%; border-radius: 12px; }
  .modal-info { padding: var(--sp-5) var(--sp-4); border-left: 1px solid var(--color-border); overflow: auto; }
  @media (max-width: 720px) { .modal-info { border-left: 0; border-top: 1px solid var(--color-border); } }
  .m-title { font-family: var(--font-display); font-size: var(--fs-lg); color: var(--color-fg); letter-spacing: -0.01em; line-height: 1.2; }
  .m-mana { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); margin-top: 4px; }
  .m-type { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-dim); margin-top: var(--sp-2); }
  .m-oracle { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg); background: var(--color-bg-panel); border-left: 2px solid var(--color-accent-dim); padding: var(--sp-2) var(--sp-3); margin: var(--sp-3) 0; white-space: pre-wrap; line-height: 1.6; }
  .m-pt { font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-accent); margin-top: var(--sp-2); }
  .m-flavor { font-style: italic; color: var(--color-fg-faint); font-size: var(--fs-xs); margin-top: var(--sp-3); line-height: 1.6; }
  .m-fields { display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: var(--sp-4); }
  .m-row { display: grid; grid-template-columns: 70px 1fr; gap: var(--sp-2); line-height: 1.5; }
  .m-row dt { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; padding-top: 2px; }
  .m-row dd { color: var(--color-fg-dim); }
  .m-link { display: inline-block; margin-top: var(--sp-4); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-accent); text-decoration: none; border-bottom: 1px solid var(--color-accent-dim); padding-bottom: 2px; }
  .m-link:hover { color: var(--color-fg); }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); flex-wrap: wrap; gap: var(--sp-3); }
`;

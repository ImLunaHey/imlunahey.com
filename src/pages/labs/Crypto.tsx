import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

// CoinGecko free tier. No auth, ~30 req/min — fine for a visitor-triggered
// lab at a 60s refresh cadence. We pull everything we need in one markets
// call: rank, metadata, multi-period price change %, and a 7-day sparkline.

type Coin = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  ath: number;
  ath_change_percentage: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  sparkline_in_7d: { price: number[] };
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
};

type Currency = 'usd' | 'eur' | 'gbp' | 'jpy';
type Period = '1h' | '24h' | '7d';

const CURRENCY_SYMBOL: Record<Currency, string> = { usd: '$', eur: '€', gbp: '£', jpy: '¥' };

async function fetchMarkets(cur: Currency): Promise<Coin[]> {
  const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
  url.searchParams.set('vs_currency', cur);
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', '50');
  url.searchParams.set('page', '1');
  url.searchParams.set('sparkline', 'true');
  url.searchParams.set('price_change_percentage', '1h,24h,7d');
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  return r.json();
}

function fmtMoney(n: number, cur: Currency): string {
  const sym = CURRENCY_SYMBOL[cur];
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sym}${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1) return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (abs >= 0.01) return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
}

function fmtPct(n: number | null): string {
  if (n == null || !isFinite(n)) return '—';
  const rounded = Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2);
  return `${n >= 0 ? '+' : ''}${rounded}%`;
}

function toneFor(n: number | null): 'up' | 'down' | 'flat' {
  if (n == null || !isFinite(n)) return 'flat';
  if (n > 0.05) return 'up';
  if (n < -0.05) return 'down';
  return 'flat';
}

function Sparkline({ prices, tone }: { prices: number[]; tone: 'up' | 'down' | 'flat' }) {
  if (prices.length < 2) return null;
  const W = 100, H = 28;
  let min = Infinity, max = -Infinity;
  for (const p of prices) { if (p < min) min = p; if (p > max) max = p; }
  const span = max - min || 1;
  const step = W / (prices.length - 1);
  let d = '';
  for (let i = 0; i < prices.length; i++) {
    const x = i * step;
    const y = H - ((prices[i] - min) / span) * H;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  const colour =
    tone === 'up' ? 'var(--color-accent)'
    : tone === 'down' ? 'var(--color-alert)'
    : 'var(--color-fg-faint)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="spark">
      <path d={d} fill="none" stroke={colour} strokeWidth={1.25} />
    </svg>
  );
}

export default function CryptoPage() {
  const [cur, setCur] = useState<Currency>('usd');
  const [period, setPeriod] = useState<Period>('24h');
  const [query, setQuery] = useState('');

  const q = useQuery({
    queryKey: ['coingecko-markets', cur],
    queryFn: () => fetchMarkets(cur),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  const coins = q.data ?? [];
  const filtered = useMemo(() => {
    const f = query.trim().toLowerCase();
    if (!f) return coins;
    return coins.filter((c) => c.name.toLowerCase().includes(f) || c.symbol.toLowerCase().includes(f));
  }, [coins, query]);

  const pctFor = (c: Coin): number | null =>
    period === '1h' ? c.price_change_percentage_1h_in_currency
    : period === '7d' ? c.price_change_percentage_7d_in_currency
    : c.price_change_percentage_24h_in_currency;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cr">
        <header className="page-hd">
          <div className="label">~/labs/crypto</div>
          <h1>crypto<span className="dot">.</span></h1>
          <p className="sub">
            top 50 cryptocurrencies by market cap, live from coingecko. 7-day sparkline per coin,
            1h / 24h / 7d change toggle, usd / gbp / eur / jpy. refreshes every minute.
          </p>
        </header>

        <section className="ctrl">
          <div className="seg">
            {(['usd', 'gbp', 'eur', 'jpy'] as Currency[]).map((c) => (
              <button key={c} className={`seg-btn ${cur === c ? 'on' : ''}`} onClick={() => setCur(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="seg">
            {(['1h', '24h', '7d'] as Period[]).map((p) => (
              <button key={p} className={`seg-btn ${period === p ? 'on' : ''}`} onClick={() => setPeriod(p)}>
                {p}
              </button>
            ))}
          </div>
          <input
            className="srch"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter by name or ticker…"
            spellCheck={false}
            autoComplete="off"
          />
          {q.dataUpdatedAt ? (
            <span className="t-faint upd">updated {Math.round((Date.now() - q.dataUpdatedAt) / 1000)}s ago</span>
          ) : null}
        </section>

        {q.isError ? <div className="err">coingecko returned an error — rate-limited or offline.</div> : null}
        {q.isLoading ? <div className="loading">loading…</div> : null}

        <section className="table">
          <div className="th">
            <span>#</span>
            <span>coin</span>
            <span className="r">price</span>
            <span className="r">{period}</span>
            <span className="r hide-sm">mkt cap</span>
            <span className="r hide-sm">vol (24h)</span>
            <span className="hide-sm">7d</span>
          </div>
          {filtered.map((c) => {
            const pct = pctFor(c);
            const tone = toneFor(pct);
            return (
              <div key={c.id} className="tr">
                <span className="rnk">{c.market_cap_rank ?? '—'}</span>
                <span className="coin">
                  <img src={c.image} alt="" width={20} height={20} loading="lazy" />
                  <span>
                    <b>{c.name}</b>
                    <span className="sym">{c.symbol.toUpperCase()}</span>
                  </span>
                </span>
                <span className="r price">{fmtMoney(c.current_price, cur)}</span>
                <span className={`r pct tone-${tone}`}>{fmtPct(pct)}</span>
                <span className="r hide-sm">{fmtMoney(c.market_cap, cur)}</span>
                <span className="r hide-sm">{fmtMoney(c.total_volume, cur)}</span>
                <span className="hide-sm spark-cell">
                  <Sparkline prices={c.sparkline_in_7d.price} tone={toneFor(c.price_change_percentage_7d_in_currency)} />
                </span>
              </div>
            );
          })}
        </section>

        <footer className="labs-footer">
          <span>source · <span className="t-accent">api.coingecko.com · free tier</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-cr { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .ctrl { margin-top: var(--sp-4); display: flex; gap: var(--sp-3); align-items: center; flex-wrap: wrap; }
  .seg { display: inline-flex; border: 1px solid var(--color-border); }
  .seg-btn { background: transparent; border: 0; color: var(--color-fg-dim); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; text-transform: uppercase; letter-spacing: 0.08em; }
  .seg-btn + .seg-btn { border-left: 1px solid var(--color-border); }
  .seg-btn.on { color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }
  .srch { flex: 1; min-width: 180px; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); outline: 0; }
  .srch:focus { border-color: var(--color-accent-dim); }
  .upd { font-family: var(--font-mono); font-size: var(--fs-xs); }

  .err { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-xs); }
  .loading { margin-top: var(--sp-4); padding: var(--sp-3); border: 1px solid var(--color-border); background: var(--color-bg-panel); font-family: var(--font-mono); font-size: var(--fs-sm); color: var(--color-fg-dim); }

  .table { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .th, .tr {
    display: grid;
    grid-template-columns: 40px minmax(160px, 1fr) 110px 80px 130px 130px 120px;
    gap: var(--sp-3);
    align-items: center;
    padding: 8px var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
  }
  .th { border-bottom: 1px solid var(--color-border); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .tr { border-bottom: 1px dashed var(--color-border); }
  .tr:last-child { border-bottom: 0; }
  .tr:hover { background: var(--color-bg-raised); }
  .r { text-align: right; font-variant-numeric: tabular-nums; }
  .rnk { color: var(--color-fg-faint); }

  .coin { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
  .coin img { width: 20px; height: 20px; flex: 0 0 20px; image-rendering: -webkit-optimize-contrast; }
  .coin b { color: var(--color-fg); font-weight: 400; font-size: var(--fs-sm); }
  .coin .sym { color: var(--color-fg-faint); margin-left: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
  .price { color: var(--color-fg); }

  .pct { font-weight: 500; }
  .tone-up { color: var(--color-accent); }
  .tone-down { color: var(--color-alert); }
  .tone-flat { color: var(--color-fg-dim); }

  .spark-cell { display: flex; align-items: center; justify-content: flex-end; }
  .spark { display: block; }

  @media (max-width: 820px) {
    .th, .tr { grid-template-columns: 32px 1fr 100px 70px; }
    .hide-sm { display: none; }
  }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;

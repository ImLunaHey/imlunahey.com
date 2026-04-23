import { Link, useParams } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

type Currency = 'usd' | 'eur' | 'gbp' | 'jpy';
const CURRENCY_SYMBOL: Record<Currency, string> = { usd: '$', eur: '€', gbp: '£', jpy: '¥' };

type CoinDetail = {
  id: string;
  symbol: string;
  name: string;
  image: { large: string; small: string };
  genesis_date: string | null;
  hashing_algorithm: string | null;
  categories: string[];
  description: { en: string };
  links: {
    homepage: string[];
    whitepaper: string;
    blockchain_site: string[];
    twitter_screen_name: string | null;
    subreddit_url: string | null;
    repos_url: { github: string[] };
  };
  market_cap_rank: number | null;
  sentiment_votes_up_percentage: number | null;
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    fully_diluted_valuation: Record<string, number> | null;
    high_24h: Record<string, number>;
    low_24h: Record<string, number>;
    ath: Record<string, number>;
    ath_date: Record<string, string>;
    ath_change_percentage: Record<string, number>;
    atl: Record<string, number>;
    atl_date: Record<string, string>;
    atl_change_percentage: Record<string, number>;
    price_change_percentage_1h_in_currency: Record<string, number>;
    price_change_percentage_24h_in_currency: Record<string, number>;
    price_change_percentage_7d_in_currency: Record<string, number>;
    price_change_percentage_30d_in_currency: Record<string, number>;
    price_change_percentage_1y_in_currency: Record<string, number>;
    circulating_supply: number | null;
    total_supply: number | null;
    max_supply: number | null;
    sparkline_7d: { price: number[] };
  };
  community_data: {
    twitter_followers: number | null;
    reddit_subscribers: number | null;
    telegram_channel_user_count: number | null;
  };
  developer_data: {
    forks: number | null;
    stars: number | null;
    subscribers: number | null;
    total_issues: number | null;
    closed_issues: number | null;
    pull_requests_merged: number | null;
    pull_request_contributors: number | null;
    commit_count_4_weeks: number | null;
  };
  last_updated: string;
};

async function fetchCoin(id: string): Promise<CoinDetail> {
  const url = new URL(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}`);
  url.searchParams.set('localization', 'false');
  url.searchParams.set('tickers', 'false');
  url.searchParams.set('community_data', 'true');
  url.searchParams.set('developer_data', 'true');
  url.searchParams.set('sparkline', 'true');
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  return r.json();
}

function fmtMoney(n: number | undefined | null, cur: Currency): string {
  if (n == null || !isFinite(n)) return '—';
  const sym = CURRENCY_SYMBOL[cur];
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sym}${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sym}${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sym}${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1) return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (abs >= 0.01) return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 8 })}`;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  return n.toLocaleString();
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  const r = Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2);
  return `${n >= 0 ? '+' : ''}${r}%`;
}

function toneFor(n: number | null | undefined): 'up' | 'down' | 'flat' {
  if (n == null || !isFinite(n)) return 'flat';
  if (n > 0.05) return 'up';
  if (n < -0.05) return 'down';
  return 'flat';
}

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return s; }
}

function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function BigSparkline({ prices, tone }: { prices: number[]; tone: 'up' | 'down' | 'flat' }) {
  if (prices.length < 2) return null;
  const W = 600, H = 120;
  let min = Infinity, max = -Infinity;
  for (const p of prices) { if (p < min) min = p; if (p > max) max = p; }
  const span = max - min || 1;
  const step = W / (prices.length - 1);
  let d = '';
  let area = '';
  for (let i = 0; i < prices.length; i++) {
    const x = i * step;
    const y = H - ((prices[i] - min) / span) * H;
    const cmd = i === 0 ? 'M' : 'L';
    d += `${cmd}${x.toFixed(1)},${y.toFixed(1)} `;
    area += `${cmd}${x.toFixed(1)},${y.toFixed(1)} `;
  }
  area += `L${W},${H} L0,${H} Z`;
  const colour = tone === 'up' ? 'var(--color-accent)' : tone === 'down' ? 'var(--color-alert)' : 'var(--color-fg-dim)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="big-spark" aria-hidden>
      <defs>
        <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.3" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#grad)" />
      <path d={d} fill="none" stroke={colour} strokeWidth={1.5} />
    </svg>
  );
}

export default function CryptoDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string };
  const [cur, setCur] = useState<Currency>('usd');

  const q = useQuery({
    queryKey: ['coin-detail', id],
    queryFn: () => fetchCoin(id),
    refetchInterval: 60_000,
    staleTime: 60_000,
  });

  if (q.isLoading && !q.data) {
    return (
      <main className="shell-cd"><div className="loading">loading…</div></main>
    );
  }
  if (q.isError || !q.data) {
    return (
      <>
        <style>{CSS}</style>
        <main className="shell-cd">
          <div className="err">
            couldn&apos;t load &quot;{id}&quot; from coingecko.
            <div style={{ marginTop: 12 }}><Link to="/labs/crypto" search={{ cur: undefined, period: undefined, q: undefined }} className="t-accent">← back</Link></div>
          </div>
        </main>
      </>
    );
  }

  const c = q.data;
  const md = c.market_data;
  const price = md.current_price[cur];
  const change24 = md.price_change_percentage_24h_in_currency[cur];
  const cur24Tone = toneFor(change24);
  const homepage = c.links.homepage.find(Boolean);
  const whitepaper = c.links.whitepaper;
  const repos = c.links.repos_url?.github ?? [];
  const explorers = c.links.blockchain_site.filter(Boolean).slice(0, 4);
  const description = stripHtml(c.description.en || '').trim();

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-cd">
        <nav className="crumb">
          <Link to="/labs/crypto" search={{ cur: undefined, period: undefined, q: undefined }} className="t-accent">← /labs/crypto</Link>
        </nav>

        <header className="hd">
          <img src={c.image.large} alt="" width={64} height={64} className="img" />
          <div className="hd-main">
            <div className="hd-top">
              <h1>{c.name}</h1>
              <span className="sym">{c.symbol.toUpperCase()}</span>
              {c.market_cap_rank ? <span className="rnk">rank #{c.market_cap_rank}</span> : null}
            </div>
            <div className="price">
              <span className="big-price">{fmtMoney(price, cur)}</span>
              <span className={`big-pct tone-${cur24Tone}`}>{fmtPct(change24)} <span className="k">24h</span></span>
            </div>
          </div>
          <div className="cur-seg">
            {(['usd', 'gbp', 'eur', 'jpy'] as Currency[]).map((x) => (
              <button key={x} className={`seg-btn ${cur === x ? 'on' : ''}`} onClick={() => setCur(x)}>{x}</button>
            ))}
          </div>
        </header>

        <section className="panel">
          <div className="panel-hd">7-day chart</div>
          <BigSparkline prices={md.sparkline_7d.price} tone={toneFor(md.price_change_percentage_7d_in_currency[cur])} />
        </section>

        <section className="panel">
          <div className="panel-hd">% change</div>
          <div className="pct-grid">
            {([
              ['1h', md.price_change_percentage_1h_in_currency[cur]],
              ['24h', md.price_change_percentage_24h_in_currency[cur]],
              ['7d', md.price_change_percentage_7d_in_currency[cur]],
              ['30d', md.price_change_percentage_30d_in_currency[cur]],
              ['1y', md.price_change_percentage_1y_in_currency[cur]],
            ] as Array<[string, number | null]>).map(([label, v]) => {
              const t = toneFor(v);
              return (
                <div key={label} className={`pct-cell tone-${t}`}>
                  <span className="k">{label}</span>
                  <b>{fmtPct(v)}</b>
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid">
          <div className="panel">
            <div className="panel-hd">market</div>
            <ul className="rows">
              <li><span>market cap</span><b>{fmtMoney(md.market_cap[cur], cur)}</b></li>
              <li><span>fully diluted</span><b>{fmtMoney(md.fully_diluted_valuation?.[cur], cur)}</b></li>
              <li><span>volume (24h)</span><b>{fmtMoney(md.total_volume[cur], cur)}</b></li>
              <li><span>24h high</span><b>{fmtMoney(md.high_24h[cur], cur)}</b></li>
              <li><span>24h low</span><b>{fmtMoney(md.low_24h[cur], cur)}</b></li>
            </ul>
          </div>

          <div className="panel">
            <div className="panel-hd">all-time extremes</div>
            <ul className="rows">
              <li>
                <span>all-time high</span>
                <b>
                  {fmtMoney(md.ath[cur], cur)}
                  <span className={`pct tone-${toneFor(md.ath_change_percentage[cur])}`}> · {fmtPct(md.ath_change_percentage[cur])}</span>
                </b>
              </li>
              <li><span>ath date</span><b>{fmtDate(md.ath_date[cur])}</b></li>
              <li>
                <span>all-time low</span>
                <b>
                  {fmtMoney(md.atl[cur], cur)}
                  <span className={`pct tone-${toneFor(md.atl_change_percentage[cur])}`}> · {fmtPct(md.atl_change_percentage[cur])}</span>
                </b>
              </li>
              <li><span>atl date</span><b>{fmtDate(md.atl_date[cur])}</b></li>
            </ul>
          </div>

          <div className="panel">
            <div className="panel-hd">supply</div>
            <ul className="rows">
              <li><span>circulating</span><b>{fmtNum(md.circulating_supply)}</b></li>
              <li><span>total</span><b>{fmtNum(md.total_supply)}</b></li>
              <li><span>max</span><b>{md.max_supply == null ? '∞' : fmtNum(md.max_supply)}</b></li>
              {c.genesis_date ? <li><span>genesis</span><b>{fmtDate(c.genesis_date)}</b></li> : null}
              {c.hashing_algorithm ? <li><span>hash algo</span><b>{c.hashing_algorithm}</b></li> : null}
            </ul>
          </div>

          {(c.community_data.twitter_followers ?? c.community_data.reddit_subscribers ?? c.community_data.telegram_channel_user_count) ? (
            <div className="panel">
              <div className="panel-hd">community</div>
              <ul className="rows">
                {c.community_data.twitter_followers ? <li><span>twitter</span><b>{fmtNum(c.community_data.twitter_followers)}</b></li> : null}
                {c.community_data.reddit_subscribers ? <li><span>reddit</span><b>{fmtNum(c.community_data.reddit_subscribers)}</b></li> : null}
                {c.community_data.telegram_channel_user_count ? <li><span>telegram</span><b>{fmtNum(c.community_data.telegram_channel_user_count)}</b></li> : null}
              </ul>
            </div>
          ) : null}

          {c.developer_data.stars ? (
            <div className="panel">
              <div className="panel-hd">github</div>
              <ul className="rows">
                <li><span>stars</span><b>{fmtNum(c.developer_data.stars)}</b></li>
                <li><span>forks</span><b>{fmtNum(c.developer_data.forks)}</b></li>
                <li><span>issues</span><b>{fmtNum(c.developer_data.closed_issues)} / {fmtNum(c.developer_data.total_issues)}</b></li>
                <li><span>merged prs</span><b>{fmtNum(c.developer_data.pull_requests_merged)}</b></li>
                <li><span>pr contribs</span><b>{fmtNum(c.developer_data.pull_request_contributors)}</b></li>
                <li><span>commits (4w)</span><b>{fmtNum(c.developer_data.commit_count_4_weeks)}</b></li>
              </ul>
            </div>
          ) : null}
        </section>

        {description ? (
          <section className="panel">
            <div className="panel-hd">about</div>
            <p className="desc">{description}</p>
          </section>
        ) : null}

        {(homepage || whitepaper || explorers.length || repos.length || c.links.twitter_screen_name || c.links.subreddit_url) ? (
          <section className="panel">
            <div className="panel-hd">links</div>
            <ul className="links">
              {homepage ? <li><span className="k">web</span><a href={homepage} target="_blank" rel="noreferrer noopener">{hostname(homepage)}</a></li> : null}
              {whitepaper ? <li><span className="k">whitepaper</span><a href={whitepaper} target="_blank" rel="noreferrer noopener">{hostname(whitepaper)}</a></li> : null}
              {explorers.map((e) => (
                <li key={e}><span className="k">explorer</span><a href={e} target="_blank" rel="noreferrer noopener">{hostname(e)}</a></li>
              ))}
              {repos.slice(0, 3).map((r) => (
                <li key={r}><span className="k">github</span><a href={r} target="_blank" rel="noreferrer noopener">{r.replace('https://github.com/', '')}</a></li>
              ))}
              {c.links.twitter_screen_name ? (
                <li><span className="k">twitter</span><a href={`https://twitter.com/${c.links.twitter_screen_name}`} target="_blank" rel="noreferrer noopener">@{c.links.twitter_screen_name}</a></li>
              ) : null}
              {c.links.subreddit_url ? (
                <li><span className="k">reddit</span><a href={c.links.subreddit_url} target="_blank" rel="noreferrer noopener">{hostname(c.links.subreddit_url)}</a></li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {c.categories.filter(Boolean).length > 0 ? (
          <section className="panel">
            <div className="panel-hd">categories</div>
            <div className="cats">
              {c.categories.filter(Boolean).map((cat) => <span key={cat} className="cat">{cat}</span>)}
            </div>
          </section>
        ) : null}

        <footer className="labs-footer">
          <span>source · <span className="t-accent">coingecko /coins/{c.id}</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-cd { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }
  .loading { padding: 80px 0; text-align: center; color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-sm); }
  .err { margin-top: var(--sp-8); padding: var(--sp-4); border: 1px solid var(--color-alert); color: var(--color-alert); font-family: var(--font-mono); font-size: var(--fs-sm); }

  .crumb { padding-top: var(--sp-6); font-family: var(--font-mono); font-size: var(--fs-xs); }

  .hd {
    margin-top: var(--sp-4);
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: var(--sp-4);
    align-items: center;
    padding: var(--sp-4) 0 var(--sp-4);
    border-bottom: 1px solid var(--color-border);
  }
  .img { width: 64px; height: 64px; object-fit: contain; }
  .hd-top { display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; }
  .hd h1 { font-family: var(--font-display); font-size: clamp(36px, 6vw, 56px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 1; }
  .sym { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-md); letter-spacing: 0.08em; }
  .rnk { color: var(--color-accent); font-family: var(--font-mono); font-size: var(--fs-xs); padding: 2px 8px; border: 1px solid var(--color-accent-dim); text-transform: uppercase; letter-spacing: 0.08em; }
  .price { margin-top: 8px; display: flex; align-items: baseline; gap: var(--sp-3); flex-wrap: wrap; }
  .big-price { font-family: var(--font-display); font-size: clamp(28px, 5vw, 44px); color: var(--color-fg); letter-spacing: -0.02em; }
  .big-pct { font-family: var(--font-mono); font-size: var(--fs-md); font-weight: 500; }
  .big-pct .k { color: var(--color-fg-faint); font-weight: 400; margin-left: 4px; text-transform: uppercase; font-size: 0.7em; letter-spacing: 0.08em; }
  .tone-up { color: var(--color-accent); }
  .tone-down { color: var(--color-alert); }
  .tone-flat { color: var(--color-fg-dim); }

  .cur-seg { display: inline-flex; border: 1px solid var(--color-border); align-self: center; }
  .seg-btn { background: transparent; border: 0; color: var(--color-fg-dim); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); cursor: pointer; text-transform: uppercase; letter-spacing: 0.08em; }
  .seg-btn + .seg-btn { border-left: 1px solid var(--color-border); }
  .seg-btn.on { color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 6%, transparent); }

  .panel { margin-top: var(--sp-4); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .panel-hd { padding: 8px var(--sp-3); border-bottom: 1px solid var(--color-border); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .big-spark { display: block; width: 100%; height: 160px; padding: var(--sp-3); }

  .pct-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); }
  .pct-cell { display: flex; flex-direction: column; gap: 4px; padding: var(--sp-3); border-right: 1px solid var(--color-border); font-family: var(--font-mono); }
  .pct-cell:last-child { border-right: 0; }
  .pct-cell .k { color: var(--color-fg-faint); font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.08em; }
  .pct-cell b { font-weight: 500; font-size: var(--fs-md); }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--sp-3); }
  .grid .panel { margin-top: 0; }

  .rows { list-style: none; }
  .rows li { display: flex; justify-content: space-between; gap: var(--sp-3); padding: 6px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-xs); border-bottom: 1px dashed var(--color-border); align-items: baseline; }
  .rows li:last-child { border-bottom: 0; }
  .rows li > span:first-child { color: var(--color-fg-faint); }
  .rows li b { color: var(--color-fg); font-weight: 400; }
  .rows .pct { font-weight: 400; }

  .desc { padding: var(--sp-3) var(--sp-4); color: var(--color-fg-dim); font-size: var(--fs-sm); line-height: 1.6; max-height: 260px; overflow-y: auto; }

  .links { list-style: none; padding: var(--sp-3); display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .links li { display: grid; grid-template-columns: 90px 1fr; gap: var(--sp-2); }
  .links .k { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .links a { color: var(--color-fg); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .links a:hover { color: var(--color-accent); text-decoration: none; }

  .cats { display: flex; gap: 4px; flex-wrap: wrap; padding: var(--sp-3); }
  .cat { padding: 2px 8px; border: 1px solid var(--color-border); color: var(--color-fg-dim); font-family: var(--font-mono); font-size: var(--fs-xs); text-transform: lowercase; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;

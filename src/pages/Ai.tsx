import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { SITE } from '../data';
import { getAiUsage, type AiContribution, type AiModelUsage, type AiUsage } from '../server/tokscale';

// ─── formatters ────────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return n.toString();
}
function fmtCost(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(2)}k`;
  return `$${n.toFixed(2)}`;
}
function fmtRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ─── heatmap (53 weeks × 7 days, most recent at the right) ────────────────

function Heatmap({ days }: { days: AiContribution[] }) {
  const WEEKS = 53;
  const cols: (AiContribution | null)[][] = Array.from({ length: WEEKS }, () => Array(7).fill(null));

  if (days.length === 0) return <div className="hm-grid" aria-label="daily ai usage heatmap" />;

  // Align days to calendar weeks: col = WEEKS-1 for the week containing the
  // most recent day, each earlier calendar week shifts one column left.
  const endDate = new Date(days[days.length - 1].date + 'T00:00:00Z');
  const endSundayMs = endDate.getTime() - endDate.getUTCDay() * 86400000;
  for (const d of days) {
    const dt = new Date(d.date + 'T00:00:00Z');
    const dow = dt.getUTCDay();
    const thisSundayMs = dt.getTime() - dow * 86400000;
    const weeksAgo = Math.round((endSundayMs - thisSundayMs) / (7 * 86400000));
    const col = WEEKS - 1 - weeksAgo;
    if (col >= 0 && col < WEEKS) cols[col][dow] = d;
  }

  return (
    <div className="hm-grid" role="img" aria-label="daily ai usage heatmap">
      {cols.map((col, ci) => (
        <div key={ci} className="hm-wk">
          {col.map((d, ri) =>
            d ? (
              <div
                key={d.date}
                className={`hm-d l${Math.min(4, d.intensity)}`}
                data-tip={`${d.date} · ${fmtTokens(d.totals.tokens)} tokens · ${fmtCost(d.totals.cost)}`}
              />
            ) : (
              <div key={`e${ci}-${ri}`} className="hm-d empty" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

// ─── model / client / token-type bars ─────────────────────────────────────

function ModelBars({ models }: { models: AiModelUsage[] }) {
  const sorted = [...models].sort((a, b) => b.cost - a.cost);
  const max = sorted[0]?.cost ?? 1;
  return (
    <div className="mdl-list">
      {sorted.map((m) => (
        <div key={m.model} className="mdl-row">
          <span className="mdl-name" title={m.model}>{m.model}</span>
          <div className="mdl-track">
            <div className="mdl-fill" style={{ width: `${(m.cost / max) * 100}%` }} />
          </div>
          <span className="mdl-val">{fmtCost(m.cost)}</span>
          <span className="mdl-pct">{m.percentage.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function TokenDonut({ stats }: { stats: AiUsage['stats'] }) {
  const slices = [
    { label: 'cache read', value: stats.cacheReadTokens, color: 'var(--color-accent)' },
    { label: 'cache write', value: stats.cacheWriteTokens, color: 'oklch(0.78 0.11 210)' },
    { label: 'input', value: stats.inputTokens, color: 'oklch(0.82 0.13 85)' },
    { label: 'output', value: stats.outputTokens, color: 'oklch(0.72 0.18 320)' },
    { label: 'reasoning', value: stats.reasoningTokens, color: 'oklch(0.72 0.18 25)' },
  ];
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="token type breakdown">
        <circle cx="70" cy="70" r="50" fill="none" stroke="var(--color-border)" strokeWidth="14" />
        {slices.map((s) => {
          const frac = s.value / total;
          const C = 2 * Math.PI * 50;
          const dasharray = `${frac * C} ${C}`;
          const el = (
            <circle
              key={s.label}
              cx="70"
              cy="70"
              r="50"
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={dasharray}
              strokeDashoffset={-offset * C}
              transform="rotate(-90 70 70)"
            />
          );
          offset += frac;
          return el;
        })}
        <text
          x="70"
          y="68"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontSize="22"
          fill="var(--color-fg)"
        >
          {fmtTokens(total)}
        </text>
        <text
          x="70"
          y="86"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="var(--color-fg-faint)"
          letterSpacing="2"
        >
          TOKENS
        </text>
      </svg>
      <dl className="donut-legend">
        {slices.map((s) => (
          <div key={s.label} className="donut-row">
            <span className="dot" style={{ background: s.color }} />
            <dt>{s.label}</dt>
            <dd>{fmtTokens(s.value)}</dd>
            <dd className="pct">{((s.value / total) * 100).toFixed(1)}%</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function AiPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['tokscale', 'imlunahey'],
    queryFn: () => getAiUsage(),
  });

  if (isLoading) {
    return (
      <main className="shell-ai">
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--color-fg-faint)', fontFamily: 'var(--font-mono)' }}>
          loading usage…
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="shell-ai">
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--color-fg-faint)' }}>
          couldn&apos;t reach tokscale. try again later.
        </div>
      </main>
    );
  }

  return <AiPageBody data={data} />;
}

function AiPageBody({ data }: { data: AiUsage }) {
  const { stats, user, dateRange, modelUsage, contributions, clients, models, freshness } = data;

  const clientTotals = useMemo(() => {
    const m = new Map<string, { cost: number; tokens: number }>();
    for (const c of clients) m.set(c, { cost: 0, tokens: 0 });
    for (const day of contributions) {
      for (const c of day.clients) {
        const row = m.get(c.client) ?? { cost: 0, tokens: 0 };
        const tokenSum =
          c.tokens.input + c.tokens.output + c.tokens.cacheRead + c.tokens.cacheWrite + c.tokens.reasoning;
        m.set(c.client, { cost: row.cost + c.cost, tokens: row.tokens + tokenSum });
      }
    }
    return [...m.entries()]
      .map(([client, v]) => ({ client, ...v }))
      .sort((a, b) => b.cost - a.cost);
  }, [clients, contributions]);

  const avgDaily = stats.activeDays > 0 ? stats.totalCost / stats.activeDays : 0;
  const avgMessages = useMemo(() => {
    let total = 0;
    for (const d of contributions) for (const c of d.clients) total += c.messages;
    return total;
  }, [contributions]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-ai">
        <header className="page-hd">
          <div className="label">~/ai</div>
          <h1>
            ai<span className="dot">.</span>
          </h1>
          <p className="sub">
            every token spent across <b className="t-accent">{clients.length}</b> clients — {clients.join(', ')} —
            logged by{' '}
            <a href={`https://tokscale.ai/users/${user.username}`} target="_blank" rel="noopener noreferrer" className="t-accent">
              tokscale
            </a>
            . if it costs money, someone should probably see the bill.
          </p>
          <div className="meta">
            <span>
              rank <b className="t-accent">#{user.rank}</b>
            </span>
            <span>
              range <b>{dateRange.start} → {dateRange.end}</b>
            </span>
            <span>
              cli <b>{freshness.cliVersion}</b>
            </span>
            <span>
              synced <b className={freshness.isStale ? 't-warn' : 't-accent'}>{fmtRel(freshness.lastUpdated)}</b>
            </span>
          </div>
        </header>

        {/* 01 · HEADLINE */}
        <div className="section-hd">
          <h2><span className="num">01 //</span>spend.</h2>
          <span className="src">totals since {dateRange.start}</span>
        </div>
        <section className="bento">
          <div className="panel c-cost">
            <div className="panel-hd"><span className="ttl">./cost --total</span><span className="src-tag">// usd</span></div>
            <div className="big-num">
              <span className="num-val">{fmtCost(stats.totalCost)}</span>
              <span className="num-unit">burned</span>
            </div>
            <div className="stat-line">
              <span>avg <b>{fmtCost(avgDaily)}/active day</b></span>
              <span>·</span>
              <span>{stats.activeDays}d active</span>
            </div>
          </div>

          <div className="panel c-tokens">
            <div className="panel-hd"><span className="ttl">./tokens --total</span><span className="src-tag">// counted</span></div>
            <div className="big-num">
              <span className="num-val">{fmtTokens(stats.totalTokens)}</span>
              <span className="num-unit">tokens</span>
            </div>
            <div className="stat-line">
              <span>{fmtTokens(avgMessages)} messages</span>
              <span>·</span>
              <span>{stats.submissionCount} submissions</span>
            </div>
          </div>

          <div className="panel c-cache">
            <div className="panel-hd"><span className="ttl">./cache --hit</span><span className="src-tag">// prompt caching</span></div>
            <div className="big-num">
              <span className="num-val">
                {((stats.cacheReadTokens / stats.totalTokens) * 100).toFixed(1)}%
              </span>
              <span className="num-unit">hit rate</span>
            </div>
            <div className="stat-line">
              <span>read <b>{fmtTokens(stats.cacheReadTokens)}</b></span>
              <span>·</span>
              <span>write <b>{fmtTokens(stats.cacheWriteTokens)}</b></span>
            </div>
          </div>
        </section>

        {/* 02 · HEATMAP */}
        <div className="section-hd">
          <h2><span className="num">02 //</span>activity.</h2>
          <span className="src">each cell = one day · darker = more tokens</span>
        </div>
        <section>
          <div className="panel c-hm">
            <div className="panel-hd"><span className="ttl">daily tokens</span><span className="src-tag">// {contributions.length} days tracked</span></div>
            <div className="c-hm-scroll">
              <Heatmap days={contributions} />
            </div>
            <div className="legend">
              <span className="t-faint">less</span>
              <span className="hm-key l0" />
              <span className="hm-key l1" />
              <span className="hm-key l2" />
              <span className="hm-key l3" />
              <span className="hm-key l4" />
              <span className="t-faint">more</span>
            </div>
          </div>
        </section>

        {/* 03 · MODELS */}
        <div className="section-hd">
          <h2><span className="num">03 //</span>models.</h2>
          <span className="src">{models.length} models · sorted by $ spent</span>
        </div>
        <section>
          <div className="panel c-mdl">
            <div className="panel-hd"><span className="ttl">model · $ · %</span><span className="src-tag">// where the bill went</span></div>
            <ModelBars models={modelUsage} />
          </div>
        </section>

        {/* 04 · TOKEN MIX */}
        <div className="section-hd">
          <h2><span className="num">04 //</span>token mix.</h2>
          <span className="src">most of these are cache reads — the model was just remembering stuff</span>
        </div>
        <section>
          <div className="panel c-donut">
            <div className="panel-hd"><span className="ttl">token types</span><span className="src-tag">// input · output · cache · reasoning</span></div>
            <TokenDonut stats={stats} />
          </div>
        </section>

        {/* 05 · CLIENTS */}
        <div className="section-hd">
          <h2><span className="num">05 //</span>clients.</h2>
          <span className="src">which cli burned what</span>
        </div>
        <section>
          <div className="panel c-clients">
            <div className="panel-hd"><span className="ttl">./clients</span><span className="src-tag">// aggregated from {contributions.length} days</span></div>
            <table className="cli-table">
              <thead>
                <tr>
                  <th>client</th>
                  <th>cost</th>
                  <th>tokens</th>
                  <th>share</th>
                </tr>
              </thead>
              <tbody>
                {clientTotals.map((c) => (
                  <tr key={c.client}>
                    <td className="cli-name">{c.client}</td>
                    <td className="cli-cost">{fmtCost(c.cost)}</td>
                    <td className="cli-tokens">{fmtTokens(c.tokens)}</td>
                    <td className="cli-share">
                      {((c.cost / stats.totalCost) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="ai-footer">
          <span>
            src: <span className="t-accent">tokscale.ai/api/users/{user.username}</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">home</Link>
          </span>
        </footer>
        <div className="sig">
          <span className="t-faint">personal site · {SITE.name}</span>
        </div>
      </main>
    </>
  );
}

const CSS = `
  .shell-ai { max-width: 1200px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: 8px; }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em;
    color: var(--color-fg); line-height: 0.9;
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 70ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub b.t-accent { color: var(--color-accent); font-weight: 400; }
  .page-hd .meta {
    display: flex; gap: var(--sp-5); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }
  .page-hd .meta b.t-warn { color: var(--color-warn); }

  .section-hd {
    display: flex; align-items: baseline; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-4);
  }
  .section-hd h2 { font-family: var(--font-display); font-size: 28px; font-weight: 500; color: var(--color-fg); letter-spacing: -0.02em; }
  .section-hd h2 .num { color: var(--color-accent); font-family: var(--font-mono); font-size: 13px; margin-right: 12px; letter-spacing: 0.08em; }
  .section-hd .src { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }

  .bento {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-auto-rows: minmax(110px, auto);
    gap: var(--sp-3);
  }
  .shell-ai .panel {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    display: flex; flex-direction: column; gap: var(--sp-3);
    min-width: 0;
    overflow: visible;
  }
  .shell-ai .panel-hd {
    display: flex; justify-content: space-between; align-items: center; gap: var(--sp-3);
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.14em;
    padding-bottom: 6px;
    border-bottom: 1px dashed var(--color-border);
  }
  .shell-ai .panel-hd .ttl { color: var(--color-accent); }

  .c-cost   { grid-column: span 4; }
  .c-tokens { grid-column: span 4; }
  .c-cache  { grid-column: span 4; }

  .big-num { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
  .big-num .num-val {
    font-family: var(--font-display);
    font-size: clamp(30px, 4vw, 44px);
    line-height: 1;
    color: var(--color-accent);
    text-shadow: 0 0 12px var(--accent-glow);
    white-space: nowrap;
  }
  .big-num .num-unit {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    letter-spacing: 0.08em;
  }
  .stat-line {
    display: flex; gap: 8px; flex-wrap: wrap; align-items: baseline;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .stat-line b { color: var(--color-fg); font-weight: 400; }

  /* heatmap — tooltips must escape the panel, so scroll ONLY on phones.
     on desktop the 53-column grid fits the panel and tooltips pop freely. */
  .c-hm-scroll { overflow: visible; }
  .hm-grid {
    display: grid;
    grid-template-columns: repeat(53, 1fr);
    gap: 2px;
    overflow: visible;
  }
  .hm-wk { display: flex; flex-direction: column; gap: 2px; }
  .hm-d {
    width: 100%;
    aspect-ratio: 1;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    position: relative;
  }
  .hm-d.empty { visibility: hidden; }
  .hm-d.l1 { background: color-mix(in oklch, var(--color-accent) 28%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 30%, var(--color-bg)); }
  .hm-d.l2 { background: color-mix(in oklch, var(--color-accent) 55%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 55%, var(--color-bg)); }
  .hm-d.l3 { background: color-mix(in oklch, var(--color-accent) 80%, var(--color-bg)); border-color: color-mix(in oklch, var(--color-accent) 80%, var(--color-bg)); }
  .hm-d.l4 { background: var(--color-accent); border-color: var(--color-accent); box-shadow: 0 0 4px var(--accent-glow); }
  .shell-ai [data-tip] { position: relative; }
  .shell-ai [data-tip]::after {
    content: attr(data-tip);
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    padding: 4px 8px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.08s ease;
    z-index: 1000;
  }
  .shell-ai [data-tip]:hover::after { opacity: 1; }
  .legend { display: flex; gap: 3px; align-items: center; margin-top: 8px; font-family: var(--font-mono); font-size: 10px; color: var(--color-fg-faint); }
  .hm-key { display: inline-block; width: 10px; height: 10px; }
  .hm-key.l0 { background: var(--color-bg-raised); border: 1px solid var(--color-border); }
  .hm-key.l1 { background: color-mix(in oklch, var(--color-accent) 25%, var(--color-bg)); }
  .hm-key.l2 { background: color-mix(in oklch, var(--color-accent) 50%, var(--color-bg)); }
  .hm-key.l3 { background: color-mix(in oklch, var(--color-accent) 75%, var(--color-bg)); }
  .hm-key.l4 { background: var(--color-accent); }

  /* model bars */
  .mdl-list { display: flex; flex-direction: column; gap: 6px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .mdl-row {
    display: grid;
    grid-template-columns: minmax(0, 200px) 1fr 80px 56px;
    gap: var(--sp-3);
    align-items: center;
  }
  .mdl-name { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mdl-track { height: 8px; background: var(--color-border); position: relative; overflow: hidden; }
  .mdl-fill {
    height: 100%;
    background: var(--color-accent);
    box-shadow: 0 0 4px var(--accent-glow);
    transition: width 0.2s ease;
  }
  .mdl-val { color: var(--color-fg); text-align: right; }
  .mdl-pct { color: var(--color-fg-faint); text-align: right; }

  /* donut */
  .donut-wrap {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--sp-5);
    align-items: center;
  }
  .donut-legend {
    display: grid;
    /* dot | label fills row | token count | percent — the 1fr keeps values
       flush right so rows look like a proper stat line, not scattered. */
    grid-template-columns: 10px 1fr auto auto;
    gap: 6px 10px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    margin: 0;
  }
  .donut-row { display: contents; }
  .donut-row .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .donut-row dt { color: var(--color-fg-faint); text-transform: lowercase; }
  .donut-row dd { color: var(--color-fg); margin: 0; text-align: right; }
  .donut-row dd.pct { color: var(--color-fg-faint); min-width: 48px; }

  /* clients table */
  .cli-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .cli-table th {
    text-align: left;
    padding: 8px 12px;
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.14em;
    border-bottom: 1px solid var(--color-border-bright);
    font-weight: 400;
  }
  .cli-table td {
    padding: 8px 12px;
    border-bottom: 1px dashed var(--color-border);
  }
  .cli-table .cli-name { color: var(--color-accent); }
  .cli-table .cli-cost { color: var(--color-fg); }
  .cli-table .cli-tokens { color: var(--color-fg-dim); }
  .cli-table .cli-share { color: var(--color-fg-faint); }

  .ai-footer {
    display: flex; justify-content: space-between;
    gap: var(--sp-4); flex-wrap: wrap;
    padding: var(--sp-8) 0 var(--sp-4);
    margin-top: var(--sp-8);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .sig { text-align: center; padding-bottom: var(--sp-10); font-family: var(--font-mono); font-size: 10px; }
  .sig .t-faint { color: var(--color-fg-ghost); }

  @media (max-width: 980px) {
    .bento { grid-template-columns: repeat(6, 1fr); }
    .bento > * { grid-column: span 6 !important; }
  }
  @media (max-width: 560px) {
    .shell-ai { padding: 0 var(--sp-4); }
    .page-hd { padding-top: 48px; }
    /* heatmap needs horizontal scroll on phones so each cell is tappable.
       tooltips will clip against the scroll container, but bars are readable
       and the number lives in the cell color + legend. */
    .c-hm-scroll {
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      margin: 0 calc(-1 * var(--sp-4));
      padding: 0 var(--sp-4);
    }
    .c-hm-scroll::-webkit-scrollbar { display: none; }
    .hm-grid { min-width: 640px; }
    .mdl-row { grid-template-columns: 1fr auto; grid-template-areas: "name val" "track track" "pct pct"; row-gap: 2px; }
    .mdl-name { grid-area: name; }
    .mdl-track { grid-area: track; }
    .mdl-val { grid-area: val; text-align: right; }
    .mdl-pct { grid-area: pct; text-align: left; font-size: 10px; }
    .donut-wrap { grid-template-columns: 1fr; justify-items: center; gap: var(--sp-3); }
    .donut-legend { grid-template-columns: auto auto auto; }
    .donut-row dd.pct { display: none; }
  }
`;

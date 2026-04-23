import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  TYPE_COLORS,
  findRun,
  hasPokedex,
  padDex,
  spriteUrl,
  type CaughtPokemon,
  type PokeType,
} from './pokedex-data';

export { hasPokedex };

export default function PokedexPanel({ title, rkey }: { title: string; rkey: string }) {
  const run = findRun(title);
  const [filter, setFilter] = useState<'all' | 'shiny' | PokeType>('all');
  const [sort, setSort] = useState<'dex' | 'caught' | 'level'>('dex');

  const types = useMemo(() => {
    if (!run) return [] as PokeType[];
    const s = new Set<PokeType>();
    for (const p of run.caught) for (const t of p.types) s.add(t);
    return Array.from(s).sort();
  }, [run]);

  const visible = useMemo(() => {
    if (!run) return [];
    const arr = run.caught.filter((p) => {
      if (filter === 'all') return true;
      if (filter === 'shiny') return p.shiny === true;
      return p.types.includes(filter);
    });
    const sorted = [...arr];
    if (sort === 'dex') sorted.sort((a, b) => a.id - b.id);
    else if (sort === 'level') sorted.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
    else if (sort === 'caught') sorted.sort((a, b) => (a.caughtAt ?? '').localeCompare(b.caughtAt ?? ''));
    return sorted;
  }, [run, filter, sort]);

  if (!run) return null;

  const registered = run.caught.length;
  const pct = Math.min(100, (registered / run.regionalDexTotal) * 100);
  const shinyCount = run.caught.filter((p) => p.shiny).length;
  const maxLevel = run.caught.reduce((m, p) => Math.max(m, p.level ?? 0), 0);

  return (
    <>
      <style>{CSS}</style>
      <section className="pdx">
        <header className="pdx-hd">
          <div className="pdx-hd-l">
            <div className="pdx-label">── pokédex · {run.region.toLowerCase()}</div>
            <h2 className="pdx-title">{run.gameName.toLowerCase()}</h2>
          </div>
          <div className="pdx-stats">
            <Stat label="registered" value={`${registered} / ${run.regionalDexTotal}`} />
            <Stat label="shinies" value={shinyCount} accent />
            <Stat label="top lv" value={maxLevel || '—'} />
          </div>
        </header>

        <div className="pdx-progress-wrap">
          <div className="pdx-progress-lbl">
            <span>completion</span>
            <span className="pdx-progress-pct">{pct.toFixed(1)}%</span>
          </div>
          <div className="pdx-progress">
            <div className="pdx-progress-fill" style={{ width: `${pct}%` }} />
            <div className="pdx-progress-ticks" aria-hidden>
              {Array.from({ length: 20 }).map((_, i) => <span key={i} />)}
            </div>
          </div>
        </div>

        <div className="pdx-controls">
          <div className="pdx-filter-grp">
            <span className="pdx-ctrl-lbl">filter</span>
            <button className={`pdx-chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>all</button>
            <button
              className={`pdx-chip ${filter === 'shiny' ? 'on' : ''}`}
              onClick={() => setFilter('shiny')}
              style={filter === 'shiny' ? { borderColor: '#ffd700', color: '#ffd700' } : undefined}
            >★ shiny</button>
            {types.map((t) => (
              <button
                key={t}
                className={`pdx-chip ${filter === t ? 'on' : ''}`}
                onClick={() => setFilter(t)}
                style={filter === t ? { borderColor: TYPE_COLORS[t], color: TYPE_COLORS[t] } : undefined}
              >
                <span className="pdx-type-dot" style={{ background: TYPE_COLORS[t] }} />
                {t}
              </button>
            ))}
          </div>
          <div className="pdx-filter-grp">
            <span className="pdx-ctrl-lbl">sort</span>
            <button className={`pdx-chip ${sort === 'dex' ? 'on' : ''}`} onClick={() => setSort('dex')}>dex</button>
            <button className={`pdx-chip ${sort === 'caught' ? 'on' : ''}`} onClick={() => setSort('caught')}>caught</button>
            <button className={`pdx-chip ${sort === 'level' ? 'on' : ''}`} onClick={() => setSort('level')}>level</button>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="pdx-empty">no matches for this filter.</div>
        ) : (
          <div className="pdx-grid">
            {visible.map((p) => <PokeCard key={`${p.id}-${p.caughtAt ?? ''}`} p={p} rkey={rkey} />)}
          </div>
        )}

        <footer className="pdx-footer">
          <span>src: <span className="t-accent">local pokédex</span></span>
          <span>sprites · pokeapi/sprites</span>
        </footer>
      </section>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="pdx-stat">
      <div className="pdx-stat-lbl">{label}</div>
      <div className={`pdx-stat-val ${accent ? 'accent' : ''}`}>{value}</div>
    </div>
  );
}

function PokeCard({ p, rkey }: { p: CaughtPokemon; rkey: string }) {
  const primary = TYPE_COLORS[p.types[0]];
  const secondary = p.types[1] ? TYPE_COLORS[p.types[1]] : primary;
  return (
    <Link
      to={`/pokedex/${rkey}/${p.id}` as never}
      className={`poke ${p.shiny ? 'is-shiny' : ''}`}
      style={{ ['--t1' as string]: primary, ['--t2' as string]: secondary }}
    >
      <div className="poke-sprite-wrap">
        <div className="poke-dex">{padDex(p.id)}</div>
        {p.shiny ? <div className="poke-shiny" title="shiny">★</div> : null}
        <img
          className="poke-sprite"
          src={spriteUrl(p.id, p.shiny)}
          alt={p.name}
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src.includes('/shiny/')) img.src = spriteUrl(p.id, false);
          }}
        />
      </div>
      <div className="poke-body">
        <div className="poke-name-row">
          <span className="poke-name">{p.nickname ?? p.name.toLowerCase()}</span>
          {p.level != null ? <span className="poke-lv">lv.{p.level}</span> : null}
        </div>
        {p.nickname ? <div className="poke-species">{p.name.toLowerCase()}</div> : null}
        <div className="poke-types">
          {p.types.map((t) => (
            <span key={t} className="poke-type" style={{ background: TYPE_COLORS[t] }}>{t}</span>
          ))}
        </div>
        {p.location || p.caughtAt ? (
          <div className="poke-meta">
            {p.location ? <span className="poke-loc">{p.location.toLowerCase()}</span> : null}
            {p.caughtAt ? <span className="poke-when">{p.caughtAt}</span> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

const CSS = `
  .pdx {
    margin-top: var(--sp-8);
    padding-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
  }

  .pdx-hd {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: var(--sp-6);
    flex-wrap: wrap;
    margin-bottom: var(--sp-5);
  }
  .pdx-label {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: var(--sp-2);
  }
  .pdx-title {
    font-family: var(--font-display);
    font-size: clamp(28px, 4.5vw, 42px);
    font-weight: 500;
    line-height: 1;
    color: var(--color-fg);
    letter-spacing: -0.02em;
  }
  .pdx-stats {
    display: flex;
    gap: var(--sp-6);
    flex-wrap: wrap;
  }
  .pdx-stat-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.05em;
  }
  .pdx-stat-val {
    font-family: var(--font-display);
    font-size: var(--fs-2xl);
    color: var(--color-fg);
    font-weight: 500;
    line-height: 1.1;
  }
  .pdx-stat-val.accent { color: #ffd700; text-shadow: 0 0 12px rgba(255, 215, 0, 0.4); }

  .pdx-progress-wrap {
    margin-bottom: var(--sp-5);
  }
  .pdx-progress-lbl {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    margin-bottom: 6px;
    text-transform: lowercase;
  }
  .pdx-progress-pct { color: var(--color-accent); }
  .pdx-progress {
    position: relative;
    height: 14px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    overflow: hidden;
  }
  .pdx-progress-fill {
    height: 100%;
    background: linear-gradient(to right,
      color-mix(in oklch, var(--color-accent) 55%, transparent),
      var(--color-accent));
    box-shadow: 0 0 12px var(--accent-glow);
    transition: width 0.6s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  .pdx-progress-ticks {
    position: absolute; inset: 0;
    display: grid; grid-template-columns: repeat(20, 1fr);
    pointer-events: none;
  }
  .pdx-progress-ticks span {
    border-right: 1px solid rgba(0, 0, 0, 0.5);
  }
  .pdx-progress-ticks span:last-child { border-right: 0; }

  .pdx-controls {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
    margin-bottom: var(--sp-5);
    padding: var(--sp-3);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .pdx-filter-grp {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .pdx-ctrl-lbl {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-right: 4px;
    min-width: 48px;
  }
  .pdx-chip {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
    padding: 3px 8px;
    cursor: pointer;
    text-transform: lowercase;
    display: inline-flex; align-items: center; gap: 5px;
    transition: all 0.12s;
  }
  .pdx-chip:hover { border-color: var(--color-border-bright); color: var(--color-fg); }
  .pdx-chip.on {
    border-color: var(--color-accent-dim);
    color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
  }
  .pdx-type-dot {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 50%;
  }

  .pdx-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: var(--sp-3);
  }

  .poke {
    position: relative;
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: var(--sp-2);
    padding: var(--sp-2);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    overflow: hidden;
    transition: transform 0.15s, border-color 0.15s;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  .poke:hover { text-decoration: none; }
  .poke::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--t1) 10%, transparent) 0%,
      transparent 50%,
      color-mix(in srgb, var(--t2) 10%, transparent) 100%);
    pointer-events: none;
  }
  .poke:hover {
    border-color: var(--color-accent-dim);
    transform: translateY(-2px);
  }
  .poke:hover .poke-name { color: var(--color-accent); }
  .poke.is-shiny {
    border-color: color-mix(in srgb, #ffd700 35%, var(--color-border));
    box-shadow: inset 0 0 0 1px rgba(255, 215, 0, 0.15);
  }
  .poke.is-shiny::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(120deg,
      transparent 30%,
      rgba(255, 215, 0, 0.08) 50%,
      transparent 70%);
    background-size: 200% 200%;
    animation: shiny-shimmer 2.4s linear infinite;
    pointer-events: none;
  }
  @keyframes shiny-shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }

  .poke-sprite-wrap {
    position: relative;
    width: 96px; height: 96px;
    background:
      radial-gradient(circle at center,
        color-mix(in srgb, var(--t1) 18%, transparent) 0%,
        transparent 70%),
      var(--color-bg-raised);
    border: 1px solid var(--color-border);
    display: flex; align-items: center; justify-content: center;
  }
  .poke-sprite {
    width: 80px; height: 80px;
    object-fit: contain;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--t1) 30%, transparent));
  }
  .poke-dex {
    position: absolute;
    top: 3px; left: 4px;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-fg-faint);
    letter-spacing: 0.05em;
  }
  .poke-shiny {
    position: absolute;
    top: 3px; right: 5px;
    color: #ffd700;
    font-size: 11px;
    text-shadow: 0 0 6px rgba(255, 215, 0, 0.6);
  }

  .poke-body {
    min-width: 0;
    display: flex; flex-direction: column; gap: 4px;
    position: relative;
  }
  .poke-name-row {
    display: flex; justify-content: space-between; align-items: baseline;
    gap: 6px;
  }
  .poke-name {
    font-family: var(--font-display);
    font-size: var(--fs-lg);
    color: var(--color-fg);
    font-weight: 500;
    line-height: 1.1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    transition: color 0.12s;
  }
  .poke-lv {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-accent);
    flex-shrink: 0;
  }
  .poke-species {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: lowercase;
    letter-spacing: 0.04em;
    margin-top: -2px;
  }
  .poke-types {
    display: flex; gap: 3px; flex-wrap: wrap;
    margin-top: 2px;
  }
  .poke-type {
    font-family: var(--font-mono);
    font-size: 9px;
    color: #000;
    padding: 1px 5px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-weight: 600;
  }
  .poke-meta {
    margin-top: auto;
    display: flex; justify-content: space-between; gap: 4px;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-fg-faint);
  }
  .poke-loc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .poke-when { flex-shrink: 0; }

  .pdx-empty {
    padding: var(--sp-8);
    text-align: center;
    color: var(--color-fg-faint);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
  }

  .pdx-footer {
    display: flex;
    justify-content: space-between;
    padding: var(--sp-5) 0 0;
    margin-top: var(--sp-5);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 640px) {
    .pdx-stats { gap: var(--sp-4); }
    .pdx-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
    .poke { grid-template-columns: 72px 1fr; }
    .poke-sprite-wrap { width: 72px; height: 72px; }
    .poke-sprite { width: 60px; height: 60px; }
  }
`;

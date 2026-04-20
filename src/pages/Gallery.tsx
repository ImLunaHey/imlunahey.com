import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { GALLERY_META, GALLERY_SERIES, GALLERY_SHOTS, type GalleryShot } from '../data';

type Mode = 'mj' | 'shot' | 'all';

type MJItem = {
  kind: 'mj';
  id: string;
  seriesId: string;
  series: string;
  prompt: string;
  model: string;
  ar: string;
  s: number;
  chaos: number;
  seed: number;
  date: string;
  art: string;
};

type ShotItem = {
  kind: 'shot';
  id: string;
  seriesId: 'shot';
  series: string;
  date: string;
  art: string;
} & GalleryShot;

type Item = MJItem | ShotItem;

function hash(str: string) {
  let h = 2_166_136_261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 16_777_619) >>> 0;
  }
  return h;
}

function mulberry(seed: number) {
  return () => {
    let t = (seed += 0x6d2b_79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function artSVG(seed: number, palette: [string, string, string]) {
  const rnd = mulberry(seed);
  const [c1, c2, c3] = palette;
  const kind = Math.floor(rnd() * 4);
  let inner = '';

  if (kind === 0) {
    const cx = rnd() * 100;
    const cy = rnd() * 100;
    const r = 5 + rnd() * 20;
    const cx2 = 20 + rnd() * 60;
    const cy2 = 20 + rnd() * 60;
    inner = `
      <defs><radialGradient id="g${seed}" cx="${cx}%" cy="${cy}%" r="80%">
        <stop offset="0%" stop-color="${c2}"/><stop offset="100%" stop-color="${c1}"/>
      </radialGradient></defs>
      <rect width="100" height="100" fill="url(#g${seed})"/>
      <circle cx="${cx2}" cy="${cy2}" r="${r}" fill="${c3}" opacity="0.4"/>
    `;
  } else if (kind === 1) {
    const h = 30 + rnd() * 40;
    const cx = 10 + rnd() * 80;
    const cr = 3 + rnd() * 8;
    inner = `
      <rect width="100" height="${h}" fill="${c1}"/>
      <rect y="${h}" width="100" height="${100 - h}" fill="${c3}"/>
      <circle cx="${cx}" cy="${h - 10}" r="${cr}" fill="${c2}" opacity="0.7"/>
    `;
  } else if (kind === 2) {
    let bars = '';
    for (let i = 0; i < 6; i++) {
      const x = i * 16 + rnd() * 3;
      const bh = 40 + rnd() * 60;
      const col = [c1, c2, c3][Math.floor(rnd() * 3)];
      bars += `<rect x="${x}" y="${100 - bh}" width="${12 + rnd() * 4}" height="${bh}" fill="${col}" opacity="${0.6 + rnd() * 0.4}"/>`;
    }
    inner = `<rect width="100" height="100" fill="${c1}" opacity="0.4"/>${bars}`;
  } else {
    let cells = '';
    for (let y = 0; y < 5; y++)
      for (let x = 0; x < 5; x++) {
        const col = [c1, c2, c3][Math.floor(rnd() * 3)];
        cells += `<rect x="${x * 20}" y="${y * 20}" width="20" height="20" fill="${col}" opacity="${0.4 + rnd() * 0.5}"/>`;
      }
    inner = cells;
  }

  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
}

const MODELS = ['v6.1', 'v6.1', 'v6.1', 'niji 6'];
const ARS = ['3:2', '1:1', '16:9', '2:3'];

function buildMJ(): MJItem[] {
  const all: MJItem[] = [];
  GALLERY_SERIES.forEach((s) => {
    for (let i = 0; i < s.n; i++) {
      const prompt = s.prompts[i % s.prompts.length];
      const seed = hash(s.id + '_' + i);
      const r = mulberry(seed);
      const model = MODELS[Math.floor(r() * MODELS.length)];
      const ar = ARS[Math.floor(r() * ARS.length)];
      const stylize = 100 + Math.floor(r() * 900);
      const chaos = Math.floor(r() * 50);
      all.push({
        kind: 'mj',
        id: `${s.id}_${i}`,
        seriesId: s.id,
        series: s.label,
        prompt,
        model,
        ar,
        s: stylize,
        chaos,
        seed,
        date: `2026-04-${String(1 + (seed % 19)).padStart(2, '0')}`,
        art: artSVG(seed, s.palette),
      });
    }
  });
  return all;
}

function buildShots(): ShotItem[] {
  return GALLERY_SHOTS.items.map((x, i) => ({
    kind: 'shot',
    id: `shot_${i}`,
    seriesId: 'shot',
    series: GALLERY_SHOTS.label,
    ...x,
    date: `2026-04-${String(1 + i).padStart(2, '0')}`,
    art: artSVG(hash('shot_' + i), GALLERY_SHOTS.palette),
  }));
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

export default function GalleryPage() {
  const mjItems = useMemo(() => buildMJ(), []);
  const shotItems = useMemo(() => buildShots(), []);
  const [mode, setMode] = useState<Mode>('mj');
  const items: Item[] = mode === 'mj' ? mjItems : mode === 'shot' ? shotItems : [...mjItems, ...shotItems];

  const groups = useMemo(() => {
    const map = new Map<string, { id: string; label: string; items: Item[] }>();
    for (const it of items) {
      if (!map.has(it.seriesId)) map.set(it.seriesId, { id: it.seriesId, label: it.series, items: [] });
      map.get(it.seriesId)!.items.push(it);
    }
    return [...map.values()];
  }, [items]);

  const [lb, setLb] = useState<{ list: Item[]; index: number } | null>(null);

  const totalReal =
    mode === 'mj' ? GALLERY_META.generatedTotal : mode === 'shot' ? GALLERY_META.shotTotal : GALLERY_META.allTotal;

  const seriesTotal = (id: string): number => {
    if (id === 'shot') return GALLERY_SHOTS.totalCount;
    return GALLERY_SERIES.find((x) => x.id === id)?.totalCount ?? 0;
  };

  useEffect(() => {
    if (!lb) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLb(null);
      if (e.key === 'ArrowRight') setLb((prev) => (prev ? { ...prev, index: (prev.index + 1) % prev.list.length } : prev));
      if (e.key === 'ArrowLeft')
        setLb((prev) => (prev ? { ...prev, index: (prev.index - 1 + prev.list.length) % prev.list.length } : prev));
      if (e.key.toLowerCase() === 'r')
        setLb((prev) => (prev ? { ...prev, index: Math.floor(Math.random() * prev.list.length) } : prev));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lb]);

  const openTile = (target: Item) => {
    const flat = groups.flatMap((g) => g.items);
    const abs = flat.findIndex((x) => x.id === target.id);
    setLb({ list: flat, index: Math.max(0, abs) });
  };

  const surpriseMe = () => {
    if (items.length === 0) return;
    setLb({ list: items, index: Math.floor(Math.random() * items.length) });
  };

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-gallery">
        <header className="page-hd">
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              ~/gallery
            </div>
            <h1>
              gallery<span className="dot">.</span>
            </h1>
            <p className="sub">
              {GALLERY_META.generatedTotal.toLocaleString()} generated, {GALLERY_META.shotTotal} shot. i make more
              pictures with a prompt than a shutter, and i'm okay with that. click any tile for the full prompt,
              parameters, and seed — everything i'd need to re-roll it.
            </p>
          </div>
          <div className="counts">
            <div>
              generated · <b>{GALLERY_META.generatedTotal.toLocaleString()}</b>
            </div>
            <div>
              shot · <b>{GALLERY_META.shotTotal}</b>
            </div>
            <div>
              series · <b>{GALLERY_META.seriesCount}</b>
            </div>
            <div>
              last · <b>{GALLERY_META.lastUpload}</b>
            </div>
          </div>
        </header>

        <div className="gal-bar">
          <div className="seg">
            {(['mj', 'shot', 'all'] as const).map((m) => (
              <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} type="button">
                {m === 'mj' ? 'generated' : m === 'shot' ? 'shot' : 'all'}
                <span className="n">
                  {m === 'mj'
                    ? GALLERY_META.generatedTotal.toLocaleString()
                    : m === 'shot'
                      ? GALLERY_META.shotTotal
                      : GALLERY_META.allTotal.toLocaleString()}
                </span>
              </button>
            ))}
          </div>
          <span className="view">
            showing <b>{items.length}</b> of {totalReal.toLocaleString()} · across {groups.length}{' '}
            {groups.length === 1 ? 'series' : 'series'}
          </span>
          <div className="spacer" />
          <button className="surprise" type="button" onClick={surpriseMe}>
            ⚄ surprise me
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.id}>
            <div className="series-head">
              <span className="name">── {g.label}</span>
              <span className="count">
                {g.items.length} shown · {seriesTotal(g.id).toLocaleString()} total
              </span>
              <span className="rule" />
            </div>
            <div className="grid">
              {g.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="tile"
                  onClick={() => openTile(it)}
                  aria-label={it.kind === 'mj' ? it.prompt : it.cap}
                >
                  <div className="art" dangerouslySetInnerHTML={{ __html: it.art }} />
                  <span className={`badge ${it.kind}`}>{it.kind === 'mj' ? `mj ${it.model}` : '📷 shot'}</span>
                  <div className="prompt">
                    {it.kind === 'mj' ? (
                      <>
                        {truncate(it.prompt, 80)}
                        <span className="params">
                          --ar {it.ar} --s {it.s}
                          {it.chaos ? ` --chaos ${it.chaos}` : ''}
                        </span>
                      </>
                    ) : (
                      <>
                        {it.cap}
                        <span className="params">
                          {it.lens} · {it.ap} · {it.sh} · iso {it.iso}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}

        <footer className="gallery-footer">
          <span>
            src: <span className="t-accent">midjourney.com/imagine/luna</span> · sync'd hourly ·{' '}
            <span className="t-accent">fuji x-t5 exif → exif.json</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>

      {lb ? (
        <Lightbox
          list={lb.list}
          index={lb.index}
          onClose={() => setLb(null)}
          onIndex={(i) => setLb({ ...lb, index: i })}
        />
      ) : null}
    </>
  );
}

function Lightbox({
  list,
  index,
  onClose,
  onIndex,
}: {
  list: Item[];
  index: number;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const it = list[index];
  const ref = useRef<HTMLDivElement | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedSeed, setCopiedSeed] = useState(false);

  useEffect(() => {
    if (!copiedPrompt) return;
    const id = window.setTimeout(() => setCopiedPrompt(false), 1200);
    return () => window.clearTimeout(id);
  }, [copiedPrompt]);
  useEffect(() => {
    if (!copiedSeed) return;
    const id = window.setTimeout(() => setCopiedSeed(false), 1200);
    return () => window.clearTimeout(id);
  }, [copiedSeed]);

  if (!it) return null;

  const copyPrompt = async () => {
    const txt =
      it.kind === 'mj'
        ? `${it.prompt} --ar ${it.ar} --s ${it.s}${it.chaos ? ' --chaos ' + it.chaos : ''} --v ${it.model.replace('v', '')}`
        : it.cap;
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedPrompt(true);
    } catch {
      // swallow
    }
  };

  const copySeed = async () => {
    const txt = it.kind === 'mj' ? String(it.seed) : '(no seed)';
    try {
      await navigator.clipboard.writeText(txt);
      setCopiedSeed(true);
    } catch {
      // swallow
    }
  };

  return (
    <div
      className="lb on"
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="lb-head">
        <span className="title">{it.kind === 'mj' ? `${it.series} · seed ${it.seed}` : it.cap}</span>
        <span>
          {index + 1} / {list.length} · <span className="kbd">esc</span> close · <span className="kbd">c</span> copy
          prompt · <span className="kbd">r</span> random
        </span>
      </div>
      <div className="lb-body">
        <div className="lb-frame">
          <button
            className="lb-nav prev"
            type="button"
            onClick={() => onIndex((index - 1 + list.length) % list.length)}
          >
            ←
          </button>
          <div className="lb-art" dangerouslySetInnerHTML={{ __html: it.art }} />
          <button className="lb-nav next" type="button" onClick={() => onIndex((index + 1) % list.length)}>
            →
          </button>
        </div>
        <div className="lb-side">
          <h3>{it.kind === 'mj' ? '// prompt' : '// exif'}</h3>
          <div className="lb-prompt">{it.kind === 'mj' ? it.prompt : `shot on fuji x-t5 · ${it.cap}`}</div>
          <dl className="lb-meta">
            {it.kind === 'mj' ? (
              <>
                <dt>model</dt>
                <dd>
                  <span className="acc">midjourney {it.model}</span>
                </dd>
                <dt>ar</dt>
                <dd>--ar {it.ar}</dd>
                <dt>stylize</dt>
                <dd>--s {it.s}</dd>
                <dt>chaos</dt>
                <dd>--chaos {it.chaos}</dd>
                <dt>seed</dt>
                <dd>
                  <span className="acc">{it.seed}</span>
                </dd>
                <dt>series</dt>
                <dd>{it.series}</dd>
                <dt>date</dt>
                <dd>{it.date}</dd>
              </>
            ) : (
              <>
                <dt>camera</dt>
                <dd>
                  <span className="acc">fujifilm x-t5</span>
                </dd>
                <dt>lens</dt>
                <dd>{it.lens}</dd>
                <dt>aperture</dt>
                <dd>{it.ap}</dd>
                <dt>shutter</dt>
                <dd>{it.sh}</dd>
                <dt>iso</dt>
                <dd>{it.iso}</dd>
                <dt>location</dt>
                <dd>{it.cap}</dd>
                <dt>date</dt>
                <dd>{it.date}</dd>
              </>
            )}
          </dl>
          <div className="lb-actions">
            <button type="button" className={'btn-sm' + (copiedPrompt ? ' flash' : '')} onClick={copyPrompt}>
              {copiedPrompt ? '✓ copied' : '⎘ copy prompt'}
            </button>
            <button type="button" className={'btn-sm' + (copiedSeed ? ' flash' : '')} onClick={copySeed}>
              {copiedSeed ? '✓ copied' : '↺ copy seed'}
            </button>
            <button type="button" className="btn-sm" onClick={() => onIndex(Math.floor(Math.random() * list.length))}>
              ⚄ random
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
  .shell-gallery { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); display: grid; grid-template-columns: 1fr auto; align-items: end; gap: var(--sp-6); }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }
  .page-hd .counts { color: var(--color-fg-faint); font-size: var(--fs-xs); text-align: right; line-height: 1.8; }
  .page-hd .counts b { color: var(--color-accent); font-weight: 400; }

  .gal-bar {
    display: flex; gap: var(--sp-3);
    padding: var(--sp-5) 0 var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    align-items: center;
    flex-wrap: wrap;
  }
  .seg { display: inline-flex; border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .seg button {
    padding: 6px 14px; border: 0;
    background: transparent; color: var(--color-fg-dim);
    font: inherit; font-size: var(--fs-sm); cursor: pointer;
    text-transform: lowercase;
    font-family: var(--font-mono);
  }
  .seg button:not(:last-child) { border-right: 1px solid var(--color-border); }
  .seg button:hover { color: var(--color-fg); }
  .seg button.on { background: var(--color-bg-raised); color: var(--color-accent); }
  .seg button .n { color: var(--color-fg-faint); margin-left: 6px; font-size: var(--fs-xs); }
  .seg button.on .n { color: var(--color-accent-faint); }
  .gal-bar .spacer { flex: 1; }
  .gal-bar .surprise {
    padding: 6px 14px; border: 1px solid var(--color-accent-dim);
    background: var(--color-bg-panel); color: var(--color-accent);
    font: inherit; font-size: var(--fs-sm); cursor: pointer;
    text-transform: lowercase;
    font-family: var(--font-mono);
  }
  .gal-bar .surprise:hover { background: var(--color-accent); color: var(--color-bg); }
  .gal-bar .view { font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .gal-bar .view b { color: var(--color-fg); font-weight: 400; }

  .series-head {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint); padding: var(--sp-8) 0 var(--sp-3);
    letter-spacing: 0.08em;
    display: flex; align-items: baseline; gap: var(--sp-4);
  }
  .series-head .name { color: var(--color-accent); text-transform: uppercase; }
  .series-head .count { color: var(--color-fg-faint); }
  .series-head .rule { flex: 1; height: 1px; background: var(--color-border); }

  .grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: var(--sp-3);
  }
  .tile {
    aspect-ratio: 1;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    position: relative;
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.12s;
    padding: 0;
    font: inherit;
  }
  .tile:hover { border-color: var(--color-accent); }
  .tile:hover .prompt { opacity: 1; }
  .tile .art { position: absolute; inset: 0; }
  .tile .art svg { width: 100%; height: 100%; display: block; }
  .tile .badge {
    position: absolute; top: 6px; left: 6px;
    font-family: var(--font-mono); font-size: 10px;
    padding: 1px 5px;
    background: rgba(0,0,0,0.65);
    color: var(--color-fg-dim);
    border: 1px solid transparent;
  }
  .tile .badge.mj { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .tile .badge.shot { color: oklch(0.85 0.14 60); border-color: oklch(0.55 0.13 60); }
  .tile .prompt {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 8px 10px;
    font-family: var(--font-mono); font-size: 10px;
    line-height: 1.4;
    color: var(--color-fg);
    background: linear-gradient(to top, rgba(0,0,0,0.92) 40%, transparent);
    opacity: 0;
    transition: opacity 0.15s;
    text-align: left;
  }
  .tile .prompt .params { color: var(--color-accent); margin-top: 3px; display: block; }

  .gallery-footer {
    border-top: 1px solid var(--color-border);
    margin-top: var(--sp-10);
    padding: var(--sp-6) 0 var(--sp-10);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
    display: flex; justify-content: space-between;
  }

  /* lightbox */
  .lb { position: fixed; inset: 0; background: #000; z-index: 500; display: none; flex-direction: column; padding: var(--sp-4) var(--sp-6); }
  .lb.on { display: flex; }
  .lb-head { display: flex; justify-content: space-between; align-items: center; font-size: var(--fs-xs); color: var(--color-fg-faint); padding-bottom: var(--sp-3); border-bottom: 1px solid var(--color-border); gap: var(--sp-4); }
  .lb-head .title { color: var(--color-fg); font-family: var(--font-mono); }
  .lb-body { flex: 1; display: grid; grid-template-columns: 1fr 320px; gap: var(--sp-5); padding: var(--sp-4) 0; min-height: 0; }
  .lb-frame { background: var(--color-bg-panel); border: 1px solid var(--color-border); display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  .lb-art { width: 100%; height: 100%; }
  .lb-art svg { width: 100%; height: 100%; display: block; }
  .lb-nav {
    position: absolute; top: 50%; transform: translateY(-50%);
    background: rgba(0,0,0,0.7); border: 1px solid var(--color-border-bright);
    width: 40px; height: 60px; color: var(--color-fg-dim);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 18px; font-family: var(--font-mono);
  }
  .lb-nav:hover { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .lb-nav.prev { left: var(--sp-4); }
  .lb-nav.next { right: var(--sp-4); }

  .lb-side { display: flex; flex-direction: column; gap: var(--sp-4); font-size: var(--fs-sm); }
  .lb-side h3 { font-family: var(--font-display); font-size: 20px; color: var(--color-fg); font-weight: 500; letter-spacing: -0.02em; }
  .lb-prompt {
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    padding: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs); line-height: 1.6;
    color: var(--color-fg);
    max-height: 220px; overflow: auto;
  }
  .lb-meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .lb-meta dt { color: var(--color-fg-faint); text-transform: lowercase; }
  .lb-meta dd { color: var(--color-fg); overflow-wrap: anywhere; }
  .lb-meta dd .acc { color: var(--color-accent); }
  .lb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn-sm {
    padding: 6px 12px; border: 1px solid var(--color-border-bright); background: var(--color-bg-panel);
    color: var(--color-fg-dim); font: inherit; font-size: var(--fs-xs); cursor: pointer;
    text-transform: lowercase; font-family: var(--font-mono);
  }
  .btn-sm:hover { border-color: var(--color-accent-dim); color: var(--color-accent); }
  .btn-sm.flash { border-color: var(--color-accent); color: var(--color-accent); background: var(--color-bg-raised); }

  @media (max-width: 800px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
    .lb-body { grid-template-columns: 1fr; }
    .page-hd { grid-template-columns: 1fr; }
    .page-hd .counts { text-align: left; }
  }
  @media (max-width: 500px) { .grid { grid-template-columns: repeat(2, 1fr); } }
`;

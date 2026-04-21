import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { feature } from 'topojson-client';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
// 110m resolution ≈ 110kb gzipped. Loads once, cached by the module graph.
import worldTopo from 'world-atlas/countries-110m.json';
import { PLACES, type Place, type PlaceKind } from '../data';

const KIND_LABEL: Record<PlaceKind, string> = {
  lived: 'lived',
  visited: 'visited',
  passed: 'passed through',
};

const KIND_COLOR: Record<PlaceKind, string> = {
  lived: 'var(--color-accent)',
  visited: 'oklch(0.78 0.11 210)',
  passed: 'var(--color-fg-faint)',
};

// Orthographic projection of (lat, lon) onto a unit circle, rotated by (λ0, φ0).
// Returns {x, y, visible} where x,y are in [-1, 1] from sphere center.
function project(lat: number, lon: number, λ0deg: number, φ0deg: number) {
  const DEG = Math.PI / 180;
  const φ = lat * DEG;
  const λ = lon * DEG;
  const φ0 = φ0deg * DEG;
  const λ0 = λ0deg * DEG;

  const cosC = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0);
  const x = Math.cos(φ) * Math.sin(λ - λ0);
  const y = Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0);
  return { x, y, visible: cosC > 0 };
}

// Convert the topojson FeatureCollection once at module load, so rotation
// renders cheap on each frame (just project + stringify).
const WORLD = feature(
  worldTopo as unknown as Topology,
  (worldTopo as unknown as Topology).objects.countries as GeometryCollection,
) as FeatureCollection<Polygon | MultiPolygon>;

function projectRing(ring: number[][], λ0: number, φ0: number, R: number, CX: number, CY: number): string {
  let d = '';
  let penDown = false;
  for (const [lon, lat] of ring) {
    const p = project(lat, lon, λ0, φ0);
    if (!p.visible) {
      penDown = false;
      continue;
    }
    const px = CX + p.x * R;
    const py = CY - p.y * R;
    d += (penDown ? ' L ' : ' M ') + px.toFixed(1) + ' ' + py.toFixed(1);
    penDown = true;
  }
  return d;
}

function countries(λ0: number, φ0: number, R: number, CX: number, CY: number): string {
  let d = '';
  for (const f of WORLD.features) {
    const geom = f.geometry;
    if (geom.type === 'Polygon') {
      for (const ring of geom.coordinates) d += ' ' + projectRing(ring, λ0, φ0, R, CX, CY);
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        for (const ring of poly) d += ' ' + projectRing(ring, λ0, φ0, R, CX, CY);
      }
    }
  }
  return d;
}

function graticule(λ0: number, φ0: number, R: number, CX: number, CY: number): string {
  const segs: string[] = [];
  const step = 6; // deg per sample along the line

  // meridians every 30 deg
  for (let lonDeg = -180; lonDeg < 180; lonDeg += 30) {
    let penDown = false;
    let d = '';
    for (let latDeg = -90; latDeg <= 90; latDeg += step) {
      const p = project(latDeg, lonDeg, λ0, φ0);
      if (!p.visible) {
        penDown = false;
        continue;
      }
      const px = CX + p.x * R;
      const py = CY - p.y * R;
      d += (penDown ? ' L ' : ' M ') + px.toFixed(1) + ' ' + py.toFixed(1);
      penDown = true;
    }
    if (d) segs.push(d);
  }

  // parallels every 30 deg
  for (let latDeg = -60; latDeg <= 60; latDeg += 30) {
    let penDown = false;
    let d = '';
    for (let lonDeg = -180; lonDeg <= 180; lonDeg += step) {
      const p = project(latDeg, lonDeg, λ0, φ0);
      if (!p.visible) {
        penDown = false;
        continue;
      }
      const px = CX + p.x * R;
      const py = CY - p.y * R;
      d += (penDown ? ' L ' : ' M ') + px.toFixed(1) + ' ' + py.toFixed(1);
      penDown = true;
    }
    if (d) segs.push(d);
  }

  return segs.join(' ');
}

export default function GlobePage() {
  // sphere rotation (λ0 = longitude, φ0 = latitude)
  const [λ0, setλ0] = useState(0);
  const [φ0, setφ0] = useState(20);
  const [auto, setAuto] = useState(true);
  const [hovered, setHovered] = useState<Place | null>(null);
  const dragRef = useRef<{ x: number; y: number; λ: number; φ: number; moved: boolean } | null>(null);
  const focusRafRef = useRef<number | null>(null);

  // Smoothly rotate to center a place on-screen. Short-path on λ, ease-in-out.
  function focusOn(p: Place) {
    setAuto(false);
    if (focusRafRef.current !== null) cancelAnimationFrame(focusRafRef.current);

    const startλ = λ0;
    const startφ = φ0;
    const targetλ = ((p.lon % 360) + 360) % 360;
    const targetφ = Math.max(-85, Math.min(85, p.lat));

    // shortest angular path
    let deltaλ = targetλ - startλ;
    if (deltaλ > 180) deltaλ -= 360;
    if (deltaλ < -180) deltaλ += 360;
    const deltaφ = targetφ - startφ;

    const DURATION = 700;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
      setλ0((((startλ + deltaλ * e) % 360) + 360) % 360);
      setφ0(startφ + deltaφ * e);
      if (t < 1) {
        focusRafRef.current = requestAnimationFrame(tick);
      } else {
        focusRafRef.current = null;
      }
    };
    focusRafRef.current = requestAnimationFrame(tick);
  }

  // cancel any pending focus-animation on unmount
  useEffect(() => () => {
    if (focusRafRef.current !== null) cancelAnimationFrame(focusRafRef.current);
  }, []);

  // auto-rotate
  useEffect(() => {
    if (!auto) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setλ0((λ) => (λ + dt * 6) % 360); // 6deg/s
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [auto]);

  const R = 240;
  const CX = 320;
  const CY = 320;
  const grat = useMemo(() => graticule(λ0, φ0, R, CX, CY), [λ0, φ0]);
  const land = useMemo(() => countries(λ0, φ0, R, CX, CY), [λ0, φ0]);

  const counts = useMemo(() => {
    const m: Record<PlaceKind, number> = { lived: 0, visited: 0, passed: 0 };
    for (const p of PLACES) m[p.kind]++;
    return m;
  }, []);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as SVGSVGElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, λ: λ0, φ: φ0, moved: false };
    setAuto(false);
    // cancel any in-flight focus animation so a drag takes over immediately
    if (focusRafRef.current !== null) {
      cancelAnimationFrame(focusRafRef.current);
      focusRafRef.current = null;
    }
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
    // Drag follows finger: left-drag rotates the sphere so eastern content
    // slides into view, which means λ0 decreases when dx is negative.
    setλ0(((dragRef.current.λ - dx * 0.4) % 360 + 360) % 360);
    setφ0(Math.max(-85, Math.min(85, dragRef.current.φ + dy * 0.4)));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-glb">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/globe
          </div>
          <h1>
            globe<span className="dot">.</span>
          </h1>
          <p className="sub">
            every pin is a place i&apos;ve lived, visited, or slept in the airport of. drag to spin, click a pin to
            read the note. no tiles, no satellites — just a wireframe and some dots.
          </p>
          <div className="meta">
            <span>
              lived <b className="t-accent">{counts.lived}</b>
            </span>
            <span>
              visited <b>{counts.visited}</b>
            </span>
            <span>
              passed <b>{counts.passed}</b>
            </span>
            <span>
              total <b>{PLACES.length}</b>
            </span>
          </div>
        </header>

        <section className="glb-wrap">
          <div className="glb-stage">
            <svg
              viewBox={`0 0 ${CX * 2} ${CY * 2}`}
              width="100%"
              height="100%"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              style={{ cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
              role="img"
              aria-label="wireframe globe with pinned places"
            >
              {/* sphere fill */}
              <circle cx={CX} cy={CY} r={R} fill="var(--color-bg-panel)" stroke="var(--color-border-bright)" strokeWidth={1} />
              {/* faint inner glow */}
              <circle cx={CX} cy={CY} r={R - 2} fill="none" stroke="var(--color-accent-dim)" strokeWidth={0.5} opacity={0.4} />

              {/* country outlines — render under graticule so the grid still reads */}
              <path
                d={land}
                fill="color-mix(in oklch, var(--color-accent) 6%, transparent)"
                stroke="var(--color-accent-dim)"
                strokeWidth={0.7}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={0.85}
              />

              {/* graticule */}
              <path d={grat} fill="none" stroke="var(--color-border-bright)" strokeWidth={0.6} opacity={0.35} />

              {/* pins — keys use index + name because the same city can appear
                  in PLACES more than once (e.g. london at two different time
                  ranges). duplicate keys caused react to orphan dom nodes,
                  which looked like pin trails as the globe rotated. */}
              {PLACES.map((p, i) => {
                const proj = project(p.lat, p.lon, λ0, φ0);
                if (!proj.visible) return null;
                const px = CX + proj.x * R;
                const py = CY - proj.y * R;
                const color = KIND_COLOR[p.kind];
                const isHovered = hovered?.name === p.name;
                const baseR = p.kind === 'lived' ? 4 : 3;
                const hitR = isHovered ? 5 : baseR;
                return (
                  <g key={`${i}-${p.name}`} style={{ cursor: 'pointer' }}>
                    {p.kind === 'lived' ? (
                      <circle cx={px} cy={py} r={14} fill={color} opacity={0.1} className="pin-halo" />
                    ) : null}
                    <circle cx={px} cy={py} r={hitR + 3} fill={color} opacity={0.18} />
                    <circle
                      cx={px}
                      cy={py}
                      r={hitR}
                      fill={color}
                      stroke="var(--color-bg)"
                      strokeWidth={1}
                      onMouseEnter={() => setHovered(p)}
                      onMouseLeave={() => setHovered(null)}
                      onPointerUp={() => {
                        // only treat as click if this pointer didn't drag the sphere.
                        // don't stop propagation — we want the svg's pointerup to fire
                        // too, so it can clear dragRef + release pointer capture.
                        if (!dragRef.current?.moved) focusOn(p);
                      }}
                    />
                  </g>
                );
              })}
            </svg>
            <div className="glb-controls">
              <button className={'chip' + (auto ? ' on' : '')} onClick={() => setAuto((v) => !v)} type="button">
                {auto ? '▶ spinning' : '‖ paused'}
              </button>
              <button
                className="chip"
                onClick={() => {
                  setλ0(0);
                  setφ0(20);
                }}
                type="button"
              >
                reset
              </button>
            </div>
          </div>

          <div className="glb-list-host">
            <aside className="glb-list">
              <div className="glb-hd">
                <span className="t-accent">./places</span>
                <span className="t-faint">drag · hover · click to centre</span>
              </div>
              <ul className="place-list">
              {PLACES.map((p, i) => {
                const proj = project(p.lat, p.lon, λ0, φ0);
                const back = !proj.visible;
                return (
                  <li
                    key={`${i}-${p.name}`}
                    className={'place-row kind-' + p.kind + (back ? ' back' : '') + (hovered?.name === p.name ? ' hovered' : '')}
                    onMouseEnter={() => setHovered(p)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => focusOn(p)}
                  >
                    <span className="place-dot" style={{ background: KIND_COLOR[p.kind] }} />
                    <span className="place-name">{p.name}</span>
                    <span className="place-cc">{p.country}</span>
                    <span className="place-kind">{KIND_LABEL[p.kind]}</span>
                    <span className="place-when">{p.when}</span>
                    {p.note ? <div className="place-note">{p.note}</div> : null}
                  </li>
                );
              })}
              </ul>
            </aside>
          </div>
        </section>

        <footer className="glb-footer">
          <span>
            src: <span className="t-accent">orthographic projection · hand-authored pins</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-glb { max-width: 1280px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 60ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5); font-family: var(--font-mono);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }

  .glb-wrap {
    display: grid;
    grid-template-columns: 1fr 360px;
    gap: var(--sp-6);
    padding-top: var(--sp-6);
  }
  .glb-stage {
    aspect-ratio: 1 / 1;
    position: relative;
    border: 1px solid var(--color-border);
    background: radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--color-accent) 5%, var(--color-bg)) 0%, var(--color-bg) 70%);
    user-select: none;
  }
  .glb-controls {
    position: absolute; bottom: var(--sp-3); left: var(--sp-3);
    display: flex; gap: 6px;
  }
  .chip {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 4px 10px; background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
    color: var(--color-fg-faint);
    cursor: pointer; letter-spacing: 0.06em;
    text-transform: lowercase;
  }
  .chip:hover { border-color: var(--color-accent-dim); color: var(--color-fg); }
  .chip.on { border-color: var(--color-accent); color: var(--color-accent); background: color-mix(in oklch, var(--color-accent) 10%, var(--color-bg-panel)); }

  /* host is a grid child whose intrinsic height is 0, so it doesn't push the
     grid row taller than the globe. grid's default align-items: stretch then
     sizes the host to the row height (= globe height). the list absolutely
     fills the host, and the <ul> inside handles its own scrolling. */
  .glb-list-host {
    position: relative;
    min-height: 0;
  }
  .glb-list {
    position: absolute; inset: 0;
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .glb-hd {
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.14em;
    display: flex; justify-content: space-between;
  }
  .place-list {
    list-style: none; margin: 0; padding: 0;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }
  .place-row {
    display: grid;
    grid-template-columns: 10px 1fr auto;
    grid-template-rows: auto auto;
    column-gap: var(--sp-2);
    row-gap: 2px;
    align-items: baseline;
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    cursor: pointer;
    transition: background 0.1s;
  }
  .place-row:hover, .place-row.hovered {
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
  }
  .place-row.back { opacity: 0.35; }
  .place-dot {
    width: 8px; height: 8px; border-radius: 50%;
    grid-row: 1; grid-column: 1;
  }
  .place-name {
    font-family: var(--font-display); font-size: 16px;
    color: var(--color-fg); letter-spacing: -0.01em;
    grid-row: 1; grid-column: 2;
  }
  .place-cc {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-accent); letter-spacing: 0.14em;
    text-transform: uppercase;
    grid-row: 1; grid-column: 3;
    justify-self: end; text-align: right;
  }
  .place-kind {
    grid-row: 2; grid-column: 2;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: lowercase; letter-spacing: 0.08em;
  }
  .place-when {
    grid-row: 2; grid-column: 3;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    justify-self: end; text-align: right;
  }
  .place-note {
    grid-row: 3; grid-column: 1 / -1;
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.5;
    margin-top: 4px;
  }

  @keyframes pin-pulse {
    0%, 100% { opacity: 0.18; transform: scale(0.85); }
    50%      { opacity: 0.04; transform: scale(1.2); }
  }
  .pin-halo {
    animation: pin-pulse 3s ease-in-out infinite;
    transform-box: fill-box;
    transform-origin: center;
  }

  .glb-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  @media (max-width: 980px) {
    .glb-wrap { grid-template-columns: 1fr; }
    .glb-list-host { position: static; }
    .glb-list { position: static; overflow: visible; }
    .place-list { overflow-y: visible; flex: none; }
  }
`;

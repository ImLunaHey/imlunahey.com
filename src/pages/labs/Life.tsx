import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

const COLS = 60;
const ROWS = 40;

type Grid = Uint8Array; // length COLS*ROWS, 0 = dead, 1 = live

function idx(x: number, y: number): number {
  return ((y + ROWS) % ROWS) * COLS + ((x + COLS) % COLS);
}

function empty(): Grid {
  return new Uint8Array(COLS * ROWS);
}

function randomize(): Grid {
  const g = empty();
  for (let i = 0; i < g.length; i++) g[i] = Math.random() < 0.22 ? 1 : 0;
  return g;
}

function step(g: Grid): Grid {
  const n = empty();
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let live = 0;
      // 8 neighbours, torus wrap-around so patterns can roam.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          live += g[idx(x + dx, y + dy)];
        }
      }
      const self = g[idx(x, y)];
      n[idx(x, y)] = self ? (live === 2 || live === 3 ? 1 : 0) : live === 3 ? 1 : 0;
    }
  }
  return n;
}

// classic starter patterns, placed with top-left at (x, y).
type Pattern = { name: string; cells: Array<[number, number]>; };
const PATTERNS: Record<string, Pattern> = {
  glider: { name: 'glider', cells: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]] },
  blinker: { name: 'blinker', cells: [[0, 1], [1, 1], [2, 1]] },
  toad: { name: 'toad', cells: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]] },
  gosper: {
    name: 'gosper glider gun',
    cells: [
      [0,4],[0,5],[1,4],[1,5],[10,4],[10,5],[10,6],[11,3],[11,7],[12,2],[12,8],[13,2],[13,8],
      [14,5],[15,3],[15,7],[16,4],[16,5],[16,6],[17,5],[20,2],[20,3],[20,4],[21,2],[21,3],[21,4],
      [22,1],[22,5],[24,0],[24,1],[24,5],[24,6],[34,2],[34,3],[35,2],[35,3],
    ],
  },
  pulsar: {
    name: 'pulsar',
    cells: [
      [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
      [0,2],[5,2],[7,2],[12,2],
      [0,3],[5,3],[7,3],[12,3],
      [0,4],[5,4],[7,4],[12,4],
      [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],
      [2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
      [0,8],[5,8],[7,8],[12,8],
      [0,9],[5,9],[7,9],[12,9],
      [0,10],[5,10],[7,10],[12,10],
      [2,12],[3,12],[4,12],[8,12],[9,12],[10,12],
    ],
  },
};

function place(g: Grid, p: Pattern, ox: number, oy: number): Grid {
  const n = new Uint8Array(g);
  for (const [dx, dy] of p.cells) n[idx(ox + dx, oy + dy)] = 1;
  return n;
}

export default function LifePage() {
  const [grid, setGrid] = useState<Grid>(() => {
    // start with the gosper gun roughly centred, so the page isn't empty.
    return place(empty(), PATTERNS.gosper, 10, 14);
  });
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(60); // ms per generation
  const [generation, setGeneration] = useState(0);

  const runningRef = useRef(running);
  runningRef.current = running;

  // advance
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setGrid((g) => step(g));
      setGeneration((n) => n + 1);
    }, speed);
    return () => window.clearInterval(id);
  }, [running, speed]);

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        setRunning((r) => !r);
      } else if (k === 'n') {
        setGrid((g) => step(g));
        setGeneration((n) => n + 1);
      } else if (k === 'c') {
        setGrid(empty());
        setGeneration(0);
      } else if (k === 'r') {
        setGrid(randomize());
        setGeneration(0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const paintingRef = useRef<1 | 0 | null>(null);
  const paint = useCallback((x: number, y: number, mode: 1 | 0) => {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    setGrid((g) => {
      const i = idx(x, y);
      if (g[i] === mode) return g;
      const n = new Uint8Array(g);
      n[i] = mode;
      return n;
    });
  }, []);

  function handlePointer(e: React.PointerEvent<SVGSVGElement>) {
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    const mode = paintingRef.current;
    if (mode !== null) paint(x, y, mode);
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    const i = idx(x, y);
    const mode: 1 | 0 = grid[i] ? 0 : 1;
    paintingRef.current = mode;
    e.currentTarget.setPointerCapture(e.pointerId);
    paint(x, y, mode);
  }
  function onPointerUp() {
    paintingRef.current = null;
  }

  const population = useRef(0);
  let pop = 0;
  for (let i = 0; i < grid.length; i++) pop += grid[i];
  population.current = pop;

  const cells = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[idx(x, y)]) cells.push({ x, y });
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-life">
        <header className="page-hd">
          <div className="label">~/labs/game-of-life</div>
          <h1>life<span className="dot">.</span></h1>
          <p className="sub">
            conway&apos;s cellular automaton, 60×40 torus. click to toggle cells, drag to paint.{' '}
            <kbd>space</kbd> pause, <kbd>n</kbd> step, <kbd>r</kbd> randomise, <kbd>c</kbd> clear.
          </p>
          <div className="meta">
            <span>generation <b className="t-accent">{generation}</b></span>
            <span>alive <b>{pop}</b></span>
            <span>density <b>{((pop / (COLS * ROWS)) * 100).toFixed(1)}%</b></span>
          </div>
        </header>

        <section className="stage-wrap">
          <svg
            viewBox={`0 0 ${COLS} ${ROWS}`}
            className="stage"
            role="img"
            aria-label="game of life grid"
            onPointerDown={onPointerDown}
            onPointerMove={handlePointer}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: 'none', cursor: 'cell' }}
          >
            <rect x={0} y={0} width={COLS} height={ROWS} className="bg" />
            {cells.map((c) => (
              <rect
                key={c.x + c.y * COLS}
                x={c.x + 0.05}
                y={c.y + 0.05}
                width={0.9}
                height={0.9}
                className="live"
              />
            ))}
          </svg>
        </section>

        <section className="ctrls">
          <button className="btn" onClick={() => setRunning((r) => !r)} type="button">
            {running ? '‖ pause' : '▶ play'}
          </button>
          <button className="btn" onClick={() => { setGrid((g) => step(g)); setGeneration((n) => n + 1); }} type="button">
            step
          </button>
          <button className="btn" onClick={() => { setGrid(randomize()); setGeneration(0); }} type="button">
            randomise
          </button>
          <button className="btn" onClick={() => { setGrid(empty()); setGeneration(0); }} type="button">
            clear
          </button>
          <div className="speed">
            <label htmlFor="speed">speed</label>
            <input
              id="speed"
              type="range"
              min={20}
              max={500}
              step={10}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <span className="speed-val">{speed}ms</span>
          </div>
          <div className="seeds">
            <span className="t-faint">seed:</span>
            {Object.entries(PATTERNS).map(([key, p]) => (
              <button
                key={key}
                className="btn small"
                type="button"
                onClick={() => {
                  // drop the pattern near top-left with some margin
                  setGrid(place(empty(), p, 2, 2));
                  setGeneration(0);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>

        <footer className="life-footer">
          <span>src: <span className="t-accent">hand-written · ~180 lines</span></span>
          <span>
            ←{' '}
            <Link to="/labs" className="t-accent">labs</Link>
          </span>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-life { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; line-height: 0.9; color: var(--color-fg); }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 68ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .sub kbd {
    display: inline-block; padding: 1px 6px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-raised);
    font-family: var(--font-mono); font-size: 10px; color: var(--color-fg);
    border-radius: 2px;
  }
  .page-hd .meta { display: flex; gap: var(--sp-6); flex-wrap: wrap; margin-top: var(--sp-5); font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }

  .stage-wrap { margin-top: var(--sp-5); }
  .stage {
    display: block; width: 100%;
    aspect-ratio: ${COLS} / ${ROWS};
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    shape-rendering: crispEdges;
    user-select: none;
  }
  .stage .bg { fill: var(--color-bg-panel); }
  .stage .live { fill: var(--color-accent); }

  .ctrls {
    display: flex; flex-wrap: wrap; gap: var(--sp-2);
    margin-top: var(--sp-4);
    align-items: center;
  }
  .btn {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 6px 12px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase; letter-spacing: 0.06em;
  }
  .btn:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .btn.small { padding: 4px 8px; font-size: 10px; }
  .speed { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-left: var(--sp-3); }
  .speed input[type="range"] { width: 140px; accent-color: var(--color-accent); }
  .speed-val { color: var(--color-fg); }
  .seeds {
    display: flex; flex-wrap: wrap; gap: 4px;
    align-items: center;
    margin-left: var(--sp-3);
    font-family: var(--font-mono); font-size: var(--fs-xs);
  }
  .t-faint { color: var(--color-fg-faint); margin-right: 6px; }

  .life-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint);
  }

  @media (max-width: 760px) {
    .speed, .seeds { margin-left: 0; flex-basis: 100%; }
  }
`;

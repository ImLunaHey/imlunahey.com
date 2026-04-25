import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';

const TILE_W = 64;
const TILE_H = 32;
const ROOM_SIZE = 10;
const WALL_H = 3.2; // wall height in tile units
const STEP_MS = 280;

type Tile = readonly [number, number];
type Facing = 'N' | 'S' | 'E' | 'W';
type View = { cx: number; cy: number };
type FurnKind = 'chair' | 'table' | 'plant' | 'lamp' | 'crate' | 'rug';
type Furniture = { tile: Tile; kind: FurnKind; color: string };

const FURN_DEFS: Record<FurnKind, { walkable: boolean }> = {
  chair: { walkable: false },
  table: { walkable: false },
  plant: { walkable: false },
  lamp: { walkable: false },
  crate: { walkable: false },
  rug: { walkable: true },
};

const COLORS = {
  bg: '#0a0a0a',
  floorA: '#222a30',
  floorB: '#1c2228',
  wallNorth: '#3a3a45',
  wallWest: '#2c2c34',
  hover: 'rgba(106, 234, 160, 0.28)',
  hoverBlocked: 'rgba(255, 90, 90, 0.30)',
  pathDot: 'rgba(106, 234, 160, 0.55)',
  body: '#6aeaa0',
  head: '#f3d7b0',
};

// --- iso projection ----------------------------------------------------------

function project(view: View, i: number, j: number, h: number): { x: number; y: number } {
  return {
    x: view.cx + (i - j) * (TILE_W / 2),
    y: view.cy + (i + j) * (TILE_H / 2) - h * TILE_H,
  };
}

function screenToTile(view: View, mx: number, my: number): { i: number; j: number } {
  const dx = mx - view.cx;
  const dy = my - view.cy;
  const i = (dy / (TILE_H / 2) + dx / (TILE_W / 2)) / 2;
  const j = (dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2;
  return { i, j };
}

// --- color shading -----------------------------------------------------------

function shade(hex: string, mult: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 0xff) * mult)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 0xff) * mult)));
  const b = Math.max(0, Math.min(255, Math.round((n & 0xff) * mult)));
  return `rgb(${r}, ${g}, ${b})`;
}

// --- drawing primitives ------------------------------------------------------

function drawTile(ctx: CanvasRenderingContext2D, view: View, i: number, j: number, color: string) {
  const cx = view.cx + (i - j) * (TILE_W / 2);
  const cy = view.cy + (i + j) * (TILE_H / 2);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - TILE_H / 2);
  ctx.lineTo(cx + TILE_W / 2, cy);
  ctx.lineTo(cx, cy + TILE_H / 2);
  ctx.lineTo(cx - TILE_W / 2, cy);
  ctx.closePath();
  ctx.fill();
}

function drawIsoBox(
  ctx: CanvasRenderingContext2D,
  view: View,
  i: number,
  j: number,
  w: number,
  d: number,
  h: number,
  color: string,
  baseZ = 0,
) {
  const p = (di: number, dj: number, dh: number) => project(view, i + di, j + dj, baseZ + dh);
  const baseNE = p(+w / 2, -d / 2, 0);
  const baseSE = p(+w / 2, +d / 2, 0);
  const baseSW = p(-w / 2, +d / 2, 0);
  const topNW = p(-w / 2, -d / 2, h);
  const topNE = p(+w / 2, -d / 2, h);
  const topSE = p(+w / 2, +d / 2, h);
  const topSW = p(-w / 2, +d / 2, h);

  // east face — visible, medium shade
  ctx.fillStyle = shade(color, 0.78);
  ctx.beginPath();
  ctx.moveTo(baseNE.x, baseNE.y);
  ctx.lineTo(baseSE.x, baseSE.y);
  ctx.lineTo(topSE.x, topSE.y);
  ctx.lineTo(topNE.x, topNE.y);
  ctx.closePath();
  ctx.fill();

  // south face — visible, darkest
  ctx.fillStyle = shade(color, 0.62);
  ctx.beginPath();
  ctx.moveTo(baseSW.x, baseSW.y);
  ctx.lineTo(baseSE.x, baseSE.y);
  ctx.lineTo(topSE.x, topSE.y);
  ctx.lineTo(topSW.x, topSW.y);
  ctx.closePath();
  ctx.fill();

  // top face — full color
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(topNW.x, topNW.y);
  ctx.lineTo(topNE.x, topNE.y);
  ctx.lineTo(topSE.x, topSE.y);
  ctx.lineTo(topSW.x, topSW.y);
  ctx.closePath();
  ctx.fill();
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  view: View,
  axis: 'i' | 'j',
  color: string,
) {
  // axis 'j' → wall at i = -0.5, runs along j from -0.5 to N-0.5 (back-left wall)
  // axis 'i' → wall at j = -0.5, runs along i from -0.5 to N-0.5 (back-right wall)
  const corners =
    axis === 'j'
      ? [
          project(view, -0.5, -0.5, 0),
          project(view, -0.5, ROOM_SIZE - 0.5, 0),
          project(view, -0.5, ROOM_SIZE - 0.5, WALL_H),
          project(view, -0.5, -0.5, WALL_H),
        ]
      : [
          project(view, -0.5, -0.5, 0),
          project(view, ROOM_SIZE - 0.5, -0.5, 0),
          project(view, ROOM_SIZE - 0.5, -0.5, WALL_H),
          project(view, -0.5, -0.5, WALL_H),
        ];
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.lineTo(corners[3].x, corners[3].y);
  ctx.closePath();
  ctx.fill();
}

// --- furniture (procedural) --------------------------------------------------

function drawFurniture(ctx: CanvasRenderingContext2D, view: View, f: Furniture) {
  const [i, j] = f.tile;
  switch (f.kind) {
    case 'chair':
      // back (north side, drawn first since it's farther in screen space)
      drawIsoBox(ctx, view, i, j - 0.3, 0.7, 0.12, 0.95, f.color);
      drawIsoBox(ctx, view, i, j, 0.7, 0.7, 0.4, f.color);
      break;
    case 'table':
      drawIsoBox(ctx, view, i, j, 0.85, 0.85, 0.5, f.color);
      break;
    case 'plant':
      drawIsoBox(ctx, view, i, j, 0.4, 0.4, 0.4, '#6c4a30');
      drawIsoBox(ctx, view, i, j, 0.7, 0.7, 0.7, f.color, 0.4);
      break;
    case 'lamp':
      drawIsoBox(ctx, view, i, j, 0.18, 0.18, 1.4, '#3c3c3c');
      drawIsoBox(ctx, view, i, j, 0.55, 0.55, 0.25, f.color, 1.4);
      break;
    case 'crate':
      drawIsoBox(ctx, view, i, j, 0.85, 0.85, 0.85, f.color);
      break;
    case 'rug':
      drawTile(ctx, view, i, j, f.color);
      break;
  }
}

// --- avatar ------------------------------------------------------------------

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  view: View,
  i: number,
  j: number,
  bob: number,
) {
  drawIsoBox(ctx, view, i, j, 0.45, 0.45, 0.85 + bob, COLORS.body);
  drawIsoBox(ctx, view, i, j, 0.5, 0.5, 0.4, COLORS.head, 0.85 + bob);
}

// --- A* pathfinding ----------------------------------------------------------

function findPath(walkable: boolean[][], start: Tile, goal: Tile): Tile[] | null {
  const N = walkable.length;
  const M = walkable[0].length;
  const inb = (i: number, j: number) => i >= 0 && i < N && j >= 0 && j < M;
  if (!inb(goal[0], goal[1]) || !walkable[goal[0]][goal[1]]) return null;
  if (!inb(start[0], start[1])) return null;
  const key = (i: number, j: number) => i * M + j;
  const heur = (i: number, j: number) => Math.abs(i - goal[0]) + Math.abs(j - goal[1]);
  type Node = { i: number; j: number; g: number; f: number };
  const open: Node[] = [{ i: start[0], j: start[1], g: 0, f: heur(start[0], start[1]) }];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>();
  gScore.set(key(start[0], start[1]), 0);
  while (open.length > 0) {
    let bestIdx = 0;
    for (let k = 1; k < open.length; k++) if (open[k].f < open[bestIdx].f) bestIdx = k;
    const cur = open.splice(bestIdx, 1)[0];
    if (cur.i === goal[0] && cur.j === goal[1]) {
      const path: Tile[] = [[cur.i, cur.j]];
      let k = key(cur.i, cur.j);
      while (came.has(k)) {
        const pk = came.get(k)!;
        path.unshift([Math.floor(pk / M), pk % M]);
        k = pk;
      }
      return path;
    }
    const dirs: Tile[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [di, dj] of dirs) {
      const ni = cur.i + di;
      const nj = cur.j + dj;
      if (!inb(ni, nj) || !walkable[ni][nj]) continue;
      const tg = cur.g + 1;
      const nk = key(ni, nj);
      const prev = gScore.get(nk);
      if (prev !== undefined && prev <= tg) continue;
      gScore.set(nk, tg);
      came.set(nk, key(cur.i, cur.j));
      open.push({ i: ni, j: nj, g: tg, f: tg + heur(ni, nj) });
    }
  }
  return null;
}

// --- scene -------------------------------------------------------------------

type SceneState = {
  avatar: {
    tile: Tile;
    pos: [number, number];
    path: Tile[];
    walking: boolean;
    lastStep: number;
    facing: Facing;
  };
  hover: Tile | null;
  hoverBlocked: boolean;
  bob: number;
};

function renderScene(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: SceneState,
  furniture: Furniture[],
) {
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  // back walls (drawn first, behind everything)
  drawWall(ctx, view, 'i', COLORS.wallNorth);
  drawWall(ctx, view, 'j', COLORS.wallWest);

  // floor tiles
  for (let i = 0; i < ROOM_SIZE; i++) {
    for (let j = 0; j < ROOM_SIZE; j++) {
      drawTile(ctx, view, i, j, (i + j) % 2 === 0 ? COLORS.floorA : COLORS.floorB);
    }
  }

  // rugs (still floor-level, draw on top of tiles but under hover)
  for (const f of furniture) {
    if (FURN_DEFS[f.kind].walkable) drawFurniture(ctx, view, f);
  }

  // path preview
  const a = state.avatar;
  if (a.walking && a.path.length > 0) {
    for (const [pi, pj] of a.path) {
      const p = project(view, pi, pj, 0);
      ctx.fillStyle = COLORS.pathDot;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // hover highlight (over floor + rugs + path)
  if (state.hover) {
    drawTile(
      ctx,
      view,
      state.hover[0],
      state.hover[1],
      state.hoverBlocked ? COLORS.hoverBlocked : COLORS.hover,
    );
  }

  // sprites depth-sorted (back to front by i + j)
  type R = { depth: number; draw: () => void };
  const sprites: R[] = [];
  for (const f of furniture) {
    if (FURN_DEFS[f.kind].walkable) continue;
    sprites.push({ depth: f.tile[0] + f.tile[1], draw: () => drawFurniture(ctx, view, f) });
  }
  // avatar — bias forward by epsilon so a same-depth furniture renders behind it
  sprites.push({
    depth: a.pos[0] + a.pos[1] + 0.01,
    draw: () => drawAvatar(ctx, view, a.pos[0], a.pos[1], a.walking ? state.bob : 0),
  });
  sprites.sort((x, y) => x.depth - y.depth);
  for (const s of sprites) s.draw();
}

// --- room layout (v1: hand-placed) ------------------------------------------

const FURNITURE: Furniture[] = [
  { tile: [2, 2], kind: 'chair', color: '#ff8a8a' },
  { tile: [3, 2], kind: 'chair', color: '#ff8a8a' },
  { tile: [2, 3], kind: 'table', color: '#d2b48c' },
  { tile: [3, 3], kind: 'table', color: '#d2b48c' },
  { tile: [7, 1], kind: 'plant', color: '#88aa55' },
  { tile: [1, 7], kind: 'plant', color: '#88aa55' },
  { tile: [7, 7], kind: 'lamp', color: '#ffcc55' },
  { tile: [4, 8], kind: 'crate', color: '#a07050' },
  { tile: [5, 8], kind: 'crate', color: '#a07050' },
  { tile: [4, 4], kind: 'rug', color: '#3a5a8a' },
  { tile: [4, 5], kind: 'rug', color: '#3a5a8a' },
  { tile: [5, 4], kind: 'rug', color: '#3a5a8a' },
  { tile: [5, 5], kind: 'rug', color: '#3a5a8a' },
];

// --- React component ---------------------------------------------------------

export default function AtriumPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hint, setHint] = useState('click any tile to walk.');

  const stateRef = useRef<SceneState>({
    avatar: { tile: [5, 5], pos: [5, 5], path: [], walking: false, lastStep: 0, facing: 'S' },
    hover: null,
    hoverBlocked: false,
    bob: 0,
  });

  const walkable = useMemo(() => {
    const grid: boolean[][] = Array.from({ length: ROOM_SIZE }, () =>
      Array(ROOM_SIZE).fill(true),
    );
    for (const f of FURNITURE) {
      if (FURN_DEFS[f.kind].walkable) continue;
      grid[f.tile[0]][f.tile[1]] = false;
    }
    return grid;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const getView = (): View => {
      const rect = canvas.getBoundingClientRect();
      return { cx: rect.width / 2, cy: rect.height / 2 - 60 };
    };

    const mouseScreen = { x: 0, y: 0, inside: false };
    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseScreen.x = e.clientX - rect.left;
      mouseScreen.y = e.clientY - rect.top;
      mouseScreen.inside = true;
    };
    const onLeave = () => {
      mouseScreen.inside = false;
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const view = getView();
      const t = screenToTile(view, e.clientX - rect.left, e.clientY - rect.top);
      const ti = Math.round(t.i);
      const tj = Math.round(t.j);
      if (ti < 0 || ti >= ROOM_SIZE || tj < 0 || tj >= ROOM_SIZE) return;
      if (!walkable[ti][tj]) {
        setHint('that tile is blocked.');
        return;
      }
      const a = stateRef.current.avatar;
      const start: Tile = [Math.round(a.pos[0]), Math.round(a.pos[1])];
      if (start[0] === ti && start[1] === tj) {
        setHint("you're already there.");
        return;
      }
      const path = findPath(walkable, start, [ti, tj]);
      if (!path) {
        setHint("can't reach that tile.");
        return;
      }
      a.tile = start;
      a.pos = [start[0], start[1]];
      a.path = path.slice(1);
      a.walking = a.path.length > 0;
      a.lastStep = performance.now();
      setHint(`walking ${a.path.length} tile${a.path.length === 1 ? '' : 's'}…`);
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const view = getView();
      const s = stateRef.current;
      const a = s.avatar;

      if (a.walking && a.path.length > 0) {
        const t = Math.min(1, (now - a.lastStep) / STEP_MS);
        const next = a.path[0];
        a.pos = [
          a.tile[0] + (next[0] - a.tile[0]) * t,
          a.tile[1] + (next[1] - a.tile[1]) * t,
        ];
        if (next[0] > a.tile[0]) a.facing = 'E';
        else if (next[0] < a.tile[0]) a.facing = 'W';
        else if (next[1] > a.tile[1]) a.facing = 'S';
        else if (next[1] < a.tile[1]) a.facing = 'N';
        if (t >= 1) {
          a.tile = next;
          a.pos = [next[0], next[1]];
          a.path.shift();
          a.lastStep = now;
          if (a.path.length === 0) {
            a.walking = false;
            setHint(`here. tile (${next[0]}, ${next[1]}).`);
          }
        }
      }

      s.bob = a.walking ? Math.sin(now * 0.012) * 0.04 : 0;

      if (mouseScreen.inside) {
        const hv = screenToTile(view, mouseScreen.x, mouseScreen.y);
        const hi = Math.round(hv.i);
        const hj = Math.round(hv.j);
        if (hi >= 0 && hi < ROOM_SIZE && hj >= 0 && hj < ROOM_SIZE) {
          s.hover = [hi, hj];
          s.hoverBlocked = !walkable[hi][hj];
        } else {
          s.hover = null;
        }
      } else {
        s.hover = null;
      }

      renderScene(ctx, view, s, FURNITURE);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('click', onClick);
    };
  }, [walkable]);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-at">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">atrium</span>
        </div>

        <div className="at-stage">
          <canvas ref={canvasRef} className="at-canvas" />
          <div className="at-bar">
            <span className="at-room">~/atrium · 10×10 · v1</span>
            <span className="at-hint">{hint}</span>
          </div>
        </div>
      </main>
    </>
  );
}

const CSS = `
  .shell-at {
    max-width: 100%;
    margin: 0 auto;
    padding: 0 var(--sp-4);
    height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
  }

  .crumbs {
    padding: var(--sp-3) 0;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    flex-shrink: 0;
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .at-stage {
    position: relative;
    flex: 1;
    border: 1px solid var(--color-border);
    background: #0a0a0a;
    overflow: hidden;
    min-height: 400px;
  }
  .at-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    cursor: crosshair;
  }

  .at-bar {
    position: absolute;
    bottom: var(--sp-3);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: var(--sp-4);
    align-items: center;
    padding: var(--sp-2) var(--sp-4);
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid var(--color-accent-dim);
    box-shadow: 0 0 20px color-mix(in oklch, var(--color-accent) 18%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    max-width: calc(100% - var(--sp-6));
  }
  .at-room {
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 10px;
  }
  .at-hint { color: var(--color-accent); }
`;

import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  bodyColor: string,
) {
  drawIsoBox(ctx, view, i, j, 0.45, 0.45, 0.85 + bob, bodyColor);
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

type Avatar = {
  tile: Tile;
  pos: [number, number];
  path: Tile[];
  walking: boolean;
  lastStep: number;
  facing: Facing;
};

type Peer = Avatar & {
  id: string;
  nickname: string;
  color: string;
  lastChat: { text: string; expires: number } | null;
};

type SceneState = {
  avatar: Avatar;
  hover: Tile | null;
  hoverBlocked: boolean;
  bob: number;
  peers: Map<string, Peer>;
  selfId: string | null;
  selfColor: string;
  selfChat: { text: string; expires: number } | null;
};

// --- wire protocol ---------------------------------------------------------

type ServerMsg =
  | { t: 'init'; selfId: string; peers: { id: string; nickname: string; color: string; tile: Tile; facing: Facing }[] }
  | { t: 'join'; peer: { id: string; nickname: string; color: string; tile: Tile; facing: Facing } }
  | { t: 'walk'; id: string; from: Tile; path: Tile[]; at: number }
  | { t: 'chat'; id: string; text: string; at: number }
  | { t: 'leave'; id: string };

type ClientMsg =
  | { t: 'hello'; nickname: string; color: string }
  | { t: 'walk'; from: Tile; path: Tile[] }
  | { t: 'chat'; text: string };

const CHAT_TTL_MS = 5_000;

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
  // remote peers
  for (const peer of state.peers.values()) {
    sprites.push({
      depth: peer.pos[0] + peer.pos[1] + 0.01,
      draw: () => drawAvatar(ctx, view, peer.pos[0], peer.pos[1], peer.walking ? state.bob : 0, peer.color),
    });
  }
  // self avatar — bias forward by epsilon so same-depth furniture renders behind it
  sprites.push({
    depth: a.pos[0] + a.pos[1] + 0.02,
    draw: () => drawAvatar(ctx, view, a.pos[0], a.pos[1], a.walking ? state.bob : 0, state.selfColor),
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

// --- identity (nickname + derived color) ------------------------------------

function loadOrMintNickname(): string {
  if (typeof localStorage === 'undefined') return randomNickname();
  const stored = localStorage.getItem('atrium-nickname');
  if (stored && stored.trim()) return stored.trim().slice(0, 24);
  const fresh = randomNickname();
  try {
    localStorage.setItem('atrium-nickname', fresh);
  } catch {
    // private browsing / quota — fine, just non-persistent
  }
  return fresh;
}

function randomNickname(): string {
  const adjectives = ['cosy', 'vivid', 'tidy', 'soft', 'lush', 'plush', 'wry', 'mint', 'rosy', 'amber'];
  const nouns = ['lemur', 'finch', 'otter', 'fox', 'crow', 'badger', 'orca', 'newt', 'koi', 'moth'];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  return `${a}-${n}`;
}

function colorFromNickname(s: string): string {
  // djb2-ish hash → HSL → hex. Same nickname always yields the same colour
  // so peers identify each other consistently across reconnects.
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  const hue = ((h >>> 0) % 360) / 360;
  return hslToHex(hue, 0.55, 0.62);
}

function hslToHex(h: number, s: number, l: number): string {
  // h, s, l in [0, 1]
  const k = (n: number) => (n + h * 12) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

// --- React component ---------------------------------------------------------

type OverlayEntry = { id: string; nickname: string; color: string; isSelf: boolean };
type OverlayRefs = { wrap: HTMLDivElement; label: HTMLDivElement; bubble: HTMLDivElement };

export default function AtriumPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const overlayRefsMap = useRef<Map<string, OverlayRefs>>(new Map());

  const nicknameRef = useRef<string>('');
  const colorRef = useRef<string>('#6aeaa0');
  if (!nicknameRef.current) {
    nicknameRef.current = loadOrMintNickname();
    colorRef.current = colorFromNickname(nicknameRef.current);
  }

  const [hint, setHint] = useState('click any tile to walk.');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [overlayList, setOverlayList] = useState<OverlayEntry[]>([
    { id: 'self', nickname: nicknameRef.current, color: colorRef.current, isSelf: true },
  ]);
  const [chatDraft, setChatDraft] = useState('');

  const stateRef = useRef<SceneState>({
    avatar: { tile: [5, 5], pos: [5, 5], path: [], walking: false, lastStep: 0, facing: 'S' },
    hover: null,
    hoverBlocked: false,
    bob: 0,
    peers: new Map(),
    selfId: null,
    selfColor: colorRef.current,
    selfChat: null,
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

  // websocket lifecycle ------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1000;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/atrium-ws`;

    const onMessage = (ev: MessageEvent) => {
      if (cancelled) return;
      let msg: ServerMsg;
      try {
        msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '');
      } catch {
        return;
      }
      switch (msg.t) {
        case 'init': {
          setStatus('connected');
          stateRef.current.selfId = msg.selfId;
          stateRef.current.peers.clear();
          for (const p of msg.peers) {
            stateRef.current.peers.set(p.id, {
              id: p.id,
              nickname: p.nickname,
              color: p.color,
              tile: p.tile,
              pos: [p.tile[0], p.tile[1]],
              path: [],
              walking: false,
              lastStep: performance.now(),
              facing: p.facing,
              lastChat: null,
            });
          }
          setOverlayList([
            { id: 'self', nickname: nicknameRef.current, color: colorRef.current, isSelf: true },
            ...msg.peers.map((p) => ({ id: p.id, nickname: p.nickname, color: p.color, isSelf: false })),
          ]);
          break;
        }
        case 'join': {
          const p = msg.peer;
          stateRef.current.peers.set(p.id, {
            id: p.id,
            nickname: p.nickname,
            color: p.color,
            tile: p.tile,
            pos: [p.tile[0], p.tile[1]],
            path: [],
            walking: false,
            lastStep: performance.now(),
            facing: p.facing,
            lastChat: null,
          });
          setOverlayList((prev) =>
            prev.some((o) => o.id === p.id)
              ? prev
              : [...prev, { id: p.id, nickname: p.nickname, color: p.color, isSelf: false }],
          );
          break;
        }
        case 'walk': {
          const peer = stateRef.current.peers.get(msg.id);
          if (!peer) break;
          const latency = Math.max(0, Math.min(1000, Date.now() - msg.at));
          peer.tile = msg.from;
          peer.pos = [msg.from[0], msg.from[1]];
          peer.path = msg.path.slice();
          peer.walking = peer.path.length > 0;
          // start the walk slightly in the past so we visually "catch up" the latency
          peer.lastStep = performance.now() - latency;
          break;
        }
        case 'chat': {
          const peer = stateRef.current.peers.get(msg.id);
          if (!peer) break;
          peer.lastChat = { text: msg.text, expires: performance.now() + CHAT_TTL_MS };
          const refs = overlayRefsMap.current.get(msg.id);
          if (refs) {
            refs.bubble.textContent = msg.text;
            refs.bubble.style.display = '';
          }
          break;
        }
        case 'leave': {
          stateRef.current.peers.delete(msg.id);
          setOverlayList((prev) => prev.filter((o) => o.id !== msg.id));
          break;
        }
      }
    };

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;
      ws.addEventListener('open', () => {
        if (cancelled) {
          ws.close();
          return;
        }
        backoffMs = 1000;
        ws.send(JSON.stringify({ t: 'hello', nickname: nicknameRef.current, color: colorRef.current } satisfies ClientMsg));
      });
      ws.addEventListener('message', onMessage);
      ws.addEventListener('close', () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (cancelled) return;
        // drop everyone — they'll reappear on the next init
        stateRef.current.peers.clear();
        setOverlayList([{ id: 'self', nickname: nicknameRef.current, color: colorRef.current, isSelf: true }]);
        scheduleReconnect();
      });
      ws.addEventListener('error', () => {
        // close fires after error — handled there
      });
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      setStatus('disconnected');
      reconnectTimer = setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, 30_000);
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // canvas + render loop -----------------------------------------------------

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
      // tell the server (and through it, every other client)
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ t: 'walk', from: start, path: a.path } satisfies ClientMsg));
      }
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('click', onClick);

    const advanceWalk = (av: Avatar, now: number): boolean => {
      if (!av.walking || av.path.length === 0) return false;
      const t = Math.min(1, (now - av.lastStep) / STEP_MS);
      const next = av.path[0];
      av.pos = [
        av.tile[0] + (next[0] - av.tile[0]) * t,
        av.tile[1] + (next[1] - av.tile[1]) * t,
      ];
      if (next[0] > av.tile[0]) av.facing = 'E';
      else if (next[0] < av.tile[0]) av.facing = 'W';
      else if (next[1] > av.tile[1]) av.facing = 'S';
      else if (next[1] < av.tile[1]) av.facing = 'N';
      if (t >= 1) {
        av.tile = next;
        av.pos = [next[0], next[1]];
        av.path.shift();
        av.lastStep = now;
        if (av.path.length === 0) av.walking = false;
        return true; // step boundary crossed
      }
      return false;
    };

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const view = getView();
      const s = stateRef.current;
      const a = s.avatar;

      if (advanceWalk(a, now) && !a.walking) {
        setHint(`here. tile (${a.tile[0]}, ${a.tile[1]}).`);
      }
      for (const peer of s.peers.values()) advanceWalk(peer, now);

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

      // position DOM overlays + expire stale chat bubbles
      const positionOverlay = (id: string, i: number, j: number) => {
        const refs = overlayRefsMap.current.get(id);
        if (!refs) return;
        const top = project(view, i, j, 1.55);
        refs.wrap.style.transform = `translate(${top.x}px, ${top.y}px)`;
      };
      const expireChat = (id: string, last: { text: string; expires: number } | null, clear: () => void) => {
        if (!last) return;
        if (now >= last.expires) {
          const refs = overlayRefsMap.current.get(id);
          if (refs) refs.bubble.style.display = 'none';
          clear();
        }
      };
      positionOverlay('self', a.pos[0], a.pos[1]);
      expireChat('self', s.selfChat, () => {
        s.selfChat = null;
      });
      for (const peer of s.peers.values()) {
        positionOverlay(peer.id, peer.pos[0], peer.pos[1]);
        expireChat(peer.id, peer.lastChat, () => {
          peer.lastChat = null;
        });
      }
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

  const onChatSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = chatDraft.trim().slice(0, 200);
      if (!text) return;
      // optimistic local bubble — server doesn't echo to sender
      stateRef.current.selfChat = { text, expires: performance.now() + CHAT_TTL_MS };
      const refs = overlayRefsMap.current.get('self');
      if (refs) {
        refs.bubble.textContent = text;
        refs.bubble.style.display = '';
      }
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ t: 'chat', text } satisfies ClientMsg));
      }
      setChatDraft('');
    },
    [chatDraft],
  );

  const peerCount = overlayList.length - 1;
  const statusLabel =
    status === 'connected'
      ? `connected · ${peerCount} ${peerCount === 1 ? 'peer' : 'peers'}`
      : status === 'connecting'
      ? 'connecting…'
      : 'reconnecting…';

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

          <div className="at-overlay" aria-hidden="true">
            {overlayList.map((o) => (
              <div
                key={o.id}
                className="peer-overlay"
                ref={(el) => {
                  if (el) {
                    const label = el.querySelector('.peer-label') as HTMLDivElement;
                    const bubble = el.querySelector('.peer-bubble') as HTMLDivElement;
                    overlayRefsMap.current.set(o.id, { wrap: el, label, bubble });
                  } else {
                    overlayRefsMap.current.delete(o.id);
                  }
                }}
              >
                <div className="peer-bubble" style={{ display: 'none' }} />
                <div className="peer-label" style={{ color: o.color }}>
                  {o.nickname}
                  {o.isSelf ? ' · you' : ''}
                </div>
              </div>
            ))}
          </div>

          <div className={`at-status status-${status}`}>
            <span className="at-status-dot" />
            {statusLabel}
          </div>

          <form className="at-chat" onSubmit={onChatSubmit}>
            <input
              className="at-chat-input"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="say hi…"
              maxLength={200}
              autoComplete="off"
              spellCheck={false}
            />
          </form>

          <div className="at-bar">
            <span className="at-room">~/atrium · 10×10 · v2</span>
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

  .at-overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .peer-overlay {
    position: absolute;
    top: 0; left: 0;
    transform: translate(-9999px, -9999px);
    will-change: transform;
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }
  .peer-label {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid currentColor;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
    transform: translate(-50%, 0);
    white-space: nowrap;
    margin-top: 4px;
  }
  .peer-bubble {
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.35;
    padding: 6px 10px;
    background: var(--color-fg);
    color: #000;
    border-radius: 12px;
    transform: translate(-50%, -100%);
    margin-top: -6px;
    max-width: 240px;
    white-space: pre-wrap;
    word-break: break-word;
    position: relative;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  }
  .peer-bubble::after {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -6px;
    width: 0; height: 0;
    transform: translateX(-50%);
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 6px solid var(--color-fg);
  }

  .at-status {
    position: absolute;
    top: var(--sp-3);
    left: var(--sp-3);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid var(--color-accent-dim);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-dim);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .at-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-fg-faint);
  }
  .at-status.status-connected .at-status-dot {
    background: var(--color-accent);
    box-shadow: 0 0 6px var(--color-accent);
  }
  .at-status.status-connecting .at-status-dot {
    background: #ffcc55;
    animation: at-pulse 1s ease-in-out infinite;
  }
  .at-status.status-disconnected .at-status-dot {
    background: #ff5577;
  }
  @keyframes at-pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  .at-chat {
    position: absolute;
    bottom: 64px;
    left: 50%;
    transform: translateX(-50%);
    width: min(360px, calc(100% - var(--sp-6)));
  }
  .at-chat-input {
    width: 100%;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: 6px 10px;
    outline: 0;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .at-chat-input:focus {
    border-color: var(--color-accent-dim);
    box-shadow: 0 0 12px color-mix(in oklch, var(--color-accent) 24%, transparent);
  }
  .at-chat-input::placeholder { color: var(--color-fg-faint); }

  @media (max-width: 760px) {
    .at-status { font-size: 9px; padding: 3px 8px; }
    .at-chat { width: calc(100% - var(--sp-4)); bottom: 60px; }
  }
`;

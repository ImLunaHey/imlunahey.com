import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAuthorizationUrl,
  deleteStoredSession,
  OAuthUserAgent,
  type Session,
} from '@atcute/oauth-browser-client';
import { XRPC } from '@atcute/client';
import type { ActorIdentifier } from '@atcute/lexicons';
import { ATRIUM_FIGURE_SCOPE, ensureOAuthConfigured, getCurrentSession } from '../../lib/oauth';
import { useProfile } from '../../hooks/use-profile';

const TILE_W = 64;
const TILE_H = 32;
const ROOM_SIZE = 10;
const WALL_H = 3.2; // wall height in tile units
const STEP_MS = 280;

type Tile = readonly [number, number];
type Facing = 'N' | 'S' | 'E' | 'W';
type View = { cx: number; cy: number };
type FurnKind = 'chair' | 'table' | 'plant' | 'lamp' | 'crate' | 'rug';
/** Direction the chair (or other oriented furniture) is "looking" —
 *  the seat faces that way and the back is on the opposite side. Only
 *  meaningful for `kind: 'chair'` today; defaults to S when missing. */
type Furniture = { tile: Tile; kind: FurnKind; color: string; facing?: Facing };

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
  hover: 'rgba(106, 234, 160, 0.28)',
  hoverBlocked: 'rgba(255, 90, 90, 0.30)',
  pathDot: 'rgba(106, 234, 160, 0.55)',
  body: '#6aeaa0',
  head: '#f3d7b0',
};

type RoomTheme = { floorA: string; floorB: string; wallNorth: string; wallWest: string };

const THEMES: Record<string, RoomTheme> = {
  phosphor: { floorA: '#222a30', floorB: '#1c2228', wallNorth: '#3a3a45', wallWest: '#2c2c34' },
  amber: { floorA: '#3a2818', floorB: '#2e2010', wallNorth: '#4a3520', wallWest: '#3a2818' },
  verdant: { floorA: '#1c2e1c', floorB: '#172517', wallNorth: '#2a3a2a', wallWest: '#1f2f1f' },
};

type PublicRoom = { id: string; label: string; theme: keyof typeof THEMES; blurb: string };

const PUBLIC_ROOMS: PublicRoom[] = [
  { id: 'lobby', label: 'lobby', theme: 'phosphor', blurb: 'the front room. phosphor green, default hangout.' },
  { id: 'cafe', label: 'café', theme: 'amber', blurb: 'amber-lit. for slower conversations.' },
  { id: 'garden', label: 'garden', theme: 'verdant', blurb: 'green floor. plants. quieter.' },
];

function themeForRoom(roomId: string): RoomTheme {
  const found = PUBLIC_ROOMS.find((r) => r.id === roomId);
  return THEMES[found?.theme ?? 'phosphor'];
}

type Portal = { tile: Tile; dest: string; destLabel: string };

/** Per-room portal layout. Walking onto a portal tile warps you to its
 *  `dest` room. Portals are placed at room-edge positions so they read
 *  visually as "doors" — and the tile itself stays walkable so
 *  pathfinding doesn't avoid it. */
const PORTALS: Record<string, Portal[]> = {
  lobby: [
    { tile: [9, 5], dest: 'cafe', destLabel: 'café' },
    { tile: [5, 9], dest: 'garden', destLabel: 'garden' },
  ],
  cafe: [{ tile: [9, 5], dest: 'lobby', destLabel: 'lobby' }],
  garden: [{ tile: [5, 9], dest: 'lobby', destLabel: 'lobby' }],
};

function portalsFor(roomId: string): Portal[] {
  return PORTALS[roomId] ?? [];
}

/** Pick a spawn tile next to a portal — the first walkable cardinal
 *  neighbour. West first since portals are mostly on east/south edges
 *  and "into the room" is west/north for those. Falls back to the
 *  caller's default if every neighbour is blocked or out of bounds. */
/** Server-side snapshot of an atrium session — the room the user was
 *  last in and the exact tile + sitting state at the time. The DO is
 *  the only writer; the client receives this in `init.you` whenever it
 *  (re)connects to a room and uses it to decide where to spawn. */
type AtriumSavedState = {
  currentRoom: string;
  position: { tile: [number, number]; sitting: [number, number] | null } | null;
};

/** Look up a chair at this tile in the current room's furniture and
 *  return its facing (defaults to S when the tile isn't a chair or
 *  the chair has no explicit facing). Used everywhere we set an
 *  avatar to a sitting state. */
function chairFacingAt(furniture: Furniture[], tile: Tile): Facing {
  const chair = furniture.find(
    (f) => f.kind === 'chair' && f.tile[0] === tile[0] && f.tile[1] === tile[1],
  );
  return chair?.facing ?? 'S';
}

function findSpawnAdjacent(walkable: boolean[][], portal: Tile, fallback: Tile): Tile {
  const [pi, pj] = portal;
  const candidates: Tile[] = [
    [pi - 1, pj],
    [pi, pj - 1],
    [pi + 1, pj],
    [pi, pj + 1],
  ];
  for (const c of candidates) {
    if (c[0] < 0 || c[0] >= ROOM_SIZE || c[1] < 0 || c[1] >= ROOM_SIZE) continue;
    if (walkable[c[0]][c[1]]) return c;
  }
  return fallback;
}

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
    case 'chair': {
      // The back panel sits on the opposite side of the chair's
      // `facing` (default S = back on north). For E/W facings the
      // panel is rotated 90° (thin along j instead of along i). Draw
      // order matters: if the back's iso depth is *less* than the
      // seat's, it's behind in screen space and must be drawn first.
      const facing: Facing = f.facing ?? 'S';
      const backDi = facing === 'E' ? -0.3 : facing === 'W' ? 0.3 : 0;
      const backDj = facing === 'S' ? -0.3 : facing === 'N' ? 0.3 : 0;
      const backW = facing === 'E' || facing === 'W' ? 0.12 : 0.7;
      const backD = facing === 'E' || facing === 'W' ? 0.7 : 0.12;
      const backDepth = i + backDi + j + backDj;
      const seatDepth = i + j;
      const drawBackFirst = backDepth < seatDepth;
      const drawBack = () =>
        drawIsoBox(ctx, view, i + backDi, j + backDj, backW, backD, 0.95, f.color);
      const drawSeat = () => drawIsoBox(ctx, view, i, j, 0.7, 0.7, 0.4, f.color);
      if (drawBackFirst) {
        drawBack();
        drawSeat();
      } else {
        drawSeat();
        drawBack();
      }
      break;
    }
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

type AvatarDraw = {
  i: number;
  j: number;
  /** When true, the legs alternate-lift on a sin cycle and the body
   *  rides slightly up + down with each step. False = standing still. */
  walking: boolean;
  bodyColor: string;
  headColor: string;
  seed: string;
  /** Drives which head face the identicon is painted on — S/E are
   *  visible in iso (face shows toward viewer), N/W are hidden (only
   *  the hair shows = "facing away" cue). */
  facing: Facing;
  /** When set, draw at this chair tile in a sitting pose (legs hidden,
   *  body shrunk to chair-seat height) instead of the standing pose. */
  sitting: Tile | null;
};

const LEG_H = 0.3;
const LEG_W = 0.13;
const LEG_OFFSET = 0.08; // ± along i to spread the two legs side-by-side
const STEP_PERIOD_MS = 540; // one leg cycle = 2 steps

function drawAvatar(ctx: CanvasRenderingContext2D, view: View, av: AvatarDraw) {
  const ic = identiconFor(av.seed);
  if (av.sitting) {
    // Sitting pose: render at the chair tile, body shrunk to chair-seat
    // height, head atop. Legs hidden (tucked under the seat).
    const [si, sj] = av.sitting;
    const bodyBaseZ = 0.5;
    const bodyH = 0.4;
    const headBaseZ = bodyBaseZ + bodyH;
    const headH = 0.4;
    drawIsoBox(ctx, view, si, sj, 0.45, 0.45, bodyH, av.bodyColor, bodyBaseZ);
    drawIsoBox(ctx, view, si, sj, 0.5, 0.5, headH, av.headColor, headBaseZ);
    drawHair(ctx, view, si, sj, headBaseZ + headH, ic);
    drawFace(ctx, view, si, sj, headBaseZ, headH, ic, av.facing);
    return;
  }

  // Walk phase — drives leg lifts. When standing still both lifts are
  // 0 so the legs sit flat on the floor.
  let leftLift = 0;
  let rightLift = 0;
  if (av.walking) {
    const phase = ((performance.now() % STEP_PERIOD_MS) / STEP_PERIOD_MS) * Math.PI * 2;
    const wave = Math.sin(phase);
    leftLift = Math.max(0, wave) * 0.1;
    rightLift = Math.max(0, -wave) * 0.1;
  }

  // Two legs side-by-side along the i axis, lifted slightly off the
  // floor when their phase is "up". Drawn before the body so the body
  // composes over the leg tops. Sort by lift so the higher one renders
  // on top of the lower (matters less for non-overlapping but cheap).
  drawIsoBox(ctx, view, av.i - LEG_OFFSET, av.j, LEG_W, LEG_W, LEG_H, av.bodyColor, leftLift);
  drawIsoBox(ctx, view, av.i + LEG_OFFSET, av.j, LEG_W, LEG_W, LEG_H, av.bodyColor, rightLift);

  // Body sits on the legs. When walking, the body rides up by the
  // smaller of the two lifts (so it follows the lower leg, like a real
  // step) — that's a tiny vertical bob without distortion.
  const bodyRide = Math.min(leftLift, rightLift);
  const bodyBaseZ = LEG_H + bodyRide;
  const bodyH = 0.55;
  drawIsoBox(ctx, view, av.i, av.j, 0.45, 0.45, bodyH, av.bodyColor, bodyBaseZ);

  // Head on top
  const headBaseZ = bodyBaseZ + bodyH;
  const headH = 0.4;
  drawIsoBox(ctx, view, av.i, av.j, 0.5, 0.5, headH, av.headColor, headBaseZ);
  drawHair(ctx, view, av.i, av.j, headBaseZ + headH, ic);
  drawFace(ctx, view, av.i, av.j, headBaseZ, headH, ic, av.facing);
}

/** Screen-space pixel offset for an active emote, used by the renderer
 *  via `ctx.translate()` around the avatar draw. Returns {0,0} when the
 *  emote is missing/expired. */
function emoteOffset(emote: { kind: EmoteKind; expires: number } | null, now: number): { dx: number; dy: number } {
  if (!emote || now >= emote.expires) return { dx: 0, dy: 0 };
  const total = EMOTE_DURATIONS[emote.kind];
  const elapsed = total - (emote.expires - now);
  switch (emote.kind) {
    case 'wave': {
      // sway side-to-side, decaying amplitude as it ends
      const amp = 5 * (1 - elapsed / total);
      return { dx: Math.sin(elapsed * 0.025) * (5 - amp + 5), dy: 0 };
    }
    case 'dance': {
      return {
        dx: Math.sin(elapsed * 0.018) * 4,
        dy: -Math.abs(Math.sin(elapsed * 0.03)) * 6,
      };
    }
    case 'jump': {
      // single arc: 0 → -peak → 0 over the duration
      const t = elapsed / total; // 0..1
      const peak = 4 * t * (1 - t); // 0 at t=0/1, 1 at t=0.5
      return { dx: 0, dy: -peak * 14 };
    }
  }
}

function drawHair(ctx: CanvasRenderingContext2D, view: View, i: number, j: number, baseZ: number, ic: Identicon) {
  switch (ic.hair) {
    case 0:
      return; // bald
    case 1: // flat top — thin slab covering the head
      drawIsoBox(ctx, view, i, j, 0.55, 0.55, 0.07, ic.hairColor, baseZ);
      return;
    case 2: // tall hat — narrower, taller
      drawIsoBox(ctx, view, i, j, 0.4, 0.4, 0.45, ic.hairColor, baseZ);
      return;
    case 3: // cap — small dome-ish
      drawIsoBox(ctx, view, i, j, 0.5, 0.5, 0.16, ic.hairColor, baseZ);
      return;
    case 4: // spike — narrow column
      drawIsoBox(ctx, view, i, j, 0.18, 0.18, 0.45, ic.hairColor, baseZ);
      return;
    case 5: // bow — two small adjacent boxes on top
      drawIsoBox(ctx, view, i - 0.14, j, 0.16, 0.16, 0.18, ic.hairColor, baseZ);
      drawIsoBox(ctx, view, i + 0.14, j, 0.16, 0.16, 0.18, ic.hairColor, baseZ);
      return;
    case 6: // pageboy — wider and slightly taller
      drawIsoBox(ctx, view, i, j, 0.6, 0.6, 0.18, ic.hairColor, baseZ - 0.05);
      return;
    case 7: // antenna
      drawIsoBox(ctx, view, i, j, 0.06, 0.06, 0.55, ic.hairColor, baseZ);
      drawIsoBox(ctx, view, i, j, 0.16, 0.16, 0.1, ic.hairColor, baseZ + 0.55);
      return;
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  view: View,
  i: number,
  j: number,
  baseZ: number,
  h: number,
  ic: Identicon,
  facing: Facing,
) {
  // Face features live on whichever head face the avatar is currently
  // looking through. Only S and E are visible in our iso projection —
  // for N and W the face is on a hidden cube face, so we skip drawing
  // and the viewer naturally sees the back of the head + hair (which
  // reads correctly as "facing away").
  if (facing === 'N' || facing === 'W') return;
  // Compute the chosen face's 4 corners once, then bilinear-interpolate
  // face-relative (u, v) coords onto screen-space pixels — same eye /
  // mouth / brow positions work on either face since they're given as
  // fractions of the face rather than world tile coords.
  let TL: { x: number; y: number };
  let TR: { x: number; y: number };
  let BL: { x: number; y: number };
  if (facing === 'S') {
    // South face (j = +0.25). u increases as i increases (screen-right).
    const faceJ = j + 0.25;
    TL = project(view, i - 0.25, faceJ, baseZ + h);
    TR = project(view, i + 0.25, faceJ, baseZ + h);
    BL = project(view, i - 0.25, faceJ, baseZ);
  } else {
    // East face (i = +0.25). u increases as j DECREASES (the face
    // points east, so 'face-right' from the viewer is toward the back
    // of the room = lower j).
    const faceI = i + 0.25;
    TL = project(view, faceI, j + 0.25, baseZ + h);
    TR = project(view, faceI, j - 0.25, baseZ + h);
    BL = project(view, faceI, j + 0.25, baseZ);
  }
  const ux = TR.x - TL.x;
  const uy = TR.y - TL.y;
  const vx = BL.x - TL.x;
  const vy = BL.y - TL.y;
  const at = (u: number, v: number) => ({
    x: TL.x + u * ux + v * vx,
    y: TL.y + u * uy + v * vy,
  });

  const eyeL = at(0.32, 0.46);
  const eyeR = at(0.68, 0.46);
  drawEye(ctx, eyeL.x, eyeL.y, ic.eyes, ic.faceColor);
  drawEye(ctx, eyeR.x, eyeR.y, ic.eyes, ic.faceColor);

  const mouth = at(0.5, 0.78);
  drawMouth(ctx, mouth.x, mouth.y, ic.mouth, ic.faceColor);

  if (ic.brows > 0) {
    const browL = at(0.32, 0.28);
    const browR = at(0.68, 0.28);
    drawBrow(ctx, browL.x, browL.y, ic.brows, false, ic.faceColor);
    drawBrow(ctx, browR.x, browR.y, ic.brows, true, ic.faceColor);
  }
}

function drawEye(ctx: CanvasRenderingContext2D, x: number, y: number, style: number, color: string) {
  ctx.fillStyle = color;
  switch (style) {
    case 0: // dot
      ctx.fillRect(x - 1, y - 1, 2, 2);
      return;
    case 1: // dash
      ctx.fillRect(x - 2, y, 4, 1);
      return;
    case 2: // square
      ctx.fillRect(x - 2, y - 2, 3, 3);
      return;
    case 3: // closed (sleepy)
      ctx.fillRect(x - 2, y, 4, 1);
      return;
    case 4: // wide circle-ish
      ctx.fillRect(x - 2, y - 1, 4, 3);
      return;
    case 5: // dot with gleam (two-tone)
      ctx.fillRect(x - 1, y - 1, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y - 1, 1, 1);
      return;
    case 6: // wink left
      ctx.fillRect(x - 1, y - 1, 2, 2);
      return;
    case 7: // squint
      ctx.fillRect(x - 2, y, 4, 1);
      ctx.fillRect(x - 1, y - 1, 2, 1);
      return;
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, x: number, y: number, style: number, color: string) {
  ctx.fillStyle = color;
  switch (style) {
    case 0: // small dot
      ctx.fillRect(x, y, 1, 1);
      return;
    case 1: // line
      ctx.fillRect(x - 2, y, 4, 1);
      return;
    case 2: // wide line
      ctx.fillRect(x - 3, y, 6, 1);
      return;
    case 3: // open square
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 1, y - 1, 3, 2);
      return;
    case 4: // smile (curve approximated by 3-pixel arc)
      ctx.fillRect(x - 2, y, 1, 1);
      ctx.fillRect(x - 1, y + 1, 3, 1);
      ctx.fillRect(x + 2, y, 1, 1);
      return;
    case 5: // frown (inverse smile)
      ctx.fillRect(x - 2, y + 1, 1, 1);
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x + 2, y + 1, 1, 1);
      return;
    case 6: // tongue out
      ctx.fillRect(x - 2, y, 4, 1);
      ctx.fillStyle = '#d04060';
      ctx.fillRect(x, y + 1, 2, 1);
      return;
    case 7: // gasp
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      return;
  }
}

function drawBrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  style: number,
  right: boolean,
  color: string,
) {
  ctx.fillStyle = color;
  switch (style) {
    case 1: // flat
      ctx.fillRect(x - 2, y, 4, 1);
      return;
    case 2: // raised — slanted up toward outside
      if (right) {
        ctx.fillRect(x - 2, y, 2, 1);
        ctx.fillRect(x, y - 1, 2, 1);
      } else {
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x - 2, y - 1, 2, 1);
      }
      return;
    case 3: // furrowed — slanted down toward middle
      if (right) {
        ctx.fillRect(x, y, 2, 1);
        ctx.fillRect(x - 2, y - 1, 2, 1);
      } else {
        ctx.fillRect(x - 2, y, 2, 1);
        ctx.fillRect(x, y - 1, 2, 1);
      }
      return;
  }
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
  /** Chair tile this avatar is currently sitting on (rendered there at
   *  chair-seat height instead of at tile/pos). null when standing. */
  sitting: Tile | null;
  /** Set on the local avatar when the user clicked a chair: marks the
   *  chair to snap to once the walk completes. Server peers don't have
   *  this — they just receive a `sit` message at the right moment. */
  sitOnArrival: Tile | null;
  /** Active emote (one of EMOTE_KINDS) and when its animation ends. */
  emote: { kind: EmoteKind; expires: number } | null;
};

type Peer = Avatar & {
  id: string;
  nickname: string;
  bodyColor: string;
  headColor: string;
  lastChat: { text: string; expires: number } | null;
};

type EmoteKind = 'wave' | 'dance' | 'jump';
const EMOTE_DURATIONS: Record<EmoteKind, number> = {
  wave: 1500,
  dance: 3000,
  jump: 600,
};
const EMOTE_KINDS = new Set<string>(['wave', 'dance', 'jump']);

type SceneState = {
  avatar: Avatar;
  hover: Tile | null;
  hoverBlocked: boolean;
  peers: Map<string, Peer>;
  selfId: string | null;
  selfBodyColor: string;
  selfHeadColor: string;
  selfNickname: string;
  selfChat: { text: string; expires: number } | null;
};

// --- wire protocol ---------------------------------------------------------

type WirePeer = {
  id: string;
  nickname: string;
  bodyColor: string;
  headColor: string;
  tile: Tile;
  facing: Facing;
  sitting: Tile | null;
};

type ServerMsg =
  | { t: 'init'; selfId: string; peers: WirePeer[]; you: AtriumSavedState | null }
  | { t: 'join'; peer: WirePeer }
  | { t: 'walk'; id: string; from: Tile; path: Tile[]; at: number }
  | { t: 'chat'; id: string; text: string; at: number }
  | { t: 'style'; id: string; bodyColor: string; headColor: string }
  | { t: 'sit'; id: string; tile: Tile | null }
  | { t: 'emote'; id: string; kind: EmoteKind; at: number }
  | { t: 'leave'; id: string };

type ClientMsg =
  | { t: 'hello'; nickname: string; bodyColor: string; headColor: string; clientId: string }
  | { t: 'walk'; from: Tile; path: Tile[] }
  | { t: 'chat'; text: string }
  | { t: 'style'; bodyColor: string; headColor: string }
  | { t: 'sit'; tile: Tile | null }
  | { t: 'emote'; kind: EmoteKind };

const DISPLACED_CODE = 4001;

const CHAT_TTL_MS = 5_000;

function renderScene(
  ctx: CanvasRenderingContext2D,
  view: View,
  state: SceneState,
  furniture: Furniture[],
  theme: RoomTheme,
  portals: Portal[],
  occupancy: Record<string, number>,
) {
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, w, h);

  // back walls (drawn first, behind everything)
  drawWall(ctx, view, 'i', theme.wallNorth);
  drawWall(ctx, view, 'j', theme.wallWest);

  // floor tiles
  for (let i = 0; i < ROOM_SIZE; i++) {
    for (let j = 0; j < ROOM_SIZE; j++) {
      drawTile(ctx, view, i, j, (i + j) % 2 === 0 ? theme.floorA : theme.floorB);
    }
  }

  // rugs (still floor-level, draw on top of tiles but under hover)
  for (const f of furniture) {
    if (FURN_DEFS[f.kind].walkable) drawFurniture(ctx, view, f);
  }

  // portals — pulsing tinted floor tiles whose colour matches the
  // destination room's theme so the user can read the doorway at a glance
  if (portals.length > 0) {
    const t = performance.now() * 0.003;
    const pulse = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t));
    for (const p of portals) {
      const destTheme = themeForRoom(p.dest);
      const cx = view.cx + (p.tile[0] - p.tile[1]) * (TILE_W / 2);
      const cy = view.cy + (p.tile[0] + p.tile[1]) * (TILE_H / 2);
      // tinted infill (use destination's wall colour — brighter than the floor)
      ctx.save();
      ctx.globalAlpha = pulse;
      drawTile(ctx, view, p.tile[0], p.tile[1], destTheme.wallNorth);
      ctx.restore();
      // pulsing rim
      ctx.strokeStyle = `rgba(106, 234, 160, ${0.55 + 0.35 * Math.sin(t * 1.3)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - TILE_H / 2);
      ctx.lineTo(cx + TILE_W / 2, cy);
      ctx.lineTo(cx, cy + TILE_H / 2);
      ctx.lineTo(cx - TILE_W / 2, cy);
      ctx.closePath();
      ctx.stroke();
    }
    // labels are drawn AFTER the sprite loop below so furniture never
    // covers them.
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
  const renderNow = performance.now();
  // remote peers
  for (const peer of state.peers.values()) {
    const drawTile = peer.sitting ?? [Math.round(peer.pos[0]), Math.round(peer.pos[1])];
    const off = emoteOffset(peer.emote, renderNow);
    sprites.push({
      depth: drawTile[0] + drawTile[1] + 0.01,
      draw: () => {
        if (off.dx || off.dy) {
          ctx.save();
          ctx.translate(off.dx, off.dy);
        }
        drawAvatar(ctx, view, {
          i: peer.pos[0],
          j: peer.pos[1],
          walking: peer.walking,
          bodyColor: peer.bodyColor,
          headColor: peer.headColor,
          seed: peer.nickname,
          facing: peer.facing,
          sitting: peer.sitting,
        });
        if (off.dx || off.dy) ctx.restore();
      },
    });
  }
  // self avatar — bias forward by epsilon so same-depth furniture renders behind it
  const selfDrawTile = a.sitting ?? [Math.round(a.pos[0]), Math.round(a.pos[1])];
  const selfOff = emoteOffset(a.emote, renderNow);
  sprites.push({
    depth: selfDrawTile[0] + selfDrawTile[1] + 0.02,
    draw: () => {
      if (selfOff.dx || selfOff.dy) {
        ctx.save();
        ctx.translate(selfOff.dx, selfOff.dy);
      }
      drawAvatar(ctx, view, {
        i: a.pos[0],
        j: a.pos[1],
        walking: a.walking,
        bodyColor: state.selfBodyColor,
        headColor: state.selfHeadColor,
        seed: state.selfNickname,
        facing: a.facing,
        sitting: a.sitting,
      });
      if (selfOff.dx || selfOff.dy) ctx.restore();
    },
  });
  sprites.sort((x, y) => x.depth - y.depth);
  for (const s of sprites) s.draw();

  // portal labels render LAST so they sit on top of every sprite — even
  // tall furniture whose iso-box screen extent overlaps the label region
  // (e.g. a crate on the same screen-x as a portal would otherwise cover
  // the text).
  if (portals.length > 0) {
    ctx.font = "bold 11px 'JetBrains Mono Variable', ui-monospace, monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const p of portals) {
      const cx = view.cx + (p.tile[0] - p.tile[1]) * (TILE_W / 2);
      const cy = view.cy + (p.tile[0] + p.tile[1]) * (TILE_H / 2);
      const count = occupancy[p.dest];
      const label = count != null ? `${p.destLabel} · ${count}` : p.destLabel;
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeText(label, cx, cy - TILE_H / 2 - 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fillText(label, cx, cy - TILE_H / 2 - 4);
    }
  }
}

// --- room layouts (per-room hand-placed) ------------------------------------

/** Per-public-room furniture. Designed so each room has a distinct
 *  spatial feel (lobby = central rug + crates, café = bistro
 *  triplets, garden = perimeter plants + small seating cluster) and
 *  so the spawn point [5,5] + portal tiles stay walkable in every
 *  layout. Custom rooms (any URL outside this table) fall back to
 *  DEFAULT_LAYOUT — minimal furnishings so a fresh room doesn't look
 *  broken-empty. */
const ROOM_LAYOUTS: Record<string, Furniture[]> = {
  lobby: [
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
  ],
  cafe: [
    // four bistro triplets (chair + table + chair) scattered around the
    // room with warm-wood tones; central single rug.
    // bistro pairs: chairs flank a central table and face it (E/W)
    { tile: [2, 2], kind: 'chair', color: '#c98a6e', facing: 'E' },
    { tile: [3, 2], kind: 'table', color: '#7d4a30' },
    { tile: [4, 2], kind: 'chair', color: '#c98a6e', facing: 'W' },
    { tile: [6, 2], kind: 'chair', color: '#c98a6e', facing: 'E' },
    { tile: [7, 2], kind: 'table', color: '#7d4a30' },
    { tile: [8, 2], kind: 'chair', color: '#c98a6e', facing: 'W' },
    { tile: [2, 7], kind: 'chair', color: '#c98a6e', facing: 'E' },
    { tile: [3, 7], kind: 'table', color: '#7d4a30' },
    { tile: [4, 7], kind: 'chair', color: '#c98a6e', facing: 'W' },
    { tile: [1, 4], kind: 'lamp', color: '#ffaa55' },
    { tile: [8, 4], kind: 'lamp', color: '#ffaa55' },
    { tile: [5, 5], kind: 'rug', color: '#5a3a18' },
  ],
  garden: [
    // plant border along the back + sides, small seating cluster
    // toward the front; one accent lamp. spawn [5,5] kept clear.
    { tile: [1, 1], kind: 'plant', color: '#88aa55' },
    { tile: [3, 1], kind: 'plant', color: '#aabb44' },
    { tile: [5, 1], kind: 'plant', color: '#88aa55' },
    { tile: [7, 1], kind: 'plant', color: '#aabb44' },
    { tile: [9, 1], kind: 'plant', color: '#88aa55' },
    { tile: [1, 3], kind: 'plant', color: '#5d8a3a' },
    { tile: [1, 5], kind: 'plant', color: '#88aa55' },
    { tile: [1, 7], kind: 'plant', color: '#5d8a3a' },
    { tile: [9, 3], kind: 'plant', color: '#88aa55' },
    { tile: [9, 7], kind: 'plant', color: '#5d8a3a' },
    { tile: [3, 6], kind: 'chair', color: '#d4b08a', facing: 'E' },
    { tile: [4, 6], kind: 'table', color: '#8c5e30' },
    { tile: [5, 6], kind: 'chair', color: '#d4b08a', facing: 'W' },
    { tile: [7, 7], kind: 'lamp', color: '#aaee88' },
  ],
};

const DEFAULT_LAYOUT: Furniture[] = [
  // minimal furnishings for custom rooms — feels less broken than empty
  { tile: [3, 3], kind: 'chair', color: '#888888' },
  { tile: [4, 3], kind: 'table', color: '#888888' },
  { tile: [7, 7], kind: 'plant', color: '#88aa55' },
];

function furnitureFor(roomId: string): Furniture[] {
  return ROOM_LAYOUTS[roomId] ?? DEFAULT_LAYOUT;
}

function buildWalkable(furniture: Furniture[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: ROOM_SIZE }, () =>
    Array(ROOM_SIZE).fill(true),
  );
  for (const f of furniture) {
    if (FURN_DEFS[f.kind].walkable) continue;
    grid[f.tile[0]][f.tile[1]] = false;
  }
  return grid;
}

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

/** Stable per-browser id used for session dedup. Different browsers (and
 *  incognito windows) get different ids; tabs of the same browser share
 *  it. The signed-in flow overrides this with the did at hello time, so
 *  signing in on two tabs of the same browser still dedupes correctly. */
function loadOrMintClientId(): string {
  if (typeof localStorage === 'undefined') return crypto.randomUUID();
  const stored = localStorage.getItem('atrium-client-id');
  if (stored && stored.trim()) return stored.trim();
  const fresh = crypto.randomUUID();
  try {
    localStorage.setItem('atrium-client-id', fresh);
  } catch {
    /* ignore */
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

/** Deterministic per-identity face + hair, hashed from the same kind of
 *  seed `colorFromNickname` uses. Pure local computation — never sent
 *  over the wire; every client computes the same identicon for a given
 *  peer from that peer's nickname (which IS sent). */
type Identicon = {
  eyes: number;
  mouth: number;
  brows: number;
  hair: number;
  hairColor: string;
  faceColor: string;
};

const HAIR_PALETTE = [
  '#1a1a1a', // black
  '#5a3a1a', // dark brown
  '#a07050', // medium brown
  '#d4b08a', // blonde
  '#ffcc55', // gold
  '#ff8a8a', // pink
  '#88aacc', // pale blue
  '#aa66cc', // purple
];

const FACE_PALETTE = ['#1a1a1a', '#2a1408', '#0a141e', '#1e0a14'];

function identiconFor(seed: string): Identicon {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
  const u = h >>> 0;
  return {
    eyes: u & 0x7,
    mouth: (u >> 3) & 0x7,
    brows: (u >> 6) & 0x3,
    hair: (u >> 8) & 0x7,
    hairColor: HAIR_PALETTE[(u >> 11) & 0x7],
    faceColor: FACE_PALETTE[(u >> 14) & 0x3],
  };
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

const DEFAULT_HEAD_COLOR = '#f3d7b0';

export default function AtriumPage({ initialRoom }: { initialRoom?: string }) {
  // Room is internal state, not a route param. Walking onto a portal
  // calls setRoom(dest) — no URL change, no remount. The full session
  // (current room, previous room, exact tile + sitting state) is loaded
  // from D1 on mount and saved back on every change so refresh, tab
  // close, and even a different device end up in the same place.
  // Initial value here is just a placeholder — the D1 fetch effect
  // overwrites it once the bootstrap arrives.
  const [roomId, setRoom] = useState<string>(initialRoom ?? 'lobby');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<(() => void) | null>(null);
  const overlayRefsMap = useRef<Map<string, OverlayRefs>>(new Map());
  // Theme + portals are per-room. Render loop and tick read from these
  // refs each frame so a room change doesn't have to tear down the canvas
  // effect — only the ws effect, which has roomId in its deps.
  const themeRef = useRef<RoomTheme>(themeForRoom(roomId));
  const portalsRef = useRef<Portal[]>(portalsFor(roomId));
  useEffect(() => {
    themeRef.current = themeForRoom(roomId);
    portalsRef.current = portalsFor(roomId);
  }, [roomId]);

  // Tracks the room we were just in (for entrance-portal spawn). Seeded
  // by the D1 bootstrap effect; null until then. useRef is safe here
  // because the component no longer remounts on room change.
  const previousRoomRef = useRef<string | null>(null);
  /** Set by the WS `init` handler when the server returned saved state
   *  for this room — the spawn effect uses it (exact tile + sitting)
   *  instead of falling back to entrance / centre. Cleared after
   *  consumption so a subsequent in-app room change doesn't reuse a
   *  stale value. */
  const pendingSpawnRef = useRef<{ tile: [number, number]; sitting: [number, number] | null } | null>(null);

  // Stable callback for the tick loop to fire room changes without
  // capturing setRoom in a closure that gets baked into the canvas
  // effect.
  const setRoomRef = useRef(setRoom);
  useEffect(() => {
    setRoomRef.current = setRoom;
  }, [setRoom]);

  // The mount-once tick loop reads the current room from this ref so it
  // can persist position snapshots tagged with the right room name on
  // every walk completion + sit/stand.
  const roomIdRef = useRef(roomId);
  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  const nicknameRef = useRef<string>('');
  const bodyColorRef = useRef<string>('#6aeaa0');
  const headColorRef = useRef<string>(DEFAULT_HEAD_COLOR);
  // `clientId` is the per-identity dedup key the server uses to kick
  // older sessions when a new tab from the same identity connects.
  // Defaults to a stable per-browser uuid; gets swapped to the did once
  // a sign-in completes (see effect below).
  const clientIdRef = useRef<string>('');
  if (!nicknameRef.current) {
    nicknameRef.current = loadOrMintNickname();
    bodyColorRef.current = colorFromNickname(nicknameRef.current);
    clientIdRef.current = loadOrMintClientId();
  }

  const [hint, setHint] = useState('click any tile to walk.');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'displaced' | 'disconnected'>('connecting');
  const [overlayList, setOverlayList] = useState<OverlayEntry[]>([
    { id: 'self', nickname: nicknameRef.current, color: bodyColorRef.current, isSelf: true },
  ]);
  const [chatDraft, setChatDraft] = useState('');
  // Live per-room occupancy used to label portals — kept in a ref because
  // the canvas effect is mount-once and reads it each frame.
  const occupancyRef = useRef<Record<string, number>>({});

  const stateRef = useRef<SceneState>({
    avatar: {
      tile: [5, 5],
      pos: [5, 5],
      path: [],
      walking: false,
      lastStep: 0,
      facing: 'S',
      sitting: null,
      sitOnArrival: null,
      emote: null,
    },
    hover: null,
    hoverBlocked: false,
    peers: new Map(),
    selfId: null,
    selfBodyColor: bodyColorRef.current,
    selfHeadColor: headColorRef.current,
    selfNickname: nicknameRef.current,
    selfChat: null,
  });

  // Per-room furniture + the matching walkability grid live behind refs
  // so the canvas effect's closure stays stable across room switches.
  // Updated synchronously alongside the theme/portals refs above.
  const furnitureRef = useRef<Furniture[]>(furnitureFor(roomId));
  const walkableRef = useRef<boolean[][]>(buildWalkable(furnitureRef.current));

  // On room change, swap furniture + walkability and respawn the avatar
  // at the room centre. Respawn prevents bouncing back through a portal
  // we just used and avoids landing on a tile the new room blocks.
  useEffect(() => {
    furnitureRef.current = furnitureFor(roomId);
    walkableRef.current = buildWalkable(furnitureRef.current);

    // Spawn priority:
    //   1. If `init` returned a saved position for THIS room (refresh
    //      restoration), use that exact tile + sitting state.
    //   2. Otherwise fall back to the entrance portal — the portal in
    //      this room whose destination is the room we just came from.
    //   3. Otherwise drop the avatar in the centre.
    const a = stateRef.current.avatar;
    let spawn: Tile = [5, 5];
    let spawnSitting: [number, number] | null = null;
    const pending = pendingSpawnRef.current;
    if (pending) {
      const inb =
        pending.tile[0] >= 0 && pending.tile[0] < ROOM_SIZE &&
        pending.tile[1] >= 0 && pending.tile[1] < ROOM_SIZE;
      if (inb && walkableRef.current[pending.tile[0]][pending.tile[1]]) {
        spawn = [pending.tile[0], pending.tile[1]];
        spawnSitting = pending.sitting;
      }
      pendingSpawnRef.current = null;
    } else {
      const prev = previousRoomRef.current;
      if (prev && prev !== roomId) {
        const entrance = portalsRef.current.find((p) => p.dest === prev);
        if (entrance) {
          spawn = findSpawnAdjacent(walkableRef.current, entrance.tile, [5, 5]);
        }
      }
    }
    previousRoomRef.current = roomId;

    a.tile = spawn;
    a.pos = [spawn[0], spawn[1]];
    a.path = [];
    a.walking = false;
    a.lastStep = performance.now();
    a.sitting = spawnSitting;
    a.sitOnArrival = null;
    a.emote = null;
    if (spawnSitting) {
      a.facing = chairFacingAt(furnitureRef.current, spawnSitting);
    }
    setHint('walk onto a glowing tile to teleport. click a chair to sit; type /wave or /dance to emote.');
  }, [roomId]);

  // websocket lifecycle ------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = 1000;
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/atrium-ws?room=${encodeURIComponent(roomId)}`;

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
            // For sitting peers, override the server-reported facing
            // with the chair's facing (server doesn't track this; the
            // shared layouts do).
            const facing: Facing = p.sitting
              ? chairFacingAt(furnitureRef.current, p.sitting)
              : p.facing;
            stateRef.current.peers.set(p.id, {
              id: p.id,
              nickname: p.nickname,
              bodyColor: p.bodyColor,
              headColor: p.headColor,
              tile: p.tile,
              pos: [p.tile[0], p.tile[1]],
              path: [],
              walking: false,
              lastStep: performance.now(),
              facing,
              sitting: p.sitting,
              sitOnArrival: null,
              emote: null,
              lastChat: null,
            });
          }
          setOverlayList([
            { id: 'self', nickname: nicknameRef.current, color: bodyColorRef.current, isSelf: true },
            ...msg.peers.map((p) => ({ id: p.id, nickname: p.nickname, color: p.bodyColor, isSelf: false })),
          ]);
          // Server-side persisted state for THIS user. The DO already
          // filtered: `you.position` is the saved tile/sitting only when
          // the user's last room matches the room we're joining now —
          // otherwise position is null and we use entrance / centre.
          if (msg.you?.position) {
            const a = stateRef.current.avatar;
            const inb =
              msg.you.position.tile[0] >= 0 && msg.you.position.tile[0] < ROOM_SIZE &&
              msg.you.position.tile[1] >= 0 && msg.you.position.tile[1] < ROOM_SIZE;
            if (inb) {
              a.tile = msg.you.position.tile;
              a.pos = [msg.you.position.tile[0], msg.you.position.tile[1]];
              a.sitting = msg.you.position.sitting;
              if (a.sitting) {
                a.facing = chairFacingAt(furnitureRef.current, a.sitting);
              }
            }
          }
          break;
        }
        case 'join': {
          const p = msg.peer;
          const facing: Facing = p.sitting
            ? chairFacingAt(furnitureRef.current, p.sitting)
            : p.facing;
          stateRef.current.peers.set(p.id, {
            id: p.id,
            nickname: p.nickname,
            bodyColor: p.bodyColor,
            headColor: p.headColor,
            tile: p.tile,
            pos: [p.tile[0], p.tile[1]],
            path: [],
            walking: false,
            lastStep: performance.now(),
            facing,
            sitting: p.sitting,
            sitOnArrival: null,
            emote: null,
            lastChat: null,
          });
          setOverlayList((prev) =>
            prev.some((o) => o.id === p.id)
              ? prev
              : [...prev, { id: p.id, nickname: p.nickname, color: p.bodyColor, isSelf: false }],
          );
          break;
        }
        case 'style': {
          const peer = stateRef.current.peers.get(msg.id);
          if (!peer) break;
          peer.bodyColor = msg.bodyColor;
          peer.headColor = msg.headColor;
          setOverlayList((prev) =>
            prev.map((o) => (o.id === msg.id ? { ...o, color: msg.bodyColor } : o)),
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
          // walking implies standing — server clears sitting on the same trigger
          peer.sitting = null;
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
        case 'sit': {
          const peer = stateRef.current.peers.get(msg.id);
          if (!peer) break;
          peer.sitting = msg.tile;
          // Snap facing to the chair's facing (looked up in our own
          // ROOM_LAYOUTS — every client has the same layouts so we
          // don't need to wire facing through the protocol).
          if (msg.tile) peer.facing = chairFacingAt(furnitureRef.current, msg.tile);
          break;
        }
        case 'emote': {
          const peer = stateRef.current.peers.get(msg.id);
          if (!peer) break;
          const latency = Math.max(0, Math.min(1000, Date.now() - msg.at));
          peer.emote = {
            kind: msg.kind,
            expires: performance.now() - latency + EMOTE_DURATIONS[msg.kind],
          };
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
        ws.send(
          JSON.stringify({
            t: 'hello',
            nickname: nicknameRef.current,
            bodyColor: bodyColorRef.current,
            headColor: headColorRef.current,
            clientId: clientIdRef.current,
          } satisfies ClientMsg),
        );
      });
      ws.addEventListener('message', onMessage);
      ws.addEventListener('close', (ev) => {
        if (wsRef.current === ws) wsRef.current = null;
        if (cancelled) return;
        // drop everyone — they'll reappear on the next init
        stateRef.current.peers.clear();
        setOverlayList([{ id: 'self', nickname: nicknameRef.current, color: bodyColorRef.current, isSelf: true }]);
        if (ev.code === DISPLACED_CODE) {
          // Another tab from the same identity took over. Don't reconnect
          // automatically — the user can click "take over" to reclaim.
          setStatus('displaced');
          return;
        }
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
    // Expose the connect function so the "take over" button can re-open
    // the ws after a displacement (where automatic reconnect is suppressed).
    reconnectRef.current = () => {
      if (cancelled) return;
      backoffMs = 1000;
      connect();
    };

    return () => {
      cancelled = true;
      reconnectRef.current = null;
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
    // roomId in deps so navigating between rooms tears down the old ws and
    // opens a new one to the new room's DO.
  }, [roomId]);

  // poll the worker for live per-room occupancy → renders as a small label
  // above each portal so the user can see how busy a destination is before
  // walking through. Written into a ref because the canvas effect is
  // mount-once and reads it each frame.

  useEffect(() => {
    let cancelled = false;
    const ids = PUBLIC_ROOMS.map((r) => r.id).join(',');
    const poll = async () => {
      try {
        const r = await fetch(`/api/atrium-rooms?ids=${encodeURIComponent(ids)}`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as Record<string, number>;
        if (!cancelled) occupancyRef.current = data;
      } catch {
        /* ignore — keep the last known counts */
      }
    };
    void poll();
    const handle = window.setInterval(() => void poll(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
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
      const w = walkableRef.current;
      const a = stateRef.current.avatar;
      const start: Tile = [Math.round(a.pos[0]), Math.round(a.pos[1])];
      const ws = wsRef.current;
      const wsOpen = ws && ws.readyState === WebSocket.OPEN;

      // Did the user click on a chair? Chairs are non-walkable, so the
      // normal walkable check would just say "blocked" — here we route to
      // the closest walkable neighbour and remember to sit on arrival.
      const targetChair = furnitureRef.current.find(
        (f) => f.kind === 'chair' && f.tile[0] === ti && f.tile[1] === tj,
      );
      if (targetChair) {
        const neighbours: Tile[] = [
          [ti + 1, tj],
          [ti - 1, tj],
          [ti, tj + 1],
          [ti, tj - 1],
        ];
        let bestPath: Tile[] | null = null;
        for (const n of neighbours) {
          if (n[0] < 0 || n[0] >= ROOM_SIZE || n[1] < 0 || n[1] >= ROOM_SIZE) continue;
          if (!w[n[0]][n[1]]) continue;
          const p = findPath(w, start, n);
          if (p && (bestPath == null || p.length < bestPath.length)) bestPath = p;
        }
        if (!bestPath) {
          setHint("can't reach that chair.");
          return;
        }
        a.tile = start;
        a.pos = [start[0], start[1]];
        a.path = bestPath.slice(1);
        a.walking = a.path.length > 0;
        a.lastStep = performance.now();
        a.sitOnArrival = [ti, tj];
        // walking implicitly stands you up (server enforces same)
        if (a.sitting) a.sitting = null;
        if (a.path.length === 0) {
          // already adjacent — sit immediately
          a.sitting = [ti, tj];
          a.sitOnArrival = null;
          a.facing = chairFacingAt(furnitureRef.current, [ti, tj]);
          setHint('sat down.');
          if (wsOpen) ws!.send(JSON.stringify({ t: 'sit', tile: [ti, tj] } satisfies ClientMsg));
        } else {
          setHint(`walking to sit (${a.path.length} tile${a.path.length === 1 ? '' : 's'})…`);
          if (wsOpen) ws!.send(JSON.stringify({ t: 'walk', from: start, path: a.path } satisfies ClientMsg));
        }
        return;
      }

      if (!w[ti][tj]) {
        setHint('that tile is blocked.');
        return;
      }
      if (start[0] === ti && start[1] === tj) {
        setHint("you're already there.");
        return;
      }
      const path = findPath(w, start, [ti, tj]);
      if (!path) {
        setHint("can't reach that tile.");
        return;
      }
      const wasSitting = a.sitting != null;
      a.tile = start;
      a.pos = [start[0], start[1]];
      a.path = path.slice(1);
      a.walking = a.path.length > 0;
      a.lastStep = performance.now();
      a.sitOnArrival = null;
      a.sitting = null; // walking always stands you up
      const target = portalsRef.current.find((p) => p.tile[0] === ti && p.tile[1] === tj);
      if (target) {
        setHint(`walking to → ${target.destLabel} (${a.path.length} tile${a.path.length === 1 ? '' : 's'})…`);
      } else {
        setHint(`walking ${a.path.length} tile${a.path.length === 1 ? '' : 's'}…`);
      }
      // tell the server (and through it, every other client)
      if (wsOpen) {
        if (wasSitting) ws!.send(JSON.stringify({ t: 'sit', tile: null } satisfies ClientMsg));
        ws!.send(JSON.stringify({ t: 'walk', from: start, path: a.path } satisfies ClientMsg));
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

      const stepped = advanceWalk(a, now);
      if (stepped) {
        // Portal trigger fires only on a step boundary, never on the
        // initial spawn — so we don't bounce-loop when respawning next
        // to a portal in the destination room.
        const here = portalsRef.current.find(
          (p) => p.tile[0] === a.tile[0] && p.tile[1] === a.tile[1],
        );
        if (here) {
          setHint(`warping to ${here.destLabel}…`);
          a.path = [];
          a.walking = false;
          // Internal state change — no URL update, no remount. The
          // room-change effect picks up the new value, swaps refs, and
          // respawns the avatar next to the entrance portal.
          setRoomRef.current(here.dest);
        } else if (!a.walking) {
          // Walk done — if we were heading toward a chair, sit on it.
          if (a.sitOnArrival) {
            a.sitting = a.sitOnArrival;
            a.facing = chairFacingAt(furnitureRef.current, a.sitOnArrival);
            a.sitOnArrival = null;
            setHint('sat down.');
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ t: 'sit', tile: a.sitting } satisfies ClientMsg));
            }
          } else {
            setHint(`here. tile (${a.tile[0]}, ${a.tile[1]}).`);
          }
        }
      }
      for (const peer of s.peers.values()) advanceWalk(peer, now);

      // Expire stale emotes — both self and peers — once their timer's up.
      if (a.emote && now >= a.emote.expires) a.emote = null;
      for (const peer of s.peers.values()) {
        if (peer.emote && now >= peer.emote.expires) peer.emote = null;
      }

      if (mouseScreen.inside) {
        const hv = screenToTile(view, mouseScreen.x, mouseScreen.y);
        const hi = Math.round(hv.i);
        const hj = Math.round(hv.j);
        if (hi >= 0 && hi < ROOM_SIZE && hj >= 0 && hj < ROOM_SIZE) {
          s.hover = [hi, hj];
          s.hoverBlocked = !walkableRef.current[hi][hj];
        } else {
          s.hover = null;
        }
      } else {
        s.hover = null;
      }

      renderScene(ctx, view, s, furnitureRef.current, themeRef.current, portalsRef.current, occupancyRef.current);

      // Determine which avatar (if any) is under the cursor — labels are
      // hidden by default and fade in only for the hovered avatar (or any
      // peer that's mid-chat, so you can see who's speaking).
      let hoveredAvatarId: string | null = null;
      if (s.hover) {
        const [hi, hj] = s.hover;
        if (Math.round(a.pos[0]) === hi && Math.round(a.pos[1]) === hj) {
          hoveredAvatarId = 'self';
        } else {
          for (const peer of s.peers.values()) {
            if (Math.round(peer.pos[0]) === hi && Math.round(peer.pos[1]) === hj) {
              hoveredAvatarId = peer.id;
              break;
            }
          }
        }
      }

      // position DOM overlays + expire stale chat bubbles + toggle label visibility
      const updateOverlay = (
        id: string,
        i: number,
        j: number,
        chat: { text: string; expires: number } | null,
        clearChat: () => void,
      ) => {
        const refs = overlayRefsMap.current.get(id);
        if (!refs) return;
        const top = project(view, i, j, 1.55);
        refs.wrap.style.transform = `translate(${top.x}px, ${top.y}px)`;
        if (chat && now >= chat.expires) {
          refs.bubble.style.display = 'none';
          clearChat();
          chat = null;
        }
        const visible = id === hoveredAvatarId || chat != null;
        refs.label.style.opacity = visible ? '1' : '0';
      };
      updateOverlay('self', a.pos[0], a.pos[1], s.selfChat, () => {
        s.selfChat = null;
      });
      for (const peer of s.peers.values()) {
        updateOverlay(peer.id, peer.pos[0], peer.pos[1], peer.lastChat, () => {
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
    // mount-once — the canvas, raf loop, and listeners outlive every
    // room change. furniture / walkability / theme / portals are read
    // from refs each frame.
  }, []);

  // identity / figure persistence ------------------------------------------

  const [session, setSession] = useState<Session | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const [signInOpen, setSignInOpen] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInErr, setSignInErr] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [bodyDraft, setBodyDraft] = useState('#6aeaa0');
  const [headDraft, setHeadDraft] = useState(DEFAULT_HEAD_COLOR);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const did = session?.info.sub ?? '';
  const { data: profile } = useProfile({ actor: did });
  const signedInHandle = profile?.handle ?? null;

  // shared helpers — apply local color/nickname changes everywhere they're
  // used (refs the render loop reads, react state for the overlay list, the
  // ws so peers see the new appearance).

  const applyColors = useCallback((bodyColor: string, headColor: string) => {
    bodyColorRef.current = bodyColor;
    headColorRef.current = headColor;
    stateRef.current.selfBodyColor = bodyColor;
    stateRef.current.selfHeadColor = headColor;
    setOverlayList((prev) => prev.map((o) => (o.id === 'self' ? { ...o, color: bodyColor } : o)));
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ t: 'style', bodyColor, headColor } satisfies ClientMsg));
    }
  }, []);

  // Renaming mid-session needs the server to re-broadcast the peer's name —
  // the wire protocol only does that on hello, so the cheapest way to
  // propagate is to drop the connection and let the reconnect logic fire.
  const applyNickname = useCallback((nick: string) => {
    if (nicknameRef.current === nick) return;
    nicknameRef.current = nick;
    stateRef.current.selfNickname = nick;
    setOverlayList((prev) => prev.map((o) => (o.id === 'self' ? { ...o, nickname: nick } : o)));
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  }, []);

  // load existing session + figure record on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getCurrentSession();
        if (cancelled) return;
        if (!s) return;
        setSession(s);
        // signed-in users dedupe on did so multi-device same-account also kicks
        clientIdRef.current = s.info.sub;
        try {
          const agent = new OAuthUserAgent(s as unknown as ConstructorParameters<typeof OAuthUserAgent>[0]);
          const rpc = new XRPC({ handler: agent });
          const r = await rpc.get('com.atproto.repo.getRecord', {
            params: {
              repo: s.info.sub as ActorIdentifier,
              collection: 'com.imlunahey.atrium.figure',
              rkey: 'self',
            },
          });
          if (cancelled) return;
          const v = (r.data as unknown as { value?: { bodyColor?: string; headColor?: string } }).value;
          const okHex = (h: unknown): h is string => typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h);
          if (okHex(v?.bodyColor)) {
            applyColors(v!.bodyColor!.toLowerCase(), okHex(v?.headColor) ? v!.headColor!.toLowerCase() : DEFAULT_HEAD_COLOR);
          }
        } catch {
          // no figure record yet — fine, the user starts with derived colors
        }
      } finally {
        if (!cancelled) setIdentityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyColors]);

  // when the profile resolves, swap the nickname → handle (forces a ws
  // reconnect so peers see the new label too).
  useEffect(() => {
    if (signedInHandle) applyNickname(signedInHandle);
  }, [signedInHandle, applyNickname]);

  const onSignInSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const handle = handleInput.trim();
      if (!handle) return;
      setSignInErr(null);
      setSigningIn(true);
      try {
        ensureOAuthConfigured();
        const url = await createAuthorizationUrl({
          target: { type: 'account', identifier: handle as ActorIdentifier },
          scope: ATRIUM_FIGURE_SCOPE,
          state: { returnTo: '/labs/atrium' },
        });
        window.location.assign(url.toString());
      } catch (e2) {
        setSignInErr(e2 instanceof Error ? e2.message : String(e2));
        setSigningIn(false);
      }
    },
    [handleInput],
  );

  const onSignOut = useCallback(async () => {
    if (!session) return;
    const sessionDid = session.info.sub;
    try {
      const agent = new OAuthUserAgent(session as unknown as ConstructorParameters<typeof OAuthUserAgent>[0]);
      await agent.signOut();
    } catch {
      try {
        deleteStoredSession(sessionDid as Parameters<typeof deleteStoredSession>[0]);
      } catch {
        /* ignore */
      }
    }
    setSession(null);
    setPanelOpen(false);
    // mint a fresh guest identity so the next session looks distinct from
    // the one we just signed out of (instead of inheriting the handle's
    // colors without the handle).
    const fresh = randomNickname();
    try {
      localStorage.setItem('atrium-nickname', fresh);
    } catch {
      /* ignore */
    }
    clientIdRef.current = loadOrMintClientId();
    applyNickname(fresh);
    applyColors(colorFromNickname(fresh), DEFAULT_HEAD_COLOR);
  }, [session, applyNickname, applyColors]);

  const openPanel = useCallback(() => {
    setBodyDraft(bodyColorRef.current);
    setHeadDraft(headColorRef.current);
    setSaveErr(null);
    setPanelOpen(true);
  }, []);

  const onSavePanel = useCallback(async () => {
    if (!session) return;
    const okHex = (h: string) => /^#[0-9a-f]{6}$/.test(h.toLowerCase());
    if (!okHex(bodyDraft) || !okHex(headDraft)) {
      setSaveErr('colors must be 6-digit #rrggbb hex.');
      return;
    }
    setSaving(true);
    setSaveErr(null);
    try {
      const agent = new OAuthUserAgent(session as unknown as ConstructorParameters<typeof OAuthUserAgent>[0]);
      const rpc = new XRPC({ handler: agent });
      const now = new Date().toISOString();
      const record = {
        $type: 'com.imlunahey.atrium.figure',
        bodyColor: bodyDraft.toLowerCase(),
        headColor: headDraft.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      };
      await rpc.call('com.atproto.repo.putRecord', {
        data: {
          repo: session.info.sub as ActorIdentifier,
          collection: 'com.imlunahey.atrium.figure',
          rkey: 'self',
          record,
        },
      });
      applyColors(record.bodyColor, record.headColor);
      setPanelOpen(false);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [session, bodyDraft, headDraft, applyColors]);

  const onChatSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const text = chatDraft.trim().slice(0, 200);
      if (!text) return;
      const ws = wsRef.current;
      const wsOpen = ws && ws.readyState === WebSocket.OPEN;

      // /wave, /dance, /jump → trigger an emote instead of sending chat
      if (text.startsWith('/')) {
        const cmd = text.slice(1).toLowerCase();
        if (EMOTE_KINDS.has(cmd)) {
          const kind = cmd as EmoteKind;
          stateRef.current.avatar.emote = {
            kind,
            expires: performance.now() + EMOTE_DURATIONS[kind],
          };
          if (wsOpen) ws!.send(JSON.stringify({ t: 'emote', kind } satisfies ClientMsg));
          setChatDraft('');
          setHint(`emote: ${kind}`);
          return;
        }
        // unknown / — fall through and send as plain chat
      }

      // optimistic local bubble — server doesn't echo to sender
      stateRef.current.selfChat = { text, expires: performance.now() + CHAT_TTL_MS };
      const refs = overlayRefsMap.current.get('self');
      if (refs) {
        refs.bubble.textContent = text;
        refs.bubble.style.display = '';
      }
      if (wsOpen) ws!.send(JSON.stringify({ t: 'chat', text } satisfies ClientMsg));
      setChatDraft('');
    },
    [chatDraft],
  );

  const onTakeOver = useCallback(() => {
    setStatus('connecting');
    reconnectRef.current?.();
  }, []);

  const peerCount = overlayList.length - 1;
  const roomLabel = PUBLIC_ROOMS.find((r) => r.id === roomId)?.label ?? roomId;
  const statusLabel =
    status === 'connected'
      ? `connected · ${peerCount} ${peerCount === 1 ? 'peer' : 'peers'}`
      : status === 'connecting'
      ? 'connecting…'
      : status === 'displaced'
      ? 'another tab took over'
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
            {status === 'displaced' ? (
              <button type="button" className="at-status-btn" onClick={onTakeOver}>
                take over
              </button>
            ) : null}
          </div>

          <div className="at-identity">
            {identityLoading ? (
              <span className="at-identity-loading">checking session…</span>
            ) : session ? (
              <>
                <span className="at-identity-handle">@{signedInHandle ?? '…'}</span>
                <button type="button" className="at-id-btn" onClick={openPanel}>edit avatar</button>
                <button type="button" className="at-id-btn ghost" onClick={() => void onSignOut()}>sign out</button>
              </>
            ) : (
              <>
                <span className="at-identity-handle muted">guest · {nicknameRef.current}</span>
                {signInOpen ? (
                  <form className="at-signin-form" onSubmit={(e) => void onSignInSubmit(e)}>
                    <input
                      className="at-signin-input"
                      placeholder="your.handle"
                      value={handleInput}
                      onChange={(e) => setHandleInput(e.target.value)}
                      autoComplete="username"
                      autoCapitalize="off"
                      spellCheck={false}
                      autoFocus
                      disabled={signingIn}
                    />
                    <button className="at-id-btn" type="submit" disabled={!handleInput.trim() || signingIn}>
                      {signingIn ? '…' : 'go'}
                    </button>
                    <button
                      className="at-id-btn ghost"
                      type="button"
                      onClick={() => {
                        setSignInOpen(false);
                        setSignInErr(null);
                      }}
                    >
                      cancel
                    </button>
                  </form>
                ) : (
                  <button type="button" className="at-id-btn" onClick={() => setSignInOpen(true)}>
                    sign in
                  </button>
                )}
                {signInErr ? <span className="at-id-err">{signInErr}</span> : null}
              </>
            )}
          </div>

          {panelOpen && session ? (
            <div className="at-panel">
              <div className="at-panel-title">edit avatar</div>
              <p className="at-panel-sub">saved as <code>com.imlunahey.atrium.figure/self</code> on your pds.</p>
              <label className="at-panel-row">
                <span>body</span>
                <input
                  type="color"
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value.toLowerCase())}
                />
                <code>{bodyDraft}</code>
              </label>
              <label className="at-panel-row">
                <span>head</span>
                <input
                  type="color"
                  value={headDraft}
                  onChange={(e) => setHeadDraft(e.target.value.toLowerCase())}
                />
                <code>{headDraft}</code>
              </label>
              <div className="at-panel-actions">
                <button type="button" className="at-id-btn primary" onClick={() => void onSavePanel()} disabled={saving}>
                  {saving ? 'saving…' : 'save'}
                </button>
                <button type="button" className="at-id-btn ghost" onClick={() => setPanelOpen(false)} disabled={saving}>
                  cancel
                </button>
              </div>
              {saveErr ? <div className="at-id-err">{saveErr}</div> : null}
            </div>
          ) : null}

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
            <span className="at-room">~/atrium/<span className="at-room-name">{roomLabel}</span></span>
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
  .at-room-name {
    color: var(--color-accent);
    text-transform: lowercase;
    letter-spacing: 0;
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
    transform: translate(-50%, -100%);
    white-space: nowrap;
    /* hidden by default to keep faces visible — the tick loop fades us in
       when the cursor is over our tile, or when this peer is mid-chat. */
    opacity: 0;
    transition: opacity 0.12s ease-out;
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
  .at-status.status-displaced .at-status-dot {
    background: #ffaa55;
  }
  .at-status-btn {
    margin-left: 4px;
    background: transparent;
    border: 1px solid currentColor;
    color: var(--color-accent);
    font-family: inherit;
    font-size: 9px;
    padding: 2px 6px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .at-status-btn:hover { background: color-mix(in oklch, var(--color-accent) 14%, transparent); }
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

  .at-identity {
    position: absolute;
    top: var(--sp-3);
    right: var(--sp-3);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid var(--color-accent-dim);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-fg-dim);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    max-width: calc(100% - var(--sp-6));
    flex-wrap: wrap;
  }
  .at-identity-handle { color: var(--color-accent); }
  .at-identity-handle.muted { color: var(--color-fg-faint); }
  .at-identity-loading { color: var(--color-fg-faint); }

  .at-id-btn {
    font-family: var(--font-mono);
    font-size: 10px;
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 3px 8px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .at-id-btn:hover:not(:disabled) { filter: brightness(1.1); }
  .at-id-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .at-id-btn.ghost {
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
  }
  .at-id-btn.ghost:hover:not(:disabled) { color: var(--color-accent); border-color: var(--color-accent-dim); }
  .at-id-btn.primary { background: var(--color-accent); color: #000; }

  .at-signin-form {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .at-signin-input {
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid var(--color-border);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: 11px;
    padding: 3px 6px;
    outline: 0;
    width: 160px;
  }
  .at-signin-input:focus { border-color: var(--color-accent-dim); }
  .at-id-err {
    color: #ff8888;
    font-size: 10px;
    width: 100%;
    margin-top: 2px;
  }

  .at-panel {
    position: absolute;
    top: 60px;
    right: var(--sp-3);
    width: min(280px, calc(100% - var(--sp-6)));
    padding: var(--sp-3);
    background: rgba(0, 0, 0, 0.92);
    border: 1px solid var(--color-accent-dim);
    box-shadow: 0 0 24px color-mix(in oklch, var(--color-accent) 22%, transparent);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .at-panel-title {
    color: var(--color-accent);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .at-panel-sub {
    color: var(--color-fg-faint);
    font-size: 10px;
    line-height: 1.4;
    margin: 0;
  }
  .at-panel-sub code {
    background: rgba(255, 255, 255, 0.04);
    padding: 1px 4px;
  }
  .at-panel-row {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    font-size: 11px;
  }
  .at-panel-row > span:first-child {
    width: 36px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 10px;
  }
  .at-panel-row input[type='color'] {
    appearance: none;
    -webkit-appearance: none;
    width: 28px;
    height: 28px;
    background: transparent;
    border: 1px solid var(--color-border);
    cursor: pointer;
    padding: 0;
  }
  .at-panel-row code {
    color: var(--color-accent);
    font-size: 11px;
  }
  .at-panel-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }

  @media (max-width: 760px) {
    .at-status { font-size: 9px; padding: 3px 8px; }
    .at-chat { width: calc(100% - var(--sp-4)); bottom: 60px; }
    .at-identity { font-size: 10px; padding: 3px 6px; }
    .at-signin-input { width: 120px; }
    .at-panel { top: auto; bottom: 110px; right: var(--sp-3); }
  }
`;

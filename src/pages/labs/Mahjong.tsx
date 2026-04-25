import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { XRPC } from '@atcute/client';
import { OAuthUserAgent, createAuthorizationUrl } from '@atcute/oauth-browser-client';
import type { ActorIdentifier } from '@atcute/lexicons';
import { useAtprotoSession } from '../../hooks/use-atproto-session';
import { useProfile } from '../../hooks/use-profile';
import {
  ensureOAuthConfigured,
  LEADERBOARD_SCOPE,
  LEADERBOARD_WRITE_SCOPE,
  sessionHasScope,
} from '../../lib/oauth';
import {
  getLeaderboard,
  LEADERBOARD_MARKER_URI,
  LEADERBOARD_SCORE_COLLECTION,
  signScore,
  type GameId,
  type LeaderboardRow,
} from '../../server/leaderboard';

// ─── tile data model ─────────────────────────────────────────────────────────

type Suit = 'bamboo' | 'circle' | 'character';
type Wind = 'east' | 'south' | 'west' | 'north';
type Dragon = 'red' | 'green' | 'white';

type Face =
  | { kind: 'suit'; suit: Suit; n: number }
  | { kind: 'wind'; dir: Wind }
  | { kind: 'dragon'; color: Dragon }
  | { kind: 'season'; n: number }
  | { kind: 'flower'; n: number };

function faceSymbolId(f: Face): string {
  if (f.kind === 'suit') return `mj-${f.suit}-${f.n}`;
  if (f.kind === 'wind') return `mj-wind-${f.dir}`;
  if (f.kind === 'dragon') return `mj-dragon-${f.color}`;
  if (f.kind === 'season') return `mj-season-${f.n}`;
  return `mj-flower-${f.n}`;
}

// match rule: same exact face for ordinary tiles; any season matches any
// season; any flower matches any flower.
function facesMatch(a: Face, b: Face): boolean {
  if (a.kind === 'season' && b.kind === 'season') return true;
  if (a.kind === 'flower' && b.kind === 'flower') return true;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'suit' && b.kind === 'suit') return a.suit === b.suit && a.n === b.n;
  if (a.kind === 'wind' && b.kind === 'wind') return a.dir === b.dir;
  if (a.kind === 'dragon' && b.kind === 'dragon') return a.color === b.color;
  return false;
}

// build the canonical 144-tile deck as 72 face-pairs. for ordinary tiles
// (suits / winds / dragons) the four copies form two same-face pairs each.
// for seasons / flowers, the four are unique but match within their group,
// so we partition them into two cross-tile pairs.
function buildFacePairs(rng: () => number): Face[][] {
  const pairs: Face[][] = [];
  const suits: Suit[] = ['bamboo', 'circle', 'character'];
  for (const suit of suits) {
    for (let n = 1; n <= 9; n++) {
      pairs.push([{ kind: 'suit', suit, n }, { kind: 'suit', suit, n }]);
      pairs.push([{ kind: 'suit', suit, n }, { kind: 'suit', suit, n }]);
    }
  }
  const winds: Wind[] = ['east', 'south', 'west', 'north'];
  for (const dir of winds) {
    pairs.push([{ kind: 'wind', dir }, { kind: 'wind', dir }]);
    pairs.push([{ kind: 'wind', dir }, { kind: 'wind', dir }]);
  }
  const dragons: Dragon[] = ['red', 'green', 'white'];
  for (const color of dragons) {
    pairs.push([{ kind: 'dragon', color }, { kind: 'dragon', color }]);
    pairs.push([{ kind: 'dragon', color }, { kind: 'dragon', color }]);
  }
  const seasons = shuffled([1, 2, 3, 4], rng);
  pairs.push([{ kind: 'season', n: seasons[0] }, { kind: 'season', n: seasons[1] }]);
  pairs.push([{ kind: 'season', n: seasons[2] }, { kind: 'season', n: seasons[3] }]);
  const flowers = shuffled([1, 2, 3, 4], rng);
  pairs.push([{ kind: 'flower', n: flowers[0] }, { kind: 'flower', n: flowers[1] }]);
  pairs.push([{ kind: 'flower', n: flowers[2] }, { kind: 'flower', n: flowers[3] }]);
  return pairs; // 72 pairs = 144 tiles
}

// ─── layout ──────────────────────────────────────────────────────────────────

type Slot = { id: number; layer: number; col: number; row: number };

export type LayoutId = 'pyramid' | 'wide' | 'tower';

type LayoutDef = {
  label: string;
  blurb: string;
  ranges: Array<[number, number, number, number, number]>; // [layer, c0, c1Excl, r0, r1Excl]
};

// every layout MUST sum to exactly 144 — the deck is hard-coded to that
// number and the pair-up logic falls apart if it doesn't match.
export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  pyramid: {
    label: 'pyramid',
    blurb: 'classic stepped pyramid',
    // 84 + 40 + 12 + 6 + 2 = 144
    ranges: [
      [0, 0, 12, 0, 7],
      [1, 2, 10, 1, 6],
      [2, 4, 8, 2, 5],
      [3, 5, 7, 2, 5],
      [4, 5, 7, 3, 4],
    ],
  },
  wide: {
    label: 'wide',
    blurb: 'low and broad — easier read',
    // 108 + 24 + 12 = 144
    ranges: [
      [0, 0, 18, 0, 6],
      [1, 3, 15, 2, 4],
      [2, 6, 12, 2, 4],
    ],
  },
  tower: {
    label: 'tower',
    blurb: 'narrow + tall — six layers deep',
    // 48 + 36 + 24 + 16 + 12 + 8 = 144
    ranges: [
      [0, 0, 8, 0, 6],
      [1, 1, 7, 0, 6],
      [2, 1, 7, 1, 5],
      [3, 2, 6, 1, 5],
      [4, 2, 6, 1, 4],
      [5, 2, 6, 2, 4],
    ],
  },
};

const LAYOUT_ORDER: LayoutId[] = ['pyramid', 'wide', 'tower'];

function buildLayout(layoutId: LayoutId): Slot[] {
  const out: Slot[] = [];
  let id = 0;
  for (const [layer, c0, c1, r0, r1] of LAYOUTS[layoutId].ranges) {
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        out.push({ id: id++, layer, col: c, row: r });
      }
    }
  }
  return out;
}

// ─── seed encoding ───────────────────────────────────────────────────────────
//
// the seed is a single uint32 that bakes in the layout choice. high 2 bits
// pick the layout (0 = pyramid, 1 = wide, 2 = tower), low 30 bits are the
// rng seed for the deal. that means one shareable number — `1234567890` —
// fully determines both the shape and the tile arrangement.

function encodeSeed(layoutId: LayoutId, rand30: number): number {
  const code = LAYOUT_ORDER.indexOf(layoutId);
  return (((code & 0x3) << 30) | (rand30 & 0x3fffffff)) >>> 0;
}

function decodeSeed(seed: number): LayoutId {
  const code = (seed >>> 30) & 0x3;
  return LAYOUT_ORDER[code] ?? 'pyramid';
}

function freshSeed(layoutId: LayoutId): number {
  return encodeSeed(layoutId, (Math.random() * 0x40000000) >>> 0);
}

// a tile is "free" iff:
//   - no tile in `present` overlaps it from a higher layer at the same (col,row), AND
//   - it has at least one of the two side-neighbours empty (left or right).
function isFree(slot: Slot, present: Map<number, Slot>): boolean {
  let leftBlocked = false;
  let rightBlocked = false;
  for (const s of present.values()) {
    if (s.id === slot.id) continue;
    if (s.layer > slot.layer && s.col === slot.col && s.row === slot.row) return false;
    if (s.layer === slot.layer && s.row === slot.row) {
      if (s.col === slot.col - 1) leftBlocked = true;
      else if (s.col === slot.col + 1) rightBlocked = true;
    }
  }
  return !(leftBlocked && rightBlocked);
}

// ─── solvable deal generator ─────────────────────────────────────────────────

// strategy: forward-simulate a valid play. randomly pick a pair of currently
// free tiles, mark them removed, repeat until empty. record the removal order,
// then assign face-pairs to that order. since we only ever remove free pairs,
// that exact sequence is replayable by the user — the puzzle is solvable.
// random play can dead-end; we retry the simulation until it succeeds.
function rngFromSeed(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shuffled<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function trySimulate(slots: Slot[], rng: () => number): Array<[Slot, Slot]> | null {
  const present = new Map<number, Slot>();
  for (const s of slots) present.set(s.id, s);
  const pairs: Array<[Slot, Slot]> = [];
  while (present.size > 0) {
    const free: Slot[] = [];
    for (const s of present.values()) if (isFree(s, present)) free.push(s);
    if (free.length < 2) return null;
    const i1 = Math.floor(rng() * free.length);
    let i2 = Math.floor(rng() * free.length);
    while (i2 === i1) i2 = Math.floor(rng() * free.length);
    const a = free[i1];
    const b = free[i2];
    pairs.push([a, b]);
    present.delete(a.id);
    present.delete(b.id);
  }
  return pairs;
}

function generateDeal(seed: number): { slots: Slot[]; faces: Map<number, Face>; layoutId: LayoutId } {
  const layoutId = decodeSeed(seed);
  const slots = buildLayout(layoutId);
  const rng = rngFromSeed(seed);
  let order: Array<[Slot, Slot]> | null = null;
  for (let attempt = 0; attempt < 50; attempt++) {
    order = trySimulate(slots, rng);
    if (order) break;
  }
  if (!order) {
    // extremely unlikely with this layout — fall back to the best-effort
    // pairing so the page still renders something playable-ish.
    const pairs = buildFacePairs(rng);
    const faces = new Map<number, Face>();
    for (let i = 0; i < slots.length; i += 2) {
      const f = pairs[Math.floor(i / 2)];
      faces.set(slots[i].id, f[0]);
      faces.set(slots[i + 1].id, f[1]);
    }
    return { slots, faces, layoutId };
  }
  const pairs = shuffled(buildFacePairs(rng), rng);
  const faces = new Map<number, Face>();
  for (let k = 0; k < order.length; k++) {
    const [a, b] = order[k];
    faces.set(a.id, pairs[k][0]);
    faces.set(b.id, pairs[k][1]);
  }
  return { slots, faces, layoutId };
}

// re-pair the faces of the tiles still on the board and reassign them to a
// fresh valid removal order. the player's progress (which slots are gone) is
// preserved; only the visible face values change. like generateDeal, the
// resulting board is guaranteed to have *a* solution sequence.
function shuffleRemaining(
  slots: Slot[],
  existingFaces: Map<number, Face>,
  remainingIds: Set<number>,
  rng: () => number,
): Map<number, Face> | null {
  const remainingSlots = slots.filter((s) => remainingIds.has(s.id));
  if (remainingSlots.length === 0) return new Map(existingFaces);
  if (remainingSlots.length % 2 !== 0) return null;

  const inventory = remainingSlots.map((s) => existingFaces.get(s.id));
  if (inventory.some((f) => f === undefined)) return null;
  const faces = inventory as Face[];

  // pair them up exactly the same way generateDeal would: ordinary tiles
  // (suits / winds / dragons) go in same-face pairs, seasons + flowers
  // group-pair within their kind since any season matches any season.
  const used = new Array(faces.length).fill(false);
  const pairs: Array<[Face, Face]> = [];

  for (let i = 0; i < faces.length; i++) {
    if (used[i]) continue;
    const fi = faces[i];
    if (fi.kind === 'season' || fi.kind === 'flower') continue;
    for (let j = i + 1; j < faces.length; j++) {
      if (used[j]) continue;
      if (facesMatch(fi, faces[j])) {
        pairs.push([fi, faces[j]]);
        used[i] = true;
        used[j] = true;
        break;
      }
    }
  }

  for (const kind of ['season', 'flower'] as const) {
    const idx: number[] = [];
    for (let i = 0; i < faces.length; i++) if (!used[i] && faces[i].kind === kind) idx.push(i);
    if (idx.length % 2 !== 0) return null;
    for (let k = 0; k < idx.length; k += 2) {
      pairs.push([faces[idx[k]], faces[idx[k + 1]]]);
      used[idx[k]] = true;
      used[idx[k + 1]] = true;
    }
  }
  if (pairs.length * 2 !== faces.length) return null;

  const shuffledPairs = shuffled(pairs, rng);

  let order: Array<[Slot, Slot]> | null = null;
  for (let attempt = 0; attempt < 50; attempt++) {
    order = trySimulate(remainingSlots, rng);
    if (order) break;
  }
  if (!order || order.length !== shuffledPairs.length) return null;

  const out = new Map(existingFaces);
  for (let k = 0; k < order.length; k++) {
    const [a, b] = order[k];
    out.set(a.id, shuffledPairs[k][0]);
    out.set(b.id, shuffledPairs[k][1]);
  }
  return out;
}

// ─── tile geometry ───────────────────────────────────────────────────────────

const TILE_W = 60;   // unit width of a tile face on the board grid
const TILE_H = 80;
const BEVEL = 6;     // depth of the 3d shoulder on the bottom + right
const LAYER_DX = 4;  // upper layers shift up-and-left by this many units…
const LAYER_DY = 6;  // …giving the stack visible depth.

function tileXY(slot: Slot): { x: number; y: number } {
  return {
    x: slot.col * TILE_W - slot.layer * LAYER_DX,
    y: slot.row * TILE_H - slot.layer * LAYER_DY,
  };
}

const FACE_W = TILE_W - BEVEL;       // 54
const FACE_H = TILE_H - BEVEL;       // 74
const FACE_PAD_X = 4;                // inner padding within the face
const FACE_PAD_Y = 4;
const FACE_INNER_W = FACE_W - FACE_PAD_X * 2;  // 46
const FACE_INNER_H = FACE_H - FACE_PAD_Y * 2;  // 66

// ─── custom svg face renderers ───────────────────────────────────────────────
//
// the symbols are defined once inside the board <svg>'s <defs> and referenced
// per tile with <use>. each symbol's coordinate system is FACE_INNER_W ×
// FACE_INNER_H so tile rendering can place them at (FACE_PAD_X, FACE_PAD_Y).

const CJK_FONT = "'Hiragino Mincho Pro', 'Yu Mincho', 'Songti SC', 'STSong', 'Noto Serif CJK SC', 'Noto Serif CJK', serif";

// arrangements of n pip positions inside the FACE_INNER box, used by both the
// bamboo and circle suits. coords centre on the top-left of FACE_INNER.
const ARRANGEMENTS: Record<number, Array<[number, number]>> = {
  1: [[23, 33]],
  2: [[23, 18], [23, 48]],
  3: [[23, 12], [23, 33], [23, 54]],
  4: [[10, 18], [36, 18], [10, 48], [36, 48]],
  5: [[10, 18], [36, 18], [23, 33], [10, 48], [36, 48]],
  6: [[10, 14], [36, 14], [10, 33], [36, 33], [10, 52], [36, 52]],
  7: [[23, 10], [10, 26], [36, 26], [10, 41], [36, 41], [10, 56], [36, 56]],
  8: [[10, 12], [36, 12], [10, 28], [36, 28], [10, 44], [36, 44], [10, 60], [36, 60]],
  9: [[10, 12], [23, 12], [36, 12], [10, 33], [23, 33], [36, 33], [10, 54], [23, 54], [36, 54]],
};

function BambooStalk() {
  // single bamboo joint — small green pillar with two darker rings.
  return (
    <g>
      <rect x={-2.5} y={-7} width={5} height={14} rx={1.2} fill="#3a8a3e" />
      <line x1={-3.5} y1={-3} x2={3.5} y2={-3} stroke="#1b4d20" strokeWidth={1} />
      <line x1={-3.5} y1={3} x2={3.5} y2={3} stroke="#1b4d20" strokeWidth={1} />
      <line x1={0} y1={-7} x2={0} y2={7} stroke="#1b4d20" strokeWidth={0.6} opacity={0.4} />
    </g>
  );
}

function FaceBamboo({ n }: { n: number }) {
  // "1 bamboo" is traditionally a sparrow — render a tiny stylised bird so
  // it doesn't look like the same single stalk you'd otherwise get.
  if (n === 1) {
    return (
      <g>
        <ellipse cx={23} cy={36} rx={11} ry={7} fill="#c33" />
        <ellipse cx={23} cy={32} rx={6} ry={5} fill="#c33" />
        <circle cx={28} cy={31} r={1.2} fill="#fff" />
        <circle cx={28} cy={31} r={0.5} fill="#000" />
        <path d="M 28 33 L 33 31 L 28 34 Z" fill="#e88" />
        <path d="M 18 38 L 13 44 L 17 41 Z" fill="#1b4d20" />
        <path d="M 22 42 L 22 48 M 24 42 L 24 48" stroke="#3a8a3e" strokeWidth={1.2} />
      </g>
    );
  }
  return (
    <g>
      {ARRANGEMENTS[n].map(([x, y], i) => (
        <g key={i} transform={`translate(${x}, ${y})`}>
          <BambooStalk />
        </g>
      ))}
    </g>
  );
}

function CircleDot({ n }: { n: number }) {
  // ring + inner dot; colour cycles per traditional dot-suit colouring so a
  // 5-of-circles doesn't look identical to a 3-of-circles next to it.
  const palette = ['#0a4a80', '#c33', '#0a4a80', '#0a8a3e', '#c33'];
  const fill = palette[n % palette.length];
  return (
    <g>
      <circle r={6} fill="#fff" stroke={fill} strokeWidth={1.7} />
      <circle r={2} fill={fill} />
    </g>
  );
}

function FaceCircle({ n }: { n: number }) {
  return (
    <g>
      {ARRANGEMENTS[n].map(([x, y], i) => (
        <g key={i} transform={`translate(${x}, ${y})`}>
          <CircleDot n={n} />
        </g>
      ))}
    </g>
  );
}

const NUMERAL = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

function FaceCharacter({ n }: { n: number }) {
  return (
    <g>
      <text
        x={23}
        y={26}
        textAnchor="middle"
        fontFamily={CJK_FONT}
        fontSize={22}
        fontWeight={600}
        fill="#1b1b1b"
      >
        {NUMERAL[n - 1]}
      </text>
      <text
        x={23}
        y={58}
        textAnchor="middle"
        fontFamily={CJK_FONT}
        fontSize={26}
        fontWeight={700}
        fill="#bf2a2a"
      >
        萬
      </text>
    </g>
  );
}

const WIND_GLYPH: Record<Wind, string> = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
};

function FaceWind({ dir }: { dir: Wind }) {
  return (
    <g>
      <text
        x={23}
        y={48}
        textAnchor="middle"
        fontFamily={CJK_FONT}
        fontSize={42}
        fontWeight={700}
        fill="#1b1b1b"
      >
        {WIND_GLYPH[dir]}
      </text>
    </g>
  );
}

function FaceDragon({ color }: { color: Dragon }) {
  if (color === 'white') {
    // traditional white dragon — blue rectangular frame, no glyph
    return (
      <g>
        <rect x={6} y={9} width={34} height={48} fill="none" stroke="#0a4a80" strokeWidth={2} rx={2} />
        <rect x={9} y={12} width={28} height={42} fill="none" stroke="#0a4a80" strokeWidth={1} rx={1.5} />
      </g>
    );
  }
  const fill = color === 'red' ? '#bf2a2a' : '#0a8a3e';
  const glyph = color === 'red' ? '中' : '發';
  return (
    <g>
      <rect x={4} y={6} width={38} height={54} fill="none" stroke={fill} strokeWidth={1.4} rx={2} />
      <text
        x={23}
        y={46}
        textAnchor="middle"
        fontFamily={CJK_FONT}
        fontSize={36}
        fontWeight={700}
        fill={fill}
      >
        {glyph}
      </text>
    </g>
  );
}

const SEASON_GLYPH = ['春', '夏', '秋', '冬'];

function FaceSeason({ n }: { n: number }) {
  return (
    <g>
      <circle cx={23} cy={20} r={5} fill="#0a8a3e" opacity={0.25} />
      <text
        x={23}
        y={50}
        textAnchor="middle"
        fontFamily={CJK_FONT}
        fontSize={28}
        fontWeight={700}
        fill="#0a8a3e"
      >
        {SEASON_GLYPH[n - 1]}
      </text>
      <text
        x={23}
        y={62}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={8}
        fill="#0a8a3e"
        opacity={0.7}
      >
        {n}
      </text>
    </g>
  );
}

const FLOWER_GLYPH = ['梅', '蘭', '菊', '竹']; // plum, orchid, chrysanthemum, bamboo

function FaceFlower({ n }: { n: number }) {
  return (
    <g>
      {/* a tiny petal cluster as a marker */}
      <g transform="translate(23, 18)">
        <circle r={3} fill="#bf2a2a" opacity={0.7} />
        <circle cx={-3} cy={2} r={2.4} fill="#e88" />
        <circle cx={3} cy={2} r={2.4} fill="#e88" />
        <circle cx={-2} cy={-2} r={2.2} fill="#e88" />
        <circle cx={2} cy={-2} r={2.2} fill="#e88" />
      </g>
      <text
        x={23}
        y={50}
        textAnchor="middle"
        fontFamily={CJK_FONT}
        fontSize={28}
        fontWeight={700}
        fill="#0a4a80"
      >
        {FLOWER_GLYPH[n - 1]}
      </text>
      <text
        x={23}
        y={62}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={8}
        fill="#0a4a80"
        opacity={0.7}
      >
        {n}
      </text>
    </g>
  );
}

function FaceContent({ face }: { face: Face }) {
  if (face.kind === 'suit') {
    if (face.suit === 'bamboo') return <FaceBamboo n={face.n} />;
    if (face.suit === 'circle') return <FaceCircle n={face.n} />;
    return <FaceCharacter n={face.n} />;
  }
  if (face.kind === 'wind') return <FaceWind dir={face.dir} />;
  if (face.kind === 'dragon') return <FaceDragon color={face.color} />;
  if (face.kind === 'season') return <FaceSeason n={face.n} />;
  return <FaceFlower n={face.n} />;
}

// generate every distinct (kind+modifier) once for the symbol library.
function allFaceVariants(): Face[] {
  const out: Face[] = [];
  for (const suit of ['bamboo', 'circle', 'character'] as Suit[]) {
    for (let n = 1; n <= 9; n++) out.push({ kind: 'suit', suit, n });
  }
  for (const dir of ['east', 'south', 'west', 'north'] as Wind[]) {
    out.push({ kind: 'wind', dir });
  }
  for (const color of ['red', 'green', 'white'] as Dragon[]) {
    out.push({ kind: 'dragon', color });
  }
  for (let n = 1; n <= 4; n++) out.push({ kind: 'season', n });
  for (let n = 1; n <= 4; n++) out.push({ kind: 'flower', n });
  return out;
}

function FaceSymbols() {
  return (
    <Fragment>
      {allFaceVariants().map((f) => (
        <symbol
          key={faceSymbolId(f)}
          id={faceSymbolId(f)}
          viewBox={`0 0 ${FACE_INNER_W} ${FACE_INNER_H}`}
          width={FACE_INNER_W}
          height={FACE_INNER_H}
        >
          <FaceContent face={f} />
        </symbol>
      ))}
    </Fragment>
  );
}

// ─── tile body ───────────────────────────────────────────────────────────────

function TileBody({
  highlight,
  free,
  faded,
}: {
  highlight: 'none' | 'selected' | 'hint';
  free: boolean;
  faded: boolean;
}) {
  // bottom + right beveled edges fake the tile's depth. stroke colour
  // changes for the selected / hint states so the tile glows.
  const strokeColour =
    highlight === 'selected'
      ? '#6aeaa0'
      : highlight === 'hint'
        ? '#ffd166'
        : '#3a3a30';
  const strokeW = highlight === 'none' ? 0.8 : 2;
  const topFill = faded ? '#cfc7ad' : '#f5efd7';
  return (
    <g>
      {/* bottom shoulder (lighter) */}
      <polygon
        points={`0,${FACE_H} ${BEVEL},${TILE_H} ${TILE_W},${TILE_H} ${FACE_W},${FACE_H}`}
        fill="#dcd2b1"
        stroke="#3a3a30"
        strokeWidth={0.6}
      />
      {/* right shoulder (darker) */}
      <polygon
        points={`${FACE_W},0 ${TILE_W},${BEVEL} ${TILE_W},${TILE_H} ${FACE_W},${FACE_H}`}
        fill="#b9ad88"
        stroke="#3a3a30"
        strokeWidth={0.6}
      />
      {/* top face */}
      <rect
        x={0}
        y={0}
        width={FACE_W}
        height={FACE_H}
        rx={3}
        ry={3}
        fill={topFill}
        stroke={strokeColour}
        strokeWidth={strokeW}
      />
      {/* a thin inner border line for the etched look */}
      <rect
        x={2}
        y={2}
        width={FACE_W - 4}
        height={FACE_H - 4}
        rx={2}
        ry={2}
        fill="none"
        stroke="#a39a78"
        strokeWidth={0.5}
        opacity={0.6}
      />
      {!free ? (
        // subtle gray wash on blocked tiles so eyes can scan for free ones.
        <rect x={0} y={0} width={FACE_W} height={FACE_H} rx={3} ry={3} fill="#000" opacity={0.08} />
      ) : null}
    </g>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lab:mahjong:state';

type Persisted = {
  seed: number;
  removed: number[]; // slot ids
  startedAt: number;
  baseElapsed: number;
  // shuffle is one-per-deal — saving the resulting face map means a reload
  // can't be used to roll a different shuffle, and the board looks the
  // same after refresh as before.
  shuffle?: { faces: Array<[number, Face]> };
};

function loadPersisted(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (typeof parsed.seed === 'number' && Array.isArray(parsed.removed)) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

function savePersisted(p: Persisted) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MahjongPage() {
  const search = useSearch({ from: '/_main/labs/mahjong' });
  const navigate = useNavigate();

  // initial seed: prefer the URL → localStorage → fresh pyramid seed.
  // captured once via useRef so the first render is stable; the URL
  // gets backfilled on mount via the effect below.
  const initialSeedRef = useRef<number | null>(null);
  if (initialSeedRef.current === null) {
    if (typeof search.seed === 'number') {
      initialSeedRef.current = search.seed;
    } else {
      const persisted = loadPersisted();
      initialSeedRef.current = persisted?.seed ?? freshSeed('pyramid');
    }
  }
  const seed: number = typeof search.seed === 'number' ? search.seed : initialSeedRef.current;
  const layoutId = decodeSeed(seed);
  const gameId: GameId = `mahjong-${layoutId}`;

  // generated deal is a pure function of the seed.
  const { slots, faces: originalFaces } = useMemo(() => generateDeal(seed), [seed]);

  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
  // when the player uses their one shuffle, this overrides the original
  // face map until the seed changes. null = shuffle still available.
  const [shuffleFaces, setShuffleFaces] = useState<Map<number, Face> | null>(null);
  const faces = shuffleFaces ?? originalFaces;
  const [selected, setSelected] = useState<number | null>(null);
  const [hintPair, setHintPair] = useState<[number, number] | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [baseElapsed, setBaseElapsed] = useState(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [winElapsed, setWinElapsed] = useState<number | null>(null);
  const [publishState, setPublishState] = useState<'idle' | 'signing' | 'publishing' | 'published' | 'error'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState('');
  const [seedInput, setSeedInput] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const { session } = useAtprotoSession();
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  const queryClient = useQueryClient();
  const { data: leaderboardRows } = useQuery({
    queryKey: ['leaderboard', gameId],
    queryFn: () => getLeaderboard({ data: { game: gameId } }),
  });
  const canPublishScore = sessionHasScope(session, LEADERBOARD_WRITE_SCOPE);

  // backfill the url on mount so the page always has a stable, copyable
  // ?seed=… link, even if the user landed without one.
  useEffect(() => {
    if (search.seed !== seed) {
      navigate({ to: '/labs/mahjong', search: { seed }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when the seed changes (new deal, layout switch, paste), reset the
  // ephemeral game state — but on the very first mount, prefer to restore
  // any persisted progress saved against this exact seed.
  const isFirstSeedRef = useRef(true);
  useEffect(() => {
    if (isFirstSeedRef.current) {
      isFirstSeedRef.current = false;
      const p = loadPersisted();
      if (p && p.seed === seed) {
        setRemoved(new Set(p.removed));
        setBaseElapsed(p.baseElapsed);
        setStartedAt(Date.now());
        if (p.shuffle) setShuffleFaces(new Map(p.shuffle.faces));
        return;
      }
    }
    setRemoved(new Set());
    setSelected(null);
    setHintPair(null);
    setStartedAt(Date.now());
    setBaseElapsed(0);
    setWinElapsed(null);
    setPublishState('idle');
    setPublishError(null);
    setSeedInput('');
    setShuffleFaces(null);
  }, [seed]);

  // present = slots still on the board, used by isFree.
  const present = useMemo(() => {
    const m = new Map<number, Slot>();
    for (const s of slots) if (!removed.has(s.id)) m.set(s.id, s);
    return m;
  }, [slots, removed]);

  // every tile gets its current free-state precomputed once per render — this
  // is what determines whether it is clickable and how it is styled.
  const freeMap = useMemo(() => {
    const out = new Map<number, boolean>();
    for (const s of present.values()) out.set(s.id, isFree(s, present));
    return out;
  }, [present]);

  // any matching pair currently available among free tiles?
  const availableMatches = useMemo(() => {
    const free: Slot[] = [];
    for (const s of present.values()) if (freeMap.get(s.id)) free.push(s);
    let count = 0;
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const fa = faces.get(free[i].id);
        const fb = faces.get(free[j].id);
        if (fa && fb && facesMatch(fa, fb)) count++;
      }
    }
    return count;
  }, [present, freeMap, faces]);

  const won = present.size === 0;
  const stuck = !won && availableMatches === 0;

  // tick the clock while the game is active.
  useEffect(() => {
    if (won || stuck) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [won, stuck]);

  // capture the elapsed seconds at the exact moment the board was cleared,
  // so the published score doesn't drift past it.
  useEffect(() => {
    if (won && winElapsed === null) {
      setWinElapsed(baseElapsed + (Date.now() - startedAt) / 1000);
    }
  }, [won, winElapsed, baseElapsed, startedAt]);

  const elapsed = won && winElapsed !== null ? winElapsed : baseElapsed + (now - startedAt) / 1000;

  // persist on every change.
  useEffect(() => {
    savePersisted({
      seed,
      removed: Array.from(removed),
      startedAt,
      baseElapsed,
      shuffle: shuffleFaces ? { faces: Array.from(shuffleFaces.entries()) } : undefined,
    });
  }, [seed, removed, startedAt, baseElapsed, shuffleFaces]);

  // a "new deal" stays in the same layout but rolls a new rng. layout
  // changes go through pickLayout instead so the user picks the shape.
  const newGame = useCallback(() => {
    const next = freshSeed(layoutId);
    navigate({ to: '/labs/mahjong', search: { seed: next }, replace: true });
  }, [navigate, layoutId]);

  const pickLayout = useCallback(
    (id: LayoutId) => {
      if (id === layoutId) return;
      const next = freshSeed(id);
      navigate({ to: '/labs/mahjong', search: { seed: next }, replace: true });
    },
    [navigate, layoutId],
  );

  // load a specific seed pasted by the user — could come from a friend's
  // share link. clamp to a uint32 and replace the url; the seed-change
  // effect above takes care of the rest.
  const loadSeed = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const n = Number(trimmed);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 0xffffffff) return;
      navigate({ to: '/labs/mahjong', search: { seed: n >>> 0 }, replace: true });
    },
    [navigate],
  );

  const restart = useCallback(() => {
    setRemoved(new Set());
    setSelected(null);
    setHintPair(null);
    setStartedAt(Date.now());
    setBaseElapsed(0);
    setWinElapsed(null);
    setPublishState('idle');
    setPublishError(null);
    // restart returns the deal to its original face arrangement, which
    // also restores the shuffle credit — restart is a fresh attempt.
    setShuffleFaces(null);
  }, []);

  const shuffleAvailable = shuffleFaces === null;
  const onShuffle = useCallback(() => {
    if (!shuffleAvailable) return;
    if (won) return;
    const remainingIds = new Set<number>();
    for (const s of slots) if (!removed.has(s.id)) remainingIds.add(s.id);
    if (remainingIds.size < 2) return;
    // a wall-clock-derived rng so the shuffle is genuinely random; the
    // outcome is then persisted, so reload can't roll it again.
    const rng = rngFromSeed((((Math.random() * 0xffffffff) >>> 0) ^ Date.now()) >>> 0);
    const result = shuffleRemaining(slots, faces, remainingIds, rng);
    if (!result) return;
    setShuffleFaces(result);
    setSelected(null);
    setHintPair(null);
  }, [shuffleAvailable, won, slots, removed, faces]);

  const copyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/labs/mahjong?seed=${seed}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      /* clipboard unavailable — silent */
    }
  }, [seed]);

  async function startSignIn(handle: string) {
    setPublishError(null);
    try {
      ensureOAuthConfigured();
      const url = await createAuthorizationUrl({
        target: { type: 'account', identifier: handle.trim() as ActorIdentifier },
        scope: LEADERBOARD_SCOPE,
        state: { returnTo: window.location.pathname },
      });
      window.location.assign(url.toString());
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
    }
  }

  async function publish() {
    if (!session || winElapsed === null) return;
    if (publishState === 'signing' || publishState === 'publishing') return;
    setPublishError(null);
    setPublishState('signing');
    try {
      const did = session.info.sub;
      const score = Math.round(winElapsed);
      const signed = await signScore({ data: { game: gameId, score, did } });
      setPublishState('publishing');
      const agent = new OAuthUserAgent(session);
      const xrpc = new XRPC({ handler: agent });
      await xrpc.call('com.atproto.repo.createRecord', {
        data: {
          repo: did,
          collection: LEADERBOARD_SCORE_COLLECTION,
          record: {
            $type: LEADERBOARD_SCORE_COLLECTION,
            game: signed.game,
            score: signed.score,
            subject: LEADERBOARD_MARKER_URI,
            did: signed.did,
            achievedAt: signed.achievedAt,
            sig: signed.sig,
          },
        },
      });
      setPublishState('published');
      window.setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ['leaderboard', gameId] }),
        2000,
      );
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
      setPublishState('error');
    }
  }

  const findHint = useCallback(() => {
    const free: Slot[] = [];
    for (const s of present.values()) if (freeMap.get(s.id)) free.push(s);
    for (let i = 0; i < free.length; i++) {
      for (let j = i + 1; j < free.length; j++) {
        const fa = faces.get(free[i].id);
        const fb = faces.get(free[j].id);
        if (fa && fb && facesMatch(fa, fb)) {
          setHintPair([free[i].id, free[j].id]);
          window.setTimeout(() => setHintPair(null), 1500);
          return;
        }
      }
    }
  }, [present, freeMap, faces]);

  const onTileClick = useCallback(
    (id: number) => {
      if (won || stuck) return;
      if (!freeMap.get(id)) return;
      setHintPair(null);
      if (selected === null) {
        setSelected(id);
        return;
      }
      if (selected === id) {
        setSelected(null);
        return;
      }
      const fa = faces.get(selected);
      const fb = faces.get(id);
      if (fa && fb && facesMatch(fa, fb)) {
        setRemoved((prev) => {
          const next = new Set(prev);
          next.add(selected);
          next.add(id);
          return next;
        });
        setSelected(null);
      } else {
        setSelected(id);
      }
    },
    [won, stuck, freeMap, selected, faces],
  );

  // viewBox covers the whole shape plus a little margin. width/height
  // come from the layout's actual extent, and we leave room for the
  // upper layers' up-and-left shift so they don't clip on shapes with
  // many layers (eg. tower).
  const { boardW, boardH, layerShiftX, layerShiftY } = useMemo(() => {
    let maxCol = 0;
    let maxRow = 0;
    let maxLayer = 0;
    for (const s of slots) {
      if (s.col > maxCol) maxCol = s.col;
      if (s.row > maxRow) maxRow = s.row;
      if (s.layer > maxLayer) maxLayer = s.layer;
    }
    return {
      boardW: (maxCol + 1) * TILE_W + BEVEL,
      boardH: (maxRow + 1) * TILE_H + BEVEL,
      layerShiftX: maxLayer * LAYER_DX,
      layerShiftY: maxLayer * LAYER_DY,
    };
  }, [slots]);
  const margin = 24;
  const viewBox = `${-layerShiftX - margin} ${-layerShiftY - margin} ${boardW + 2 * margin + layerShiftX} ${boardH + 2 * margin + layerShiftY}`;

  const sortedSlots = useMemo(() => {
    // render order: lower layers first; within a layer, top-to-bottom then
    // left-to-right so each tile correctly overlaps the bevel of its
    // neighbour above-and-to-the-left.
    return slots.slice().sort((a, b) => {
      if (a.layer !== b.layer) return a.layer - b.layer;
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
  }, [slots]);

  const matchesMade = (slots.length - present.size) / 2;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-mahjong">
        <header className="page-hd">
          <div className="label">~/labs/mahjong</div>
          <h1>mahjong<span className="dot">.</span></h1>
          <p className="sub">
            mahjong solitaire — 144 hand-rendered svg tiles, three custom shapes.
            click two free tiles whose faces match to remove them. every deal is
            generated with a guaranteed solve sequence; you can still lose by making
            the wrong matches first. share the seed to challenge a friend on the
            exact same deal.
          </p>
          <div className="meta">
            <span>layout <b className="t-accent">{LAYOUTS[layoutId].label}</b></span>
            <span>tiles <b>{present.size}/144</b></span>
            <span>matches <b className="t-accent">{matchesMade}/72</b></span>
            <span>available <b className={availableMatches === 0 ? 't-alert' : 't-accent'}>{availableMatches}</b></span>
            <span>time <b>{formatTime(elapsed)}</b></span>
            <span>status <b className={won ? 't-accent' : stuck ? 't-alert' : ''}>
              {won ? 'solved' : stuck ? 'stuck' : 'in progress'}
            </b></span>
          </div>
        </header>

        <section className="controls">
          <div className="layout-row">
            {LAYOUT_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                className={`diff-btn${id === layoutId ? ' on' : ''}`}
                onClick={() => pickLayout(id)}
                title={LAYOUTS[id].blurb}
              >
                {LAYOUTS[id].label}
              </button>
            ))}
          </div>
          <div className="action-row">
            <button type="button" className="ghost-btn" onClick={newGame}>new deal</button>
            <button type="button" className="ghost-btn" onClick={restart}>restart this deal</button>
            <button
              type="button"
              className="ghost-btn"
              onClick={findHint}
              disabled={won || stuck}
            >
              hint
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={onShuffle}
              disabled={won || !shuffleAvailable || present.size < 2}
              title={shuffleAvailable
                ? 'shuffle the remaining tile faces (one per deal)'
                : 'shuffle already used — restart or start a new deal'}
            >
              {shuffleAvailable ? 'shuffle' : 'shuffle ✓'}
            </button>
          </div>
        </section>

        <section className="seed-row">
          <span className="seed-label">seed</span>
          <code className="seed-value">{seed}</code>
          <button type="button" className="ghost-btn seed-copy" onClick={() => void copyShareLink()}>
            {copyState === 'copied' ? '✓ copied' : 'copy share link'}
          </button>
          <form
            className="seed-form"
            onSubmit={(e) => {
              e.preventDefault();
              loadSeed(seedInput);
            }}
          >
            <input
              className="seed-input"
              placeholder="paste a friend's seed…"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              spellCheck={false}
              inputMode="numeric"
            />
            <button type="submit" className="ghost-btn" disabled={!seedInput.trim()}>
              load
            </button>
          </form>
        </section>

        <section className="stage-wrap">
          <svg className="board" viewBox={viewBox} role="img" aria-label="mahjong solitaire board">
            <defs>
              <FaceSymbols />
            </defs>
            {sortedSlots.map((slot) => {
              if (removed.has(slot.id)) return null;
              const face = faces.get(slot.id);
              if (!face) return null;
              const { x, y } = tileXY(slot);
              const free = !!freeMap.get(slot.id);
              const isSelected = selected === slot.id;
              const isHint = hintPair !== null && (hintPair[0] === slot.id || hintPair[1] === slot.id);
              const highlight: 'none' | 'selected' | 'hint' = isSelected ? 'selected' : isHint ? 'hint' : 'none';
              return (
                <g
                  key={slot.id}
                  transform={`translate(${x}, ${y})`}
                  className={`tile ${free ? 'free' : 'blocked'}${isSelected ? ' is-selected' : ''}${isHint ? ' is-hint' : ''}`}
                  onClick={() => onTileClick(slot.id)}
                >
                  <TileBody highlight={highlight} free={free} faded={!free} />
                  <use
                    href={`#${faceSymbolId(face)}`}
                    x={FACE_PAD_X}
                    y={FACE_PAD_Y}
                    width={FACE_INNER_W}
                    height={FACE_INNER_H}
                  />
                </g>
              );
            })}
          </svg>

          {won ? (
            <div className="overlay">
              <div className="ov-title">solved.</div>
              <div className="ov-score">
                <span className="ov-score-val">{formatTime(elapsed)}</span>
                <span className="ov-score-lbl">all 72 pairs</span>
              </div>

              {session && canPublishScore ? (
                publishState === 'published' ? (
                  <div className="ov-sub">
                    ✓ published as <b className="t-accent">@{profile?.handle ?? session.info.sub}</b>
                  </div>
                ) : (
                  <button
                    className="ov-btn"
                    type="button"
                    onClick={() => void publish()}
                    disabled={publishState === 'signing' || publishState === 'publishing'}
                  >
                    {publishState === 'signing'
                      ? 'signing…'
                      : publishState === 'publishing'
                        ? 'publishing…'
                        : 'publish to leaderboard'}
                  </button>
                )
              ) : session ? (
                <div className="ov-sub t-faint">
                  signed in, but session is missing leaderboard scope. sign in again below to publish.
                </div>
              ) : (
                <form
                  className="lock-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (handleInput.trim()) void startSignIn(handleInput);
                  }}
                >
                  <input
                    className="lock-input"
                    placeholder="your.handle.bsky.social"
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    autoComplete="username"
                    spellCheck={false}
                  />
                  <button className="ov-btn" type="submit" disabled={!handleInput.trim()}>
                    sign in to publish
                  </button>
                </form>
              )}
              {publishError ? <div className="ov-err">{publishError}</div> : null}

              <button className="ov-btn-ghost" type="button" onClick={newGame}>new deal</button>
            </div>
          ) : stuck ? (
            <div className="overlay">
              <div className="ov-title">no moves.</div>
              <div className="ov-sub">
                no remaining free tiles match. you got <b className="t-accent">{matchesMade}</b> pairs in.
                {shuffleAvailable
                  ? ' shuffle to re-pair the remaining tiles for one more attempt.'
                  : ' shuffle already used.'}
              </div>
              <div className="ov-row">
                {shuffleAvailable ? (
                  <button className="ov-btn" type="button" onClick={onShuffle}>shuffle</button>
                ) : null}
                <button
                  className={shuffleAvailable ? 'ov-btn-ghost' : 'ov-btn'}
                  type="button"
                  onClick={restart}
                >
                  restart this deal
                </button>
                <button className="ov-btn-ghost" type="button" onClick={newGame}>new deal</button>
              </div>
            </div>
          ) : null}
        </section>

        <Leaderboard
          rows={leaderboardRows ?? null}
          myDid={session?.info.sub ?? null}
          layoutId={layoutId}
        />

        <footer className="mahjong-footer">
          <span>src: <span className="t-accent">hand-written · ~600 lines</span></span>
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
  .shell-mahjong { max-width: 900px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd { padding: 64px 0 var(--sp-6); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); margin-bottom: 8px; }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500; letter-spacing: -0.03em; line-height: 0.9;
    color: var(--color-fg);
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); max-width: 64ch; margin-top: var(--sp-3); line-height: 1.55; }
  .page-hd .meta {
    display: flex; gap: var(--sp-6); flex-wrap: wrap;
    margin-top: var(--sp-5);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-fg); font-weight: 400; }
  .page-hd .meta b.t-accent { color: var(--color-accent); }
  .page-hd .meta b.t-alert { color: var(--color-alert); }

  .controls {
    display: flex; flex-wrap: wrap; gap: var(--sp-3);
    margin-top: var(--sp-5);
    align-items: center; justify-content: space-between;
  }
  .layout-row, .action-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .ghost-btn, .diff-btn {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .ghost-btn:hover:not(:disabled), .diff-btn:hover {
    color: var(--color-fg);
    border-color: var(--color-accent-dim);
  }
  .ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .diff-btn.on {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 10%, transparent);
  }

  .seed-row {
    display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3);
    margin-top: var(--sp-3);
    padding: var(--sp-3) var(--sp-4);
    border: 1px dashed var(--color-border);
    background: var(--color-bg-panel);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .seed-label { text-transform: uppercase; letter-spacing: 0.12em; }
  .seed-value {
    color: var(--color-accent);
    font-size: var(--fs-sm);
    user-select: all;
    -webkit-user-select: all;
    word-break: break-all;
  }
  .seed-copy { white-space: nowrap; }
  .seed-form { display: flex; gap: 6px; flex: 1 1 220px; min-width: 200px; }
  .seed-input {
    flex: 1;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    padding: 6px 10px;
  }
  .seed-input:focus { outline: none; border-color: var(--color-accent); }

  .stage-wrap {
    position: relative;
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    overflow: hidden;
  }
  .board {
    display: block;
    width: 100%;
    height: auto;
  }
  .tile { cursor: default; }
  .tile.free { cursor: pointer; }
  .tile.free:hover rect:first-of-type ~ rect[width="${FACE_W}"] { /* no-op */ }
  .tile.is-selected { filter: drop-shadow(0 0 6px color-mix(in oklch, var(--color-accent) 60%, transparent)); }
  .tile.is-hint { filter: drop-shadow(0 0 6px color-mix(in oklch, oklch(0.85 0.16 90) 70%, transparent)); }

  .overlay {
    position: absolute; inset: 0;
    background: color-mix(in oklch, var(--color-bg) 80%, transparent);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-3);
    font-family: var(--font-mono);
  }
  .ov-title {
    font-family: var(--font-display);
    font-size: clamp(32px, 6vw, 56px);
    color: var(--color-accent);
    text-shadow: 0 0 16px var(--accent-glow);
  }
  .ov-sub {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    max-width: 48ch; text-align: center; line-height: 1.55;
  }
  .ov-sub b.t-accent { color: var(--color-accent); }
  .ov-score { display: flex; align-items: baseline; gap: 6px; }
  .ov-score-val {
    font-family: var(--font-display);
    font-size: clamp(40px, 7vw, 64px);
    color: var(--color-accent);
    text-shadow: 0 0 14px var(--accent-glow);
  }
  .ov-score-lbl { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
  .ov-row { display: flex; gap: var(--sp-3); flex-wrap: wrap; justify-content: center; }
  .ov-btn {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 8px 20px;
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    color: var(--color-bg);
    box-shadow: 0 0 12px var(--accent-glow);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .ov-btn:hover { background: color-mix(in oklch, var(--color-accent) 85%, white); }
  .ov-btn-ghost {
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 8px 20px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .ov-btn-ghost:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }

  .lock-form {
    display: flex; gap: 6px;
    width: 100%; max-width: 360px;
  }
  .lock-input {
    flex: 1;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 10px;
  }
  .lock-input:focus { outline: none; border-color: var(--color-accent); }
  .ov-sub.t-faint { color: var(--color-fg-faint); }
  .ov-err {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-alert);
    max-width: 48ch; text-align: center;
  }

  .lb {
    margin-top: var(--sp-6);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
  }
  .lb-head {
    display: flex; justify-content: space-between; align-items: baseline;
    padding: var(--sp-3) var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    font-family: var(--font-mono); font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase; letter-spacing: 0.12em;
  }
  .lb-head .t-accent { color: var(--color-accent); }
  .lb-empty { padding: var(--sp-5) var(--sp-4); color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); text-align: center; }
  .lb-row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: var(--sp-3);
    padding: 8px var(--sp-4);
    border-bottom: 1px dashed var(--color-border);
    align-items: center;
    font-family: var(--font-mono); font-size: var(--fs-sm);
  }
  .lb-row:last-child { border-bottom: 0; }
  .lb-row.me { background: color-mix(in oklch, var(--color-accent) 8%, transparent); }
  .lb-who-link, .lb-record-link {
    display: flex; align-items: center; gap: var(--sp-2);
    color: inherit; text-decoration: none;
    min-width: 0;
  }
  .lb-who-link:hover .lb-name { color: var(--color-accent); }
  .lb-record-link { gap: var(--sp-3); }
  .lb-record-link:hover .lb-score { color: color-mix(in oklch, var(--color-accent) 85%, white); text-shadow: 0 0 8px var(--accent-glow); }
  .lb-record-link:hover .lb-when { color: var(--color-fg-dim); }
  .lb-rank { color: var(--color-fg-faint); font-size: var(--fs-xs); }
  .lb-rank.top1 { color: var(--color-accent); }
  .lb-avatar {
    width: 24px; height: 24px;
    border-radius: 50%;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    object-fit: cover;
    display: block;
  }
  .lb-who { min-width: 0; display: flex; flex-direction: column; }
  .lb-name { color: var(--color-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lb-handle { color: var(--color-fg-faint); font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lb-score { color: var(--color-accent); font-weight: 500; }
  .lb-when { color: var(--color-fg-faint); font-size: 10px; }

  .mahjong-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
`;

// ─── leaderboard panel ──────────────────────────────────────────────────────

function Leaderboard({
  rows,
  myDid,
  layoutId,
}: {
  rows: LeaderboardRow[] | null;
  myDid: string | null;
  layoutId: LayoutId;
}) {
  return (
    <div className="lb">
      <div className="lb-head">
        <span className="t-accent">./leaderboard --mahjong-{layoutId}</span>
        <span>constellation · sig-verified</span>
      </div>
      {rows === null ? (
        <div className="lb-empty">loading scores…</div>
      ) : rows.length === 0 ? (
        <div className="lb-empty">no scores yet. be the first.</div>
      ) : (
        rows.map((r, i) => (
          <div key={r.uri} className={`lb-row${r.did === myDid ? ' me' : ''}`}>
            <span className={`lb-rank ${i === 0 ? 'top1' : ''}`}>#{i + 1}</span>
            <a
              className="lb-who-link"
              href={`https://bsky.app/profile/${r.handle}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {r.avatar ? (
                <img src={r.avatar} alt="" className="lb-avatar" loading="lazy" />
              ) : (
                <span className="lb-avatar" />
              )}
              <span className="lb-who">
                <span className="lb-name">{r.displayName}</span>
                <span className="lb-handle">@{r.handle}</span>
              </span>
            </a>
            <Link
              className="lb-record-link"
              to={`/labs/at-uri/${r.uri.replace('at://', '')}` as never}
            >
              <span className="lb-score">{formatTime(r.score)}</span>
              <span className="lb-when">{relative(r.achievedAt)}</span>
            </Link>
          </div>
        ))
      )}
    </div>
  );
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return iso.slice(0, 10);
}

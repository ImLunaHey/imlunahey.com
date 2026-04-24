import { Link } from '@tanstack/react-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

// stepped-pyramid layout that totals exactly 144:
//   L0: 12 × 7 = 84
//   L1:  8 × 5 = 40   (centred, cols 2-9, rows 1-5)
//   L2:  4 × 3 = 12   (cols 4-7, rows 2-4)
//   L3:  2 × 3 =  6   (cols 5-6, rows 2-4)
//   L4:  2 × 1 =  2   (cols 5-6, row 3)
function buildLayout(): Slot[] {
  const out: Slot[] = [];
  let id = 0;
  const ranges: Array<[number, number, number, number, number]> = [
    [0, 0, 12, 0, 7], // layer, c0, c1, r0, r1   (c1/r1 exclusive)
    [1, 2, 10, 1, 6],
    [2, 4, 8, 2, 5],
    [3, 5, 7, 2, 5],
    [4, 5, 7, 3, 4],
  ];
  for (const [layer, c0, c1, r0, r1] of ranges) {
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        out.push({ id: id++, layer, col: c, row: r });
      }
    }
  }
  return out;
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

function generateDeal(seed: number): { slots: Slot[]; faces: Map<number, Face> } {
  const slots = buildLayout();
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
    return { slots, faces };
  }
  const pairs = shuffled(buildFacePairs(rng), rng);
  const faces = new Map<number, Face>();
  for (let k = 0; k < order.length; k++) {
    const [a, b] = order[k];
    faces.set(a.id, pairs[k][0]);
    faces.set(b.id, pairs[k][1]);
  }
  return { slots, faces };
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

function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function MahjongPage() {
  const [seed, setSeed] = useState<number>(() => newSeed());
  const [{ slots, faces }, setDeal] = useState(() => generateDeal(seed));
  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [hintPair, setHintPair] = useState<[number, number] | null>(null);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [baseElapsed, setBaseElapsed] = useState(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const restoredRef = useRef(false);

  // restore once on mount.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const p = loadPersisted();
    if (p) {
      const fresh = generateDeal(p.seed);
      setSeed(p.seed);
      setDeal(fresh);
      setRemoved(new Set(p.removed));
      setBaseElapsed(p.baseElapsed);
      setStartedAt(Date.now());
    }
  }, []);

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

  const elapsed = baseElapsed + (now - startedAt) / 1000;

  // persist on every change.
  useEffect(() => {
    savePersisted({
      seed,
      removed: Array.from(removed),
      startedAt,
      baseElapsed,
    });
  }, [seed, removed, startedAt, baseElapsed]);

  const newGame = useCallback(() => {
    const s = newSeed();
    setSeed(s);
    setDeal(generateDeal(s));
    setRemoved(new Set());
    setSelected(null);
    setHintPair(null);
    setStartedAt(Date.now());
    setBaseElapsed(0);
  }, []);

  const restart = useCallback(() => {
    setRemoved(new Set());
    setSelected(null);
    setHintPair(null);
    setStartedAt(Date.now());
    setBaseElapsed(0);
  }, []);

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

  // viewBox covers the whole pyramid plus a little margin around the edge.
  const boardW = 12 * TILE_W + BEVEL;
  const boardH = 7 * TILE_H + BEVEL;
  const margin = 24;
  const viewBox = `${-LAYER_DX * 4 - margin} ${-LAYER_DY * 4 - margin} ${boardW + 2 * margin + LAYER_DX * 4} ${boardH + 2 * margin + LAYER_DY * 4}`;

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
            mahjong solitaire — 144 hand-rendered svg tiles in a five-layer pyramid.
            click two free tiles whose faces match to remove them. every deal is
            generated with a guaranteed solve sequence; you can still lose by making
            the wrong matches first.
          </p>
          <div className="meta">
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
              <button className="ov-btn" type="button" onClick={newGame}>new deal</button>
            </div>
          ) : stuck ? (
            <div className="overlay">
              <div className="ov-title">no moves.</div>
              <div className="ov-sub">
                no remaining free tiles match. you got <b className="t-accent">{matchesMade}</b> pairs in.
              </div>
              <div className="ov-row">
                <button className="ov-btn" type="button" onClick={restart}>restart this deal</button>
                <button className="ov-btn-ghost" type="button" onClick={newGame}>new deal</button>
              </div>
            </div>
          ) : null}
        </section>

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
    display: flex; flex-wrap: wrap; gap: 6px;
    margin-top: var(--sp-5);
  }
  .ghost-btn {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .ghost-btn:hover:not(:disabled) {
    color: var(--color-fg);
    border-color: var(--color-accent-dim);
  }
  .ghost-btn:disabled { opacity: 0.4; cursor: not-allowed; }

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

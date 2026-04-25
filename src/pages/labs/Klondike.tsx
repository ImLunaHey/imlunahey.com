import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type LeaderboardRow,
} from '../../server/leaderboard';

const GAME_ID = 'klondike' as const;

// ─── card model ──────────────────────────────────────────────────────────────

type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

type Card = {
  id: number; // 0..51, stable across renders
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
};

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_CHAR: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
};
const RED: Set<Suit> = new Set<Suit>(['hearts', 'diamonds']);
const isRed = (s: Suit) => RED.has(s);
const RANK_LABEL = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// traditional pip positions on the card body (normalised 0..1 across the
// inner play area). these are the layouts you see on a standard deck.
const PIPS: Record<number, Array<[number, number]>> = {
  2: [[0.5, 0.22], [0.5, 0.78]],
  3: [[0.5, 0.22], [0.5, 0.5], [0.5, 0.78]],
  4: [[0.3, 0.22], [0.7, 0.22], [0.3, 0.78], [0.7, 0.78]],
  5: [[0.3, 0.22], [0.7, 0.22], [0.5, 0.5], [0.3, 0.78], [0.7, 0.78]],
  6: [[0.3, 0.22], [0.7, 0.22], [0.3, 0.5], [0.7, 0.5], [0.3, 0.78], [0.7, 0.78]],
  7: [
    [0.3, 0.18], [0.7, 0.18], [0.5, 0.34], [0.3, 0.5], [0.7, 0.5],
    [0.3, 0.82], [0.7, 0.82],
  ],
  8: [
    [0.3, 0.18], [0.7, 0.18], [0.5, 0.34], [0.3, 0.5], [0.7, 0.5],
    [0.5, 0.66], [0.3, 0.82], [0.7, 0.82],
  ],
  9: [
    [0.3, 0.18], [0.7, 0.18], [0.3, 0.4], [0.7, 0.4], [0.5, 0.5],
    [0.3, 0.6], [0.7, 0.6], [0.3, 0.82], [0.7, 0.82],
  ],
  10: [
    [0.3, 0.18], [0.7, 0.18], [0.5, 0.28], [0.3, 0.4], [0.7, 0.4],
    [0.3, 0.6], [0.7, 0.6], [0.5, 0.72], [0.3, 0.82], [0.7, 0.82],
  ],
};

// ─── card svg ────────────────────────────────────────────────────────────────

const CARD_W = 60;
const CARD_H = 84;
// inner play area inside the card border, used for pip positioning.
const INNER = { x: 12, y: 14, w: 36, h: 56 };

function colorFor(suit: Suit): string {
  return isRed(suit) ? '#bf2a2a' : '#1a1a1a';
}

// a single suit symbol, optionally rotated (for the bottom-half pips on
// 7+ pip cards, where the lower symbols are traditionally inverted).
function SuitGlyph({
  suit,
  cx,
  cy,
  size,
  flipped,
}: {
  suit: Suit;
  cx: number;
  cy: number;
  size: number;
  flipped?: boolean;
}) {
  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fill={colorFor(suit)}
      transform={flipped ? `rotate(180 ${cx} ${cy})` : undefined}
      style={{ fontFamily: 'serif' }}
    >
      {SUIT_CHAR[suit]}
    </text>
  );
}

function PipLayout({ rank, suit }: { rank: Rank; suit: Suit }) {
  const positions = PIPS[rank];
  if (!positions) return null;
  return (
    <g>
      {positions.map(([px, py], i) => (
        <SuitGlyph
          key={i}
          suit={suit}
          cx={INNER.x + px * INNER.w}
          cy={INNER.y + py * INNER.h}
          size={11}
          flipped={py > 0.55}
        />
      ))}
    </g>
  );
}

function FaceCardArt({ rank, suit }: { rank: Rank; suit: Suit }) {
  const letter = RANK_LABEL[rank];
  const c = colorFor(suit);
  return (
    <g>
      <rect
        x={INNER.x + 2}
        y={INNER.y + 2}
        width={INNER.w - 4}
        height={INNER.h - 4}
        rx={2}
        ry={2}
        fill="none"
        stroke={c}
        strokeWidth={0.7}
      />
      <text
        x={INNER.x + INNER.w / 2}
        y={INNER.y + INNER.h / 2 - 4}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={26}
        fontWeight={700}
        fill={c}
        style={{ fontFamily: 'serif' }}
      >
        {letter}
      </text>
      <SuitGlyph
        suit={suit}
        cx={INNER.x + INNER.w / 2}
        cy={INNER.y + INNER.h / 2 + 14}
        size={12}
      />
    </g>
  );
}

function CardCorner({ rank, suit }: { rank: Rank; suit: Suit }) {
  const c = colorFor(suit);
  const label = RANK_LABEL[rank];
  return (
    <g>
      <text
        x={6}
        y={13}
        fontSize={11}
        fontWeight={700}
        fill={c}
        style={{ fontFamily: 'serif' }}
      >
        {label}
      </text>
      <SuitGlyph suit={suit} cx={6.5} cy={22} size={9} />
    </g>
  );
}

function CardSVG({ card }: { card: Card }) {
  if (!card.faceUp) return <CardBackSVG />;
  return (
    <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} className="card">
      <rect
        x={0.5}
        y={0.5}
        width={CARD_W - 1}
        height={CARD_H - 1}
        rx={4}
        ry={4}
        fill="#fbf8ec"
        stroke="#3a3a30"
        strokeWidth={0.8}
      />
      <CardCorner rank={card.rank} suit={card.suit} />
      <g transform={`translate(${CARD_W} ${CARD_H}) rotate(180)`}>
        <CardCorner rank={card.rank} suit={card.suit} />
      </g>
      {card.rank === 1 ? (
        <SuitGlyph
          suit={card.suit}
          cx={CARD_W / 2}
          cy={CARD_H / 2}
          size={28}
        />
      ) : card.rank >= 2 && card.rank <= 10 ? (
        <PipLayout rank={card.rank} suit={card.suit} />
      ) : (
        <FaceCardArt rank={card.rank} suit={card.suit} />
      )}
    </svg>
  );
}

function CardBackSVG() {
  return (
    <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} className="card card-back">
      <rect
        x={0.5}
        y={0.5}
        width={CARD_W - 1}
        height={CARD_H - 1}
        rx={4}
        ry={4}
        fill="var(--color-bg-panel)"
        stroke="#3a3a30"
        strokeWidth={0.8}
      />
      <rect
        x={4}
        y={4}
        width={CARD_W - 8}
        height={CARD_H - 8}
        rx={2}
        ry={2}
        fill="color-mix(in oklch, var(--color-accent) 14%, var(--color-bg))"
        stroke="var(--color-accent-dim)"
        strokeWidth={0.6}
      />
      {/* light diagonal hatching as a card-back motif */}
      <g stroke="var(--color-accent)" strokeWidth={0.4} opacity={0.35}>
        {Array.from({ length: 16 }, (_, i) => (
          <line
            key={i}
            x1={-CARD_H + i * 7}
            y1={CARD_H}
            x2={i * 7}
            y2={0}
          />
        ))}
      </g>
      <text
        x={CARD_W / 2}
        y={CARD_H / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={14}
        fill="var(--color-accent)"
        style={{ fontFamily: 'var(--font-display, serif)' }}
      >
        ~
      </text>
    </svg>
  );
}

function EmptyPlaceholder({ glyph }: { glyph?: string }) {
  return (
    <svg viewBox={`0 0 ${CARD_W} ${CARD_H}`} className="card card-empty">
      <rect
        x={1}
        y={1}
        width={CARD_W - 2}
        height={CARD_H - 2}
        rx={4}
        ry={4}
        fill="none"
        stroke="var(--color-border-bright)"
        strokeWidth={0.8}
        strokeDasharray="3 3"
      />
      {glyph ? (
        <text
          x={CARD_W / 2}
          y={CARD_H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={26}
          fill="var(--color-fg-faint)"
          opacity={0.5}
          style={{ fontFamily: 'serif' }}
        >
          {glyph}
        </text>
      ) : null}
    </svg>
  );
}

// ─── game state ──────────────────────────────────────────────────────────────

type Foundations = Record<Suit, Card[]>;

type GameState = {
  stock: Card[];
  waste: Card[];
  foundations: Foundations;
  tableau: Card[][]; // 7 columns, bottom-of-stack at index 0
};

type Selection =
  | { kind: 'waste' }
  | { kind: 'foundation'; suit: Suit }
  | { kind: 'tableau'; col: number; index: number };

function rngFromSeed(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function newDeck(): Card[] {
  const out: Card[] = [];
  let id = 0;
  for (const suit of SUITS) {
    for (let r = 1 as Rank; r <= 13; r = (r + 1) as Rank) {
      out.push({ id: id++, suit, rank: r, faceUp: false });
    }
  }
  return out;
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(seed: number): GameState {
  const rng = rngFromSeed(seed);
  const deck = shuffle(newDeck(), rng);
  let cursor = 0;
  const tableau: Card[][] = [];
  for (let col = 0; col < 7; col++) {
    const column: Card[] = [];
    for (let row = 0; row <= col; row++) {
      const card = { ...deck[cursor++], faceUp: row === col };
      column.push(card);
    }
    tableau.push(column);
  }
  const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }));
  return {
    stock,
    waste: [],
    foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
    tableau,
  };
}

function topOf(arr: Card[]): Card | null {
  return arr.length === 0 ? null : arr[arr.length - 1];
}

// tableau placement: alternating colours, descending rank. an empty
// tableau column only accepts a king (or a king-led sequence).
function canStackTableau(card: Card, target: Card | null): boolean {
  if (target === null) return card.rank === 13;
  if (!target.faceUp) return false;
  return isRed(card.suit) !== isRed(target.suit) && card.rank === target.rank - 1;
}

// foundation placement: same suit, ascending rank, starting with ace.
function canStackFoundation(card: Card, target: Card | null): boolean {
  if (target === null) return card.rank === 1;
  return target.suit === card.suit && card.rank === target.rank + 1;
}

// the selected piece — for tableau, the selected card plus everything on
// top of it in that column move as a unit.
function getMovingCards(state: GameState, sel: Selection): Card[] {
  if (sel.kind === 'waste') return state.waste.length ? [state.waste[state.waste.length - 1]] : [];
  if (sel.kind === 'foundation') {
    const f = state.foundations[sel.suit];
    return f.length ? [f[f.length - 1]] : [];
  }
  return state.tableau[sel.col].slice(sel.index);
}

function removeMoving(state: GameState, sel: Selection): GameState {
  if (sel.kind === 'waste') {
    return { ...state, waste: state.waste.slice(0, -1) };
  }
  if (sel.kind === 'foundation') {
    const next = { ...state.foundations };
    next[sel.suit] = next[sel.suit].slice(0, -1);
    return { ...state, foundations: next };
  }
  const next = state.tableau.slice();
  const col = next[sel.col].slice(0, sel.index);
  // auto-flip the new top if it's currently face-down.
  if (col.length > 0 && !col[col.length - 1].faceUp) {
    col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
  }
  next[sel.col] = col;
  return { ...state, tableau: next };
}

function checkWin(state: GameState): boolean {
  return SUITS.every((s) => state.foundations[s].length === 13);
}

// ─── seed encoding (just like mahjong: a single uint32 = a single deal) ─────

function freshSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

// ─── persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'lab:klondike:state';

type DrawMode = 'draw1' | 'draw3';

type Persisted = {
  seed: number;
  state: GameState;
  moves: number;
  baseElapsed: number;
  mode?: DrawMode; // optional for backwards-compat with v1 saves
};

function loadPersisted(): Persisted | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    if (
      typeof parsed.seed === 'number' &&
      parsed.state &&
      Array.isArray(parsed.state.tableau)
    ) {
      return parsed;
    }
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

// ─── the page ────────────────────────────────────────────────────────────────

export default function KlondikePage() {
  const search = useSearch({ from: '/_main/labs/klondike' });
  const navigate = useNavigate();

  const initialSeedRef = useRef<number | null>(null);
  if (initialSeedRef.current === null) {
    if (typeof search.seed === 'number') {
      initialSeedRef.current = search.seed;
    } else {
      const persisted = loadPersisted();
      initialSeedRef.current = persisted?.seed ?? freshSeed();
    }
  }
  const seed: number = typeof search.seed === 'number' ? search.seed : initialSeedRef.current;

  const [state, setState] = useState<GameState>(() => deal(seed));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [baseElapsed, setBaseElapsed] = useState(0);
  const [now, setNow] = useState<number>(() => Date.now());
  const [winElapsed, setWinElapsed] = useState<number | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  // v2: undo stack — every state-mutating action pushes the previous state
  // onto here first. cleared on new deal / restart / mode change.
  const [history, setHistory] = useState<GameState[]>([]);
  // v2: hint highlight — set by findHint, auto-cleared after a moment.
  const [hint, setHint] = useState<{ from: Selection; toFoundation?: Suit; toCol?: number } | null>(null);
  // v2: draw mode — draw-1 (turn one card) or draw-3 (turn three).
  const [mode, setMode] = useState<DrawMode>('draw1');
  // v2: distraction-free / fullscreen mode (same shape as Mahjong).
  const [focusMode, setFocusMode] = useState(false);
  const shellRef = useRef<HTMLElement>(null);
  // v2: leaderboard publish flow (mirrors Sudoku/Mahjong).
  const [publishState, setPublishState] = useState<'idle' | 'signing' | 'publishing' | 'published' | 'error'>('idle');
  const [publishError, setPublishError] = useState<string | null>(null);
  const [handleInput, setHandleInput] = useState('');

  const { session } = useAtprotoSession();
  const { data: profile } = useProfile({ actor: session?.info.sub ?? '' });
  const queryClient = useQueryClient();
  const { data: leaderboardRows } = useQuery({
    queryKey: ['leaderboard', GAME_ID],
    queryFn: () => getLeaderboard({ data: { game: GAME_ID } }),
  });
  const canPublishScore = sessionHasScope(session, LEADERBOARD_WRITE_SCOPE);

  const won = checkWin(state);

  // backfill ?seed= on first visit so the share-link is stable.
  useEffect(() => {
    if (search.seed !== seed) {
      navigate({ to: '/labs/klondike', search: { seed }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // restore on first mount; reset on every subsequent seed change.
  const firstSeedRef = useRef(true);
  useEffect(() => {
    if (firstSeedRef.current) {
      firstSeedRef.current = false;
      const p = loadPersisted();
      if (p && p.seed === seed) {
        setState(p.state);
        setMoves(p.moves);
        setBaseElapsed(p.baseElapsed);
        setStartedAt(Date.now());
        setSelection(null);
        if (p.mode) setMode(p.mode);
        return;
      }
    }
    setState(deal(seed));
    setMoves(0);
    setSelection(null);
    setStartedAt(Date.now());
    setBaseElapsed(0);
    setWinElapsed(null);
    setHistory([]);
    setHint(null);
    setPublishState('idle');
    setPublishError(null);
  }, [seed]);

  // tick clock while playing.
  useEffect(() => {
    if (won) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [won]);

  // capture win time precisely.
  useEffect(() => {
    if (won && winElapsed === null) {
      setWinElapsed(baseElapsed + (Date.now() - startedAt) / 1000);
    }
  }, [won, winElapsed, baseElapsed, startedAt]);

  const elapsed = won && winElapsed !== null ? winElapsed : baseElapsed + (now - startedAt) / 1000;

  // persist on change.
  useEffect(() => {
    savePersisted({ seed, state, moves, baseElapsed, mode });
  }, [seed, state, moves, baseElapsed, mode]);

  // every state-mutating action goes through this — pushes the prior state
  // onto the undo stack, applies the next, and bumps move count.
  const commitState = useCallback(
    (next: GameState) => {
      setHistory((h) => [...h, state]);
      setState(next);
      setMoves((m) => m + 1);
      setHint(null);
    },
    [state],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setState(prev);
      setMoves((m) => Math.max(0, m - 1));
      setSelection(null);
      setHint(null);
      return h.slice(0, -1);
    });
  }, []);

  // ─── click handling ───────────────────────────────────────────────────────

  // try to send the currently-moving piece to a foundation, then to any
  // valid tableau column. used when the player clicks the same selection
  // twice, like the "double-click → away" flow on classic windows klondike.
  const tryAutoMove = useCallback(
    (sel: Selection): GameState | null => {
      const moving = getMovingCards(state, sel);
      if (moving.length === 0) return null;
      // foundation only takes single cards — sequences from tableau aren't
      // eligible for auto-foundation.
      if (moving.length === 1) {
        const c = moving[0];
        if (canStackFoundation(c, topOf(state.foundations[c.suit]))) {
          const next = removeMoving(state, sel);
          const nextF = { ...next.foundations };
          nextF[c.suit] = [...nextF[c.suit], c];
          return { ...next, foundations: nextF };
        }
      }
      // try each tableau column in order
      for (let col = 0; col < 7; col++) {
        if (sel.kind === 'tableau' && sel.col === col) continue;
        if (canStackTableau(moving[0], topOf(state.tableau[col]))) {
          const next = removeMoving(state, sel);
          const t = next.tableau.slice();
          t[col] = [...t[col], ...moving];
          return { ...next, tableau: t };
        }
      }
      return null;
    },
    [state],
  );

  const drawFromStock = useCallback(() => {
    setSelection(null);
    if (state.stock.length > 0) {
      // draw-1 takes the top card, draw-3 takes up to three. preserve their
      // original order so the last-flipped card ends up on top of waste.
      const drawCount = mode === 'draw3' ? Math.min(3, state.stock.length) : 1;
      const drawn = state.stock
        .slice(state.stock.length - drawCount)
        .map((c) => ({ ...c, faceUp: true }));
      commitState({
        ...state,
        stock: state.stock.slice(0, state.stock.length - drawCount),
        waste: [...state.waste, ...drawn],
      });
    } else if (state.waste.length > 0) {
      // recycle waste back to stock face-down (reverse order so last drawn
      // becomes top of stock — same as flipping the pile over).
      commitState({
        ...state,
        stock: state.waste.slice().reverse().map((c) => ({ ...c, faceUp: false })),
        waste: [],
      });
    }
  }, [state, mode, commitState]);

  // attempt to apply a move from `sel` to a destination. returns true on success.
  const applyMoveTo = useCallback(
    (sel: Selection, dest: { kind: 'foundation'; suit: Suit } | { kind: 'tableau'; col: number }): boolean => {
      const moving = getMovingCards(state, sel);
      if (moving.length === 0) return false;
      if (dest.kind === 'foundation') {
        if (moving.length !== 1) return false;
        if (!canStackFoundation(moving[0], topOf(state.foundations[dest.suit]))) return false;
        const next = removeMoving(state, sel);
        const nf = { ...next.foundations };
        nf[dest.suit] = [...nf[dest.suit], moving[0]];
        commitState({ ...next, foundations: nf });
        return true;
      }
      // tableau
      if (sel.kind === 'tableau' && sel.col === dest.col) return false;
      if (!canStackTableau(moving[0], topOf(state.tableau[dest.col]))) return false;
      const next = removeMoving(state, sel);
      const t = next.tableau.slice();
      t[dest.col] = [...t[dest.col], ...moving];
      commitState({ ...next, tableau: t });
      return true;
    },
    [state, commitState],
  );

  const onClickCard = useCallback(
    (sel: Selection) => {
      if (won) return;
      setHint(null);
      if (selection === null) {
        // starting a fresh selection: refuse if the targeted card isn't
        // available (eg. a face-down tableau card).
        const moving = getMovingCards(state, sel);
        if (moving.length === 0) return;
        if (sel.kind === 'tableau') {
          const c = state.tableau[sel.col][sel.index];
          if (!c || !c.faceUp) return;
        }
        setSelection(sel);
        return;
      }
      // selection already exists — see if this is a "click selection again
      // → auto-move" or a "click another → move there".
      if (sameSelection(selection, sel)) {
        const auto = tryAutoMove(selection);
        if (auto) commitState(auto);
        setSelection(null);
        return;
      }
      // try to move the selection to where the user clicked.
      let dest: { kind: 'foundation'; suit: Suit } | { kind: 'tableau'; col: number } | null = null;
      if (sel.kind === 'foundation') dest = { kind: 'foundation', suit: sel.suit };
      else if (sel.kind === 'tableau') dest = { kind: 'tableau', col: sel.col };
      // can't move TO the waste pile.
      if (dest && applyMoveTo(selection, dest)) {
        setSelection(null);
        return;
      }
      // otherwise, treat it as a new selection (if valid).
      const moving = getMovingCards(state, sel);
      if (moving.length === 0) {
        setSelection(null);
        return;
      }
      if (sel.kind === 'tableau') {
        const c = state.tableau[sel.col][sel.index];
        if (!c || !c.faceUp) {
          setSelection(null);
          return;
        }
      }
      setSelection(sel);
    },
    [won, selection, state, tryAutoMove, applyMoveTo, commitState],
  );

  const onClickEmptyTableau = useCallback(
    (col: number) => {
      if (won) return;
      if (selection === null) return;
      applyMoveTo(selection, { kind: 'tableau', col });
      setSelection(null);
    },
    [won, selection, applyMoveTo],
  );

  const onClickEmptyFoundation = useCallback(
    (suit: Suit) => {
      if (won) return;
      if (selection === null) return;
      applyMoveTo(selection, { kind: 'foundation', suit });
      setSelection(null);
    },
    [won, selection, applyMoveTo],
  );

  // ─── v2 features ──────────────────────────────────────────────────────────

  // walk through possible moves and surface the first one we'd recommend.
  // priority: foundation moves first (always safe), then tableau-to-tableau
  // moves that uncover a face-down card, then any other tableau move.
  const findHint = useCallback(() => {
    if (won) return;
    type Hint = { from: Selection; toFoundation?: Suit; toCol?: number };
    const tryFoundation = (sel: Selection, c: Card | undefined): Hint | null => {
      if (!c) return null;
      const target = topOf(state.foundations[c.suit]);
      if (canStackFoundation(c, target)) return { from: sel, toFoundation: c.suit };
      return null;
    };
    // 1. waste / tableau-tops → foundation
    const wasteTop = topOf(state.waste);
    const wasteHint = wasteTop ? tryFoundation({ kind: 'waste' }, wasteTop) : null;
    if (wasteHint) {
      setHint(wasteHint);
      window.setTimeout(() => setHint(null), 1800);
      return;
    }
    for (let col = 0; col < 7; col++) {
      const top = topOf(state.tableau[col]);
      if (!top || !top.faceUp) continue;
      const h = tryFoundation({ kind: 'tableau', col, index: state.tableau[col].length - 1 }, top);
      if (h) {
        setHint(h);
        window.setTimeout(() => setHint(null), 1800);
        return;
      }
    }
    // 2. tableau → tableau, preferring moves that expose a face-down card.
    let bestHint: Hint | null = null;
    let bestReveals = false;
    for (let from = 0; from < 7; from++) {
      const colCards = state.tableau[from];
      // walk up the col to find a face-up bottom of a movable sequence.
      let firstFaceUp = -1;
      for (let i = 0; i < colCards.length; i++) {
        if (colCards[i].faceUp) {
          firstFaceUp = i;
          break;
        }
      }
      if (firstFaceUp === -1) continue;
      const card = colCards[firstFaceUp];
      // skip the trivial king-stays-where-it-is case.
      if (card.rank === 13 && firstFaceUp === 0) continue;
      for (let to = 0; to < 7; to++) {
        if (to === from) continue;
        if (canStackTableau(card, topOf(state.tableau[to]))) {
          const reveals = firstFaceUp > 0;
          if (!bestHint || (reveals && !bestReveals)) {
            bestHint = { from: { kind: 'tableau', col: from, index: firstFaceUp }, toCol: to };
            bestReveals = reveals;
            if (reveals) break;
          }
        }
      }
      if (bestReveals) break;
    }
    // 3. waste → tableau as last resort.
    if (!bestHint && wasteTop) {
      for (let col = 0; col < 7; col++) {
        if (canStackTableau(wasteTop, topOf(state.tableau[col]))) {
          bestHint = { from: { kind: 'waste' }, toCol: col };
          break;
        }
      }
    }
    if (bestHint) {
      setHint(bestHint);
      window.setTimeout(() => setHint(null), 1800);
    }
  }, [won, state]);

  // auto-finish: once stock + waste are empty and every tableau card is
  // face-up, the rest of the game is mechanical — move every face-up top
  // to its foundation in any greedy order.
  const canAutoFinish = useMemo(() => {
    if (won) return false;
    if (state.stock.length > 0 || state.waste.length > 0) return false;
    return state.tableau.every((col) => col.every((c) => c.faceUp));
  }, [won, state]);

  const autoFinish = useCallback(() => {
    if (!canAutoFinish) return;
    let cur = state;
    let safety = 200;
    while (safety-- > 0) {
      let moved = false;
      for (let col = 0; col < 7; col++) {
        const top = topOf(cur.tableau[col]);
        if (!top) continue;
        if (canStackFoundation(top, topOf(cur.foundations[top.suit]))) {
          const t = cur.tableau.slice();
          t[col] = t[col].slice(0, -1);
          const f = { ...cur.foundations };
          f[top.suit] = [...f[top.suit], top];
          cur = { ...cur, tableau: t, foundations: f };
          moved = true;
          break;
        }
      }
      if (!moved) break;
    }
    commitState(cur);
    setSelection(null);
  }, [canAutoFinish, state, commitState]);

  // ─── focus / fullscreen mode (same shape as Mahjong) ──────────────────────

  const enterFocus = useCallback(async () => {
    setFocusMode(true);
    const el = shellRef.current;
    if (el && document.fullscreenEnabled && !document.fullscreenElement) {
      try { await el.requestFullscreen(); } catch { /* fallback to css-only */ }
    }
  }, []);
  const exitFocus = useCallback(async () => {
    setFocusMode(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* ignore */ }
    }
  }, []);
  const toggleFocus = useCallback(() => {
    if (focusMode) void exitFocus();
    else void enterFocus();
  }, [focusMode, enterFocus, exitFocus]);

  useEffect(() => {
    function onChange() {
      if (!document.fullscreenElement && focusMode) setFocusMode(false);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        void exitFocus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusMode, exitFocus]);

  // ─── leaderboard publish flow ─────────────────────────────────────────────

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
      const signed = await signScore({ data: { game: GAME_ID, score, did } });
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
        () => queryClient.invalidateQueries({ queryKey: ['leaderboard', GAME_ID] }),
        2000,
      );
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : String(err));
      setPublishState('error');
    }
  }

  // ─── controls ─────────────────────────────────────────────────────────────

  const newGame = useCallback(() => {
    const s = freshSeed();
    navigate({ to: '/labs/klondike', search: { seed: s }, replace: true });
  }, [navigate]);

  const restart = useCallback(() => {
    setState(deal(seed));
    setSelection(null);
    setMoves(0);
    setStartedAt(Date.now());
    setBaseElapsed(0);
    setWinElapsed(null);
    setHistory([]);
    setHint(null);
    setPublishState('idle');
    setPublishError(null);
  }, [seed]);

  // mode toggle: swapping draw-1 ↔ draw-3 invalidates the deal mid-play
  // (the stock has a different "round-trip" length). reset to a fresh
  // shuffle on the same seed so things stay sane.
  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'draw1' ? 'draw3' : 'draw1'));
    setState(deal(seed));
    setSelection(null);
    setMoves(0);
    setStartedAt(Date.now());
    setBaseElapsed(0);
    setWinElapsed(null);
    setHistory([]);
    setHint(null);
    setPublishState('idle');
    setPublishError(null);
  }, [seed]);

  const loadSeed = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      const n = Number(trimmed);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 0xffffffff) return;
      navigate({ to: '/labs/klondike', search: { seed: n >>> 0 }, replace: true });
    },
    [navigate],
  );

  const copyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/labs/klondike?seed=${seed}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      /* ignore */
    }
  }, [seed]);

  const [seedInput, setSeedInput] = useState('');

  // ─── highlight calculation ────────────────────────────────────────────────

  // when something is selected, work out which destination piles would be
  // valid drops, so the ui can light them up.
  const validDrops = useMemo(() => {
    const out = {
      foundation: new Set<Suit>(),
      tableau: new Set<number>(),
    };
    if (!selection) return out;
    const moving = getMovingCards(state, selection);
    if (moving.length === 0) return out;
    if (moving.length === 1) {
      for (const s of SUITS) {
        if (selection.kind === 'foundation' && selection.suit === s) continue;
        if (canStackFoundation(moving[0], topOf(state.foundations[s]))) out.foundation.add(s);
      }
    }
    for (let col = 0; col < 7; col++) {
      if (selection.kind === 'tableau' && selection.col === col) continue;
      if (canStackTableau(moving[0], topOf(state.tableau[col]))) out.tableau.add(col);
    }
    return out;
  }, [selection, state]);

  // ─── render ───────────────────────────────────────────────────────────────

  const isSelected = (sel: Selection): boolean => {
    if (!selection) return false;
    return sameSelection(selection, sel);
  };

  return (
    <>
      <style>{CSS}</style>
      <main
        className={`shell-klondike${focusMode ? ' focus' : ''}`}
        ref={shellRef}
      >
        {focusMode ? (
          <div className="focus-bar" role="toolbar">
            <span className="fb-stat"><span className="fb-lbl">time</span><b>{formatTime(elapsed)}</b></span>
            <span className="fb-stat"><span className="fb-lbl">moves</span><b>{moves}</b></span>
            <span className="fb-stat">
              <span className="fb-lbl">foundation</span>
              <b className="t-accent">{SUITS.reduce((acc, s) => acc + state.foundations[s].length, 0)}/52</b>
            </span>
            <button type="button" className="ghost-btn fb-btn" onClick={undo} disabled={history.length === 0}>undo</button>
            <button type="button" className="ghost-btn fb-btn" onClick={findHint} disabled={won}>hint</button>
            {canAutoFinish ? (
              <button type="button" className="ghost-btn fb-btn" onClick={autoFinish}>auto-finish</button>
            ) : null}
            <button type="button" className="ghost-btn fb-btn" onClick={() => void exitFocus()} title="esc">exit</button>
          </div>
        ) : null}

        <header className="page-hd">
          <div className="label">~/labs/klondike</div>
          <h1>klondike<span className="dot">.</span></h1>
          <p className="sub">
            classic solitaire — 52 hand-drawn svg cards, 4 foundations, 7 tableau
            columns. click a card to select it (with everything on top); click
            again to auto-send it to a foundation if possible. share the seed to
            challenge a friend on the exact same deal.
          </p>
          <div className="meta">
            <span>mode <b className="t-accent">{mode}</b></span>
            <span>moves <b>{moves}</b></span>
            <span>foundation <b className="t-accent">{SUITS.reduce((acc, s) => acc + state.foundations[s].length, 0)}/52</b></span>
            <span>stock <b>{state.stock.length}</b></span>
            <span>time <b>{formatTime(elapsed)}</b></span>
            <span>status <b className={won ? 't-accent' : ''}>{won ? 'won' : 'in progress'}</b></span>
          </div>
        </header>

        <section className="controls">
          <div className="layout-row">
            <button
              type="button"
              className={`diff-btn${mode === 'draw1' ? ' on' : ''}`}
              onClick={() => { if (mode !== 'draw1') toggleMode(); }}
            >
              draw-1
            </button>
            <button
              type="button"
              className={`diff-btn${mode === 'draw3' ? ' on' : ''}`}
              onClick={() => { if (mode !== 'draw3') toggleMode(); }}
            >
              draw-3
            </button>
          </div>
          <div className="action-row">
            <button type="button" className="ghost-btn" onClick={newGame}>new deal</button>
            <button type="button" className="ghost-btn" onClick={restart}>restart this deal</button>
            <button type="button" className="ghost-btn" onClick={undo} disabled={history.length === 0}>undo</button>
            <button type="button" className="ghost-btn" onClick={findHint} disabled={won}>hint</button>
            {canAutoFinish ? (
              <button type="button" className="ghost-btn" onClick={autoFinish}>auto-finish</button>
            ) : null}
            <button
              type="button"
              className="ghost-btn"
              onClick={toggleFocus}
              title="distraction-free, fullscreen where supported. esc to exit."
            >
              fullscreen
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
            <button type="submit" className="ghost-btn" disabled={!seedInput.trim()}>load</button>
          </form>
        </section>

        <section className="board">
          <div className="top-row">
            {/* stock */}
            <div className="pile" onClick={drawFromStock}>
              {state.stock.length > 0 ? (
                <CardBackSVG />
              ) : (
                <div className="recycle-hint">
                  <EmptyPlaceholder glyph={state.waste.length > 0 ? '↻' : ''} />
                </div>
              )}
            </div>
            {/* waste — in draw-3 mode shows the top three staggered, with
                only the rightmost (newest) being playable. */}
            <div className={`pile pile-waste${mode === 'draw3' ? ' draw-3' : ''}`}>
              {state.waste.length === 0 ? (
                <EmptyPlaceholder />
              ) : (
                (() => {
                  const visibleCount = mode === 'draw3' ? 3 : 1;
                  const visible = state.waste.slice(-visibleCount);
                  return visible.map((card, i, arr) => {
                    const isTop = i === arr.length - 1;
                    const left = mode === 'draw3' ? `${i * 30}%` : '0';
                    const hintFrom = hint?.from.kind === 'waste' && isTop;
                    return (
                      <div
                        key={card.id}
                        className={`waste-card${
                          isTop && isSelected({ kind: 'waste' }) ? ' selected' : ''
                        }${hintFrom ? ' is-hint-from' : ''}`}
                        style={{ left }}
                        onClick={isTop ? () => onClickCard({ kind: 'waste' }) : undefined}
                      >
                        <CardSVG card={card} />
                      </div>
                    );
                  });
                })()
              )}
            </div>
            {/* spacer */}
            <div className="pile pile-spacer" />
            {/* foundations */}
            {SUITS.map((suit) => {
              const f = state.foundations[suit];
              const sel: Selection = { kind: 'foundation', suit };
              const isDrop = validDrops.foundation.has(suit);
              const isHintTo = hint?.toFoundation === suit;
              const isHintFrom = hint?.from.kind === 'foundation' && hint.from.suit === suit;
              const onClick = () => {
                if (f.length > 0) onClickCard(sel);
                else onClickEmptyFoundation(suit);
              };
              return (
                <div
                  key={suit}
                  className={`pile pile-foundation${isDrop ? ' is-drop' : ''}${isHintTo ? ' is-hint-to' : ''}`}
                  onClick={onClick}
                >
                  {f.length === 0 ? (
                    <EmptyPlaceholder glyph={SUIT_CHAR[suit]} />
                  ) : (
                    <div className={`card-wrap${isSelected(sel) ? ' selected' : ''}${isHintFrom ? ' is-hint-from' : ''}`}>
                      <CardSVG card={f[f.length - 1]} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="tableau-row">
            {state.tableau.map((col, ci) => {
              const isDrop = validDrops.tableau.has(ci);
              const isHintTo = hint?.toCol === ci;
              return (
                <div
                  key={ci}
                  className={`tableau-col${isDrop ? ' is-drop' : ''}${isHintTo ? ' is-hint-to' : ''}`}
                  onClick={() => {
                    if (col.length === 0) onClickEmptyTableau(ci);
                  }}
                >
                  {col.length === 0 ? <EmptyPlaceholder /> : null}
                  {col.map((card, ri) => {
                    const sel: Selection = { kind: 'tableau', col: ci, index: ri };
                    const selected = isSelectedSequence(selection, ci, ri);
                    const isHintFrom =
                      hint?.from.kind === 'tableau' &&
                      hint.from.col === ci &&
                      ri >= hint.from.index;
                    // negative-margin overlap so the column grows naturally
                    // with content. percent is of column width — face-up
                    // cards under a face-up card show ~28% of their height,
                    // face-down show ~18%.
                    const prevFaceUp = ri > 0 && col[ri - 1].faceUp;
                    const margin = ri === 0 ? 0 : prevFaceUp ? -100 : -115;
                    return (
                      <div
                        key={card.id}
                        className={`tableau-card${selected ? ' selected' : ''}${card.faceUp ? '' : ' down'}${isHintFrom ? ' is-hint-from' : ''}`}
                        style={{ marginTop: `${margin}%` }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClickCard(sel);
                        }}
                      >
                        <CardSVG card={card} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {won ? (
            <div className="overlay">
              <div className="ov-title">you win.</div>
              <div className="ov-score">
                <span className="ov-score-val">{formatTime(elapsed)}</span>
                <span className="ov-score-lbl">{moves} moves</span>
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
          ) : null}
        </section>

        <Leaderboard rows={leaderboardRows ?? null} myDid={session?.info.sub ?? null} />

        <footer className="klondike-footer">
          <span>src: <span className="t-accent">hand-written · ~700 lines</span></span>
          <span>
            ←{' '}
            <Link to="/labs" className="t-accent">labs</Link>
          </span>
        </footer>
      </main>
    </>
  );
}

// ─── selection helpers ─────────────────────────────────────────────────────

function sameSelection(a: Selection, b: Selection): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'waste') return true;
  if (a.kind === 'foundation') return (b as { kind: 'foundation'; suit: Suit }).suit === a.suit;
  const bb = b as { kind: 'tableau'; col: number; index: number };
  return a.col === bb.col && a.index === bb.index;
}

function isSelectedSequence(selection: Selection | null, col: number, index: number): boolean {
  if (!selection || selection.kind !== 'tableau') return false;
  return selection.col === col && index >= selection.index;
}

// ─── styles ────────────────────────────────────────────────────────────────

const CSS = `
  .shell-klondike { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

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

  .controls { display: flex; gap: 6px; margin-top: var(--sp-5); flex-wrap: wrap; }
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
  .seed-value { color: var(--color-accent); font-size: var(--fs-sm); user-select: all; -webkit-user-select: all; word-break: break-all; }
  .seed-copy { white-space: nowrap; }
  .seed-form { display: flex; gap: 6px; flex: 1 1 220px; min-width: 200px; }
  .seed-input {
    flex: 1;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 6px 10px;
  }
  .seed-input:focus { outline: none; border-color: var(--color-accent); }

  .board {
    margin-top: var(--sp-5);
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-panel);
    padding: var(--sp-4);
    position: relative;
  }
  .top-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--sp-3);
  }
  .pile {
    aspect-ratio: 60 / 84;
    cursor: pointer;
    position: relative;
  }
  .pile-spacer { cursor: default; }
  .pile-foundation.is-drop, .tableau-col.is-drop {
    box-shadow: 0 0 0 2px var(--color-accent), 0 0 12px color-mix(in oklch, var(--color-accent) 40%, transparent);
    border-radius: 5px;
  }
  .recycle-hint { aspect-ratio: 60 / 84; }

  .tableau-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: var(--sp-3);
    margin-top: var(--sp-4);
    align-items: start; /* let each col grow to its own content height */
  }
  .tableau-col {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
  .tableau-col > svg.card-empty { width: 100%; height: auto; }

  .card {
    width: 100%;
    height: auto;
    display: block;
    pointer-events: none;
  }
  .card-wrap {
    cursor: pointer;
    transition: transform 0.06s linear;
  }
  .card-wrap.selected, .tableau-card.selected {
    filter: drop-shadow(0 0 6px color-mix(in oklch, var(--color-accent) 70%, transparent));
    z-index: 5;
    position: relative;
  }
  .tableau-card {
    width: 100%;
    cursor: pointer;
    /* keeps later cards painted above the ones below them */
    position: relative;
  }
  .tableau-card.down { cursor: default; }

  .overlay {
    position: absolute; inset: 0;
    background: color-mix(in oklch, var(--color-bg) 84%, transparent);
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: var(--sp-3);
    font-family: var(--font-mono);
    z-index: 10;
  }
  .ov-title {
    font-family: var(--font-display);
    font-size: clamp(40px, 7vw, 72px);
    color: var(--color-accent);
    text-shadow: 0 0 16px var(--accent-glow);
  }
  .ov-score { display: flex; align-items: baseline; gap: var(--sp-3); }
  .ov-score-val {
    font-family: var(--font-display);
    font-size: clamp(40px, 7vw, 64px);
    color: var(--color-accent);
    text-shadow: 0 0 14px var(--accent-glow);
  }
  .ov-score-lbl { font-family: var(--font-mono); font-size: var(--fs-xs); color: var(--color-fg-faint); }
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

  .klondike-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-6);
    border-top: 1px solid var(--color-border);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }

  /* small screens — narrow gaps so all 7 columns fit */
  @media (max-width: 640px) {
    .top-row, .tableau-row { gap: 4px; }
    .board { padding: var(--sp-3); }
  }

  /* v2: mode toggle, action row */
  .controls {
    display: flex; flex-wrap: wrap; gap: var(--sp-3);
    align-items: center; justify-content: space-between;
  }
  .layout-row, .action-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .diff-btn {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 6px 12px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .diff-btn:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .diff-btn.on {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: color-mix(in oklch, var(--color-accent) 10%, transparent);
  }

  /* v2: waste stagger for draw-3 */
  .pile-waste { position: relative; overflow: visible; }
  .pile-waste .waste-card {
    position: absolute;
    top: 0; left: 0;
    width: 100%;
    cursor: default;
  }
  .pile-waste.draw-3 .waste-card {
    cursor: default;
    width: 100%;
    /* the rightmost card is the only clickable one — set per-card via inline style */
  }
  .pile-waste:not(.draw-3) .waste-card { cursor: pointer; }
  .pile-waste.draw-3 .waste-card:last-child { cursor: pointer; }
  .pile-waste .waste-card.selected {
    filter: drop-shadow(0 0 6px color-mix(in oklch, var(--color-accent) 70%, transparent));
    z-index: 5;
  }

  /* v2: hint highlights — pulse the source card and the destination pile
     while the hint is showing. */
  .is-hint-from {
    filter: drop-shadow(0 0 6px color-mix(in oklch, oklch(0.85 0.16 90) 75%, transparent));
    animation: kk-hint-pulse 0.9s ease-in-out infinite alternate;
  }
  .is-hint-to {
    box-shadow: 0 0 0 2px oklch(0.85 0.16 90), 0 0 12px color-mix(in oklch, oklch(0.85 0.16 90) 50%, transparent);
    border-radius: 5px;
    animation: kk-hint-pulse 0.9s ease-in-out infinite alternate;
  }
  @keyframes kk-hint-pulse {
    from { opacity: 0.85; }
    to { opacity: 1; }
  }

  /* v2: focus / fullscreen mode */
  .shell-klondike.focus {
    max-width: none;
    margin: 0; padding: 0;
    width: 100%; height: 100vh;
    display: flex; flex-direction: column;
    background: var(--color-bg);
  }
  .shell-klondike.focus:fullscreen { height: 100vh; }
  .shell-klondike.focus .page-hd,
  .shell-klondike.focus .controls,
  .shell-klondike.focus .seed-row,
  .shell-klondike.focus .lb,
  .shell-klondike.focus .klondike-footer { display: none; }
  .shell-klondike.focus .board {
    flex: 1; margin: 0; padding: 56px 16px 16px;
    overflow: auto;
  }
  .focus-bar {
    position: fixed;
    top: 12px; left: 50%;
    transform: translateX(-50%);
    display: flex; align-items: center; gap: var(--sp-4);
    padding: 6px 12px;
    background: color-mix(in oklch, var(--color-bg) 92%, transparent);
    border: 1px solid var(--color-border-bright);
    border-radius: 2px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    z-index: 100;
    backdrop-filter: blur(4px);
  }
  .fb-stat { display: inline-flex; align-items: baseline; gap: 6px; }
  .fb-lbl { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; }
  .fb-stat b { color: var(--color-fg); font-weight: 400; }
  .fb-stat b.t-accent { color: var(--color-accent); }
  .fb-btn { padding: 4px 10px; font-size: 10px; }

  /* v2: lock-form + ov-btn-ghost + ov-err inside the win overlay */
  .ov-sub {
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    color: var(--color-fg-dim);
    max-width: 48ch; text-align: center; line-height: 1.55;
  }
  .ov-sub b.t-accent { color: var(--color-accent); }
  .ov-sub.t-faint { color: var(--color-fg-faint); }
  .lock-form { display: flex; gap: 6px; width: 100%; max-width: 360px; }
  .lock-input {
    flex: 1;
    background: var(--color-bg);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg);
    font-family: var(--font-mono); font-size: var(--fs-sm);
    padding: 8px 10px;
  }
  .lock-input:focus { outline: none; border-color: var(--color-accent); }
  .ov-btn-ghost {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    padding: 8px 20px;
    background: transparent;
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    cursor: pointer;
    text-transform: lowercase;
    letter-spacing: 0.06em;
  }
  .ov-btn-ghost:hover { color: var(--color-fg); border-color: var(--color-accent-dim); }
  .ov-err {
    font-family: var(--font-mono); font-size: var(--fs-xs);
    color: var(--color-alert);
    max-width: 48ch; text-align: center;
  }

  /* v2: leaderboard panel */
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
`;

// ─── leaderboard panel ──────────────────────────────────────────────────────

function Leaderboard({
  rows,
  myDid,
}: {
  rows: LeaderboardRow[] | null;
  myDid: string | null;
}) {
  return (
    <div className="lb">
      <div className="lb-head">
        <span className="t-accent">./leaderboard --klondike</span>
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

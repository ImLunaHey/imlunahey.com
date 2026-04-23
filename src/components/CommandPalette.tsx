import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  ArrowUpRight, Beaker, BookOpen, Bookmark, Camera, Clipboard,
  Command, FileCode, Gamepad2, Globe, Hammer, Heart, Image,
  MessageSquare, Monitor, Music, Palette, Search, Server, Sparkles,
  Star, Tv, Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { getPopfeedGames, getPopfeedWatches } from '../server/popfeed';

type IconC = ComponentType<{ size?: number; className?: string }>;

type Item = {
  id: string;
  label: string;
  subtitle?: string;
  group: 'navigate' | 'recent' | 'labs' | 'actions';
  icon: IconC;
  keywords?: string[];
  shortcut?: string;
  hint?: string;
  external?: boolean;
  run: () => void;
};

type MatchedItem = Item & { score: number; positions: number[] };

const GROUP_TITLES: Record<Item['group'], string> = {
  navigate: 'navigate',
  recent: 'recent',
  labs: 'labs',
  actions: 'actions',
};

const GROUP_ORDER: Item['group'][] = ['navigate', 'recent', 'labs', 'actions'];

function foldText(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function fuzzyMatch(query: string, text: string): { positions: number[]; score: number } | null {
  if (!query) return { positions: [], score: 0 };
  const q = foldText(query);
  const s = foldText(text);
  const positions: number[] = [];
  let qi = 0;
  for (let i = 0; i < s.length && qi < q.length; i++) {
    if (s[i] === q[qi]) {
      positions.push(i);
      qi++;
    }
  }
  if (qi < q.length) return null;
  const span = positions[positions.length - 1] - positions[0];
  const startBoost = positions[0] === 0 ? -5 : 0;
  const score = span - positions.length * 2 + startBoost;
  return { positions, score };
}

function highlight(text: string, positions: number[]): ReactNode {
  if (positions.length === 0) return text;
  const set = new Set(positions);
  return text.split('').map((ch, i) =>
    set.has(i) ? <span key={i} className="cp-hl">{ch}</span> : <span key={i}>{ch}</span>,
  );
}

const CRT_KEY = 'cp:crt-off';

function toggleCrt() {
  const root = document.documentElement;
  const off = root.classList.toggle('crt-off');
  try {
    if (off) localStorage.setItem(CRT_KEY, '1');
    else localStorage.removeItem(CRT_KEY);
  } catch {}
}

function restoreCrt() {
  try {
    if (localStorage.getItem(CRT_KEY) === '1') {
      document.documentElement.classList.add('crt-off');
    }
  } catch {}
}

const NAV_ITEMS: Array<{ to: string; label: string; subtitle: string; icon: IconC; keywords?: string[] }> = [
  { to: '/', label: 'home', subtitle: 'landing page', icon: Sparkles, keywords: ['~', 'index', 'start'] },
  { to: '/blog', label: 'writing', subtitle: 'blog posts & essays', icon: BookOpen, keywords: ['blog', 'posts'] },
  { to: '/projects', label: 'projects', subtitle: 'things i\'ve built', icon: Hammer },
  { to: '/gallery', label: 'gallery', subtitle: 'photos', icon: Image, keywords: ['photos', 'pictures'] },
  { to: '/watching', label: 'watching', subtitle: 'movies & tv reviews', icon: Tv, keywords: ['movies', 'films', 'shows', 'reviews'] },
  { to: '/games', label: 'games', subtitle: 'game reviews', icon: Gamepad2, keywords: ['reviews', 'video games'] },
  { to: '/library', label: 'library', subtitle: 'physical media shelf', icon: BookOpen, keywords: ['criterion', 'blu-ray', 'dvd', 'collection'] },
  { to: '/music', label: 'music', subtitle: 'what i listen to', icon: Music, keywords: ['lastfm', 'scrobbles'] },
  { to: '/bookmarks', label: 'bookmarks', subtitle: 'saved links', icon: Bookmark },
  { to: '/homelab', label: 'homelab', subtitle: 'infra & services', icon: Server, keywords: ['servers', 'infra'] },
  { to: '/labs', label: 'labs', subtitle: 'experiments & tools', icon: Beaker, keywords: ['experiments', 'tools'] },
  { to: '/globe', label: 'globe', subtitle: 'places on a map', icon: Globe, keywords: ['travel', 'map'] },
  { to: '/ai', label: 'ai', subtitle: 'ai sandbox', icon: Sparkles, keywords: ['llm', 'chat'] },
  { to: '/guestbook', label: 'guestbook', subtitle: 'leave a note', icon: MessageSquare, keywords: ['comments'] },
  { to: '/health', label: 'health', subtitle: 'vitals & metrics', icon: Heart, keywords: ['fitness', 'stats'] },
  { to: '/uses', label: 'uses', subtitle: 'hardware & software', icon: Wrench, keywords: ['setup', 'gear'] },
];

const LABS: Array<{ to: string; label: string; subtitle?: string }> = [
  { to: '/labs/wordle', label: 'wordle', subtitle: 'daily word game' },
  { to: '/labs/snake', label: 'snake', subtitle: 'arcade classic' },
  { to: '/labs/typing', label: 'typing', subtitle: 'wpm test' },
  { to: '/labs/life', label: "conway's life", subtitle: 'cellular automaton' },
  { to: '/labs/palette', label: 'palette', subtitle: 'color extractor' },
  { to: '/labs/infinite-canvas', label: 'infinite canvas', subtitle: 'drawing surface' },
  { to: '/labs/jetstream', label: 'jetstream', subtitle: 'atproto firehose' },
  { to: '/labs/plc-log', label: 'plc log', subtitle: 'atproto plc directory' },
  { to: '/labs/lexicon', label: 'lexicon', subtitle: 'atproto schema viewer' },
  { to: '/labs/feed', label: 'feed', subtitle: 'atproto feed inspector' },
  { to: '/labs/css-battles', label: 'css battles', subtitle: 'daily css challenges' },
  { to: '/labs/car-explorer', label: 'car explorer', subtitle: 'atproto repo browser' },
  { to: '/labs/at-uri', label: 'at-uri', subtitle: 'at:// uri inspector' },
  { to: '/labs/verse-reveal', label: 'verse reveal', subtitle: 'text animation' },
  { to: '/labs/og-preview', label: 'og preview', subtitle: 'opengraph card tester' },
  { to: '/labs/bsky-composer', label: 'bsky composer', subtitle: 'post composer with live link-card preview' },
  { to: '/labs/fingerprint', label: 'fingerprint', subtitle: 'what your browser tells every site' },
  { to: '/labs/whois', label: 'whois', subtitle: 'rdap domain lookup' },
  { to: '/labs/ids', label: 'ids', subtitle: 'uuid/ulid/tid/snowflake gen + inspect' },
  { to: '/labs/unicode', label: 'unicode', subtitle: 'graphemes, codepoints, normalization' },
  { to: '/labs/handle-sniper', label: 'handle sniper', subtitle: 'check bluesky handle availability' },
  { to: '/labs/did-log', label: 'did log', subtitle: 'atproto identity history timeline' },
  { to: '/labs/thread-tree', label: 'thread tree', subtitle: 'bluesky conversation visualizer' },
  { to: '/labs/pds-health', label: 'pds health', subtitle: 'probe any atproto pds' },
  { to: '/labs/regex', label: 'regex', subtitle: 'live regex tester with groups' },
  { to: '/labs/encode', label: 'encode', subtitle: 'base64 / url / html / hex / binary' },
  { to: '/labs/diff', label: 'diff', subtitle: 'line-level diff between two blobs' },
  { to: '/labs/lexicon-validator', label: 'lexicon validator', subtitle: 'validate atproto records against schemas' },
  { to: '/labs/firehose-stats', label: 'firehose stats', subtitle: 'live bluesky jetstream aggregates' },
  { to: '/labs/dns', label: 'dns', subtitle: 'a/aaaa/txt/mx lookup via doh' },
  { to: '/labs/json', label: 'json', subtitle: 'collapsible tree viewer with path copier' },
  { to: '/labs/colour', label: 'colour', subtitle: 'hex/rgb/hsl/oklch converter' },
  { to: '/labs/timestamp', label: 'timestamp', subtitle: 'unix/iso/rfc/relative, all timezones' },
  { to: '/labs/matrix', label: 'matrix', subtitle: 'falling-kana canvas screensaver' },
  { to: '/labs/terminal', label: 'terminal', subtitle: 'shell navigator for the whole site' },
  { to: '/labs/hash', label: 'hash', subtitle: 'md5 / sha-* of any input' },
  { to: '/labs/case', label: 'case', subtitle: 'every case style at once' },
  { to: '/labs/password', label: 'password', subtitle: 'generator with live entropy meter' },
  { to: '/labs/hex-dump', label: 'hex dump', subtitle: 'xxd-style hex + ascii view' },
  { to: '/labs/ua', label: 'ua', subtitle: 'user-agent parser' },
  { to: '/labs/http-status', label: 'http status', subtitle: 'every status code with explanations' },
  { to: '/labs/curl', label: 'curl → fetch', subtitle: 'convert curl commands to js' },
  { to: '/labs/csv', label: 'csv', subtitle: 'csv ↔ json converter' },
  { to: '/labs/subnet', label: 'subnet', subtitle: 'cidr calculator with bitwise view' },
  { to: '/labs/http-headers', label: 'http headers', subtitle: 'inspect any url\'s response headers' },
  { to: '/labs/certs', label: 'certs', subtitle: 'tls cert history from ct logs' },
  { to: '/labs/schema', label: 'schema', subtitle: 'infer json schema from data' },
  { to: '/labs/dist', label: 'distribution', subtitle: 'stats + histogram + q-q + outliers' },
  { to: '/labs/exif', label: 'exif', subtitle: 'see + strip image metadata' },
  { to: '/labs/spectrogram', label: 'spectrogram', subtitle: 'audio frequency over time' },
  { to: '/labs/png-chunks', label: 'png chunks', subtitle: 'inspect every chunk in a png' },
  { to: '/labs/ascii', label: 'ascii', subtitle: 'photo → ascii, six ramps' },
  { to: '/labs/units', label: 'units', subtitle: 'dimensional-analysis calculator' },
  { to: '/labs/browser', label: 'browser', subtitle: 'every api this tab supports' },
  { to: '/labs/iss', label: 'iss', subtitle: 'live position of the space station' },
  { to: '/labs/lightning', label: 'lightning', subtitle: 'global storm-risk map' },
  { to: '/labs/periodic', label: 'periodic', subtitle: '118 elements · full table' },
  { to: '/labs/tfl-status', label: 'tfl status', subtitle: 'live tube / dlr / elizabeth status' },
  { to: '/labs/tfl-cycles', label: 'cycles', subtitle: 'santander cycles dock map' },
  { to: '/labs/tfl-arrivals', label: 'arrivals', subtitle: 'live next-train board, any station' },
  { to: '/labs/tfl-air', label: 'air', subtitle: 'london air quality forecast' },
  { to: '/labs/tfl-roads', label: 'roads', subtitle: 'live tfl road disruption map' },
  { to: '/labs/tfl-tube-map', label: 'tube map', subtitle: 'every line, every station, live status' },
  { to: '/labs/crime', label: 'crime', subtitle: 'police.uk data for any postcode' },
  { to: '/labs/mp', label: 'mp', subtitle: 'your mp + recent commons votes' },
  { to: '/labs/hygiene', label: 'hygiene', subtitle: 'fsa food-safety ratings' },
  { to: '/labs/year-in-review', label: 'year in review', subtitle: 'bluesky wrapped — from any handle\'s car file' },
  { to: '/labs/jwt', label: 'jwt', subtitle: 'decode & inspect' },
  { to: '/labs/cron', label: 'cron', subtitle: 'cron expression helper' },
  { to: '/labs/tid', label: 'tid', subtitle: 'atproto tid converter' },
  { to: '/labs/pdf-uploader', label: 'pdf uploader', subtitle: 'pdf tools' },
  { to: '/labs/list-cleaner', label: 'list cleaner', subtitle: 'dedupe & sort' },
  { to: '/labs/screenshot-maker', label: 'screenshot maker', subtitle: 'polished screenshots' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { data: games } = useQuery({
    queryKey: ['popfeed', 'games'],
    queryFn: () => getPopfeedGames(),
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });
  const { data: watches } = useQuery({
    queryKey: ['popfeed', 'watches'],
    queryFn: () => getPopfeedWatches(),
    enabled: open,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => { restoreCrt(); }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const modK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute?.('contenteditable') === 'true';
      const slashOpen = e.key === '/' && !inField && !open;

      if (modK) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (slashOpen) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIdx(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 20);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const items = useMemo<Item[]>(() => {
    const nav: Item[] = NAV_ITEMS.map((n) => ({
      id: `nav:${n.to}`,
      label: n.label,
      subtitle: n.subtitle,
      group: 'navigate',
      icon: n.icon,
      keywords: n.keywords,
      hint: n.to,
      run: () => navigate({ to: n.to as never }),
    }));

    const recent: Item[] = [];
    const g = games?.items ?? [];
    const w = watches?.items ?? [];
    const merged = [
      ...g.map((i) => ({ kind: 'game' as const, r: i })),
      ...w.map((i) => ({ kind: 'watch' as const, r: i })),
    ].sort((a, b) => b.r.createdAt.localeCompare(a.r.createdAt));

    for (const { kind, r } of merged) {
      const rating = r.rating != null ? ` · ★ ${r.rating.toFixed(1)}` : '';
      const base = kind === 'game' ? 'game' : r.kind.replace(/_/g, ' ');
      recent.push({
        id: `recent:${kind}:${r.rkey}`,
        label: r.title,
        subtitle: `${base}${rating}${r.credit ? ` · ${r.credit}` : ''}`,
        group: 'recent',
        icon: kind === 'game' ? Gamepad2 : Tv,
        keywords: [kind, r.kind, r.credit ?? '', ...(r.genres ?? [])],
        hint: kind === 'game' ? `/games/${r.rkey}` : `/watching/${r.rkey}`,
        run: () =>
          navigate({ to: (kind === 'game' ? `/games/${r.rkey}` : `/watching/${r.rkey}`) as never }),
      });
    }

    const labs: Item[] = LABS.map((l) => ({
      id: `lab:${l.to}`,
      label: l.label,
      subtitle: l.subtitle,
      group: 'labs',
      icon: Beaker,
      hint: l.to,
      run: () => navigate({ to: l.to as never }),
    }));

    const actions: Item[] = [
      {
        id: 'act:copy-url',
        label: 'copy current url',
        subtitle: 'put this page in your clipboard',
        group: 'actions',
        icon: Clipboard,
        shortcut: '⌘⇧U',
        keywords: ['link', 'share', 'clipboard'],
        run: () => {
          try { navigator.clipboard.writeText(window.location.href); } catch {}
        },
      },
      {
        id: 'act:toggle-crt',
        label: 'toggle crt overlay',
        subtitle: 'scanlines + vignette + film grain',
        group: 'actions',
        icon: Monitor,
        shortcut: '⌘⇧C',
        keywords: ['scanlines', 'noise', 'retro', 'theme'],
        run: toggleCrt,
      },
      {
        id: 'act:top',
        label: 'scroll to top',
        subtitle: 'jump back up',
        group: 'actions',
        icon: ArrowUpRight,
        keywords: ['up'],
        run: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
      },
      {
        id: 'act:github',
        label: 'view source on github',
        subtitle: 'imlunahey/imlunahey.com',
        group: 'actions',
        icon: FileCode,
        external: true,
        keywords: ['repo', 'code', 'open source'],
        run: () => window.open('https://github.com/imlunahey/imlunahey.com', '_blank', 'noopener,noreferrer'),
      },
      {
        id: 'act:bsky',
        label: 'open bluesky profile',
        subtitle: '@imlunahey.com',
        group: 'actions',
        icon: ArrowUpRight,
        external: true,
        keywords: ['social', 'atproto'],
        run: () => window.open('https://bsky.app/profile/imlunahey.com', '_blank', 'noopener,noreferrer'),
      },
      {
        id: 'act:design',
        label: 'design system',
        subtitle: 'tokens, components, patterns',
        group: 'actions',
        icon: Palette,
        keywords: ['tokens', 'colors', 'fonts'],
        run: () => navigate({ to: '/design-system' as never }),
      },
      {
        id: 'act:star-rating-help',
        label: 'about the ratings',
        subtitle: 'how reviews are scored',
        group: 'actions',
        icon: Star,
        external: true,
        keywords: ['popfeed', 'help'],
        run: () => window.open('https://popfeed.social', '_blank', 'noopener,noreferrer'),
      },
      {
        id: 'act:gallery',
        label: 'jump to gallery',
        subtitle: 'latest photos',
        group: 'actions',
        icon: Camera,
        run: () => navigate({ to: '/gallery' as never }),
      },
    ];

    return [...nav, ...recent, ...labs, ...actions];
  }, [games, watches, navigate]);

  const filtered = useMemo<MatchedItem[]>(() => {
    if (!query.trim()) {
      return items.map((it) => ({ ...it, score: 0, positions: [] }));
    }
    const q = query.trim();
    const matched: MatchedItem[] = [];
    for (const it of items) {
      const candidates = [it.label, it.subtitle ?? '', ...(it.keywords ?? [])];
      let best: { positions: number[]; score: number } | null = null;
      let bestSource = it.label;
      for (const c of candidates) {
        const m = fuzzyMatch(q, c);
        if (m && (best === null || m.score < best.score)) {
          best = m;
          bestSource = c;
        }
      }
      if (best) {
        const positions = bestSource === it.label ? best.positions : [];
        matched.push({ ...it, positions, score: best.score });
      }
    }
    matched.sort((a, b) => {
      const ga = GROUP_ORDER.indexOf(a.group);
      const gb = GROUP_ORDER.indexOf(b.group);
      if (ga !== gb) return ga - gb;
      return a.score - b.score;
    });
    return matched;
  }, [items, query]);

  useEffect(() => {
    if (idx >= filtered.length) setIdx(Math.max(0, filtered.length - 1));
  }, [filtered.length, idx]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [idx, open]);

  const grouped = useMemo(() => {
    const out: Record<Item['group'], MatchedItem[]> = { navigate: [], recent: [], labs: [], actions: [] };
    for (const m of filtered) out[m.group].push(m);
    if (!query.trim()) out.recent = out.recent.slice(0, 8);
    return out;
  }, [filtered, query]);

  const flatOrder = useMemo(() => {
    const flat: MatchedItem[] = [];
    for (const g of GROUP_ORDER) flat.push(...grouped[g]);
    return flat;
  }, [grouped]);

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      setIdx((i) => Math.min(flatOrder.length - 1, i + 1));
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = flatOrder[idx];
      if (chosen) {
        close();
        queueMicrotask(() => chosen.run());
      }
    }
  }

  if (!open) return <style>{CSS}</style>;

  let runningIdx = 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="cp-backdrop" onClick={close} />
      <div className="cp-wrap" role="dialog" aria-label="command palette">
        <div className="cp-panel panel ticks">
          <div className="cp-head">
            <span className="cp-prompt">
              <Search size={14} />
              <span className="cp-caret">{'>'}</span>
            </span>
            <input
              ref={inputRef}
              className="cp-input"
              placeholder="search pages, reviews, labs…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIdx(0); }}
              onKeyDown={onInputKey}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button className="cp-esc" onClick={close} aria-label="close">esc</button>
          </div>

          <div className="cp-list" ref={listRef}>
            {flatOrder.length === 0 ? (
              <div className="cp-empty">no matches — try a different word</div>
            ) : (
              GROUP_ORDER.map((g) => {
                const rows = grouped[g];
                if (rows.length === 0) return null;
                const title = g === 'recent' && query.trim() ? 'reviews' : GROUP_TITLES[g];
                return (
                  <div key={g} className="cp-group">
                    <div className="cp-group-hd">
                      {title}
                      <span className="cp-group-ct">{rows.length}</span>
                    </div>
                    {rows.map((it) => {
                      const currentIdx = runningIdx++;
                      const selected = currentIdx === idx;
                      const Icon = it.icon;
                      return (
                        <button
                          key={it.id}
                          data-idx={currentIdx}
                          className={`cp-row ${selected ? 'on' : ''}`}
                          onMouseEnter={() => setIdx(currentIdx)}
                          onClick={() => { close(); queueMicrotask(() => it.run()); }}
                        >
                          <span className="cp-row-pointer">▸</span>
                          <span className="cp-row-icon"><Icon size={14} /></span>
                          <span className="cp-row-body">
                            <span className="cp-row-label">
                              {it.positions.length > 0 ? highlight(it.label, it.positions) : it.label}
                            </span>
                            {it.subtitle ? <span className="cp-row-sub">{it.subtitle}</span> : null}
                          </span>
                          <span className="cp-row-right">
                            {it.shortcut ? <span className="cp-kbd">{it.shortcut}</span> : null}
                            {it.external ? <ArrowUpRight size={12} className="cp-ext" /> : null}
                            {it.hint ? <span className="cp-hint">{it.hint}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="cp-foot">
            <span className="cp-foot-keys">
              <span className="cp-kbd">↑↓</span> navigate
              <span className="cp-kbd">↵</span> open
              <span className="cp-kbd">esc</span> close
            </span>
            <span className="cp-foot-count">{flatOrder.length} result{flatOrder.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </div>
    </>
  );
}

export function CommandPaletteHint() {
  return (
    <button
      className="cp-hint-btn"
      onClick={() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
      }}
      title="open command palette (⌘K)"
      aria-label="open command palette"
    >
      <Command size={11} />
      <span className="cp-hint-label">k</span>
    </button>
  );
}

const CSS = `
  html.crt-off .crt,
  html.crt-off .noise { display: none !important; }

  .cp-backdrop {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 9000;
    animation: cp-fade 0.14s ease-out;
  }
  @keyframes cp-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .cp-wrap {
    position: fixed;
    top: 12vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(640px, calc(100vw - 32px));
    z-index: 9001;
    animation: cp-rise 0.18s cubic-bezier(0.2, 0.7, 0.2, 1);
  }
  @keyframes cp-rise {
    from { transform: translate(-50%, 8px); opacity: 0; }
    to { transform: translate(-50%, 0); opacity: 1; }
  }

  .cp-panel {
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border-bright);
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.8),
      0 20px 60px rgba(0, 0, 0, 0.6),
      0 0 40px color-mix(in oklch, var(--color-accent) 10%, transparent);
    display: flex;
    flex-direction: column;
    max-height: 70vh;
    min-height: 0;
    overflow: hidden;
  }

  .cp-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(to bottom, #0c0c0c, #070707);
    flex-shrink: 0;
  }
  .cp-prompt {
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }
  .cp-prompt :first-child { color: var(--color-fg-faint); }
  .cp-caret {
    color: var(--color-accent);
    text-shadow: 0 0 6px var(--accent-glow);
  }
  .cp-input {
    flex: 1;
    background: transparent;
    border: 0;
    outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
    padding: 4px 0;
  }
  .cp-input::placeholder { color: var(--color-fg-faint); }
  .cp-esc {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border);
    padding: 3px 8px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .cp-esc:hover { color: var(--color-fg); border-color: var(--color-border-bright); }

  .cp-list {
    overflow-y: auto;
    overflow-x: hidden;
    flex: 1;
    min-height: 0;
    padding: var(--sp-2) 0;
  }

  .cp-group + .cp-group { margin-top: var(--sp-2); }
  .cp-group-hd {
    display: flex; gap: 6px; align-items: baseline;
    padding: var(--sp-2) var(--sp-4) 4px;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .cp-group-ct {
    color: var(--color-fg-ghost);
    font-size: 9px;
  }

  .cp-row {
    display: grid;
    grid-template-columns: 16px 18px 1fr auto;
    align-items: center;
    gap: var(--sp-2);
    width: 100%;
    padding: 7px var(--sp-4);
    background: transparent;
    border: 0;
    border-left: 2px solid transparent;
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    text-align: left;
    cursor: pointer;
    font-size: var(--fs-sm);
    transition: background 0.08s, border-color 0.08s;
  }
  .cp-row.on {
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
    border-left-color: var(--color-accent);
    color: var(--color-fg);
  }
  .cp-row.on .cp-row-pointer { color: var(--color-accent); text-shadow: 0 0 6px var(--accent-glow); }
  .cp-row.on .cp-row-label { color: var(--color-accent); }

  .cp-row-pointer {
    color: transparent;
    font-family: var(--font-mono);
  }
  .cp-row-icon {
    color: var(--color-fg-faint);
    display: inline-flex;
  }
  .cp-row.on .cp-row-icon { color: var(--color-accent); }

  .cp-row-body {
    display: flex;
    align-items: baseline;
    gap: var(--sp-2);
    min-width: 0;
    overflow: hidden;
  }
  .cp-row-label {
    color: var(--color-fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    flex-shrink: 0;
    max-width: 200px;
  }
  .cp-hl {
    color: var(--color-accent);
    text-shadow: 0 0 6px var(--accent-glow);
  }
  .cp-row-sub {
    color: var(--color-fg-faint);
    font-size: 11px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    min-width: 0;
  }

  .cp-row-right {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-fg-faint);
    font-size: 10px;
    font-family: var(--font-mono);
    flex-shrink: 0;
  }
  .cp-hint {
    color: var(--color-fg-ghost);
    font-size: 10px;
    max-width: 180px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .cp-row.on .cp-hint { color: var(--color-fg-faint); }
  .cp-ext { color: var(--color-fg-ghost); }

  .cp-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    padding: 1px 5px;
    border: 1px solid var(--color-border-bright);
    background: var(--color-bg-raised);
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-size: 10px;
  }

  .cp-empty {
    padding: var(--sp-6) var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
  }

  .cp-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px var(--sp-4);
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    flex-shrink: 0;
  }
  .cp-foot-keys { display: inline-flex; gap: 8px; align-items: center; }
  .cp-foot-keys .cp-kbd { margin-right: 4px; }

  /* hint button in navbar */
  .cp-hint-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-transform: lowercase;
    transition: all 0.12s;
  }
  .cp-hint-btn:hover {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
  }
  .cp-hint-label {
    color: inherit;
  }

  @media (max-width: 640px) {
    .cp-wrap {
      top: 0;
      left: 0;
      right: 0;
      transform: none;
      width: 100%;
    }
    .cp-panel {
      max-height: 100vh;
      height: 100vh;
      border-left: 0; border-right: 0; border-top: 0;
    }
    .cp-row-label { max-width: 140px; }
    .cp-hint { display: none; }
    .cp-hint-btn { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .cp-backdrop, .cp-wrap { animation: none; }
  }
`;

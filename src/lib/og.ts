/**
 * Shared OG-image template. Each page ships a variant by calling `buildOgSvg`
 * with its title, subtitle, and glyph — the overall chrome (corner brackets,
 * dot grid, wordmark, url) stays consistent so the cards are recognisable.
 *
 * SVG is used because:
 *   • it's tiny (~2-3kB gzipped per image)
 *   • we can author it as plain text in-repo, no build step
 *   • common crawlers (bluesky, mastodon, discord, iMessage) render it fine
 *
 * A small fallback matters for older slack / twitter clients that reject
 * image/svg+xml — those see the domain as a plain link rather than a card.
 */

import { SITE } from '../data';

export type OgSlug =
  | 'home'
  | 'blog'
  | 'projects'
  | 'gallery'
  | 'watching'
  | 'games'
  | 'music'
  | 'labs'
  | 'uses'
  | 'design-system'
  | 'globe'
  | 'guestbook'
  | 'ai'
  // per-lab cards share a common glyph family:
  | 'lab/css-battles'
  | 'lab/verse-reveal'
  | 'lab/infinite-canvas'
  | 'lab/pdf-uploader'
  | 'lab/car-explorer'
  | 'lab/feed'
  | 'lab/screenshot-maker'
  | 'lab/list-cleaner'
  | 'lab/jetstream'
  | 'lab/plc-log'
  | 'lab/at-uri'
  | 'lab/lexicon'
  | 'lab/tid'
  | 'lab/palette'
  | 'lab/jwt'
  | 'lab/cron'
  | 'lab/og-preview'
  | 'lab/snake'
  | 'lab/life'
  | 'lab/wordle'
  | 'lab/typing';

type OgEntry = {
  title: string;
  subtitle: string;
  /** Single glyph rendered large in the top-right corner. Keep it ASCII/unicode-safe. */
  glyph: string;
  /** The path shown at the bottom-left. */
  slug: string;
};

const ENTRIES: Record<OgSlug, OgEntry> = {
  home: { title: 'luna.', subtitle: 'software engineer, london', glyph: '~', slug: '/' },
  blog: { title: 'writing.', subtitle: 'essays, devlogs, half-sentences', glyph: '¶', slug: '/blog' },
  projects: { title: 'projects.', subtitle: 'open source + experiments', glyph: '◊', slug: '/projects' },
  gallery: { title: 'gallery.', subtitle: 'photos + midjourney sessions', glyph: '▦', slug: '/gallery' },
  watching: { title: 'watching.', subtitle: 'films + tv, rated out of ten', glyph: '▶', slug: '/watching' },
  games: { title: 'games.', subtitle: 'played + reviewed via popfeed', glyph: '⌘', slug: '/games' },
  music: { title: 'music.', subtitle: 'scrobbles from last.fm', glyph: '♪', slug: '/music' },
  labs: { title: 'labs.', subtitle: 'experiments, demos, tools', glyph: '⚗', slug: '/labs' },
  uses: { title: 'uses.', subtitle: 'the full rig', glyph: '◈', slug: '/uses' },
  'design-system': { title: 'design.sys.', subtitle: 'tokens, elements, patterns', glyph: '◰', slug: '/design-system' },
  globe: { title: 'globe.', subtitle: 'places lived, visited, passed through', glyph: '◯', slug: '/globe' },
  guestbook: { title: 'guestbook.', subtitle: 'signed entries via atproto', glyph: '✒', slug: '/guestbook' },
  ai: { title: 'ai.usage.', subtitle: 'every token, every client, every dollar', glyph: '⌬', slug: '/ai' },
  'lab/css-battles': { title: 'css battles.', subtitle: 'daily prompts from cssbattle.dev', glyph: '□', slug: '/labs/css-battles' },
  'lab/verse-reveal': { title: 'verse reveal.', subtitle: 'staggered ascii text effect', glyph: 'A', slug: '/labs/verse-reveal' },
  'lab/infinite-canvas': { title: 'infinite canvas.', subtitle: 'canvas2d pan + zoom', glyph: '⊞', slug: '/labs/infinite-canvas' },
  'lab/pdf-uploader': { title: 'pdf uploader.', subtitle: 'post a pdf to your bluesky pds', glyph: '◱', slug: '/labs/pdf-uploader' },
  'lab/car-explorer': { title: 'car explorer.', subtitle: 'browse any atproto repo', glyph: '◍', slug: '/labs/car-explorer' },
  'lab/feed': { title: 'feed.', subtitle: 'any bluesky actor, read-only', glyph: '⌘', slug: '/labs/feed' },
  'lab/screenshot-maker': { title: 'screenshot maker.', subtitle: 'wrap an image in chrome', glyph: '▣', slug: '/labs/screenshot-maker' },
  'lab/list-cleaner': { title: 'list cleaner.', subtitle: 'prune dead bsky list subs', glyph: '✕', slug: '/labs/list-cleaner' },
  'lab/jetstream': { title: 'jetstream.', subtitle: 'live atproto firehose', glyph: '≡', slug: '/labs/jetstream' },
  'lab/plc-log': { title: 'plc log.', subtitle: 'did:plc operation history', glyph: '☍', slug: '/labs/plc-log' },
  'lab/at-uri': { title: 'at-uri.', subtitle: 'resolve any at:// uri', glyph: '@', slug: '/labs/at-uri' },
  'lab/lexicon': { title: 'lexicon.', subtitle: 'render any atproto schema', glyph: '⟨⟩', slug: '/labs/lexicon' },
  'lab/tid': { title: 'tid.', subtitle: 'timestamp id gen + decode', glyph: 't', slug: '/labs/tid' },
  'lab/palette': { title: 'palette.', subtitle: 'image → dominant colours', glyph: '◐', slug: '/labs/palette' },
  'lab/jwt': { title: 'jwt.', subtitle: 'decode json web tokens', glyph: '⎔', slug: '/labs/jwt' },
  'lab/cron': { title: 'cron.', subtitle: 'expression to english + fires', glyph: '◴', slug: '/labs/cron' },
  'lab/og-preview': { title: 'og preview.', subtitle: 'how your card looks in every feed', glyph: '▤', slug: '/labs/og-preview' },
  'lab/snake': { title: 'snake.', subtitle: 'arrow keys, a dot, one life', glyph: '∿', slug: '/labs/snake' },
  'lab/life': { title: 'life.', subtitle: "conway's automaton on a torus", glyph: '◫', slug: '/labs/life' },
  'lab/wordle': { title: 'wordle.', subtitle: 'one word a day, six guesses', glyph: '▦', slug: '/labs/wordle' },
  'lab/typing': { title: 'typing.', subtitle: 'wpm + accuracy, bring-your-own-keyboard', glyph: '⎇', slug: '/labs/typing' },
};

const W = 1200;
const H = 630;

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildOgSvg(input: OgSlug | OgEntry): string {
  const entry = typeof input === 'string' ? (ENTRIES[input] ?? ENTRIES.home) : input;
  const { title, subtitle, glyph, slug } = entry;

  // phosphor accent — hex equivalents of the site's oklch tokens, since
  // resvg rasterizes this server-side and its oklch support is patchy.
  const ACCENT = '#6aeaa0';
  const ACCENT_DIM = '#3f8463';
  const FG = '#e6e6e6';
  const FG_DIM = '#9a9a9a';
  const FG_FAINT = '#555555';
  const BG = '#000000';
  const BORDER = '#1a1a1a';

  const pad = 72; // outer padding from each edge — content uses the rest

  // no <filter> — resvg skips feGaussianBlur chains silently, which meant
  // the corner brackets + accent text were dropping out of the rendered png.
  // a flat, filter-free template renders identically across every surface.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace, 'JetBrains Mono', 'Courier New', monospace">
  <defs>
    <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="1" fill="${FG_FAINT}" opacity="0.3"/>
    </pattern>
  </defs>

  <!-- background -->
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <rect width="${W}" height="${H}" fill="url(#dots)"/>

  <!-- corner brackets anchored to the image corners -->
  <g stroke="${ACCENT}" stroke-width="2" fill="none">
    <path d="M ${pad - 24} ${pad} L ${pad - 24} ${pad - 24} L ${pad} ${pad - 24}"/>
    <path d="M ${W - pad} ${H - pad + 24} L ${W - pad + 24} ${H - pad + 24} L ${W - pad + 24} ${H - pad}"/>
  </g>

  <!-- wordmark (top-left) -->
  <text x="${pad}" y="${pad + 22}" fill="${FG_DIM}" font-size="24" letter-spacing="2">${escape(SITE.handle)}<tspan fill="${ACCENT}">.com</tspan></text>
  <text x="${pad}" y="${pad + 52}" fill="${FG_FAINT}" font-size="16" letter-spacing="3">~ / ${escape(slug.replace(/^\//, '') || '')}</text>

  <!-- glyph (top-right) -->
  <text x="${W - pad}" y="${pad + 92}" text-anchor="end" fill="${ACCENT}" font-size="132" opacity="0.95">${escape(glyph)}</text>

  <!-- title (center-left, full bleed) -->
  <text x="${pad}" y="${H / 2 + 48}" fill="${FG}" font-size="148" font-weight="500" letter-spacing="-3">${escape(title)}</text>

  <!-- subtitle -->
  <text x="${pad}" y="${H / 2 + 100}" fill="${FG_DIM}" font-size="32" letter-spacing="1">${escape(subtitle)}</text>

  <!-- footer strip -->
  <line x1="${pad}" y1="${H - pad - 36}" x2="${W - pad}" y2="${H - pad - 36}" stroke="${BORDER}"/>
  <text x="${pad}" y="${H - pad}" fill="${FG_FAINT}" font-size="18" letter-spacing="3">
    <tspan fill="${ACCENT_DIM}">●</tspan>
    <tspan dx="10">online</tspan>
    <tspan dx="20" fill="${FG_FAINT}">·</tspan>
    <tspan dx="20">${escape(SITE.location)}</tspan>
    <tspan dx="20" fill="${FG_FAINT}">·</tspan>
    <tspan dx="20">${escape(SITE.tz.toLowerCase())}</tspan>
  </text>
  <text x="${W - pad}" y="${H - pad}" text-anchor="end" fill="${FG_FAINT}" font-size="18" letter-spacing="3">${escape(SITE.domain)}</text>
</svg>`;
}

export function ogEntries(): (readonly [OgSlug, OgEntry])[] {
  return Object.entries(ENTRIES) as (readonly [OgSlug, OgEntry])[];
}

export function ogEntry(slug: OgSlug): OgEntry {
  return ENTRIES[slug] ?? ENTRIES.home;
}

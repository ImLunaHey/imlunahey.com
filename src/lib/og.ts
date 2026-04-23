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
  | 'bookmarks'
  | 'library'
  | 'homelab'
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
  | 'lab/typing'
  // 2026 additions
  | 'lab/bsky-composer'
  | 'lab/fingerprint'
  | 'lab/whois'
  | 'lab/ids'
  | 'lab/unicode'
  | 'lab/handle-sniper'
  | 'lab/did-log'
  | 'lab/thread-tree'
  | 'lab/pds-health'
  | 'lab/regex'
  | 'lab/encode'
  | 'lab/diff'
  | 'lab/lexicon-validator'
  | 'lab/firehose-stats'
  | 'lab/dns'
  | 'lab/json'
  | 'lab/colour'
  | 'lab/timestamp'
  | 'lab/matrix'
  | 'lab/terminal'
  | 'lab/hash'
  | 'lab/case'
  | 'lab/password'
  | 'lab/hex-dump'
  | 'lab/ua'
  | 'lab/http-status'
  | 'lab/curl'
  | 'lab/csv'
  | 'lab/subnet'
  | 'lab/http-headers'
  | 'lab/certs'
  | 'lab/schema'
  | 'lab/dist'
  | 'lab/exif'
  | 'lab/spectrogram'
  | 'lab/png-chunks'
  | 'lab/ascii'
  | 'lab/units'
  | 'lab/browser'
  | 'lab/iss'
  | 'lab/lightning'
  | 'lab/periodic'
  | 'lab/tfl-status'
  | 'lab/tfl-cycles'
  | 'lab/tfl-arrivals'
  | 'lab/tfl-air'
  | 'lab/tfl-roads'
  | 'lab/tfl-tube-map'
  | 'lab/crime'
  | 'lab/mp'
  | 'lab/hygiene'
  | 'lab/year-in-review';

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
  bookmarks: { title: 'bookmarks.', subtitle: 'articles, talks, papers worth keeping', glyph: '❖', slug: '/bookmarks' },
  library: { title: 'library.', subtitle: 'physical media shelf', glyph: '▥', slug: '/library' },
  homelab: { title: 'homelab.', subtitle: 'rack, services, uptime', glyph: '⌸', slug: '/homelab' },
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
  'lab/bsky-composer': { title: 'bsky composer.', subtitle: 'draft a post with a live link-card preview', glyph: '✎', slug: '/labs/bsky-composer' },
  'lab/fingerprint': { title: 'fingerprint.', subtitle: 'everything your browser silently tells every site', glyph: '✾', slug: '/labs/fingerprint' },
  'lab/whois': { title: 'whois.', subtitle: 'rdap domain lookup — registrar, expiry, nameservers', glyph: '?', slug: '/labs/whois' },
  'lab/ids': { title: 'ids.', subtitle: 'generate + inspect uuid / ulid / tid / snowflake', glyph: '#', slug: '/labs/ids' },
  'lab/unicode': { title: 'unicode.', subtitle: 'graphemes, codepoints, normalization forms', glyph: 'U', slug: '/labs/unicode' },
  'lab/handle-sniper': { title: 'handle sniper.', subtitle: 'check bluesky handle availability everywhere', glyph: '⌖', slug: '/labs/handle-sniper' },
  'lab/did-log': { title: 'did log.', subtitle: 'atproto identity history — handles, pds, keys', glyph: '⊗', slug: '/labs/did-log' },
  'lab/thread-tree': { title: 'thread tree.', subtitle: 'bluesky conversation as an indented tree', glyph: '⌥', slug: '/labs/thread-tree' },
  'lab/pds-health': { title: 'pds health.', subtitle: 'probe any atproto pds for health + metadata', glyph: '◉', slug: '/labs/pds-health' },
  'lab/regex': { title: 'regex.', subtitle: 'live tester with matches + capture groups', glyph: '*', slug: '/labs/regex' },
  'lab/encode': { title: 'encode.', subtitle: 'base64 / url / html / hex / binary / rot13', glyph: '↔', slug: '/labs/encode' },
  'lab/diff': { title: 'diff.', subtitle: 'line-level diff — split + unified, lcs-based', glyph: '≠', slug: '/labs/diff' },
  'lab/lexicon-validator': { title: 'lexicon validator.', subtitle: 'validate any atproto record against its schema', glyph: '✓', slug: '/labs/lexicon-validator' },
  'lab/firehose-stats': { title: 'firehose stats.', subtitle: 'live aggregate of the bluesky jetstream', glyph: 'Σ', slug: '/labs/firehose-stats' },
  'lab/dns': { title: 'dns.', subtitle: 'doh lookup for every common record type', glyph: 'Δ', slug: '/labs/dns' },
  'lab/json': { title: 'json.', subtitle: 'collapsible tree viewer with jsonpath copier', glyph: '⟦⟧', slug: '/labs/json' },
  'lab/colour': { title: 'colour.', subtitle: 'hex / rgb / hsl / oklch with wcag contrast', glyph: '◑', slug: '/labs/colour' },
  'lab/timestamp': { title: 'timestamp.', subtitle: 'unix / iso / rfc + 8 timezones, live', glyph: '◷', slug: '/labs/timestamp' },
  'lab/matrix': { title: 'matrix.', subtitle: 'falling-kana canvas screensaver', glyph: '▚', slug: '/labs/matrix' },
  'lab/terminal': { title: 'terminal.', subtitle: 'a fake shell for the whole site', glyph: '$', slug: '/labs/terminal' },
  'lab/hash': { title: 'hash.', subtitle: 'md5 + sha-1/256/384/512 of any text', glyph: '⨀', slug: '/labs/hash' },
  'lab/case': { title: 'case.', subtitle: 'every case style at once — camel, snake, kebab', glyph: 'Aa', slug: '/labs/case' },
  'lab/password': { title: 'password.', subtitle: 'generator with live entropy meter', glyph: '⎈', slug: '/labs/password' },
  'lab/hex-dump': { title: 'hex dump.', subtitle: 'xxd-style hex + ascii of any bytes', glyph: '☰', slug: '/labs/hex-dump' },
  'lab/ua': { title: 'ua.', subtitle: 'user-agent parser — browser / engine / os', glyph: '◎', slug: '/labs/ua' },
  'lab/http-status': { title: 'http status.', subtitle: 'every code with descriptions + common causes', glyph: '⬢', slug: '/labs/http-status' },
  'lab/curl': { title: 'curl → fetch.', subtitle: 'paste curl, get fetch() + axios', glyph: '↯', slug: '/labs/curl' },
  'lab/csv': { title: 'csv.', subtitle: 'csv ↔ json with quoted fields + preview', glyph: '⊟', slug: '/labs/csv' },
  'lab/subnet': { title: 'subnet.', subtitle: 'cidr calculator with bitwise breakdown', glyph: '⊜', slug: '/labs/subnet' },
  'lab/http-headers': { title: 'http headers.', subtitle: 'fetch any url, see redirect chain + headers', glyph: '⎘', slug: '/labs/http-headers' },
  'lab/certs': { title: 'certs.', subtitle: 'tls cert history from ct logs', glyph: '⌇', slug: '/labs/certs' },
  'lab/schema': { title: 'schema.', subtitle: 'infer a json schema from sample data', glyph: '◇', slug: '/labs/schema' },
  'lab/dist': { title: 'distribution.', subtitle: 'histogram + kde + q-q plot + outlier hunt', glyph: '▂▅▇', slug: '/labs/dist' },
  'lab/exif': { title: 'exif.', subtitle: 'drop a jpeg / png — see + strip every metadata tag', glyph: '◱', slug: '/labs/exif' },
  'lab/spectrogram': { title: 'spectrogram.', subtitle: 'webaudio fft · log-frequency, inferno colormap', glyph: '♪', slug: '/labs/spectrogram' },
  'lab/png-chunks': { title: 'png chunks.', subtitle: 'every chunk the file is built from, crc-validated', glyph: '▱', slug: '/labs/png-chunks' },
  'lab/ascii': { title: 'ascii.', subtitle: 'photo → ascii with rec.709 luma + your pick of 6 ramps', glyph: '◪', slug: '/labs/ascii' },
  'lab/units': { title: 'units.', subtitle: 'dimensional-analysis calculator — track units through arithmetic', glyph: '≈', slug: '/labs/units' },
  'lab/browser': { title: 'browser.', subtitle: 'every web api this tab can run, live-detected', glyph: '◈', slug: '/labs/browser' },
  'lab/iss': { title: 'iss.', subtitle: 'international space station · live position, 5s refresh', glyph: '✦', slug: '/labs/iss' },
  'lab/lightning': { title: 'lightning.', subtitle: 'global storm-risk map · cape + lpi from open-meteo', glyph: '⚡', slug: '/labs/lightning' },
  'lab/periodic': { title: 'periodic.', subtitle: '118 elements · category, mass, config, discovery year', glyph: '⚛', slug: '/labs/periodic' },
  'lab/tfl-status': { title: 'tfl status.', subtitle: 'live tube / dlr / overground / elizabeth line service', glyph: '◉', slug: '/labs/tfl-status' },
  'lab/tfl-cycles': { title: 'cycles.', subtitle: 'every santander cycles dock on a live london map', glyph: '⚙', slug: '/labs/tfl-cycles' },
  'lab/tfl-arrivals': { title: 'arrivals.', subtitle: 'live next-train board for any london station', glyph: '→', slug: '/labs/tfl-arrivals' },
  'lab/tfl-air': { title: 'air.', subtitle: 'london air quality · now + 24h forecast', glyph: '☁', slug: '/labs/tfl-air' },
  'lab/tfl-roads': { title: 'roads.', subtitle: 'every active tfl road disruption, severity-mapped', glyph: '◊', slug: '/labs/tfl-roads' },
  'lab/tfl-tube-map': { title: 'tube map.', subtitle: 'every station on every line, live-disruption overlay', glyph: '⎯', slug: '/labs/tfl-tube-map' },
  'lab/crime': { title: 'crime.', subtitle: 'every reported street crime within 1 mile of any uk postcode', glyph: '⌖', slug: '/labs/crime' },
  'lab/mp': { title: 'mp.', subtitle: 'postcode → your mp → their recent commons votes', glyph: '⚖', slug: '/labs/mp' },
  'lab/hygiene': { title: 'hygiene.', subtitle: 'food standards rating for any uk eatery', glyph: '✓', slug: '/labs/hygiene' },
  'lab/year-in-review': { title: 'year in review.', subtitle: 'bluesky wrapped from any account\'s car file', glyph: '★', slug: '/labs/year-in-review' },
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

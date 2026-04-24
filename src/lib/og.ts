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
  | 'lab/sudoku'
  | 'lab/mahjong'
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
  | 'lab/crypto'
  | 'lab/bsky-cards'
  | 'lab/whtwnd'
  | 'lab/backlinks'
  | 'lab/top-posts'
  | 'lab/list-memberships'
  | 'lab/engagement-timeline'
  | 'lab/labels'
  | 'lab/quote-tree'
  | 'lab/reply-ratio'
  | 'lab/top-domains'
  | 'lab/year-in-review'
  | 'lab/met-museum'
  | 'lab/poetry'
  | 'lab/scryfall'
  | 'lab/xkcd'
  | 'lab/aic'
  | 'lab/open-library'
  | 'lab/tvmaze'
  | 'lab/f1'
  | 'lab/mastodon'
  | 'lab/media-inspector'
  | 'lab/frame-extractor'
  | 'lab/audio-extractor'
  | 'lab/clipper'
  | 'lab/converter'
  | 'lab/twitch-live';

type OgEntry = {
  title: string;
  /** Visual subtitle on the OG card. Kept short so the SVG text
   *  doesn't overflow; Google wants ~150-160 chars for meta
   *  description, so use `description` below for longer-form copy. */
  subtitle: string;
  /** Optional longer description (~150 chars) for <meta name="description">
   *  and og:description. Falls back to `subtitle` if omitted. Search
   *  engines ignore pages with too-short descriptions, so fill this on
   *  any page you actually want ranking. */
  description?: string;
  /** Single glyph rendered large in the top-right corner. Keep it ASCII/unicode-safe. */
  glyph: string;
  /** The path shown at the bottom-left. */
  slug: string;
};

const ENTRIES: Record<OgSlug, OgEntry> = {
  home: { title: 'luna.', subtitle: 'software engineer, london', description: "luna · software engineer in london building on the atproto / bluesky stack. writing, open-source projects, and ~80 small interactive labs in one place.", glyph: '~', slug: '/' },
  blog: { title: 'writing.', subtitle: 'essays, devlogs, half-sentences', description: 'essays, devlogs, and half-finished notes on software engineering, the atproto ecosystem, web performance, and whatever else has my attention this week.', glyph: '¶', slug: '/blog' },
  projects: { title: 'projects.', subtitle: 'open source + experiments', description: 'open-source projects, libraries, and experiments — spanning atproto tooling, react components, canvas demos, and small command-line utilities.', glyph: '◊', slug: '/projects' },
  gallery: { title: 'gallery.', subtitle: 'photos + midjourney sessions', description: 'photography from around london and further afield, plus ongoing midjourney / stable-diffusion sessions and generative-art experiments.', glyph: '▦', slug: '/gallery' },
  watching: { title: 'watching.', subtitle: 'films + tv, rated out of ten', description: 'films and tv shows i actually finished, each with a short review and a score out of ten. queried live from my popfeed watch history.', glyph: '▶', slug: '/watching' },
  games: { title: 'games.', subtitle: 'played + reviewed via popfeed', description: 'video games i finished (or gave up on), each with a short review and score. pulled live from my popfeed library so the list stays current.', glyph: '⌘', slug: '/games' },
  music: { title: 'music.', subtitle: 'scrobbles from last.fm', description: 'recent listening habits pulled from last.fm — top artists, recent tracks, and what happens to be playing right now. updates roughly daily.', glyph: '♪', slug: '/music' },
  labs: { title: 'labs.', subtitle: 'experiments, demos, tools', description: '80+ small interactive labs — atproto tools, dev utilities, data explorers on uk open-gov / twitch / mastodon firehoses, media converters, and games.', glyph: '⚗', slug: '/labs' },
  uses: { title: 'uses.', subtitle: 'the full rig', description: 'hardware, software, and day-to-day tools i actually use — full rig breakdown covering the mac, keyboard, terminal, editor, browser, and home-lab setup.', glyph: '◈', slug: '/uses' },
  'design-system': { title: 'design.sys.', subtitle: 'tokens, elements, patterns', description: 'the crt/phosphor design system this site is built on — colour tokens, typography, spacing, form elements, and shared interaction patterns.', glyph: '◰', slug: '/design-system' },
  bookmarks: { title: 'bookmarks.', subtitle: 'articles, talks, papers worth keeping', description: 'articles, talks, and papers worth returning to — mostly software engineering, computer science, design, typography, and the occasional physics paper.', glyph: '❖', slug: '/bookmarks' },
  library: { title: 'library.', subtitle: 'physical media shelf', description: 'the physical media shelf — books, dvds, vinyl, and anything else worth keeping on a shelf. each entry links out to where you can find a copy.', glyph: '▥', slug: '/library' },
  homelab: { title: 'homelab.', subtitle: 'rack, services, uptime', description: 'homelab rack contents, running services, and live uptime stats. covers the mini-pc cluster, nas, self-hosted apps, and networking setup.', glyph: '⌸', slug: '/homelab' },
  globe: { title: 'globe.', subtitle: 'places lived, visited, passed through', description: 'places i have lived, visited, or passed through, rendered on an interactive 3d globe. pan, zoom, and click any city for a short note.', glyph: '◯', slug: '/globe' },
  guestbook: { title: 'guestbook.', subtitle: 'signed entries via atproto', description: 'the guestbook — sign in with your atproto / bluesky identity and leave a message on your own pds. entries are cryptographically signed and portable.', glyph: '✒', slug: '/guestbook' },
  ai: { title: 'ai.usage.', subtitle: 'every token, every client, every dollar', description: 'every ai token i used — across claude, chatgpt, gemini, and local models — with per-client, per-day cost breakdowns and a rolling spend total.', glyph: '⌬', slug: '/ai' },
  'lab/css-battles': { title: 'css battles.', subtitle: 'daily prompts from cssbattle.dev', description: 'my solutions to cssbattle.dev daily prompts — every entry is pure css + divs, no assets. hand-crafted shapes, gradients, and tricky selectors.', glyph: '□', slug: '/labs/css-battles' },
  'lab/verse-reveal': { title: 'verse reveal.', subtitle: 'staggered ascii text effect', description: 'ascii-scrub reveal animation — each letter cycles through random characters before landing on its final glyph. pure react, staggered by index.', glyph: 'A', slug: '/labs/verse-reveal' },
  'lab/infinite-canvas': { title: 'infinite canvas.', subtitle: 'canvas2d pan + zoom', description: 'pan + zoom canvas with spatial-hash culling and offscreen caching. 400 synthetic nodes rendered smoothly on a drag-scrollable canvas2d surface.', glyph: '⊞', slug: '/labs/infinite-canvas' },
  'lab/pdf-uploader': { title: 'pdf uploader.', subtitle: 'post a pdf to your bluesky pds', description: 'upload a pdf to your bluesky pds as a com.imlunahey.pdf record. client-side cid dedupe, backlinks from constellation, per-pdf preview + share url.', glyph: '◱', slug: '/labs/pdf-uploader' },
  'lab/car-explorer': { title: 'car explorer.', subtitle: 'browse any atproto repo', description: 'browse any atproto repo — resolve a handle to a did, download the car file, group records by collection, and inspect each one with syntax highlighting.', glyph: '◍', slug: '/labs/car-explorer' },
  'lab/feed': { title: 'feed.', subtitle: 'any bluesky actor, read-only', description: 'read-only bluesky feed viewer for any actor via the public appview — pins, reposts, images, replies, infinite scroll. no auth required.', glyph: '⌘', slug: '/labs/feed' },
  'lab/screenshot-maker': { title: 'screenshot maker.', subtitle: 'wrap an image in chrome', description: 'wrap any image in a styled background, shadow, frame, pattern, or text — all configurable live. pure canvas2d rendering, downloadable as png.', glyph: '▣', slug: '/labs/screenshot-maker' },
  'lab/list-cleaner': { title: 'list cleaner.', subtitle: 'prune dead bsky list subs', description: 'prune dead bluesky list subscriptions — find every list you subscribe to whose list or author no longer exists, then bulk-delete via oauth.', glyph: '✕', slug: '/labs/list-cleaner' },
  'lab/jetstream': { title: 'jetstream.', subtitle: 'live atproto firehose', description: 'live atproto firehose — every commit, identity, and account event on the network streamed with sub-second latency, filterable by nsid + wildcards.', glyph: '≡', slug: '/labs/jetstream' },
  'lab/plc-log': { title: 'plc log.', subtitle: 'did:plc operation history', description: 'every did:plc operation for any identity — handle changes, pds migrations, key rotations — as an audited timeline with per-op diffs.', glyph: '☍', slug: '/labs/plc-log' },
  'lab/at-uri': { title: 'at-uri.', subtitle: 'resolve any at:// uri', description: 'paste any at:// uri — profile, post, list, feed, labeler, or custom record — and see it resolved, type-inferred, and cross-linked to related views.', glyph: '@', slug: '/labs/at-uri' },
  'lab/lexicon': { title: 'lexicon.', subtitle: 'render any atproto schema', description: 'render any atproto lexicon schema nicely — type definitions, refs, constraints, and example records. loads directly from the lexicon repo.', glyph: '⟨⟩', slug: '/labs/lexicon' },
  'lab/tid': { title: 'tid.', subtitle: 'timestamp id gen + decode', description: 'atproto tid converter — generate a new tid at any timestamp, decode an existing tid back to its microsecond timestamp + clock id.', glyph: 't', slug: '/labs/tid' },
  'lab/palette': { title: 'palette.', subtitle: 'image → dominant colours', description: 'extract a dominant-colour palette from any image — median-cut quantisation in-browser, with hex codes, hsl breakdown, and swatch preview.', glyph: '◐', slug: '/labs/palette' },
  'lab/jwt': { title: 'jwt.', subtitle: 'decode json web tokens', description: 'decode and inspect json web tokens — header, payload, signature, claim expiry, and algorithm. paste any jwt, see every field parsed live.', glyph: '⎔', slug: '/labs/jwt' },
  'lab/cron': { title: 'cron.', subtitle: 'expression to english + fires', description: 'cron expression helper — translate any crontab line to plain english, preview the next five firings, and validate syntax with inline errors.', glyph: '◴', slug: '/labs/cron' },
  'lab/og-preview': { title: 'og preview.', subtitle: 'how your card looks in every feed', description: 'paste any url, see how its og card renders across bluesky, twitter/x, mastodon, discord, slack, imessage, and telegram — side-by-side.', glyph: '▤', slug: '/labs/og-preview' },
  'lab/snake': { title: 'snake.', subtitle: 'arrow keys, a dot, one life', description: 'snake, the classic — arrow keys or wasd, one green dot on a 24×16 grid, one life. paused by default so you can focus the canvas first.', glyph: '∿', slug: '/labs/snake' },
  'lab/life': { title: 'life.', subtitle: "conway's automaton on a torus", description: "conway's game of life on a 60×40 torus. click to paint, space to play, pre-seeded with glider, pulsar, and gosper glider gun patterns.", glyph: '◫', slug: '/labs/life' },
  'lab/wordle': { title: 'wordle.', subtitle: 'one word a day, six guesses', description: 'five-letter word, six guesses, one puzzle a day — seeded from the date so everyone gets the same word. leaderboard via atproto identity.', glyph: '▦', slug: '/labs/wordle' },
  'lab/typing': { title: 'typing.', subtitle: 'wpm + accuracy, bring-your-own-keyboard', description: 'short timed typing test — 15, 30, or 60 seconds. wpm, accuracy, and error rate tracked live. best scores persisted locally per device.', glyph: '⎇', slug: '/labs/typing' },
  'lab/sudoku': { title: 'sudoku.', subtitle: 'classic 9×9, four difficulties, generated client-side', description: 'classic 9×9 sudoku — easy, medium, hard, expert — generated client-side with a unique-solution check. notes mode, hints, autosaved progress per device.', glyph: '⊞', slug: '/labs/sudoku' },
  'lab/mahjong': { title: 'mahjong.', subtitle: '144 hand-drawn svg tiles, three custom shapes', description: 'mahjong solitaire — 144 hand-rendered svg tiles, three layouts (pyramid, wide, tower). every deal is solvable, layouts are baked into a single shareable seed so you can race a friend on the exact same deal.', glyph: '⌖', slug: '/labs/mahjong' },
  'lab/bsky-composer': { title: 'bsky composer.', subtitle: 'draft a post with a live link-card preview', description: 'draft a bluesky post with a live link-card preview — paste any url, see the exact og card that will be embedded before you publish.', glyph: '✎', slug: '/labs/bsky-composer' },
  'lab/fingerprint': { title: 'fingerprint.', subtitle: 'everything your browser silently tells every site', description: 'everything your browser silently tells every site you visit — user agent, screen, canvas, webgl, audio, font, timezone, and network fingerprints.', glyph: '✾', slug: '/labs/fingerprint' },
  'lab/whois': { title: 'whois.', subtitle: 'rdap domain lookup — registrar, expiry, nameservers', description: 'rdap domain lookup — paste any domain, see registrar, registration + expiry dates, nameservers, dnssec, and contact records from the registry.', glyph: '?', slug: '/labs/whois' },
  'lab/ids': { title: 'ids.', subtitle: 'generate + inspect uuid / ulid / tid / snowflake', description: 'generate and inspect every common id format — uuid v4/v7, ulid, atproto tid, twitter snowflake, nanoid. decode any id back to its timestamp.', glyph: '#', slug: '/labs/ids' },
  'lab/unicode': { title: 'unicode.', subtitle: 'graphemes, codepoints, normalization forms', description: 'paste any unicode string — see grapheme segmentation, per-codepoint labels, utf-8 byte counts, and every nfc/nfd/nfkc/nfkd normalization form.', glyph: 'U', slug: '/labs/unicode' },
  'lab/handle-sniper': { title: 'handle sniper.', subtitle: 'check bluesky handle availability everywhere', description: 'check bluesky handle availability across every major pds + custom domains simultaneously — find free handles before anyone else claims them.', glyph: '⌖', slug: '/labs/handle-sniper' },
  'lab/did-log': { title: 'did log.', subtitle: 'atproto identity history — handles, pds, keys', description: 'full atproto identity history for any did — every handle change, pds migration, rotation key, and signing key update, in chronological order.', glyph: '⊗', slug: '/labs/did-log' },
  'lab/thread-tree': { title: 'thread tree.', subtitle: 'bluesky conversation as an indented tree', description: 'paste any bluesky post — render the entire conversation as an indented thread tree with collapse toggles and per-reply engagement counts.', glyph: '⌥', slug: '/labs/thread-tree' },
  'lab/pds-health': { title: 'pds health.', subtitle: 'probe any atproto pds for health + metadata', description: 'probe any atproto personal data server — /xrpc health, version, describeServer metadata, did doc, response time, and cert expiry at a glance.', glyph: '◉', slug: '/labs/pds-health' },
  'lab/regex': { title: 'regex.', subtitle: 'live tester with matches + capture groups', description: 'live regular-expression tester — highlighted matches, capture-group extraction, replacement preview, and flag toggles. pattern persists in the url.', glyph: '*', slug: '/labs/regex' },
  'lab/encode': { title: 'encode.', subtitle: 'base64 / url / html / hex / binary / rot13', description: 'paste any text, see every common encoding side-by-side — base64, url-encode, html entities, hex, binary, rot13, and utf-8 byte breakdown.', glyph: '↔', slug: '/labs/encode' },
  'lab/diff': { title: 'diff.', subtitle: 'line-level diff — split + unified, lcs-based', description: 'line-level text diff with both split and unified views, powered by an lcs algorithm. syntax-highlighted output, copy-ready unified patch format.', glyph: '≠', slug: '/labs/diff' },
  'lab/lexicon-validator': { title: 'lexicon validator.', subtitle: 'validate any atproto record against its schema', description: 'validate any atproto record against its lexicon schema — paste json, see per-field errors, unknown-property warnings, and ref-resolution failures.', glyph: '✓', slug: '/labs/lexicon-validator' },
  'lab/firehose-stats': { title: 'firehose stats.', subtitle: 'live aggregate of the bluesky jetstream', description: 'live aggregate stats from the bluesky jetstream — posts/sec, top collections, top did methods, rolling windows. pure-browser websocket client.', glyph: 'Σ', slug: '/labs/firehose-stats' },
  'lab/dns': { title: 'dns.', subtitle: 'doh lookup for every common record type', description: 'dns-over-https lookup for any domain — resolves a, aaaa, mx, txt, ns, cname, soa, caa, srv, and dnskey records in parallel via cloudflare-dns.', glyph: 'Δ', slug: '/labs/dns' },
  'lab/json': { title: 'json.', subtitle: 'collapsible tree viewer with jsonpath copier', description: 'paste json, get a collapsible tree view — per-node types, array counts, copy-as-jsonpath on any node. handles deeply-nested structures smoothly.', glyph: '⟦⟧', slug: '/labs/json' },
  'lab/colour': { title: 'colour.', subtitle: 'hex / rgb / hsl / oklch with wcag contrast', description: 'pick any colour — see hex, rgb, hsl, and oklch values side-by-side, plus wcag contrast ratios against white, black, and your own background choice.', glyph: '◑', slug: '/labs/colour' },
  'lab/timestamp': { title: 'timestamp.', subtitle: 'unix / iso / rfc + 8 timezones, live', description: 'paste any timestamp — unix seconds, unix millis, iso 8601, or rfc 2822 — see it converted to every format in eight timezones simultaneously.', glyph: '◷', slug: '/labs/timestamp' },
  'lab/matrix': { title: 'matrix.', subtitle: 'falling-kana canvas screensaver', description: "the matrix-movie falling-kana effect, faithfully reproduced as a canvas2d screensaver. half-width katakana rain, adjustable density + speed.", glyph: '▚', slug: '/labs/matrix' },
  'lab/terminal': { title: 'terminal.', subtitle: 'a fake shell for the whole site', description: 'a fake unix shell for the whole site — ls lists pages, cd navigates, cat dumps blog posts, whoami is you. easter eggs rewarded.', glyph: '$', slug: '/labs/terminal' },
  'lab/hash': { title: 'hash.', subtitle: 'md5 + sha-1/256/384/512 of any text', description: 'cryptographic hashes of any text input — md5, sha-1, sha-256, sha-384, sha-512 computed via webcrypto. also displays byte + hex length per output.', glyph: '⨀', slug: '/labs/hash' },
  'lab/case': { title: 'case.', subtitle: 'every case style at once — camel, snake, kebab', description: 'paste any identifier — see camelcase, pascalcase, snake_case, kebab-case, screaming_snake, title case, and sentence case rendered side by side.', glyph: 'Aa', slug: '/labs/case' },
  'lab/password': { title: 'password.', subtitle: 'generator with live entropy meter', description: 'password generator with live entropy meter (shannon bits), configurable length and character classes, plus an estimate of offline-cracking cost.', glyph: '⎈', slug: '/labs/password' },
  'lab/hex-dump': { title: 'hex dump.', subtitle: 'xxd-style hex + ascii of any bytes', description: 'drop any file — get an xxd-style hex + ascii dump with byte-level offsets. useful for inspecting headers, magic numbers, and binary payloads.', glyph: '☰', slug: '/labs/hex-dump' },
  'lab/ua': { title: 'ua.', subtitle: 'user-agent parser — browser / engine / os', description: 'user-agent parser — paste any ua string and see the browser, engine, os, device, and cpu architecture it claims to be, plus full match breakdown.', glyph: '◎', slug: '/labs/ua' },
  'lab/http-status': { title: 'http status.', subtitle: 'every code with descriptions + common causes', description: 'every http status code in one place — rfc spec descriptions, common causes, suggested response headers, and famous real-world examples per code.', glyph: '⬢', slug: '/labs/http-status' },
  'lab/curl': { title: 'curl → fetch.', subtitle: 'paste curl, get fetch() + axios', description: 'paste any curl command — get equivalent javascript fetch() and axios call snippets, with headers, body, method, and auth preserved faithfully.', glyph: '↯', slug: '/labs/curl' },
  'lab/csv': { title: 'csv.', subtitle: 'csv ↔ json with quoted fields + preview', description: 'convert between csv and json bidirectionally — handles quoted fields, embedded commas, custom delimiters, and shows a live spreadsheet preview.', glyph: '⊟', slug: '/labs/csv' },
  'lab/subnet': { title: 'subnet.', subtitle: 'cidr calculator with bitwise breakdown', description: 'cidr subnet calculator — enter any ipv4/ipv6 block, see network, broadcast, host range, usable count, and a full bit-by-bit visual breakdown.', glyph: '⊜', slug: '/labs/subnet' },
  'lab/http-headers': { title: 'http headers.', subtitle: 'fetch any url, see redirect chain + headers', description: 'fetch any url and see the full redirect chain plus every response header at each hop — useful for debugging cache, security, and cdn policies.', glyph: '⎘', slug: '/labs/http-headers' },
  'lab/certs': { title: 'certs.', subtitle: 'tls cert history from ct logs', description: 'full tls certificate history for any domain from certificate-transparency logs — every issued cert, issuer, sans, validity window, and status.', glyph: '⌇', slug: '/labs/certs' },
  'lab/schema': { title: 'schema.', subtitle: 'infer a json schema from sample data', description: 'paste sample json — infer a strict json schema (draft 2020-12) with required fields, type unions, enums, and format detection for dates + urls.', glyph: '◇', slug: '/labs/schema' },
  'lab/dist': { title: 'distribution.', subtitle: 'histogram + kde + q-q plot + outlier hunt', description: 'paste numeric data — get a histogram, kernel density estimate, q-q plot against normal, and outlier detection via iqr and z-score simultaneously.', glyph: '▂▅▇', slug: '/labs/dist' },
  'lab/exif': { title: 'exif.', subtitle: 'drop a jpeg / png — see + strip every metadata tag', description: 'drop any jpeg or png — see every exif, xmp, iptc metadata tag present (gps, camera, lens, dates) and strip them all with a single click.', glyph: '◱', slug: '/labs/exif' },
  'lab/spectrogram': { title: 'spectrogram.', subtitle: 'webaudio fft · log-frequency, inferno colormap', description: 'real-time audio spectrogram via webaudio fft — log-frequency y-axis, inferno colormap, adjustable window size. works on mic input or file playback.', glyph: '♪', slug: '/labs/spectrogram' },
  'lab/png-chunks': { title: 'png chunks.', subtitle: 'every chunk the file is built from, crc-validated', description: 'drop any png — see every chunk (ihdr, plte, idat, text, iend, etc.), its length, crc validation result, and a hex dump of the raw chunk payload.', glyph: '▱', slug: '/labs/png-chunks' },
  'lab/ascii': { title: 'ascii.', subtitle: 'photo → ascii with rec.709 luma + your pick of 6 ramps', description: 'convert any photo to ascii art — rec.709 luma conversion, six selectable character ramps, configurable density. copyable + downloadable output.', glyph: '◪', slug: '/labs/ascii' },
  'lab/units': { title: 'units.', subtitle: 'dimensional-analysis calculator — track units through arithmetic', description: 'dimensional-analysis calculator — tracks units through any arithmetic expression. supports si, imperial, customary; catches dimension errors live.', glyph: '≈', slug: '/labs/units' },
  'lab/browser': { title: 'browser.', subtitle: 'every web api this tab can run, live-detected', description: 'every browser web api detected live in your current tab — webgpu, webauthn, webcodecs, webxr, storage, sensors, and ~120 others. permission-aware.', glyph: '◈', slug: '/labs/browser' },
  'lab/iss': { title: 'iss.', subtitle: 'international space station · live position, 5s refresh', description: 'live position of the international space station on a world map — tle-derived coordinates from wheretheiss.at, refreshed every five seconds.', glyph: '✦', slug: '/labs/iss' },
  'lab/lightning': { title: 'lightning.', subtitle: 'global storm-risk map · cape + lpi from open-meteo', description: 'global lightning-strike risk map — cape + lifted-index from open-meteo, rendered as a colour overlay on a world basemap. updates every ten minutes.', glyph: '⚡', slug: '/labs/lightning' },
  'lab/periodic': { title: 'periodic.', subtitle: '118 elements · category, mass, config, discovery year', description: 'full periodic table — 118 elements with category colouring, atomic mass, electron configuration, discovery year, and discoverer for each.', glyph: '⚛', slug: '/labs/periodic' },
  'lab/tfl-status': { title: 'tfl status.', subtitle: 'live tube / dlr / overground / elizabeth line service', description: 'live london tfl service status — every tube line, dlr, overground, elizabeth line, and tram. delays, part-suspensions, planned works in real time.', glyph: '◉', slug: '/labs/tfl-status' },
  'lab/tfl-cycles': { title: 'cycles.', subtitle: 'every santander cycles dock on a live london map', description: 'every santander cycles dock in london, live on a pan-zoomable map — bike and dock availability updated every minute via the tfl cycle hire api.', glyph: '⚙', slug: '/labs/tfl-cycles' },
  'lab/tfl-arrivals': { title: 'arrivals.', subtitle: 'live next-train board for any london station', description: 'live next-train departure board for any london tube, dlr, overground, or elizabeth line station. destinations, platforms, expected arrival time.', glyph: '→', slug: '/labs/tfl-arrivals' },
  'lab/tfl-air': { title: 'air.', subtitle: 'london air quality · now + 24h forecast', description: 'london air quality — current no2, pm10, pm2.5, so2, ozone, plus a 24h forecast band. sourced from the tfl air-quality api, updated hourly.', glyph: '☁', slug: '/labs/tfl-air' },
  'lab/tfl-roads': { title: 'roads.', subtitle: 'every active tfl road disruption, severity-mapped', description: 'every active road disruption on the tfl road network, plotted on a london map and colour-coded by severity. updates every minute.', glyph: '◊', slug: '/labs/tfl-roads' },
  'lab/tfl-tube-map': { title: 'tube map.', subtitle: 'every station on every line, live-disruption overlay', description: 'every london underground station on every line, pan-zoomable, with live disruption highlights overlaid from the tfl status api in real time.', glyph: '⎯', slug: '/labs/tfl-tube-map' },
  'lab/crime': { title: 'crime.', subtitle: 'every reported street crime within 1 mile of any uk postcode', description: 'every reported street crime within one mile of any uk postcode — from police.uk open data. categories, streets, outcomes, plotted on a map.', glyph: '⌖', slug: '/labs/crime' },
  'lab/mp': { title: 'mp.', subtitle: 'postcode → your mp → their recent commons votes', description: 'enter a uk postcode → find your member of parliament → see their recent house of commons votes, committee memberships, and declared interests.', glyph: '⚖', slug: '/labs/mp' },
  'lab/hygiene': { title: 'hygiene.', subtitle: 'food standards rating for any uk eatery', description: 'food standards agency hygiene rating for any uk restaurant, takeaway, or food premises — current score, inspection date, and per-criterion breakdown.', glyph: '✓', slug: '/labs/hygiene' },
  'lab/crypto': { title: 'crypto.', subtitle: 'live top-50 crypto prices + 7-day sparklines from coingecko', description: 'live top-50 cryptocurrency prices — market cap, 24h volume, 7-day sparkline chart per coin — from the coingecko public api. updates every minute.', glyph: '¤', slug: '/labs/crypto' },
  'lab/bsky-cards': { title: 'bsky cards.', subtitle: 'any bluesky account as a holographic trading card', description: 'render any bluesky account as a holographic trading card — mouse-tilt, shine sweep, constellation-powered stats. binder view of moots + followers.', glyph: '◈', slug: '/labs/bsky-cards' },
  'lab/whtwnd': { title: 'whtwnd.', subtitle: 'write, edit, and publish blog posts to your own pds', description: 'write, edit, and publish whitewind blog posts directly to your own atproto pds — markdown editor, live preview, drafts, and per-post visibility.', glyph: '✎', slug: '/labs/whtwnd' },
  'lab/backlinks': { title: 'backlinks.', subtitle: 'who liked, reposted, quoted, followed, or linked anything on atproto', description: 'constellation-powered explorer — who liked, reposted, quoted, replied to, followed, or inline-linked any atproto record. paste a post, did, or url.', glyph: '↺', slug: '/labs/backlinks' },
  'lab/top-posts': { title: 'top posts.', subtitle: "an account's greatest hits, ranked by total engagement", description: "ranks any bluesky account's posts by weighted engagement (likes + reposts×2 + quotes×3 + replies×0.5). drill into each post's engagement timeline.", glyph: '★', slug: '/labs/top-posts' },
  'lab/list-memberships': { title: 'list memberships.', subtitle: 'every moderation list that includes an account', description: 'every moderation / curation list across bluesky that includes a given account — list name, purpose, curator, and membership-add timestamp per list.', glyph: '≡', slug: '/labs/list-memberships' },
  'lab/engagement-timeline': { title: 'engagement timeline.', subtitle: 'when a post got its likes, reposts, quotes, and replies', description: 'when a bluesky post actually got its likes, reposts, quotes, and replies — bucketed histogram across time using the tid-encoded timestamps.', glyph: '▆', slug: '/labs/engagement-timeline' },
  'lab/labels': { title: 'labels.', subtitle: 'every moderation label applied to a post or account', description: 'every moderation label applied to a bluesky account or post, with the labeler that emitted it. queries community labelers directly, not just appview.', glyph: '⚐', slug: '/labs/labels' },
  'lab/quote-tree': { title: 'quote tree.', subtitle: 'every quote-of-a-quote, recursively', description: 'paste any bluesky post — render the full tree of quote-posts-of-quote-posts recursively. social-drama topology viewer, capped at a sensible depth.', glyph: '❝', slug: '/labs/quote-tree' },
  'lab/reply-ratio': { title: 'reply ratio.', subtitle: 'how much of an account is replies vs original posts', description: 'paste a handle — see % of their last 100 posts that were replies vs originals, who they reply to most, and whether replies or originals score more likes.', glyph: '↳', slug: '/labs/reply-ratio' },
  'lab/top-domains': { title: 'top domains.', subtitle: 'which sites an account links to most often', description: 'which external websites does a bluesky account link to most? scans their last 100 posts for external link embeds + inline urls and groups by host.', glyph: '⌂', slug: '/labs/top-domains' },
  'lab/year-in-review': { title: 'year in review.', subtitle: 'bluesky wrapped from any account\'s car file', description: "bluesky-wrapped style year-in-review built from any account's car file — total posts, top likers, longest thread, top-quoted post, per-month stats.", glyph: '★', slug: '/labs/year-in-review' },
  'lab/met-museum': { title: 'met museum.', subtitle: '470k objects from the metropolitan, images + full metadata', description: '470,000 objects from the metropolitan museum of art — search by artist, medium, culture, or period. public-domain images + full metadata per piece.', glyph: '◫', slug: '/labs/met-museum' },
  'lab/poetry': { title: 'poetry.', subtitle: 'public-domain poems by author, title, or line content', description: '~3000 public-domain english-language poems, searchable by author / title / line. rendered in phosphor mono — the way nature intended.', glyph: '¶', slug: '/labs/poetry' },
  'lab/scryfall': { title: 'scryfall.', subtitle: 'every magic: the gathering card ever printed, scryfall dsl', description: "every magic: the gathering card ever printed. scryfall's full query dsl works verbatim — type, colour, cmc, set, artist, rarity, legalities.", glyph: '✦', slug: '/labs/scryfall' },
  'lab/xkcd': { title: 'xkcd.', subtitle: 'randall munroe\'s webcomic, every strip + transcript + alt-text', description: "randall munroe's webcomic — every strip since 2005, with transcript and mouseover alt-text. arrow keys navigate, r picks a random one.", glyph: '◼', slug: '/labs/xkcd' },
  'lab/aic': { title: 'art institute.', subtitle: 'art institute of chicago — 120k works, iiif images', description: 'art institute of chicago — 120k works with iiif-backed images, cleaner provenance metadata than the met. complementary art-browsing lab.', glyph: '◫', slug: '/labs/aic' },
  'lab/open-library': { title: 'open library.', subtitle: 'archive.org\'s book catalog — title / author / isbn search', description: "internet archive's open book catalog — search by title, author, or isbn. covers, editions, subjects, descriptions. ~30m works indexed.", glyph: '▥', slug: '/labs/open-library' },
  'lab/tvmaze': { title: 'tvmaze.', subtitle: 'tv schedule by country + show metadata, no key', description: "what's airing tonight in any country, plus show search with full metadata — genres, networks, ratings, summaries. no api key required.", glyph: '▶', slug: '/labs/tvmaze' },
  'lab/f1': { title: 'f1.', subtitle: 'every formula 1 race 1950 onward — standings + results', description: 'every formula 1 race from 1950 to the current season — driver and constructor standings, race schedule, per-race results tables, driver drill-down.', glyph: '◎', slug: '/labs/f1' },
  'lab/mastodon': { title: 'mastodon.', subtitle: 'live public firehose of any mastodon instance, sse', description: 'live public firehose of any mastodon instance via server-sent events. activitypub sibling to the jetstream lab, with per-instance stats + top tags.', glyph: '≡', slug: '/labs/mastodon' },
  'lab/media-inspector': { title: 'media inspector.', subtitle: 'every track + metadata tag in any media file, in-browser', description: 'drop any video or audio — see every track, codec, resolution, bitrate, sample rate, metadata tag and cover art. in-browser via mediabunny.', glyph: '▱', slug: '/labs/media-inspector' },
  'lab/frame-extractor': { title: 'frame extractor.', subtitle: 'scrub any video + pull exact frames as png, in-browser', description: 'scrub any video to any timestamp and pull the exact decoded frame as a png. or build a contact-sheet strip. in-browser via mediabunny + webcodecs.', glyph: '⦿', slug: '/labs/frame-extractor' },
  'lab/audio-extractor': { title: 'audio extractor.', subtitle: 'pull audio out of any video as mp3 or wav, in-browser', description: 'pull the audio track out of any video and save as mp3 or wav. re-encodes in-browser via mediabunny — nothing uploads, runs entirely offline.', glyph: '♫', slug: '/labs/audio-extractor' },
  'lab/clipper': { title: 'clipper.', subtitle: 'trim any video to a range + save the clip, in-browser', description: 'trim any video to a time range and save the clip as mp4. re-muxes (and re-encodes only when needed) in-browser via mediabunny + webcodecs.', glyph: '✂', slug: '/labs/clipper' },
  'lab/converter': { title: 'converter.', subtitle: 'mp4 / webm / mkv / mov / mp3 / wav / ogg / flac — in-browser', description: 'format converter — mp4 ↔ webm ↔ mkv ↔ mov for video, plus audio-only output to mp3 / wav / ogg / flac. re-muxes when codecs allow, re-encodes otherwise.', glyph: '↔', slug: '/labs/converter' },
  'lab/twitch-live': { title: 'twitch live.', subtitle: 'top live streams right now, filter by game + language', description: 'top live streams on twitch right now — thumbnails, viewer counts, uptime. filter by game or language. polls every minute via the helix api.', glyph: '▶', slug: '/labs/twitch-live' },
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

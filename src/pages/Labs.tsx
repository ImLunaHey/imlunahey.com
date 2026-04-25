import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { seedBaseline, useLabSeen } from '../lib/lab-seen';

type Lab = {
  slug: string;
  title: string;
  desc: string;
  tags: string[];
  year: string;
  count?: string;
  ready: boolean;
};

const LABS: Lab[] = [
  {
    slug: 'css-battles',
    title: 'css battles',
    desc: 'my solutions to daily css-battle prompts. pure css + divs, no assets.',
    tags: ['css'],
    year: '2023–2025',
    count: '11 entries',
    ready: true,
  },
  {
    slug: 'verse-reveal',
    title: 'verse reveal',
    desc: 'text effect that scrubs through the ascii set until each letter lands. staggered by index.',
    tags: ['animation', 'react'],
    year: '2023',
    ready: true,
  },
  {
    slug: 'infinite-canvas',
    title: 'infinite canvas',
    desc: 'pan + zoom canvas with spatial-hash culling and offscreen caching. 400 synthetic nodes.',
    tags: ['canvas', 'react'],
    year: '2024',
    ready: true,
  },
  {
    slug: 'pdf-uploader',
    title: 'pdf uploader',
    desc: 'post a pdf to your bluesky pds as a com.imlunahey.pdf record with a 16:9 preview.',
    tags: ['atproto', 'bluesky'],
    year: '2024',
    ready: true,
  },
  {
    slug: 'car-explorer',
    title: 'car explorer',
    desc: 'browse any atproto repo — resolves handle → did → pds, downloads the car, groups by collection.',
    tags: ['atproto'],
    year: '2024',
    ready: true,
  },
  {
    slug: 'feed',
    title: 'feed',
    desc: 'read any bluesky actor feed via public.api. pins, reposts, images, infinite scroll.',
    tags: ['atproto', 'bluesky'],
    year: '2024',
    ready: true,
  },
  {
    slug: 'screenshot-maker',
    title: 'screenshot maker',
    desc: 'wrap an image in a background, shadow, frame, patterns, and text. pure canvas2d.',
    tags: ['canvas', 'tool'],
    year: '2023',
    ready: true,
  },
  {
    slug: 'list-cleaner',
    title: 'list cleaner',
    desc: 'find and delete bluesky list subscriptions where the list or its author no longer exists.',
    tags: ['atproto', 'bluesky'],
    year: '2024',
    ready: true,
  },
  {
    slug: 'jetstream',
    title: 'jetstream',
    desc: 'live atproto firehose — every commit, identity, and account event streamed with sub-second latency.',
    tags: ['atproto', 'live'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'plc-log',
    title: 'plc log',
    desc: 'every did:plc operation — handle changes, pds migrations, key rotations — as an audited timeline with diffs.',
    tags: ['atproto', 'identity'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'at-uri',
    title: 'at-uri',
    desc: 'paste any at:// uri — profile, post, list, or custom record — and see it resolved, typed, and cross-linked.',
    tags: ['atproto'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'lexicon',
    title: 'lexicon',
    desc: 'resolve any atproto nsid and render its schema — defs, properties, params, refs — with cross-lexicon jumps.',
    tags: ['atproto'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'germ-card',
    title: 'germ card',
    desc: 'paste a bluesky handle — fetch its com.germnetwork.declaration to see if it can be messaged on germ, who is allowed to, and the mls keys it advertises.',
    tags: ['atproto', 'germ'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'tid',
    title: 'tid',
    desc: 'live-generate atproto timestamp ids, or paste one to decode its timestamp + clock id.',
    tags: ['atproto'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'palette',
    title: 'palette',
    desc: 'drop an image, extract its dominant colors via k-means. hex + oklch, copyable, css export.',
    tags: ['canvas', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'jwt',
    title: 'jwt',
    desc: 'decode any json web token in-browser — header, payload, signature, and a live countdown on the expiry.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'cron',
    title: 'cron',
    desc: 'translate any cron expression to english and preview the next 10 fire times in your local timezone.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'og-preview',
    title: 'og preview',
    desc: 'paste any url, see how its og/twitter meta would render in bluesky, x, discord, and slack unfurls.',
    tags: ['tool', 'meta'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'bsky-composer',
    title: 'bsky composer',
    desc: 'draft a bluesky post with a live link-card preview. grapheme-accurate char count, facet highlights, previewable as any handle.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'fingerprint',
    title: 'fingerprint',
    desc: 'everything your browser silently tells every site. ua, canvas + webgl + audio hashes, fonts, ip/geo from cloudflare headers, entropy meter.',
    tags: ['tool', 'privacy'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'whois',
    title: 'whois',
    desc: 'rdap-based domain lookup — registrar, registration & expiry dates, nameservers, status flags, dnssec. cached server-side.',
    tags: ['tool', 'network'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'ids',
    title: 'ids',
    desc: 'generate uuid v4/v7, ulid, nanoid, tid, snowflake, cuid2. paste any id to decode its embedded timestamp and structure.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'unicode',
    title: 'unicode',
    desc: 'grapheme segmentation, per-codepoint labels, utf-8 byte counts, and every nfc/nfd/nfkc/nfkd normalization form side by side.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'handle-sniper',
    title: 'handle sniper',
    desc: 'check bluesky handle availability — checks your input plus common suffix variants. 404 from resolveHandle means nobody has it yet.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'did-log',
    title: 'did log',
    desc: 'full history of an atproto identity — handle changes, pds migrations, key rotations, all from plc.directory. rendered as a vertical timeline.',
    tags: ['atproto', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'thread-tree',
    title: 'thread tree',
    desc: 'paste any bsky.app post url — renders the full conversation (ancestors + all replies, up to 10 levels) as an indented tree with likes, reposts, and reply counts.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'pds-health',
    title: 'pds health',
    desc: 'probe any atproto pds — describe/health/listrepos endpoints, response times, and operator metadata. ok/degraded/down verdict at a glance.',
    tags: ['atproto', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'regex',
    title: 'regex',
    desc: 'live regex tester with highlight. presets for email/url/ipv4/uuid/date/hex color/at-uri. capture groups with ranges; all js regex flags.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'encode',
    title: 'encode',
    desc: 'base64 / base64url / url / html / hex / binary / rot13 / json-escape. bidirectional. utf-8 throughout. bottom panel compares every codec at once.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'diff',
    title: 'diff',
    desc: 'line-level diff between two blobs. lcs-based. split + unified views, whitespace toggle, +/− stats. colored exactly like github.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'lexicon-validator',
    title: 'lexicon validator',
    desc: 'paste any atproto record json, point at a lexicon nsid — get pass/fail with per-field violations. resolves schemas live via dns-over-https + plc.',
    tags: ['atproto', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'firehose-stats',
    title: 'firehose stats',
    desc: 'live aggregate of the bluesky jetstream. events/sec, top collections, create/update/delete tallies — the whole network\'s writes summarized.',
    tags: ['atproto', 'bluesky', 'live'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'dns',
    title: 'dns',
    desc: 'live dns lookup via mozilla dns-over-https. a, aaaa, txt, mx, cname, ns, soa, caa. includes the _atproto.handle.domain pattern bluesky uses.',
    tags: ['network', 'atproto', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'json',
    title: 'json',
    desc: 'paste any json blob — collapsible tree with search, jsonpath copier, compact preview of closed branches. eats deeply nested records for breakfast.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'colour',
    title: 'colour',
    desc: 'type a colour in any format — hex, rgb, hsl, oklch, or a css name. see every other format, accessibility contrast, and live rgb/hsl sliders.',
    tags: ['tool', 'css'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'timestamp',
    title: 'timestamp',
    desc: 'paste any date — unix s/ms, iso 8601, rfc 2822, whatever. get every format, day of week, iso week, relative time, and 8 timezones at once.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'matrix',
    title: 'matrix',
    desc: 'the canonical terminal effect. falling kana in phosphor green, amber, cyan, or magenta. choose charset: matrix, binary, hex, pokemon, atproto.',
    tags: ['canvas', 'animation'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'shaders',
    title: 'shaders',
    desc: 'live wgsl fragment-shader playground on the gpu. eight presets (plasma, raymarched spheres, mandelbrot, voronoi, kaleidoscope, …). edit the wgsl, watch it recompile live.',
    tags: ['gpu', 'animation'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'atrium',
    title: 'atrium',
    desc: 'isometric pixel-art hangout. 10×10 room of procedurally-drawn furniture, click any tile to walk there with a* pathfinding around blockers. v1 is solo — multiplayer + atproto identity arrive in later phases.',
    tags: ['canvas', 'isometric', 'game'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'terminal',
    title: 'terminal',
    desc: 'a fake shell for the site. cd /labs, ls, cat readme.txt, open /games. arrow-key history, neofetch, the whole thing.',
    tags: ['tool', 'terminal'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'hash',
    title: 'hash',
    desc: 'md5, sha-1, sha-256, sha-384, sha-512 of any input, all at once. sha via subtlecrypto, md5 via js (subtlecrypto refuses). all client-side.',
    tags: ['tool', 'crypto'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'case',
    title: 'case',
    desc: 'every case style at once — camel, pascal, snake, screaming, kebab, train, dot, path, sentence, title (with stopwords), spongecase, swap, inverse.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'password',
    title: 'password',
    desc: 'generate strong passwords in-browser via crypto.getRandomValues. length + charset toggles, live entropy meter with weak / ok / strong / insane grades.',
    tags: ['tool', 'crypto'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'hex-dump',
    title: 'hex dump',
    desc: 'xxd-style hex + ascii dump of any bytes. input as plain text (utf-8), hex, or base64. choose 8/16/24/32 columns, control chars highlighted.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'ua',
    title: 'ua',
    desc: 'parse any user-agent string — browser, engine, os, device. pre-filled with your own ua. bot detection, presets for mainstream browsers.',
    tags: ['tool', 'network'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'http-status',
    title: 'http status',
    desc: 'every http status code with a plain-english description and common causes. search + filter by category. tooltip link to http.cat.',
    tags: ['tool', 'network'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'curl',
    title: 'curl → fetch',
    desc: 'paste a curl command, get fetch() + axios code. parses -X, -H, -d, -u, -L, --json, --form and more.',
    tags: ['tool', 'network'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'csv',
    title: 'csv',
    desc: 'csv ↔ json. quoted fields, escaped quotes, alternate delimiters (, \\t ; |), type coercion, live table preview.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'subnet',
    title: 'subnet',
    desc: 'cidr → network, broadcast, first/last host, netmask, wildcard, class. bitwise breakdown showing network vs host portions.',
    tags: ['tool', 'network'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'http-headers',
    title: 'http headers',
    desc: 'fetch any url server-side — see the redirect chain, every response header grouped by security / cors / cache / server, and a body preview.',
    tags: ['tool', 'network'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'certs',
    title: 'certs',
    desc: 'every tls certificate ever issued for a domain, pulled from crt.sh ct logs. issuer, subject names, wildcard detection, expiry.',
    tags: ['tool', 'network', 'crypto'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'schema',
    title: 'schema',
    desc: 'paste json — infer a json schema. detects date-time / email / uuid / uri / ipv4. merges heterogeneous arrays, marks required vs optional.',
    tags: ['tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'dist',
    title: 'distribution',
    desc: 'paste numbers, get a full statistics panel — histogram + kde, q-q plot, box plot, outliers (iqr + z-score), normality verdict via k² test.',
    tags: ['tool', 'stats'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'exif',
    title: 'exif',
    desc: 'drop a jpeg or png — see every metadata tag the file is leaking. camera, lens, timestamps, gps. download a stripped copy. all client-side.',
    tags: ['tool', 'privacy'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'spectrogram',
    title: 'spectrogram',
    desc: 'drop audio, see frequency over time. webaudio decodes it, hand-rolled cooley-tukey fft runs in-browser, inferno colormap. log-frequency axis.',
    tags: ['audio', 'canvas', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'png-chunks',
    title: 'png chunks',
    desc: 'drop a png — see every chunk it\'s built from. ihdr decoded, idat totals, text chunks surfaced, crc validated per-chunk against zlib\'s polynomial.',
    tags: ['tool', 'binary'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'ascii',
    title: 'ascii',
    desc: 'photo → ascii art. per-cell rec.709 luma averaged, mapped through any of six character ramps (standard, dense, unicode bars / blocks, braille, binary). contrast + invert controls.',
    tags: ['tool', 'canvas'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'units',
    title: 'units',
    desc: 'dimensional-analysis calculator. parses compound expressions — "5 mph × 2 hours" returns a length, "80 kg × 9.81 m/s²" returns a force. 70+ registered units across 10 dimensions.',
    tags: ['tool', 'math'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'browser',
    title: 'browser',
    desc: 'every web api this exact tab supports, live-detected. 100+ features across js / networking / storage / graphics / media / crypto / sensors / ui / workers, grouped and searchable.',
    tags: ['tool', 'meta'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'iss',
    title: 'iss',
    desc: 'live position of the international space station. tle-derived lat/lon/alt/velocity from wheretheiss.at, refreshed every five seconds, plotted on an equirectangular world.',
    tags: ['live', 'canvas', 'space'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'lightning',
    title: 'lightning',
    desc: 'global thunderstorm risk. cape + lightning potential index pulled from open-meteo for ~140 cities, color-mapped onto a world canvas. refreshes every five minutes.',
    tags: ['live', 'canvas', 'weather'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'periodic',
    title: 'periodic',
    desc: '118 elements, the classic layout. click any cell for full properties — mass, period, group, phase, electron configuration, year discovered. filter by category or search.',
    tags: ['tool', 'science'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'tfl-status',
    title: 'tfl status',
    desc: 'live service status for every tube, dlr, elizabeth line, overground, tram, and cable-car line. disruption reasons shown, refreshed every minute.',
    tags: ['live', 'london', 'tfl'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'tfl-cycles',
    title: 'cycles',
    desc: 'all ~800 santander cycles docking stations plotted on a live london map. colour by bikes or free spaces, hover for capacity + e-bike counts.',
    tags: ['live', 'london', 'tfl', 'canvas'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'tfl-arrivals',
    title: 'arrivals',
    desc: 'live next-train board for any london station — tube, dlr, elizabeth, overground, tram, bus. platform-grouped, countdown by minute, 30s refresh.',
    tags: ['live', 'london', 'tfl'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'tfl-air',
    title: 'air',
    desc: 'london air quality band for today + tomorrow, broken out by pollutant (no₂, o₃, pm₁₀, pm₂.₅, so₂). tfl\'s daily forecast.',
    tags: ['live', 'london', 'tfl'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'tfl-roads',
    title: 'roads',
    desc: 'every live road disruption on tfl\'s network — closures, roadworks, events, floods. pins on a london map, filterable by severity.',
    tags: ['live', 'london', 'tfl', 'canvas'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'tfl-tube-map',
    title: 'tube map',
    desc: 'every tube / dlr / elizabeth line, all stations in sequence, with service status overlay. disrupted lines pulse red; click any station for its arrivals.',
    tags: ['live', 'london', 'tfl'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'crime',
    title: 'crime',
    desc: 'every recorded street crime within one mile of a uk postcode, from the home office\'s police.uk feed. radar plot by category, refreshed monthly (2-month lag).',
    tags: ['uk-gov', 'live', 'canvas'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'mp',
    title: 'mp',
    desc: 'postcode → constituency → your mp. name, party, portrait, 25 most recent house of commons divisions with their aye/no on each. via members-api.parliament.uk.',
    tags: ['uk-gov', 'politics'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'hygiene',
    title: 'hygiene',
    desc: 'food standards agency rating for any uk restaurant, café, takeaway, or shop. 0–5 stars in england / wales / northern ireland, pass-or-fail in scotland.',
    tags: ['uk-gov', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'crypto',
    title: 'crypto',
    desc: 'top 50 cryptocurrencies by market cap — live price, 1h/24h/7d change, 7-day sparkline. usd/gbp/eur/jpy toggle. 60s refresh from coingecko\'s free tier.',
    tags: ['live', 'finance'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'year-in-review',
    title: 'year in review',
    desc: 'spotify-wrapped for bluesky. enter a handle, pick a year — fetches the full atproto repo car, parses it, surfaces posts / likes / follows / top hashtags / longest post.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'bsky-cards',
    title: 'bsky cards',
    desc: 'any bluesky account as a holographic trading card. rarity tiers by follower bracket, archetype from post cadence, mouse-tilt shine. collections: moots (mutuals).',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'whtwnd',
    title: 'whtwnd',
    desc: 'write, edit, and publish blog posts to your own atproto pds. oauth sign-in with a per-action scope, markdown content, visibility + theme, list + edit + delete your own records — no whitewind account needed, the record is yours.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'backlinks',
    title: 'backlinks',
    desc: 'paste any atproto at-uri, did, or url — see every record across the network that references it. likes, reposts, quotes, replies, follows, mentions, link-backs. queries constellation.microcosm.blue, hydrates post previews via the public appview.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'top-posts',
    title: 'top posts',
    desc: 'an account\'s greatest hits — last 100 posts ranked by weighted engagement (likes + reposts×2 + quotes×3 + replies×0.5). four constellation count queries per post, runs in seconds.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'list-memberships',
    title: 'list memberships',
    desc: 'paste a handle — see every public moderation or curation list that includes you. bluesky has no built-in way to see this. uses app.bsky.graph.listitem:subject backlinks.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'engagement-timeline',
    title: 'engagement timeline',
    desc: 'paste a post — histogram of when its likes, reposts, quotes, and replies landed. buckets derived from rkey tid timestamps so we never fetch the interaction records themselves.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'labels',
    title: 'labels',
    desc: 'every moderation label applied to an account or post, with the labeler that emitted it. surfaces the labels field the bluesky app hides behind warning chrome.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'quote-tree',
    title: 'quote tree',
    desc: 'paste a bluesky post — render the tree of quote-posts of quote-posts, recursively. social-drama topology viewer, capped at reasonable depth.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'reply-ratio',
    title: 'reply ratio',
    desc: 'paste a handle — % of their last 100 posts that were replies vs originals, who they reply to most, and whether replies or originals get more likes.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'top-domains',
    title: 'top domains',
    desc: 'paste a handle — what websites do they link to most? scans the last 100 posts for external link embeds + inline urls, groups by host.',
    tags: ['atproto', 'bluesky', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'met-museum',
    title: 'met museum',
    desc: "470,000 objects from the metropolitan museum of art — search by artist, medium, culture, or period. public-domain images + full metadata.",
    tags: ['art', 'culture', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'poetry',
    title: 'poetry',
    desc: '~3000 public-domain english-language poems, searchable by author / title / line. rendered in phosphor mono — the way nature intended.',
    tags: ['literature', 'culture', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'scryfall',
    title: 'scryfall',
    desc: "every magic: the gathering card ever printed. scryfall's full query dsl works verbatim — type, colour, cmc, set, artist, rarity, legalities.",
    tags: ['games', 'culture', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'xkcd',
    title: 'xkcd',
    desc: "randall munroe's webcomic — every strip since 2005, with transcript and mouseover alt-text. arrow keys navigate, r picks random.",
    tags: ['culture', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'aic',
    title: 'art institute',
    desc: 'art institute of chicago — 120k works with iiif-backed images, cleaner provenance metadata than the met. complementary art lab.',
    tags: ['art', 'culture', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'open-library',
    title: 'open library',
    desc: "internet archive's open book catalog — search by title, author, or isbn. covers + editions + subjects. ~30m works indexed.",
    tags: ['literature', 'culture', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'tvmaze',
    title: 'tvmaze',
    desc: "what's airing tonight in any country, plus show search with full metadata — genres, networks, ratings, summaries.",
    tags: ['tv', 'culture', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'f1',
    title: 'f1',
    desc: 'every formula 1 race from 1950 to the current season — driver + constructor standings, race schedule, per-race results tables.',
    tags: ['sport', 'culture', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'mastodon',
    title: 'mastodon',
    desc: 'live public firehose of any mastodon instance via sse. activitypub sibling to the jetstream lab, with per-instance stats + top tags.',
    tags: ['fediverse', 'live', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'media-inspector',
    title: 'media inspector',
    desc: 'drop any video / audio — see every track, codec, resolution, bitrate, sample rate, metadata tag and cover art. in-browser via mediabunny.',
    tags: ['media', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'frame-extractor',
    title: 'frame extractor',
    desc: 'scrub any video to any timestamp, pull the exact decoded frame as a png. or build a contact-sheet strip. in-browser via mediabunny + webcodecs.',
    tags: ['media', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'audio-extractor',
    title: 'audio extractor',
    desc: 'pull the audio track out of any video and save as mp3 or wav. re-encodes in-browser via mediabunny — no upload.',
    tags: ['media', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'clipper',
    title: 'clipper',
    desc: 'trim any video to a range and save the clip as mp4. re-muxes (and re-encodes only when needed) in-browser via mediabunny + webcodecs.',
    tags: ['media', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'converter',
    title: 'converter',
    desc: 'format converter — mp4 ↔ webm ↔ mkv ↔ mov, plus audio-only to mp3 / wav / ogg / flac. re-muxes when codecs are compatible, re-encodes when not.',
    tags: ['media', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'twitch-live',
    title: 'twitch live',
    desc: 'top live streams on twitch right now — thumbnails, viewer counts, uptime. filter by game or language. polls every minute.',
    tags: ['live', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'snake',
    title: 'snake',
    desc: 'arrow keys (or wasd), a green dot on a 24×16 grid, one life. paused by default.',
    tags: ['game'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'life',
    title: 'life',
    desc: "conway's game of life on a 60×40 torus. click to paint, space to play, pre-seeded with glider/pulsar/gosper.",
    tags: ['game', 'sim'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'wordle',
    title: 'wordle',
    desc: 'five-letter word, six guesses, one puzzle a day — seeded from the date so everyone gets the same word.',
    tags: ['game'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'typing',
    title: 'typing',
    desc: 'short timed run — 15 / 30 / 60 second. wpm + live accuracy, best scores kept locally.',
    tags: ['game', 'tool'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'sudoku',
    title: 'sudoku',
    desc: 'classic 9×9, four difficulties, generated client-side with a unique-solution check. notes, hints, autosaves locally.',
    tags: ['game'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'mahjong',
    title: 'mahjong',
    desc: 'mahjong solitaire — 144 hand-drawn svg tiles, three custom shapes. layouts are baked into the seed so a single number conveys the exact deal.',
    tags: ['game'],
    year: '2026',
    ready: true,
  },
  {
    slug: 'klondike',
    title: 'klondike',
    desc: 'classic solitaire — 52 hand-drawn svg cards with traditional pip arrangements, 4 foundations + 7 tableau + draw-1 stock. seed-shareable.',
    tags: ['game'],
    year: '2026',
    ready: true,
  },
];

export default function LabsPage() {
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string>('all');
  const [showUnready, setShowUnready] = useState(true);

  const seen = useLabSeen();
  useEffect(() => {
    // First-ever visit: mark every currently-listed lab as already seen, so
    // a brand-new visitor doesn't see "new" on every card. From then on,
    // only labs that appear *after* baseline get the badge until visited.
    seedBaseline(LABS.map((l) => l.slug));
  }, []);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of LABS) {
      for (const t of l.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LABS.filter((l) => {
      if (!showUnready && !l.ready) return false;
      if (activeTag !== 'all' && !l.tags.includes(activeTag)) return false;
      if (q) {
        const hay = `${l.title} ${l.desc} ${l.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, activeTag, showUnready]);

  const clear = () => { setQuery(''); setActiveTag('all'); setShowUnready(true); };
  const filtering = query !== '' || activeTag !== 'all' || !showUnready;

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-labs">
        <header className="page-hd">
          <div className="label" style={{ marginBottom: 8 }}>
            ~/labs
          </div>
          <h1>
            labs<span className="dot">.</span>
          </h1>
          <p className="sub">
            experiments, demos, and tiny things that don&apos;t fit in /projects. some are toys; some are tools. all
            are missing polish on purpose.
          </p>
          <div className="meta">
            <span>
              entries <b>{LABS.length}</b>
            </span>
            <span>
              shipped <b>{LABS.filter((l) => l.ready).length}</b>
            </span>
            <span>
              tags <b>{allTags.length}</b>
            </span>
          </div>
        </header>

        <section className="lab-filters">
          <div className="lab-filter-row">
            <div className="lab-search">
              <span className="lab-search-icon" aria-hidden="true">/</span>
              <input
                className="lab-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="filter by title, description, or tag…"
                aria-label="filter labs"
                type="search"
                autoComplete="off"
                spellCheck={false}
              />
              {query ? <button className="lab-search-clear" onClick={() => setQuery('')} aria-label="clear filter">×</button> : null}
            </div>
            <label className="lab-check">
              <input
                type="checkbox"
                checked={showUnready}
                onChange={(e) => setShowUnready(e.target.checked)}
              />
              show unready
            </label>
          </div>
          <div className="lab-tag-row">
            <button
              className={`lab-tag-chip ${activeTag === 'all' ? 'on' : ''}`}
              onClick={() => setActiveTag('all')}
            >
              all <span className="ct">{LABS.length}</span>
            </button>
            {allTags.map(([tag, count]) => (
              <button
                key={tag}
                className={`lab-tag-chip ${activeTag === tag ? 'on' : ''}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag} <span className="ct">{count}</span>
              </button>
            ))}
          </div>
          {filtering ? (
            <div className="lab-filter-status">
              showing <b>{filtered.length}</b> of {LABS.length}
              <button className="lab-clear-btn" onClick={clear}>clear filters</button>
            </div>
          ) : null}
        </section>

        {filtered.length === 0 ? (
          <div className="lab-empty">
            no labs match — try <button className="t-accent lab-clear-inline" onClick={clear}>clearing filters</button>.
          </div>
        ) : (
          <section className="lab-grid">
            {filtered.map((l) => {
              // seen is null until the client hook hydrates — treat that as
              // "already seen" to avoid a flash of badges on page load.
              const isNew = l.ready && seen != null && !seen.has(l.slug);
              return l.ready ? (
                <Link key={l.slug} to={`/labs/${l.slug}` as never} className={`lab-card ${isNew ? 'is-new' : ''}`}>
                  <LabCardContent lab={l} isNew={isNew} />
                </Link>
              ) : (
                <div key={l.slug} className="lab-card soon">
                  <LabCardContent lab={l} isNew={false} />
                </div>
              );
            })}
          </section>
        )}

        <footer className="labs-footer">
          <span>
            src: <span className="t-accent">static · hand-authored</span>
          </span>
          <span>
            ←{' '}
            <Link to="/" className="t-accent">
              home
            </Link>
          </span>
        </footer>
      </main>
    </>
  );
}

function LabCardContent({ lab, isNew }: { lab: Lab; isNew: boolean }) {
  return (
    <>
      <div className="lab-head">
        <span className="lab-tags">
          {isNew ? <span className="lab-new">new</span> : null}
          {lab.tags.map((t) => (
            <span key={t} className="lab-tag">
              {t}
            </span>
          ))}
        </span>
        <span className="lab-year">{lab.year}</span>
      </div>
      <div className="lab-name">{lab.title}</div>
      <div className="lab-desc">{lab.desc}</div>
      <div className="lab-ft">
        {lab.count ? <span>{lab.count}</span> : <span>—</span>}
        <span className="lab-go">{lab.ready ? 'open →' : 'coming soon'}</span>
      </div>
    </>
  );
}

const CSS = `
  .shell-labs { max-width: 1100px; margin: 0 auto; padding: 0 var(--sp-6); }

  .page-hd {
    padding: 64px 0 var(--sp-6);
    border-bottom: 1px solid var(--color-border);
  }
  .page-hd h1 {
    font-family: var(--font-display);
    font-size: clamp(56px, 9vw, 128px);
    font-weight: 500;
    letter-spacing: -0.03em;
    color: var(--color-fg);
    line-height: 0.9;
  }
  .page-hd h1 .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 58ch; margin-top: var(--sp-3); }

  .lab-filters {
    padding: var(--sp-4) 0 var(--sp-3);
    border-bottom: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .lab-filter-row {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .lab-search {
    flex: 1;
    min-width: 220px;
    display: inline-flex;
    align-items: center;
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border);
  }
  .lab-search-icon {
    padding: 0 var(--sp-2) 0 var(--sp-3);
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: var(--fs-md);
  }
  .lab-search-input {
    flex: 1;
    background: transparent;
    border: 0; outline: 0;
    color: var(--color-fg);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    padding: 8px 0;
  }
  .lab-search-input::placeholder { color: var(--color-fg-faint); }
  .lab-search-clear {
    background: transparent;
    border: 0;
    color: var(--color-fg-faint);
    cursor: pointer;
    padding: 0 var(--sp-3);
    font-size: var(--fs-md);
    font-family: var(--font-mono);
  }
  .lab-search-clear:hover { color: var(--color-accent); }
  .lab-check {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-dim);
    cursor: pointer;
  }
  .lab-check input { accent-color: var(--color-accent); }

  .lab-tag-row {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .lab-tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
    padding: 3px 9px;
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    text-transform: lowercase;
  }
  .lab-tag-chip:hover { color: var(--color-fg); border-color: var(--color-border-bright); }
  .lab-tag-chip.on {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 6%, transparent);
  }
  .lab-tag-chip .ct {
    color: var(--color-fg-ghost);
    font-size: 10px;
  }
  .lab-tag-chip.on .ct { color: var(--color-accent-dim); }

  .lab-filter-status {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .lab-filter-status b { color: var(--color-accent); font-weight: 400; }
  .lab-clear-btn, .lab-clear-inline {
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-fg-dim);
    padding: 2px 8px;
    font-family: inherit;
    font-size: inherit;
    cursor: pointer;
    text-transform: lowercase;
  }
  .lab-clear-inline {
    border: 0;
    padding: 0;
    text-decoration: underline;
  }
  .lab-clear-btn:hover, .lab-clear-inline:hover { color: var(--color-accent); }

  .lab-empty {
    padding: var(--sp-10) var(--sp-4);
    text-align: center;
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-sm);
    border: 1px dashed var(--color-border);
    margin-top: var(--sp-5);
  }
  .page-hd .meta {
    display: flex; gap: var(--sp-6);
    margin-top: var(--sp-5);
    font-size: var(--fs-xs); color: var(--color-fg-faint);
  }
  .page-hd .meta b { color: var(--color-accent); font-weight: 400; }

  .lab-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--sp-3);
    margin-top: var(--sp-6);
  }
  .lab-card {
    display: flex; flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-4);
    border: 1px solid var(--color-border);
    background: var(--color-bg-panel);
    color: inherit;
    text-decoration: none;
    min-height: 180px;
  }
  .lab-card:hover { border-color: var(--color-accent-dim); text-decoration: none; }
  .lab-card:hover .lab-name { color: var(--color-accent); }
  .lab-card.soon { opacity: 0.55; cursor: default; }
  .lab-card.soon:hover { border-color: var(--color-border); }
  .lab-card.soon:hover .lab-name { color: var(--color-fg); }

  .lab-head {
    display: flex; justify-content: space-between; align-items: baseline;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
  }
  .lab-tags { display: flex; gap: 4px; flex-wrap: wrap; }
  .lab-tag {
    padding: 1px 6px;
    border: 1px solid var(--color-accent-dim);
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .lab-new {
    padding: 1px 6px;
    background: var(--color-accent);
    color: var(--color-bg);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 500;
    box-shadow: 0 0 8px var(--accent-glow);
  }
  .is-new { border-color: var(--color-accent-dim); }
  .is-new .lab-name { color: var(--color-fg); }
  .lab-year { color: var(--color-fg-faint); }

  .lab-name {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 500;
    letter-spacing: -0.02em;
    color: var(--color-fg);
    line-height: 1;
    margin-top: var(--sp-2);
  }
  .lab-desc {
    color: var(--color-fg-dim);
    font-size: var(--fs-sm);
    line-height: 1.5;
    flex: 1;
  }
  .lab-ft {
    display: flex; justify-content: space-between;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    padding-top: var(--sp-2);
    border-top: 1px dashed var(--color-border);
    margin-top: var(--sp-2);
  }
  .lab-go { color: var(--color-accent); }
  .lab-card.soon .lab-go { color: var(--color-fg-faint); }

  .labs-footer {
    display: flex; justify-content: space-between;
    padding: var(--sp-8) 0 var(--sp-10);
    margin-top: var(--sp-10);
    border-top: 1px solid var(--color-border);
    font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono);
  }
`;

/**
 * Single source of truth for the site.
 *
 * Two categories live here:
 *   - STATIC identity: SITE, ABOUT, USES, SOCIALS
 *   - DERIVED snapshots: NOW, WEATHER, MUSIC, STATUS, WATCHING, BSKY_POSTS,
 *     BLOG, GITHUB, SOURCES
 *
 * Everything is hand-authored today. Swap any constant to a real data
 * source (hook, server fn, fetch) when you're ready — the rendering
 * components only read the shapes declared here.
 */

export const SITE = {
  handle: 'imlunahey',
  name: 'luna',
  domain: 'imlunahey.com',
  location: 'london, uk',
  tz: 'Europe/London',
  email: 'xo@wvvw.me',
  pronouns: 'she/her',
  version: 'v4.0.1',
};

export const ABOUT = {
  headline: "hi, i'm luna.",
  blurb:
    "software engineer based in london. i build things on the web — tools for bluesky, tiny experiments, and the occasional half-finished canal-boat retrofit. i write a blog, ship open source, and stream code when the lighting's kind.",
  tags: ['typescript', 'rust', 'go', 'bun'],
};

export const USES = {
  hardware: [
    { name: 'mbp m3 max', tag: '16"' },
    { name: 'iphone 16 pro', tag: 'black' },
    { name: 'vision pro', tag: '256g' },
    { name: 'watch ultra 2', tag: 'ti' },
    { name: 'studio display', tag: '5k' },
  ],
  software: [
    { name: 'zed', tag: 'editor' },
    { name: 'arc', tag: 'browser' },
    { name: 'ghostty', tag: 'term' },
    { name: 'raycast', tag: 'launcher' },
  ],
  runtime: [
    { name: 'bun', tag: '1.1' },
    { name: 'node', tag: '22' },
    { name: 'deno', tag: '2.0' },
  ],
};

export const SOCIALS = [
  { net: 'bluesky', handle: '@imlunahey.com', url: 'https://bsky.app/profile/imlunahey.com' },
  { net: 'github', handle: '@imlunahey', url: 'https://github.com/imlunahey' },
  { net: 'discord', handle: 'luna#0001', url: '#' },
  { net: 'twitch', handle: '@lunahey', url: 'https://twitch.tv/imlunahey' },
];

export const CMD_BAR = {
  uptime: '27d 14h',
  load: '0.42 0.38 0.41',
  mem: '14.2g/32g',
  lastDeploy: '4h ago',
  lastCommit: '37m ago',
};

export const NOW = {
  headline: ['rewriting', 'everything.'] as const,
  rows: [
    { k: 'building', v: 'a dns server from scratch' },
    { k: 'reading', v: 'the psychology of money' },
    { k: 'listening', v: null as string | null }, // falls back to current music
    { k: 'wanting', v: 'another bank holiday' },
    { k: 'last commit', v: '37 minutes ago' },
  ],
};

export const VITALS = {
  status: 'online',
  location: 'london, uk',
  timezone: 'utc+0',
  pronouns: 'she/her',
  stack: 'ts · rs · go',
  editor: 'zed',
  runtime: 'bun 1.1',
};

export const WEATHER = { tempC: 14.2, code: 'partly cloudy' };

export const STATUS = { focus: 'rewriting everything', dnd: true, backAt: '18:00', mood: 5 };

export const MUSIC = {
  track: 'Desire, I Want To Turn Into You',
  artist: 'Caroline Polachek',
  playing: true,
  progress: 0.42,
  duration: 238,
};

export const BSKY_POSTS = [
  { text: 'shipped the dns resolver. cache invalidation is hell.', ts: '2026-04-18T22:12:00Z', likes: 142, replies: 18 },
  { text: 'london smells like rain and regret today', ts: '2026-04-18T09:44:00Z', likes: 89, replies: 7 },
  { text: 'rust is growing on me. send help.', ts: '2026-04-17T16:31:00Z', likes: 203, replies: 24 },
];

export type BlogKind = 'essay' | 'devlog' | 'short';

export type BlogPost = {
  date: string;
  title: string;
  slug: string;
  readMin: number;
  kind: BlogKind;
  excerpt: string;
};

export const BLOG: BlogPost[] = [
  {
    date: '2026-04-12',
    title: 'on building your own dns server for fun',
    slug: 'dns-from-scratch',
    readMin: 8,
    kind: 'devlog',
    excerpt:
      "i spent three weeks writing a recursive resolver in rust. here's what i learned about caching, recursion, and the slow violence of udp.",
  },
  {
    date: '2026-03-28',
    title: 'the web, seven years later',
    slug: 'web-seven-years',
    readMin: 12,
    kind: 'essay',
    excerpt: 'a long look back at where we started, where we ended up, and whether any of it was worth it.',
  },
  {
    date: '2026-03-04',
    title: "social media is doomed (and that's fine)",
    slug: 'sm-doomed',
    readMin: 6,
    kind: 'essay',
    excerpt: 'a reflection on the state of social media and discovering something better.',
  },
  {
    date: '2026-02-15',
    title: 'what i use // 2026 edition',
    slug: 'uses-2026',
    readMin: 4,
    kind: 'short',
    excerpt: 'the annual what-i-use post. spoiler: still a mac, still zed, still bun.',
  },
  {
    date: '2026-01-22',
    title: 'a year of living on a canal boat',
    slug: 'canal-year',
    readMin: 9,
    kind: 'essay',
    excerpt: 'twelve months on 40ft of steel in east london. the good, the cold, and the composting toilet.',
  },
  {
    date: '2025-12-14',
    title: 'writing a lexicon for atproto',
    slug: 'lexicon-atproto',
    readMin: 7,
    kind: 'devlog',
    excerpt: 'atproto lexicons are kind of like openapi, kind of like protobuf, and kind of like neither.',
  },
  {
    date: '2025-11-02',
    title: 'against portfolio sites',
    slug: 'anti-portfolio',
    readMin: 5,
    kind: 'essay',
    excerpt: 'why i keep rewriting this one, and why that is maybe the point.',
  },
  {
    date: '2025-10-08',
    title: 'shipping ip2country',
    slug: 'ip2country',
    readMin: 3,
    kind: 'short',
    excerpt: 'one 180kb binary, zero dependencies, one million queries per second.',
  },
  {
    date: '2025-08-19',
    title: 'bun in production · six months in',
    slug: 'bun-prod',
    readMin: 11,
    kind: 'devlog',
    excerpt: 'we moved everything from node to bun. most things got faster. a few things broke. worth it.',
  },
  {
    date: '2025-07-04',
    title: 'every side project i never finished',
    slug: 'graveyard',
    readMin: 6,
    kind: 'essay',
    excerpt: 'a loving obituary for 47 repositories that will never see production.',
  },
];

export const BLOG_STATS = {
  words: 48_294,
  since: 2019,
};

export type RepoLang = 'typescript' | 'rust' | 'go' | 'nix';
export type RepoStatus = 'active' | 'archived' | 'wip';

export type Repo = {
  name: string;
  desc: string;
  lang: RepoLang;
  stars: number;
  commits: number;
  updated: number; // days ago
  status: RepoStatus;
  kind?: 'app' | 'lib' | 'tool';
  launch?: string | null;
  source?: string | null;
  writeup?: string | null;
};

export const PINNED_REPOS: Repo[] = [
  {
    name: 'akari',
    desc: 'a bluesky client, rewritten for the third time',
    lang: 'typescript',
    stars: 412,
    commits: 834,
    updated: 2,
    status: 'active',
    kind: 'app',
    launch: 'https://akari.lunahey.com',
    source: 'https://github.com/imlunahey/akari',
  },
  {
    name: 'dns-server',
    desc: 'a recursive dns resolver, written in rust',
    lang: 'rust',
    stars: 89,
    commits: 142,
    updated: 5,
    status: 'active',
    kind: 'lib',
    source: 'https://github.com/imlunahey/dns-server',
    writeup: 'dns-from-scratch',
  },
  {
    name: 'ip2country',
    desc: 'standalone ip → country lookup table',
    lang: 'typescript',
    stars: 154,
    commits: 67,
    updated: 8,
    status: 'active',
    kind: 'tool',
    launch: 'https://ip2country.lunahey.com',
    source: 'https://github.com/imlunahey/ip2country',
    writeup: 'ip2country',
  },
  {
    name: 'xirelta',
    desc: 'lightweight web framework for bun',
    lang: 'typescript',
    stars: 67,
    commits: 203,
    updated: 14,
    status: 'active',
    kind: 'lib',
    source: 'https://github.com/imlunahey/xirelta',
  },
  {
    name: 'polish',
    desc: 'prettify json, xml, yaml, csv in-browser',
    lang: 'typescript',
    stars: 203,
    commits: 89,
    updated: 21,
    status: 'active',
    kind: 'tool',
    launch: 'https://polish.lunahey.com',
    source: 'https://github.com/imlunahey/polish',
  },
  {
    name: 'lexicon-pad',
    desc: 'atproto lexicon playground & validator',
    lang: 'typescript',
    stars: 58,
    commits: 112,
    updated: 17,
    status: 'active',
    kind: 'tool',
    launch: 'https://lexicon.lunahey.com',
    source: 'https://github.com/imlunahey/lexicon-pad',
    writeup: 'lexicon-atproto',
  },
];

export const ALL_REPOS: Repo[] = [
  ...PINNED_REPOS.map((r) => ({ ...r })),
  {
    name: 'feed-generator',
    desc: 'atproto feed generator starter kit',
    lang: 'typescript',
    stars: 34,
    commits: 41,
    updated: 45,
    status: 'archived',
    source: 'https://github.com/imlunahey/feed-generator',
  },
  {
    name: 'colors',
    desc: 'a gorgeous, accessible color system',
    lang: 'typescript',
    stars: 78,
    commits: 112,
    updated: 90,
    status: 'archived',
    source: 'https://github.com/imlunahey/colors',
  },
  {
    name: 'lunafications',
    desc: 'local-first notification server',
    lang: 'rust',
    stars: 12,
    commits: 28,
    updated: 3,
    status: 'wip',
    source: 'https://github.com/imlunahey/lunafications',
  },
  {
    name: 'view-counter',
    desc: 'privacy-first view counter for blogs',
    lang: 'go',
    stars: 45,
    commits: 34,
    updated: 62,
    status: 'archived',
    source: 'https://github.com/imlunahey/view-counter',
  },
  {
    name: 'site-scanner',
    desc: 'passive site reconnaissance toolkit',
    lang: 'go',
    stars: 21,
    commits: 19,
    updated: 180,
    status: 'archived',
    source: 'https://github.com/imlunahey/site-scanner',
  },
  {
    name: 'cleanfollow-bsky',
    desc: 'hidden accounts unfollow tool for bluesky',
    lang: 'typescript',
    stars: 98,
    commits: 73,
    updated: 30,
    status: 'active',
    launch: 'https://cleanfollow.lunahey.com',
    source: 'https://github.com/imlunahey/cleanfollow-bsky',
  },
  {
    name: 'zara',
    desc: 'a modern web scratch-pad',
    lang: 'typescript',
    stars: 56,
    commits: 156,
    updated: 11,
    status: 'active',
    launch: 'https://zara.lunahey.com',
    source: 'https://github.com/imlunahey/zara',
  },
];

export const PROJECT_STATS = {
  repos: 220,
  stars: 3284,
  active: 12,
  languages: 8,
};

export const GITHUB = {
  totalCommits: 1284,
  longestStreak: 47,
  legendStart: 'apr 2025',
  legendEnd: 'apr 2026',
  // 53 weeks × 7 days, deterministic buckets 0–4
  contrib: Array.from({ length: 53 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const r = (((w * 31 + d * 17) * 9301 + 49297) % 233_280) / 233_280;
      if (r > 0.92) return 4;
      if (r > 0.75) return 3;
      if (r > 0.5) return 2;
      if (r > 0.25) return 1;
      return 0;
    }),
  ),
};

export type Watch = {
  title: string;
  kind: 'tv' | 'film';
  s?: string;
  rating: number;
};

export const WATCHING: Watch[] = [
  { title: 'severance', kind: 'tv', s: 's2', rating: 9.0 },
  { title: 'poor things', kind: 'film', rating: 8.5 },
  { title: 'the bear', kind: 'tv', s: 's3', rating: 7.0 },
  { title: 'dune pt2', kind: 'film', rating: 9.5 },
  { title: 'fallout', kind: 'tv', s: 's1', rating: 6.5 },
  { title: 'oppenheimer', kind: 'film', rating: 8.8 },
];

export const WATCHING_STATS = { thisYear: 72 };

export const SOURCES = [
  { key: 'posts', source: 'public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed', refresh: 300 },
  { key: 'blog', source: 'lunahey.com/xrpc/com.whtwnd.blog.getEntries', refresh: 600 },
  { key: 'gh', source: 'api.github.com · ghchart', refresh: 3600 },
  { key: 'music', source: 'ws.audioscrobbler.com/2.0 · user.getrecenttracks', refresh: 30 },
  { key: 'weather', source: 'api.open-meteo.com', refresh: 1800 },
  { key: 'watching', source: 'trakt.tv/api · tmdb images', refresh: 3600 },
  { key: 'status', source: 'static · or ios shortcut → kv', refresh: 60 },
];

/* ────────── /uses page ────────── */

export type UsesItem = { name: string; config: string; note: string };
export type UsesSection = {
  id: string;
  num: string;
  title: string;
  desc?: string;
  items: UsesItem[];
};

export const USES_META = {
  version: '2026.1',
  lastUpdated: 'apr 19, 2026',
  nextReview: 'jul 2026',
};

export const USES_SECTIONS: UsesSection[] = [
  {
    id: 'hardware',
    num: '01',
    title: 'hardware',
    desc: "the stuff with silicon in it. bought with money i don't always have.",
    items: [
      { name: 'macbook pro', config: 'm3 max · 16" · 64gb · 2tb', note: 'primary workhorse. fans never spin.' },
      {
        name: 'studio display',
        config: '27" · nano-texture · 5k',
        note: 'the one with the tilt-only stand. i regret not getting the vesa.',
      },
      { name: 'iphone', config: '16 pro · black · 512gb', note: 'two years and counting.' },
      { name: 'apple watch', config: 'ultra 2 · titanium', note: 'for running and not checking bluesky.' },
      { name: 'vision pro', config: '256gb', note: 'mostly a very expensive cinema.' },
      { name: 'airpods', config: 'pro 2 · usb-c', note: 'replaced twice.' },
    ],
  },
  {
    id: 'editor',
    num: '02',
    title: 'editor',
    items: [
      { name: 'zed', config: 'primary', note: 'switched from vscode two years ago. never going back.' },
      { name: 'vscode', config: 'backup', note: "for the odd extension i can't live without." },
      { name: 'font', config: 'jetbrains mono · 13pt', note: 'variable, ligatures on.' },
      { name: 'theme', config: 'one dark pro · modified', note: 'had to fix the greens.' },
    ],
  },
  {
    id: 'desk',
    num: '03',
    title: 'desk',
    items: [
      { name: 'desk', config: 'fully jarvis · bamboo', note: 'standing, about 30% of the time.' },
      { name: 'chair', config: 'herman miller embody', note: 'bought used. still worth it.' },
      { name: 'mic', config: 'shure sm7b · goxlr', note: 'overkill for streaming.' },
      { name: 'camera', config: 'sony zv-e10 · 11mm', note: 'as a webcam.' },
      { name: 'lighting', config: '2× elgato key light air', note: 'color-balanced to 5000k.' },
    ],
  },
  {
    id: 'keyboard',
    num: '04',
    title: 'keyboard',
    items: [
      { name: 'board', config: 'tofu65 · aluminum', note: 'tkl-ish. hot-swappable.' },
      { name: 'switches', config: 'gateron oil kings', note: 'lubed. silent-ish.' },
      { name: 'keycaps', config: 'gmk mono · cherry profile', note: 'matches the site. coincidence.' },
      { name: 'mouse', config: 'logitech mx master 3s', note: 'two buttons is not enough.' },
    ],
  },
  {
    id: 'camera',
    num: '05',
    title: 'camera',
    items: [
      { name: 'body', config: 'fujifilm x-t5 · silver', note: 'small enough to always carry.' },
      { name: 'lens · primary', config: 'fuji 23mm f/2', note: '35mm equiv. goes everywhere.' },
      { name: 'lens · portrait', config: 'fuji 56mm f/1.2 wr', note: 'for people, occasionally.' },
      { name: 'lens · wide', config: 'fuji 10-24mm f/4', note: 'architecture, rarely.' },
      { name: 'bag', config: 'wandrd prvke 21l', note: 'laptop + x-t5 + two lenses.' },
    ],
  },
  {
    id: 'software',
    num: '06',
    title: 'software',
    items: [
      { name: 'arc', config: 'browser', note: 'tabs collapsed by default.' },
      { name: 'raycast', config: 'launcher', note: '50+ extensions.' },
      { name: 'ghostty', config: 'terminal', note: 'fast. quiet. native.' },
      { name: 'linear', config: 'tasks', note: 'personal workspace.' },
      { name: 'obsidian', config: 'notes', note: 'vault in icloud.' },
      { name: 'figma', config: 'design', note: 'occasionally.' },
      { name: 'bartender', config: 'menu bar', note: 'hides 90% of it.' },
    ],
  },
  {
    id: 'runtime',
    num: '07',
    title: 'runtime',
    items: [
      { name: 'bun', config: '1.1 · primary', note: 'most new projects.' },
      { name: 'node', config: '22 lts', note: 'when libraries demand it.' },
      { name: 'deno', config: '2.0', note: 'small scripts.' },
      { name: 'pnpm', config: 'package manager', note: 'for non-bun projects.' },
    ],
  },
  {
    id: 'services',
    num: '08',
    title: 'services',
    items: [
      { name: 'cloudflare', config: 'dns + workers + pages', note: 'everything, basically.' },
      { name: 'axiom', config: 'logs + traces', note: "i work there. it's good." },
      { name: 'github', config: 'code', note: '220+ public repos.' },
      { name: '1password', config: 'secrets', note: 'family plan.' },
    ],
  },
  {
    id: 'edc',
    num: '09',
    title: 'edc',
    items: [
      { name: 'wallet', config: 'bellroy note sleeve · black', note: 'three cards max.' },
      { name: 'keys', config: 'keysmart max', note: 'tile built in.' },
      { name: 'pen', config: 'lamy 2000 · ballpoint', note: 'never loaned. never returned.' },
      { name: 'notebook', config: 'midori md · a6 · dot', note: 'always in the bag.' },
    ],
  },
  {
    id: 'boat',
    num: '10',
    title: 'boat rig',
    desc: "yes, i live on a canal boat. 40ft, steel, 1994. here's what keeps me warm and online.",
    items: [
      { name: 'stove', config: 'morsø 1412 · multi-fuel', note: '3kw. smokeless coal only.' },
      { name: 'battery', config: '4× 100ah lifepo4 · renogy', note: '400ah usable. charged via solar.' },
      { name: 'solar', config: '4× 100w · panels on roof', note: 'surprisingly enough in summer.' },
      { name: 'inverter', config: 'victron multiplus 3kw', note: 'runs the laptop + monitor.' },
      { name: 'internet', config: 'ee 5g · teltonika router', note: '300mbps on a good day.' },
    ],
  },
];

/* ────────── project detail ────────── */

export type ReadmeBlock = { h: string } | { p: string } | { code: string };

export const PROJECT_READMES: Record<string, ReadmeBlock[]> = {
  akari: [
    { h: 'what' },
    {
      p: 'akari is a bluesky client i keep rewriting. this is the third full rewrite. the second one worked and i hated it. this one works and i love it.',
    },
    {
      p: "the focus is reading. feeds you can actually scan. threads that don't collapse into nonsense. images that show up at the right size.",
    },
    { h: 'status' },
    {
      p: "production. i use it daily. occasional crashes, rarely anything i can't work around. the macos build is notarized; ios is testflight only.",
    },
    { h: 'install' },
    { code: 'brew tap imlunahey/akari\nbrew install --cask akari' },
    { h: 'why rewrite it three times' },
    {
      p: "version 1 was svelte. i didn't know svelte. version 2 was react native. i didn't really want a mobile app. version 3 is a tauri + solid desktop app and also a pwa. it finally feels like the thing i was trying to build in 2023.",
    },
  ],
  'dns-server': [
    { h: 'what' },
    {
      p: 'a recursive dns resolver, written in rust. no dependencies beyond the standard library and bytes. supports A, AAAA, CNAME, MX, TXT. udp transport, tcp fallback coming.',
    },
    { h: 'why' },
    {
      p: 'because i have been paged for dns at least seven times and i wanted to understand it end-to-end. the writeup has the long version.',
    },
    { h: 'install' },
    { code: 'cargo install lunares\nlunares --port 5353' },
    { h: 'benchmarks' },
    { p: '200k q/s on an m2 air, single-threaded, warm cache. not production-ready. not trying to be.' },
  ],
  ip2country: [
    { h: 'what' },
    {
      p: 'a 180kb lookup table that maps an ip address to an iso country code. zero dependencies. one million lookups per second on my laptop.',
    },
    { h: 'try it' },
    { p: 'the playground has a query box. paste any ip, get a country.' },
    { h: 'install' },
    { code: 'npm i ip2country\n\nimport { lookup } from "ip2country"\nlookup("1.1.1.1") // → "AU"' },
    { h: 'data source' },
    {
      p: 'merged from maxmind geolite2 and db-ip lite, updated monthly. the repo has a weekly cron that regenerates the table.',
    },
  ],
  xirelta: [
    { h: 'what' },
    { p: 'a web framework for bun. tiny (~3kb), typed, jsx-first.' },
    { h: 'install' },
    {
      code: 'bun add xirelta\n\nimport { app, get } from "xirelta"\nget("/", () => <h1>hello</h1>)\napp.listen(3000)',
    },
    { h: 'status' },
    {
      p: 'i use it for most of my personal sites. not recommending it for production at a job. the api surface is intentionally small and i change it whenever i feel like it.',
    },
  ],
  polish: [
    { h: 'what' },
    {
      p: 'a browser-only formatter for the things you often need to format: json, xml, yaml, csv, html, sql. no server. no uploads. everything runs locally in your tab.',
    },
    { h: 'try it' },
    { p: 'polish.lunahey.com. paste, pick a format, get pretty output.' },
    { h: 'stack' },
    {
      p: "solid + wasm-compiled formatters. the whole app is ~200kb after gzip. it works offline once you've loaded it once.",
    },
  ],
  'lexicon-pad': [
    { h: 'what' },
    {
      p: 'a playground for writing and validating atproto lexicons in your browser. live errors, inline docs, shareable permalinks.',
    },
    { h: 'try it' },
    { p: 'lexicon.lunahey.com. the left pane is lexicon source, the right pane is a generated record form.' },
    { h: 'install' },
    { p: 'hosted only. the code is on github if you want to self-host.' },
  ],
  'feed-generator': [
    { h: 'what' },
    {
      p: 'a starter kit for writing atproto feed generators in typescript. i wrote this when the api was fresh; it has been superseded by the official kit, but some of the patterns here are still useful.',
    },
    { h: 'status' },
    { p: 'archived. use the bluesky-social/feed-generator repo instead.' },
  ],
  colors: [
    { h: 'what' },
    {
      p: 'an opinionated color system. perceptually uniform, accessible pairs pre-validated, dark-mode from the ground up. built in oklch.',
    },
    { h: 'status' },
    { p: 'archived. i rolled the good parts into my design system.' },
  ],
  lunafications: [
    { h: 'what' },
    {
      p: 'a local-first notification server for mac and linux. listens on a unix socket, speaks a simple json protocol, calls terminal-notifier / notify-send.',
    },
    { h: 'status' },
    {
      p: "work in progress. the basic path works; i haven't shipped a release yet. star the repo to follow along.",
    },
  ],
  'cleanfollow-bsky': [
    { h: 'what' },
    {
      p: 'cleans your bluesky follow list of deactivated, suspended, and hidden accounts. oauth only — no app passwords, no keys.',
    },
    { h: 'try it' },
    { p: 'cleanfollow.lunahey.com. log in, preview, confirm.' },
    { h: 'privacy' },
    {
      p: "i don't log anything. the whole unfollow step runs in your browser using your own session token. you can self-host if you don't trust me.",
    },
  ],
};

export type Commit = { sha: string; msg: string; when: string };

export const PROJECT_COMMITS: Commit[] = [
  { sha: 'a3f2c91', msg: 'fix: handle empty response in parser', when: '2d' },
  { sha: '7e1b4d8', msg: 'chore: bump dependencies', when: '4d' },
  { sha: 'c05f2aa', msg: 'feat: add --verbose flag', when: '6d' },
  { sha: '91d8e0c', msg: 'docs: clarify install for windows', when: '9d' },
  { sha: 'ffa3015', msg: 'refactor: extract retry logic', when: '14d' },
];

/* ────────── gallery ────────── */

export type GallerySeries = {
  id: string;
  label: string;
  n: number;
  totalCount: number;
  prompts: string[];
  palette: [string, string, string];
};

export const GALLERY_SERIES: GallerySeries[] = [
  {
    id: 'liminal',
    label: 'liminal interiors',
    n: 12,
    totalCount: 3842,
    prompts: [
      'empty hotel corridor at 3am, fluorescent green wash, worn carpet, long exposure',
      'abandoned mall food court, dusty atrium light, kodachrome',
      'indoor swimming pool at night, humid air, tiled geometry, liminal',
      'vacant office after hours, monitor glow, vertical blinds, 1997',
      'hotel stairwell, concrete, sodium vapor light, disposable camera',
      'laundromat at 2am, harsh overhead light, no people',
    ],
    palette: ['oklch(0.35 0.08 160)', 'oklch(0.55 0.12 120)', 'oklch(0.28 0.05 180)'],
  },
  {
    id: 'canals',
    label: 'canal brutalism',
    n: 10,
    totalCount: 2918,
    prompts: [
      'regents canal at dawn, concrete towpath, barges in fog, moody',
      'narrow boat in industrial dock, peeling paint, graffiti, 35mm',
      'east london lock gate, rust + moss, macro detail',
      'canal reflection, brutalist tower block above, overcast',
      'houseboat interior, wood stove burning, warm tungsten, cozy',
    ],
    palette: ['oklch(0.38 0.06 220)', 'oklch(0.45 0.04 240)', 'oklch(0.55 0.08 80)'],
  },
  {
    id: 'soviet',
    label: 'soviet futures',
    n: 8,
    totalCount: 4104,
    prompts: [
      'soviet bus stop in the steppe, geometric tile, clear sky, wide angle',
      'brutalist monument on hilltop, concrete, low sun, cinematic',
      'abandoned space complex, khrushchev era, documentary photo',
      'tram depot in almaty, winter, grey snow, kodak portra 400',
    ],
    palette: ['oklch(0.40 0.05 30)', 'oklch(0.55 0.08 60)', 'oklch(0.28 0.04 250)'],
  },
  {
    id: 'neonbus',
    label: 'neon bus stops',
    n: 10,
    totalCount: 2287,
    prompts: [
      'night bus stop, tokyo suburb, rain reflections, vaporwave',
      'lit bus shelter, empty street, cherry blossoms, 4am',
      'taxi in neon puddle, vending machines glowing',
      'convenience store, 24h sign, moth-lit canopy, kodak',
    ],
    palette: ['oklch(0.45 0.15 340)', 'oklch(0.55 0.18 280)', 'oklch(0.35 0.12 220)'],
  },
  {
    id: 'fungi',
    label: 'impossible fungi',
    n: 6,
    totalCount: 1852,
    prompts: [
      'mushroom the size of a cathedral, forest floor, volumetric light',
      'bioluminescent fungus growing on rusted train, studio ghibli',
      'lichen city, moss architecture, macro + wide combined',
    ],
    palette: ['oklch(0.45 0.18 140)', 'oklch(0.65 0.20 100)', 'oklch(0.30 0.10 180)'],
  },
  {
    id: 'rooms',
    label: 'rooms without people',
    n: 10,
    totalCount: 5281,
    prompts: [
      'sunlit bedroom, vermeer window light, unmade bed, 16mm film',
      'kitchen mid-afternoon, crumbs on counter, sunbeam across floor',
      'study with green banker lamp, stacks of books, dust motes',
      'tiled bathroom, steam on mirror, single towel, quiet',
    ],
    palette: ['oklch(0.70 0.08 70)', 'oklch(0.80 0.06 90)', 'oklch(0.55 0.10 50)'],
  },
];

export type GalleryShot = { cap: string; lens: string; ap: string; sh: string; iso: number };

export const GALLERY_SHOTS = {
  label: 'shot on fuji',
  totalCount: 23,
  palette: ['oklch(0.55 0.12 60)', 'oklch(0.45 0.08 220)', 'oklch(0.35 0.05 40)'] as [string, string, string],
  items: [
    { cap: 'regents canal, 07:12', lens: '23mm', ap: 'f/2.0', sh: '1/500', iso: 200 },
    { cap: 'whitechapel market', lens: '23mm', ap: 'f/2.8', sh: '1/250', iso: 400 },
    { cap: 'shoreditch back-alley', lens: '35mm', ap: 'f/2.0', sh: '1/125', iso: 800 },
    { cap: 'barbican, concrete', lens: '23mm', ap: 'f/5.6', sh: '1/500', iso: 200 },
    { cap: 'london fields', lens: '56mm', ap: 'f/1.4', sh: '1/1000', iso: 200 },
    { cap: 'mile end park', lens: '23mm', ap: 'f/4.0', sh: '1/250', iso: 400 },
    { cap: 'bethnal green station', lens: '23mm', ap: 'f/2.0', sh: '1/60', iso: 1600 },
    { cap: 'tower bridge, dusk', lens: '56mm', ap: 'f/2.8', sh: '1/125', iso: 800 },
    { cap: 'victoria park', lens: '56mm', ap: 'f/1.4', sh: '1/500', iso: 200 },
    { cap: 'camden high street', lens: '35mm', ap: 'f/2.8', sh: '1/250', iso: 400 },
    { cap: 'hackney wick', lens: '23mm', ap: 'f/2.0', sh: '1/125', iso: 800 },
    { cap: 'st pauls from m.bridge', lens: '23mm', ap: 'f/5.6', sh: '1/500', iso: 200 },
  ] as GalleryShot[],
};

export const GALLERY_META = {
  generatedTotal: 20_284,
  shotTotal: 23,
  allTotal: 20_307,
  seriesCount: 6,
  lastUpload: '4h ago',
};

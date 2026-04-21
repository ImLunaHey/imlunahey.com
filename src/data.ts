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

import { version as pkgVersion } from '../package.json';

export const SITE = {
  handle: 'imlunahey',
  name: 'luna',
  domain: 'imlunahey.com',
  location: 'london, uk',
  tz: 'Europe/London',
  email: 'xo@wvvw.me',
  pronouns: 'she/her · they/them',
  version: `v${pkgVersion}`,
};

export const ABOUT = {
  headline: "hi, i'm luna.",
  blurb:
    'software engineer based in london. i build things on the web — tools for bluesky, tiny experiments, and open source. i write a blog and stream code sometimes.',
  tags: ['typescript', 'react', 'tailwind'],
};

export const USES = {
  hardware: [
    { name: 'mbp m2', tag: '32gb' },
    { name: 'mac mini m4', tag: '512gb' },
    { name: 'dell s3425dw', tag: '34" 21:9' },
    { name: 'iphone 17 pro', tag: '' },
    { name: 'ipad a16', tag: '11"' },
    { name: 'watch ultra 2', tag: '' },
    { name: 'apple tv', tag: '4k' },
  ],
  software: [
    { name: 'vscode', tag: 'editor' },
    { name: 'firefox', tag: 'browser' },
    { name: 'terminal', tag: 'macos' },
    { name: 'alfred', tag: 'launcher' },
  ],
  runtime: [
    { name: 'node', tag: 'primary' },
    { name: 'bun', tag: 'sometimes' },
    { name: 'workers', tag: 'cloudflare' },
  ],
};

export const SOCIALS = [
  { net: 'bluesky', handle: '@imlunahey.com', url: 'https://bsky.app/profile/imlunahey.com' },
  { net: 'github', handle: '@imlunahey', url: 'https://github.com/imlunahey' },
  { net: 'x', handle: '@imlunahey', url: 'https://x.com/imlunahey' },
  { net: 'twitch', handle: '@imlunahey', url: 'https://twitch.tv/imlunahey' },
  { net: 'discord', handle: '@imlunahey', url: null as string | null },
];

export const GITHUB_ACCOUNTS = ['imlunahey', 'lucid-softworks', 'omgimalexis'];

export const BSKY_ACCOUNTS = ['imlunahey.com', 'imlunahey.bsky.social', 'lucidsoft.works'];

export const STATUS = { focus: 'rewriting everything', dnd: true, backAt: '18:00', mood: 5 };

export type RepoStatus = 'active' | 'archived' | 'wip';

export type Repo = {
  owner: string;
  name: string;
  desc: string;
  lang: string;
  stars: number;
  forks: number;
  commits: number | null;
  updated: number; // days ago
  status: RepoStatus;
  kind?: 'app' | 'lib' | 'tool';
  launch?: string | null;
  source?: string | null;
  writeup?: string | null;
  pinned: boolean;
};

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

export type UsesItem = { name: string; config: string; note?: string };
export type UsesSection = {
  id: string;
  num: string;
  title: string;
  desc?: string;
  items: UsesItem[];
};

export const USES_META = {
  lastUpdated: 'apr 2026',
};

export const USES_SECTIONS: UsesSection[] = [
  {
    id: 'hardware',
    num: '01',
    title: 'hardware',
    desc: "the stuff with silicon in it. bought with money i don't always have.",
    items: [
      { name: 'macbook pro', config: 'm2 · 32gb', note: 'primary workhorse. fans never spin.' },
      { name: 'mac mini', config: 'm4 · 10c/10g · 512gb', note: 'second workstation. runs local ml workloads.' },
      {
        name: 'dell s3425dw',
        config: '34" · 21:9 · curved',
        note: 'finally back on external screens. had 5 before moving to the uk from aus.',
      },
      { name: 'iphone', config: '17 pro', note: 'got it near launch day. still at 96% max capacity.' },
      { name: 'ipad', config: 'a16 · 11"', note: 'for testing ios apps. the 7th gen i replaced was laggy as fuck.' },
      { name: 'apple watch', config: 'ultra 2', note: 'mainly for heart-rate monitoring. i have pots.' },
      { name: 'airpods max', config: 'usb-c', note: 'replaced my generic pair. wanted something nicer.' },
      { name: 'mx master 3s', config: 'mouse', note: "probably the best mouse i've used." },
      { name: 'apple tv', config: '4k · wi-fi + ethernet · 128gb', note: 'lounge room.' },
    ],
  },
  {
    id: 'editor',
    num: '02',
    title: 'editor',
    desc: 'text in, code out.',
    items: [
      { name: 'vscode', config: 'primary', note: "mostly for reviewing claude's diffs." },
      { name: 'nano', config: 'ssh', note: 'i hate vim.' },
    ],
  },
  {
    id: 'camera',
    num: '03',
    title: 'camera',
    desc: 'one of these actually gets used.',
    items: [
      { name: 'iphone 17 pro', config: 'main camera', note: 'most of my holiday pics.' },
      { name: 'gopro hero 10 black', config: 'action cam', note: 'bought it years ago. still hoping to actually use it.' },
    ],
  },
  {
    id: 'software',
    num: '04',
    title: 'software',
    desc: 'nothing fancy. everything reliable.',
    items: [
      { name: 'firefox', config: 'browser', note: 'blink sucks.' },
      { name: 'terminal', config: 'macos built-in', note: 'fast. quiet. native.' },
      { name: 'alfred', config: 'launcher', note: '6.4 launches/day since oct 2023.' },
      { name: '1password', config: 'password manager', note: "don't trust the others." },
    ],
  },
  {
    id: 'runtime',
    num: '05',
    title: 'runtime',
    desc: 'three engines, different jobs.',
    items: [
      { name: 'node', config: 'primary', note: 'always lts.' },
      { name: 'bun', config: 'sometimes', note: 'for things that need sqlite.' },
      { name: 'cloudflare workers', config: 'edge runtime', note: 'for serverless stuff.' },
    ],
  },
  {
    id: 'services',
    num: '06',
    title: 'services',
    desc: 'infra i actually trust.',
    items: [
      { name: 'cloudflare', config: 'dns + hosting', note: 'pro plan. ~100m req/month.' },
      { name: 'railway', config: 'hosting', note: 'bots and long-running services.' },
      { name: 'github', config: 'code', note: 'public repos.' },
      { name: '1password', config: 'secrets', note: 'grandfathered plan. not switching.' },
    ],
  },
];

export type PlaceKind = 'lived' | 'visited' | 'passed';

export type Place = {
  name: string;
  country: string; // iso-like, lowercase
  lat: number;
  lon: number;
  kind: PlaceKind;
  when: string; // free-form, e.g. '2019 → now' or '2024 layover'
  note?: string;
};

export const PLACES: Place[] = [
  // LIVED
  {
    name: 'adelaide',
    country: 'au',
    lat: -34.9285,
    lon: 138.6007,
    kind: 'lived',
    when: '1996 → jun 2016',
    note: 'childhood and early adulthood. left for london in late 2016.',
  },
  {
    name: 'london',
    country: 'uk',
    lat: 51.5074,
    lon: -0.1278,
    kind: 'lived',
    when: 'jun 2016 → oct 2016',
    note: 'was homeless for a bit.',
  },
  {
    name: 'adelaide',
    country: 'au',
    lat: -34.9285,
    lon: 138.6007,
    kind: 'lived',
    when: '2016 → 2025',
    note: 'got a job, saved money, and moved back to london.',
  },
  {
    name: 'london',
    country: 'uk',
    lat: 51.5074,
    lon: -0.1278,
    kind: 'lived',
    when: '2025 → now',
    note: 'the new home base.',
  },

  // VISITED
  {
    name: 'spain',
    country: 'es',
    lat: 40.4168,
    lon: -3.7038,
    kind: 'visited',
    when: '2025 oct',
    note: 'had a great time in barcelona. would like to go back and explore more of the country.',
  },
  {
    name: 'portugal',
    country: 'pt',
    lat: 39.3999,
    lon: -8.2245,
    kind: 'visited',
    when: '2025 oct',
    note: 'the country is so fucking beautiful, and the food was incredible.',
  },
  {
    name: "'s-hertogenbosch",
    country: 'nl',
    lat: 51.6978,
    lon: 5.3037,
    kind: 'visited',
    when: '2025 new years',
    note: 'first time seeing snow and eftling!',
  },
  {
    name: 'amsterdam',
    country: 'nl',
    lat: 52.3676,
    lon: 4.9041,
    kind: 'visited',
    when: '2026 feb',
    note: 'fell sick but was well worth the trip.',
  },

  // PASSED (layovers / trains through)
  { name: 'brussels', country: 'be', lat: 50.8503, lon: 4.3517, kind: 'passed', when: '2025 new years' },
];

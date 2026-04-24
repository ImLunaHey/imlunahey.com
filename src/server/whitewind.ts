import { createServerFn } from '@tanstack/react-start';
import { BSKY_ACCOUNTS } from '../data';
import { resolveIdentity } from './atproto';
import { cached, TTL } from './cache';

type ListRecordsResp = {
  records: Array<{
    uri: string;
    cid: string;
    value: {
      $type: 'com.whtwnd.blog.entry';
      title?: string;
      content: string;
      createdAt?: string;
      // Real lexicon enum — 'public' = indexable, 'url' = unlisted,
      // 'author' = author-only (effectively private/draft). Missing field
      // defaults to 'public' per the lexicon default.
      visibility?: 'public' | 'url' | 'author';
    };
  }>;
};

export type BlogEntry = {
  rkey: string;
  title: string;
  excerpt: string;
  createdAt: string;
  readMin: number;
  words: number;
};

export type BlogData = {
  entries: BlogEntry[];
  totalWords: number;
  since: number;
};

function plainText(md: string): string {
  return md
    .replace(/^---[\s\S]*?---/m, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function excerpt(content: string, max = 220): string {
  const t = plainText(content);
  if (t.length <= max) return t;
  const sliced = t.slice(0, max);
  return sliced.replace(/\s\S*$/, '') + '…';
}

async function loadEntries(): Promise<BlogData> {
  const handle = BSKY_ACCOUNTS[0];
  if (!handle) return { entries: [], totalWords: 0, since: 0 };
  const identity = await resolveIdentity(handle);
  if (!identity) return { entries: [], totalWords: 0, since: 0 };

  const { did, pds } = identity;
  const r = await fetch(
    `${pds}/xrpc/com.atproto.repo.listRecords?repo=${did}&collection=com.whtwnd.blog.entry&limit=100`,
  );
  if (!r.ok) return { entries: [], totalWords: 0, since: 0 };
  const data = (await r.json()) as ListRecordsResp;

  const entries = data.records
    // only listable entries: 'public' (indexable) or unset (lexicon default
    // is 'public'). 'url' and 'author' are unlisted / author-only — we
    // don't include them in the blog index or sitemap.
    .filter((rec) => (rec.value.visibility === 'public' || rec.value.visibility === undefined) && !!rec.value.title)
    .map((rec) => {
      const rkey = rec.uri.split('/').pop() ?? '';
      const words = plainText(rec.value.content).split(/\s+/).filter(Boolean).length;
      return {
        rkey,
        title: rec.value.title!,
        excerpt: excerpt(rec.value.content),
        createdAt: rec.value.createdAt ?? '',
        readMin: Math.max(1, Math.round(words / 200)),
        words,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalWords = entries.reduce((s, e) => s + e.words, 0);
  const since = entries.length ? Number(entries[entries.length - 1]!.createdAt.slice(0, 4)) : 0;

  return { entries, totalWords, since };
}

export const getBlogEntries = createServerFn({ method: 'GET' }).handler((): Promise<BlogData> =>
  cached('whitewind:entries', TTL.short, loadEntries).catch(() => ({
    entries: [],
    totalWords: 0,
    since: 0,
  })),
);

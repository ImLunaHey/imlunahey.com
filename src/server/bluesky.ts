import { createServerFn } from '@tanstack/react-start';
import { BSKY_ACCOUNTS } from '../data';
import { cached, TTL } from './cache';

const LIMIT_PER_ACCOUNT = 10;
const TOTAL_LIMIT = 10;

export type BskyPost = {
  handle: string;
  text: string;
  likes: number;
  replies: number;
  reposts: number;
  ts: string;
  url: string;
};

type FeedResp = {
  feed?: Array<{
    post: {
      uri: string;
      record?: { text?: string; createdAt?: string };
      likeCount?: number;
      replyCount?: number;
      repostCount?: number;
      indexedAt?: string;
      author: { handle: string };
    };
    reason?: unknown;
  }>;
};

async function fetchAccount(handle: string): Promise<BskyPost[]> {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${handle}&limit=${LIMIT_PER_ACCOUNT}&filter=posts_no_replies`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as FeedResp;
  const feed = data.feed ?? [];
  return feed
    .filter((f) => !f.reason && f.post.author.handle === handle && (f.post.record?.text ?? '').trim().length > 0)
    .map((f) => {
      const rkey = f.post.uri.split('/').pop() ?? '';
      return {
        handle,
        text: f.post.record?.text ?? '',
        likes: f.post.likeCount ?? 0,
        replies: f.post.replyCount ?? 0,
        reposts: f.post.repostCount ?? 0,
        ts: f.post.record?.createdAt ?? f.post.indexedAt ?? '',
        url: `https://bsky.app/profile/${handle}/post/${rkey}`,
      };
    });
}

export const getBskyPosts = createServerFn({ method: 'GET' }).handler((): Promise<BskyPost[]> =>
  cached('bsky:posts', TTL.short, async (): Promise<BskyPost[]> => {
    const results = await Promise.allSettled(BSKY_ACCOUNTS.map(fetchAccount));
    const merged: BskyPost[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') merged.push(...r.value);
    }
    merged.sort((a, b) => (b.ts > a.ts ? 1 : b.ts < a.ts ? -1 : 0));
    return merged.slice(0, TOTAL_LIMIT);
  }).catch(() => [] as BskyPost[]),
);

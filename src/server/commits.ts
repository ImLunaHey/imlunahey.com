import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';
import { authHeaders } from './github';

export type RecentCommit = { sha: string; msg: string; date: string };

type ApiCommit = {
  sha: string;
  commit: { message: string; author: { date: string } };
};

export const getRecentCommits = createServerFn({ method: 'GET' })
  .inputValidator((input: { owner: string; name: string }) => input)
  .handler(({ data }): Promise<RecentCommit[]> =>
    cached(`commits:${data.owner}/${data.name}`, TTL.medium, async () => {
      const res = await fetch(
        `https://api.github.com/repos/${data.owner}/${data.name}/commits?per_page=5`,
        { headers: authHeaders() },
      );
      if (!res.ok) return [];
      const body = (await res.json()) as ApiCommit[];
      return body.map((c) => ({
        sha: c.sha.slice(0, 7),
        msg: (c.commit.message.split('\n')[0] ?? '').slice(0, 120),
        date: c.commit.author.date,
      }));
    }),
  );

import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import UsesPage from '../../pages/Uses';
import { GITHUB_ACCOUNTS } from '../../data';
import { cached, TTL } from '../../server/cache';
import { authHeaders } from '../../server/github';

const getPublicRepoCount = createServerFn({ method: 'GET' }).handler((): Promise<number | null> =>
  cached('github:public-repo-count', TTL.medium, async () => {
    const results = await Promise.allSettled(
      GITHUB_ACCOUNTS.map(async (acct) => {
        const res = await fetch(`https://api.github.com/users/${acct}`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`github ${acct}: ${res.status}`);
        const data = (await res.json()) as { public_repos: number };
        return data.public_repos;
      }),
    );
    const counts = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    if (counts.length === 0) throw new Error('all github lookups failed');
    return counts.reduce((a, b) => a + b, 0);
  }).catch(() => null),
);

export const Route = createFileRoute('/_main/uses')({
  component: UsesPage,
  loader: async () => ({ publicRepos: await getPublicRepoCount() }),
  staleTime: TTL.medium,
});

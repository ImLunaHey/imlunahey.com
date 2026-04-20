import { createServerFn } from '@tanstack/react-start';
import { GITHUB_ACCOUNTS } from '../data';
import type { Repo } from '../data';
import { cached, TTL } from './cache';
import { authHeaders } from './github';

type ApiRepo = {
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  archived: boolean;
  fork: boolean;
  pushed_at: string;
  updated_at: string;
  owner: { login: string };
};

type PinnedResp = {
  data?: { user?: { pinnedItems?: { nodes: Array<{ name: string; owner: { login: string } }> } } };
};

export type ProjectStats = {
  repos: number;
  stars: number;
  forks: number;
  commits: number;
  active: number;
  languages: number;
};

export type RepoData = {
  repos: Repo[];
  stats: ProjectStats;
};

async function fetchAccountRepos(account: string): Promise<ApiRepo[]> {
  const out: ApiRepo[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(
      `https://api.github.com/users/${account}/repos?per_page=100&page=${page}&type=owner&sort=pushed`,
      { headers: authHeaders() },
    );
    if (!res.ok) throw new Error(`repos ${account}: ${res.status}`);
    const batch = (await res.json()) as ApiRepo[];
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function fetchPinned(account: string): Promise<string[]> {
  if (!process.env.GITHUB_TOKEN) return [];
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `{
        user(login: "${account}") {
          pinnedItems(first: 6, types: REPOSITORY) {
            nodes { ... on Repository { name, owner { login } } }
          }
        }
      }`,
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as PinnedResp;
  const nodes = data?.data?.user?.pinnedItems?.nodes ?? [];
  return nodes.map((n) => `${n.owner.login}/${n.name}`);
}

type CountsNode = {
  name: string;
  owner: { login: string };
  defaultBranchRef: {
    target:
      | {
          history: {
            totalCount: number;
            nodes: Array<{ committedDate: string }>;
          };
        }
      | null;
  } | null;
};
type CountsPage = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: CountsNode[];
};
type CountsResp = {
  data?: { repositoryOwner?: { repositories?: CountsPage } };
  errors?: Array<{ message: string }>;
};

export type RepoMeta = { count: number; lastCommitAt: string | null };

async function fetchCommitCounts(account: string): Promise<Map<string, RepoMeta>> {
  if (!process.env.GITHUB_TOKEN) return new Map();
  const out = new Map<string, RepoMeta>();
  let cursor: string | null = null;
  for (let p = 0; p < 10; p++) {
    const query = `query($login: String!, $cursor: String) {
      repositoryOwner(login: $login) {
        ... on User {
          repositories(first: 100, after: $cursor, ownerAffiliations: OWNER, isFork: false) {
            pageInfo { hasNextPage, endCursor }
            nodes {
              name
              owner { login }
              defaultBranchRef { target { ... on Commit { history(first: 1) { totalCount nodes { committedDate } } } } }
            }
          }
        }
        ... on Organization {
          repositories(first: 100, after: $cursor, isFork: false) {
            pageInfo { hasNextPage, endCursor }
            nodes {
              name
              owner { login }
              defaultBranchRef { target { ... on Commit { history(first: 1) { totalCount nodes { committedDate } } } } }
            }
          }
        }
      }
    }`;
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { login: account, cursor } }),
    });
    if (!res.ok) {
      console.error(`commit-counts http ${account}: ${res.status}`);
      break;
    }
    const data = (await res.json()) as CountsResp;
    if (data.errors?.length) console.error(`commit-counts graphql ${account}:`, data.errors);
    const page = data?.data?.repositoryOwner?.repositories;
    if (!page) break;
    for (const n of page.nodes) {
      const hist = n.defaultBranchRef?.target?.history;
      if (!hist) continue;
      const lastCommitAt = hist.nodes[0]?.committedDate ?? null;
      out.set(`${n.owner.login}/${n.name}`, { count: hist.totalCount, lastCommitAt });
    }
    if (!page.pageInfo.hasNextPage) break;
    cursor = page.pageInfo.endCursor;
  }
  return out;
}

function normalize(api: ApiRepo, pinned: Set<string>, commits: Map<string, RepoMeta>): Repo {
  const now = Date.now();
  const key = `${api.owner.login}/${api.name}`;
  const meta = commits.get(key);
  const lastCommitIso = meta?.lastCommitAt ?? api.pushed_at ?? api.updated_at;
  const lastCommit = new Date(lastCommitIso).getTime();
  return {
    owner: api.owner.login,
    name: api.name,
    desc: api.description ?? '',
    lang: (api.language ?? 'unknown').toLowerCase(),
    stars: api.stargazers_count,
    forks: api.forks_count,
    commits: meta?.count ?? null,
    updated: Math.max(0, Math.floor((now - lastCommit) / (1000 * 60 * 60 * 24))),
    status: api.archived ? 'archived' : 'active',
    source: api.html_url,
    launch: api.homepage || null,
    pinned: pinned.has(key),
  };
}

function computeStats(repos: Repo[]): ProjectStats {
  return {
    repos: repos.length,
    stars: repos.reduce((s, r) => s + r.stars, 0),
    forks: repos.reduce((s, r) => s + r.forks, 0),
    commits: repos.reduce((s, r) => s + (r.commits ?? 0), 0),
    active: repos.filter((r) => r.status === 'active').length,
    languages: new Set(repos.map((r) => r.lang).filter((l) => l && l !== 'unknown')).size,
  };
}

export const getAllRepos = createServerFn({ method: 'GET' }).handler((): Promise<RepoData> =>
  cached('repos:all', TTL.medium, async () => {
    const [repoResults, pinnedResults, countResults] = await Promise.all([
      Promise.allSettled(GITHUB_ACCOUNTS.map((a) => fetchAccountRepos(a))),
      Promise.allSettled(GITHUB_ACCOUNTS.map((a) => fetchPinned(a))),
      Promise.allSettled(GITHUB_ACCOUNTS.map((a) => fetchCommitCounts(a))),
    ]);

    const allApi: ApiRepo[] = [];
    const pinnedSet = new Set<string>();
    const commitCounts = new Map<string, RepoMeta>();
    for (const r of repoResults) {
      if (r.status === 'fulfilled') allApi.push(...r.value);
    }
    for (const p of pinnedResults) {
      if (p.status === 'fulfilled') p.value.forEach((n) => pinnedSet.add(n));
    }
    for (const c of countResults) {
      if (c.status === 'fulfilled') c.value.forEach((v, k) => commitCounts.set(k, v));
    }

    const accountPriority = new Map(GITHUB_ACCOUNTS.map((a, i) => [a, i]));
    const repos = allApi
      .filter((r) => !r.fork)
      .map((r) => normalize(r, pinnedSet, commitCounts))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        const ao = accountPriority.get(a.owner) ?? 999;
        const bo = accountPriority.get(b.owner) ?? 999;
        if (ao !== bo) return ao - bo;
        return b.stars - a.stars;
      });

    return { repos, stats: computeStats(repos) };
  }),
);

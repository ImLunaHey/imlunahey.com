import { createServerFn } from '@tanstack/react-start';
import { cached, TTL } from './cache';
import { authHeaders } from './github';

const PRIMARY_ACCOUNT = 'imlunahey';

export type ContribDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };

export type Contributions = {
  weeks: ContribDay[][];
  totalContributions: number;
  longestStreak: number;
  rangeStart: string;
  rangeEnd: string;
};

const LEVEL: Record<string, 0 | 1 | 2 | 3 | 4> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

type GqlResp = {
  data?: {
    user?: {
      contributionsCollection?: {
        contributionCalendar: {
          totalContributions: number;
          weeks: Array<{
            contributionDays: Array<{
              date: string;
              contributionCount: number;
              contributionLevel: string;
            }>;
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
};

function longestConsecutive(days: ContribDay[]): number {
  let max = 0;
  let run = 0;
  for (const d of days) {
    if (d.count > 0) {
      run += 1;
      if (run > max) max = run;
    } else {
      run = 0;
    }
  }
  return max;
}

async function loadContribs(): Promise<Contributions | null> {
  if (!process.env.GITHUB_TOKEN) return null;
  const now = new Date();
  const to = now.toISOString();
  const from = new Date(now.getTime() - 364 * 24 * 60 * 60 * 1000).toISOString();

  const query = `query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }`;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: PRIMARY_ACCOUNT, from, to } }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as GqlResp;
  if (data.errors?.length) console.error('contribs graphql:', data.errors);

  const calendar = data?.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) return null;

  const weeks: ContribDay[][] = calendar.weeks.map((w) =>
    w.contributionDays.map((d) => ({
      date: d.date,
      count: d.contributionCount,
      level: LEVEL[d.contributionLevel] ?? 0,
    })),
  );

  const flat = weeks.flat();
  const rangeStart = flat[0]?.date ?? '';
  const rangeEnd = flat[flat.length - 1]?.date ?? '';

  return {
    weeks,
    totalContributions: calendar.totalContributions,
    longestStreak: longestConsecutive(flat),
    rangeStart,
    rangeEnd,
  };
}

export const getContributions = createServerFn({ method: 'GET' }).handler((): Promise<Contributions | null> =>
  cached('github:contribs', TTL.medium, loadContribs).catch(() => null),
);

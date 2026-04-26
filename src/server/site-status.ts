import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';

// "what state is luna in right now" — driven by an iOS Shortcut that
// fires on Focus / Sleep / DND changes and POSTs to /api/status. The
// page reads it via the server fn below, falling back to the static
// STATUS const in src/data.ts when nothing has been pushed.

export type SiteStatus = {
  /** true when luna is in any focus / DND / sleep mode */
  dnd: boolean;
  /** focus label — "sleep", "work", "off-by-one", whatever the
   *  shortcut sends. shown on the home-page cell during DND. */
  focus?: string;
  /** wall-clock string ("08:00") of when she'll be back, or null
   *  when the shortcut doesn't supply one (e.g. ad-hoc DND with no
   *  scheduled end). */
  backAt?: string;
  /** server-side timestamp of the most recent push, in ms epoch.
   *  page can use this to show "as of N min ago". */
  ts: number;
};

const KV_KEY = 'site:status';

export const getSiteStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SiteStatus | null> => {
    const kv = env.HOMELAB;
    if (!kv) return null;
    const blob = await kv.get<SiteStatus>(KV_KEY, { type: 'json' });
    return blob ?? null;
  },
);

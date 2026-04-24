import { createFileRoute } from '@tanstack/react-router';
import MahjongPage from '../../../pages/labs/Mahjong';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/mahjong')({
  component: MahjongPage,
  head: () => pageMeta('lab/mahjong'),
  // seed is a uint32 that bakes in both the layout (high 2 bits) and the
  // rng for the deal (low 30 bits). a single shareable number = a single
  // specific game. layout is derived, never set independently.
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.seed;
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    return {
      seed: Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? (n >>> 0) : undefined,
    };
  },
});

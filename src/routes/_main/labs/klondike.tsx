import { createFileRoute } from '@tanstack/react-router';
import KlondikePage from '../../../pages/labs/Klondike';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/klondike')({
  component: KlondikePage,
  head: () => pageMeta('lab/klondike'),
  validateSearch: (search: Record<string, unknown>) => {
    const raw = search.seed;
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
    return {
      seed: Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? (n >>> 0) : undefined,
    };
  },
});

import { createFileRoute } from '@tanstack/react-router';
import GermCardPage from '../../../../pages/labs/GermCard';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/germ-card/')({
  component: GermCardPage,
  head: () => pageMeta('lab/germ-card'),
});

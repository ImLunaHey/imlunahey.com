import { createFileRoute } from '@tanstack/react-router';
import LightningPage from '../../../pages/labs/Lightning';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/lightning')({
  component: LightningPage,
  head: () => pageMeta('lab/lightning'),
});

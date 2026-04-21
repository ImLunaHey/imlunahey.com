import { createFileRoute } from '@tanstack/react-router';
import CssBattlesPage from '../../../../pages/labs/CssBattles';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/css-battles/')({
  component: CssBattlesPage,
  head: () => pageMeta('lab/css-battles'),
});

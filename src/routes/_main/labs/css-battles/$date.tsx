import { createFileRoute } from '@tanstack/react-router';
import CssBattlePage from '../../../../pages/labs/CssBattle';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/css-battles/$date')({
  component: CssBattlePage,
  head: () => pageMeta('lab/css-battles'),
});

import { createFileRoute } from '@tanstack/react-router';
import AtriumPage from '../../../pages/labs/Atrium';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/atrium')({
  component: AtriumPage,
  head: () => pageMeta('lab/atrium'),
});

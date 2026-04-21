import { createFileRoute } from '@tanstack/react-router';
import LabsPage from '../../../pages/Labs';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/')({
  component: LabsPage,
  head: () => pageMeta('labs'),
});

import { createFileRoute } from '@tanstack/react-router';
import MatrixPage from '../../../pages/labs/Matrix';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/matrix')({
  component: MatrixPage,
  head: () => pageMeta('lab/matrix'),
});

import { createFileRoute } from '@tanstack/react-router';
import CvPage from '../../pages/Cv';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/cv')({
  component: CvPage,
  head: () => pageMeta('cv'),
});

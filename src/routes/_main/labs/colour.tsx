import { createFileRoute } from '@tanstack/react-router';
import ColourPage from '../../../pages/labs/Colour';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/colour')({
  component: ColourPage,
  head: () => pageMeta('lab/colour'),
});

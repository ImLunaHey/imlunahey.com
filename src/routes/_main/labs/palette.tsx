import { createFileRoute } from '@tanstack/react-router';
import PalettePage from '../../../pages/labs/Palette';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/palette')({
  component: PalettePage,
  head: () => pageMeta('lab/palette'),
});

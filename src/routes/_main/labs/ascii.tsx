import { createFileRoute } from '@tanstack/react-router';
import AsciiPage from '../../../pages/labs/Ascii';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/ascii')({
  component: AsciiPage,
  head: () => pageMeta('lab/ascii'),
});

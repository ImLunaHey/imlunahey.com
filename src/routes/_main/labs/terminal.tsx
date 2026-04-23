import { createFileRoute } from '@tanstack/react-router';
import TerminalPage from '../../../pages/labs/Terminal';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/terminal')({
  component: TerminalPage,
  head: () => pageMeta('lab/terminal'),
});

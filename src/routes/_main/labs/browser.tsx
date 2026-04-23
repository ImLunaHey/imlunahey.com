import { createFileRoute } from '@tanstack/react-router';
import BrowserPage from '../../../pages/labs/Browser';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/browser')({
  component: BrowserPage,
  head: () => pageMeta('lab/browser'),
});

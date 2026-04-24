import { createFileRoute } from '@tanstack/react-router';
import HomePage from '../../pages/Home';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/')({
  component: HomePage,
  // Home page meta + canonical. Every other route calls pageMeta() in
  // its own head() which overrides the short fallback emitted by
  // __root; without this, the home page was the one remaining route
  // still shipping the short description Ahrefs was flagging.
  head: () => pageMeta('home'),
});

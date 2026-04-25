import { createFileRoute } from '@tanstack/react-router';
import HomelabPage from '../../pages/Homelab';
import { pageMeta } from '../../lib/og-meta';
import { getHomelabState } from '../../server/homelab';

export const Route = createFileRoute('/_main/homelab')({
  // Loader runs on SSR + client. Returns the empty snapshot when KV is
  // unbound or has never been written — the page falls back to its
  // editorial defaults in that case rather than rendering blank.
  loader: () => getHomelabState(),
  component: HomelabPage,
  head: () => pageMeta('homelab'),
});

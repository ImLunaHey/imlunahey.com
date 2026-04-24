import { createFileRoute } from '@tanstack/react-router';
import MastodonPage from '../../../pages/labs/Mastodon';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/mastodon')({
  component: MastodonPage,
  head: () => pageMeta('lab/mastodon'),
});

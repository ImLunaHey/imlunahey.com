import { createFileRoute } from '@tanstack/react-router';
import BskyComposerPage from '../../../pages/labs/BskyComposer';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/bsky-composer')({
  component: BskyComposerPage,
  head: () => pageMeta('lab/bsky-composer'),
});

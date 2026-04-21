import { createFileRoute } from '@tanstack/react-router';
import MusicPage from '../../pages/Music';
import { pageMeta } from '../../lib/og-meta';

export const Route = createFileRoute('/_main/music')({
  component: MusicPage,
  head: () => pageMeta('music'),
});

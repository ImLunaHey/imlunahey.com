import { createFileRoute } from '@tanstack/react-router';
import GamesPage from '../../../pages/Games';
import { pageMeta } from '../../../lib/og-meta';

export const Route = createFileRoute('/_main/games/')({
  component: GamesPage,
  head: () => pageMeta('games'),
});

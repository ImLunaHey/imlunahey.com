import { createFileRoute } from '@tanstack/react-router';
import GamesPage from '../../../pages/Games';
import { getPopfeedGames } from '../../../server/popfeed';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/games/')({
  component: GamesPage,
  loader: () => ({ games: getPopfeedGames() }),
  staleTime: TTL.short,
});

import { createFileRoute } from '@tanstack/react-router';
import ReviewDetailPage from '../../../pages/ReviewDetail';
import { getPopfeedGames } from '../../../server/popfeed';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/games/$rkey')({
  component: () => <ReviewDetailPage kind="game" backTo="/games" />,
  loader: () => ({ data: getPopfeedGames() }),
  staleTime: TTL.short,
});

import { createFileRoute } from '@tanstack/react-router';
import ReviewDetailPage from '../../../pages/ReviewDetail';
import { getPopfeedWatches } from '../../../server/popfeed';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/watching/$rkey')({
  component: () => <ReviewDetailPage kind="watch" backTo="/watching" />,
  loader: () => ({ data: getPopfeedWatches() }),
  staleTime: TTL.short,
});

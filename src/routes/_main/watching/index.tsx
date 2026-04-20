import { createFileRoute } from '@tanstack/react-router';
import WatchingPage from '../../../pages/Watching';
import { getPopfeedWatches } from '../../../server/popfeed';
import { TTL } from '../../../server/cache';

export const Route = createFileRoute('/_main/watching/')({
  component: WatchingPage,
  loader: () => ({ watches: getPopfeedWatches() }),
  staleTime: TTL.short,
});

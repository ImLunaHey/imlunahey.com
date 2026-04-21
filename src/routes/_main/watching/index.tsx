import { createFileRoute } from '@tanstack/react-router';
import WatchingPage from '../../../pages/Watching';

export const Route = createFileRoute('/_main/watching/')({
  component: WatchingPage,
});

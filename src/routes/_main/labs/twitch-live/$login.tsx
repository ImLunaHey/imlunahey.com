import { createFileRoute } from '@tanstack/react-router';
import TwitchLiveDetailPage from '../../../../pages/labs/TwitchLiveDetail';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/twitch-live/$login')({
  component: TwitchLiveDetailPage,
  head: () => pageMeta('lab/twitch-live'),
});

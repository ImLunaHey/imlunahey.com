import { createFileRoute } from '@tanstack/react-router';
import TwitchLivePage from '../../../../pages/labs/TwitchLive';
import { pageMeta } from '../../../../lib/og-meta';

export const Route = createFileRoute('/_main/labs/twitch-live/')({
  component: TwitchLivePage,
  head: () => pageMeta('lab/twitch-live'),
  validateSearch: (search: Record<string, unknown>) => ({
    game: typeof search.game === 'string' ? search.game : undefined,
    lang: typeof search.lang === 'string' ? search.lang : undefined,
  }),
});

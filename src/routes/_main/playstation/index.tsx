import { createFileRoute } from '@tanstack/react-router';
import PlaystationPage from '../../../pages/Playstation';
import { pageMeta } from '../../../lib/og-meta';
import { getPlaystationLibrary } from '../../../server/playstation';

export const Route = createFileRoute('/_main/playstation/')({
  loader: () => getPlaystationLibrary(),
  component: PlaystationPage,
  head: () => pageMeta('playstation'),
});

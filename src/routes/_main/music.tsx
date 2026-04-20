import { createFileRoute } from '@tanstack/react-router';
import MusicPage from '../../pages/Music';
import { getRecentTracks } from '../../server/lastfm';
import { TTL } from '../../server/cache';

export const Route = createFileRoute('/_main/music')({
  component: MusicPage,
  loader: () => ({ music: getRecentTracks() }),
  staleTime: TTL.short,
});

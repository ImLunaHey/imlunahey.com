import { createFileRoute } from '@tanstack/react-router';
import HomePage from '../../pages/Home';
import { getAllRepos } from '../../server/repos';
import { getContributions } from '../../server/contributions';
import { getBskyPosts } from '../../server/bluesky';
import { getRecentTrack } from '../../server/lastfm';
import { getBlogEntries } from '../../server/whitewind';
import { getWeather } from '../../server/weather';
import { getPopfeedWatches } from '../../server/popfeed';
import { TTL } from '../../server/cache';

export const Route = createFileRoute('/_main/')({
  component: HomePage,
  loader: () => ({
    repoData: getAllRepos(),
    contribs: getContributions(),
    bskyPosts: getBskyPosts(),
    lastTrack: getRecentTrack(),
    blog: getBlogEntries(),
    weather: getWeather(),
    watches: getPopfeedWatches(),
  }),
  staleTime: TTL.short,
});

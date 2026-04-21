import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { getRecentTrack } from '../server/lastfm';

const POLL_MS = 20_000;

export function LiveMusicPanel({ skeleton }: { skeleton: React.ReactNode }) {
  const { data: track, isPending } = useQuery({
    queryKey: ['lastfm', 'recent'],
    queryFn: () => getRecentTrack(),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS,
  });

  if (isPending) return <>{skeleton}</>;

  if (track === null || track === undefined) {
    return (
      <div className="music-wrap idle">
        <div className="music-top">
          <div className="music-art" />
          <div className="music-meta">
            <div className="label">not configured</div>
            <div className="music-artist">set LASTFM_API_KEY</div>
          </div>
        </div>
      </div>
    );
  }

  if (!track.nowPlaying) {
    return (
      <div className="music-wrap idle">
        <div className="music-top">
          <div className="music-art" />
          <div className="music-meta">
            <div className="label">not listening to anything</div>
          </div>
        </div>
        <Link to={'/music' as never} className="see-all">
          full history →
        </Link>
      </div>
    );
  }

  return (
    <div className="music-wrap">
      <div className="music-top">
        <div
          className="music-art"
          style={track.art ? { backgroundImage: `url(${track.art})`, backgroundSize: 'cover' } : undefined}
        />
        <div className="music-meta">
          <div className="label">now playing</div>
          <a className="music-track" href={track.url} target="_blank" rel="noopener noreferrer">
            {track.track.toLowerCase()}
          </a>
          <a className="music-artist" href={track.artistUrl} target="_blank" rel="noopener noreferrer">
            {track.artist.toLowerCase()}
          </a>
        </div>
      </div>
      <div className="music-bars playing">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>
      <Link to={'/music' as never} className="see-all">
        full history →
      </Link>
    </div>
  );
}

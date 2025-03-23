import { useRef, useEffect, useState, memo } from 'react';
import { Star } from 'lucide-react';
import { useTheMovieDBImage } from '../hooks/use-themoviedb-image';
import { cn } from '../cn';

const MoviePosterSkeleton = () => <div className="size-full bg-gray-200 min-h-[200px] animate-pulse" />;

const Rating = ({ rating }: { rating: number }) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/50 text-white text-sm">
      <div className="flex items-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn('size-4 text-yellow-500', i < rating ? 'fill-yellow-500' : 'fill-black')} />
        ))}
      </div>
    </div>
  );
};
const MoviePosterInner = memo(function MoviePoster({
  movieId,
  size = 'w500',
  rating,
}: {
  movieId: string;
  size?: 'w500' | 'original';
  rating: number;
}) {
  const { data, isLoading, error } = useTheMovieDBImage('movie', movieId);
  const poster = data?.posters?.[0];

  if (isLoading) return <MoviePosterSkeleton />;
  if (error) return <div>Error loading poster</div>;
  if (!poster) return null;

  return (
    <div className="relative">
      <a href={`https://www.themoviedb.org/movie/${movieId}`} target="_blank">
        <img
          src={`https://image.tmdb.org/t/p/${size}/${poster.file_path}`}
          height={poster.height}
          width={poster.width}
          loading="lazy"
          className="w-full h-full object-cover aspect-[2/3]"
        />
      </a>
      <Rating rating={rating} />
    </div>
  );
});

export const MoviePoster = ({ movieId, rating }: { movieId: string; rating: number }) => {
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={ref} className="rounded-lg overflow-hidden">
      {hasBeenVisible ? <MoviePosterInner movieId={movieId} rating={rating} /> : <MoviePosterSkeleton />}
    </div>
  );
};

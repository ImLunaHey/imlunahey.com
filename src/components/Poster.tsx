import { useEffect, useRef, useState } from 'react';
import { StarRating } from './StarRating';
import { Skeleton } from './Skeleton';

export const Poster = ({
  link,
  imageUrl,
  title,
  rating,
  height,
  width,
  loading,
}: {
  link: string;
  imageUrl: string;
  title?: string;
  rating: number;
  height: number;
  width: number;
  loading: boolean;
}) => {
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
    <div ref={ref} className="min-h-[200px] min-w-[150px] overflow-hidden">
      {hasBeenVisible && !loading ? (
        <div className="relative">
          <a href={link} target="_blank" aria-label={title ? `${title} — open` : 'open'}>
            <img
              src={imageUrl}
              alt={title ? `${title} poster` : ''}
              height={height}
              width={width}
              loading="lazy"
              className="aspect-[2/3] h-full w-full object-cover"
            />
          </a>
          <StarRating rating={rating} />
        </div>
      ) : (
        <Skeleton className="min-h-24">{loading ? 'Loading...' : 'No image found'}</Skeleton>
      )}
    </div>
  );
};

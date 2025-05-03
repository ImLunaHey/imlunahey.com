import { useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { Loading } from '../components/Loading';
import { cn } from '../cn';

export const Image = ({ src, alt }: { src?: string; alt?: string }) => {
  const [error, setError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!src) return null;

  return (
    <div className="flex min-h-56 flex-col items-center justify-center gap-2">
      {isLoading ? (
        <Skeleton className="min-h-56">
          <Loading />
        </Skeleton>
      ) : error ? (
        <Skeleton className="min-h-56">Error loading image</Skeleton>
      ) : null}
      <img
        src={src}
        alt={alt}
        onError={() => setError(true)}
        onLoad={() => setIsLoading(false)}
        className={cn('m-1 border', isLoading && 'hidden')}
      />
      <div className="text-xs text-gray-200">{alt}</div>
    </div>
  );
};

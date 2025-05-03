import { Star } from 'lucide-react';
import { cn } from '../cn';

export const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="absolute right-0 bottom-0 left-0 bg-black/50 p-2 text-sm text-white">
      <div className="flex items-center justify-center gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn('text-yellow size-4', i < rating ? 'fill-yellow' : 'fill-black')} />
        ))}
      </div>
    </div>
  );
};

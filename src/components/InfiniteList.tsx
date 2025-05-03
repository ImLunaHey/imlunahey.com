import { Button } from '../elements/Button';

export function InfiniteList<T>({
  items,
  fetchMore,
  children,
  className,
}: {
  items: T[];
  fetchMore: () => void;
  children: (item: T) => React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {items.map(children)}
      <Button onClick={fetchMore}>Load more</Button>
    </div>
  );
}

import * as Ariakit from '@ariakit/react';
import { cn } from '../cn';

const RadioItem = ({ item }: { item: { label: string; value: string } }) => {
  return (
    <label key={item.value} className="flex cursor-pointer items-center gap-2">
      <Ariakit.Radio className="peer sr-only" value={item.value} />
      <span
        className={cn([
          'relative inline-block size-4 flex-shrink-0 border border-gray-400',
          'peer-checked:border-white',
          'after:absolute after:top-1/2 after:left-1/2 after:hidden after:size-2',
          'after:-translate-x-1/2 after:-translate-y-1/2 after:bg-white',
          'peer-checked:after:block',
        ])}
      />
      {item.label}
    </label>
  );
};

export const RadioGroup = ({
  items,
  direction,
}: {
  items: { label: string; value: string }[];
  direction: 'vertical' | 'horizontal';
}) => {
  return (
    <Ariakit.RadioProvider>
      <Ariakit.RadioGroup className={cn('flex gap-2', direction === 'horizontal' ? 'flex-row' : 'flex-col')}>
        {items.map((item) => (
          <RadioItem key={item.value} item={item} />
        ))}
      </Ariakit.RadioGroup>
    </Ariakit.RadioProvider>
  );
};

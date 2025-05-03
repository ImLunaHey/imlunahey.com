import * as Ariakit from '@ariakit/react';
import { cn } from '../cn';
import { useState } from 'react';

export const Select = ({
  label,
  items,
  disabled,
  className,
}: {
  label: string;
  items: { label: string; value: string; disabled?: boolean }[];
  disabled?: boolean;
  className?: string;
}) => {
  const [selectedValue, setSelectedValue] = useState(items[0].value);
  return (
    <div className="wrapper">
      <Ariakit.SelectProvider value={selectedValue} setValue={setSelectedValue} setValueOnMove>
        <Ariakit.SelectLabel>{label}</Ariakit.SelectLabel>
        <Ariakit.Select
          accessibleWhenDisabled
          className={cn(
            'flex items-center justify-between p-1',
            'border-primary w-full cursor-pointer border',
            'focus:ring-primary focus:ring-2 focus:outline-none',
            'hover:bg-secondary hover:text-white',
            disabled && 'opacity-50 hover:cursor-not-allowed hover:bg-transparent',
            className,
          )}
        >
          {items.find((option) => option.value === selectedValue)?.label}
          <Ariakit.SelectArrow />
        </Ariakit.Select>
        <Ariakit.SelectPopover sameWidth className="bg-black">
          {items.map((item) => (
            <Ariakit.SelectItem
              key={item.value}
              value={item.value}
              disabled={item.disabled}
              accessibleWhenDisabled
              className={cn(
                'flex items-center justify-between p-1',
                'border-primary w-full cursor-pointer border',
                'focus:ring-primary focus:ring-2 focus:outline-none',
                'hover:bg-secondary hover:text-white',
                item.disabled && 'opacity-50 hover:cursor-not-allowed hover:bg-transparent',
              )}
            >
              {item.label}
            </Ariakit.SelectItem>
          ))}
        </Ariakit.SelectPopover>
      </Ariakit.SelectProvider>
    </div>
  );
};

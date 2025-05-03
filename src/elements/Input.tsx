import { useId, useState } from 'react';
import { cn } from '../cn';

export const Input = function <T extends string = string>({
  value,
  placeholder,
  label,
  onChangeValue,
  onChange,
  required,
  disabled,
  onSubmit,
  type,
  accept,
  ref,
}: {
  value?: T | null;
  placeholder: string;
  label: string;
  onChangeValue?: (value: string) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  onSubmit?: () => void;
  type?: string;
  required?: boolean;
  accept?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const id = useId();
  const [localValue, setLocalValue] = useState(value ?? '');

  return (
    <div className="flex flex-col text-sm">
      <label htmlFor={id}>{label}</label>
      <input
        ref={ref}
        type={type}
        id={id}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value);
          onChangeValue?.(e.target.value);
          onChange?.(e);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={cn(
          'border-primary w-full border p-1',
          'focus:ring-primary focus:ring-2 focus:outline-none',
          disabled && 'opacity-50',
          required && 'border-red',
        )}
        accept={accept}
      />
    </div>
  );
};

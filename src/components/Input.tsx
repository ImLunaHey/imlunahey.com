import { forwardRef } from 'react';
import { cn } from '../cn';

export const Input = forwardRef(
  ({
    value,
    onChangeValue,
    onChange,
    placeholder,
    required,
    disabled,
    onSubmit,
    type,
    accept,
  }: {
    value?: string;
    onChangeValue?: (value: string) => void;
    onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
    disabled?: boolean;
    onSubmit?: () => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    accept?: string;
  }) => {
    return (
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChangeValue?.(e.target.value);
          onChange?.(e);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={cn('w-full p-2 border border-[#1a1a1a]', disabled && 'opacity-50', required && 'required:border-red-500')}
        accept={accept}
      />
    );
  },
);

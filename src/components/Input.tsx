import { cn } from '../cn';

export const Input = function <T extends string = string>({
  value,
  onChangeValue,
  onChange,
  placeholder,
  required,
  disabled,
  onSubmit,
  type,
  accept,
  ref,
}: {
  value: T | null;
  onChangeValue?: (value: string) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  onSubmit?: () => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  accept?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <input
      ref={ref}
      type={type}
      placeholder={placeholder}
      value={value ?? ''}
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
};

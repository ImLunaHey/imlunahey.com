import { cn } from '../cn';

export const Button = ({
  children,
  onClick,
  disabled,
  className,
  label,
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  type?: 'button' | 'submit';
}) => {
  return (
    <button
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.();
      }}
      className={cn(
        'border-primary w-full cursor-pointer border p-1',
        'focus:ring-primary focus:ring-2 focus:outline-none',
        'hover:bg-secondary hover:text-white',
        disabled && 'opacity-50 hover:cursor-not-allowed hover:bg-transparent',
        className,
      )}
      aria-disabled={disabled}
      type={type}
      aria-label={label}
    >
      {children}
    </button>
  );
};

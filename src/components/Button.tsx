import { cn } from '../cn';

export const Button = ({
  children,
  onClick,
  disabled,
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => {
  return (
    <button
      onClick={onClick}
      className={cn('w-full p-2 border border-[#1a1a1a] hover:bg-[#1a1a1a] cursor-pointer', disabled && 'opacity-50')}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  );
};

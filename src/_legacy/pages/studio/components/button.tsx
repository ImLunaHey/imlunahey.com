import { cn } from '../../../cn';

type ButtonProps = React.ComponentProps<'button'> & {
  active?: boolean;
};

export const Button = ({ active, className, ...props }: ButtonProps) => {
  const baseStyles = 'border rounded px-2 active:scale-95 w-fit';
  const disabledStyles = 'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100';
  const lightStyles = 'bg-white text-black border-[#e4e4e7] hover:bg-[#f1f1f3] hover:border-[#e4e4e7]';
  const darkStyles =
    'dark:bg-[#111214] dark:text-white dark:border-[#222327] hover:dark:bg-[#222327] hover:dark:border-[#111214]';

  return (
    <button
      className={cn(
        baseStyles,
        disabledStyles,
        lightStyles,
        darkStyles,
        active && 'border-[#e4e4e7] bg-[#f1f1f3]',
        active && 'dark:border-[#111214] dark:bg-[#222327]',
        className,
      )}
      {...props}
    />
  );
};

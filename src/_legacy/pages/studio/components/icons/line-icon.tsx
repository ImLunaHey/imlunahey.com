import { cn } from '../../../../cn';

type LineIconProps = {
  className?: string;
};

export const LineIcon = ({ className }: LineIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={cn('h-8 w-8 stroke-black dark:stroke-white', className)}
    >
      <path d="M3.293 20.707a1 1 0 010-1.414l16-16a1 1 0 111.414 1.414l-16 16a1 1 0 01-1.414 0z" />
    </svg>
  );
};

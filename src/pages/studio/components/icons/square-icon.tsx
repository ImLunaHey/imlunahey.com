import { cn } from '../../../../cn';

type SquareIconProps = {
  className?: string;
};

export const SquareIcon = ({ className }: SquareIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={cn('h-8 w-8 stroke-black dark:stroke-white', className)}
    >
      <rect
        width="16"
        height="16"
        x="4"
        y="4"
        stroke="currentColor"
        fill="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        rx="2"
      />
    </svg>
  );
};

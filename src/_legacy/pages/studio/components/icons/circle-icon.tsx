import { cn } from '../../../../cn';

type CircleIconProps = {
  className?: string;
};

export const CircleIcon = ({ className }: CircleIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      className={cn('h-6 w-6 fill-black stroke-black dark:fill-white dark:stroke-white', className)}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
};

import { cn } from '../../../../cn';

type ArrowIconProps = {
  className?: string;
};

export const ArrowIcon = ({ className }: ArrowIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      className={cn('h-6 w-6 fill-black stroke-black dark:fill-white dark:stroke-white', className)}
    >
      <path
        stroke="currentColour"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M6 12h12m0 0l-5-5m5 5l-5 5"
      />
    </svg>
  );
};

import { cn } from '../../../../cn';

type EyeOpenIconProps = {
  className?: string;
};

export const EyeOpenIcon = ({ className }: EyeOpenIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn('h-4 w-4 stroke-white dark:stroke-black', className)}
    >
      <circle
        r="2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transform="translate(12 12)"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M10 0C7.333 4.667 4 7 0 7s-7.333-2.333-10-7c2.667-4.667 6-7 10-7s7.333 2.333 10 7"
        transform="translate(12 12)"
      />
    </svg>
  );
};

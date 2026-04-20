import { cn } from '../../../../cn';

type EyeClosedIconProps = {
  className?: string;
};

export const EyeClosedIcon = ({ className }: EyeClosedIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn('h-4 w-4 stroke-white dark:stroke-black', className)}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M-9 -9L9 9"
        transform="translate(12 12) translate(-.5 -.5)"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M-1.116-1.703a2 2 0 102.828 2.83"
        transform="translate(12 12) translate(-.8 -.21)"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M-2.637-6.635A9.466 9.466 0 010-7c4 0 7.333 2.333 10 7-.778 1.361-1.612 2.524-2.503 3.488m-2.14 1.861C3.726 6.449 1.942 7 0 7c-4 0-7.333-2.333-10-7 1.369-2.395 2.913-4.175 4.632-5.341"
        transform="translate(12 12) translate(-.5 -.5)"
      />
    </svg>
  );
};

import { cn } from '../../../../cn';

type PlusIconProps = {
  className?: string;
};

export const PlusIcon = ({ className }: PlusIconProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={cn('h-4 w-4', className)}>
      <path
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M0 0h24v24H0z"
        transform="translate(12 12) translate(-12 -12)"
      />
      <path
        fill="none"
        stroke="#FFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M0 -7L0 7"
        transform="translate(12 12) translate(-.5 -.5)"
      />
      <path
        fill="none"
        stroke="#FFF"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M-7 0L7 0"
        transform="translate(12 12) translate(-.5 -.5)"
      />
    </svg>
  );
};

import { cn } from '../../../../cn';

type RotateIconProps = {
  rotation: number;
  className?: string;
};

export const RotateIcon = ({ rotation, className }: RotateIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    className={cn('stroke-black py-1 dark:stroke-white', className)}
    style={{
      rotate: `${rotation}deg`,
    }}
  >
    <path
      stroke="currentColour"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      fill="none"
      d="M11.5 20.5a8.5 8.5 0 117.37-4.262M22.5 15l-3.63 1.238m-1.695-3.855l1.354 3.971.34-.116"
    />
  </svg>
);

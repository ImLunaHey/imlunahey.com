import { cn } from '../../../../cn';

type TriangleIconProps = {
  className?: string;
};

export const TriangleIcon = ({ className }: TriangleIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      className={cn('h-8 w-8 stroke-black dark:stroke-white', className)}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4.243 17.651l6.343-11.98c.458-.866.688-1.3.994-1.441a1 1 0 01.84 0c.306.141.535.575.994 1.44l6.342 11.981c.41.775.616 1.163.575 1.479a1 1 0 01-.413.685c-.26.185-.699.185-1.575.185H5.657c-.877 0-1.315 0-1.575-.185a1 1 0 01-.413-.685c-.041-.316.164-.704.574-1.479z"
      />
    </svg>
  );
};

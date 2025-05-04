import { cn } from '../../../../cn';

type TrashCanIconProps = {
  className?: string;
};

export const TrashCanIcon = ({ className }: TrashCanIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 25 25"
    className={cn('h-4 w-4 stroke-black dark:stroke-white', className)}
  >
    <path
      stroke="currentColour"
      strokeWidth="1.2"
      d="M5 6.5h15m-10 0v-2a1 1 0 011-1h3a1 1 0 011 1v2M12.5 9v8m3-8l-.5 8M9.5 9l.5 8m8.5-10.5l-.929 12.077a1 1 0 01-.997.923H8.426a1 1 0 01-.997-.923L6.5 6.5h12z"
    />
  </svg>
);

import { cn } from '../../../../cn';

type LockIconProps = {
  className?: string;
};

export const LockIcon = ({ className }: LockIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn('h-4 w-4 stroke-black dark:stroke-white', className)}
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 14.5v2m-5-6.471C7.471 10 8.053 10 8.8 10h6.4c.747 0 1.329 0 1.8.029m-10 0c-.588.036-1.006.117-1.362.298a3 3 0 00-1.311 1.311C4 12.28 4 13.12 4 14.8v1.4c0 1.68 0 2.52.327 3.162a3 3 0 001.311 1.311C6.28 21 7.12 21 8.8 21h6.4c1.68 0 2.52 0 3.162-.327a3 3 0 001.311-1.311C20 18.72 20 17.88 20 16.2v-1.4c0-1.68 0-2.52-.327-3.162a3 3 0 00-1.311-1.311c-.356-.181-.774-.262-1.362-.298m-10 0V8a5 5 0 0110 0v2.029"
      />
    </svg>
  );
};

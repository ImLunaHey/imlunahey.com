import { cn } from '../../../../cn';

type UnlockIconProps = {
  className?: string;
};

export const UnlockIcon = ({ className }: UnlockIconProps) => {
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
        d="M16.584 6A5.001 5.001 0 007 8v2.029m5 4.471v2m-5-6.471C7.471 10 8.053 10 8.8 10h6.4c1.68 0 2.52 0 3.162.327a3 3 0 011.311 1.311C20 12.28 20 13.12 20 14.8v1.4c0 1.68 0 2.52-.327 3.162a3 3 0 01-1.311 1.311C17.72 21 16.88 21 15.2 21H8.8c-1.68 0-2.52 0-3.162-.327a3 3 0 01-1.311-1.311C4 18.72 4 17.88 4 16.2v-1.4c0-1.68 0-2.52.327-3.162a3 3 0 011.311-1.311c.356-.181.774-.262 1.362-.298z"
      />
    </svg>
  );
};

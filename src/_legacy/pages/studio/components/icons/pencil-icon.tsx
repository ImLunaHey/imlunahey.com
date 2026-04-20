import { cn } from '../../../../cn';

type PencilIconProps = {
  className?: string;
};

export const PencilIcon = ({ className }: PencilIconProps) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 28 28"
      className={cn('h-6 w-6 fill-black stroke-black dark:fill-white dark:stroke-white', className)}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M26.41 9.612a1.974 1.974 0 00.002-2.814l-5.268-5.215a2.026 2.026 0 00-2.842-.002L3.552 16.144c-.394.39-.672.88-.802 1.416l-1.693 6.985c-.36 1.485 1.037 2.801 2.519 2.373l6.761-1.953c.485-.14.927-.4 1.285-.753l14.788-14.6zm-5.946 3.06L10.202 22.805c-.12.117-.267.204-.428.25l-5.603 1.62a.7.7 0 01-.875-.838l1.409-5.813a.992.992 0 01.267-.472L15.195 7.459l5.27 5.213zm1.423-1.404l-5.269-5.214 2.4-2.37a1 1 0 011.407 0l3.846 3.809a1 1 0 01-.001 1.422l-2.383 2.353z"
        clipRule="evenodd"
      />
    </svg>
  );
};

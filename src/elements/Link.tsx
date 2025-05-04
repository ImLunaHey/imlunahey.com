import { Link as RouterLink } from 'react-router';
import { cn } from '../cn';

export const Link = ({
  children,
  to,
  wrapper = true,
  classNames,
  ...props
}: {
  children: React.ReactNode;
  to: string;
  wrapper?: boolean;
  classNames?: {
    link?: string;
    text?: string;
  };
} & Omit<React.ComponentProps<typeof RouterLink>, 'className'>) => {
  return (
    <RouterLink
      to={to}
      className={cn('lg:text-md flex flex-row items-center justify-center font-bold text-white', classNames?.link)}
      {...props}
    >
      {wrapper && '['}
      <div className={cn('flex items-center justify-center text-sm text-white hover:text-white/80', classNames?.text)}>
        {children}
      </div>
      {wrapper && ']'}
    </RouterLink>
  );
};

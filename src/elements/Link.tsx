import { Link as RouterLink } from '@tanstack/react-router';
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
} & Omit<React.ComponentProps<'a'>, 'className' | 'href' | 'ref'>) => {
  return (
    // TanStack Router's Link has strict typed paths; we keep the existing
    // callsites working (including absolute URLs) by widening the prop here.
    <RouterLink
      to={to as never}
      className={cn('lg:text-md flex flex-row items-center justify-center font-bold text-white', classNames?.link)}
      {...(props as Record<string, unknown>)}
    >
      {wrapper && '['}
      <div className={cn('flex items-center justify-center text-sm text-white hover:text-white/80', classNames?.text)}>
        {children}
      </div>
      {wrapper && ']'}
    </RouterLink>
  );
};

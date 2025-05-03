import { cn } from '../cn';

export const Skeleton = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('flex size-full animate-pulse items-center justify-center border bg-white/10', className)}>
    <div className="text-primary flex size-full items-center justify-center text-sm">{children}</div>
  </div>
);

import { cn } from '../cn';

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn('border-primary overflow-auto border bg-black', className)}>{children}</div>;
};

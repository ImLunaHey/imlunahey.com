import { cn } from '../cn';

export const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return <div className={cn('border border-[#1a1a1a] bg-black overflow-auto', className)}>{children}</div>;
};

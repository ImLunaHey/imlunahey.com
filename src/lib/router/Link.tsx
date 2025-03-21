import { ReactNode } from 'react';
import { useRouter } from './use-router';
import { cn } from '../../cn';

type LinkProps = {
  to: string;
  children: ReactNode;
  className?: string;
};

export const Link = ({ to, children, className }: LinkProps) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Handle middle mouse click (button 1)
    if (e.button === 1) {
      window.open(to, '_blank');
      return;
    }

    // Handle ctrl/cmd + click
    if ((e.ctrlKey || e.metaKey) && e.button === 0) {
      e.preventDefault();
      window.open(to, '_blank');
      return;
    }

    if (to.startsWith('http')) {
      e.preventDefault();
      window.open(to, '_blank');
    } else {
      e.preventDefault();
      navigate(to);
    }
  };

  return (
    <a
      href={to}
      onClick={handleClick}
      onAuxClick={handleClick} // Handle middle mouse click
      className={cn(className)}
    >
      {children}
    </a>
  );
};

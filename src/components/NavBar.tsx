import { cn } from '../cn';
import { Link } from '../lib/router';
import { Card } from './Card';

const NavLink = ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => {
  return (
    <Link to={to} className={cn('text-1xl font-bold text-white justify-center items-center', className)}>
      {children}
    </Link>
  );
};

export const NavBar = () => {
  return (
    <Card className="max-w-screen-md mx-auto mb-2 px-4">
      <div className="flex justify-between items-center p-2 h-12">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/blog">Blog</NavLink>
        <NavLink to="/contact">Contact</NavLink>
        <NavLink to="/projects">Projects</NavLink>
        <NavLink to="/photos">Photos</NavLink>
      </div>
    </Card>
  );
};

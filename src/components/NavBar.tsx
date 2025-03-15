import { cn } from '../cn';
import { Link } from '../lib/router';

const NavLink = ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => {
  return (
    <Link to={to} className={cn('text-2xl font-bold text-white justify-center items-center', className)}>
      {children}
    </Link>
  );
};

export const NavBar = () => {
  return (
    <div className="border border-[#1a1a1a] border-b-1 bg-black max-w-screen-md mx-auto mb-2">
      <div className="flex justify-between items-center p-2 h-12">
        <NavLink to="/">Home</NavLink>
        <NavLink to="/blog">Blog</NavLink>
        <NavLink to="/contact">Contact</NavLink>
        <NavLink to="/photos">Photos</NavLink>
      </div>
    </div>
  );
};

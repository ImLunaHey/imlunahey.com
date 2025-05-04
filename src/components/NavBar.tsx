import { cn } from '../cn';
import { Link } from 'react-router';

const NavLink = ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => {
  return (
    <Link to={to} className={cn('items-center justify-center font-bold text-white', className)}>
      <div className="flex flex-row">
        [<div className="lg:text-md flex items-center justify-center text-sm text-white hover:text-white/80">{children}</div>
        ]
      </div>
    </Link>
  );
};

export const NavBar = () => {
  return (
    <>
      <Link to="/" className="font-doto text-4xl font-bold text-white">
        // LUNA
      </Link>
      <div className="mx-auto mb-2 max-w-screen-md border-b border-white pb-2">
        <div className="flex flex-wrap items-center justify-between">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/blog">Blog</NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/gallery">Gallery</NavLink>
          <NavLink to="/design">Design</NavLink>
          <NavLink to="/contact">Contact</NavLink>
        </div>
      </div>
    </>
  );
};

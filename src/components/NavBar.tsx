import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

const LINKS: { to: string; label: string; match?: (path: string) => boolean }[] = [
  { to: '/', label: '~/', match: (p) => p === '/' },
  { to: '/blog', label: '/writing', match: (p) => p.startsWith('/blog') },
  { to: '/projects', label: '/projects', match: (p) => p.startsWith('/projects') },
  { to: '/gallery', label: '/gallery', match: (p) => p.startsWith('/gallery') },
  { to: '/watching', label: '/watching', match: (p) => p.startsWith('/watching') },
  { to: '/games', label: '/games', match: (p) => p.startsWith('/games') },
  { to: '/music', label: '/music', match: (p) => p.startsWith('/music') },
  { to: '/uses', label: '/uses', match: (p) => p.startsWith('/uses') },
];

const Clock = () => {
  const [time, setTime] = useState(() => fmt(new Date()));

  useEffect(() => {
    const tick = () => setTime(fmt(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return <span className="t-faint">london · {time}</span>;
};

function fmt(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export const NavBar = () => {
  const { pathname } = useLocation();

  return (
    <nav className="nav">
      <span className="brand">
        luna<span className="t-accent">.</span>
      </span>
      {LINKS.map((link) => {
        const active = link.match ? link.match(pathname) : pathname === link.to;
        return (
          <Link key={link.to} to={link.to as never} className={active ? 'active' : ''}>
            {link.label}
          </Link>
        );
      })}
      <span className="sp" />
      <Clock />
      <Link to={'/design-system' as never} className={'chip accent' + (pathname.startsWith('/design-system') ? ' active' : '')}>
        design.sys ↗
      </Link>
    </nav>
  );
};

import { Link, useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CommandPaletteHint } from './CommandPaletteHint';
import { PresencePulse } from './PresencePulse';

type NavLink = { to: string; label: string; match?: (path: string) => boolean };

// Front-door content visible inline in the nav. Anything you'd expect
// a cold visitor to land on directly, or that's a CTA (guestbook,
// timeline as the "what is luna doing now" entry).
const PRIMARY_LINKS: NavLink[] = [
  { to: '/', label: '~/', match: (p) => p === '/' },
  { to: '/blog', label: '/writing', match: (p) => p.startsWith('/blog') },
  { to: '/labs', label: '/labs', match: (p) => p.startsWith('/labs') },
  { to: '/timeline', label: '/timeline', match: (p) => p.startsWith('/timeline') },
  { to: '/guestbook', label: '/guestbook', match: (p) => p.startsWith('/guestbook') },
];

// Browse-y / meta pages that are still indexed by ⌘K — the dropdown
// is the secondary path, the palette is the primary one. Order
// roughly groups content (gallery/watching/games/music) before
// experiments (globe/ai) before personal infra (homelab/uses).
const MORE_LINKS: NavLink[] = [
  { to: '/projects', label: '/projects', match: (p) => p.startsWith('/projects') },
  { to: '/gallery', label: '/gallery', match: (p) => p.startsWith('/gallery') },
  { to: '/watching', label: '/watching', match: (p) => p.startsWith('/watching') },
  { to: '/games', label: '/games', match: (p) => p.startsWith('/games') },
  { to: '/music', label: '/music', match: (p) => p.startsWith('/music') },
  { to: '/globe', label: '/globe', match: (p) => p.startsWith('/globe') },
  { to: '/ai', label: '/ai', match: (p) => p.startsWith('/ai') },
  { to: '/homelab', label: '/homelab', match: (p) => p.startsWith('/homelab') },
  { to: '/uses', label: '/uses', match: (p) => p.startsWith('/uses') },
];

const Clock = () => {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(fmt(new Date()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="t-faint" suppressHydrationWarning>
      london · {time ?? '—:—'}
    </span>
  );
};

function fmt(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const MoreMenu = ({ pathname }: { pathname: string }) => {
  const [open, setOpen] = useState(false);
  // The nav has `overflow-x: auto` (so links scroll on narrow widths)
  // which forces overflow-y to clip too — that means a normal absolute-
  // positioned dropdown gets cut off vertically. Portal the menu into
  // document.body and position it from the button's bounding rect so
  // it escapes the nav's overflow context entirely.
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Active when the current path matches any of the demoted entries —
  // visually telegraphs "you're inside the /more set" so the user
  // doesn't think they've lost the breadcrumb.
  const active = MORE_LINKS.some((l) =>
    l.match ? l.match(pathname) : pathname === l.to,
  );

  function toggle() {
    if (!open && btnRef.current) {
      setRect(btnRef.current.getBoundingClientRect());
    }
    setOpen((o) => !o);
  }

  // Close on outside-click (anywhere that's neither the button nor the
  // portaled menu) + ESC. Re-measure on resize so the menu stays
  // glued to the button. Listeners only attached while open.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    function onResize() {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  // Auto-close after a navigation — the dropdown stays open during the
  // route change otherwise, which feels broken for a moment.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Drop the menu to the right of the anchor — left edge aligns with
  // the button's left edge so the menu extends rightward. /more sits
  // before the flex-spacer, so there's plenty of room on the right.
  // No mobile branch because the dropdown is hidden via CSS at narrow
  // widths.
  const positionStyle: React.CSSProperties | null =
    rect != null
      ? {
          position: 'fixed',
          top: rect.bottom + 8,
          left: rect.left,
        }
      : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={'more-btn more-desktop-only' + (active ? ' active' : '')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        /more
        <span className="more-caret" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && positionStyle && typeof document !== 'undefined'
        ? createPortal(
            <div ref={menuRef} className="more-menu" role="menu" style={positionStyle}>
              {MORE_LINKS.map((link) => {
                const linkActive = link.match
                  ? link.match(pathname)
                  : pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to as never}
                    role="menuitem"
                    className={'more-item' + (linkActive ? ' active' : '')}
                    aria-current={linkActive ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export const NavBar = () => {
  const { pathname } = useLocation();

  return (
    <nav className="nav">
      <style>{NAV_CSS}</style>
      <span className="brand">
        luna<span className="t-accent">.</span>
      </span>
      {PRIMARY_LINKS.map((link) => {
        const active = link.match ? link.match(pathname) : pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to as never}
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
          >
            {link.label}
          </Link>
        );
      })}
      <MoreMenu pathname={pathname} />
      {/* On the mobile horizontal-scroll nav we drop the dropdown
          UX entirely and just render every link inline as another
          scroll item — discovery via swipe is fine when there's
          already a fade-mask suggesting more content. */}
      {MORE_LINKS.map((link) => {
        const active = link.match ? link.match(pathname) : pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to as never}
            className={'more-mobile-only' + (active ? ' active' : '')}
            aria-current={active ? 'page' : undefined}
          >
            {link.label}
          </Link>
        );
      })}
      <span className="sp" />
      <PresencePulse />
      <CommandPaletteHint />
      <Clock />
      <Link
        to={'/design-system' as never}
        className={'chip accent' + (pathname.startsWith('/design-system') ? ' active' : '')}
        aria-current={pathname.startsWith('/design-system') ? 'page' : undefined}
      >
        design.sys ↗
      </Link>
    </nav>
  );
};

const NAV_CSS = `
  .more-wrap { position: relative; display: inline-flex; align-items: center; }
  .more-btn {
    background: transparent;
    border: none;
    padding: 0;
    color: var(--color-fg-dim);
    font: inherit;
    cursor: pointer;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .more-btn:hover, .more-btn.active { color: var(--color-accent); }
  .more-caret { font-size: 9px; opacity: 0.7; }
  /* Position is set inline (fixed top/left from the button rect) so
     the menu can escape the nav's overflow context via the portal —
     don't add top/left/right rules here or they'll fight the inline
     style. width: max-content keeps the box snug to the longest
     link instead of stretching. */
  .more-menu {
    /* exactly the width of the longest link label, no arbitrary
       floor — short labels (/ai, /uses) shouldn't get padded out. */
    width: max-content;
    max-width: calc(100vw - 16px);
    background: var(--color-bg-panel);
    border: 1px solid var(--color-border-bright);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 4px;
    display: flex; flex-direction: column;
    z-index: 20;
  }
  .more-item {
    display: block;
    padding: 6px 10px;
    color: var(--color-fg-dim);
    text-decoration: none;
    font-size: var(--fs-sm);
  }
  .more-item:hover, .more-item.active {
    color: var(--color-accent);
    background: var(--color-bg-raised);
    text-decoration: none;
  }

  /* desktop / tablet: render the /more dropdown trigger, hide the
     inline-duplicated demoted links. mobile (≤760px): the opposite —
     drop the dropdown and let every link sit in the horizontal scroll. */
  .more-mobile-only { display: none; }
  @media (max-width: 760px) {
    .more-desktop-only { display: none; }
    .more-mobile-only { display: inline; }
  }
`;

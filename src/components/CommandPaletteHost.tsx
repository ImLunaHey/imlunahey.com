import { lazy, Suspense, useEffect, useState } from 'react';

// The real palette is ~150kB of JS (including NAV_ITEMS, popfeed
// queries, keyboard/search logic). It's only visible after ⌘K / `/`
// or clicking the hint button — so we defer loading the whole module
// until one of those triggers fires, saving the bytes on first paint.
//
// Once triggered, the palette mounts and takes over handling its own
// keyboard shortcuts — this host only exists to catch the very first
// press while the chunk downloads.
const LazyCommandPalette = lazy(() => import('./CommandPalette'));

export default function CommandPaletteHost() {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (armed) return;
    function onKey(e: KeyboardEvent) {
      const modK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.getAttribute?.('contenteditable') === 'true';
      const slashOpen = e.key === '/' && !inField;
      if (modK || slashOpen) {
        e.preventDefault();
        setArmed(true);
      }
    }
    // Custom-event channel for the nav hint button — synthetic
    // KeyboardEvents don't bridge document/window listeners reliably,
    // so the hint dispatches a plain CustomEvent we both listen for.
    function onCustom() {
      setArmed(true);
    }
    document.addEventListener('keydown', onKey);
    window.addEventListener('cmdk:open', onCustom);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('cmdk:open', onCustom);
    };
  }, [armed]);

  if (!armed) return null;
  return (
    <Suspense fallback={null}>
      <LazyCommandPalette initiallyOpen />
    </Suspense>
  );
}

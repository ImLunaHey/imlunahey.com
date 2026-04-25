import { Command } from 'lucide-react';

// Tiny nav-bar trigger button. Kept separate from CommandPalette
// itself so the navbar (which is always on screen) doesn't pull
// the ~150kB palette / popfeed / NAV_ITEMS registry into the
// initial JS payload. Clicking it fires the same ⌘K keyboard event
// the host + palette both listen for.
export function CommandPaletteHint() {
  return (
    <>
      <style>{HINT_CSS}</style>
      <button
        className="cp-hint-btn"
        onClick={() => {
          // Custom event rather than a synthetic KeyboardEvent: both
          // CommandPaletteHost (lazy-arms the chunk) and CommandPalette
          // itself (toggles open) listen for 'cmdk:open' on window, so
          // one dispatch reliably hits whichever is currently mounted.
          window.dispatchEvent(new CustomEvent('cmdk:open'));
        }}
        title="open command palette (⌘K)"
        aria-label="open command palette"
      >
        <Command size={11} />
        <span className="cp-hint-label">k</span>
      </button>
    </>
  );
}

const HINT_CSS = `
  .cp-hint-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-faint);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    cursor: pointer;
    text-transform: lowercase;
    transition: all 0.12s;
  }
  .cp-hint-btn:hover {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
  }
  .cp-hint-label { color: inherit; }

  @media (max-width: 640px) {
    .cp-hint-btn { display: none; }
  }
`;

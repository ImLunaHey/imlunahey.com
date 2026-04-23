import { useEffect, useState } from 'react';

// "New" badge plumbing for /labs. Stored as a JSON array of slugs the
// browser has ever seen.
//
// Semantics:
// - First-ever visit to /labs: we seed `seen` with every slug currently
//   on the page. So a brand-new visitor doesn't see "new" spam on every
//   lab — nothing looks new because they're all equally new to them.
// - Subsequent visits: labs present on /labs but absent from `seen` get
//   a "new" badge. Visiting a lab (any /labs/{slug} route) adds that
//   slug, so the badge clears for them specifically.
// - When we add a lab in future, returning visitors automatically see
//   only the new one flagged, without any per-release setup.

const KEY = 'labs:seen';
const EVENT = 'labs:seen:updated';

function read(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...set]));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch { /* storage blocked */ }
}

/** Mark one slug as seen. Called by the layout-level visit tracker. */
export function markSeen(slug: string) {
  const s = read();
  if (s.has(slug)) return;
  s.add(slug);
  write(s);
}

/** Seed the "seen" set on first-ever visit so existing labs don't all flag as new. */
export function seedBaseline(slugs: string[]) {
  if (typeof window === 'undefined') return;
  if (read().size > 0) return; // already initialised
  write(new Set(slugs));
}

/**
 * Reactive subscription to the seen-set. Returns null on first render so
 * callers can render an optimistic UI (no badges) before the client reads
 * localStorage — avoids a flash of badges on ssr hydration.
 */
export function useLabSeen(): Set<string> | null {
  const [seen, setSeen] = useState<Set<string> | null>(null);

  useEffect(() => {
    setSeen(read());
    const handler = () => setSeen(read());
    window.addEventListener(EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return seen;
}

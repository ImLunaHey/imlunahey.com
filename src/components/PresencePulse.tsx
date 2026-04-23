import { useLocation } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { presenceBeat } from '../server/presence';

const BEAT_MS = 10_000;

function newSid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function PresencePulse() {
  const { pathname } = useLocation();
  const sidRef = useRef<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!sidRef.current) sidRef.current = newSid();
    let cancelled = false;

    const beat = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const res = await presenceBeat({ data: { path: pathname, sid: sidRef.current! } });
        if (!cancelled) setCount(res.count);
      } catch { /* noop */ }
    };

    beat();
    const id = window.setInterval(beat, BEAT_MS);
    const onVis = () => { if (!document.hidden) beat(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pathname]);

  const label =
    count == null ? 'connecting…' :
    count <= 1 ? 'just you reading' :
    `${count} reading this page`;

  return (
    <>
      <style>{CSS}</style>
      <span className={`pulse ${count == null ? 'conn' : ''}`} title={label} aria-label={label}>
        <span className="pulse-heart" aria-hidden>♥</span>
        <span className="pulse-count">{count ?? '—'}</span>
      </span>
    </>
  );
}

const CSS = `
  .pulse {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    background: var(--color-bg-raised);
    border: 1px solid var(--color-border-bright);
    color: var(--color-fg-dim);
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    line-height: 1;
    user-select: none;
  }
  .pulse.conn { opacity: 0.5; }
  .pulse-heart {
    display: inline-block;
    color: var(--color-accent);
    transform-origin: center;
    animation: pulse-beat 1.3s ease-in-out infinite;
    text-shadow: 0 0 6px var(--accent-glow);
    will-change: transform;
  }
  .pulse-count {
    font-variant-numeric: tabular-nums;
    color: var(--color-fg);
    min-width: 1ch;
    text-align: center;
  }
  @keyframes pulse-beat {
    0%, 60%, 100% { transform: scale(1); }
    20%           { transform: scale(1.28); }
    40%           { transform: scale(1.05); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pulse-heart { animation: none; }
  }
  @media (max-width: 760px) {
    .pulse { display: none; }
  }
`;

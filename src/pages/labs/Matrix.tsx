import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

const CHAR_SETS: Record<string, string> = {
  matrix: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ0123456789:.ﾍｹﾊ',
  binary: '01',
  hex: '0123456789abcdef',
  ascii: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()<>?/',
  pokemon: 'ポケモンピカチュウフシギダネヒトカゲゼニガメミュウリザードン⚡♥',
  atproto: 'did:plc:at://app.bsky.feed.post.like.repost.follow.profile.ﾊﾝﾄﾞﾙ',
};

const PALETTES: Record<string, { head: string; tail: string; trail: string }> = {
  phosphor: { head: '#e6ffe6', tail: 'oklch(0.86 0.19 145)', trail: 'rgba(0, 20, 0, 0.08)' },
  amber: { head: '#ffeecc', tail: '#ffaa22', trail: 'rgba(20, 10, 0, 0.08)' },
  cyan: { head: '#eefaff', tail: '#44ccff', trail: 'rgba(0, 10, 20, 0.08)' },
  magenta: { head: '#ffddee', tail: '#ff44aa', trail: 'rgba(20, 0, 10, 0.08)' },
};

type Col = { y: number; speed: number; trail: string[]; nextChangeIn: number };

export default function MatrixPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [charset, setCharset] = useState<keyof typeof CHAR_SETS>('matrix');
  const [palette, setPalette] = useState<keyof typeof PALETTES>('phosphor');
  const [speed, setSpeed] = useState(1);
  const [density, setDensity] = useState(1);
  const [running, setRunning] = useState(true);

  // Refs for the live animation loop so settings updates don't restart it.
  const charsetRef = useRef(charset);
  const paletteRef = useRef(palette);
  const speedRef = useRef(speed);
  const densityRef = useRef(density);
  const runningRef = useRef(running);
  useEffect(() => { charsetRef.current = charset; }, [charset]);
  useEffect(() => { paletteRef.current = palette; }, [palette]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { densityRef.current = density; }, [density]);
  useEffect(() => { runningRef.current = running; }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const FONT_SIZE = 18;
    let cols: Col[] = [];
    let w = 0, h = 0, numCols = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.scale(dpr, dpr);
      w = rect.width; h = rect.height;
      numCols = Math.floor(w / FONT_SIZE);
      cols = Array.from({ length: numCols }, () => ({
        y: Math.random() * h,
        speed: 0.6 + Math.random() * 1.4,
        trail: [],
        nextChangeIn: 0,
      }));
    };

    resize();
    const onResize = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      resize();
    };
    window.addEventListener('resize', onResize);

    const pickChar = () => {
      const set = CHAR_SETS[charsetRef.current];
      return set[Math.floor(Math.random() * set.length)];
    };

    let rafId: number;
    const loop = () => {
      if (!runningRef.current) { rafId = requestAnimationFrame(loop); return; }
      const p = PALETTES[paletteRef.current];
      const sp = speedRef.current;
      const dens = densityRef.current;

      // fade
      ctx.fillStyle = p.trail;
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${FONT_SIZE}px "JetBrains Mono Variable", ui-monospace, monospace`;
      ctx.textBaseline = 'top';

      for (let i = 0; i < cols.length; i++) {
        if (Math.random() > dens) continue;
        const c = cols[i];
        const x = i * FONT_SIZE;
        const ch = pickChar();

        // head
        ctx.fillStyle = p.head;
        ctx.shadowColor = p.tail;
        ctx.shadowBlur = 8;
        ctx.fillText(ch, x, c.y);

        // faded tail (one char up, slightly dim)
        ctx.shadowBlur = 0;
        ctx.fillStyle = p.tail;
        ctx.fillText(ch, x, c.y - FONT_SIZE);

        c.y += FONT_SIZE * 0.5 * sp * c.speed;
        if (c.y > h + Math.random() * h * 0.3) {
          c.y = -Math.random() * h * 0.4;
          c.speed = 0.6 + Math.random() * 1.4;
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-mx">
        <div className="crumbs">
          <Link to="/labs">~ / labs</Link>
          <span className="sep">/</span>
          <span className="last">matrix</span>
        </div>

        <div className="mx-stage">
          <canvas ref={canvasRef} className="mx-canvas" />
          <div className="mx-controls">
            <div className="mx-ctrl-group">
              <span className="mx-lbl">charset</span>
              {Object.keys(CHAR_SETS).map((k) => (
                <button
                  key={k}
                  className={`mx-chip ${charset === k ? 'on' : ''}`}
                  onClick={() => setCharset(k as keyof typeof CHAR_SETS)}
                >{k}</button>
              ))}
            </div>
            <div className="mx-ctrl-group">
              <span className="mx-lbl">palette</span>
              {Object.keys(PALETTES).map((k) => (
                <button
                  key={k}
                  className={`mx-chip ${palette === k ? 'on' : ''}`}
                  onClick={() => setPalette(k as keyof typeof PALETTES)}
                >{k}</button>
              ))}
            </div>
            <div className="mx-ctrl-group">
              <span className="mx-lbl">speed</span>
              <input
                type="range" min={0.25} max={3} step={0.05}
                value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
                className="mx-slider"
              />
              <span className="mx-val">{speed.toFixed(2)}</span>
            </div>
            <div className="mx-ctrl-group">
              <span className="mx-lbl">density</span>
              <input
                type="range" min={0.2} max={1} step={0.05}
                value={density} onChange={(e) => setDensity(Number(e.target.value))}
                className="mx-slider"
              />
              <span className="mx-val">{(density * 100).toFixed(0)}%</span>
            </div>
            <button className="mx-btn" onClick={() => setRunning((r) => !r)}>
              {running ? '⏸ pause' : '▶ play'}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

const CSS = `
  .shell-mx {
    max-width: 100%;
    margin: 0 auto;
    padding: 0 var(--sp-4);
    height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
  }

  .crumbs {
    padding: var(--sp-3) 0;
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-fg-faint);
    flex-shrink: 0;
  }
  .crumbs a { color: var(--color-fg-faint); text-decoration: none; }
  .crumbs a:hover { color: var(--color-accent); }
  .crumbs .sep { margin: 0 6px; }
  .crumbs .last { color: var(--color-accent); }

  .mx-stage {
    position: relative;
    flex: 1;
    border: 1px solid var(--color-border);
    background: #000;
    overflow: hidden;
    min-height: 400px;
  }
  .mx-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .mx-controls {
    position: absolute;
    bottom: var(--sp-3);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: var(--sp-3);
    flex-wrap: wrap;
    align-items: center;
    padding: var(--sp-3) var(--sp-4);
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid var(--color-accent-dim);
    box-shadow: 0 0 20px color-mix(in oklch, var(--color-accent) 18%, transparent);
    max-width: calc(100% - var(--sp-6));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .mx-ctrl-group {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .mx-lbl {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-fg-faint);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-right: 2px;
  }
  .mx-chip {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: transparent;
    color: var(--color-fg-dim);
    border: 1px solid var(--color-border);
    padding: 2px 8px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .mx-chip:hover { color: var(--color-fg); border-color: var(--color-border-bright); }
  .mx-chip.on {
    color: var(--color-accent);
    border-color: var(--color-accent-dim);
    background: color-mix(in oklch, var(--color-accent) 8%, transparent);
  }
  .mx-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 90px;
    height: 3px;
    background: var(--color-border-bright);
    outline: 0;
    cursor: pointer;
  }
  .mx-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: var(--color-accent);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--accent-glow);
  }
  .mx-slider::-moz-range-thumb {
    width: 12px; height: 12px;
    background: var(--color-accent);
    border-radius: 50%;
    border: 0;
  }
  .mx-val {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    color: var(--color-accent);
    min-width: 3ch;
    font-variant-numeric: tabular-nums;
  }
  .mx-btn {
    font-family: var(--font-mono);
    font-size: var(--fs-xs);
    background: var(--color-accent);
    color: #000;
    border: 0;
    padding: 4px 12px;
    cursor: pointer;
    text-transform: lowercase;
  }
  .mx-btn:hover { filter: brightness(1.1); }

  @media (max-width: 760px) {
    .mx-controls { gap: var(--sp-2); padding: var(--sp-2); }
    .mx-slider { width: 60px; }
  }
`;

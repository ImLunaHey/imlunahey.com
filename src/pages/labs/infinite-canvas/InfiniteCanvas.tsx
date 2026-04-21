import { useEffect, useRef, useState } from 'react';
import { CanvasCache } from '../../../lib/canvas-cache';
import { SpatialHashGrid } from '../../../lib/spatial-hash';

export type Node =
  | { type: 'rect'; x: number; y: number; width: number; height: number; color: string }
  | { type: 'circle'; x: number; y: number; radius: number; color: string }
  | { type: 'text'; x: number; y: number; text: string; color: string };

type Offset = { x: number; y: number };

export function InfiniteCanvas({ nodes }: { nodes: Node[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cache = useRef(new CanvasCache(50));
  const hash = useRef(new SpatialHashGrid<Node>(500));
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragging = useRef(false);
  const lastPt = useRef({ x: 0, y: 0 });

  // size the backing canvas to its parent
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const fit = () => {
      const p = el.parentElement;
      if (!p) return;
      const w = p.clientWidth;
      const h = p.clientHeight;
      el.width = w;
      el.height = h;
      setDims({ w, h });
      cache.current.clear();
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, []);

  // reindex on node change
  useEffect(() => {
    hash.current.clear();
    for (const n of nodes) {
      const w = n.type === 'circle' ? n.radius * 2 : n.type === 'text' ? 100 : n.width;
      const h = n.type === 'circle' ? n.radius * 2 : n.type === 'text' ? 20 : n.height;
      hash.current.insert({ bounds: { x: n.x, y: n.y, width: w, height: h }, data: n });
    }
  }, [nodes]);

  // paint
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, dims.w, dims.h);

    const view = {
      x: offset.x,
      y: offset.y,
      width: dims.w / scale,
      height: dims.h / scale,
    };

    const cached = cache.current.getCachedCanvas(view.x, view.y, view.width, view.height, scale);
    if (cached) {
      ctx.drawImage(cached, 0, 0);
      return;
    }

    const visible = Array.from(hash.current.query(view)).map((i) => i.data);
    if (visible.length === 0) return;

    const off = document.createElement('canvas');
    off.width = dims.w;
    off.height = dims.h;
    const octx = off.getContext('2d');
    if (!octx) return;

    for (const n of visible) {
      const x = (n.x - offset.x) * scale;
      const y = (n.y - offset.y) * scale;
      if (n.type === 'rect') {
        octx.fillStyle = n.color;
        octx.fillRect(x, y, n.width * scale, n.height * scale);
      } else if (n.type === 'circle') {
        octx.beginPath();
        octx.fillStyle = n.color;
        octx.arc(x, y, n.radius * scale, 0, Math.PI * 2);
        octx.fill();
      } else if (n.type === 'text') {
        octx.fillStyle = n.color;
        octx.font = `${12 * scale}px ui-monospace, Menlo, monospace`;
        octx.fillText(n.text, x, y);
      }
    }

    cache.current.cacheCanvas(view.x, view.y, view.width, view.height, scale, off);
    ctx.drawImage(off, 0, 0);
  }, [nodes, dims.w, dims.h, offset, scale]);

  // pan + zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let activeTouches: Touch[] = [];
    let initialDistance = 0;
    let initialScale = 1;

    const dist = (a: Touch, b: Touch) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const mid = (a: Touch, b: Touch) => {
      const r = canvas.getBoundingClientRect();
      return { x: (a.clientX + b.clientX) / 2 - r.left, y: (a.clientY + b.clientY) / 2 - r.top };
    };

    const onPtDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      dragging.current = true;
      lastPt.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onPtMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !dragging.current) return;
      const dx = e.clientX - lastPt.current.x;
      const dy = e.clientY - lastPt.current.y;
      setOffset((p) => ({ x: p.x - dx / scale, y: p.y - dy / scale }));
      lastPt.current = { x: e.clientX, y: e.clientY };
    };
    const onPtUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      dragging.current = false;
      canvas.releasePointerCapture(e.pointerId);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.pow(1.005, -e.deltaY);
        const r = canvas.getBoundingClientRect();
        const mx = e.clientX - r.left;
        const my = e.clientY - r.top;
        const ns = Math.min(Math.max(scale * factor, 0.1), 10);
        setOffset((p) => ({ x: p.x + (mx / scale - mx / ns), y: p.y + (my / scale - my / ns) }));
        setScale(ns);
      } else {
        setOffset((p) => ({ x: p.x + e.deltaX / scale, y: p.y + e.deltaY / scale }));
      }
    };
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2) {
        initialDistance = dist(e.touches[0], e.touches[1]);
        initialScale = scale;
      } else if (e.touches.length === 1) {
        lastPt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
      activeTouches = Array.from(e.touches);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 2 && activeTouches.length === 2) {
        const d = dist(e.touches[0], e.touches[1]);
        const c = mid(e.touches[0], e.touches[1]);
        const ratio = d / initialDistance;
        const damp = ratio > 1 ? 0.1 : 0.2;
        const sf = 1 + (ratio - 1) * damp;
        const ns = Math.min(Math.max(initialScale * sf, 0.1), 10);
        setOffset((p) => ({ x: p.x + (c.x / scale - c.x / ns), y: p.y + (c.y / scale - c.y / ns) }));
        setScale(ns);
      } else if (e.touches.length === 1 && activeTouches.length >= 1) {
        const t = e.touches[0];
        const dx = t.clientX - lastPt.current.x;
        const dy = t.clientY - lastPt.current.y;
        setOffset((p) => ({ x: p.x - dx / scale, y: p.y - dy / scale }));
        lastPt.current = { x: t.clientX, y: t.clientY };
      }
      activeTouches = Array.from(e.touches);
    };
    const onTouchEnd = (e: TouchEvent) => {
      activeTouches = Array.from(e.touches);
    };

    canvas.addEventListener('pointerdown', onPtDown);
    canvas.addEventListener('pointermove', onPtMove);
    canvas.addEventListener('pointerup', onPtUp);
    canvas.addEventListener('pointercancel', onPtUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    return () => {
      canvas.removeEventListener('pointerdown', onPtDown);
      canvas.removeEventListener('pointermove', onPtMove);
      canvas.removeEventListener('pointerup', onPtUp);
      canvas.removeEventListener('pointercancel', onPtUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [scale]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: dragging.current ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
    />
  );
}

// deterministic demo scene — phosphor-themed shapes + coord labels
export function buildDemoScene(count = 400): Node[] {
  const rng = mulberry32(0xcafe);
  const nodes: Node[] = [];
  const palette = [
    'oklch(0.86 0.19 145)', // accent
    'oklch(0.55 0.13 145)', // accent dim
    'oklch(0.78 0.16 315)', // magenta
    'oklch(0.82 0.13 85)', // amber
    'oklch(0.78 0.11 210)', // cyan
    '#2a2a2a',
  ];

  // coord grid labels
  for (let gx = -4; gx <= 4; gx++) {
    for (let gy = -4; gy <= 4; gy++) {
      nodes.push({
        type: 'text',
        x: gx * 400,
        y: gy * 400,
        text: `${gx * 400}, ${gy * 400}`,
        color: '#3a3a3a',
      });
    }
  }

  // scattered shapes
  for (let i = 0; i < count; i++) {
    const x = (rng() - 0.5) * 4000;
    const y = (rng() - 0.5) * 4000;
    const color = palette[Math.floor(rng() * palette.length)];
    if (rng() > 0.5) {
      nodes.push({ type: 'rect', x, y, width: 20 + rng() * 80, height: 20 + rng() * 80, color });
    } else {
      nodes.push({ type: 'circle', x, y, radius: 10 + rng() * 40, color });
    }
  }
  return nodes;
}

// deterministic rng
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';

// Tiny pan + zoom helper for the tfl map canvases. Viewport holds a canvas-
// buffer-space translation + uniform scale. Zoom is anchored to the cursor
// so the point under the pointer stays fixed. Pan is via click-drag.
//
// Usage (inside draw()):
//   ctx.save();
//   ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.tx, vp.ty);
//   // ... all drawing uses world (bbox-derived) coords
//   ctx.restore();
//
// And to convert a screen-pixel into world coords for hit testing:
//   const wx = (screenCanvasX - vp.tx) / vp.scale;
//   const wy = (screenCanvasY - vp.ty) / vp.scale;

export type Viewport = { tx: number; ty: number; scale: number };

export const IDENTITY_VP: Viewport = { tx: 0, ty: 0, scale: 1 };

/** Convert a pointer event to canvas-buffer coordinates (not CSS px). */
export function pointerToBuffer(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [
    ((e.clientX - rect.left) / rect.width) * canvas.width,
    ((e.clientY - rect.top) / rect.height) * canvas.height,
  ];
}

export function screenToWorld(bx: number, by: number, vp: Viewport): [number, number] {
  return [(bx - vp.tx) / vp.scale, (by - vp.ty) / vp.scale];
}

export function useCanvasViewport(opts: { minScale?: number; maxScale?: number } = {}) {
  const minScale = opts.minScale ?? 1;
  const maxScale = opts.maxScale ?? 20;
  const [vp, setVp] = useState<Viewport>(IDENTITY_VP);
  const dragRef = useRef<{ bx: number; by: number; tx: number; ty: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Callers attach this ref to the canvas. We use a native (non-passive)
  // wheel listener because React's synthetic wheel handler is passive and
  // can't call preventDefault — which caused the page to scroll underneath
  // the zoom.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const setCanvasRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const [bx, by] = pointerToBuffer(e, el);
      setVp((v) => {
        const factor = Math.exp(-e.deltaY * 0.0016);
        const next = Math.max(minScale, Math.min(maxScale, v.scale * factor));
        const actual = next / v.scale;
        return {
          tx: bx - (bx - v.tx) * actual,
          ty: by - (by - v.ty) * actual,
          scale: next,
        };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [minScale, maxScale]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const [bx, by] = pointerToBuffer(e, e.currentTarget);
    dragRef.current = { bx, by, tx: vp.tx, ty: vp.ty };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [vp.tx, vp.ty]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const [bx, by] = pointerToBuffer(e, e.currentTarget);
    const { bx: sx, by: sy, tx, ty } = dragRef.current;
    setVp((v) => ({ ...v, tx: tx + (bx - sx), ty: ty + (by - sy) }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  }, []);

  const reset = useCallback(() => setVp(IDENTITY_VP), []);

  return { vp, setCanvasRef, onPointerDown, onPointerMove, onPointerUp, reset, dragging };
}

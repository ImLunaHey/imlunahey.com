import { isCanvasInFocus } from '../common/is-canvas-in-focus';
import { useEffect, useRef } from 'react';

export const useCanvasZooming = () => {
  const scaleRef = useRef(1);

  // If im using a mouse wheel allow me to zoom in and out while holding ctrl
  // If im using a trackpad allow me to zoom in and out via pinch to zoom
  // If im using a touch screen allow me to zoom in and out via pinch to zoom

  // Zoom in and out using the mouse wheel
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      // If the canvas isnt focused ignore the event
      if (!isCanvasInFocus()) return;

      // If the user is holding ctrl allow them to zoom in and out
      if (e.ctrlKey) {
        e.preventDefault();

        // Get the current scale
        const scale = scaleRef.current;

        // Calculate the new scale
        const newScale = scale - e.deltaY * 0.01;

        // Clamp the scale
        scaleRef.current = Math.min(Math.max(newScale, 0.1), 10);
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Zoom in and out using pinch to zoom
  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // If the canvas isnt focused ignore the event
      if (!isCanvasInFocus()) return;

      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        const initialScale = scaleRef.current;

        const onTouchMove = (e: TouchEvent) => {
          if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const newDistance = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
            const newScale = initialScale - (distance - newDistance) * 0.01;
            scaleRef.current = Math.min(Math.max(newScale, 0.1), 10);
          }
        };

        const onTouchEnd = () => {
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onTouchEnd);
        };

        window.addEventListener('touchmove', onTouchMove);
        window.addEventListener('touchend', onTouchEnd);
      }
    };
    window.addEventListener('touchstart', onTouchStart);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
    };
  }, []);

  return scaleRef;
};

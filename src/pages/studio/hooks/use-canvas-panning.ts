import { useRef, useEffect } from 'react';

export const useCanvasPanning = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
  // Should start off with the canvas centered
  const translatePosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const startDragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseDown = (event: MouseEvent) => {
      // Middle mouse button is pressed
      if (event.button === 1) {
        isDraggingRef.current = true;
        startDragOffsetRef.current = {
          x: event.clientX - translatePosRef.current.x,
          y: event.clientY - translatePosRef.current.y,
        };
        event.preventDefault(); // Prevent the default middle mouse button behavior
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaMode === 0) {
        // This is often (but not always) indicative of a trackpad
        const dx = translatePosRef.current.x - event.deltaX;
        const dy = translatePosRef.current.y - event.deltaY;
        translatePosRef.current = { x: dx, y: dy };
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      // Only move if the middle mouse button is being dragged
      if (isDraggingRef.current) {
        const dx = event.clientX - startDragOffsetRef.current.x;
        const dy = event.clientY - startDragOffsetRef.current.y;
        translatePosRef.current = { x: dx, y: dy };
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      isDraggingRef.current = false;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        isDraggingRef.current = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const midX = (touch1.clientX + touch2.clientX) / 2;
        const midY = (touch1.clientY + touch2.clientY) / 2;
        startDragOffsetRef.current = {
          x: midX - translatePosRef.current.x,
          y: midY - translatePosRef.current.y,
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      // Bail if we're not dragging
      if (!isDraggingRef.current) return;

      // Trackpad and mobile 2 finger drag
      if (event.touches.length === 2) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const midX = (touch1.clientX + touch2.clientX) / 2;
        const midY = (touch1.clientY + touch2.clientY) / 2;
        const dx = midX - startDragOffsetRef.current.x;
        const dy = midY - startDragOffsetRef.current.y;
        translatePosRef.current = { x: dx, y: dy };
      }

      // // Mouse
      // if (event.touches.length === 1) {
      //   const touch = event.touches[0];
      //   const dx = touch.clientX - startDragOffsetRef.current.x;
      //   const dy = touch.clientY - startDragOffsetRef.current.y;
      //   translatePosRef.current = { x: dx, y: dy };
      // }
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
    };

    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('wheel', handleWheel);
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [canvasRef]);

  return translatePosRef;
};

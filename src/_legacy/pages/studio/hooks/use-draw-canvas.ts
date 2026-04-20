import { useEffect } from 'react';

export const useDrawCanvas = (canvasRef: React.RefObject<HTMLCanvasElement>, draw: (delta: number) => void) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let framesRendered = 0;
    const animate = () => {
      // Draw the canvas
      draw(framesRendered++);

      // Request the next frame
      requestAnimationFrame(animate);
    };

    // Start the animation loop
    requestAnimationFrame(animate);
  }, [canvasRef, draw]);
};

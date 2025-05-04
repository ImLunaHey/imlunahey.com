import { useEffect } from 'react';

export const useResizeWindow = (canvasRef: React.RefObject<HTMLCanvasElement>, scaleRef: React.MutableRefObject<number>) => {
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;

      // Resize the canvas to the new window size
      canvasRef.current.width = window.innerWidth;
      canvasRef.current.height = window.innerHeight;

      // Reset the zoom level
      scaleRef.current = 1;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [canvasRef, scaleRef]);
};

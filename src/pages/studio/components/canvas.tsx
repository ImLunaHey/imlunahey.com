type CanvasProps = {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
};

export const Canvas = ({ canvasRef, onMouseDown, onMouseMove, onMouseUp, onMouseLeave }: CanvasProps) => {
  return (
    <canvas
      className="z-0"
      ref={canvasRef}
      width={window.innerWidth}
      height={window.innerHeight}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    />
  );
};

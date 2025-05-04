export const drawDotPattern = (canvas: HTMLCanvasElement, dotSize: number, colour: string = '#000'): void => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.beginPath();
  ctx.fillStyle = colour;

  // Draw circles at every 50px
  for (let x = 0; x <= canvas.width; x += 50) {
    for (let y = 0; y <= canvas.height; y += 50) {
      ctx.moveTo(x, y);
      ctx.arc(x, y, dotSize, 0, 2 * Math.PI);
    }
  }

  ctx.fill();
};

import { hexToRga } from '../colours/hex-To-rbga';

type AddLensFlareToCanvasParams = {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  intensity: number;
  colour: string;
};

export const addLensFlareToCanvas = ({ canvas, x, y, intensity, colour }: AddLensFlareToCanvasParams) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Adjusting the flare effect size and position
  const radius = intensity * 2;

  // Simple lens flare effect
  const gradient = ctx.createRadialGradient(x, y, radius * 0.3, x, y, radius);
  gradient.addColorStop(0, hexToRga(colour, 0.8));
  gradient.addColorStop(0.2, hexToRga(colour, 0.6));
  gradient.addColorStop(0.4, hexToRga(colour, 0.4));
  gradient.addColorStop(1, hexToRga(colour, 0));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fill();
};

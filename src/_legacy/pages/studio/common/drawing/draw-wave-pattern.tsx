export const drawWaves = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const lines = 100; // Number of lines you want to draw
  const waveAmplitude = 10; // The amplitude of the wave
  const waveFrequency = 0.1; // The frequency of the wave

  // Set the color of the lines
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;

  ctx.beginPath(); // Begin a new path for the combined lines

  for (let i = 0; i < lines; i++) {
    for (let x = 0; x <= canvas.width; x += 10) {
      // Calculate the y position of the line at point x
      const y = waveAmplitude * Math.sin(x * waveFrequency + i * waveFrequency) + ((canvas.height * 1.2) / lines) * i;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }

  ctx.stroke(); // Stroke the path once after all lines are defined
};

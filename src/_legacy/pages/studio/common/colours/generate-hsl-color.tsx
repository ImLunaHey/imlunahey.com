import { hslToHex } from './hsl-to-hex';

// Function to generate a random but aesthetically pleasing color
export const generateColor = () => {
  const hues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]; // Hue values for pleasing colors
  const hue = hues[Math.floor(Math.random() * hues.length)];
  const saturation = 70 + Math.random() * 30; // Higher saturation for more vivid color
  const lightness = 40 + Math.random() * 20; // Lightness in a middle range for balance
  return hslToHex(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
};

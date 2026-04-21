import { hslToRgb } from './hsl-to-rgb';

export const hslToHex = (value: string) => {
  if (!value.startsWith('hsl')) return value;
  const [h, s, l] = value
    .replace('hsl(', '')
    .replace(')', '')
    .split(',')
    .map((value) => Number(value.replace('%', '').trim()));

  return hslToRgb(h / 360, s / 100, l / 100);
};

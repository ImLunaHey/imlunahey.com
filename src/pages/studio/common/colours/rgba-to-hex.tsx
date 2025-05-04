export const rgbaToHex = (rgba: string) => {
  const [r, g, b] = rgba
    .slice(5, -1)
    .split(',')
    .map((value) => Number(value.trim()));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

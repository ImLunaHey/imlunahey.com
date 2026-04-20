export const invert = (imageData: ImageData) => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    data[i] = brightness - r;
    data[i + 1] = brightness - g;
    data[i + 2] = brightness - b;
  }
  return imageData;
};

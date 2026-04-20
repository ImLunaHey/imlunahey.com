export const rgbAdjust = (imageData: ImageData, adjustment: number) => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    data[i] = brightness * adjustment;
    data[i + 1] = brightness * adjustment;
    data[i + 2] = brightness * adjustment;
  }
  return imageData;
};

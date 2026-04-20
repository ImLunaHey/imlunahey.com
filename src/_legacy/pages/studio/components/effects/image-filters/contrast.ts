export const contrast = (imageData: ImageData, percentage: number = 1) => {
  const data = imageData.data;
  const adjustment = percentage * 255;
  const factor = (259 * (adjustment + 255)) / (255 * (259 - adjustment));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i + 1] = factor * (data[i + 1] - 128) + 128;
    data[i + 2] = factor * (data[i + 2] - 128) + 128;
  }
  return imageData;
};

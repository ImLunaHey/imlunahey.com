/**
 * @param imageData - ImageData object
 * @param percentage - The percentage of the sepia filter
 */
export const sepia = (imageData: ImageData, percentage: number = 1) => {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = (r + g + b) / 3;
    data[i] = brightness * (1 - 0.607 * percentage) + r * 0.769 * percentage + g * 0.189 * percentage;
    data[i + 1] = brightness * 0.349 * percentage + g * (1 - 0.314 * percentage) + b * 0.168 * percentage;
    data[i + 2] = brightness * 0.272 * percentage + g * 0.534 * percentage + b * (1 - 0.869 * percentage);
  }
  return imageData;
};

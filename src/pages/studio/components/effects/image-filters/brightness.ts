const percentageToAdjustment = (percentage: number) => {
  let adjustment = percentage;
  adjustment = adjustment > 1 ? 1 : adjustment;
  adjustment = adjustment < -1 ? -1 : adjustment;
  adjustment = ~~(255 * adjustment);
  return adjustment;
};

export const brightness = (imageData: ImageData, percentage: number = 1) => {
  const data = imageData.data;
  const adjustment = percentageToAdjustment(percentage);
  for (let i = 0; i < data.length; i += 4) {
    data[i] += adjustment;
    data[i + 1] += adjustment;
    data[i + 2] += adjustment;
  }
  return imageData;
};

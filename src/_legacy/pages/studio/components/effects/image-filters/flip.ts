type Direction = 'horizontal' | 'vertical';

export const flip = (imageData: ImageData, direction: Direction) => {
  const data = imageData.data;
  const { width, height } = imageData;
  const temp = new Uint8ClampedArray(data.length);

  if (direction === 'vertical') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const j = ((height - y) * width + x) * 4;
        temp[j] = data[i];
        temp[j + 1] = data[i + 1];
        temp[j + 2] = data[i + 2];
        temp[j + 3] = data[i + 3];
      }
    }
  }

  if (direction === 'horizontal') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const j = (y * width + (width - x)) * 4;
        temp[j] = data[i];
        temp[j + 1] = data[i + 1];
        temp[j + 2] = data[i + 2];
        temp[j + 3] = data[i + 3];
      }
    }
  }

  // Copy the flipped data back to the original
  for (let i = 0; i < data.length; i++) {
    data[i] = temp[i];
  }

  return imageData;
};

type FlipImageParams = {
  image: HTMLImageElement;
  imageFlip: {
    horizontal: boolean;
    vertical: boolean;
  };
  imageRotation: number;
};

export const flipImage = ({ image, imageFlip, imageRotation }: FlipImageParams) => {
  if (!image) return null;

  // Flip the image if necessary
  if (imageFlip.horizontal || imageFlip.vertical) {
    const flippedImageCanvas = document.createElement('canvas');
    flippedImageCanvas.width = image.width;
    flippedImageCanvas.height = image.height;
    const flippedImageCtx = flippedImageCanvas.getContext('2d');
    if (!flippedImageCtx) return null;
    if (imageFlip.horizontal) {
      if (imageRotation === 90 || imageRotation === 270) {
        flippedImageCtx.translate(0, image.width);
        flippedImageCtx.scale(1, -1);
      } else {
        flippedImageCtx.translate(image.width, 0);
        flippedImageCtx.scale(-1, 1);
      }
    }
    if (imageFlip.vertical) {
      // If the image is rotated, we need to flip the image along the opposite axis
      if (imageRotation === 90 || imageRotation === 270) {
        flippedImageCtx.translate(image.height, 0);
        flippedImageCtx.scale(-1, 1);
      } else {
        flippedImageCtx.translate(0, image.height);
        flippedImageCtx.scale(1, -1);
      }
    }
    flippedImageCtx.drawImage(image, 0, 0);
    const newImage = new Image(flippedImageCanvas.width, flippedImageCanvas.height);
    newImage.src = flippedImageCanvas.toDataURL();
    return newImage;
  }

  return image;
};

import { RenderPipeline } from './render-pipeline';
import { addLensFlareToCanvas } from './add-lens-flare-to-canvas';
import { drawDotPattern } from './draw-dot-pattern';
import { drawWaves } from './draw-wave-pattern';
import { drawGridPattern } from './draw-grid-pattern';
import { Position } from '../../common/position';

type DrawParams = {
  canvas: HTMLCanvasElement | null;
  image: HTMLImageElement | null;
  scale: number;
  position: Position;
  shadowBlur: number;
  shadowColour: string | null;
  backgroundType: 'colour' | 'gradient' | 'image' | 'transparent' | null;
  backgroundColour: string | null;
  backgroundGradient: string[] | null;
  backgroundImage: HTMLImageElement | HTMLCanvasElement | null;
  cornerRadius: number;
  frameColour: string | null;
  flareIntensity: number;
  flareColour: string;
  patterns: {
    grid: boolean;
    dot: boolean;
    waves: boolean;
  };
  textToRender: string | null;
  fontSize: number;
  textPositionX: number;
  textPositionY: number;
  stackCount: number;
  imageFlip: {
    horizontal: boolean;
    vertical: boolean;
  };
  imageRotation: number;
  autoCenter: boolean;
};

export const draw = ({
  canvas,
  image,
  position,
  shadowBlur,
  scale,
  shadowColour,
  backgroundType,
  backgroundColour,
  backgroundGradient,
  backgroundImage,
  cornerRadius,
  frameColour,
  flareIntensity,
  flareColour,
  patterns,
  textToRender,
  fontSize,
  textPositionX,
  textPositionY,
  stackCount,
  imageFlip,
  imageRotation,
  autoCenter,
}: DrawParams) => {
  const ctx = canvas?.getContext('2d');

  // Do nothing unless we're ready
  if (!canvas || !ctx) return;

  // Clear the main canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Process the rendering pipeline
  const backgroundCanvas = new RenderPipeline(canvas, [
    {
      backgroundType,
      backgroundColour,
      backgroundGradient,
      backgroundImage,
    },
    (canvas) => {
      // Draw the pattern to the main canvas
      if (patterns.grid) drawGridPattern(canvas, 20, 'rgba(255, 255, 255, 0.5)');
      if (patterns.dot) drawDotPattern(canvas, 5, 'rgba(255, 255, 255, 0.5)');
      if (patterns.waves) drawWaves(canvas);

      // Add lense flare to the center of the canvas
      addLensFlareToCanvas({
        canvas,
        x: canvas.width / 2,
        y: canvas.height / 2,
        intensity: flareIntensity,
        colour: flareColour,
      });

      return canvas;
    },
  ]).render();

  // Draw the updated canvas to the main canvas
  ctx.drawImage(backgroundCanvas, 0, 0, canvas.width, canvas.height);

  // Stop here if there's no image
  if (!image) return;

  // Calculate the aspect ratio of the image
  const imageAspectRatio = image.width / image.height;

  // Calculate the desired scale factor from the user's scale input
  const desiredScaleFactor = scale / 100;

  // Initially apply the scale to the width
  let scaledImageWidth = image.width * desiredScaleFactor;
  // Calculate the height based on the scaled width to maintain the aspect ratio
  let scaledImageHeight = scaledImageWidth / imageAspectRatio;

  // Check if the scaled dimensions exceed the canvas size
  if (scaledImageWidth > canvas.width || scaledImageHeight > canvas.height) {
    // Determine the maximum scale factor that fits the canvas while maintaining the aspect ratio
    const widthScaleFactor = canvas.width / image.width;
    const heightScaleFactor = canvas.height / image.height;
    const scaleFactorToFitCanvas = Math.min(widthScaleFactor, heightScaleFactor);

    // Apply this scale factor to both dimensions
    scaledImageWidth = image.width * scaleFactorToFitCanvas;
    scaledImageHeight = image.height * scaleFactorToFitCanvas;
  }

  // Don't snap the image to the grid if we're auto centering
  if (!autoCenter) {
    // Snap the image to a grid of 20px
    position.x = Math.round(position.x / 10) * 10;
    position.y = Math.round(position.y / 10) * 10;

    // Clamp the image position to the canvas
    position.x =
      Math.min(Math.max(position.x, 0), canvas.width - scaledImageWidth) + (imageFlip.horizontal ? scaledImageWidth : 0);
    position.y =
      Math.min(Math.max(position.y, 0), canvas.height - scaledImageHeight) + (imageFlip.vertical ? scaledImageHeight : 0);
  }

  // Process the image
  const imageCanvas = new RenderPipeline(image, [
    {
      cornerRadius,
    },
    ...(frameColour
      ? [
          {
            padding: 10,
            backgroundType: 'colour' as const,
            backgroundColour: frameColour === '#FFFFFF' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
            cornerRadius,
          },
        ]
      : []),
  ]).render();

  // Setting shadow on the main canvas
  if (shadowColour && shadowBlur) {
    ctx.shadowColor = shadowColour;
    ctx.shadowBlur = shadowBlur;
  }

  // What is this? I don't know, but it works
  // Ask Liz for a better name later on
  const stackSpace = 10;

  // Draw the stack of images
  for (let i = 0; i < stackCount; i++) {
    // Calculate scale and position adjustments based on the current iteration
    const shearFactor = stackCount - i;
    const scaleAdjustment = 0.9 + (0.1 * (i - shearFactor)) / stackCount;
    const positionAdjustmentX = (scaledImageWidth - scaledImageWidth * scaleAdjustment) / 2;
    const positionAdjustmentY = stackSpace * shearFactor;

    // Draw the image to the main canvas
    if (imageRotation) {
      // Convert degrees to radians
      const angleInRadians = (imageRotation * Math.PI) / 180;

      // Translate context to image position
      ctx.translate(
        position.x + positionAdjustmentX + scaledImageWidth / 2,
        position.y + positionAdjustmentY + scaledImageHeight / 2,
      );

      // Rotate context
      ctx.rotate(angleInRadians);

      // Draw image centered on the translated and rotated context
      ctx.drawImage(
        imageCanvas,
        -scaledImageWidth / 2,
        -scaledImageHeight / 2,
        scaledImageWidth * scaleAdjustment,
        scaledImageHeight * scaleAdjustment,
      );

      // Reset transformation matrix to the identity matrix
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(
        imageCanvas,
        position.x + positionAdjustmentX,
        position.y - positionAdjustmentY,
        scaledImageWidth * scaleAdjustment,
        scaledImageHeight * scaleAdjustment,
      );
    }
  }

  // // Draw the stack of images
  // for (let i = stackCount; i > 0; i--) {
  //   // Calculate scale and position adjustments based on the current iteration
  //   const scaleAdjustment = 0.9 + (0.1 * (stackCount - i)) / stackCount;
  //   const positionAdjustmentX = (1 - scaleAdjustment) * 2 * scaledImageWidth;
  //   const positionAdjustmentY = (1 - scaleAdjustment) * scaledImageHeight;
  //   ctx.drawImage(
  //     imageCanvas,
  //     position.x + positionAdjustmentX,
  //     position.y - positionAdjustmentY,
  //     scaledImageWidth * scaleAdjustment,
  //     scaledImageHeight * scaleAdjustment,
  //   );
  // }
  // Draw the image to the main canvas
  if (imageRotation) {
    // Convert degrees to radians
    const angleInRadians = (imageRotation * Math.PI) / 180;

    // Translate context to image position
    ctx.translate(position.x + scaledImageWidth / 2, position.y + scaledImageHeight / 2);

    // Rotate context
    ctx.rotate(angleInRadians);

    // Draw image centered on the translated and rotated context
    ctx.drawImage(imageCanvas, -scaledImageWidth / 2, -scaledImageHeight / 2, scaledImageWidth, scaledImageHeight);

    // Reset transformation matrix to the identity matrix
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    ctx.drawImage(imageCanvas, position.x, position.y, scaledImageWidth, scaledImageHeight);
  }

  // Reset shadow on the main canvas
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Render text to the canvas
  if (textToRender) {
    const fontFamily = 'sans-serif';
    const textCanvas = document.createElement('canvas');
    textCanvas.width = canvas.width;
    textCanvas.height = canvas.height;
    const textCtx = textCanvas.getContext('2d');
    if (!textCtx) return;
    textCtx.font = `${fontSize}px ${fontFamily}`;
    textCtx.textAlign = 'center';
    textCtx.textBaseline = 'middle';

    textCtx.fillStyle = '#FFFFFF';
    textCtx.fillText(textToRender, textCanvas.width / 2, textCanvas.height / 2);

    // Draw the text to the main canvas
    ctx.drawImage(textCanvas, textPositionX, textPositionY);
  }
};

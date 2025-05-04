import { Effect } from '../effect';
import { greyScale } from './image-filters/grey-scale';
import { sepia } from './image-filters/sepia';
import { gingham } from './image-filters/gingham';
import { clarendon } from './image-filters/clarendon';
import { invert } from './image-filters/invert';
import { reyes } from './image-filters/reyes';
import { lofi } from './image-filters/lofi';
import { flip } from './image-filters/flip';
import { Image } from '../nodes/image';

export const filters = {
  'grey-scale': greyScale,
  sepia: (imageData: ImageData) => sepia(imageData, 1),
  gingham,
  clarendon,
  invert,
  reyes,
  lofi,
  'flip-horizontal': (imageData: ImageData) => flip(imageData, 'horizontal'),
  'flip-vertical': (imageData: ImageData) => flip(imageData, 'vertical'),
};

export type Filter = keyof typeof filters;

export class ImageFilter extends Effect {
  public stage = 'before' as const;
  #node: Image | null = null;
  #previousImage: HTMLImageElement | null = null;

  constructor(private filter: Filter) {
    super();
  }

  setNode(node: Image) {
    this.#node = node;

    // Save the previous image
    this.#previousImage = node.effectImage;

    // Create a temp canvas to draw the image
    const canvas = document.createElement('canvas');
    canvas.width = node.image.width;
    canvas.height = node.image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the existing image to the temp canvas
    ctx.drawImage(this.#previousImage, 0, 0);

    // Apply the filter
    const imageData = this.applyFilter(ctx, canvas);
    if (!imageData) return;

    // Draw the updated image data to the temp canvas
    ctx.putImageData(imageData, 0, 0);
    const filteredImage = document.createElement('img');
    filteredImage.src = canvas.toDataURL();
    filteredImage.onload = () => {
      // Override the node's effect image
      this.#node?.setEffectImage(filteredImage);

      // Redraw the node
      this.#node?.redraw();
    };
  }

  applyFilter(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const filter = filters[this.filter];
    if (filter) {
      return filter(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
  }

  cleanup() {
    // Restore the previous image
    if (this.#previousImage) this.#node?.setEffectImage(this.#previousImage);

    // Clear render cache
    this.#node?.redraw();

    // Clear the node
    this.#node = null;
  }

  render() {
    return;
  }
}

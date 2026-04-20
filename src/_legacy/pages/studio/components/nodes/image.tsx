import { Node, NodeParams } from '../node';

type ImageParams = NodeParams & {
  image: HTMLImageElement | string;
};

export class Image extends Node {
  public readonly type: string = 'image';

  #image: HTMLImageElement;
  #effectImage?: HTMLImageElement;

  constructor(params: ImageParams) {
    super(params);

    if (typeof params.image === 'string') {
      const image = document.createElement('img');
      image.src = params.image;
      this.#image = image;
    } else {
      this.#image = params.image;
    }
  }

  get image(): HTMLImageElement {
    return this.#effectImage ?? this.#image;
  }

  public setImage(image: HTMLImageElement): void {
    this.#image = image;
  }

  get effectImage(): HTMLImageElement {
    return this.#effectImage ?? this.#image;
  }

  public setEffectImage(image: HTMLImageElement): void {
    this.#effectImage = image;
  }

  protected renderToCanvas(): HTMLCanvasElement {
    // Create a canvas to render the node to
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;

    // Get the context of the canvas
    const nodeCtx = canvas.getContext('2d');
    if (!nodeCtx) return canvas;

    // Draw the colour
    if (this.colour) {
      nodeCtx.fillStyle = this.colour;
      nodeCtx.fillRect(0, 0, this.width, this.height);
    }

    // Draw the image
    nodeCtx.drawImage(this.image, 0, 0, this.width, this.height);

    // Draw the canvas
    if (this.canvas) {
      nodeCtx.drawImage(this.canvas, 0, 0, this.width, this.height);
    }

    return canvas;
  }
}

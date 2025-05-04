import { createPipe } from '../../common/create-pipe';
import { clarendon } from '../effects/image-filters/clarendon';
import { flip } from '../effects/image-filters/flip';
import { gingham } from '../effects/image-filters/gingham';
import { greyScale } from '../effects/image-filters/grey-scale';
import { invert } from '../effects/image-filters/invert';
import { lofi } from '../effects/image-filters/lofi';
import { reyes } from '../effects/image-filters/reyes';
import { sepia } from '../effects/image-filters/sepia';
import { Node, NodeParams } from '../node';

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

type VideoParams = NodeParams & {
  video: HTMLVideoElement | string;
};

export class Video extends Node {
  public readonly type: string = 'video';

  #video: HTMLVideoElement;

  constructor(params: VideoParams) {
    super(params);

    if (typeof params.video === 'string') {
      const video = document.createElement('video');
      video.src = params.video;
      this.#video = video;
    } else {
      this.#video = params.video;
    }

    // Start the video
    this.#video.play();

    // Loop the video
    this.#video.loop = true;
  }

  get video(): HTMLVideoElement {
    return this.#video;
  }

  public setVideo(video: HTMLVideoElement): void {
    this.#video = video;
  }

  public render(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number): void {
    // Save the current state of the context
    ctx.save();

    // Apply transformations for drawing the node
    ctx.translate(translatePos.x, translatePos.y);
    ctx.scale(scale, scale);
    ctx.rotate((this.rotation * Math.PI) / 180);

    const canvas = document.createElement('canvas');
    canvas.width = this.#video.videoWidth / 4;
    canvas.height = this.#video.videoHeight / 4;
    const tempCtx = canvas.getContext('2d');
    if (!tempCtx) return;

    this.resize(canvas.width, canvas.height);

    // Shrink the video to 25%
    tempCtx.scale(0.25, 0.25);

    // Draw the video to the temp canvas
    tempCtx.drawImage(this.#video, 0, 0);

    // Apply the filter
    const imageData = createPipe(tempCtx.getImageData(0, 0, canvas.width, canvas.height))(
      // (imageData) => sepia(imageData, 1),
      (imageData) => lofi(imageData),
    );
    if (!imageData) return;

    // Draw the updated image data to the canvas
    ctx.putImageData(imageData, translatePos.x + this.x, translatePos.y + this.y);

    // Restore the state of the context
    ctx.restore();
  }

  public cleanup() {
    document.getElementById(this.#video.id)?.remove();
  }
}

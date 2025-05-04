import { NodeParams } from '../node';
import { UIElement } from './ui-element';

type UIMetadataParams = NodeParams;

export class UIMetadata extends UIElement {
  #metadata: Record<string, unknown> = {};

  constructor(params: UIMetadataParams) {
    super(params);
  }

  public render(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number): void {
    if (!this.#metadata) return;

    // Render the metadata
    // Make sure it fits within the canvas and the node
    const x = Math.min(Math.max(this.x, 0), ctx.canvas.width - 200);
    const y = Math.min(Math.max(this.y, 0), ctx.canvas.height - 100);

    // Draw the background
    ctx.fillStyle = 'white';
    ctx.fillRect(x, y, 200, 100);

    // Draw the border
    ctx.strokeStyle = 'black';
    ctx.strokeRect(x, y, 200, 100);

    // Draw the metadata
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    // We need to take new lines into account
    let offsetY = 15;
    for (const key in this.#metadata) {
      ctx.fillText(`${key}: ${this.#metadata[key]}`, x + 5, y + offsetY);
      offsetY += 15;
    }
  }

  public onClick(): void {}
  public onHoverStart(): void {}

  public setMetadata(metadata: any): void {
    this.#metadata = metadata;
  }
}

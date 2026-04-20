import { Effect } from '../effect';
import { Node } from '../node';

type BorderParams = {
  lineWidth: number;
  colour: string;
};

export class Border extends Effect {
  public stage = 'before' as const;
  #node: Node | null = null;

  constructor(private options: BorderParams) {
    super();
  }

  setNode(node: Node) {
    this.#node = node;
  }

  render(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number) {
    // Don't render if there's no node
    if (!this.#node) return;

    const { x, y, rotation } = this.#node;

    // Save the current state of the context
    ctx.save();

    // Apply transformations
    ctx.translate(x + translatePos.x, y + translatePos.y);
    ctx.scale(scale, scale);
    ctx.rotate((rotation * Math.PI) / 180);

    // Draw the effect
    this.#renderEffect(ctx);

    // Restore the state of the context
    ctx.restore();
  }

  #renderEffect(ctx: CanvasRenderingContext2D) {
    // Don't render if there's no node
    if (!this.#node) return;

    const { lineWidth, colour } = this.options;
    const { width, height } = this.#node;

    // Draw the border
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = colour;
    ctx.strokeRect(0, 0, width, height);
  }

  cleanup(): void {
    this.#node = null;
  }
}

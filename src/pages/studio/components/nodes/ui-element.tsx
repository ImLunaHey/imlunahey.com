import { Node, NodeParams } from '../node';

type UIElementParams = NodeParams;

export class UIElement extends Node {
  constructor(params: UIElementParams) {
    super(params);
  }

  public render(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number): void {
    // Save the current state of the context
    ctx.save();

    // Apply transformations for drawing the node
    ctx.translate(translatePos.x, translatePos.y);
    ctx.scale(scale, scale);
    ctx.rotate((this.rotation * Math.PI) / 180);

    // Restore the state of the context
    ctx.restore();
  }

  public onClick(): void {}

  public onHoverStart(): void {}
  public onHoverStop(): void {}
}

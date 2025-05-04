import { Position } from '../../common/position';
import { Node, NodeParams } from '../node';

export type CircleParams = NodeParams;

export class Circle extends Node {
  public readonly type: string = 'circle';

  constructor(params: CircleParams) {
    super(params);
  }

  public render(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number): void {
    // Save the current state of the context
    ctx.save();

    // Apply transformations for drawing the node
    ctx.translate(translatePos.x, translatePos.y);
    ctx.scale(scale, scale);
    ctx.rotate((this.rotation * Math.PI) / 180);

    ctx.fillStyle = this.colour;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();

    // Restore the state of the context
    ctx.restore();
  }

  public isWithinPosition({ x, y, width, height }: Position & { width: number; height: number }): boolean {
    const dx = this.x - Math.max(x, Math.min(this.x, x + width));
    const dy = this.y - Math.max(y, Math.min(this.y, y + height));
    return dx * dx + dy * dy < (this.width * this.width) / 4;
  }

  public renderBorder(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number): void {
    // Save the current state of the context
    ctx.save();

    // Apply transformations for drawing the node
    ctx.translate(translatePos.x, translatePos.y);
    ctx.scale(scale, scale);
    ctx.rotate((this.rotation * Math.PI) / 180);

    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width / 2, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.closePath();

    // Restore the state of the context
    ctx.restore();
  }

  public renderHandles(ctx: CanvasRenderingContext2D, translatePos: Position, scale: number): void {
    // Save the current state of the context
    ctx.save();

    // Apply transformations for drawing the node
    ctx.translate(translatePos.x, translatePos.y);
    ctx.scale(scale, scale);
    ctx.rotate((this.rotation * Math.PI) / 180);

    // Draw the handles
    ctx.fillStyle = 'pink';
    ctx.fillRect(this.x - 5, this.y - this.width / 2 - 5, 10, 10);
    ctx.fillRect(this.x + this.width / 2 - 5, this.y - 5, 10, 10);
    ctx.fillRect(this.x - 5, this.y + this.width / 2 - 5, 10, 10);
    ctx.fillRect(this.x - this.width / 2 - 5, this.y - 5, 10, 10);

    // Restore the state of the context
    ctx.restore();
  }
}

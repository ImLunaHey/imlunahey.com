import { Position } from '../../common/position';
import { Node, NodeParams } from '../node';

type LineParams = NodeParams;

export class Line extends Node {
  public readonly type: string = 'line';

  constructor(params: LineParams) {
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
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
    ctx.stroke();
    ctx.closePath();

    // Restore the state of the context
    ctx.restore();
  }

  public renderBorder(ctx: CanvasRenderingContext2D, translatePos: Position, scale: number): void {
    // Save the current state of the context
    ctx.save();

    // Apply transformations for drawing the node
    ctx.translate(translatePos.x, translatePos.y);
    ctx.scale(scale, scale);
    ctx.rotate((this.rotation * Math.PI) / 180);

    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width, this.y + this.height);
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

    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc(this.x + this.width, this.y + this.height, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();

    // Restore the state of the context
    ctx.restore();
  }
}

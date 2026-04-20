import { Position } from '../../common/position';
import { Node, NodeParams } from '../node';

export type TriangleParams = NodeParams;

export class Triangle extends Node {
  public readonly type: string = 'triangle';

  constructor(params: TriangleParams) {
    super(params);
  }

  public render(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number): void {
    // Save the current state of the context
    ctx.save();

    // Apply transformations for drawing the node
    ctx.translate(translatePos.x, translatePos.y);
    ctx.scale(scale, scale);
    ctx.rotate((this.rotation * Math.PI) / 180);

    // Render a triangle
    ctx.fillStyle = this.colour;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.width / 2);
    ctx.lineTo(this.x + this.width / 2, this.y + this.width / 2);
    ctx.lineTo(this.x - this.width / 2, this.y + this.width / 2);
    ctx.fill();
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

    // Render a triangle border
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.width / 2);
    ctx.lineTo(this.x + this.width / 2, this.y + this.width / 2);
    ctx.lineTo(this.x - this.width / 2, this.y + this.width / 2);
    ctx.lineTo(this.x, this.y - this.width / 2);
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

    // Render handles
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(this.x, this.y - this.width / 2, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc(this.x + this.width / 2, this.y + this.width / 2, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.arc(this.x - this.width / 2, this.y + this.width / 2, 5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();

    // Restore the state of the context
    ctx.restore();
  }

  public isWithinPosition({ x, y, width, height }: Position & { width: number; height: number }): boolean {
    const points = [
      { x: this.x, y: this.y - this.width / 2 },
      { x: this.x + this.width / 2, y: this.y + this.width / 2 },
      { x: this.x - this.width / 2, y: this.y + this.width / 2 },
    ];

    return points.every((point) => {
      const transformedX =
        point.x * Math.cos((this.rotation * Math.PI) / 180) - point.y * Math.sin((this.rotation * Math.PI) / 180) + this.x;
      const transformedY =
        point.x * Math.sin((this.rotation * Math.PI) / 180) + point.y * Math.cos((this.rotation * Math.PI) / 180) + this.y;
      return transformedX >= x && transformedX <= x + width && transformedY >= y && transformedY <= y + height;
    });
  }
}

import { Node, NodeParams } from '../node';
import { UIElement } from './ui-element';

type UIButtonParams = NodeParams & {
  label: string;
};

export class UIButton extends UIElement {
  #label: string;
  #hovering: boolean = false;

  constructor(params: UIButtonParams) {
    super(params);

    this.#label = params.label;
  }

  public render(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number): void {
    // Take scale and translation into account also the hovering state
    const width = this.#hovering ? this.width * 0.95 : this.width;
    const height = this.#hovering ? this.height * 0.95 : this.height;
    const x = this.x + (this.width - width) / 2;
    const y = this.y + (this.height - height) / 2;

    // Draw the button
    ctx.fillStyle = '#111214';

    // Rounded corners
    ctx.beginPath();
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + width - 5, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + 5);
    ctx.lineTo(x + width, y + height - 5);
    ctx.quadraticCurveTo(x + width, y + height, x + width - 5, y + height);
    ctx.lineTo(x + 5, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - 5);
    ctx.lineTo(x, y + 5);
    ctx.quadraticCurveTo(x, y, x + 5, y);
    ctx.fill();
    ctx.closePath();

    // Draw the label
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Arial';
    ctx.fillText(this.#label, x + width / 2, y + height / 2);
  }

  // On click
  public onClick(): void {
    alert('Button clicked');
  }

  // On hover
  public onHoverStart(): void {
    this.#hovering = true;
  }

  public onHoverStop(): void {
    this.#hovering = false;
  }
}

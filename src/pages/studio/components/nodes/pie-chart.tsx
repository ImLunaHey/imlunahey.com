import { Circle, CircleParams } from './circle';

type Slice = {
  value: number;
  label?: string;
  color?: string;
};

type PieChartParams = CircleParams & {
  slices: Slice[];
};

export class PieChart extends Circle {
  public readonly type: string = 'pie-chart';

  #slices: Slice[];

  constructor(params: PieChartParams) {
    super(params);

    this.#slices = params.slices;
  }

  public render(ctx: CanvasRenderingContext2D, translatePos: { x: number; y: number }, scale: number): void {
    // Save the current state of the context
    ctx.save();

    // Apply transformations for drawing the node
    ctx.translate(translatePos.x, translatePos.y);
    ctx.scale(scale, scale);

    // Render the background circle
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.width / 2, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();

    // Render the pie chart
    const total = this.#slices.reduce((acc, slice) => acc + slice.value, 0);
    let startAngle = 0;

    // Render each slice
    for (let i = 0; i < this.#slices.length; i++) {
      // Render the slice
      const sliceAngle = (this.#slices[i].value / total) * Math.PI * 2;
      ctx.fillStyle = `hsl(${(i / this.#slices.length) * 360}, 100%, 50%)`;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, this.width / 2, startAngle, startAngle + sliceAngle);
      ctx.fill();
      ctx.closePath();

      // Outline the slice
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, this.width / 2, startAngle, startAngle + sliceAngle);
      ctx.stroke();
      ctx.closePath();

      //   // Render the label
      //   const label = this.#slices[i].label;
      //   if (label) {
      //     ctx.fillStyle = 'black';
      //     ctx.textAlign = 'center';
      //     ctx.textBaseline = 'middle';
      //     const midAngle = startAngle + sliceAngle / 2;
      //     const x = this.x + Math.cos(midAngle) * (this.width / 4);
      //     const y = this.y + Math.sin(midAngle) * (this.width / 4);
      //     ctx.fillText(label, x, y);
      //   }

      startAngle += sliceAngle;
    }

    // Restore the state of the context
    ctx.restore();
  }
}

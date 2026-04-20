import { Circle } from '../components/nodes/circle';
import { Line } from '../components/nodes/line';
import { Rectangle } from '../components/nodes/rectangle';
import { Triangle } from '../components/nodes/triangle';

type CreateNewNodeParams = {
  type: 'rectangle' | 'circle' | 'triangle' | 'line' | 'pie-chart';
  x: number;
  y: number;
  colour: string;
};

export const createNewNode = ({ type, x, y, colour }: CreateNewNodeParams) => {
  switch (type) {
    case 'rectangle':
      return new Rectangle({
        id: crypto.randomUUID(),
        x,
        y,
        width: 5,
        height: 5,
        rotation: 0,
        zIndex: 0,
        canvas: null,
        effects: [],
        colour,
      });

    case 'circle':
      return new Circle({
        id: crypto.randomUUID(),
        x,
        y,
        width: 5,
        height: 5,
        rotation: 0,
        zIndex: 0,
        canvas: null,
        effects: [],
        colour,
      });

    case 'triangle':
      return new Triangle({
        id: crypto.randomUUID(),
        x,
        y,
        width: 5,
        height: 5,
        rotation: 0,
        zIndex: 0,
        canvas: null,
        effects: [],
        colour,
      });

    case 'line':
      return new Line({
        id: crypto.randomUUID(),
        x,
        y,
        width: 5,
        height: 5,
        rotation: 0,
        zIndex: 0,
        canvas: null,
        effects: [],
        colour,
      });
  }

  throw new Error('Invalid type');
};

import { Node, NodeParams } from '../node';

type DrawingParams = NodeParams;

export class Drawing extends Node {
  public readonly type: string = 'drawing';

  constructor(params: DrawingParams) {
    super(params);
  }
}

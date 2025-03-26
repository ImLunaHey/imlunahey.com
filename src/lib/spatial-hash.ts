export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpatialHashItem<T> = {
  bounds: BoundingBox;
  data: T;
};

export class SpatialHashGrid<T> {
  private cells: Map<string, Set<SpatialHashItem<T>>>;
  private cellSize: number;

  constructor(cellSize: number) {
    this.cells = new Map();
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getCellsForBounds(bounds: BoundingBox): string[] {
    const startX = Math.floor(bounds.x / this.cellSize);
    const startY = Math.floor(bounds.y / this.cellSize);
    const endX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const endY = Math.floor((bounds.y + bounds.height) / this.cellSize);

    const cells: string[] = [];
    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        cells.push(this.getCellKey(x * this.cellSize, y * this.cellSize));
      }
    }
    return cells;
  }

  insert(item: SpatialHashItem<T>): void {
    const cells = this.getCellsForBounds(item.bounds);
    for (const cell of cells) {
      if (!this.cells.has(cell)) {
        this.cells.set(cell, new Set());
      }
      this.cells.get(cell)!.add(item);
    }
  }

  clear(): void {
    this.cells.clear();
  }

  query(bounds: BoundingBox): Set<SpatialHashItem<T>> {
    const cells = this.getCellsForBounds(bounds);
    const result = new Set<SpatialHashItem<T>>();

    for (const cell of cells) {
      const items = this.cells.get(cell);
      if (items) {
        for (const item of items) {
          // Check for actual intersection
          if (this.intersects(bounds, item.bounds)) {
            result.add(item);
          }
        }
      }
    }

    return result;
  }

  private intersects(a: BoundingBox, b: BoundingBox): boolean {
    return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
  }
}

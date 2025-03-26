export class CanvasCache {
  private cache: Map<string, HTMLCanvasElement>;
  private maxCacheSize: number;

  constructor(maxCacheSize = 50) {
    this.cache = new Map();
    this.maxCacheSize = maxCacheSize;
  }

  private createCacheKey(x: number, y: number, width: number, height: number, scale: number): string {
    return `${Math.floor(x)},${Math.floor(y)},${Math.floor(width)},${Math.floor(height)},${scale.toFixed(2)}`;
  }

  getCachedCanvas(x: number, y: number, width: number, height: number, scale: number): HTMLCanvasElement | null {
    const key = this.createCacheKey(x, y, width, height, scale);
    return this.cache.get(key) || null;
  }

  cacheCanvas(x: number, y: number, width: number, height: number, scale: number, canvas: HTMLCanvasElement): void {
    const key = this.createCacheKey(x, y, width, height, scale);

    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = Array.from(this.cache.keys())[0];
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Create a new canvas and copy the content
    const cachedCanvas = document.createElement('canvas');
    cachedCanvas.width = canvas.width;
    cachedCanvas.height = canvas.height;
    const ctx = cachedCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(canvas, 0, 0);
      this.cache.set(key, cachedCanvas);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  invalidateRegion(x: number, y: number, width: number, height: number): void {
    // Remove any cached sections that intersect with this region
    for (const [key] of this.cache) {
      const [cacheX, cacheY, cacheWidth, cacheHeight] = key.split(',').map(Number);
      if (!(cacheX + cacheWidth < x || x + width < cacheX || cacheY + cacheHeight < y || y + height < cacheY)) {
        this.cache.delete(key);
      }
    }
  }
}

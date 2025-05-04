import { Layer, lastknownSafezone, loadTime } from '../components/studio';
import { Point } from './point';
import { Position } from './position';
import { cachedRenderedCanvases } from './cache';
import { humanTime } from './human-time';

type RenderParams = {
  /**
   * The canvas to render to
   */
  canvas: HTMLCanvasElement | null;
  /**
   * The scale of the canvas
   */
  scale: number;
  translatePos: Position;
  layers: Layer[];
  activeTool: string;
  brushSize: number;
  brushColour: string;
  mousePos: Position;
  brushPoints: Point[];
  selectedNodes: Set<string>;
  showDebug: boolean;
  showSafezone: boolean;
};

export const render = (
  {
    canvas,
    scale,
    translatePos,
    layers,
    activeTool,
    brushSize,
    brushColour,
    mousePos,
    brushPoints,
    selectedNodes,
    showDebug,
    showSafezone,
  }: RenderParams,
  framesRendered: number,
) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear the canvas
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Render a background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // @ts-expect-error - memory is not available in the Performance interface
  const memory = window.performance.memory;
  if (memory) {
    const performanceStats = `Memory: ${memory.usedJSHeapSize / 1000000}MB / ${memory.jsHeapSizeLimit / 1000000}MB`;

    // Render the performance stats at the bottom center
    ctx.fillText(performanceStats, (ctx.canvas.width - ctx.measureText(performanceStats).width) / 2, ctx.canvas.height - 30);
  }

  // Render the safezone
  if (showSafezone) {
    const safezone = {
      x: 0,
      y: 0,
      width: 1920 * scale,
      height: 1080 * scale,
    };

    // Save the current state of the context
    ctx.save();

    // Translate the canvas to the current position
    ctx.translate(translatePos.x, translatePos.y);

    // Scale the canvas
    ctx.scale(scale, scale);

    // If the safezone size has changed we should re-render the safezone canvas
    if (
      lastknownSafezone.x !== safezone.x ||
      lastknownSafezone.y !== safezone.y ||
      lastknownSafezone.width !== safezone.width ||
      lastknownSafezone.height !== safezone.height ||
      showDebug
    ) {
      // Update the last known safezone
      lastknownSafezone.x = safezone.x;
      lastknownSafezone.y = safezone.y;
      lastknownSafezone.width = safezone.width;
      lastknownSafezone.height = safezone.height;

      // Create a safezone canvas
      const safezoneCanvas = document.createElement('canvas');
      safezoneCanvas.width = safezone.width;
      safezoneCanvas.height = safezone.height;

      // Get the context of the safezone canvas
      const safezoneCtx = safezoneCanvas.getContext('2d');
      if (!safezoneCtx) return;

      // Fill safezone with a "transparent" checkerboard
      const size = 20;
      for (let x = 0; x < safezone.width; x += size) {
        for (let y = 0; y < safezone.height; y += size) {
          safezoneCtx.fillStyle = (x + y) % (size * 2) === 0 ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.2)';
          safezoneCtx.fillRect(x, y, size, size);
        }
      }

      // Cache the safezone canvas
      cachedRenderedCanvases.set('safezone', safezoneCanvas);
    }

    // Get the safezone canvas
    const safezoneCanvas = cachedRenderedCanvases.get('safezone');
    if (!safezoneCanvas) return;

    // Get the context of the safezone canvas
    const safezoneCtx = safezoneCanvas.getContext('2d');
    if (!safezoneCtx) return;

    // Show debug info
    if (showDebug) {
      // Above the safezone we should write some debug info
      safezoneCtx.font = '20px Arial';
      safezoneCtx.fillStyle = 'black';
      safezoneCtx.fillText(`Scale: ${scale}`, 10, 30);
      safezoneCtx.fillText(`Translate: ${translatePos.x}, ${translatePos.y}`, 10, 60);
      safezoneCtx.fillText(`Mouse: ${mousePos.x}, ${mousePos.y}`, 10, 90);
      safezoneCtx.fillText(`Brush Size: ${brushSize}`, 10, 120);
      safezoneCtx.fillText(`Brush Colour: ${brushColour}`, 10, 150);
      safezoneCtx.fillText(`Active Tool: ${activeTool}`, 10, 180);
      safezoneCtx.fillText(`Frames rendered: ${framesRendered}`, 10, 210);
      safezoneCtx.fillText(`Total nodes: ${layers.reduce((acc, layer) => acc + layer.nodes.length, 0)}`, 10, 240);
      safezoneCtx.fillText(`Time since app loaded ${humanTime(Date.now() - loadTime)}`, 10, 270);
    }

    // Draw the safezone canvas
    ctx.drawImage(safezoneCanvas, 0, 0);

    // Draw the safezone outline
    if (showSafezone) {
      ctx.beginPath();
      // Draw a box around the viewport it should get small if we zoom out
      // It should get big if we zoom in
      // It should be fixed in position on the canvas not the viewport
      ctx.rect(0, 0, safezone.width + 1, safezone.height + 1);
      ctx.strokeStyle = 'red';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw instructions above the safezone
    ctx.font = '20px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('Anything outside of this box will not be visible on the final render', 10, -10);

    // Restore the context to the state before we translated and scaled it
    ctx.restore();
  }

  const viewport = {
    x: -translatePos.x / scale,
    y: -translatePos.y / scale,
    width: window.innerWidth / scale,
    height: window.innerHeight / scale,
  };

  // Render all the layers
  for (const layer of layers.filter((layer) => layer.visible)) {
    // Only render nodes that are within the viewport
    const nodesWithinViewport = layer.nodes.filter((node) => node.isWithinPosition(viewport));

    // Render the nodes
    for (const node of nodesWithinViewport) {
      const beforeEffects = node.effects.filter((effect) => effect.stage === 'before');
      const afterEffects = node.effects.filter((effect) => effect.stage === 'after');

      // Render the node's before effects
      for (const effect of beforeEffects) {
        effect.render(ctx, translatePos, scale);
      }

      // Render the node
      node.render(ctx, translatePos, scale);

      // Render the node's after effects
      for (const effect of afterEffects) {
        effect.render(ctx, translatePos, scale);
      }

      // If the node is selected render a border and handles
      if (selectedNodes.has(node.id)) {
        node.renderBorder(ctx, translatePos, scale);
        node.renderHandles(ctx, translatePos, scale);
      }
    }
  }

  // Save the current state of the context
  ctx.save();

  // Translate the canvas to the current position
  ctx.translate(translatePos.x, translatePos.y);

  // Scale the canvas
  ctx.scale(scale, scale);

  // Render the brush preview
  if (brushPoints.length >= 1) {
    ctx.strokeStyle = brushColour;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';

    ctx.beginPath(); // Begin a new path for the brush preview
    ctx.moveTo(brushPoints[0].x, brushPoints[0].y); // Move to the start of the brush points

    // Draw all of the points
    for (const [index, point] of brushPoints.entries()) {
      if (index > 0) {
        ctx.lineTo(point.x, point.y);
        ctx.moveTo(point.x, point.y);
        ctx.stroke();
      }
    }
    ctx.closePath(); // Close the path
  }

  // Restore the context to the state before we translated and scaled it
  ctx.restore();

  // If we have a brush render it where the mouse is
  if (activeTool === 'brush') {
    if (brushSize >= 1) {
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, brushSize / 2, 0, 2 * Math.PI);
      ctx.fillStyle = brushColour;
      ctx.fill();
    }
  }
};

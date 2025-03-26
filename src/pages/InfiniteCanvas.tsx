import { useEffect, useRef, useState, useCallback } from 'react';
import images from '../assets/images.json' with { type: 'json' };
import { SpatialHashGrid } from '../lib/spatial-hash';
import { CanvasCache } from '../lib/canvas-cache';

const useAutoCanvasResizer = (ref: React.RefObject<HTMLCanvasElement | null>, onResize?: () => void) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const resizeCanvas = () => {
      const element = ref.current;
      if (!element) return;

      const container = element.parentElement;
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      element.width = width;
      element.height = height;
      setDimensions({ width, height });
      onResize?.();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [ref, onResize]);

  return dimensions;
};

type Node =
  | {
      x: number;
      y: number;
      width: number;
      height: number;
      type: 'rect';
      color: string;
    }
  | {
      x: number;
      y: number;
      radius: number;
      type: 'circle';
      color: string;
    }
  | {
      x: number;
      y: number;
      text: string;
      type: 'text';
      color: string;
    }
  | {
      x: number;
      y: number;
      width: number;
      height: number;
      type: 'image';
      src: string;
    };

const InfiniteCanvas = ({ nodes, onOffsetChange }: { nodes: Node[]; onOffsetChange: (offset: { x: number; y: number }, scale: number) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCache = useRef<CanvasCache>(new CanvasCache(50));
  const handleResize = useCallback(() => {
    canvasCache.current.clear();
  }, []);
  const dimensions = useAutoCanvasResizer(canvasRef, handleResize);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const spatialHash = useRef<SpatialHashGrid<Node>>(new SpatialHashGrid(500)); // 500px cell size

  // Notify parent of offset changes
  useEffect(() => {
    onOffsetChange(offset, scale);
  }, [offset, scale, onOffsetChange]);

  // Update spatial hash when nodes change
  useEffect(() => {
    spatialHash.current.clear();
    nodes.forEach(node => {
      const width = node.type === 'text' ? 100 : // Estimate text width
        node.type === 'circle' ? node.radius * 2 : 
        node.width;
      
      const height = node.type === 'text' ? 20 : // Estimate text height
        node.type === 'circle' ? node.radius * 2 : 
        node.height;

      spatialHash.current.insert({
        bounds: {
          x: node.x,
          y: node.y,
          width,
          height
        },
        data: node
      });
    });
  }, [nodes]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Clear the canvas before rendering
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const renderNodes = async () => {
      ctx.save();

      // Calculate visible area in world coordinates
      const visibleArea = {
        x: offset.x,
        y: offset.y,
        width: dimensions.width / scale,
        height: dimensions.height / scale
      };

      // Check if we have a cached version of this view
      const cachedCanvas = canvasCache.current.getCachedCanvas(
        visibleArea.x,
        visibleArea.y,
        visibleArea.width,
        visibleArea.height,
        scale
      );

      if (cachedCanvas) {
        // Use cached version
        ctx.drawImage(cachedCanvas, 0, 0);
        ctx.restore();
        return;
      }

      // Query spatial hash for visible nodes
      const visibleItems = spatialHash.current.query(visibleArea);
      const nodesToRender = Array.from(visibleItems).map(item => item.data);

      // Only proceed if we have nodes to render
      if (nodesToRender.length === 0) {
        ctx.restore();
        return;
      }

      // Create an offscreen canvas for caching
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = dimensions.width;
      offscreenCanvas.height = dimensions.height;
      const offscreenCtx = offscreenCanvas.getContext('2d');
      
      if (!offscreenCtx) {
        ctx.restore();
        return;
      }

      // Track if we've successfully rendered anything
      let hasRenderedContent = false;

      // Render to offscreen canvas
      for (const node of nodesToRender) {
        // Apply camera offset and scale to all rendering
        const x = (node.x - offset.x) * scale;
        const y = (node.y - offset.y) * scale;

        if (node.type === 'rect') {
          offscreenCtx.fillStyle = node.color;
          offscreenCtx.fillRect(x, y, node.width * scale, node.height * scale);
          hasRenderedContent = true;
        } else if (node.type === 'circle') {
          offscreenCtx.beginPath();
          offscreenCtx.fillStyle = node.color;
          offscreenCtx.arc(x, y, node.radius * scale, 0, Math.PI * 2);
          offscreenCtx.fill();
          hasRenderedContent = true;
        } else if (node.type === 'text') {
          offscreenCtx.fillStyle = node.color;
          offscreenCtx.font = `${12 * scale}px Arial`;
          offscreenCtx.fillText(node.text, x, y);
          hasRenderedContent = true;
        } else if (node.type === 'image') {
          // Draw white border/background
          const borderWidth = 8 * scale;
          offscreenCtx.fillStyle = '#FFFFFF';
          offscreenCtx.fillRect(
            x - borderWidth,
            y - borderWidth,
            node.width * scale + borderWidth * 2,
            node.height * scale + borderWidth * 2
          );

          // Get or create cached image
          let image = imageCache.current.get(node.src);
          if (!image) {
            image = new Image();
            image.src = node.src;
            imageCache.current.set(node.src, image);
            
            // Wait for image to load if it hasn't
            if (!image.complete) {
              await new Promise((resolve) => {
                image!.onload = resolve;
              });
            }
          }

          // Draw the image
          offscreenCtx.drawImage(image, x, y, node.width * scale, node.height * scale);
          hasRenderedContent = true;
        }
      }

      // Only cache and draw if we actually rendered something
      if (hasRenderedContent) {
        // Cache the rendered section
        canvasCache.current.cacheCanvas(
          visibleArea.x,
          visibleArea.y,
          visibleArea.width,
          visibleArea.height,
          scale,
          offscreenCanvas
        );

        // Draw the offscreen canvas to the main canvas
        ctx.drawImage(offscreenCanvas, 0, 0);
      }
      
      ctx.restore();
    };

    renderNodes();
  }, [nodes, dimensions.width, dimensions.height, offset, scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let activeTouches: Touch[] = [];
    let initialDistance = 0;
    let initialScale = 1;

    const getDistance = (touch1: Touch, touch2: Touch) => {
      return Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    };

    const getCenter = (touch1: Touch, touch2: Touch) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((touch1.clientX + touch2.clientX) / 2) - rect.left,
        y: ((touch1.clientY + touch2.clientY) / 2) - rect.top
      };
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      isDragging.current = true;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !isDragging.current) return;

      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;

      setOffset(prev => ({
        x: prev.x - dx / scale,
        y: prev.y - dy / scale,
      }));

      lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      isDragging.current = false;
      canvas.releasePointerCapture(e.pointerId);
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();

      // Pinch to zoom with 2 fingers
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        initialDistance = getDistance(touch1, touch2);
        initialScale = scale;
      }
      // Pan with 1 finger
      else if (e.touches.length === 1) {
        const touch = e.touches[0];
        lastMousePos.current = { x: touch.clientX, y: touch.clientY };
      }
      
      // Update active touches for next move event
      activeTouches = Array.from(e.touches);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      
      // Pinch to zoom with 2 fingers
      if (e.touches.length === 2 && activeTouches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        
        const currentDistance = getDistance(touch1, touch2);
        const touchCenter = getCenter(touch1, touch2);
        
        // Simple ratio with very strong dampening
        const ratio = currentDistance / initialDistance;
        const dampening = ratio > 1 ? 0.1 : 0.2; // More responsive for zoom out
        const scaleFactor = 1 + (ratio - 1) * dampening;
        const newScale = Math.min(Math.max(initialScale * scaleFactor, 0.1), 10);
        
        setOffset(prev => ({
          x: prev.x + (touchCenter.x / scale - touchCenter.x / newScale),
          y: prev.y + (touchCenter.y / scale - touchCenter.y / newScale)
        }));
        
        setScale(newScale);
      }
      // Pan with 1 finger
      else if (e.touches.length === 1 && activeTouches.length >= 1) {
        const touch = e.touches[0];
        
        const dx = touch.clientX - lastMousePos.current.x;
        const dy = touch.clientY - lastMousePos.current.y;
        
        setOffset(prev => ({
          x: prev.x - dx / scale,
          y: prev.y - dy / scale,
        }));
        
        lastMousePos.current = { x: touch.clientX, y: touch.clientY };
      }
      
      // Update active touches for next move event
      activeTouches = Array.from(e.touches);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      // Update active touches for next move event
      activeTouches = Array.from(e.touches);
    };

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY;
        // Increase wheel zoom sensitivity
        const zoomFactor = Math.pow(1.005, delta);

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const newScale = Math.min(Math.max(scale * zoomFactor, 0.1), 10);
        
        setOffset(prev => ({
          x: prev.x + (mouseX / scale - mouseX / newScale),
          y: prev.y + (mouseY / scale - mouseY / newScale),
        }));
        
        setScale(newScale);
      } else {
        const dx = e.deltaX;
        const dy = e.deltaY;

        setOffset(prev => ({
          x: prev.x + dx / scale,
          y: prev.y + dy / scale,
        }));
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointercancel', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [scale]);

  return <canvas ref={canvasRef} style={{ cursor: isDragging.current ? 'grabbing' : 'grab', touchAction: 'none' }} />;
};

export default function InfiniteCanvasPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const imageElements = useRef<HTMLImageElement[]>([]);
  const canvasWidth = useRef(window.innerWidth);
  const canvasHeight = useRef(window.innerHeight);
  const baseLayoutRef = useRef<Array<{ x: number; y: number; width: number; height: number }>>([]);

  const calculateVisibleTiles = useCallback((offset: { x: number; y: number }, scale: number) => {
    console.log('Calculating visible tiles...', { offset, scale });
    if (baseLayoutRef.current.length === 0) {
      console.log('No base layout available');
      return [];
    }

    const positions = baseLayoutRef.current;
    const gap = 24;
    const borderWidth = 8;
    const optimalColumns = Math.min(
      6,
      Math.max(
        2,
        Math.round(Math.sqrt(images.length))
      )
    );
    
    // Calculate base dimensions
    const availableWidth = canvasWidth.current - (gap * (optimalColumns - 1));
    const columnWidth = (availableWidth / optimalColumns) - (borderWidth * 2);
    
    // Get the positions grouped by columns
    const columnPositions: Array<Array<{ x: number; y: number; width: number; height: number; index: number }>> = Array(optimalColumns).fill(null).map(() => []);
    positions.forEach((pos, index) => {
      if (pos.width > 0) {
        const columnIndex = Math.floor(pos.x / (columnWidth + borderWidth * 2 + gap));
        columnPositions[columnIndex].push({ ...pos, index });
      }
    });

    // Calculate column heights (for vertical tiling)
    const columnHeights = columnPositions.map(column => {
      if (column.length === 0) return 0;
      const lastPos = column[column.length - 1];
      return lastPos.y + lastPos.height + borderWidth * 2 + gap;
    });

    // Calculate visible area with padding
    const visibleLeft = offset.x - canvasWidth.current / scale;
    const visibleRight = offset.x + canvasWidth.current * 2 / scale;
    const visibleTop = offset.y - canvasHeight.current / scale;
    const visibleBottom = offset.y + canvasHeight.current * 2 / scale;

    // Calculate column range to render
    const columnWidth_withGaps = columnWidth + borderWidth * 2 + gap;
    const startColumn = Math.floor(visibleLeft / columnWidth_withGaps);
    const endColumn = Math.ceil(visibleRight / columnWidth_withGaps);

    const visibleNodes: Node[] = [];

    // Generate infinite columns
    for (let col = startColumn; col <= endColumn; col++) {
      const baseColumnIndex = ((col % optimalColumns) + optimalColumns) % optimalColumns;
      const columnOffset = col * columnWidth_withGaps;
      const columnHeight = columnHeights[baseColumnIndex];
      
      if (columnHeight > 0) {
        // Calculate vertical tiles needed for this column
        const startTileY = Math.floor(visibleTop / columnHeight);
        const endTileY = Math.ceil(visibleBottom / columnHeight);

        // Add all visible images in this column
        for (let tileY = startTileY; tileY <= endTileY; tileY++) {
          columnPositions[baseColumnIndex].forEach(pos => {
            visibleNodes.push({
              type: 'image' as const,
              src: images[pos.index].url,
              x: columnOffset,
              y: pos.y + (tileY * columnHeight),
              width: pos.width,
              height: pos.height
            });
          });
        }
      }
    }

    console.log('Generated visible nodes:', visibleNodes.length);
    return visibleNodes;
  }, []);

  const handleOffsetChange = useCallback((offset: { x: number; y: number }, scale: number) => {
    console.log('Offset changed:', { offset, scale });
    const nodes = calculateVisibleTiles(offset, scale);
    console.log('Setting nodes:', nodes.length);
    setNodes(nodes);
  }, [calculateVisibleTiles]);

  useEffect(() => {
    console.log('Loading images...');
    imageElements.current = images.map(image => {
      const img = new Image();
      img.src = image.url;
      return img;
    });

    let loadedCount = 0;
    const totalImages = images.length;
    console.log('Total images to load:', totalImages);

    const initializeLayout = () => {
      console.log('Initializing layout...');
      const imageCount = images.length;
      const minColumns = 2;
      const maxColumns = 6;
      const optimalColumns = Math.min(
        maxColumns,
        Math.max(
          minColumns,
          Math.round(Math.sqrt(imageCount))
        )
      );

      const gap = 24;
      const borderWidth = 8;
      const availableWidth = canvasWidth.current - (gap * (optimalColumns - 1));
      const columnWidth = (availableWidth / optimalColumns) - (borderWidth * 2);
      const columns = Array(optimalColumns).fill(0);
      const positions: Array<{ x: number; y: number; width: number; height: number }> = [];

      // Initialize positions array with empty slots
      for (let i = 0; i < imageCount; i++) {
        positions[i] = { x: 0, y: 0, width: 0, height: 0 };
      }

      // Process loaded images
      let hasUnloadedImages = false;
      imageElements.current.forEach((img, index) => {
        if (!img.complete) {
          hasUnloadedImages = true;
          return;
        }

        const aspectRatio = img.width / img.height;
        const width = columnWidth;
        const height = width / aspectRatio;
        
        const shortestColumn = columns.indexOf(Math.min(...columns));
        const x = shortestColumn * (columnWidth + borderWidth * 2 + gap);
        const y = columns[shortestColumn];
        
        positions[index] = { x, y, width, height };
        columns[shortestColumn] = y + height + borderWidth * 2 + gap;
      });

      console.log('Base layout positions:', positions);
      console.log('Has unloaded images:', hasUnloadedImages);
      
      // Only update baseLayoutRef if we have valid positions
      if (!hasUnloadedImages && positions.some(pos => pos.width > 0)) {
        baseLayoutRef.current = positions;
        // Force an initial layout calculation
        const initialOffset = { x: 0, y: 0 };
        const initialScale = 1;
        handleOffsetChange(initialOffset, initialScale);
      }
    };

    imageElements.current.forEach((img) => {
      img.onload = () => {
        loadedCount++;
        console.log(`Image loaded: ${loadedCount}/${totalImages}`);
        if (loadedCount === totalImages) {
          console.log('All images loaded, calculating initial layout');
          initializeLayout();
        }
      };
    });

    const updateCanvasSize = () => {
      console.log('Canvas size updated');
      canvasWidth.current = window.innerWidth;
      canvasHeight.current = window.innerHeight;
      if (imageElements.current.length === images.length) {
        initializeLayout();
      }
    };

    window.addEventListener('resize', updateCanvasSize);
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [handleOffsetChange]);

  return (
    <div className="w-[100dvw] h-[100dvh]">
      <InfiniteCanvas nodes={nodes} onOffsetChange={handleOffsetChange} />
    </div>
  );
}


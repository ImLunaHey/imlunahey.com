import '@total-typescript/ts-reset';
import FPSStats from 'react-fps-stats';
import { useCanvasPanning } from '../hooks/use-canvas-panning';
import { useDrawCanvas } from '../hooks/use-draw-canvas';
import { useResizeWindow } from '../hooks/use-resize-window';
import { RefObject, useEffect, useRef, useState } from 'react';
import { Position } from '../common/position';
import { Node } from './node';
import { Point } from '../common/point';
import { CommandMenu } from './command-menu';
import { TrashCanIcon } from './icons/trash-can-icon';
import { Tools } from './tools/tools';
import { Tool } from './tools/tool';
import { MoveIcon } from './icons/move-icon';
import { CircleIcon } from './icons/circle-icon';
import { PencilIcon } from './icons/pencil-icon';
import { SquareIcon } from './icons/square-icon';
import { ImageIcon } from './icons/image-icon';
import { Drawing } from './nodes/drawing';
import { Image } from './nodes/image';
import { saveCanvasImageFile } from '../common/save-canvas-image';
import { Canvas } from './canvas';
import { FullscreenDropzone, onMediaLoad } from './fullscreen-dropzone';
import { createNewNode } from '../common/create-new-node';
import { render } from '../common/render';
import { cachedRenderedCanvases } from '../common/cache';
import { RenderMenu } from './render-menu';
import { useCanvasZooming } from '../hooks/use-canvas-zooming';
import { isCanvasInFocus } from '../common/is-canvas-in-focus';
import { Layers } from './layers';
import { Video } from './nodes/video';
import { FeetChairControls } from './feetchair';
import { queryClient } from './providers';

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  nodes: Node[];
};

export const loadTime = Date.now();

export const lastknownSafezone = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

export const Studio = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useCanvasZooming();
  const translatePosRef = useCanvasPanning(canvasRef as RefObject<HTMLCanvasElement>);

  const [layers, setLayers] = useState<Layer[]>([]);
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<string>('move');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [brushSize, _setBrushSize] = useState(10);
  const [brushColour, setBrushColour] = useState('#000000');
  const [shape, setShape] = useState<'rectangle' | 'circle' | 'triangle' | 'line'>('rectangle');
  const [shapeColour, setShapeColour] = useState('#000000');
  const [showDebug, setShowDebug] = useState(false);
  const [showSafezone, setShowSafezone] = useState(true);

  const isDraggingRef = useRef(false);
  const initialMousePositionRef = useRef<Position>({ x: 0, y: 0 });
  const mousePositionRef = useRef<Position>({ x: 0, y: 0 });
  const drawingPointsRef = useRef<Point[]>([]);
  const selectedNodesRef = useRef<Set<string>>(new Set());
  const delta = useRef(Date.now());

  const onLayerSelect = (id: string | null) => {
    setSelectedLayer(id);
  };

  const onLayerCreate = () => {
    const id = crypto.randomUUID();
    setLayers((prev) => [
      ...prev,
      {
        id,
        name: `Layer ${prev.length}`,
        visible: true,
        locked: false,
        nodes: [],
      },
    ]);
    setSelectedLayer(id);
  };

  const onLayerUpdate = (layer: Layer) => {
    setLayers((prev) => {
      const index = prev.findIndex((l) => l.id === layer.id);

      // If the layer is being locked/unlocked we should allow that
      if (prev[index].locked !== layer.locked) {
        const newLayers = [...prev];
        newLayers[index] = layer;
        return newLayers;
      }

      // If the layer is locked we should not allow the update
      if (prev[index].locked) return prev;

      // Update the layer
      const newLayers = [...prev];
      newLayers[index] = layer;
      return newLayers;
    });
  };

  const onLayerDelete = (id: string | null) => {
    if (!id) return;

    const index = layers.findIndex((layer) => layer.id === id);
    setLayers((prev) => prev.filter((_, layerIndex) => layerIndex !== index));
    const nextLayer = layers[index + 1] ?? layers[index - 1];
    setSelectedLayer(nextLayer?.id ?? null);

    // Remove cached rendered canvases for the deleted layer
    cachedRenderedCanvases.delete(id);
  };

  const onLayerReorder = (layers: Layer[]) => {
    setLayers(layers);
  };

  const onToolChange = (tool: string) => {
    setActiveTool(tool);
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only activate on left click
    if (e.button !== 0) return;

    // Transform mouse coordinates to canvas space
    const mouseX = e.nativeEvent.offsetX / scaleRef.current - translatePosRef.current.x / scaleRef.current;
    const mouseY = e.nativeEvent.offsetY / scaleRef.current - translatePosRef.current.y / scaleRef.current;

    // Erase or draw
    if (activeTool === 'erase' || activeTool === 'brush') {
      const layer = layers.find((layer) => layer.id === selectedLayer);
      if (!layer) {
        // Create a new layer if there are no layers
        onLayerCreate();
      }
      isDraggingRef.current = true;
    }

    // Move
    if (activeTool === 'move') {
      const layer = layers.find((layer) => layer.id === selectedLayer);
      if (!layer) return;

      // Ctrl + click should add the node to the selection
      // Click should set the node as the only selected node
      if (e.metaKey || e.ctrlKey) {
        // Get the last node that is within the position
        // This allows us to respect draw order
        const node = layer.nodes.findLast((node) =>
          node.isWithinPosition({
            x: mouseX,
            y: mouseY,
            width: 0,
            height: 0,
          }),
        );
        if (node) {
          isDraggingRef.current = true;
          selectedNodesRef.current.add(node.id);
        } else {
          isDraggingRef.current = true;
          selectedNodesRef.current.clear();
        }
      } else {
        // Get the last node that is within the position
        // This allows us to respect draw order
        const node = layer.nodes.findLast((node) =>
          node.isWithinPosition({
            x: mouseX,
            y: mouseY,
            width: 0,
            height: 0,
          }),
        );
        if (node) {
          isDraggingRef.current = true;
          selectedNodesRef.current.clear();
          selectedNodesRef.current.add(node.id);
        } else {
          isDraggingRef.current = true;
          selectedNodesRef.current.clear();
        }
      }
    }

    // Shape
    if (activeTool === 'shape') {
      // Create the inital shape
      const layer = layers.find((layer) => layer.id === selectedLayer);
      if (!layer) return;

      // Create a new node
      const node = createNewNode({
        type: shape,
        x: mouseX,
        y: mouseY,
        colour: shapeColour,
      });

      if (!node) return;

      // Add the new node to the layer
      setLayers((prev) => {
        // Clone the array to avoid mutating the previous state directly
        const newLayers = [...prev];

        // Clone the layer you want to update to avoid mutating it directly
        const updatedLayer = { ...layer };

        // Update the nodes in the cloned layer
        updatedLayer.nodes = [...updatedLayer.nodes, node];

        // Replace the original layer with the updated one
        newLayers[layers.findIndex((layer) => layer.id === selectedLayer)] = updatedLayer;

        return newLayers;
      });

      // Mark the node as selected
      selectedNodesRef.current.clear();
      selectedNodesRef.current.add(node.id);

      // Mark the node as being dragged
      isDraggingRef.current = true;
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Transform mouse coordinates to canvas space
    const mouseX = e.nativeEvent.offsetX / scaleRef.current - translatePosRef.current.x / scaleRef.current;
    const mouseY = e.nativeEvent.offsetY / scaleRef.current - translatePosRef.current.y / scaleRef.current;

    const layer = layers.find((layer) => layer.id === selectedLayer);
    if (!layer) return;

    // If layer is locked we should not allow any changes
    if (layer.locked) return;

    // Save the drawing points
    if (activeTool === 'brush' && isDraggingRef.current) {
      drawingPointsRef.current.push({ x: mouseX, y: mouseY, colour: `hsl(${(delta.current * 10) % 360}, 100%, 50%)` });
    }

    // Move the node
    if (activeTool === 'move' && isDraggingRef.current) {
      const nodes =
        layers.find((layer) => layer.id === selectedLayer)?.nodes.filter((node) => selectedNodesRef.current.has(node.id)) ??
        [];

      if (nodes.length >= 1) {
        // Get the difference between the current and previous mouse position
        // If we translate the canvas we should also take that into account
        const dx = mouseX - mousePositionRef.current.x + translatePosRef.current.x / scaleRef.current;
        const dy = mouseY - mousePositionRef.current.y + translatePosRef.current.y / scaleRef.current;
        for (const node of nodes) {
          node.moveBy(dx, dy);
        }
      }
    }

    // Inside your onMouseMove function for the 'shape' tool
    if (activeTool === 'shape' && isDraggingRef.current) {
      const node = layers
        .find((layer) => layer.id === selectedLayer)
        ?.nodes.find((node) => selectedNodesRef.current.has(node.id));

      if (node) {
        // Initial drag start positions (assuming these are captured correctly elsewhere)
        const startX = initialMousePositionRef.current.x - translatePosRef.current.x / scaleRef.current;
        const startY = initialMousePositionRef.current.y - translatePosRef.current.y / scaleRef.current;

        // Calculate new dimensions and position based on drag direction
        const width = Math.abs(mouseX - startX);
        const height = Math.abs(mouseY - startY);
        const newX = Math.min(mouseX, startX);
        const newY = Math.min(mouseY, startY);

        // Update the node's position and size
        node.moveTo(newX, newY);
        node.resize(width, height);
      }
    }
  };

  const onMouseUp = () => {
    const layer = layers.find((layer) => layer.id === selectedLayer);
    if (!layer) return;

    if (activeTool === 'brush') {
      isDraggingRef.current = false;

      const topLeft = drawingPointsRef.current.reduce(
        (acc, point) => {
          return {
            x: Math.min(acc.x, point.x - brushSize / 2),
            y: Math.min(acc.y, point.y - brushSize / 2),
          };
        },
        { x: Infinity, y: Infinity },
      );
      const bottomRight = drawingPointsRef.current.reduce(
        (acc, point) => {
          return {
            x: Math.max(acc.x, point.x + brushSize / 2),
            y: Math.max(acc.y, point.y + brushSize / 2),
          };
        },
        { x: -Infinity, y: -Infinity },
      );

      // Get the bounding box of the drawing
      const x = Math.min(topLeft.x, bottomRight.x);
      const y = Math.min(topLeft.y, bottomRight.y);
      const width = Math.abs(topLeft.x - bottomRight.x) + 1;
      const height = Math.abs(topLeft.y - bottomRight.y) + 1;

      // Create a new canvas to draw the drawing points
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw the drawing points
      ctx.beginPath();
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.strokeStyle = brushColour;

      // Draw all of the points
      for (const point of drawingPointsRef.current) {
        // Allow the drawing path to be continuous
        ctx.lineTo(point.x - x, point.y - y);
        ctx.moveTo(point.x - x, point.y - y);
        ctx.stroke();
      }

      // Create a new drawing
      const node = new Drawing({
        id: crypto.randomUUID(),
        x,
        y,
        width,
        height,
        rotation: 0,
        zIndex: 0,
        canvas,
        effects: [],
      });

      // Clear the drawing points
      drawingPointsRef.current = [];

      // Add the new node to the layer
      setLayers((prev) => {
        // Clone the array to avoid mutating the previous state directly
        const newLayers = [...prev];

        // Clone the layer you want to update to avoid mutating it directly
        const updatedLayer = { ...layer };

        // Update the nodes in the cloned layer
        updatedLayer.nodes = [...updatedLayer.nodes, node];

        // Replace the original layer with the updated one
        newLayers[layers.findIndex((layer) => layer.id === selectedLayer)] = updatedLayer;

        return newLayers;
      });
    }

    // Move
    if (activeTool === 'move') {
      isDraggingRef.current = false;
    }

    // Shape
    if (activeTool === 'shape') {
      isDraggingRef.current = false;

      // Switch to the move tool
      setActiveTool('move');
    }
  };

  const onMouseLeave = () => {
    isDraggingRef.current = false;
  };

  const commands = [
    {
      name: 'Reload Page',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="h-4 w-4 stroke-black dark:stroke-white"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M18.61 5.89L15.5 9h6V3l-2.89 2.89zm0 0A9.001 9.001 0 003.055 11m2.335 7.11L2.5 21v-6h6l-3.11 3.11zm0 0A9.001 9.001 0 0020.945 13"
          />
        </svg>
      ),
      description: 'Refresh the page',
      action: () => {
        window.location.reload();
      },
    },
    {
      name: 'New layer',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      description: 'Create a new layer',
      action: () => {
        onLayerCreate();
      },
    },
    {
      name: 'Delete layer',
      icon: <TrashCanIcon />,
      description: 'Delete the selected layer',
      action: () => {
        onLayerDelete(selectedLayer);
      },
    },
    {
      name: 'Move tool',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 stroke-black dark:stroke-white">
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 3v6m0-6L9 6m3-3l3 3m-3 9v6m0 0l3-3m-3 3l-3-3m-6-6h6m-6 0l3 3m-3-3l3-3m9 3h6m0 0l-3-3m3 3l-3 3"
          ></path>
        </svg>
      ),
      description: 'Select the move tool',
      action: () => {
        onToolChange('move');
      },
    },
    {
      name: 'Brush tool',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -0.5 25 25" className="h-4 w-4 fill-black dark:fill-white">
          <path
            fill="currentColor"
            d="M13.294 7.959a.75.75 0 10-1.17-.938l1.17.938zm-6.483 6.89l.568.49a.754.754 0 00.017-.021l-.585-.47zm-.171.418l-.749-.05v.015l.749.035zM6.5 18.29l-.75-.035a.75.75 0 00.004.112l.746-.077zm.787.687l.025.75a.75.75 0 00.148-.02l-.173-.73zm3-.711l.173.73.012-.003-.185-.727zm.385-.244l.579.477.006-.008-.585-.47zm6.625-7.063a.75.75 0 00-1.17-.938l1.17.938zm-5.17-3.938a.75.75 0 001.17.938l-1.17-.938zM14.3 5.51l.585.469a.81.81 0 00.029-.038L14.3 5.51zm1.629-.32l.48-.577a.76.76 0 00-.075-.055l-.405.632zm2.237 1.862l.53-.53a.76.76 0 00-.05-.047l-.48.577zm.337.82l.75.005-.75-.004zm-.346.818l-.525-.536a.771.771 0 00-.06.066l.585.47zm-2.03 1.33a.75.75 0 101.17.94l-1.17-.94zM13.454 7.38a.75.75 0 10-1.484.222l1.484-.222zm3.359 3.854a.75.75 0 10-.202-1.486l.202 1.486zm-4.69-4.212L6.227 14.38l1.17.938 5.898-7.36-1.17-.937zm-5.88 7.338c-.207.24-.33.542-.351.859l1.496.098a.039.039 0 01-.009.022l-1.136-.979zm-.352.873l-.14 3.023 1.498.07.14-3.023-1.498-.07zm-.137 3.135a1.516 1.516 0 001.558 1.36l-.05-1.5h-.005a.016.016 0 01-.006-.004.018.018 0 01-.003-.005.015.015 0 01-.002-.005l-1.492.154zm1.706 1.34l3-.712-.346-1.459-3 .711.346 1.46zm3.012-.714c.305-.078.578-.25.779-.494l-1.158-.954a.018.018 0 01.01-.006l.369 1.454zm.785-.502l6.04-7.532-1.17-.938-6.04 7.532 1.17.938zm2.04-10.532l1.588-1.98-1.17-.938-1.588 1.98 1.17.938zm1.617-2.018a.45.45 0 01.61-.12l.81-1.263a1.95 1.95 0 00-2.647.52l1.227.863zm.535-.175l2.237 1.862.96-1.153-2.237-1.862-.96 1.153zm2.186 1.816c.076.076.118.179.118.287l1.5.008a1.903 1.903 0 00-.556-1.355l-1.062 1.06zm.118.287c0 .107-.044.21-.121.285l1.05 1.071c.363-.355.568-.84.57-1.348l-1.5-.008zm-.18.351l-1.446 1.8 1.17.94 1.445-1.8-1.17-.94zM11.97 7.6a4.31 4.31 0 004.843 3.633l-.202-1.486a2.81 2.81 0 01-3.157-2.368L11.97 7.6z"
          />
        </svg>
      ),
      description: 'Select the draw tool',
      action: () => {
        onToolChange('brush');
      },
    },
    {
      name: 'Erase tool',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 fill-black dark:fill-white">
          <path d="M5.505 11.41l.53.53-.53-.53zM3 14.952h-.75H3zM9.048 21v.75V21zM11.41 5.505l-.53-.53.53.53zm1.831 12.34a.75.75 0 001.06-1.061l-1.06 1.06zM7.216 9.697a.75.75 0 10-1.06 1.061l1.06-1.06zm10.749 2.362l-5.905 5.905 1.06 1.06 5.905-5.904-1.06-1.06zm-11.93-.12l5.905-5.905-1.06-1.06-5.905 5.904 1.06 1.06zm0 6.025c-.85-.85-1.433-1.436-1.812-1.933-.367-.481-.473-.79-.473-1.08h-1.5c0 .749.312 1.375.78 1.99.455.596 1.125 1.263 1.945 2.083l1.06-1.06zm-1.06-7.086c-.82.82-1.49 1.488-1.945 2.084-.468.614-.78 1.24-.78 1.99h1.5c0-.29.106-.6.473-1.08.38-.498.962-1.083 1.812-1.933l-1.06-1.06zm7.085 7.086c-.85.85-1.435 1.433-1.933 1.813-.48.366-.79.472-1.08.472v1.5c.75 0 1.376-.312 1.99-.78.596-.455 1.264-1.125 2.084-1.945l-1.06-1.06zm-7.085 1.06c.82.82 1.487 1.49 2.084 1.945.614.468 1.24.78 1.989.78v-1.5c-.29 0-.599-.106-1.08-.473-.497-.38-1.083-.962-1.933-1.812l-1.06 1.06zm12.99-12.99c.85.85 1.433 1.436 1.813 1.933.366.481.472.79.472 1.08h1.5c0-.749-.312-1.375-.78-1.99-.455-.596-1.125-1.263-1.945-2.083l-1.06 1.06zm1.06 7.086c.82-.82 1.49-1.488 1.945-2.084.468-.614.78-1.24.78-1.99h-1.5c0 .29-.106.6-.473 1.08-.38.498-.962 1.083-1.812 1.933l1.06 1.06zm0-8.146c-.82-.82-1.487-1.49-2.084-1.945-.614-.468-1.24-.78-1.989-.78v1.5c.29 0 .599.106 1.08.473.497.38 1.083.962 1.933 1.812l1.06-1.06zm-7.085 1.06c.85-.85 1.435-1.433 1.933-1.812.48-.367.79-.473 1.08-.473v-1.5c-.75 0-1.376.312-1.99.78-.596.455-1.264 1.125-2.084 1.945l1.06 1.06zm2.362 10.749L7.216 9.698l-1.06 1.061 7.085 7.085 1.06-1.06z" />
        </svg>
      ),
      description: 'Select the erase tool',
      action: () => {
        onToolChange('erase');
      },
    },
    {
      name: `Toggle debug [${showDebug ? 'off' : 'on'}]`,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="h-4 w-4 stroke-black dark:stroke-white"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 8h16M4 16h16"
          ></path>
        </svg>
      ),
      description: 'Toggle debug info',
      action: () => {
        setShowDebug((prev) => !prev);
      },
    },
    {
      name: `Toggle safezone [${showSafezone ? 'off' : 'on'}]`,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="h-4 w-4 stroke-black dark:stroke-white"
        >
          <path
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 8h16M4 16h16"
          ></path>
        </svg>
      ),
      description: 'Toggle safezone',
      action: () => {
        setShowSafezone((prev) => !prev);
      },
    },
  ];

  const onImageDrop = (image: HTMLImageElement) => {
    const node = new Image({
      id: crypto.randomUUID(),
      x: mousePositionRef.current.x - image.width / 2,
      y: mousePositionRef.current.y - image.height / 2,
      width: image.width,
      height: image.height,
      rotation: 0,
      zIndex: 0,
      canvas: null,
      image,
      effects: [],
    });

    // Create a layer if there are no layers
    if (layers.length === 0) {
      const id = crypto.randomUUID();
      setLayers((prev) => [
        ...prev,
        {
          id,
          name: `Layer ${prev.length}`,
          visible: true,
          locked: false,
          nodes: [node],
        },
      ]);
      setSelectedLayer(id);

      // Mark the node as selected
      selectedNodesRef.current.add(node.id);

      // Switch to the move tool
      setActiveTool('move');
      return;
    }

    const layer = layers.find((layer) => layer.id === selectedLayer);
    if (!layer) return;

    // Add the new node to the layer
    layer.nodes.push(node);

    // Mark the node as selected
    selectedNodesRef.current.add(node.id);

    // Switch to the move tool
    setActiveTool('move');
  };

  const onVideoDrop = (video: HTMLVideoElement) => {
    const node = new Video({
      id: crypto.randomUUID(),
      x: mousePositionRef.current.x - video.width / 2,
      y: mousePositionRef.current.y - video.height / 2,
      width: video.width,
      height: video.height,
      rotation: 0,
      zIndex: 0,
      canvas: null,
      video,
      effects: [],
    });

    // Create a layer if there are no layers
    if (layers.length === 0) {
      const id = crypto.randomUUID();
      setLayers((prev) => [
        ...prev,
        {
          id,
          name: `Layer ${prev.length}`,
          visible: true,
          locked: false,
          nodes: [node],
        },
      ]);
      setSelectedLayer(id);

      // Mark the node as selected
      selectedNodesRef.current.add(node.id);

      // Switch to the move tool
      setActiveTool('move');
      return;
    }

    const layer = layers.find((layer) => layer.id === selectedLayer);
    if (!layer) return;

    // Add the new node to the layer
    layer.nodes.push(node);

    // Mark the node as selected
    selectedNodesRef.current.add(node.id);

    // Switch to the move tool
    setActiveTool('move');
  };

  const tools: Tool[] = [
    {
      name: 'move',
      icon: <MoveIcon />,
      helpText: 'To move nodes around the canvas click and drag them, hold ctrl to select multiple nodes',
      shortcut: '1',
      isActive: activeTool === 'move',
      onClick() {
        setActiveTool('move');
      },
    },
    {
      name: 'rectangle',
      icon: <SquareIcon />,
      helpText: 'Click and drag to draw a rectangle, hold shift to draw a square',
      shortcut: '2',
      isActive: activeTool === 'shape' && shape === 'rectangle',
      onClick() {
        setActiveTool('shape');
        setShape('rectangle');
      },
      properties() {
        return (
          <div className="flex flex-row justify-between gap-2">
            <span>Colour</span>
            <input
              type="color"
              value={shapeColour}
              onChange={(e) => {
                setShapeColour(e.target.value);
              }}
            />
          </div>
        );
      },
    },
    // @TODO: Implement triangle and line tools
    // {
    //   name: 'triangle',
    //   icon: <TriangleIcon />,
    //   description: 'Select the triangle tool',
    //   shortcut: '3',
    //   isActive: activeTool === 'shape' && shape === 'triangle',
    //   onClick() {
    //     setActiveTool('shape');
    //     setShape('triangle');
    //   },
    // },
    {
      name: 'circle',
      icon: <CircleIcon />,
      helpText: 'Click and drag to draw a circle',
      shortcut: '4',
      isActive: activeTool === 'shape' && shape === 'circle',
      onClick() {
        setActiveTool('shape');
        setShape('circle');
      },
      properties() {
        return (
          <div className="flex flex-row justify-between gap-2">
            <span>Colour</span>
            <input
              type="color"
              value={shapeColour}
              onChange={(e) => {
                setShapeColour(e.target.value);
              }}
            />
          </div>
        );
      },
    },
    // {
    //   name: 'line',
    //   icon: <LineIcon />,
    //   description: 'Select the line tool',
    //   shortcut: '6',
    //   isActive: activeTool === 'shape' && shape === 'line',
    //   onClick() {
    //     setActiveTool('shape');
    //     setShape('line');
    //   },
    // },
    {
      name: 'brush',
      icon: <PencilIcon />,
      helpText: 'Click and drag to draw on the canvas',
      shortcut: '7',
      isActive: activeTool === 'brush',
      onClick() {
        setActiveTool('brush');
      },
      properties() {
        return (
          <div className="flex flex-row justify-between gap-2">
            <span>Colour</span>
            <input
              type="color"
              value={brushColour}
              onChange={(e) => {
                setBrushColour(e.target.value);
              }}
            />
          </div>
        );
      },
    },
    // {
    //   name: 'text',
    //   icon: <TextIcon />,
    //   helpText: 'Click to add text to the canvas',
    //   shortcut: '8',
    //   isActive: activeTool === 'text',
    //   onClick() {
    //     setActiveTool('text');
    //   },
    // },
    {
      name: 'media',
      // @TODO: Add media icon
      icon: <ImageIcon />,
      helpText: 'Click to add media to the canvas',
      shortcut: '9',
      isActive: activeTool === 'media',
      onClick() {
        // Clear the selected nodes
        selectedNodesRef.current.clear();

        // Open file picker
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*';

        // If the user selects a suported media file, add it to the canvas
        input.onchange = (inputEvent) => {
          const files = (inputEvent.target as HTMLInputElement).files ?? [];
          if (files.length === 0) return;

          // Add each image to the canvas
          for (const file of files) {
            onMediaLoad(file, onImageDrop, onVideoDrop);
          }

          // Remove the input element
          input.remove();
        };

        // Trigger the file picker
        input.click();
      },
    },
    {
      name: 'ai',
      // @TODO: Add ai icon
      icon: <ImageIcon />,
      helpText: 'Click to add ai generated image to the canvas',
      shortcut: '0',
      isActive: activeTool === 'ai',
      async onClick() {
        // Clear the selected nodes
        selectedNodesRef.current.clear();

        // Ask the user for a prompt
        const userPrompt = prompt('Please enter your prompt');
        if (!userPrompt) return;

        // Fetch an image from the server
        const imageData = await fetch('http://localhost:8787/generate/raw', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ prompt: userPrompt }),
        }).then((res) => res.blob());
        const image = new globalThis.Image();
        image.src = URL.createObjectURL(imageData);

        // When the image is loaded add it to the canvas
        image.onload = () => {
          onImageDrop(image);
        };
      },
      // @TODO: Implement erase tool
      // {
      //   name: 'erase',
      //   icon: <EraserIcon />,
      //   description: 'Select the erase tool',
      //   shortcut: '0',
      //   isActive: activeTool === 'erase',
      //   onClick() {
      //     setActiveTool('erase');
      //   },
      // },
    },
  ];

  const deleteSelectedNodes = () => {
    const onKeyDown = (e: KeyboardEvent) => {
      // If the canvas isnt focused ignore the event
      if (!isCanvasInFocus()) return;

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();

        // Remove all selected nodes
        setLayers((prev) => {
          const newLayers = [...prev];
          return newLayers.map((layer) => ({
            ...layer,
            nodes: layer.nodes.filter((node) => {
              if (selectedNodesRef.current.has(node.id)) {
                return false;
              }

              // Run the cleanup function so the node can clean up any resources
              node.cleanup();
              return true;
            }),
          }));
        });
        // Reset the selected nodes
        selectedNodesRef.current.clear();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  };

  const centerSelectedNode = () => {
    const onKeyDown = (e: KeyboardEvent) => {
      // If the canvas isnt focused ignore the event
      if (!isCanvasInFocus()) return;

      if (e.key === 'c') {
        e.preventDefault();

        // Move the node to the center of the viewport
        const layer = layers.find((layer) => layer.id === selectedLayer);
        if (!layer) return;

        // Find the selected node
        const node = layer.nodes.find((node) => selectedNodesRef.current.has(node.id));
        if (!node) return;

        // Get the current translate position and scale
        const translatePos = translatePosRef.current;
        const scale = scaleRef.current;
        const viewport = {
          x: -translatePos.x / scale,
          y: -translatePos.y / scale,
          width: window.innerWidth / scale,
          height: window.innerHeight / scale,
        };

        // Calculate the center of the viewport
        const centerX = viewport.x + viewport.width / 2;
        const centerY = viewport.y + viewport.height / 2;
        const dx = centerX - node.x;
        const dy = centerY - node.y;

        // Move the node
        node.moveTo(dx, dy);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  };

  const selectAllNodes = () => {
    const onKeyDown = (e: KeyboardEvent) => {
      // If the canvas isnt focused ignore the event
      if (!isCanvasInFocus()) return;

      if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const layer = layers.find((layer) => layer.id === selectedLayer);
        if (!layer) return;

        selectedNodesRef.current = new Set(layer.nodes.map((node) => node.id));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  };

  const resetDelta = () => {
    delta.current = 0;
  };

  const trackMousePosition = () => {
    const onMouseDown = (e: MouseEvent) => {
      initialMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
    };
  };

  const saveCanvasAsImage = () => {
    const onKeyDown = (e: KeyboardEvent) => {
      // If the canvas isnt focused ignore the event
      if (!isCanvasInFocus()) return;

      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        saveCanvasImageFile(canvas);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  };

  // Resize the canvas when the window resizes
  useResizeWindow(canvasRef as RefObject<HTMLCanvasElement>, scaleRef);

  // Draw the canvas
  useDrawCanvas(canvasRef as RefObject<HTMLCanvasElement>, (delta) => {
    // Render the canvas
    return render(
      {
        canvas: canvasRef.current,
        scale: scaleRef.current,
        translatePos: translatePosRef.current,
        layers,
        activeTool,
        brushSize,
        brushColour,
        mousePos: mousePositionRef.current,
        brushPoints: drawingPointsRef.current,
        selectedNodes: selectedNodesRef.current,
        showDebug: showDebug,
        showSafezone: showSafezone,
      },
      delta,
    );
  });

  // Press delete key and remove all selected nodes
  useEffect(deleteSelectedNodes, [setLayers]);

  // Press c when an node is selected to center it on the viewport
  useEffect(centerSelectedNode, [layers, scaleRef, selectedLayer, translatePosRef]);

  // Press ctrl+a and select all nodes
  useEffect(selectAllNodes, [layers, selectedLayer]);

  // Reset delta on re-render
  useEffect(resetDelta, []);

  // Track mouse position
  useEffect(trackMousePosition, [mousePositionRef]);

  // Press ctrl+s and save the canvas as an image
  useEffect(saveCanvasAsImage, []);

  // Don't render canvas on the server
  if (typeof window === 'undefined') return null;

  // Render canvas on the client
  return (
    <>
      <FeetChairControls queryClient={queryClient} />
      {layers.length >= 1 && (
        <RenderMenu
          showDebug={showDebug}
          layers={layers}
          selectedLayer={selectedLayer}
          onLayerUpdate={onLayerUpdate}
          selectedNodesRef={selectedNodesRef}
        />
      )}
      <CommandMenu commands={commands} />
      {showDebug && <FPSStats />}
      <FullscreenDropzone
        hoverChildren={
          // Show the image as a preview when dragging
          <div className="bg-opacity-50 dark:bg-opacity-50 absolute top-0 left-0 flex h-full w-full items-center justify-center bg-white dark:bg-black">
            <p>Drop the image here</p>
          </div>
        }
        onImageDrop={onImageDrop}
        onVideoDrop={onVideoDrop}
      >
        <Canvas
          canvasRef={canvasRef as RefObject<HTMLCanvasElement>}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        />
      </FullscreenDropzone>
      {layers.length >= 1 && (
        <Tools
          className="z-10"
          tools={tools}
          activeTool={activeTool}
          onToolChange={(tool) => {
            onToolChange(tool);
          }}
        />
      )}
      <Layers
        className="z-10"
        layers={layers}
        selectedLayer={selectedLayer}
        onLayerSelect={onLayerSelect}
        onLayerCreate={onLayerCreate}
        onLayerUpdate={onLayerUpdate}
        onLayerDelete={onLayerDelete}
        onLayerReorder={onLayerReorder}
      />
    </>
  );
};

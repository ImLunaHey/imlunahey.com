import { saveCanvasImageFile } from '../common/save-canvas-image';
import { Layer } from './studio';
import { Button } from './button';
import { render } from '../common/render';
import { randomNumberBetween } from '../common/random-number-between';
import { Node } from './node';
import { Glow } from './effects/glow';
import { Border } from './effects/border';
import { MetadataPanel } from './metadata-panel';
import { ControlsPanel } from './controls-panel';

type RenderMenuProps = {
  showDebug: boolean;
  layers: Layer[];
  selectedLayer: string | null;
  onLayerUpdate: (layer: Layer) => void;
  selectedNodesRef: React.MutableRefObject<Set<string>>;
};

export const RenderMenu = ({ showDebug, layers, selectedLayer, onLayerUpdate, selectedNodesRef }: RenderMenuProps) => {
  const onSaveImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    render(
      {
        canvas,
        scale: 1,
        translatePos: { x: 0, y: 0 },
        layers,
        activeTool: 'move',
        brushSize: 1,
        brushColour: 'black',
        mousePos: { x: 0, y: 0 },
        brushPoints: [],
        selectedNodes: new Set(),
        showDebug: false,
        showSafezone: false,
      },
      0,
    );

    // Save the canvas as a file
    saveCanvasImageFile(canvas);
  };

  const onAddRandomNodes = () => {
    const layer = layers[0];
    if (!layer) return;

    const nodes = Array.from({ length: 100 }).map(() => {
      const x = randomNumberBetween(10, 1920);
      const y = randomNumberBetween(10, 1080);
      const width = randomNumberBetween(10, 100);
      const height = randomNumberBetween(10, 100);
      return new Node({
        id: crypto.randomUUID(),
        x,
        y,
        width,
        height,
        colour: `hsl(${Math.random() * 360}, 100%, 50%)`,
        rotation: Math.random() * 360,
        zIndex: 0,
        canvas: null,
        effects: [
          new Glow({
            blur: randomNumberBetween(100, 1000),
            colour: `hsl(${Math.random() * 360}, 100%, 50%)`,
            offsetX: 0,
            offsetY: 0,
          }),
          new Glow({
            blur: randomNumberBetween(100, 1000),
            colour: `hsl(${Math.random() * 360}, 100%, 50%)`,
            offsetX: 0,
            offsetY: 0,
          }),
          new Border({
            lineWidth: randomNumberBetween(1, 10),
            colour: `hsl(${Math.random() * 360}, 100%, 50%)`,
          }),
        ],
      });
    });

    onLayerUpdate({
      ...layer,
      nodes: [...layer.nodes, ...nodes],
    });
  };

  return (
    <div className="fixed top-1 right-1 z-40 flex max-w-96 flex-col gap-1 bg-black p-2">
      <Button onClick={onSaveImage} className="w-full" id="save-image-button">
        Save canvas
      </Button>
      {showDebug && (
        <Button onClick={onAddRandomNodes} className="w-full">
          Add random nodes
        </Button>
      )}
      <MetadataPanel selectedNodesRef={selectedNodesRef} layers={layers} selectedLayer={selectedLayer} />
      <ControlsPanel selectedNodesRef={selectedNodesRef} layers={layers} selectedLayer={selectedLayer} />
    </div>
  );
};

import { useWatchRef } from '../hooks/use-watch-ref';
import { Layer } from './studio';
import { Button } from './button';
import { Filter, ImageFilter, filters } from './effects/image-filter';
import { render } from '../common/render';
import { saveCanvasImageFile } from '../common/save-canvas-image';
import { Image } from './nodes/image';
import { Node } from './node';

type MetadataPanelProps = {
  layers: Layer[];
  selectedLayer: string | null;
  selectedNodesRef: React.MutableRefObject<Set<string>>;
};

const isImageNode = (node: Node): node is Image => node.type === 'image';

export const ControlsPanel = ({ layers, selectedLayer, selectedNodesRef }: MetadataPanelProps) => {
  // Aim for 30fps
  useWatchRef(selectedNodesRef, 1000 / 30);

  const selectedNodes = [...selectedNodesRef.current.values()];
  const layer = layers.find((layer) => layer.id === selectedLayer);
  if (!layer) return null;

  const onSaveImage = () => {
    const node = layer.nodes.find((node) => selectedNodes.includes(node.id));
    if (!node) return;
    if (node.type !== 'image') return;
    if (!isImageNode(node)) return;

    const canvas = document.createElement('canvas');
    canvas.width = node.image.width;
    canvas.height = node.image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    render(
      {
        canvas,
        scale: 1,
        translatePos: { x: -node.x, y: -node.y },
        layers: [
          {
            ...layer,
            nodes: [node],
          },
        ],
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

  return (
    <div className="p-2">
      <ul>
        {selectedNodes.map((id) => {
          const node = layer.nodes.find((node) => node.id === id);
          if (!node) return null;

          if (node.type === 'image') {
            return (
              <li key={node.id}>
                {Object.keys(filters).map((filter) => (
                  <Button
                    key={filter}
                    onClick={() => {
                      node.addEffect(new ImageFilter(filter as unknown as Filter));
                    }}
                  >
                    {filter}
                  </Button>
                ))}

                <Button
                  onClick={() => {
                    node.removeLastEffect();
                  }}
                >
                  Undo
                </Button>

                <Button onClick={onSaveImage}>Save Image</Button>
              </li>
            );
          }
        })}
      </ul>
    </div>
  );
};

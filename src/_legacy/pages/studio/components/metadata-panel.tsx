import { useWatchRef } from '../hooks/use-watch-ref';
import { Layer } from './studio';

type MetadataPanelProps = {
  layers: Layer[];
  selectedLayer: string | null;
  selectedNodesRef: React.MutableRefObject<Set<string>>;
};

export const MetadataPanel = ({ layers, selectedLayer, selectedNodesRef }: MetadataPanelProps) => {
  // Aim for 30fps
  useWatchRef(selectedNodesRef, 1000 / 30);

  const values = [...selectedNodesRef.current.values()];
  const layer = layers.find((layer) => layer.id === selectedLayer);
  if (!layer) return null;

  return (
    <div className="p-2">
      <ul>
        {values.map((id) => {
          const node = layer.nodes.find((node) => node.id === id);
          if (!node) return null;

          return (
            <li key={node.id}>
              <p>Type: {node.type}</p>
              <p>X: {node.x}</p>
              <p>Y: {node.y}</p>
              <p>Width: {node.width}</p>
              <p>Height: {node.height}</p>
              <p>Rotation: {node.rotation}</p>
              <p>Colour: {node.colour}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

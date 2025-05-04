import { Button } from './button';
import { EyeClosedIcon } from './icons/eye-closed-icon';
import { EyeOpenIcon } from './icons/eye-open-icon';
import { Layer } from './studio';
import { cn } from '../../../cn';
import { LockIcon } from './icons/lock-icon';
import { UnlockIcon } from './icons/unlock-icon';
import { Nodes } from './nodes';

type LayerBarProps = {
  layer: Layer;
  selectedLayer: string | null;
  onLayerSelect: (id: string | null) => void;
  onLayerUpdate: (layer: Layer) => void;
  onLayerDelete: (id: string | null) => void;
};

export const LayerBar = ({ layer, selectedLayer, onLayerUpdate, onLayerSelect, onLayerDelete }: LayerBarProps) => {
  return (
    <div
      key={layer.id}
      className={cn('flex w-full flex-row justify-between gap-2 bg-[#f1f1f3] p-2 dark:bg-[#0e0e0e]', {
        'border-l-4 border-[#dadada]': selectedLayer === layer.id,
      })}
      onClick={() => onLayerSelect(layer.id)}
    >
      <Button
        className="aspect-square"
        onClick={() => {
          onLayerUpdate({
            ...layer,
            visible: !layer.visible,
          });
        }}
      >
        {layer.visible ? <EyeOpenIcon /> : <EyeClosedIcon />}
      </Button>
      <div className="max-h-56 w-full overflow-y-scroll">
        <div className="overflow-y-hidden text-sm">{layer.name}</div>
        <Nodes
          nodes={layer.nodes}
          onNodesReorder={(nodes) => {
            onLayerUpdate({
              ...layer,
              nodes,
            });
          }}
        />
      </div>
      <Button
        className="aspect-square"
        onClick={() => {
          onLayerUpdate({
            ...layer,
            locked: !layer.locked,
          });
        }}
      >
        {layer.locked ? <LockIcon /> : <UnlockIcon />}
      </Button>
    </div>
  );
};

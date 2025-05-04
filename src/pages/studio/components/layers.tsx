import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  closestCenter,
  DragEndEvent,
  MouseSensor,
  KeyboardSensor,
  TouchSensor,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Button } from './button';
import { PlusIcon } from './icons/plus-icon';
import { Layer } from './studio';
import { SortableLayer } from './sortable-layer';
import { cn } from '../../../cn';
import { TrashCanIcon } from './icons/trash-can-icon';

type LayersProps = {
  layers: Layer[];
  selectedLayer: string | null;
  onLayerCreate: () => void;
  onLayerReorder: (layers: Layer[]) => void;
  onLayerSelect: (id: string | null) => void;
  onLayerUpdate: (layer: Layer) => void;
  onLayerDelete: (id: string | null) => void;
  className?: string;
};

export const Layers = ({
  layers,
  selectedLayer,
  onLayerCreate,
  onLayerReorder,
  onLayerSelect,
  onLayerUpdate,
  onLayerDelete,
  className,
}: LayersProps) => {
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 0.01,
    },
  });
  const mouseSensor = useSensor(MouseSensor);
  const touchSensor = useSensor(TouchSensor);
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, mouseSensor, touchSensor, keyboardSensor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = layers.findIndex((layer) => layer.id.toString() === active.id);
      const newIndex = layers.findIndex((layer) => layer.id.toString() === over.id);

      const newLayers = arrayMove(layers, oldIndex, newIndex);
      onLayerReorder(newLayers);
    }
  };

  return (
    <div
      className={cn(
        'absolute right-1 bottom-1 w-[250px] rounded border border-[#14141414] bg-white p-1 dark:bg-[#181818]',
        className,
      )}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layers.map((layer) => layer.id.toString())} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1">
            {layers
              .slice()
              .reverse()
              .map((layer, index) => {
                return (
                  <SortableLayer
                    key={layer.id}
                    id={layer.id.toString()}
                    layer={layer}
                    selectedLayer={selectedLayer}
                    onLayerSelect={onLayerSelect}
                    onLayerUpdate={onLayerUpdate}
                    onLayerDelete={onLayerDelete}
                  />
                );
              })}
          </div>
        </SortableContext>
      </DndContext>
      <div className="flex flex-row items-center gap-1 p-2 text-sm">
        <Button
          className="aspect-square"
          onClick={() => {
            onLayerCreate();
          }}
          title="Add Layer"
          id="add-layer-button"
        >
          <PlusIcon />
        </Button>
        <Button
          className="aspect-square"
          onClick={() => {
            onLayerDelete(selectedLayer);
          }}
          title="Delete Layer"
          id="delete-layer-button"
        >
          <TrashCanIcon />
        </Button>
      </div>
    </div>
  );
};

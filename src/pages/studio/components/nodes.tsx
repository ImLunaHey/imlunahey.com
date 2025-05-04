import { Node } from './node';

type NodesProps = {
  nodes: Node[];
  onNodesReorder: (nodes: Node[]) => void;
};

export const Nodes = ({ nodes, onNodesReorder }: NodesProps) => {
  // const pointerSensor = useSensor(PointerSensor, {
  //   activationConstraint: {
  //     distance: 0.01,
  //   },
  // });
  // const mouseSensor = useSensor(MouseSensor);
  // const touchSensor = useSensor(TouchSensor);
  // const keyboardSensor = useSensor(KeyboardSensor);
  // const sensors = useSensors(pointerSensor, mouseSensor, touchSensor, keyboardSensor);

  // const handleDragEnd = (event: DragEndEvent) => {
  //   const { active, over } = event;

  //   if (over && active.id !== over.id) {
  //     const oldIndex = nodes.findIndex((node) => node.id.toString() === active.id);
  //     const newIndex = nodes.findIndex((node) => node.id.toString() === over.id);
  //     const newNodes = arrayMove(nodes, oldIndex, newIndex);
  //     onNodesReorder(newNodes);
  //   }
  // };

  return (
    <div className="flex flex-col gap-1">
      {/* <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext nodes={nodes} strategy={verticalListSortingStrategy}> */}
      {nodes.map((node) => {
        return (
          <div key={node.id} className="flex flex-row gap-2">
            <div
              className="w-4 h-4 rounded border"
              style={{
                backgroundColor: node.colour,
              }}
            />
            <div className="text-xs">{node.type}</div>
          </div>
        );
      })}
      {/* </SortableContext>
        </DndContext> */}
    </div>
  );
};

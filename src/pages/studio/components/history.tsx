type Action = {
  undo: () => void;
  redo: () => void;
};

export const history = () => {
  const history = new Set<Action>();
  const record = (undo: Action['undo'], redo: Action['redo']) => {
    history.add({ undo, redo });
  };
  const undo = (steps: number) => {
    const iterator = history.values();
    for (let i = 0; i < steps; i++) {
      const action = iterator.next().value;
      if (action) {
        action.undo();
      }
    }
  };
  const redo = (steps: number) => {
    const iterator = history.values();
    for (let i = 0; i < steps; i++) {
      const action = iterator.next().value;
      if (action) {
        action.redo();
      }
    }
  };

  return {
    record,
    undo,
    redo,
  };
};

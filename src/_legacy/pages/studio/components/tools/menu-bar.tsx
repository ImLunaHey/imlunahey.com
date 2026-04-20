import { useState } from 'react';
import { Button } from '../button';
import { Tool } from './tool';

type MenuBarProps<Tools extends Tool[]> = {
  tools: Tools;
  activeTool: string;
  onToolChange: (tool: string) => void;
};

export const MenuBar = <Tools extends Tool[]>({ tools, activeTool, onToolChange }: MenuBarProps<Tools>) => {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  return (
    <div className="absolute md:top-1 flex justify-center w-full">
      <div className="relative flex flex-row gap-2 w-full md:w-fit overflow-x-scroll justify-center bg-white dark:bg-[#181818] border border-[#14141414] md:rounded p-2">
        {tools.map((tool) => (
          <Button
            key={tool.name}
            onClick={() => {
              // Update the active tool
              onToolChange(tool.name);

              // Call the tool's onClick function
              tool.onClick();
            }}
            onMouseOver={() => setHoveredTool(tool.name)}
            onMouseOut={() => setHoveredTool(null)}
            active={tool.isActive}
            className="relative rounded"
            id={`${tool.name}-tool-button`}
          >
            <div className="p-2">
              {tool.icon}
              {tool.shortcut !== undefined && <sub className="bottom-2 right-2 text-[10px] absolute">{tool.shortcut}</sub>}
            </div>
          </Button>
        ))}
      </div>

      {/* Help text */}
      <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-5 text-xs text-white dark:text-black">
        {hoveredTool
          ? tools.find((tool) => tool.name === hoveredTool)?.helpText
          : tools.find((tool) => tool.name === activeTool)?.helpText}
      </div>
    </div>
  );
};

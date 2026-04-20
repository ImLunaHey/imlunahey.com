import { cn } from '../../../../cn';
import { MenuBar } from './menu-bar';
import { ToolProperties } from './tool-properties';
import { Tool } from './tool';

type ToolsProps = {
  className?: string;
  tools: Tool[];
  activeTool: string;
  onToolChange: (tool: string) => void;
};

export const Tools = ({ className, tools, activeTool, onToolChange }: ToolsProps) => {
  return (
    <div className={cn(className)}>
      {/* Menu bar */}
      <MenuBar tools={tools} activeTool={activeTool} onToolChange={onToolChange} />
      {/* Tool properties */}
      <ToolProperties tools={tools} />
    </div>
  );
};

import { Tool } from './tool';

type ToolPropertiesProps = {
  tools: Tool[];
};

export const ToolProperties = ({ tools }: ToolPropertiesProps) => {
  const tool = tools.find((tool) => tool.isActive);
  if (!tool || !tool.properties) return null;

  return (
    <div className="absolute left-1 top-1/2 transform -translate-y-1/2 w-[250px]">
      <div className="relative flex flex-row gap-2 w-fit bg-white dark:bg-[#181818] border border-[#14141414] rounded p-2">
        {tool.properties()}
      </div>
    </div>
  );
};

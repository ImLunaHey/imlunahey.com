type SidebarProps = {
  groups: (false | (false | React.ReactNode)[])[];
  disabled: boolean;
  name: string;
};

export const Sidebar = ({ disabled, groups, name }: SidebarProps) => {
  return (
    <div className="relative h-fit w-full self-center text-sm text-black dark:text-white">
      {!disabled && <div className="bg-opacity-80 absolute z-10 h-full w-full cursor-not-allowed rounded bg-black" />}
      <div className="flex h-fit w-full flex-col gap-2 rounded border border-[#14141414] bg-white dark:bg-[#181818]">
        <div className="flex w-full flex-row border-[#dadada] bg-[#f1f1f3] p-2 dark:bg-[#0e0e0e]">
          <span className="font-semibold">{name}</span>
        </div>
        {groups.filter(Boolean).map((group, groupIndex) => {
          if (!group) return null;
          const nodes = group.filter(Boolean);

          return (
            <div key={`${name}-${groupIndex}`}>
              {nodes.map((node, index) => (
                <div key={`${name}-${groupIndex}-${index}`} className="overflow-y-scroll p-2">
                  {node}
                </div>
              ))}
              {groupIndex < groups.filter(Boolean).length - 1 && (
                <hr className="border-[0.5px] border-[#dbdbdb] dark:border-[#2a2a2a]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

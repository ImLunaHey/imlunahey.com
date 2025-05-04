import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import FocusTrap from 'focus-trap-react';
import { cn } from '../../../cn';

const DefaultIcon = () => {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  );
};

type Command = {
  name: string;
  icon?: React.ReactNode;
  description: string;
  action: () => void;
};

const useCommandMenu = (commands: Command[]) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filteredCommands, setFilteredCommands] = useState<Command[]>(commands);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Open/close the command menu
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(!isOpen);

        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    const fuse = new Fuse(commands, {
      keys: ['name', 'description'],
      includeScore: true,
      threshold: 0.3,
    });

    if (!inputValue) {
      setFilteredCommands(commands);
      return;
    }

    const results = fuse.search(inputValue).map((result) => result.item);
    setFilteredCommands(results);
  }, [commands, inputValue]);

  return { isOpen, setIsOpen, inputValue, setInputValue, filteredCommands };
};

type CommandMenuProps = {
  commands: Command[];
};

export const CommandMenu = ({ commands }: CommandMenuProps) => {
  const { isOpen, setIsOpen, inputValue, setInputValue, filteredCommands } = useCommandMenu(commands);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSelectedCommandIndex(0); // Reset selection when menu opens
    }
  }, [isOpen]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault(); // Prevent page scrolling
      setSelectedCommandIndex((prevIndex) => (prevIndex + 1) % filteredCommands.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault(); // Prevent page scrolling
      setSelectedCommandIndex((prevIndex) => (prevIndex - 1 + filteredCommands.length) % filteredCommands.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      filteredCommands[selectedCommandIndex].action();
      setIsOpen(false);
      return;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {isOpen && <div className="bg-opacity-50 fixed inset-0 z-40 flex items-center justify-center bg-black" />}
      <FocusTrap>
        <div
          className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center"
          onKeyDown={handleKeyDown} // Handle key down events here
        >
          <div className="w-full max-w-md rounded border border-[#14141414] bg-white p-4 dark:bg-[#181818]">
            <input
              type="text"
              className="w-full rounded border p-2 text-black"
              placeholder="Search commands"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              autoFocus // Automatically focus the input when the menu opens
            />
            <ul className="mt-2">
              {filteredCommands.map((command, index) => (
                <li
                  key={index}
                  className={cn(
                    'flex cursor-pointer flex-row items-center gap-2 p-2',
                    // Highlight the selected command
                    index === selectedCommandIndex && 'bg-[#2c2c2c]',
                  )}
                  onClick={() => {
                    command.action();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedCommandIndex(index)}
                  onFocus={() => setSelectedCommandIndex(index)}
                >
                  {command.icon ?? <DefaultIcon />} {command.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </FocusTrap>
    </>
  );
};

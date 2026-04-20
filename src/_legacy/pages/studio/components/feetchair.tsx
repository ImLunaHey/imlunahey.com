'use client';
import { useState } from 'react';
import { QueryClient, useQuery } from '@tanstack/react-query';
import { cn } from '../../../cn';

export type Flag = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
};

export type Flags = Flag[];

type ButtonProps = React.ComponentProps<'button'> & {
  active?: boolean;
};

export const Button = ({ active, className, ...props }: ButtonProps) => {
  const baseStyles = 'border rounded px-2 active:scale-95 w-fit';
  const disabledStyles = 'disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100';
  const lightStyles = 'bg-white text-black border-[#e4e4e7] hover:bg-[#f1f1f3] hover:border-[#e4e4e7]';
  const darkStyles =
    'dark:bg-[#111214] dark:text-white dark:border-[#222327] hover:dark:bg-[#222327] hover:dark:border-[#111214]';

  return (
    <button
      className={cn(
        baseStyles,
        disabledStyles,
        lightStyles,
        darkStyles,
        active && 'border-[#e4e4e7] bg-[#f1f1f3]',
        active && 'dark:border-[#111214] dark:bg-[#222327]',
        className,
      )}
      {...props}
    />
  );
};

export const useFeatureFlags = () => {
  return useQuery({
    queryKey: ['feetchair'],
    queryFn: async () => {
      const serverFlags = (await fetch('/_feetchair/flags').then((response) => response.json())) as Flags;
      const localFlags = Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('feetchair-')));
      return serverFlags.map((flag) => ({
        ...flag,
        enabled: localFlags[flag.id] ? localFlags[flag.id] === 'true' : flag.enabled,
      }));
    },
  });
};

type FeetChairControlsProps = {
  queryClient: QueryClient;
};

export const FeetChairControls = ({ queryClient }: FeetChairControlsProps) => {
  const { data: flags, isLoading } = useFeatureFlags();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!flags) {
    return <div>Failed to load flags</div>;
  }

  return (
    <div className="absolute bottom-1 left-1 z-50 flex flex-col gap-2 p-2">
      <Button onClick={() => setIsOpen(!isOpen)}>
        <span>Flags</span>
      </Button>
      {isOpen && (
        <div className="flex flex-col gap-2 bg-black p-2">
          <ul>
            {flags.map((flag) => (
              <li key={flag.id}>
                {flag.name}:{' '}
                <Button
                  onClick={() => {
                    // Override the flag in localStorage
                    localStorage.setItem(flag.id, flag.enabled ? 'false' : 'true');
                    queryClient.setQueryData(['feetchair'], (oldData: Flags) => {
                      if (!oldData) return;
                      return oldData.map((oldFlag) => {
                        if (oldFlag.id === flag.id) {
                          return {
                            ...oldFlag,
                            enabled: !oldFlag.enabled,
                          };
                        }
                        return oldFlag;
                      });
                    });
                  }}
                >
                  {flag.enabled ? 'enabled' : 'disabled'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

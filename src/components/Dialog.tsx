import { useState } from 'react';
import * as Ariakit from '@ariakit/react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../cn';

export const Dialog = ({
  trigger,
  title,
  children,
  cancelButtonProps,
  okButtonProps,
}: {
  trigger: React.ReactNode;
  title: string;
  children: React.ReactNode;
  cancelButtonProps?: {
    label: string;
    disabled?: boolean;
    children?: React.ReactNode;
    className?: string;
    onClick: () => void;
  };
  okButtonProps?: {
    label: string;
    disabled?: boolean;
    children?: React.ReactNode;
    className?: string;
    onClick: () => void;
  };
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Ariakit.Button onClick={() => setOpen(true)} className="p-2 mb-4 border border-[#1a1a1a]">
        {trigger}
      </Ariakit.Button>
      <Ariakit.Portal>
        <Ariakit.Dialog
          open={open}
          onClose={() => setOpen(false)}
          className="fixed inset-3 z-50 m-auto flex h-fit max-h-[calc(100dvh-1.5rem)] flex-col gap-4 overflow-auto rounded-xl border border-[#1a1a1a] bg-black p-4 text-white shadow-2xl max-w-lg"
          render={(props) => (
            <div className="fixed inset-0 z-50 overflow-auto px-4 py-16 bg-black/10 backdrop-blur-sm" hidden={!open}>
              <div {...props} />
            </div>
          )}
        >
          <div className="flex items-center justify-between">
            <Ariakit.DialogHeading className="text-md font-semibold">{title}</Ariakit.DialogHeading>
            <Ariakit.DialogDismiss className="rounded border border-[#1a1a1a]">
              <X />
            </Ariakit.DialogDismiss>
          </div>
          {children}
          <div className="flex gap-2 justify-end">
            <Button
              className="w-fit"
              onClick={() => {
                setOpen(false);
                cancelButtonProps?.onClick();
              }}
              label={cancelButtonProps?.label ?? 'Cancel'}
              disabled={cancelButtonProps?.disabled}
            >
              {cancelButtonProps?.children ?? 'Cancel'}
            </Button>
            <Button
              className={cn('w-fit', okButtonProps?.className)}
              onClick={okButtonProps?.onClick}
              disabled={okButtonProps?.disabled}
              label={okButtonProps?.label ?? 'Okay'}
            >
              {okButtonProps?.children ?? 'Okay'}
            </Button>
          </div>
        </Ariakit.Dialog>
      </Ariakit.Portal>
    </>
  );
};

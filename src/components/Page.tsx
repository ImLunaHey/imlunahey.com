export const Page = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative mx-auto min-h-[calc(100dvh-100px)] w-full max-w-screen-md p-2">
      <div className="w-full">{children}</div>
    </div>
  );
};

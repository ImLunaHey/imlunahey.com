export const Page = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative w-full max-w-screen-md mx-auto p-2 min-h-[calc(100dvh-100px)]">
      <div className="w-full">{children}</div>
    </div>
  );
};

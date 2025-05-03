import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const CustomDevTools = () => {
  return (
    <button
      onClick={() => {
        document.body.classList.toggle('debug');
      }}
      className="active:stroke-red/80 fixed bottom-4 left-4 z-50 rounded-full bg-black/50 p-2 text-white transition-all duration-150 hover:bg-black/70 active:scale-95"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
        <path d="M8.5 8.5v.01" />
        <path d="M16 15.5v.01" />
        <path d="M12 12v.01" />
        <path d="M11 17v.01" />
        <path d="M7 14v.01" />
      </svg>
    </button>
  );
};

export const DevTools = () => {
  return (
    <>
      <CustomDevTools />
      <ReactQueryDevtools />
    </>
  );
};

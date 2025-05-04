import { useParams } from 'react-router';

type Params = Record<string, boolean | number | string | null>;

let timeout: ReturnType<typeof setTimeout>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const debounce = <T extends (...args: any[]) => any>(fn: T, delay: number) => {
  return (...args: Parameters<T>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
};

export const useSearchParams = <T extends Params>() => {
  const searchParams = useParams();

  const setSearchParams = debounce((newParams: T) => {
    const search = window ? window.location.search : '';
    const params = new URLSearchParams(search);

    for (const [key, value] of Object.entries(newParams)) {
      if (value === null) {
        params.delete(key);
        continue;
      }

      params.set(key, String(value));
    }

    const newLocation = `${window.location.pathname}?${params.toString()}`;
    if (newLocation !== window.location.href) {
      window.history.pushState({}, '', newLocation);
    }
  }, 500);

  return [searchParams, setSearchParams] as const;
};

import { useIntersectionObserver } from '@uidotdev/usehooks';
import { DependencyList, EffectCallback, useEffect, useState } from 'react';

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const numbers = '0123456789';
const symbols = '!@#$%^&*()_+-=[]{};:,./<>?';
const characters = `${letters.toUpperCase()}${letters.toLowerCase()}${numbers}${symbols} `.split('').reverse().join('');

const useDelayedEffect = (effect: EffectCallback, deps?: DependencyList | undefined, delay?: number) => {
  useEffect(() => {
    const timeoutId = setTimeout(effect, delay);
    return () => clearTimeout(timeoutId);
  }, [effect, deps, delay]);
};

const useLetterIndex = (letter: string, delay: number) => {
  const [index, setIndex] = useState(0);

  useDelayedEffect(
    () => {
      const interval = setInterval(() => {
        setIndex((currentIndex) => {
          if (characters[currentIndex] === letter) {
            clearInterval(interval);
            return currentIndex;
          }
          return currentIndex + 1;
        });
      }, 50);

      return () => clearInterval(interval);
    },
    [letter],
    delay * 50,
  );

  return index;
};

const Letter = ({ letter, delay = 1_000 }: { letter: string; delay?: number }) => {
  const index = useLetterIndex(letter, delay);

  return <span className="text-white font-mono">{characters[index] ?? '[ ]'}</span>;
};

const Reveal = ({ text }: { text: string }) => {
  return (
    <div>
      {text.split('').map((letter, i) => {
        return <Letter key={i} letter={letter} delay={i} />;
      })}
    </div>
  );
};

export const VerseTextReveal = () => {
  const [inViewPort, setInViewPort] = useState(false);
  const [ref, entry] = useIntersectionObserver({
    threshold: 0,
    root: null,
    rootMargin: '0px',
  });

  useEffect(() => {
    if (entry && entry.isIntersecting) {
      setInViewPort(true);
    } else {
      setInViewPort(false);
    }
  }, [entry]);

  return (
    <div className="text-white relative size-full">
      <div className="w-full h-full flex overflow-hidden justify-center items-center">
        <div className="h-fit w-1/2" ref={ref}>
          {inViewPort && (
            <>
              <Reveal text="HELLO WORLD" />
              <Reveal text="THIS IS A LONGER STRING" />
              <Reveal text="LOREM IPSUM DOLOR SIT AMET MUS FELIS SI NATOQUE. BLANDIT PURUS IACULIS SOLLICITUDIN QUISQUE MAGNIS. VELIT IN SEMPER SUSPENDISSE FEUGIAT CONUBIA EU ULTRICIES" />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

import { useState } from 'react';
import { motion } from 'framer-motion';
import { DailyTargets_01112023 } from './daily-targets/01-11-2023';
import { DailyTargets_02112023 } from './daily-targets/02-11-2023';
import { DailyTargets_03112023 } from './daily-targets/03-11-2023';
import { DailyTargets_04112023 } from './daily-targets/04-11-2023';
import { DailyTargets_28072023 } from './daily-targets/28-07-2023';
import { DailyTargets_30102023 } from './daily-targets/30-10-2023';
import { DailyTargets_31102023 } from './daily-targets/31-10-2023';
import { DailyTargets_21102023 } from './daily-targets/21-10-2023';
import { DailyTargets_02072023 } from './daily-targets/02-07-2023';
import { DailyTargets_01102023 } from './daily-targets/01-10-2023';
import { DailyTargets_15032025 } from './daily-targets/15-03-2025';

export const DailyTarget = ({ children, href }: { children: React.ReactNode; href: string }) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="size-full relative">
      <motion.div
        className="relative size-full overflow-hidden"
        animate={{
          width: expanded ? '100%' : '400px',
          height: expanded ? '100%' : '300px',
          left: expanded ? 0 : 'calc(50% - 200px)',
          top: expanded ? 0 : 'calc(50% - 150px)',
        }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
      <a
        className="absolute text-sm left-5 bottom-5 font-mono p-2 bg-black text-white w-min md:w-fit border-2 border-[#1a1a1a]"
        href={href}
      >
        {href.replace('https://', '')}
      </a>
      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute top-2 right-2 bg-black text-white p-2 border-2 border-[#1a1a1a]"
      >
        {expanded ? 'full page' : '400x300'}
      </button>
    </div>
  );
};

type Battle = {
  href: string;
  component: React.ComponentType;
  date: string;
};

export const battles = [
  {
    href: 'https://cssbattle.dev/play/UTVSk8ObpW8mRxCqfHS3',
    component: DailyTargets_01102023,
    date: '01-10-2023',
  },
  {
    href: 'https://cssbattle.dev/play/9qTZqXiAX94LQdi4Bm0x',
    component: DailyTargets_02072023,
    date: '02-07-2023',
  },
  {
    href: 'https://cssbattle.dev/play/MqQZVJnjcLPpfnIlShHH',
    component: DailyTargets_21102023,
    date: '21-10-2023',
  },
  {
    href: 'https://cssbattle.dev/play/xVZiXaTbquOO8zacDDjt',
    component: DailyTargets_28072023,
    date: '28-07-2023',
  },
  {
    href: 'https://cssbattle.dev/play/QGHPRtNWxdMMzt5zo4lj',
    component: DailyTargets_30102023,
    date: '30-10-2023',
  },
  {
    href: 'https://cssbattle.dev/play/DEZ0vq4BzrnHgCY7ljLv',
    component: DailyTargets_31102023,
    date: '31-10-2023',
  },
  {
    href: 'https://cssbattle.dev/play/QbKbsSvMnViaoahKjkya',
    component: DailyTargets_01112023,
    date: '01-11-2023',
  },
  {
    href: 'https://cssbattle.dev/play/taLJyz4IamvfctMx4z3Q',
    component: DailyTargets_02112023,
    date: '02-11-2023',
  },
  {
    href: 'https://cssbattle.dev/play/Wu3QnyC0Fh2okPAZRzjq',
    component: DailyTargets_03112023,
    date: '03-11-2023',
  },
  {
    href: 'https://cssbattle.dev/play/2S2kJuGL3a15M9HieIQ4',
    component: DailyTargets_04112023,
    date: '04-11-2023',
  },
  {
    href: 'https://cssbattle.dev/play/r3VAqE9bFgqKDzqcdl5K',
    component: DailyTargets_15032025,
    date: '15-03-2025',
  },
] satisfies Battle[];

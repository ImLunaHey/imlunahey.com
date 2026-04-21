import type { ComponentType } from 'react';
import { DailyTargets_01102023 } from './daily-targets/01-10-2023';
import { DailyTargets_01112023 } from './daily-targets/01-11-2023';
import { DailyTargets_02072023 } from './daily-targets/02-07-2023';
import { DailyTargets_02112023 } from './daily-targets/02-11-2023';
import { DailyTargets_03112023 } from './daily-targets/03-11-2023';
import { DailyTargets_04112023 } from './daily-targets/04-11-2023';
import { DailyTargets_15032025 } from './daily-targets/15-03-2025';
import { DailyTargets_21102023 } from './daily-targets/21-10-2023';
import { DailyTargets_28072023 } from './daily-targets/28-07-2023';
import { DailyTargets_30102023 } from './daily-targets/30-10-2023';
import { DailyTargets_31102023 } from './daily-targets/31-10-2023';

import src_01102023 from './daily-targets/01-10-2023.tsx?raw';
import src_01112023 from './daily-targets/01-11-2023.tsx?raw';
import src_02072023 from './daily-targets/02-07-2023.tsx?raw';
import src_02112023 from './daily-targets/02-11-2023.tsx?raw';
import src_03112023 from './daily-targets/03-11-2023.tsx?raw';
import src_04112023 from './daily-targets/04-11-2023.tsx?raw';
import src_15032025 from './daily-targets/15-03-2025.tsx?raw';
import src_21102023 from './daily-targets/21-10-2023.tsx?raw';
import src_28072023 from './daily-targets/28-07-2023.tsx?raw';
import src_30102023 from './daily-targets/30-10-2023.tsx?raw';
import src_31102023 from './daily-targets/31-10-2023.tsx?raw';

export type Battle = {
  date: string; // iso (also used as the url slug)
  href: string;
  component: ComponentType;
  source: string;
};

// newest first
export const BATTLES: Battle[] = [
  { date: '2025-03-15', href: 'https://cssbattle.dev/play/r3VAqE9bFgqKDzqcdl5K', component: DailyTargets_15032025, source: src_15032025 },
  { date: '2023-11-04', href: 'https://cssbattle.dev/play/2S2kJuGL3a15M9HieIQ4', component: DailyTargets_04112023, source: src_04112023 },
  { date: '2023-11-03', href: 'https://cssbattle.dev/play/Wu3QnyC0Fh2okPAZRzjq', component: DailyTargets_03112023, source: src_03112023 },
  { date: '2023-11-02', href: 'https://cssbattle.dev/play/taLJyz4IamvfctMx4z3Q', component: DailyTargets_02112023, source: src_02112023 },
  { date: '2023-11-01', href: 'https://cssbattle.dev/play/QbKbsSvMnViaoahKjkya', component: DailyTargets_01112023, source: src_01112023 },
  { date: '2023-10-31', href: 'https://cssbattle.dev/play/DEZ0vq4BzrnHgCY7ljLv', component: DailyTargets_31102023, source: src_31102023 },
  { date: '2023-10-30', href: 'https://cssbattle.dev/play/QGHPRtNWxdMMzt5zo4lj', component: DailyTargets_30102023, source: src_30102023 },
  { date: '2023-10-21', href: 'https://cssbattle.dev/play/MqQZVJnjcLPpfnIlShHH', component: DailyTargets_21102023, source: src_21102023 },
  { date: '2023-10-01', href: 'https://cssbattle.dev/play/UTVSk8ObpW8mRxCqfHS3', component: DailyTargets_01102023, source: src_01102023 },
  { date: '2023-07-28', href: 'https://cssbattle.dev/play/xVZiXaTbquOO8zacDDjt', component: DailyTargets_28072023, source: src_28072023 },
  { date: '2023-07-02', href: 'https://cssbattle.dev/play/9qTZqXiAX94LQdi4Bm0x', component: DailyTargets_02072023, source: src_02072023 },
];

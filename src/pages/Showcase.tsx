import { Page } from '../components/Page';
import { NavBar } from '../components/NavBar';
import { Card } from '../components/Card';
import { VerseTextReveal } from './Showcase/verse-text-reveal';
import { battles, DailyTarget } from './Showcase/css-battles/daily-target';

const showcase = [
  <VerseTextReveal />,
  ...battles.map((battle) => (
    <DailyTarget key={battle.href} href={battle.href}>
      <battle.component />
    </DailyTarget>
  )),
];

export const ShowcasePage = () => {
  return (
    <Page>
      <NavBar />
      <div className="flex flex-col gap-2">
        {showcase.map((item, index) => (
          <Card className="p-2" key={`showcase-${index}`}>
            <div className="h-[500px]">{item}</div>
          </Card>
        ))}
      </div>
    </Page>
  );
};

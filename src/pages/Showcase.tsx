import { Page } from '../components/Page';
import { NavBar } from '../components/NavBar';
import { Card } from '../components/Card';
import { VerseTextReveal } from './Showcase/verse-text-reveal';

const showcase = [
  <div className="h-[500px]">
    <VerseTextReveal />
  </div>,
];

export const ShowcasePage = () => {
  return (
    <Page>
      <NavBar />
      <div className="flex flex-col gap-2">
        {showcase.map((item, index) => (
          <Card className="p-2" key={`showcase-${index}`}>
            {item}
          </Card>
        ))}
      </div>
    </Page>
  );
};

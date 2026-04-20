import { allFakers } from '@faker-js/faker';
import { Button } from '../elements/Button';
import { Card } from '../components/Card';
import { H1, H2, H3, H4, H5, H6 } from '../elements/Heading';
import { Input } from '../elements/Input';
import { Loading } from '../components/Loading';
import { MoviePoster } from '../components/MoviePoster';
import { ProgressBar } from '../components/ProgressBar';
import { RadioGroup } from '../elements/Radio';
import { ShowPoster } from '../components/ShowPoster';
import { Select } from '../elements/Select';
import { List } from '../elements/List';
import { HorizontalRule } from '../elements/HorizontalRule';
import { Table } from '../elements/Table';

const Component = ({ title, children }: { title: string; children: React.ReactNode }) => {
  return (
    <div className="flex flex-col gap-2 p-4">
      <H2 className="text-lg font-bold">{title}</H2>
      {children}
    </div>
  );
};

const locale = navigator.language.split('-')[0] as keyof typeof allFakers;
const faker = allFakers[locale];

const columnGenerators = {
  id: (index: number) => String(index),
  name: () => faker.person.fullName(),
  email: () => faker.internet.email(),
  phone: () => faker.phone.number(),
  address: () => faker.location.streetAddress(),
  city: () => faker.location.city(),
  state: () => faker.location.state(),
  zip: () => faker.location.zipCode(),
  country: () => faker.location.country(),
  createdAt: () => faker.date.past(),
  updatedAt: () => faker.date.recent(),
};

const createTableRows = ({ rows, columns }: { rows: number; columns: number }) => {
  const generatorKeys = Object.keys(columnGenerators).slice(0, columns);
  return Array.from({ length: rows }, (_, index) => {
    const row: Record<string, string | Date> = {};
    generatorKeys.forEach((key) => {
      row[key] = columnGenerators[key as keyof typeof columnGenerators](index);
    });
    return row;
  });
};

const htmlElements = [
  {
    title: 'Headings',
    children: (
      <div>
        <H1>h1</H1>
        <H2>h2</H2>
        <H3>h3</H3>
        <H4>h4</H4>
        <H5>h5</H5>
        <H6>h6</H6>
      </div>
    ),
  },
  {
    title: 'Button',
    children: (
      <div className="flex gap-2">
        <Button>Click me</Button>
        <Button disabled>Disabled</Button>
      </div>
    ),
  },
  { title: 'Input', children: <Input type="text" label="Name" placeholder="Enter your name" /> },
  {
    title: 'Select',
    children: (
      <Select
        label="Favorite fruit"
        items={[
          { label: 'Apple', value: 'apple' },
          { label: 'Banana', value: 'banana' },
          { label: 'Orange', value: 'orange', disabled: true },
        ]}
      />
    ),
  },
  {
    title: 'Radio Group',
    children: (
      <div>
        <div>
          <H3 className="text-md mb-2">Vertical</H3>
          <RadioGroup
            direction="vertical"
            items={[
              { label: 'Apple', value: 'apple' },
              { label: 'Orange', value: 'orange' },
              { label: 'Watermelon', value: 'watermelon' },
            ]}
          />
        </div>
        <div>
          <H3 className="text-md mb-2">Horizontal</H3>
          <RadioGroup
            direction="horizontal"
            items={[
              { label: 'Apple', value: 'apple' },
              { label: 'Orange', value: 'orange' },
              { label: 'Watermelon', value: 'watermelon' },
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    title: 'Progress',
    children: (
      <div className="flex flex-col gap-2">
        <ProgressBar value={100} label="100%" />
        <ProgressBar value={50} label="50%" />
        <ProgressBar value={0} label="0%" />
      </div>
    ),
  },
  {
    title: 'List',
    children: (
      <div>
        <H3 className="text-md mb-2">Unordered</H3>
        <List items={['Apple', 'Banana', 'Orange']} />
        <H3 className="text-md mb-2">Ordered</H3>
        <List items={['Apple', 'Banana', 'Orange']} ordered />
      </div>
    ),
  },
  {
    title: 'Horizontal Rule',
    children: <HorizontalRule />,
  },
  {
    title: 'Table',
    children: (
      <div>
        <H3 className="text-md mb-2">Basic table</H3>
        <Table rows={createTableRows({ rows: 5, columns: 3 })} />
        <H3 className="text-md mb-2">Table with pagination</H3>
        <Table rows={createTableRows({ rows: 100, columns: 5 })} />
        <H3 className="text-md mb-2">Table with search</H3>
        <Table rows={createTableRows({ rows: 10, columns: 5 })} search />
        <H3 className="text-md mb-2">Table with lots of columns</H3>
        <Table rows={createTableRows({ rows: 10, columns: 20 })} />
      </div>
    ),
  },
];

const components = [
  {
    title: 'Loading',
    children: <Loading />,
  },
  { title: 'Card', children: <Card>Hello</Card> },
  {
    title: 'Posters',
    children: (
      <div className="flex gap-2">
        <MoviePoster movieId="123" rating={5} />
        <ShowPoster showId="123" rating={5} />
      </div>
    ),
  },
];

const sections = [
  {
    title: 'Fonts',
    children: [
      {
        title: 'Doto',
        children: <div className="font-doto">This is used for the title of the page.</div>,
      },
      {
        title: 'Mono',
        children: <div className="font-mono">This is used for everything else.</div>,
      },
    ],
  },
  {
    title: 'Colours',
    children: [
      {
        title: 'Main',
        children: (
          <div className="flex gap-2">
            <div className="size-8 border border-white bg-white" title="white" />
            <div className="bg-gray size-8 border border-white" title="gray" />
            <div className="size-8 border border-white bg-black" title="black" />
            <div className="bg-red size-8 border border-white" title="red" />
          </div>
        ),
      },
      {
        title: 'Theme',
        children: (
          <div className="flex gap-2">
            <div className="bg-primary size-8 border border-white" title="primary" />
            <div className="bg-secondary size-8 border border-white" title="secondary" />
          </div>
        ),
      },
    ],
  },
  {
    title: 'HTML Elements',
    children: htmlElements,
  },
  {
    title: 'Components',
    children: components,
  },
];

export default function DesignPage() {
  return (
    <div className="mx-auto max-w-screen-lg">
      {sections.map((section) => (
        <div key={section.title}>
          <H2>{section.title}</H2>
          {section.children.map((child) => (
            <Component key={child.title} title={child.title} children={child.children} />
          ))}
        </div>
      ))}
    </div>
  );
}

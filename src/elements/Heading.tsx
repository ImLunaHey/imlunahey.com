import { createElement } from 'react';
import { cn } from '../cn';

const Heading = ({ children, level, className }: { children: React.ReactNode; level: number; className?: string }) => {
  return createElement(
    `h${level}`,
    {
      className: cn(
        'font-bold mt-2 uppercase font-mono',
        {
          'text-4xl': level === 1,
          'text-2xl': level === 2,
          'text-xl': level === 3,
          'text-lg': level === 4,
          'text-base': level === 5,
          'text-sm': level === 6,
        },
        className,
      ),
    },
    children,
  );
};

export const H1 = (props: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Heading level={1} {...props}>
    {props.children}
  </Heading>
);

export const H2 = (props: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Heading level={2} {...props}>
    {props.children}
  </Heading>
);

export const H3 = (props: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Heading level={3} {...props}>
    {props.children}
  </Heading>
);

export const H4 = (props: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Heading level={4} {...props}>
    {props.children}
  </Heading>
);

export const H5 = (props: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Heading level={5} {...props}>
    {props.children}
  </Heading>
);

export const H6 = (props: React.HTMLAttributes<HTMLHeadingElement>) => (
  <Heading level={6} {...props}>
    {props.children}
  </Heading>
);

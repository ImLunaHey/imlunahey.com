import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from '../lib/router/Link';
import { cn } from '../cn';
import { H1, H2, H3, H4, H5, H6 } from './Heading';

export const MarkdownPreview = ({ content, className }: { content: string; className?: string }) => {
  return (
    <div className={cn('w-full', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => {
            if (props.href) {
              return (
                <Link to={props.href} className="text-blue-500 hover:underline">
                  {children}
                </Link>
              );
            }
            return <a {...props}>{children}</a>;
          },
          h1: ({ children }) => <H1>{children}</H1>,
          h2: ({ children }) => <H2>{children}</H2>,
          h3: ({ children }) => <H3>{children}</H3>,
          h4: ({ children }) => <H4>{children}</H4>,
          h5: ({ children }) => <H5>{children}</H5>,
          h6: ({ children }) => <H6>{children}</H6>,
          img: ({ ...props }) => (
            <div className="flex flex-col gap-2 items-center justify-center">
              <img {...props} className="w-full" />
              <div className="text-xs text-gray-200">{props.alt}</div>
            </div>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

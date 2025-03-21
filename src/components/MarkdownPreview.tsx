import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from '../lib/router/Link';
import { cn } from '../cn';

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
          h1: ({ children }) => <h1 className="text-2xl font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-bold">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-bold">{children}</h4>,
          h5: ({ children }) => <h5 className="text-sm font-bold">{children}</h5>,
          h6: ({ children }) => <h6 className="text-xs font-bold">{children}</h6>,
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

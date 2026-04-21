import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from '@tanstack/react-router';
import { highlight } from 'sugar-high';
import { cn } from '../cn';
import { H1, H2, H3, H4, H5, H6 } from '../elements/Heading';
import { Image } from '../elements/Image';

export const MarkdownPreview = ({ content, className }: { content: string; className?: string }) => {
  return (
    <div className={cn('w-full', className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, ...props }) => {
            if (props.href) {
              if (props.href.startsWith('http') || props.href.startsWith('mailto:')) {
                return (
                  <a href={props.href} className="text-blue-500 hover:underline">
                    {children}
                  </a>
                );
              }
              return (
                <Link to={props.href as never} className="text-blue-500 hover:underline">
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
          img: ({ ...props }) => <Image src={props.src} alt={props.alt} />,
          // fenced code blocks get sugar-high syntax highlighting; inline
          // code (no `language-*` class) falls through unchanged.
          code: ({ className, children, ...props }) => {
            const isBlock = /language-/.test(className ?? '');
            if (!isBlock) return <code className={className} {...props}>{children}</code>;
            return (
              <code
                className={className}
                dangerouslySetInnerHTML={{ __html: highlight(String(children).replace(/\n$/, '')) }}
              />
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

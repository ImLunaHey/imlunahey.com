import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router';
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
          img: ({ ...props }) => <Image src={props.src} alt={props.alt} />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

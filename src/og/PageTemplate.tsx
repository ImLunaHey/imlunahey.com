// @ts-expect-error this is needed for the plugin
import React from 'react';
import type { PageMetaData } from './page-meta-map';

// must contain an element with id="root"
const PageTemplate = ({ title, description }: PageMetaData) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
      </head>
      <body>
        <div id="root"></div>
      </body>
    </html>
  );
};

export default PageTemplate;

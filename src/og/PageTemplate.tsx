// @ts-expect-error this is needed for the plugin
import React from 'react';
import type { PageMetaData } from './page-meta-map';

const PageTemplate = ({ title, description }: PageMetaData) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content="https://imlunahey.com" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://imlunahey.com/open-graph.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta property="twitter:domain" content="imlunahey.com" />
        <meta property="twitter:url" content="https://imlunahey.com" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content="https://imlunahey.com/open-graph.png" />
      </head>
      <body>
        <div id="root" />
      </body>
    </html>
  );
};

export default PageTemplate;

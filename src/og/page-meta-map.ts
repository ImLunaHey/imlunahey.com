// you can add more to the PageMetaData type (such as Open Graph data) to be consumed by your PageTemplate component
export type PageMetaData = {
  url: string; // required by plugin
  bundleEntryPoint: string; // required by plugin
  title: string;
  description: string;
};

// here you will list all your pages and their needed meta data.
export const pages: PageMetaData[] = [
  {
    url: 'index.html',
    bundleEntryPoint: '/src/main.tsx',
    title: 'luna',
    description: 'a website i made',
  },
  {
    url: 'projects.html',
    bundleEntryPoint: '/src/main.tsx',
    title: 'projects',
    description: `some projects i've worked on`,
  },
  {
    url: 'blog.html',
    bundleEntryPoint: '/src/main.tsx',
    title: 'blog',
    description: `some blog posts i've written`,
  },
  {
    url: 'gallery.html',
    bundleEntryPoint: '/src/main.tsx',
    title: 'gallery',
    description: `some images i've made`,
  },
  {
    url: 'contact.html',
    bundleEntryPoint: '/src/main.tsx',
    title: 'contact',
    description: `contact me`,
  },
];

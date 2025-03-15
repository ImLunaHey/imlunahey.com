export type BlogEntry<did extends string> = {
  uri: string;
  cid: string;
  value: {
    $type: 'com.whtwnd.blog.entry';
    theme: string;
    title: string;
    content: string;
    createdAt: string;
    visibility: 'public' | 'private';
    comments?: `at://${did}/com.whtwnd.blog.entry/${string}`;
  };
};

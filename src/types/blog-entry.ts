/**
 * Matches the real com.whtwnd.blog.entry lexicon shape as of whitewind's
 * current definitions (see @atcute/whitewind). Notable corrections vs the
 * earlier ad-hoc shape: visibility is a 3-state enum, not 'public' |
 * 'private'; title/theme/visibility/createdAt are all optional.
 */
export type WhtwndVisibility = 'public' | 'url' | 'author';

export type BlogEntryResponse<did extends string> = {
  uri: string;
  cid: string;
  value: {
    $type: 'com.whtwnd.blog.entry';
    content: string;
    theme?: 'github-light';
    title?: string;
    createdAt?: string;
    visibility?: WhtwndVisibility;
    ogp?: { url: string; width?: number; height?: number };
    comments?: `at://${did}/com.whtwnd.blog.entry/${string}`;
  };
};

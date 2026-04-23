import { createFileRoute } from '@tanstack/react-router';
import { SITE } from '../../../../../data';
import YearInReviewPage from '../../../../../pages/labs/YearInReview';

export const Route = createFileRoute('/_main/labs/year-in-review/$handle/$year')({
  component: YearInReviewPage,
  head: ({ params }) => {
    const p = params as { handle?: string; year?: string };
    const handle = p.handle ?? '';
    const rawYear = p.year ?? '';
    const yearLabel = rawYear === 'all' ? 'lifetime' : rawYear;
    const title = `${handle} · ${yearLabel} · year in review · ${SITE.name}`;
    const description = rawYear === 'all'
      ? `${handle}'s whole-account atproto activity — posts, likes, follows, lexicons used.`
      : `${handle}'s ${rawYear} on atproto — posts, likes, follows, top hashtags, longest post.`;
    const pageUrl = `https://${SITE.domain}/labs/year-in-review/${encodeURIComponent(handle)}/${encodeURIComponent(rawYear)}`;
    const image = `https://${SITE.domain}/og/year-in-review/${encodeURIComponent(handle)}/${encodeURIComponent(rawYear)}`;
    return {
      meta: [
        { title },
        { name: 'description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE.domain },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:url', content: pageUrl },
        { property: 'og:image', content: image },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:type', content: 'image/png' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: `@${SITE.handle}` },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: image },
      ],
    };
  },
});

import { createFileRoute } from '@tanstack/react-router';
import { SITE } from '../../../../data';
import YearInReviewPage from '../../../../pages/labs/YearInReview';

export const Route = createFileRoute('/_main/labs/year-in-review/')({
  component: YearInReviewPage,
  head: () => {
    const title = `year in review · ${SITE.name}`;
    const description = "bluesky wrapped from any account's car file — posts, likes, follows, top hashtags, longest post, lexicons used.";
    const pageUrl = `https://${SITE.domain}/labs/year-in-review`;
    // Reuse the dynamic card template with a placeholder handle.
    const image = `https://${SITE.domain}/og/year-in-review/${encodeURIComponent('your.handle.bsky.social')}/all`;
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

import { createFileRoute } from '@tanstack/react-router';
import HomePage from '../../pages/Home';
import { SITE } from '../../data';

export const Route = createFileRoute('/_main/')({
  component: HomePage,
  // Canonical for the home page. Lives here rather than in __root so it
  // doesn't leak into every nested route's head. Title / description are
  // already set by the root route's head().
  head: () => ({
    links: [{ rel: 'canonical', href: `https://${SITE.domain}` }],
  }),
});

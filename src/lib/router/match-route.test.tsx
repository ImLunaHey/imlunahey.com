import { expect, test } from 'vitest';
import { matchRoute } from './match-route';

test('matches routes', async () => {
  const routes = [
    { path: '/', component: () => <div>Home</div> },
    { path: '/about', component: () => <div>About</div> },
    { path: '/contact', component: () => <div>Contact</div> },
  ];

  expect(matchRoute('/', routes)).toBe(routes[0]);
  expect(matchRoute('/about', routes)).toBe(routes[1]);
  expect(matchRoute('/contact', routes)).toBe(routes[2]);
  expect(matchRoute('/none', routes)).toBeUndefined();
});

test('matches routes with parameters', async () => {
  const routes = [{ path: '/user/:id', component: () => <div>User</div> }];

  expect(matchRoute('/user/123', routes)).toBe(routes[0]);
  expect(matchRoute('/user/456', routes)).toBe(routes[0]);
  expect(matchRoute('/user', routes)).toBeUndefined();
  expect(matchRoute('/', routes)).toBeUndefined();
});

test('matches routes with exact path', async () => {
  const routes = [{ path: '/user', component: () => <div>User</div>, exact: true }];

  expect(matchRoute('/user', routes)).toBe(routes[0]);
  expect(matchRoute('/user/123', routes)).toBeUndefined();
});

test('matches routes with wildcard', async () => {
  const routes = [{ path: '/user/*', component: () => <div>User</div> }];

  expect(matchRoute('/user/123', routes)).toBe(routes[0]);
  expect(matchRoute('/user/123/456', routes)).toBe(routes[0]);
});

test('matches routes with multiple parameters', async () => {
  const routes = [{ path: '/user/:id/post/:postId', component: () => <div>User Post</div> }];

  expect(matchRoute('/user/123/post/456', routes)).toBe(routes[0]);
  expect(matchRoute('/user/123/post', routes)).toBeUndefined();
  expect(matchRoute('/user/123/post/456/789', routes)).toBeUndefined();
});

test('matches routes with optional parameters', async () => {
  const routes = [{ path: '/user/:id/post/:postId?', component: () => <div>User Post</div> }];

  expect(matchRoute('/user/123/post/456', routes)).toBe(routes[0]);
  expect(matchRoute('/user/123/post', routes)).toBe(routes[0]);
  expect(matchRoute('/user/123', routes)).toBeUndefined();
});

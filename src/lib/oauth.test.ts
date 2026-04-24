import { describe, it, expect } from 'vitest';
import type { Session } from '@atcute/oauth-browser-client';
import {
  sessionHasScope,
  GUESTBOOK_WRITE_SCOPE,
  LEADERBOARD_WRITE_SCOPE,
  BSKY_POST_WRITE_SCOPE,
} from './oauth';

function mkSession(scope: string): Session {
  // Only the shape `sessionHasScope` inspects — the rest of the Session
  // surface is irrelevant for this check.
  return { token: { scope } } as unknown as Session;
}

describe('sessionHasScope', () => {
  it('returns false for a null session', () => {
    expect(sessionHasScope(null, GUESTBOOK_WRITE_SCOPE)).toBe(false);
  });

  it('returns false when the token has no scope string', () => {
    expect(sessionHasScope({ token: {} } as unknown as Session, GUESTBOOK_WRITE_SCOPE)).toBe(false);
  });

  it('returns true when the exact scope is granted', () => {
    const s = mkSession(`atproto ${GUESTBOOK_WRITE_SCOPE}`);
    expect(sessionHasScope(s, GUESTBOOK_WRITE_SCOPE)).toBe(true);
  });

  it('distinguishes between write scopes — guestbook ≠ leaderboard', () => {
    const guestOnly = mkSession(`atproto ${GUESTBOOK_WRITE_SCOPE}`);
    expect(sessionHasScope(guestOnly, LEADERBOARD_WRITE_SCOPE)).toBe(false);
    expect(sessionHasScope(guestOnly, BSKY_POST_WRITE_SCOPE)).toBe(false);
  });

  it('handles a multi-scope token with any whitespace separator', () => {
    const s = mkSession(`atproto\t${GUESTBOOK_WRITE_SCOPE}\n${LEADERBOARD_WRITE_SCOPE}`);
    expect(sessionHasScope(s, GUESTBOOK_WRITE_SCOPE)).toBe(true);
    expect(sessionHasScope(s, LEADERBOARD_WRITE_SCOPE)).toBe(true);
  });

  it('does not substring-match — a prefix scope is not a grant', () => {
    const s = mkSession('atproto repo:com.imlunahey.guestbook');
    expect(sessionHasScope(s, GUESTBOOK_WRITE_SCOPE)).toBe(false);
  });
});

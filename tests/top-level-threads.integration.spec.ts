/**
 * @fileoverview Integration tests for top-level thread grouping behavior.
 */

import { describe, expect, it } from 'vitest';
import { buildTopLevelThreads } from '../src/lib/github';
import type { Comment } from '../src/lib/types';

function makeComment(id: string, login: string, createdAt: string, body: string): Comment {
  return {
    id,
    kind: 'issue',
    author: { login, avatarUrl: `https://example.com/${login}.png`, url: `https://example.com/${login}` },
    authorAssociation: 'CONTRIBUTOR',
    body,
    bodyHTML: `<p>${body}</p>`,
    createdAt,
    url: `https://example.com/${id}`,
    reactions: [],
  };
}

describe('buildTopLevelThreads integration', () => {
  it('groups author comments with direct mentions across comments', () => {
    const comments: Comment[] = [
      makeComment('1', 'alice', '2026-01-01T00:00:00.000Z', 'I think this should change.'),
      makeComment('2', 'bob', '2026-01-01T00:01:00.000Z', '@alice good call, I agree.'),
      makeComment('3', 'carol', '2026-01-01T00:02:00.000Z', 'Looping in @alice for context.'),
      makeComment('4', 'alice', '2026-01-01T00:03:00.000Z', 'Thanks @bob, I updated the patch.'),
    ];

    const threads = buildTopLevelThreads(comments);
    const alice = threads.find((thread) => thread.authorLogin === 'alice');
    const bob = threads.find((thread) => thread.authorLogin === 'bob');

    expect(alice?.comments.map((comment) => comment.id)).toEqual(['1', '2', '3', '4']);
    expect(alice?.mentions).toContain('bob');
    expect(alice?.updatedAt).toBe('2026-01-01T00:03:00.000Z');
    expect(bob?.comments.map((comment) => comment.id)).toEqual(['4']);
  });
});

/**
 * @fileoverview Unit tests for GitHub API helper behavior and thread grouping logic.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTopLevelThreads, graphql, rest } from './github';
import type { Comment } from './types';

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

describe('graphql', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends required headers for authenticated GraphQL requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await graphql<{ ok: boolean }>('token-123', 'query { viewer { login } }', {});

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const authHeader = (init.headers as Record<string, string>).authorization;
    expect(authHeader?.startsWith('Bearer ')).toBe(true);
    expect(authHeader?.endsWith('token-123')).toBe(true);
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect((init.headers as Record<string, string>)['user-agent']).toBe('pr-comments-inbox');
  });
});

describe('rest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('adds authorization only when a token is provided', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await rest<{ ok: boolean }>('token-123', '/test');
    let init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const authHeader = (init.headers as Record<string, string>).authorization;
    expect(authHeader?.startsWith('Bearer ')).toBe(true);
    expect(authHeader?.endsWith('token-123')).toBe(true);

    fetchMock.mockClear();
    await rest<{ ok: boolean }>(null, '/test');
    init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });
});

describe('buildTopLevelThreads', () => {
  it('starts the PR author thread with the description', () => {
    const description = {
      ...makeComment('d', 'alice', '2026-01-01T00:00:00.000Z', 'This PR does things. cc @bob'),
      kind: 'description' as const,
    };
    const threads = buildTopLevelThreads(
      [
        makeComment('1', 'bob', '2026-01-01T00:01:00.000Z', 'Looks fine.'),
        makeComment('2', 'alice', '2026-01-01T00:02:00.000Z', 'Thanks!'),
      ],
      description,
    );

    const alice = threads.find((thread) => thread.authorLogin === 'alice');
    const bob = threads.find((thread) => thread.authorLogin === 'bob');

    expect(alice?.comments.map((comment) => comment.id)).toEqual(['d', '2']);
    expect(bob?.comments.map((comment) => comment.id)).toEqual(['1']);
  });

  it('creates a thread for the description when the author has no comments', () => {
    const description = {
      ...makeComment('d', 'alice', '2026-01-01T00:00:00.000Z', 'Description only'),
      kind: 'description' as const,
    };
    const threads = buildTopLevelThreads([], description);

    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe('toplevel:alice');
    expect(threads[0].comments.map((comment) => comment.id)).toEqual(['d']);
  });

  it('moves replies that lead with an @mention of the PR author into the author thread', () => {
    const description = {
      ...makeComment('d', 'alice', '2026-01-01T00:00:00.000Z', 'Description only'),
      kind: 'description' as const,
    };
    const threads = buildTopLevelThreads(
      [makeComment('1', 'bob', '2026-01-01T00:01:00.000Z', '@alice what does this fix?')],
      description,
    );

    expect(threads.map((thread) => thread.authorLogin)).toEqual(['alice']);
    expect(threads[0].comments.map((comment) => comment.id)).toEqual(['d', '1']);
  });

  it('excludes leading @mention comments from the authors own thread', () => {
    const threads = buildTopLevelThreads([
      makeComment('1', 'alice', '2026-01-01T00:00:00.000Z', 'Initial review note.'),
      makeComment('2', 'bob', '2026-01-01T00:01:00.000Z', '@alice thanks, fixed now.'),
    ]);

    const bob = threads.find((thread) => thread.authorLogin === 'bob');
    const alice = threads.find((thread) => thread.authorLogin === 'alice');

    expect(bob).toBeUndefined();
    expect(alice?.comments.map((comment) => comment.id)).toEqual(['1', '2']);
  });
});

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

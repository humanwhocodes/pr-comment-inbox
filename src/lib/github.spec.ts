import { afterEach, describe, expect, it, vi } from 'vitest';
import { graphql, rest } from './github';

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

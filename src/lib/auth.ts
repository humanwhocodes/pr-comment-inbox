/**
 * @fileoverview Provides authentication helpers for token cookies and API responses.
 */

import type { APIContext, AstroCookies } from 'astro';

export const TOKEN_COOKIE = 'gh_token';
export const STATE_COOKIE = 'gh_oauth_state';

export function getToken(cookies: AstroCookies): string | null {
  const value = cookies.get(TOKEN_COOKIE)?.value;
  return value && value.length > 0 ? value : null;
}

export function setToken(cookies: AstroCookies, token: string, secure: boolean) {
  cookies.set(TOKEN_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearToken(cookies: AstroCookies) {
  cookies.delete(TOKEN_COOKIE, { path: '/' });
}

export function isSecure(ctx: Pick<APIContext, 'url'>): boolean {
  return ctx.url.protocol === 'https:';
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json; charset=utf-8', ...(init.headers ?? {}) },
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

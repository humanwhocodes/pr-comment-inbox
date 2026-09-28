/**
 * @fileoverview Starts the GitHub OAuth login flow.
 */

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { STATE_COOKIE, isSecure } from '../../../lib/auth';

export const GET: APIRoute = async (ctx) => {
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return ctx.redirect('/?error=' + encodeURIComponent('GitHub OAuth is not configured. Use a personal access token instead.'));
  }
  const state = crypto.randomUUID();
  ctx.cookies.set(STATE_COOKIE, state, { path: '/', httpOnly: true, sameSite: 'lax', secure: isSecure(ctx), maxAge: 600 });
  const redirectUri = new URL('/api/auth/callback', ctx.url).toString();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: 'repo read:user', state });
  return ctx.redirect(`https://github.com/login/oauth/authorize?${params}`);
};

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { STATE_COOKIE, isSecure, setToken } from '../../../lib/auth';
import { exchangeOAuthCode } from '../../../lib/github';

export const GET: APIRoute = async (ctx) => {
  const code = ctx.url.searchParams.get('code');
  const state = ctx.url.searchParams.get('state');
  const expected = ctx.cookies.get(STATE_COOKIE)?.value;
  ctx.cookies.delete(STATE_COOKIE, { path: '/' });

  if (!code || !state || state !== expected) {
    return ctx.redirect('/?error=' + encodeURIComponent('OAuth state mismatch. Please try again.'));
  }
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return ctx.redirect('/?error=' + encodeURIComponent('GitHub OAuth is not configured.'));
  }
  try {
    const redirectUri = new URL('/api/auth/callback', ctx.url).toString();
    const token = await exchangeOAuthCode(clientId, clientSecret, code, redirectUri);
    setToken(ctx.cookies, token, isSecure(ctx));
    return ctx.redirect('/');
  } catch (err) {
    return ctx.redirect('/?error=' + encodeURIComponent((err as Error).message));
  }
};

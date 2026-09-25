import type { APIRoute } from 'astro';
import { isSecure, setToken } from '../../../lib/auth';
import { fetchViewer } from '../../../lib/github';

export const POST: APIRoute = async (ctx) => {
  const form = await ctx.request.formData();
  const token = String(form.get('token') ?? '').trim();
  const next = String(form.get('next') ?? '/');
  if (!token) return ctx.redirect('/?error=' + encodeURIComponent('Token is required.'));
  try {
    await fetchViewer(token);
  } catch {
    return ctx.redirect('/?error=' + encodeURIComponent('GitHub rejected that token.'));
  }
  setToken(ctx.cookies, token, isSecure(ctx));
  return ctx.redirect(next.startsWith('/') ? next : '/');
};

import type { APIRoute } from 'astro';
import { clearToken } from '../../../lib/auth';

export const POST: APIRoute = async (ctx) => {
  clearToken(ctx.cookies);
  return ctx.redirect('/');
};

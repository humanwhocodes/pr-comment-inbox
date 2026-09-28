/**
 * @fileoverview Renders markdown through GitHub for editor preview requests.
 */

import type { APIRoute } from 'astro';
import { error } from '../../lib/auth';
import { renderMarkdown } from '../../lib/github';

export const POST: APIRoute = async (ctx) => {
  const { text, context } = (await ctx.request.json().catch(() => ({}))) as { text?: string; context?: string };
  if (typeof text !== 'string') {
    return error('text is required');
  }
  if (text.trim() === '') {
    return new Response('', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  try {
    const html = await renderMarkdown(ctx.locals.token, text, context);
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } catch (err) {
    return error((err as Error).message, 502);
  }
};

import type { APIRoute } from 'astro';
import { error, json } from '../../../../../../lib/auth';
import { setThreadResolved } from '../../../../../../lib/github';
import { handleError, readParams } from '../../../../../../lib/pr-route';

export const POST: APIRoute = async (ctx) => {
  const p = readParams(ctx);
  if (p instanceof Response) {
    return p;
  }
  const input = (await ctx.request.json().catch(() => ({}))) as { threadId?: string; resolved?: boolean };
  if (!input.threadId || typeof input.resolved !== 'boolean') {
    return error('threadId and resolved are required');
  }

  if (p.demo) {
    return json({ id: input.threadId, isResolved: input.resolved, demo: true });
  }

  try {
    return json(await setThreadResolved(p.token!, input.threadId, input.resolved));
  } catch (err) {
    return handleError(err);
  }
};

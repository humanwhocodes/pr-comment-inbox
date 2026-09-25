import type { APIRoute } from 'astro';
import { error, json } from '../../../../../../lib/auth';
import { addIssueComment, replyToReviewThread } from '../../../../../../lib/github';
import { handleError, readParams } from '../../../../../../lib/pr-route';

interface ReplyBody {
  kind?: 'inline' | 'toplevel';
  threadId?: string;
  pullRequestId?: string;
  body?: string;
}

export const POST: APIRoute = async (ctx) => {
  const p = readParams(ctx);
  if (p instanceof Response) return p;
  const input = (await ctx.request.json().catch(() => ({}))) as ReplyBody;
  const body = (input.body ?? '').trim();
  if (!body) return error('Reply body is required');

  if (p.demo) {
    return json({ id: `demo-${crypto.randomUUID()}`, url: '#', demo: true });
  }

  try {
    if (input.kind === 'inline') {
      if (!input.threadId) return error('threadId is required');
      return json(await replyToReviewThread(p.token!, input.threadId, body));
    }
    if (input.kind === 'toplevel') {
      if (!input.pullRequestId) return error('pullRequestId is required');
      return json(await addIssueComment(p.token!, input.pullRequestId, body));
    }
    return error('kind must be inline or toplevel');
  } catch (err) {
    return handleError(err);
  }
};

/**
 * @fileoverview Returns normalized pull-request data for the inbox UI.
 */

import type { APIRoute } from 'astro';
import { json } from '../../../../../../lib/auth';
import { demoData } from '../../../../../../lib/demo';
import { fetchPullRequest } from '../../../../../../lib/github';
import { handleError, readParams } from '../../../../../../lib/pr-route';

export const GET: APIRoute = async (ctx) => {
  const p = readParams(ctx);
  if (p instanceof Response) {
    return p;
  }
  if (p.demo) {
    return json(demoData());
  }
  try {
    return json(await fetchPullRequest(p.token!, p.owner, p.repo, p.number), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (err) {
    return handleError(err);
  }
};

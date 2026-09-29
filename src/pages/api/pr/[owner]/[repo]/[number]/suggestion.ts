/**
 * @fileoverview Applies accepted code suggestions to the pull-request branch.
 */

import type { APIRoute } from 'astro';
import { error, json } from '../../../../../../lib/auth';
import { applyInlineSuggestion } from '../../../../../../lib/github';
import { handleError, readParams } from '../../../../../../lib/pr-route';

interface SuggestionBody {
  owner?: string;
  repo?: string;
  branch?: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  suggestion?: string;
  author?: string;
}

export const POST: APIRoute = async (ctx) => {
  const p = readParams(ctx);
  if (p instanceof Response) {
    return p;
  }
  const input = (await ctx.request.json().catch(() => ({}))) as SuggestionBody;
  const owner = (input.owner ?? '').trim();
  const repo = (input.repo ?? '').trim();
  const branch = (input.branch ?? '').trim();
  const path = (input.path ?? '').trim();
  const suggestion = input.suggestion ?? '';
  const author = (input.author ?? 'reviewer').trim() || 'reviewer';
  const startLine = Number(input.startLine);
  const endLine = Number(input.endLine);

  if (!owner || !repo || !branch || !path || !Number.isInteger(startLine) || !Number.isInteger(endLine)) {
    return error('owner, repo, branch, path, startLine, and endLine are required');
  }
  if (p.demo) {
    return json({ path, branch, demo: true });
  }

  try {
    return json(await applyInlineSuggestion(p.token!, owner, repo, branch, path, startLine, endLine, suggestion, author));
  } catch (err) {
    return handleError(err);
  }
};

import type { APIContext } from 'astro';
import { GitHubError } from './github';
import { isDemo } from './demo';
import { error } from './auth';

export interface PrParams {
  owner: string;
  repo: string;
  number: number;
  demo: boolean;
  token: string | null;
}

export function readParams(ctx: APIContext): PrParams | Response {
  const owner = ctx.params.owner ?? '';
  const repo = ctx.params.repo ?? '';
  const number = Number.parseInt(ctx.params.number ?? '', 10);
  if (!owner || !repo || !Number.isInteger(number) || number <= 0) return error('Invalid pull request path', 400);
  const demo = isDemo(owner, repo, number);
  const token = ctx.locals.token;
  if (!demo && !token) return error('Not signed in', 401);
  return { owner, repo, number, demo, token };
}

export function handleError(err: unknown): Response {
  if (err instanceof GitHubError) return error(err.message, err.status);
  return error((err as Error)?.message ?? 'Unexpected error', 500);
}

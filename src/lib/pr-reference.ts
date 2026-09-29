/**
 * @fileoverview Parses user pull-request references and builds internal PR route paths.
 */

export interface PrReference {
  owner: string;
  repo: string;
  number: number;
}

/**
 * Accepts a full GitHub PR URL, `owner/repo#123`, or `owner/repo/pull/123`.
 * When a repository context is provided, `#123` and `123` are also accepted
 * and resolve to a pull request in that repository.
 * @param input Pull request reference text.
 * @param context Optional repository used to resolve number-only references.
 * @returns Parsed pull request reference, or null when input is invalid.
 */
export function parsePrReference(input: string, context?: { owner: string; repo: string }): PrReference | null {
  const text = input.trim();
  const url = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i.exec(text);
  if (url) {
    return { owner: url[1], repo: url[2], number: Number(url[3]) };
  }
  const short = /^([^/\s#]+)\/([^/\s#]+)(?:#|\/pull\/)(\d+)$/i.exec(text);
  if (short) {
    return { owner: short[1], repo: short[2], number: Number(short[3]) };
  }
  const numberOnly = /^#?(\d+)$/.exec(text);
  if (numberOnly && context) {
    return { owner: context.owner, repo: context.repo, number: Number(numberOnly[1]) };
  }
  return null;
}

/**
 * Creates the application route path for a pull request.
 * @param ref Pull request reference.
 * @returns Path for the pull request page.
 */
export function prPath(ref: PrReference): string {
  return `/${ref.owner}/${ref.repo}/pull/${ref.number}`;
}

export interface PrReference {
  owner: string;
  repo: string;
  number: number;
}

/**
 * Accepts a full GitHub PR URL, `owner/repo#123`, or `owner/repo/pull/123`.
 * @param input Pull request reference text.
 * @returns Parsed pull request reference, or null when input is invalid.
 */
export function parsePrReference(input: string): PrReference | null {
  const text = input.trim();
  const url = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i.exec(text);
  if (url) {
    return { owner: url[1], repo: url[2], number: Number(url[3]) };
  }
  const short = /^([^/\s#]+)\/([^/\s#]+)(?:#|\/pull\/)(\d+)$/i.exec(text);
  if (short) {
    return { owner: short[1], repo: short[2], number: Number(short[3]) };
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

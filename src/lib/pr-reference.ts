export interface PrReference {
  owner: string;
  repo: string;
  number: number;
}

/** Accepts a full GitHub PR URL, `owner/repo#123`, or `owner/repo/pull/123`. */
export function parsePrReference(input: string): PrReference | null {
  const text = input.trim();
  const url = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i.exec(text);
  if (url) return { owner: url[1], repo: url[2], number: Number(url[3]) };
  const short = /^([^/\s#]+)\/([^/\s#]+)(?:#|\/pull\/)(\d+)$/i.exec(text);
  if (short) return { owner: short[1], repo: short[2], number: Number(short[3]) };
  return null;
}

export function prPath(ref: PrReference): string {
  return `/${ref.owner}/${ref.repo}/pull/${ref.number}`;
}

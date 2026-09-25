/** Extract @-mentioned logins from a markdown body (GitHub login rules). */
export function extractMentions(body: string): string[] {
  const found = new Set<string>();
  // Strip fenced and inline code so `@foo` in code doesn't count.
  const stripped = body.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
  const re = /(^|[^\w/.-])@([a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?)(?![\w-])/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    found.add(m[2].toLowerCase());
  }
  return [...found];
}

export function mentionsLogin(body: string, login: string): boolean {
  return extractMentions(body).includes(login.toLowerCase());
}

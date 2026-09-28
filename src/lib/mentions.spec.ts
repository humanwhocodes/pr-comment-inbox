import { describe, expect, it } from 'vitest';
import { extractMentions, mentionsLogin } from './mentions';

describe('extractMentions', () => {
  it('extracts unique case-insensitive mentions', () => {
    expect(extractMentions('Hi @NZaKas and @nzakas and @other-user')).toEqual(['nzakas', 'other-user']);
  });

  it('ignores @mentions inside code blocks and inline code', () => {
    const body = ['```ts', 'const ignored = "@inside-code-block";', '```', 'Use `@inline` and ping @visible'].join('\n');

    expect(extractMentions(body)).toEqual(['visible']);
  });
});

describe('mentionsLogin', () => {
  it('matches login regardless of case', () => {
    expect(mentionsLogin('Thanks @HumanWhoCodes!', 'humanwhocodes')).toBe(true);
  });

  it('returns false when login is not mentioned', () => {
    expect(mentionsLogin('No mentions here', 'humanwhocodes')).toBe(false);
  });
});

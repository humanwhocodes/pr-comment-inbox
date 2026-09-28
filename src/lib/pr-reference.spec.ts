import { describe, expect, it } from 'vitest';
import { parsePrReference, prPath } from './pr-reference';

describe('parsePrReference', () => {
  it('parses full pull request URLs', () => {
    expect(parsePrReference('https://github.com/humanwhocodes/pr-comment-inbox/pull/42')).toEqual({
      owner: 'humanwhocodes',
      repo: 'pr-comment-inbox',
      number: 42,
    });
  });

  it('parses short owner/repo#number references', () => {
    expect(parsePrReference('humanwhocodes/pr-comment-inbox#7')).toEqual({
      owner: 'humanwhocodes',
      repo: 'pr-comment-inbox',
      number: 7,
    });
  });

  it('returns null for invalid references', () => {
    expect(parsePrReference('not-a-reference')).toBeNull();
  });
});

describe('prPath', () => {
  it('builds pull request route paths', () => {
    expect(prPath({ owner: 'humanwhocodes', repo: 'pr-comment-inbox', number: 12 })).toBe(
      '/humanwhocodes/pr-comment-inbox/pull/12',
    );
  });
});

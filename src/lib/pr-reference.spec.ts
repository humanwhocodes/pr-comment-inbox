/**
 * @fileoverview Unit tests for pull-request reference parsing and route building.
 */

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

  it('parses short owner/repo/pull/number references', () => {
    expect(parsePrReference('humanwhocodes/pr-comment-inbox/pull/9')).toEqual({
      owner: 'humanwhocodes',
      repo: 'pr-comment-inbox',
      number: 9,
    });
  });

  it('returns null for invalid references', () => {
    expect(parsePrReference('not-a-reference')).toBeNull();
  });

  it('resolves number-only references against the provided repository', () => {
    const context = { owner: 'humanwhocodes', repo: 'pr-comment-inbox' };
    expect(parsePrReference('#15', context)).toEqual({ owner: 'humanwhocodes', repo: 'pr-comment-inbox', number: 15 });
    expect(parsePrReference(' 16 ', context)).toEqual({ owner: 'humanwhocodes', repo: 'pr-comment-inbox', number: 16 });
  });

  it('returns null for number-only references without a repository', () => {
    expect(parsePrReference('#15')).toBeNull();
  });
});

describe('prPath', () => {
  it('builds pull request route paths', () => {
    expect(prPath({ owner: 'humanwhocodes', repo: 'pr-comment-inbox', number: 12 })).toBe(
      '/humanwhocodes/pr-comment-inbox/pull/12',
    );
  });
});

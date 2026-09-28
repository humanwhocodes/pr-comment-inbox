import { describe, expect, it } from 'vitest';
import { excerpt, parseHunk, storageKey, threadLocation, timeAgo } from './ui';
import type { Thread } from './types';

describe('timeAgo', () => {
  it('formats recent times', () => {
    const now = Date.parse('2026-01-01T00:00:00.000Z');
    expect(timeAgo('2025-12-31T23:59:30.000Z', now)).toBe('just now');
    expect(timeAgo('2025-12-31T23:30:00.000Z', now)).toBe('30m ago');
  });
});

describe('excerpt', () => {
  it('strips markdown formatting and truncates', () => {
    expect(excerpt('**Hello** [world](https://example.com)', 10)).toBe('Hello wor…');
  });
});

describe('parseHunk', () => {
  it('parses unified diff lines with line numbers', () => {
    const parsed = parseHunk(['@@ -1,2 +1,3 @@', ' context', '-old', '+new'].join('\n'));

    expect(parsed).toEqual([
      { type: 'hunk', oldNo: null, newNo: null, text: '@@ -1,2 +1,3 @@' },
      { type: 'context', oldNo: 1, newNo: 1, text: 'context' },
      { type: 'del', oldNo: 2, newNo: null, text: 'old' },
      { type: 'add', oldNo: null, newNo: 2, text: 'new' },
    ]);
  });

  it('tracks line numbers for non-1 offsets with mixed operations', () => {
    const parsed = parseHunk(['@@ -5,3 +8,4 @@', ' shared', '-remove', '+add', ' stay'].join('\n'));

    expect(parsed).toEqual([
      { type: 'hunk', oldNo: null, newNo: null, text: '@@ -5,3 +8,4 @@' },
      { type: 'context', oldNo: 5, newNo: 8, text: 'shared' },
      { type: 'del', oldNo: 6, newNo: null, text: 'remove' },
      { type: 'add', oldNo: null, newNo: 9, text: 'add' },
      { type: 'context', oldNo: 7, newNo: 10, text: 'stay' },
    ]);
  });
});

describe('threadLocation', () => {
  it('formats inline and top-level locations', () => {
    const inlineThread = { kind: 'inline', path: 'src/app.ts', line: 12 } as Thread;
    const topLevelThread = { kind: 'toplevel' } as Thread;

    expect(threadLocation(inlineThread)).toBe('src/app.ts:12');
    expect(threadLocation(topLevelThread)).toBe('Top-level comment');
  });
});

describe('storageKey', () => {
  it('normalizes owner and repo casing', () => {
    expect(storageKey('HumanWhoCodes', 'PR-Comment-Inbox', 5)).toBe('pr-comments:humanwhocodes/pr-comment-inbox#5');
  });
});

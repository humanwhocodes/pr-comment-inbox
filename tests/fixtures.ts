/**
 * @fileoverview Factory helpers that build pull-request, thread, and comment fixtures for tests.
 */

import type { ThreadItem } from '../src/components/Sidebar';
import type { Actor, Comment, InlineThread, PullRequestData, TopLevelThread } from '../src/lib/types';

/**
 * Builds a GitHub actor.
 * @param login Login name for the actor.
 * @returns Actor fixture.
 */
export function makeActor(login = 'reviewer'): Actor {
  return {
    login,
    avatarUrl: `https://avatars.example.com/${login}.png`,
    url: `https://github.com/${login}`,
  };
}

/**
 * Builds a comment.
 * @param overrides Fields to override on the default comment.
 * @returns Comment fixture.
 */
export function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    kind: 'reviewComment',
    author: makeActor('reviewer'),
    authorAssociation: 'NONE',
    body: 'Looks good',
    bodyHTML: '<p>Looks good</p>',
    createdAt: '2026-01-01T00:00:00Z',
    url: 'https://github.com/o/r/pull/1#discussion_r1',
    reactions: [],
    ...overrides,
  };
}

/**
 * Builds an inline review thread.
 * @param overrides Fields to override on the default thread.
 * @returns Inline thread fixture.
 */
export function makeInlineThread(overrides: Partial<InlineThread> = {}): InlineThread {
  return {
    id: 't1',
    kind: 'inline',
    comments: [makeComment()],
    updatedAt: '2026-01-01T00:00:00Z',
    mentions: [],
    path: 'src/index.ts',
    line: 2,
    startLine: null,
    diffSide: 'RIGHT',
    diffHunk: '@@ -1,2 +1,3 @@\n a\n+b\n c',
    isResolved: false,
    isOutdated: false,
    viewerCanResolve: true,
    viewerCanUnresolve: true,
    ...overrides,
  };
}

/**
 * Builds a top-level conversation thread.
 * @param overrides Fields to override on the default thread.
 * @returns Top-level thread fixture.
 */
export function makeTopLevelThread(overrides: Partial<TopLevelThread> = {}): TopLevelThread {
  return {
    id: 'top1',
    kind: 'toplevel',
    comments: [
      makeComment({
        id: 'ic1',
        kind: 'issue',
        author: makeActor('commenter'),
        url: 'https://github.com/o/r/pull/1#issuecomment-123',
      }),
    ],
    updatedAt: '2026-01-01T00:00:00Z',
    mentions: [],
    authorLogin: 'commenter',
    ...overrides,
  };
}

/**
 * Builds pull-request data.
 * @param overrides Fields to override on the default data.
 * @returns Pull-request data fixture.
 */
export function makeData(overrides: Partial<PullRequestData> = {}): PullRequestData {
  return {
    owner: 'o',
    repo: 'r',
    pr: {
      id: 'PR_1',
      number: 1,
      title: 'Add feature',
      url: 'https://github.com/o/r/pull/1',
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'main',
      headRefName: 'feature',
      headRefOid: 'abcdef1234567890',
      headRepositoryOwner: null,
      headRepositoryName: null,
      author: makeActor('author'),
      reviewDecision: null,
      changedFiles: 1,
      additions: 1,
      deletions: 0,
      createdAt: '2026-01-01T00:00:00Z',
    },
    viewer: makeActor('viewer'),
    threads: [makeInlineThread()],
    fetchedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Wraps a thread in a sidebar item.
 * @param thread Thread to wrap.
 * @param overrides Fields to override on the default item.
 * @returns Thread item fixture.
 */
export function makeItem(thread: ThreadItem['thread'] = makeInlineThread(), overrides: Partial<ThreadItem> = {}): ThreadItem {
  return {
    thread,
    isResolved: false,
    isRead: false,
    needsAttention: true,
    isOutdated: false,
    mentionsViewer: false,
    ...overrides,
  };
}

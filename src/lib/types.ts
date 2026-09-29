/**
 * @fileoverview Defines shared application data types for pull requests and threads.
 */

export interface Actor {
  login: string;
  avatarUrl: string;
  url: string;
}

export interface Reaction {
  content: string;
  count: number;
  viewerHasReacted: boolean;
}

export type CommentKind = 'issue' | 'review' | 'reviewComment';

export interface Comment {
  id: string;
  kind: CommentKind;
  author: Actor;
  authorAssociation: string;
  body: string;
  bodyHTML: string;
  createdAt: string;
  url: string;
  reactions: Reaction[];
  /** For review-body comments: the review state that produced them. */
  reviewState?: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
}

export type ThreadKind = 'inline' | 'toplevel';

export interface ThreadBase {
  id: string;
  kind: ThreadKind;
  comments: Comment[];
  /** ISO date of the most recent comment. */
  updatedAt: string;
  /** Logins mentioned anywhere in the thread. */
  mentions: string[];
}

export interface InlineThread extends ThreadBase {
  kind: 'inline';
  path: string;
  line: number | null;
  startLine: number | null;
  diffSide: 'LEFT' | 'RIGHT';
  diffHunk: string;
  isResolved: boolean;
  isOutdated: boolean;
  viewerCanResolve: boolean;
  viewerCanUnresolve: boolean;
  /** Review state of the review that opened the thread, if any. */
  reviewState?: Comment['reviewState'];
}

export interface TopLevelThread extends ThreadBase {
  kind: 'toplevel';
  /** The author whose comments define the thread. */
  authorLogin: string;
}

export type Thread = InlineThread | TopLevelThread;

export interface PullRequestInfo {
  id: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  isDraft: boolean;
  baseRefName: string;
  headRefName: string;
  headRefOid: string;
  headRepositoryOwner: string | null;
  headRepositoryName: string | null;
  author: Actor;
  reviewDecision: string | null;
  changedFiles: number;
  additions: number;
  deletions: number;
  createdAt: string;
}

export interface PullRequestData {
  owner: string;
  repo: string;
  pr: PullRequestInfo;
  viewer: Actor;
  threads: Thread[];
  fetchedAt: string;
  demo?: boolean;
}

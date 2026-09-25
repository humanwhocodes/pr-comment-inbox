import type {
  Actor,
  Comment,
  InlineThread,
  PullRequestData,
  PullRequestInfo,
  Reaction,
  Thread,
  TopLevelThread,
} from './types';
import { extractMentions } from './mentions';

const GRAPHQL_URL = 'https://api.github.com/graphql';
const REST_URL = 'https://api.github.com';
const USER_AGENT = 'pr-comments-inbox';

export class GitHubError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GitHubError(`GitHub API error ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const payload = (await res.json()) as { data?: T; errors?: { message: string; type?: string }[] };
  if (payload.errors?.length) {
    const first = payload.errors[0];
    const status = first.type === 'NOT_FOUND' ? 404 : first.type === 'FORBIDDEN' ? 403 : 400;
    throw new GitHubError(payload.errors.map((e) => e.message).join('; '), status);
  }
  if (!payload.data) throw new GitHubError('Empty GraphQL response', 500);
  return payload.data;
}

export async function rest<T>(
  token: string | null,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': USER_AGENT,
    'x-github-api-version': '2022-11-28',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${REST_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GitHubError(`GitHub API error ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  const ct = res.headers.get('content-type') ?? '';
  return (ct.includes('json') ? await res.json() : await res.text()) as T;
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */

const ACTOR = `login avatarUrl url`;
const REACTIONS = `reactionGroups { content viewerHasReacted reactors { totalCount } }`;

const PR_QUERY = /* GraphQL */ `
  query PullRequestComments($owner: String!, $name: String!, $number: Int!) {
    viewer { ${ACTOR} }
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        id number title url state isDraft baseRefName headRefName headRefOid
        createdAt changedFiles additions deletions reviewDecision
        author { ${ACTOR} }
        comments(first: 100) {
          nodes {
            id author { ${ACTOR} } authorAssociation body bodyHTML createdAt url
            ${REACTIONS}
          }
        }
        reviews(first: 100) {
          nodes {
            id author { ${ACTOR} } authorAssociation body bodyHTML createdAt url state
            ${REACTIONS}
          }
        }
        reviewThreads(first: 100) {
          nodes {
            id isResolved isOutdated path line startLine diffSide
            viewerCanResolve viewerCanUnresolve
            comments(first: 100) {
              nodes {
                id author { ${ACTOR} } authorAssociation body bodyHTML createdAt url
                diffHunk outdated
                pullRequestReview { state }
                ${REACTIONS}
              }
            }
          }
        }
      }
    }
  }
`;

interface RawActor { login: string; avatarUrl: string; url: string }
interface RawReactionGroup { content: string; viewerHasReacted: boolean; reactors: { totalCount: number } }
interface RawIssueComment {
  id: string; author: RawActor | null; authorAssociation: string; body: string; bodyHTML: string;
  createdAt: string; url: string; reactionGroups: RawReactionGroup[];
}
interface RawReview extends RawIssueComment { state: NonNullable<Comment['reviewState']> }
interface RawReviewComment extends RawIssueComment {
  diffHunk: string; outdated: boolean; pullRequestReview: { state: NonNullable<Comment['reviewState']> } | null;
}
interface RawThread {
  id: string; isResolved: boolean; isOutdated: boolean; path: string; line: number | null;
  startLine: number | null; diffSide: 'LEFT' | 'RIGHT'; viewerCanResolve: boolean; viewerCanUnresolve: boolean;
  comments: { nodes: RawReviewComment[] };
}
interface RawPR {
  id: string; number: number; title: string; url: string; state: PullRequestInfo['state']; isDraft: boolean;
  baseRefName: string; headRefName: string; headRefOid: string; createdAt: string; changedFiles: number;
  additions: number; deletions: number; reviewDecision: string | null; author: RawActor | null;
  comments: { nodes: RawIssueComment[] };
  reviews: { nodes: RawReview[] };
  reviewThreads: { nodes: RawThread[] };
}
interface RawPRResponse { viewer: RawActor; repository: { pullRequest: RawPR | null } | null }

const GHOST: Actor = {
  login: 'ghost',
  avatarUrl: 'https://avatars.githubusercontent.com/u/10137?v=4',
  url: 'https://github.com/ghost',
};

function actor(a: RawActor | null): Actor {
  return a ? { login: a.login, avatarUrl: a.avatarUrl, url: a.url } : GHOST;
}

function reactions(groups: RawReactionGroup[] | undefined): Reaction[] {
  return (groups ?? [])
    .filter((g) => g.reactors.totalCount > 0)
    .map((g) => ({ content: g.content, count: g.reactors.totalCount, viewerHasReacted: g.viewerHasReacted }));
}

function issueComment(c: RawIssueComment): Comment {
  return {
    id: c.id,
    kind: 'issue',
    author: actor(c.author),
    authorAssociation: c.authorAssociation,
    body: c.body,
    bodyHTML: c.bodyHTML,
    createdAt: c.createdAt,
    url: c.url,
    reactions: reactions(c.reactionGroups),
  };
}

function reviewComment(r: RawReview): Comment {
  return { ...issueComment(r), kind: 'review', reviewState: r.state };
}

function inlineComment(c: RawReviewComment): Comment {
  return { ...issueComment(c), kind: 'reviewComment', reviewState: c.pullRequestReview?.state };
}

function lastDate(comments: Comment[]): string {
  return comments.reduce((max, c) => (c.createdAt > max ? c.createdAt : max), comments[0]?.createdAt ?? '');
}

function allMentions(comments: Comment[]): string[] {
  const set = new Set<string>();
  for (const c of comments) for (const m of extractMentions(c.body)) set.add(m);
  return [...set];
}

/**
 * Group top-level comments (issue comments + review bodies) into per-author threads:
 * every comment written by the author plus every comment that @-mentions them.
 */
export function buildTopLevelThreads(comments: Comment[]): TopLevelThread[] {
  const sorted = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const threads: TopLevelThread[] = [];
  const seen = new Set<string>();
  for (const c of sorted) {
    const login = c.author.login;
    const key = login.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const members = sorted.filter(
      (x) => x.author.login.toLowerCase() === key || extractMentions(x.body).includes(key),
    );
    threads.push({
      id: `toplevel:${key}`,
      kind: 'toplevel',
      authorLogin: login,
      comments: members,
      updatedAt: lastDate(members),
      mentions: allMentions(members),
    });
  }
  return threads;
}

export function normalize(owner: string, repo: string, raw: RawPRResponse): PullRequestData {
  const pr = raw.repository?.pullRequest;
  if (!pr) throw new GitHubError('Pull request not found', 404);

  const topLevel: Comment[] = [
    ...pr.comments.nodes.map(issueComment),
    ...pr.reviews.nodes.filter((r) => r.body && r.body.trim().length > 0).map(reviewComment),
  ];

  const inline: InlineThread[] = pr.reviewThreads.nodes
    .filter((t) => t.comments.nodes.length > 0)
    .map((t) => {
      const comments = t.comments.nodes.map(inlineComment);
      return {
        id: t.id,
        kind: 'inline',
        path: t.path,
        line: t.line,
        startLine: t.startLine,
        diffSide: t.diffSide,
        diffHunk: t.comments.nodes[0].diffHunk ?? '',
        isResolved: t.isResolved,
        isOutdated: t.isOutdated,
        viewerCanResolve: t.viewerCanResolve,
        viewerCanUnresolve: t.viewerCanUnresolve,
        reviewState: comments[0].reviewState,
        comments,
        updatedAt: lastDate(comments),
        mentions: allMentions(comments),
      };
    });

  const threads: Thread[] = [...inline, ...buildTopLevelThreads(topLevel)];

  return {
    owner,
    repo,
    viewer: actor(raw.viewer),
    pr: {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      isDraft: pr.isDraft,
      baseRefName: pr.baseRefName,
      headRefName: pr.headRefName,
      headRefOid: pr.headRefOid,
      author: actor(pr.author),
      reviewDecision: pr.reviewDecision,
      changedFiles: pr.changedFiles,
      additions: pr.additions,
      deletions: pr.deletions,
      createdAt: pr.createdAt,
    },
    threads,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchPullRequest(token: string, owner: string, repo: string, number: number) {
  const raw = await graphql<RawPRResponse>(token, PR_QUERY, { owner, name: repo, number });
  return normalize(owner, repo, raw);
}

/* ------------------------------------------------------------------ */
/* Mutations                                                           */
/* ------------------------------------------------------------------ */

export async function replyToReviewThread(token: string, threadId: string, body: string) {
  const data = await graphql<{ addPullRequestReviewThreadReply: { comment: { id: string; url: string } } }>(
    token,
    /* GraphQL */ `
      mutation Reply($threadId: ID!, $body: String!) {
        addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
          comment { id url }
        }
      }
    `,
    { threadId, body },
  );
  return data.addPullRequestReviewThreadReply.comment;
}

export async function addIssueComment(token: string, subjectId: string, body: string) {
  const data = await graphql<{ addComment: { commentEdge: { node: { id: string; url: string } } } }>(
    token,
    /* GraphQL */ `
      mutation AddComment($subjectId: ID!, $body: String!) {
        addComment(input: { subjectId: $subjectId, body: $body }) {
          commentEdge { node { id url } }
        }
      }
    `,
    { subjectId, body },
  );
  return data.addComment.commentEdge.node;
}

export async function setThreadResolved(token: string, threadId: string, resolved: boolean) {
  const mutation = resolved
    ? /* GraphQL */ `mutation Resolve($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { id isResolved } } }`
    : /* GraphQL */ `mutation Unresolve($id: ID!) { unresolveReviewThread(input: { threadId: $id }) { thread { id isResolved } } }`;
  const data = await graphql<Record<string, { thread: { id: string; isResolved: boolean } }>>(
    token,
    mutation,
    { id: threadId },
  );
  const key = resolved ? 'resolveReviewThread' : 'unresolveReviewThread';
  return data[key].thread;
}

export async function renderMarkdown(token: string | null, text: string, context?: string) {
  return rest<string>(token, '/markdown', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/html' },
    body: JSON.stringify({ text, mode: 'gfm', context }),
  });
}

export async function exchangeOAuthCode(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': USER_AGENT },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!data.access_token) {
    throw new GitHubError(data.error_description ?? data.error ?? 'OAuth exchange failed', 401);
  }
  return data.access_token;
}

export async function fetchViewer(token: string): Promise<Actor> {
  const data = await graphql<{ viewer: RawActor }>(token, `query { viewer { ${ACTOR} } }`, {});
  return actor(data.viewer);
}

/**
 * @fileoverview Renders pull-request summary metadata and header controls for the app.
 */

import type { PullRequestData } from '../lib/types';
import { ExternalLinkIcon, GitMergeIcon, GitPullRequestIcon, InboxIcon } from './Icons';
import ThemeToggle from './ThemeToggle';

interface Props {
  owner: string;
  repo: string;
  number: number;
  data: PullRequestData | null;
  demo: boolean;
}

function StateBadge({ data }: { data: PullRequestData }) {
  const { pr } = data;
  if (pr.state === 'MERGED') {
    return (
      <span class="badge bg-done-bg px-2 py-1 text-xs text-done">
        <GitMergeIcon size={12} /> Merged
      </span>
    );
  }
  if (pr.state === 'CLOSED') {
    return (
      <span class="badge bg-danger-bg px-2 py-1 text-xs text-danger">
        <GitPullRequestIcon size={12} /> Closed
      </span>
    );
  }
  if (pr.isDraft) {
    return (
      <span class="badge border-border px-2 py-1 text-xs text-fg-muted">
        <GitPullRequestIcon size={12} /> Draft
      </span>
    );
  }
  return (
    <span class="badge bg-success-bg px-2 py-1 text-xs text-success">
      <GitPullRequestIcon size={12} /> Open
    </span>
  );
}

export default function Header({ owner, repo, number, data, demo }: Props) {
  return (
    <header class="flex flex-col border-b border-border">
      <div class="flex items-center gap-3 border-b border-border bg-canvas-subtle px-4 py-2">
        <a href="/" class="flex shrink-0 items-center gap-2 text-fg" title="Home">
          {/* Placeholder logo */}
          <span class="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
            <InboxIcon size={16} />
          </span>
          <span class="text-sm font-semibold">PR Comment Inbox</span>
        </a>
        {demo && <span class="badge bg-attention-bg text-attention">Demo</span>}
        <div class="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {data && (
            <form method="post" action="/api/auth/logout" class="flex items-center gap-2">
              <img src={data.viewer.avatarUrl} alt="" class="h-7 w-7 rounded-full" title={`@${data.viewer.login}`} />
              {!demo && (
                <button type="submit" class="text-xs text-fg-muted hover:text-fg">
                  Sign out
                </button>
              )}
            </form>
          )}
        </div>
      </div>
      <div class="flex items-center gap-4 bg-canvas px-4 py-2.5">
        {data ? (
          <>
            <div class="min-w-0 flex-1">
              <h1 class="truncate text-base font-semibold">
                <a href={data.pr.url} target="_blank" rel="noreferrer" class="hover:text-accent hover:underline">
                  {data.pr.title} <span class="font-normal text-fg-muted">#{number}</span>
                </a>
              </h1>
              <div class="mt-1 flex min-w-0 items-center gap-2 text-xs text-fg-muted">
                <StateBadge data={data} />
                <a
                  href={`https://github.com/${owner}/${repo}`}
                  target="_blank"
                  rel="noreferrer"
                  class="truncate hover:text-accent"
                >
                  {owner}/{repo}
                </a>
                <span class="hidden sm:inline" aria-hidden="true">·</span>
                <span class="hidden truncate font-mono sm:inline">
                  {data.pr.headRefName} → {data.pr.baseRefName}
                </span>
              </div>
            </div>
            <a href={data.pr.url} target="_blank" rel="noreferrer" class="btn btn-sm shrink-0">
              <ExternalLinkIcon size={14} />
              <span class="hidden sm:inline">View on GitHub</span>
            </a>
          </>
        ) : (
          <div class="h-11 w-2/3 animate-pulse rounded bg-canvas-inset" />
        )}
      </div>
    </header>
  );
}

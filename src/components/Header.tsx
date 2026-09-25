import type { PullRequestData } from '../lib/types';
import { ExternalLinkIcon, GitMergeIcon, GitPullRequestIcon, MarkGithubIcon } from './Icons';
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
      <span class="badge border border-border px-2 py-1 text-xs text-fg-muted">
        <GitPullRequestIcon size={12} /> Draft
      </span>
    );
  }
  const decision =
    pr.reviewDecision === 'CHANGES_REQUESTED'
      ? ' (Changes requested)'
      : pr.reviewDecision === 'APPROVED'
        ? ' (Approved)'
        : '';
  return (
    <span class="badge bg-success-bg px-2 py-1 text-xs text-success">
      <GitPullRequestIcon size={12} /> Open{decision}
    </span>
  );
}

export default function Header({ owner, repo, number, data, demo }: Props) {
  return (
    <header class="flex flex-col border-b border-border bg-canvas-subtle">
      <div class="flex items-center gap-3 px-4 py-2">
        <a href="/" class="flex items-center gap-2 text-fg" title="Home">
          <MarkGithubIcon size={24} />
        </a>
        <nav class="flex min-w-0 items-center gap-1 text-sm text-fg-muted" aria-label="Breadcrumb">
          <a href={`https://github.com/${owner}`} target="_blank" rel="noreferrer" class="hover:text-accent">
            {owner}
          </a>
          <span>/</span>
          <a href={`https://github.com/${owner}/${repo}`} target="_blank" rel="noreferrer" class="hover:text-accent">
            {repo}
          </a>
          <span>/</span>
          <span>pull</span>
          <span>/</span>
          <span class="font-semibold text-fg">{number}</span>
        </nav>
        {demo && <span class="badge bg-attention-bg text-attention">Demo</span>}
        <div class="ml-auto flex items-center gap-2">
          {data && (
            <a href={data.pr.url} target="_blank" rel="noreferrer" class="btn btn-sm">
              <ExternalLinkIcon size={14} />
              <span class="hidden sm:inline">View on GitHub</span>
            </a>
          )}
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
      <div class="flex flex-wrap items-center gap-2 px-4 pb-2.5">
        {data ? (
          <>
            <StateBadge data={data} />
            <h1 class="min-w-0 truncate text-base font-semibold">{data.pr.title}</h1>
            <span class="flex items-center gap-1 text-xs text-fg-muted">
              <code class="rounded bg-accent/10 px-1 py-0.5 text-accent">{data.pr.headRefName}</code>
              into
              <code class="rounded bg-accent/10 px-1 py-0.5 text-accent">{data.pr.baseRefName}</code>
            </span>
            <span class="ml-auto hidden items-center gap-3 text-xs text-fg-muted md:flex">
              <span>{data.pr.changedFiles} files changed</span>
              <span class="text-success">+{data.pr.additions}</span>
              <span class="text-danger">-{data.pr.deletions}</span>
            </span>
          </>
        ) : (
          <div class="h-6 w-2/3 animate-pulse rounded bg-canvas-inset" />
        )}
      </div>
    </header>
  );
}

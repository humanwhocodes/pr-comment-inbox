import { useMemo } from 'preact/hooks';
import { threadSourceLines } from '../lib/suggestions';
import type { PullRequestData } from '../lib/types';
import { firstComment, threadLocation } from '../lib/ui';
import CommentCard from './CommentCard';
import CommentEditor from './CommentEditor';
import DiffHunk from './DiffHunk';
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  CommentIcon,
  DoubleCheckIcon,
  ExternalLinkIcon,
  EyeIcon,
  LinkIcon,
  SpinnerIcon,
} from './Icons';
import type { ThreadItem } from './Sidebar';

interface Props {
  item: ThreadItem;
  data: PullRequestData;
  busy: boolean;
  onReply: (body: string, resolve: boolean) => Promise<void>;
  onResolve: (resolved: boolean) => Promise<void>;
  onMarkRead: (read: boolean) => void;
  onBack: () => void;
}

export default function ThreadView({ item, data, busy, onReply, onResolve, onMarkRead, onBack }: Props) {
  const { thread } = item;
  const root = firstComment(thread);
  const inline = thread.kind === 'inline';
  const viewer = data.viewer.login;

  const canResolve = inline && (item.isResolved ? thread.viewerCanUnresolve : thread.viewerCanResolve);

  const changesRequested = inline
    ? thread.reviewState === 'CHANGES_REQUESTED'
    : thread.comments.some((c) => c.kind === 'review' && c.reviewState === 'CHANGES_REQUESTED');

  // Top-level replies only stay in someone else's thread if they @-mention the thread author.
  const requiredMention =
    thread.kind === 'toplevel' && thread.authorLogin.toLowerCase() !== viewer.toLowerCase()
      ? thread.authorLogin
      : undefined;

  const initialReply = useMemo(() => (requiredMention ? `@${requiredMention} ` : ''), [thread.id, viewer]);

  const sourceLines = useMemo(
    () => (thread.kind === 'inline' ? threadSourceLines(thread) : undefined),
    [thread],
  );

  const jumpUrl = inline ? root.url : `${data.pr.url}#issuecomment-${root.url.split('-').pop() ?? ''}`;

  return (
    <div class="flex h-full min-h-0 flex-col">
      <header class="flex flex-wrap items-center gap-2 border-b border-border bg-canvas px-4 py-2.5">
        <button type="button" class="btn btn-sm lg:hidden" onClick={onBack} aria-label="Back to list">
          <ArrowLeftIcon size={14} />
        </button>
        <div class="flex min-w-0 flex-col">
          <div class="flex min-w-0 items-center gap-2 text-sm">
            <span class="truncate font-mono font-medium">{threadLocation(thread)}</span>
            {inline && thread.line != null && (
              <span class="hidden shrink-0 text-xs text-fg-muted sm:inline">
                Line {thread.startLine != null && thread.startLine !== thread.line ? `${thread.startLine}–${thread.line}` : thread.line} · {thread.diffSide === 'LEFT' ? 'base' : 'head'}
              </span>
            )}
          </div>
          <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
            {changesRequested && !item.isResolved && (
              <span class="badge bg-danger-bg text-danger">
                <AlertIcon size={12} /> Changes requested
              </span>
            )}
            {item.isOutdated && <span class="badge border border-border">Outdated</span>}
            {inline ? (
              <span>{item.isResolved ? 'Resolved conversation' : 'Unresolved conversation'}</span>
            ) : (
              <span>Thread with @{thread.authorLogin}: their comments and comments mentioning them</span>
            )}
          </div>
        </div>
        <div class="ml-auto flex flex-wrap items-center gap-1.5">
          <a href={jumpUrl} target="_blank" rel="noreferrer" class="btn btn-sm" title="Open this thread on GitHub">
            <ExternalLinkIcon size={14} />
            <span class="hidden sm:inline">{inline ? 'Jump to file in diff' : 'Open on GitHub'}</span>
          </a>
          <button
            type="button"
            class="btn btn-sm"
            title="Copy permalink"
            onClick={() => navigator.clipboard?.writeText(root.url)}
          >
            <LinkIcon size={14} />
            <span class="hidden sm:inline">Permalink</span>
          </button>
          <button
            type="button"
            class="btn btn-sm"
            title={item.isRead ? 'Mark as unread' : 'Mark as read (hides it from your inbox until there is new activity)'}
            onClick={() => onMarkRead(!item.isRead)}
          >
            {item.isRead ? <EyeIcon size={14} /> : <DoubleCheckIcon size={14} />}
            <span class="hidden sm:inline">{item.isRead ? 'Mark unread' : 'Mark read'}</span>
          </button>
          {inline && (
            <button
              type="button"
              class={`btn btn-sm ${item.isResolved ? '' : 'btn-primary'}`}
              disabled={busy || !canResolve}
              title={item.isResolved ? 'Unresolve this review thread on GitHub' : 'Resolve this review thread on GitHub'}
              onClick={() => void onResolve(!item.isResolved)}
            >
              {busy ? <SpinnerIcon size={14} /> : <CheckCircleIcon size={14} />}
              {item.isResolved ? 'Unresolve' : 'Resolve thread'}
            </button>
          )}
        </div>
      </header>

      <div class="scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-canvas-subtle">
        <div class="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4">
          {item.isResolved && (
            <div class="flex items-center gap-2 rounded-md border border-success/30 bg-success-bg px-3 py-2 text-sm text-success">
              <CheckCircleIcon />
              This conversation is resolved on GitHub.
            </div>
          )}

          {inline && <DiffHunk thread={thread} />}

          <div class="relative flex flex-col gap-3 lg:pl-6">
            <span class="absolute inset-y-4 left-2 hidden w-px bg-border lg:block" aria-hidden="true" />
            {thread.comments.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                viewerLogin={viewer}
                prAuthor={data.pr.author.login}
                sourceLines={sourceLines}
              />
            ))}
          </div>

          <div class="flex items-start gap-3">
            <img src={data.viewer.avatarUrl} alt="" class="mt-1 hidden h-8 w-8 rounded-full lg:block" />
            <div class="min-w-0 flex-1">
              <CommentEditor
                key={thread.id}
                owner={data.owner}
                repo={data.repo}
                initialValue={initialReply}
                placeholder={inline ? 'Reply to this review thread…' : `Reply to @${thread.kind === 'toplevel' ? thread.authorLogin : root.author.login}…`}
                submitLabel={inline ? 'Reply' : 'Comment'}
                submitWithResolveLabel="Reply & resolve"
                canResolve={!item.isResolved && canResolve}
                requiredMention={requiredMention}
                busy={busy}
                onSubmit={onReply}
              />
              {!inline && (
                <p class="mt-1.5 flex items-center gap-1 text-xs text-fg-muted">
                  <CommentIcon size={12} />
                  Posted as a top-level pull request comment. Keep the @mention so it stays in this thread.
                </p>
              )}
              {data.demo && (
                <p class="mt-1.5 text-xs text-attention">Demo mode: replies and resolves are simulated and not sent anywhere.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

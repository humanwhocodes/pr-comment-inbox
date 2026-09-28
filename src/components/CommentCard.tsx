/**
 * @fileoverview Renders a single comment with metadata, markdown content, and reactions.
 */

import { useMemo } from 'preact/hooks';
import { extractSuggestionBlocks, type SourceLine, renderSuggestions } from '../lib/suggestions';
import type { Comment } from '../lib/types';
import { REACTION_EMOJI, associationLabel, longDate, timeAgo } from '../lib/ui';
import { LinkIcon } from './Icons';

interface Props {
  comment: Comment;
  viewerLogin: string;
  /** Login of the author that "owns" this thread, for the Reviewer/Author style badge. */
  threadAuthor?: string;
  prAuthor: string;
  /** For inline threads: the commented lines, which ```suggestion blocks replace. */
  sourceLines?: SourceLine[];
  canAcceptSuggestions?: boolean;
  busy?: boolean;
  onAcceptSuggestion?: (suggestion: string) => void | Promise<void>;
}

function reviewBadge(state: Comment['reviewState']) {
  switch (state) {
    case 'CHANGES_REQUESTED':
      return <span class="badge bg-danger-bg text-danger">Changes requested</span>;
    case 'APPROVED':
      return <span class="badge bg-success-bg text-success">Approved</span>;
    default:
      return null;
  }
}

export default function CommentCard({
  comment,
  viewerLogin,
  prAuthor,
  sourceLines,
  canAcceptSuggestions = false,
  busy = false,
  onAcceptSuggestion,
}: Props) {
  const bodyHTML = useMemo(() => renderSuggestions(comment.bodyHTML, sourceLines), [comment.bodyHTML, sourceLines]);
  const suggestionBlocks = useMemo(() => extractSuggestionBlocks(comment.body), [comment.body]);
  const assoc = associationLabel(comment.authorAssociation);
  const isPrAuthor = comment.author.login.toLowerCase() === prAuthor.toLowerCase();
  const isViewer = comment.author.login.toLowerCase() === viewerLogin.toLowerCase();

  return (
    <article class="rounded-lg border border-border bg-canvas" id={comment.id}>
      <header class="flex flex-wrap items-center gap-2 rounded-t-lg border-b border-border bg-canvas-subtle px-3 py-2 text-sm">
        <a href={comment.author.url} target="_blank" rel="noreferrer" class="flex items-center gap-2">
          <img src={comment.author.avatarUrl} alt="" class="h-6 w-6 rounded-full" loading="lazy" />
          <span class="font-semibold">{comment.author.login}</span>
        </a>
        {assoc && (
          <span class="rounded-full border border-border px-1.5 py-px text-[11px] text-fg-muted">{assoc}</span>
        )}
        <span class="text-fg-muted" title={longDate(comment.createdAt)}>
          commented {timeAgo(comment.createdAt)}
        </span>
        <span class="ml-auto flex items-center gap-2">
          {comment.kind === 'review' && reviewBadge(comment.reviewState)}
          {isPrAuthor && <span class="badge bg-accent/10 text-accent">Author</span>}
          {isViewer && !isPrAuthor && <span class="badge bg-done-bg text-done">You</span>}
          <a
            href={comment.url}
            target="_blank"
            rel="noreferrer"
            class="rounded p-1 text-fg-muted hover:bg-canvas-inset hover:text-fg"
            title="Open on GitHub"
          >
            <LinkIcon size={14} />
          </a>
        </span>
      </header>
      <div class="markdown-body px-3 py-3" dangerouslySetInnerHTML={{ __html: bodyHTML }} />
      {canAcceptSuggestions && suggestionBlocks.length > 0 && onAcceptSuggestion && (
        <div class="flex flex-wrap gap-2 px-3 pb-3">
          {suggestionBlocks.map((suggestion, index) => (
            <button
              key={`${comment.id}:suggestion:${index}`}
              type="button"
              class="btn btn-sm"
              disabled={busy}
              onClick={() => void onAcceptSuggestion(suggestion)}
            >
              {busy ? 'Applying…' : `Apply suggestion${suggestionBlocks.length > 1 ? ` ${index + 1}` : ''}`}
            </button>
          ))}
        </div>
      )}
      {comment.reactions.length > 0 && (
        <footer class="flex flex-wrap gap-1.5 px-3 pb-3">
          {comment.reactions.map((r) => (
            <span
              key={r.content}
              class={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${
                r.viewerHasReacted ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-fg-muted'
              }`}
            >
              <span>{REACTION_EMOJI[r.content] ?? r.content}</span>
              <span>{r.count}</span>
            </span>
          ))}
        </footer>
      )}
    </article>
  );
}

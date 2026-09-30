/**
 * @fileoverview Renders thread filters, sorting controls, and thread list selection UI.
 */

import type { Thread } from '../lib/types';
import { excerpt, firstComment, startsWithDescription, threadLocation, timeAgo } from '../lib/ui';
import {
  AlertIcon,
  CheckCircleIcon,
  CommentIcon,
  DoubleCheckIcon,
  EyeIcon,
  FileCodeIcon,
  GitPullRequestIcon,
  MentionIcon,
  RefreshIcon,
  ReplyIcon,
  SearchIcon,
  SortIcon,
  SpinnerIcon,
  XIcon,
} from './Icons';

export interface ThreadItem {
  thread: Thread;
  isResolved: boolean;
  isRead: boolean;
  /** Unread and either unresolved or active again since the viewer last read it. */
  needsAttention: boolean;
  isOutdated: boolean;
  mentionsViewer: boolean;
}

export type Filter = 'inbox' | 'resolved' | 'outdated' | 'mentions' | 'read' | 'all';
export type Sort = 'unresolved' | 'newest' | 'oldest' | 'file';

export const FILTERS: { key: Filter; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'outdated', label: 'Outdated' },
  { key: 'mentions', label: '@mentions' },
  { key: 'read', label: 'Read' },
  { key: 'all', label: 'All' },
];

export const SORTS: { key: Sort; label: string }[] = [
  { key: 'unresolved', label: 'Unresolved first' },
  { key: 'newest', label: 'Newest activity' },
  { key: 'oldest', label: 'Oldest activity' },
  { key: 'file', label: 'File path' },
];

interface Props {
  items: ThreadItem[];
  counts: Record<Filter, number>;
  total: number;
  filter: Filter;
  setFilter: (f: Filter) => void;
  sort: Sort;
  setSort: (s: Sort) => void;
  search: string;
  setSearch: (s: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  checked: Set<string>;
  onToggleChecked: (id: string) => void;
  onCheckAll: () => void;
  onClearChecked: () => void;
  onMarkRead: (ids: string[], read: boolean) => void;
  fetchedAt: string | null;
  headRef: string | null;
  loading: boolean;
  onRefresh: () => void;
}

function ThreadBadges({ item }: { item: ThreadItem }) {
  const { thread } = item;
  const changesRequested = thread.kind === 'inline'
    ? thread.reviewState === 'CHANGES_REQUESTED'
    : thread.comments.some((c) => c.kind === 'review' && c.reviewState === 'CHANGES_REQUESTED');
  const approved = thread.kind === 'toplevel' && thread.comments.some((c) => c.kind === 'review' && c.reviewState === 'APPROVED');
  const isBot = thread.kind === 'toplevel' && /\[bot\]$|^bot-|-bot$/i.test(thread.authorLogin);

  return (
    <div class="mt-2 flex flex-wrap items-center gap-1.5">
      {item.isResolved && (
        <span class="badge bg-success-bg text-success">
          <CheckCircleIcon size={12} /> Resolved
        </span>
      )}
      {item.mentionsViewer && (
        <span class="badge bg-attention-bg text-attention">
          <MentionIcon size={12} /> Mention
        </span>
      )}
      {item.isOutdated && <span class="badge border-border text-fg-muted">Outdated</span>}
      {!item.isResolved && changesRequested && (
        <span class="badge bg-attention-bg text-attention">
          <AlertIcon size={12} /> Changes requested
        </span>
      )}
      {!item.isResolved && approved && !changesRequested && (
        <span class="badge bg-success-bg text-success">
          <CheckCircleIcon size={12} /> Approved
        </span>
      )}
      {isBot && !changesRequested && !approved && <span class="badge bg-done-bg text-done">Bot comment</span>}
    </div>
  );
}

export default function Sidebar(props: Props) {
  const {
    items, counts, total, filter, setFilter, sort, setSort, search, setSearch, selectedId, onSelect,
    checked, onToggleChecked, onCheckAll, onClearChecked, onMarkRead, fetchedAt, headRef, loading, onRefresh,
  } = props;

  const allChecked = items.length > 0 && items.every((i) => checked.has(i.thread.id));
  const anyChecked = checked.size > 0;
  const checkedItems = items.filter((i) => checked.has(i.thread.id));
  const bulkRead = filter !== 'read';

  return (
    <aside class="flex h-full min-h-0 flex-col border-r border-border bg-canvas">
      <div class="flex flex-col gap-2 border-b border-border p-3">
        <label class="relative block">
          <SearchIcon class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" size={14} />
          <input
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            placeholder="Search comments, files, people"
            class="w-full rounded-md border border-border bg-canvas-subtle py-1.5 pl-8 pr-8 text-sm outline-none focus:border-accent focus:bg-canvas focus:ring-2 focus:ring-accent/30"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-muted hover:text-fg"
              aria-label="Clear search"
            >
              <XIcon size={14} />
            </button>
          )}
        </label>
        <div class="flex items-center gap-2">
          <label class="relative inline-flex items-center">
            <SortIcon class="pointer-events-none absolute left-2 text-fg-muted" size={14} />
            <select
              value={sort}
              onChange={(e) => setSort((e.target as HTMLSelectElement).value as Sort)}
              class="appearance-none rounded-md border border-border bg-canvas-subtle py-1 pl-7 pr-7 text-xs font-medium outline-none hover:bg-canvas-inset focus:ring-2 focus:ring-accent/30"
              aria-label="Sort threads"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            class="btn btn-sm ml-auto"
            title="Refresh from GitHub"
            aria-label="Refresh from GitHub"
          >
            {loading ? <SpinnerIcon size={14} /> : <RefreshIcon size={14} />}
          </button>
        </div>
        <div class="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              class={`chip ${filter === f.key ? 'chip-active' : ''}`}
            >
              {f.label}
              <span class="opacity-70">({counts[f.key]})</span>
            </button>
          ))}
        </div>
        <div class="flex items-center gap-2 pt-1 text-sm">
          <label class="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => (allChecked ? onClearChecked() : onCheckAll())}
              class="h-4 w-4 accent-accent"
              disabled={items.length === 0}
            />
            <span class="text-fg-muted">
              {anyChecked ? `${checked.size} selected` : `Select all (${items.length})`}
            </span>
          </label>
          <button
            type="button"
            disabled={!anyChecked}
            onClick={() => {
              onMarkRead(checkedItems.map((i) => i.thread.id), bulkRead);
              onClearChecked();
            }}
            class="ml-auto inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg disabled:opacity-40"
          >
            {bulkRead ? <DoubleCheckIcon size={14} /> : <EyeIcon size={14} />}
            {bulkRead ? 'Mark read' : 'Mark unread'}
          </button>
        </div>
      </div>

      <ul class="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 && (
          <li class="px-4 py-10 text-center text-sm text-fg-muted">
            {loading ? 'Loading comments…' : total === 0 ? 'This pull request has no comments yet.' : 'Nothing matches this view.'}
          </li>
        )}
        {items.map((item) => {
          const { thread } = item;
          const root = firstComment(thread);
          const active = thread.id === selectedId;
          const isChecked = checked.has(thread.id);
          const replies = thread.comments.length - 1;
          return (
            <li
              key={thread.id}
              class={`group relative border-b border-border-muted ${
                active ? 'bg-accent/5 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-accent' : 'hover:bg-canvas-subtle'
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(thread.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(thread.id);
                  }
                }}
                class="block w-full cursor-pointer px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40"
              >
                <div class="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => onToggleChecked(thread.id)}
                    aria-label={`Select thread by ${root.author.login}`}
                    class={`mt-1.5 h-4 w-4 shrink-0 accent-accent ${isChecked ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
                  />
                  <img src={root.author.avatarUrl} alt="" class="mt-0.5 h-7 w-7 shrink-0 rounded-full" loading="lazy" />
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline gap-1.5">
                      <span class="truncate text-sm font-semibold">{root.author.login}</span>
                      <span class="ml-auto inline-flex shrink-0 items-center gap-1.5 self-center text-xs text-fg-muted">
                        {item.needsAttention && <span class="h-2 w-2 rounded-full bg-accent" title="Unread" />}
                        {timeAgo(thread.updatedAt)}
                      </span>
                    </div>
                    <div class="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
                      {thread.kind === 'inline' ? (
                        <FileCodeIcon size={12} />
                      ) : startsWithDescription(thread) ? (
                        <GitPullRequestIcon size={12} />
                      ) : (
                        <CommentIcon size={12} />
                      )}
                      <span class="truncate font-mono">{threadLocation(thread)}</span>
                    </div>
                    <p class={`line-clamp-2 mt-1.5 text-[13px] leading-snug ${item.isResolved ? 'text-fg-muted' : 'text-fg'}`}>
                      {excerpt(root.body) || '(no text)'}
                    </p>
                    <div class="flex items-end justify-between gap-2">
                      <ThreadBadges item={item} />
                      {replies > 0 && (
                        <span class="mb-0.5 ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-fg-muted">
                          <ReplyIcon size={12} /> {replies} {replies === 1 ? 'reply' : 'replies'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <footer class="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-fg-muted">
        <span>
          Showing {items.length} of {total} {total === 1 ? 'thread' : 'threads'}
        </span>
        {fetchedAt && (
          <span class="inline-flex items-center gap-1" title={headRef ? `Head ${headRef}` : undefined}>
            <CheckCircleIcon size={12} class="text-success" />
            Synced {timeAgo(fetchedAt)}
            {headRef && <span class="font-mono">@ {headRef.slice(0, 7)}</span>}
          </span>
        )}
      </footer>
    </aside>
  );
}

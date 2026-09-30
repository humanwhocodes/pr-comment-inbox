/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the thread list sidebar.
 */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeActor, makeComment, makeInlineThread, makeItem, makeTopLevelThread } from '../../tests/fixtures';
import Sidebar, { type Filter, type ThreadItem } from './Sidebar';

type SidebarProps = Parameters<typeof Sidebar>[0];

const counts: Record<Filter, number> = { inbox: 1, resolved: 2, outdated: 3, mentions: 4, read: 5, all: 6 };

/**
 * Builds sidebar props with sensible defaults.
 * @param overrides Props to override.
 * @returns Sidebar props.
 */
function makeProps(overrides: Partial<SidebarProps> = {}): SidebarProps {
  return {
    items: [makeItem()],
    counts,
    total: 1,
    filter: 'inbox',
    setFilter: vi.fn(),
    sort: 'unresolved',
    setSort: vi.fn(),
    search: '',
    setSearch: vi.fn(),
    selectedId: null,
    onSelect: vi.fn(),
    checked: new Set(),
    onToggleChecked: vi.fn(),
    onCheckAll: vi.fn(),
    onClearChecked: vi.fn(),
    onMarkRead: vi.fn(),
    fetchedAt: null,
    headRef: null,
    loading: false,
    onRefresh: vi.fn(),
    ...overrides,
  };
}

/**
 * Renders the sidebar with a single item and returns its list entry.
 * @param item Item to render.
 * @returns The list item element.
 */
function renderItem(item: ThreadItem): HTMLElement {
  const { container } = render(<Sidebar {...makeProps({ items: [item] })} />);
  return container.querySelector('ul > li')!;
}

/**
 * Returns the "select all" checkbox.
 * @returns Checkbox element.
 */
function selectAll(): HTMLInputElement {
  return screen.getByText(/Select all|selected/).closest('label')!.querySelector('input')!;
}

describe('Sidebar', () => {
  afterEach(() => {
    cleanup();
  });

  describe('controls', () => {
    it('updates the search text', () => {
      const props = makeProps();
      render(<Sidebar {...props} />);
      fireEvent.input(screen.getByPlaceholderText('Search comments, files, people'), { target: { value: 'foo' } });
      expect(props.setSearch).toHaveBeenCalledWith('foo');
      expect(screen.queryByLabelText('Clear search')).toBeNull();
    });

    it('clears a non-empty search', () => {
      const props = makeProps({ search: 'foo' });
      render(<Sidebar {...props} />);
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(props.setSearch).toHaveBeenCalledWith('');
    });

    it('changes the sort order', () => {
      const props = makeProps();
      render(<Sidebar {...props} />);
      fireEvent.change(screen.getByLabelText('Sort threads'), { target: { value: 'file' } });
      expect(props.setSort).toHaveBeenCalledWith('file');
    });

    it('refreshes on demand', () => {
      const props = makeProps();
      render(<Sidebar {...props} />);
      fireEvent.click(screen.getByLabelText('Refresh from GitHub'));
      expect(props.onRefresh).toHaveBeenCalled();
    });

    it('disables refresh while loading', () => {
      render(<Sidebar {...makeProps({ loading: true })} />);
      expect((screen.getByLabelText('Refresh from GitHub') as HTMLButtonElement).disabled).toBe(true);
    });

    it('shows filter counts, highlights the active filter, and changes filters', () => {
      const props = makeProps({ filter: 'resolved' });
      render(<Sidebar {...props} />);
      const resolved = screen.getByText('Resolved', { selector: 'button' });
      expect(resolved.className).toContain('chip-active');
      expect(resolved.textContent).toBe('Resolved(2)');
      expect(screen.getByText('Inbox', { selector: 'button' }).className).not.toContain('chip-active');
      fireEvent.click(screen.getByText('@mentions', { selector: 'button' }));
      expect(props.setFilter).toHaveBeenCalledWith('mentions');
    });
  });

  describe('selection', () => {
    it('checks all items when not all are checked', () => {
      const props = makeProps();
      render(<Sidebar {...props} />);
      expect(screen.getByText('Select all (1)')).toBeTruthy();
      fireEvent.click(selectAll());
      expect(props.onCheckAll).toHaveBeenCalled();
    });

    it('clears the selection when everything is checked', () => {
      const props = makeProps({ checked: new Set(['t1']) });
      render(<Sidebar {...props} />);
      expect(screen.getByText('1 selected')).toBeTruthy();
      expect(selectAll().checked).toBe(true);
      fireEvent.click(selectAll());
      expect(props.onClearChecked).toHaveBeenCalled();
    });

    it('disables select-all when there are no items', () => {
      render(<Sidebar {...makeProps({ items: [], total: 0 })} />);
      expect(selectAll().disabled).toBe(true);
      expect(selectAll().checked).toBe(false);
    });

    it('disables bulk marking when nothing is checked', () => {
      render(<Sidebar {...makeProps()} />);
      expect((screen.getByText('Mark read') as HTMLButtonElement).disabled).toBe(true);
    });

    it('bulk marks checked items as read', () => {
      const other = makeItem(makeInlineThread({ id: 't2' }));
      const props = makeProps({ items: [makeItem(), other], checked: new Set(['t2', 'hidden']) });
      render(<Sidebar {...props} />);
      fireEvent.click(screen.getByText('Mark read'));
      expect(props.onMarkRead).toHaveBeenCalledWith(['t2'], true);
      expect(props.onClearChecked).toHaveBeenCalled();
    });

    it('bulk marks checked items as unread in the read view', () => {
      const props = makeProps({ filter: 'read', checked: new Set(['t1']) });
      render(<Sidebar {...props} />);
      fireEvent.click(screen.getByText('Mark unread'));
      expect(props.onMarkRead).toHaveBeenCalledWith(['t1'], false);
    });

    it('toggles a single item without selecting it', () => {
      const props = makeProps();
      render(<Sidebar {...props} />);
      const box = screen.getByLabelText('Select thread by reviewer') as HTMLInputElement;
      expect(box.className).toContain('opacity-0');
      fireEvent.click(box);
      expect(props.onToggleChecked).toHaveBeenCalledWith('t1');
      expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('shows checked items with a visible checkbox', () => {
      render(<Sidebar {...makeProps({ checked: new Set(['t1']) })} />);
      expect(screen.getByLabelText('Select thread by reviewer').className).not.toContain('opacity-0');
    });

    it('selects an item by click, Enter, or Space but not other keys', () => {
      const props = makeProps();
      render(<Sidebar {...props} />);
      const row = screen.getByRole('button', { name: /reviewer/ });
      fireEvent.click(row);
      fireEvent.keyDown(row, { key: 'Enter' });
      fireEvent.keyDown(row, { key: ' ' });
      fireEvent.keyDown(row, { key: 'a' });
      expect(props.onSelect).toHaveBeenCalledTimes(3);
      expect(props.onSelect).toHaveBeenCalledWith('t1');
    });

    it('highlights the selected item', () => {
      const { container } = render(<Sidebar {...makeProps({ selectedId: 't1' })} />);
      expect(container.querySelector('ul > li')!.className).toContain('bg-accent/5');
    });

    it('does not highlight unselected items', () => {
      const { container } = render(<Sidebar {...makeProps({ selectedId: 'other' })} />);
      expect(container.querySelector('ul > li')!.className).toContain('hover:bg-canvas-subtle');
    });
  });

  describe('empty states', () => {
    it('shows a loading message', () => {
      render(<Sidebar {...makeProps({ items: [], loading: true })} />);
      expect(screen.getByText('Loading comments…')).toBeTruthy();
    });

    it('shows a message when the pull request has no comments', () => {
      render(<Sidebar {...makeProps({ items: [], total: 0 })} />);
      expect(screen.getByText('This pull request has no comments yet.')).toBeTruthy();
    });

    it('shows a message when no threads match the view', () => {
      render(<Sidebar {...makeProps({ items: [], total: 3 })} />);
      expect(screen.getByText('Nothing matches this view.')).toBeTruthy();
    });
  });

  describe('thread rows', () => {
    it('renders inline thread details', () => {
      const li = renderItem(makeItem());
      expect(within(li).getByText('src/index.ts:2')).toBeTruthy();
      expect(within(li).getByText('Looks good').className).toContain('text-fg');
      expect(within(li).getByTitle('Unread').className).toContain('bg-accent');
      expect(within(li).queryByText(/repl(y|ies)/)).toBeNull();
    });

    it('renders top-level thread details', () => {
      const li = renderItem(makeItem(makeTopLevelThread()));
      expect(within(li).getByText('Top-level comment')).toBeTruthy();
      expect(within(li).getByText('commenter')).toBeTruthy();
    });

    it('hides the unread dot for read threads', () => {
      const li = renderItem(makeItem(undefined, { isRead: true, needsAttention: false }));
      expect(within(li).queryByTitle('Unread')).toBeNull();
      expect(within(li).queryByTitle('Read')).toBeNull();
    });

    it('shows a placeholder for comments without text', () => {
      const li = renderItem(makeItem(makeInlineThread({ comments: [makeComment({ body: '' })] })));
      expect(within(li).getByText('(no text)')).toBeTruthy();
    });

    it('counts a single reply', () => {
      const thread = makeInlineThread({ comments: [makeComment(), makeComment({ id: 'c2' })] });
      expect(renderItem(makeItem(thread)).textContent).toContain('1 reply');
    });

    it('counts multiple replies', () => {
      const thread = makeInlineThread({
        comments: [makeComment(), makeComment({ id: 'c2' }), makeComment({ id: 'c3' })],
      });
      expect(renderItem(makeItem(thread)).textContent).toContain('2 replies');
    });

    it('shows resolved, mention, and outdated badges and mutes resolved text', () => {
      const li = renderItem(
        makeItem(makeInlineThread({ reviewState: 'CHANGES_REQUESTED' }), {
          isResolved: true,
          mentionsViewer: true,
          isOutdated: true,
        }),
      );
      expect(within(li).getByText('Resolved')).toBeTruthy();
      expect(within(li).getByText('Mention')).toBeTruthy();
      expect(within(li).getByText('Outdated')).toBeTruthy();
      expect(within(li).queryByText('Changes requested')).toBeNull();
      expect(within(li).getByText('Looks good').className).toContain('text-fg-muted');
    });

    it('shows changes requested for an inline thread', () => {
      const li = renderItem(makeItem(makeInlineThread({ reviewState: 'CHANGES_REQUESTED' })));
      expect(within(li).getByText('Changes requested')).toBeTruthy();
    });

    it('shows changes requested for a top-level review', () => {
      const thread = makeTopLevelThread({
        comments: [
          makeComment({ kind: 'review', reviewState: 'APPROVED' }),
          makeComment({ id: 'c2', kind: 'review', reviewState: 'CHANGES_REQUESTED' }),
        ],
      });
      const li = renderItem(makeItem(thread));
      expect(within(li).getByText('Changes requested')).toBeTruthy();
      expect(within(li).queryByText('Approved')).toBeNull();
    });

    it('shows approved for a top-level approval', () => {
      const thread = makeTopLevelThread({ comments: [makeComment({ kind: 'review', reviewState: 'APPROVED' })] });
      const li = renderItem(makeItem(thread));
      expect(within(li).getByText('Approved')).toBeTruthy();
    });

    it('hides approved once the thread is resolved', () => {
      const thread = makeTopLevelThread({ comments: [makeComment({ kind: 'review', reviewState: 'APPROVED' })] });
      const li = renderItem(makeItem(thread, { isResolved: true }));
      expect(within(li).queryByText('Approved')).toBeNull();
    });

    it.each(['dependabot[bot]', 'bot-helper', 'lint-bot'])('labels %s as a bot', (login) => {
      const thread = makeTopLevelThread({ authorLogin: login, comments: [makeComment({ author: makeActor(login) })] });
      expect(within(renderItem(makeItem(thread))).getByText('Bot comment')).toBeTruthy();
    });

    it('does not label humans as bots', () => {
      const li = renderItem(makeItem(makeTopLevelThread({ authorLogin: 'robot' })));
      expect(within(li).queryByText('Bot comment')).toBeNull();
    });

    it('prefers the approval badge over the bot badge', () => {
      const thread = makeTopLevelThread({
        authorLogin: 'ci[bot]',
        comments: [makeComment({ kind: 'review', reviewState: 'APPROVED' })],
      });
      const li = renderItem(makeItem(thread));
      expect(within(li).getByText('Approved')).toBeTruthy();
      expect(within(li).queryByText('Bot comment')).toBeNull();
    });

    it('prefers the changes-requested badge over the bot badge', () => {
      const thread = makeTopLevelThread({
        authorLogin: 'ci[bot]',
        comments: [makeComment({ kind: 'review', reviewState: 'CHANGES_REQUESTED' })],
      });
      expect(within(renderItem(makeItem(thread))).queryByText('Bot comment')).toBeNull();
    });
  });

  describe('footer', () => {
    it('uses singular wording for one thread and hides sync info without a fetch time', () => {
      render(<Sidebar {...makeProps()} />);
      expect(screen.getByText('Showing 1 of 1 thread')).toBeTruthy();
      expect(screen.queryByText(/Synced/)).toBeNull();
    });

    it('uses plural wording for multiple threads', () => {
      render(<Sidebar {...makeProps({ total: 4 })} />);
      expect(screen.getByText('Showing 1 of 4 threads')).toBeTruthy();
    });

    it('shows the sync time and short head SHA', () => {
      render(<Sidebar {...makeProps({ fetchedAt: new Date().toISOString(), headRef: 'abcdef1234567890' })} />);
      expect(screen.getByText('@ abcdef1')).toBeTruthy();
      expect(screen.getByTitle('Head abcdef1234567890').textContent).toContain('Synced just now');
    });

    it('shows the sync time without a head SHA', () => {
      const { container } = render(<Sidebar {...makeProps({ fetchedAt: new Date().toISOString() })} />);
      expect(screen.getByText(/Synced/)).toBeTruthy();
      expect(container.querySelector('footer [title]')).toBeNull();
      expect(screen.queryByText(/^@ /)).toBeNull();
    });
  });
});

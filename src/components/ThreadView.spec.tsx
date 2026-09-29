/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the thread detail pane.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeActor, makeComment, makeData, makeInlineThread, makeItem, makeTopLevelThread } from '../../tests/fixtures';
import type { ThreadItem } from './Sidebar';
import ThreadView from './ThreadView';

type ThreadViewProps = Parameters<typeof ThreadView>[0];

const suggestionComment = makeComment({ id: 'sc1', body: '```suggestion\nnew\n```' });

/**
 * Builds thread view props with sensible defaults.
 * @param item Thread item to display.
 * @param overrides Props to override.
 * @returns Thread view props.
 */
function makeProps(item: ThreadItem = makeItem(), overrides: Partial<ThreadViewProps> = {}): ThreadViewProps {
  return {
    item,
    data: makeData(),
    busy: false,
    onReply: vi.fn().mockResolvedValue(undefined),
    onResolve: vi.fn().mockResolvedValue(undefined),
    onAcceptSuggestion: vi.fn().mockResolvedValue(undefined),
    onMarkRead: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}

/**
 * Returns the resolve/unresolve button.
 * @returns Button element.
 */
function resolveButton(): HTMLButtonElement {
  return screen.getByTitle(/resolve this review thread on GitHub/i) as HTMLButtonElement;
}

describe('ThreadView', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('inline threads', () => {
    it('renders the location, diff, comments, and reply editor', () => {
      const { container } = render(<ThreadView {...makeProps()} />);
      expect(screen.getByText('src/index.ts:2')).toBeTruthy();
      expect(screen.getByText(/^Line 2 · head$/)).toBeTruthy();
      expect(screen.getByText('Unresolved conversation')).toBeTruthy();
      expect(screen.getByText('Jump to file in diff').closest('a')?.getAttribute('href')).toBe(
        'https://github.com/o/r/pull/1#discussion_r1',
      );
      expect(container.querySelector('.diff-line')).toBeTruthy();
      expect(screen.getByText('Looks good')).toBeTruthy();
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).placeholder).toBe('Reply to this review thread…');
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
      expect(screen.getByText('Reply')).toBeTruthy();
      expect(screen.getByText('Resolve conversation')).toBeTruthy();
      expect(screen.queryByText(/Posted as a top-level/)).toBeNull();
      expect(screen.queryByText(/Demo mode/)).toBeNull();
      expect(screen.queryByText('This conversation is resolved on GitHub.')).toBeNull();
    });

    it('shows a line range on the base side', () => {
      render(<ThreadView {...makeProps(makeItem(makeInlineThread({ startLine: 1, line: 3, diffSide: 'LEFT' })))} />);
      expect(screen.getByText(/^Line 1–3 · base$/)).toBeTruthy();
    });

    it('shows a single line when the range starts and ends on the same line', () => {
      render(<ThreadView {...makeProps(makeItem(makeInlineThread({ startLine: 2, line: 2 })))} />);
      expect(screen.getByText(/^Line 2 · head$/)).toBeTruthy();
    });

    it('omits the line label when the thread has no line', () => {
      render(<ThreadView {...makeProps(makeItem(makeInlineThread({ line: null })))} />);
      expect(screen.queryByText(/^Line /)).toBeNull();
    });

    it('shows changes requested and outdated badges', () => {
      const thread = makeInlineThread({ reviewState: 'CHANGES_REQUESTED' });
      render(<ThreadView {...makeProps(makeItem(thread, { isOutdated: true }))} />);
      expect(screen.getByText('Changes requested')).toBeTruthy();
      expect(screen.getByText('Outdated')).toBeTruthy();
    });

    it('resolves an unresolved thread', () => {
      const props = makeProps();
      render(<ThreadView {...props} />);
      expect(resolveButton().textContent).toBe('Resolve thread');
      expect(resolveButton().className).toContain('btn-primary');
      fireEvent.click(resolveButton());
      expect(props.onResolve).toHaveBeenCalledWith(true);
    });

    it('unresolves a resolved thread and hides changes requested', () => {
      const thread = makeInlineThread({ reviewState: 'CHANGES_REQUESTED' });
      const props = makeProps(makeItem(thread, { isResolved: true }));
      render(<ThreadView {...props} />);
      expect(screen.getByText('Resolved conversation')).toBeTruthy();
      expect(screen.getByText('This conversation is resolved on GitHub.')).toBeTruthy();
      expect(screen.queryByText('Changes requested')).toBeNull();
      expect(screen.queryByText('Resolve conversation')).toBeNull();
      expect(resolveButton().textContent).toBe('Unresolve');
      fireEvent.click(resolveButton());
      expect(props.onResolve).toHaveBeenCalledWith(false);
    });

    it('disables resolving without permission', () => {
      render(<ThreadView {...makeProps(makeItem(makeInlineThread({ viewerCanResolve: false })))} />);
      expect(resolveButton().disabled).toBe(true);
      expect(screen.queryByText('Resolve conversation')).toBeNull();
    });

    it('disables unresolving without permission', () => {
      const thread = makeInlineThread({ viewerCanUnresolve: false });
      render(<ThreadView {...makeProps(makeItem(thread, { isResolved: true }))} />);
      expect(resolveButton().disabled).toBe(true);
    });

    it('disables resolving and shows a spinner while busy', () => {
      render(<ThreadView {...makeProps(undefined, { busy: true })} />);
      expect(resolveButton().disabled).toBe(true);
      expect(resolveButton().querySelector('.animate-spin')).toBeTruthy();
    });

    it('offers suggestions and forwards the comment id', () => {
      const props = makeProps(makeItem(makeInlineThread({ comments: [suggestionComment] })));
      render(<ThreadView {...props} />);
      fireEvent.click(screen.getByText('Apply suggestion'));
      expect(props.onAcceptSuggestion).toHaveBeenCalledWith('sc1', 'new\n');
    });

    it.each([
      ['outdated', { isOutdated: true }],
      ['on the base side', { diffSide: 'LEFT' as const }],
      ['without a line', { line: null }],
    ])('does not offer suggestions when the thread is %s', (_label, overrides) => {
      const thread = makeInlineThread({ comments: [suggestionComment], ...overrides });
      render(<ThreadView {...makeProps(makeItem(thread))} />);
      expect(screen.queryByText('Apply suggestion')).toBeNull();
    });

    it('forwards replies', async () => {
      const props = makeProps();
      render(<ThreadView {...props} />);
      fireEvent.input(screen.getByRole('textbox'), { target: { value: 'thanks' } });
      await act(async () => {
        fireEvent.click(screen.getByText('Reply'));
      });
      expect(props.onReply).toHaveBeenCalledWith('thanks', false);
    });
  });

  describe('top-level threads', () => {
    it('renders thread details and prefills the required mention', () => {
      const { container } = render(<ThreadView {...makeProps(makeItem(makeTopLevelThread()))} />);
      expect(screen.getByText('Top-level comment')).toBeTruthy();
      expect(screen.getByText(/Thread with @commenter/)).toBeTruthy();
      expect(screen.getByText('Open on GitHub', { selector: 'span' }).closest('a')?.getAttribute('href')).toBe(
        'https://github.com/o/r/pull/1#issuecomment-123',
      );
      expect(container.querySelector('.diff-line')).toBeNull();
      expect(screen.queryByTitle(/resolve this review thread/i)).toBeNull();
      expect(screen.queryByText(/^Line /)).toBeNull();
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('@commenter ');
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).placeholder).toBe('Reply to @commenter…');
      expect(screen.getByText('Comment')).toBeTruthy();
      expect(screen.queryByText('Resolve conversation')).toBeNull();
      expect(screen.getByText(/Posted as a top-level pull request comment/)).toBeTruthy();
    });

    it('does not require a mention in the viewer’s own thread', () => {
      const thread = makeTopLevelThread({ authorLogin: 'Viewer', comments: [makeComment({ author: makeActor('viewer') })] });
      render(<ThreadView {...makeProps(makeItem(thread))} />);
      expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    });

    it('shows changes requested from a review comment', () => {
      const thread = makeTopLevelThread({ comments: [makeComment({ kind: 'review', reviewState: 'CHANGES_REQUESTED' })] });
      render(<ThreadView {...makeProps(makeItem(thread))} />);
      expect(screen.getByText('Changes requested', { selector: 'header .flex-wrap > .badge' })).toBeTruthy();
    });

    it('does not show changes requested for other reviews', () => {
      const thread = makeTopLevelThread({
        comments: [makeComment({ kind: 'review', reviewState: 'APPROVED' }), makeComment({ id: 'c2', kind: 'issue' })],
      });
      render(<ThreadView {...makeProps(makeItem(thread))} />);
      expect(screen.queryByText('Changes requested', { selector: 'header .flex-wrap > .badge' })).toBeNull();
    });

    it('shows the pull request description as the start of the author thread', () => {
      const thread = makeTopLevelThread({
        authorLogin: 'author',
        comments: [
          makeComment({
            id: 'description:PR_1',
            kind: 'description',
            author: makeActor('author'),
            bodyHTML: '<p>Full PR description</p>',
            url: 'https://github.com/o/r/pull/1',
          }),
        ],
      });
      render(<ThreadView {...makeProps(makeItem(thread))} />);
      expect(screen.getByText('Pull request description')).toBeTruthy();
      expect(screen.getByText('Full PR description')).toBeTruthy();
      expect(screen.getByText(/^opened this pull request/)).toBeTruthy();
      expect(screen.getByTitle('Open this thread on GitHub').getAttribute('href')).toBe('https://github.com/o/r/pull/1');
    });

    it('handles a comment URL without an id segment', () => {
      const thread = makeTopLevelThread({ comments: [makeComment({ url: 'noid' })] });
      render(<ThreadView {...makeProps(makeItem(thread))} />);
      expect(screen.getByTitle('Open this thread on GitHub').getAttribute('href')).toBe(
        'https://github.com/o/r/pull/1#issuecomment-noid',
      );
    });
  });

  describe('shared actions', () => {
    it('goes back to the list', () => {
      const props = makeProps();
      render(<ThreadView {...props} />);
      fireEvent.click(screen.getByLabelText('Back to list'));
      expect(props.onBack).toHaveBeenCalled();
    });

    it('copies the permalink when the clipboard is available', () => {
      const writeText = vi.fn();
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      render(<ThreadView {...makeProps()} />);
      fireEvent.click(screen.getByTitle('Copy permalink'));
      expect(writeText).toHaveBeenCalledWith('https://github.com/o/r/pull/1#discussion_r1');
    });

    it('does nothing when the clipboard is unavailable', () => {
      vi.stubGlobal('navigator', {});
      render(<ThreadView {...makeProps()} />);
      expect(() => fireEvent.click(screen.getByTitle('Copy permalink'))).not.toThrow();
    });

    it('marks an unread thread as read', () => {
      const props = makeProps();
      render(<ThreadView {...props} />);
      fireEvent.click(screen.getByText('Mark read'));
      expect(props.onMarkRead).toHaveBeenCalledWith(true);
    });

    it('marks a read thread as unread', () => {
      const props = makeProps(makeItem(undefined, { isRead: true }));
      render(<ThreadView {...props} />);
      expect(screen.getByTitle('Mark as unread')).toBeTruthy();
      fireEvent.click(screen.getByText('Mark unread'));
      expect(props.onMarkRead).toHaveBeenCalledWith(false);
    });

    it('shows the demo notice in demo mode', () => {
      render(<ThreadView {...makeProps(undefined, { data: makeData({ demo: true }) })} />);
      expect(screen.getByText(/Demo mode: replies and resolves are simulated/)).toBeTruthy();
    });
  });
});

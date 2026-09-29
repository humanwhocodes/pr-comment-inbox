/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the comment card.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeActor, makeComment } from '../../tests/fixtures';
import type { Comment } from '../lib/types';
import CommentCard from './CommentCard';

/**
 * Renders a comment card with sensible defaults.
 * @param comment Fields to override on the comment.
 * @param props Extra props for the card.
 * @returns Render result.
 */
function renderCard(comment: Partial<Comment> = {}, props: Partial<Parameters<typeof CommentCard>[0]> = {}) {
  return render(<CommentCard comment={makeComment(comment)} viewerLogin="viewer" prAuthor="author" {...props} />);
}

const suggestionBody = 'Try this:\n```suggestion\nconst b = 2;\n```\n';

describe('CommentCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders author, body, and permalink for a plain comment', () => {
    const { container } = renderCard();
    expect(screen.getByText('reviewer')).toBeTruthy();
    expect(screen.getByText('Looks good')).toBeTruthy();
    expect(screen.getByText(/^commented/)).toBeTruthy();
    expect(screen.getByTitle('Open on GitHub').getAttribute('href')).toBe('https://github.com/o/r/pull/1#discussion_r1');
    expect(container.querySelector('article')?.className).toContain('border-border');
    expect(container.querySelector('article')?.id).toBe('c1');
  });

  it('describes the pull request description as opening the pull request', () => {
    renderCard({ kind: 'description', author: makeActor('author') });
    expect(screen.getByText(/^opened this pull request/)).toBeTruthy();
    expect(screen.getByText('Author')).toBeTruthy();
  });

  it('shows the author association label when known', () => {
    renderCard({ authorAssociation: 'MEMBER' });
    expect(screen.getByText('Member')).toBeTruthy();
  });

  it('omits the association label when unknown', () => {
    renderCard({ authorAssociation: 'NONE' });
    expect(screen.queryByText('Member')).toBeNull();
    expect(screen.queryByText('Owner')).toBeNull();
  });

  it.each([
    ['APPROVED', 'Approved', 'approved these changes', 'border-success/50'],
    ['CHANGES_REQUESTED', 'Changes requested', 'requested changes', 'border-attention/50'],
    ['COMMENTED', 'Review comment', 'reviewed', 'border-border'],
  ] as const)('renders a %s review with its badge and verb', (reviewState, label, action, border) => {
    const { container } = renderCard({ kind: 'review', reviewState });
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(new RegExp(`^${action}`))).toBeTruthy();
    expect(container.querySelector('article')?.className).toContain(border);
    expect(container.querySelector('.badge svg')).toBeTruthy();
  });

  it('marks comments by the PR author', () => {
    renderCard({ author: makeActor('Author') });
    expect(screen.getByText('Author', { selector: '.badge' })).toBeTruthy();
    expect(screen.queryByText('You')).toBeNull();
  });

  it('marks comments by the viewer', () => {
    renderCard({ author: makeActor('Viewer') });
    expect(screen.getByText('You')).toBeTruthy();
  });

  it('shows only the Author badge when the viewer is the PR author', () => {
    render(<CommentCard comment={makeComment({ author: makeActor('author') })} viewerLogin="author" prAuthor="author" />);
    expect(screen.getByText('Author', { selector: '.badge' })).toBeTruthy();
    expect(screen.queryByText('You')).toBeNull();
  });

  it('renders reactions with emoji, counts, and viewer state', () => {
    const { container } = renderCard({
      reactions: [
        { content: 'THUMBS_UP', count: 3, viewerHasReacted: true },
        { content: 'UNKNOWN', count: 1, viewerHasReacted: false },
      ],
    });
    const chips = container.querySelectorAll('footer > span');
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toBe('👍3');
    expect(chips[0].className).toContain('text-accent');
    expect(chips[1].textContent).toBe('UNKNOWN1');
    expect(chips[1].className).toContain('text-fg-muted');
  });

  it('omits the reactions footer when there are none', () => {
    const { container } = renderCard();
    expect(container.querySelector('footer')).toBeNull();
  });

  it('rewrites suggestion blocks against the source lines', () => {
    const { container } = renderCard(
      { body: suggestionBody, bodyHTML: '<pre><code class="language-suggestion">const b = 2;\n</code></pre>' },
      { sourceLines: [{ no: 2, text: 'const a = 1;' }] },
    );
    expect(container.querySelector('.suggestion')).toBeTruthy();
    expect(container.querySelector('.suggestion .diff-del')?.textContent).toContain('const a = 1;');
    expect(container.querySelector('.suggestion .diff-add')?.textContent).toContain('const b = 2;');
  });

  it('shows a single apply button and passes the suggestion to the handler', () => {
    const onAcceptSuggestion = vi.fn();
    renderCard({ body: suggestionBody }, { canAcceptSuggestions: true, onAcceptSuggestion });
    fireEvent.click(screen.getByText('Apply suggestion'));
    expect(onAcceptSuggestion).toHaveBeenCalledWith('const b = 2;\n');
  });

  it('numbers apply buttons when there are multiple suggestions', () => {
    const onAcceptSuggestion = vi.fn();
    renderCard(
      { body: `${suggestionBody}\n\`\`\`suggestion\nconst c = 3;\n\`\`\`\n` },
      { canAcceptSuggestions: true, onAcceptSuggestion },
    );
    fireEvent.click(screen.getByText('Apply suggestion 2'));
    expect(screen.getByText('Apply suggestion 1')).toBeTruthy();
    expect(onAcceptSuggestion).toHaveBeenCalledWith('const c = 3;\n');
  });

  it('disables apply buttons while busy', () => {
    renderCard({ body: suggestionBody }, { canAcceptSuggestions: true, busy: true, onAcceptSuggestion: vi.fn() });
    expect((screen.getByText('Applying…') as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides apply buttons when suggestions cannot be accepted', () => {
    renderCard({ body: suggestionBody }, { canAcceptSuggestions: false, onAcceptSuggestion: vi.fn() });
    expect(screen.queryByText('Apply suggestion')).toBeNull();
  });

  it('hides apply buttons when there are no suggestion blocks', () => {
    renderCard({}, { canAcceptSuggestions: true, onAcceptSuggestion: vi.fn() });
    expect(screen.queryByText('Apply suggestion')).toBeNull();
  });

  it('hides apply buttons when there is no handler', () => {
    renderCard({ body: suggestionBody }, { canAcceptSuggestions: true });
    expect(screen.queryByText('Apply suggestion')).toBeNull();
  });
});

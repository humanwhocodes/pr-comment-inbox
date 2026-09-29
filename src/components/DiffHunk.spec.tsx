/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the diff hunk viewer.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { makeInlineThread } from '../../tests/fixtures';
import type { InlineThread } from '../lib/types';
import DiffHunk from './DiffHunk';

const HUNK = ['@@ -1,4 +1,4 @@', ' one', '-two', '+TWO', ' three', ' four', '\\ No newline at end of file'].join('\n');

/**
 * Renders a diff hunk for a thread built from the given overrides.
 * @param overrides Fields to override on the inline thread.
 * @returns Render result.
 */
function renderHunk(overrides: Partial<InlineThread> = {}) {
  return render(<DiffHunk thread={makeInlineThread({ diffHunk: HUNK, ...overrides })} />);
}

/**
 * Returns the rendered diff line rows.
 * @param container Render container.
 * @returns Diff line elements.
 */
function rows(container: Element) {
  return Array.from(container.querySelectorAll('.diff-line'));
}

describe('DiffHunk', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows only the commented line on the right side by default', () => {
    const { container } = renderHunk({ line: 2 });
    const lines = rows(container);
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toContain('TWO');
    expect(lines[0].className).toContain('diff-add');
    expect(lines[0].className).toContain('diff-target');
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.queryByText('-1')).toBeNull();
  });

  it('uses old line numbers for threads on the left side', () => {
    const { container } = renderHunk({ line: 2, diffSide: 'LEFT' });
    const lines = rows(container);
    expect(lines).toHaveLength(1);
    expect(lines[0].className).toContain('diff-del');
    expect(lines[0].querySelector('.diff-line-marker')?.textContent).toBe('-');
    expect(screen.getByText('-1')).toBeTruthy();
  });

  it('highlights a multi-line range and marks only the last line as the target', () => {
    const { container } = renderHunk({ startLine: 1, line: 3 });
    const lines = rows(container);
    expect(lines).toHaveLength(3);
    expect(lines[0].className).toContain('bg-accent/5');
    expect(lines[0].className).not.toContain('diff-target');
    expect(lines[2].className).toContain('diff-target');
  });

  it('falls back to the tail of the hunk when line numbers do not match', () => {
    const { container } = renderHunk({ startLine: 50, line: 51 });
    const lines = rows(container);
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toContain('four');
    expect(lines[1].className).not.toContain('diff-add');
  });

  it('falls back to the last line when the thread has no line', () => {
    const { container } = renderHunk({ line: null });
    const lines = rows(container);
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toContain('No newline at end of file');
  });

  it('toggles surrounding context', () => {
    const { container } = renderHunk({ line: 2 });
    fireEvent.click(screen.getByText('Show 6 more lines of context'));
    const lines = rows(container);
    expect(lines).toHaveLength(7);
    expect(lines[0].className).toContain('diff-hunk');
    expect(lines[0].querySelector('.diff-line-content')?.className).toContain('text-fg-muted');
    expect(lines.some((l) => l.className.includes('diff-del'))).toBe(true);
    expect(screen.getByText('-1')).toBeTruthy();
    fireEvent.click(screen.getByText('Hide context'));
    expect(rows(container)).toHaveLength(1);
  });

  it('uses singular wording for one hidden line', () => {
    renderHunk({ diffHunk: ' a\n b', line: 2 });
    expect(screen.getByText('Show 1 more line of context')).toBeTruthy();
  });

  it('hides the context toggle when nothing is hidden', () => {
    renderHunk({ diffHunk: ' a', line: 0 });
    expect(screen.queryByText(/more line/)).toBeNull();
  });

  it('collapses and expands the diff body', () => {
    const { container } = renderHunk({ line: 2 });
    fireEvent.click(screen.getByLabelText('Collapse diff'));
    expect(rows(container)).toHaveLength(0);
    expect(screen.queryByText(/more lines of context/)).toBeNull();
    fireEvent.click(screen.getByLabelText('Expand diff'));
    expect(rows(container)).toHaveLength(1);
  });

  it('shows an empty-state message when there are no diff lines', () => {
    renderHunk({ diffHunk: '@@ -1,1 +1,1 @@', line: null });
    expect(screen.getByText('No diff context available.')).toBeTruthy();
  });

  it.each([
    ['src/index.ts', 'TypeScript'],
    ['README.md', 'Markdown'],
    ['Makefile', 'MAKEFILE'],
    ['archive.zip', 'ZIP'],
    ['weird.', 'Text'],
  ])('labels %s as %s', (path, label) => {
    renderHunk({ path, line: 2 });
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText(path)).toBeTruthy();
  });
});

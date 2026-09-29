/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the markdown reply editor.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommentEditor from './CommentEditor';

type EditorProps = Parameters<typeof CommentEditor>[0];

/**
 * Builds editor props with sensible defaults.
 * @param overrides Props to override.
 * @returns Editor props.
 */
function makeProps(overrides: Partial<EditorProps> = {}): EditorProps {
  return {
    owner: 'o',
    repo: 'r',
    submitLabel: 'Reply',
    submitWithResolveLabel: 'Reply & resolve',
    canResolve: false,
    busy: false,
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Returns the editor textarea.
 * @returns Textarea element.
 */
function textarea(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

/**
 * Replaces the textarea value and optionally selects a range.
 * @param value New textarea value.
 * @param start Selection start (defaults to end of value).
 * @param end Selection end (defaults to start).
 * @returns {void}
 */
function type(value: string, start = value.length, end = start) {
  fireEvent.input(textarea(), { target: { value } });
  textarea().setSelectionRange(start, end);
}

/**
 * Waits for pending animation frames to run.
 * @returns Promise that resolves after the next frame.
 */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('CommentEditor', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('writing', () => {
    it('uses the default placeholder and disables submit when empty', () => {
      render(<CommentEditor {...makeProps()} />);
      expect(textarea().placeholder).toBe('Leave a comment');
      expect((screen.getByText('Reply') as HTMLButtonElement).disabled).toBe(true);
    });

    it('uses a custom placeholder and initial value', () => {
      render(<CommentEditor {...makeProps({ placeholder: 'Say hi', initialValue: 'hello' })} />);
      expect(textarea().placeholder).toBe('Say hi');
      expect(textarea().value).toBe('hello');
      expect((screen.getByText('Reply') as HTMLButtonElement).disabled).toBe(false);
    });

    it('resets its value when the initial value changes', () => {
      const props = makeProps({ initialValue: 'one' });
      const { rerender } = render(<CommentEditor {...props} />);
      type('edited');
      rerender(<CommentEditor {...props} initialValue="two" />);
      expect(textarea().value).toBe('two');
    });

    it('disables the textarea and submit button while busy', () => {
      render(<CommentEditor {...makeProps({ busy: true, initialValue: 'hi' })} />);
      expect(textarea().disabled).toBe(true);
      expect((screen.getByText('Reply') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('formatting tools', () => {
    it('wraps the selection with inline markers and reselects the text', async () => {
      render(<CommentEditor {...makeProps()} />);
      type('make this bold', 10, 14);
      fireEvent.click(screen.getByLabelText('Bold (Ctrl+B)'));
      expect(textarea().value).toBe('make this **bold**');
      await nextFrame();
      expect(textarea().selectionStart).toBe(12);
      expect(textarea().selectionEnd).toBe(16);
    });

    it('inserts markers with no closing part', () => {
      render(<CommentEditor {...makeProps()} />);
      type('hi ');
      fireEvent.click(screen.getByLabelText('Mention a user'));
      expect(textarea().value).toBe('hi @');
    });

    it('prefixes each selected line', () => {
      render(<CommentEditor {...makeProps()} />);
      type('intro\none\ntwo', 7, 13);
      fireEvent.click(screen.getByLabelText('Bulleted list'));
      expect(textarea().value).toBe('intro\n- one\n- two');
    });

    it('removes an existing line prefix', () => {
      render(<CommentEditor {...makeProps()} />);
      type('> quoted', 3);
      fireEvent.click(screen.getByLabelText('Quote'));
      expect(textarea().value).toBe('quoted');
    });

    it.each([
      ['Heading', '### x'],
      ['Italic (Ctrl+I)', '_x_'],
      ['Code (Ctrl+E)', '`x`'],
      ['Link (Ctrl+K)', '[x](url)'],
      ['Numbered list', '1. x'],
      ['Task list', '- [ ] x'],
    ])('applies the %s tool', (label, expected) => {
      render(<CommentEditor {...makeProps()} />);
      type('x', 0, 1);
      fireEvent.click(screen.getByLabelText(label));
      expect(textarea().value).toBe(expected);
    });
  });

  describe('keyboard shortcuts', () => {
    it.each([
      ['b', { ctrlKey: true }, '**x**'],
      ['I', { ctrlKey: true }, '_x_'],
      ['e', { metaKey: true }, '`x`'],
      ['k', { ctrlKey: true }, '[x](url)'],
    ])('formats with mod+%s', (key, mods, expected) => {
      render(<CommentEditor {...makeProps()} />);
      type('x', 0, 1);
      fireEvent.keyDown(textarea(), { key, ...mods });
      expect(textarea().value).toBe(expected);
    });

    it('ignores unbound shortcuts and unmodified keys', () => {
      render(<CommentEditor {...makeProps()} />);
      type('x', 0, 1);
      fireEvent.keyDown(textarea(), { key: 'z', ctrlKey: true });
      fireEvent.keyDown(textarea(), { key: 'b' });
      fireEvent.keyDown(textarea(), { key: 'Enter' });
      expect(textarea().value).toBe('x');
    });

    it('submits with Ctrl+Enter', async () => {
      const props = makeProps();
      render(<CommentEditor {...props} />);
      type('  hello  ');
      await act(async () => {
        fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true });
      });
      expect(props.onSubmit).toHaveBeenCalledWith('hello', false);
    });
  });

  describe('submitting', () => {
    it('submits the trimmed body and clears the editor', async () => {
      const props = makeProps();
      render(<CommentEditor {...props} />);
      type('hello');
      await act(async () => {
        fireEvent.click(screen.getByText('Reply'));
      });
      expect(props.onSubmit).toHaveBeenCalledWith('hello', false);
      expect(textarea().value).toBe('');
    });

    it('does not submit an empty body', async () => {
      const props = makeProps();
      render(<CommentEditor {...props} />);
      type('   ');
      await act(async () => {
        fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true });
      });
      expect(props.onSubmit).not.toHaveBeenCalled();
    });

    it('does not submit while busy', async () => {
      const props = makeProps({ busy: true, initialValue: 'hi' });
      render(<CommentEditor {...props} />);
      await act(async () => {
        fireEvent.keyDown(textarea(), { key: 'Enter', ctrlKey: true });
      });
      expect(props.onSubmit).not.toHaveBeenCalled();
    });

    it('shows the error and keeps the text when submitting fails', async () => {
      const props = makeProps({ onSubmit: vi.fn().mockRejectedValue(new Error('Nope')) });
      render(<CommentEditor {...props} />);
      type('hello');
      await act(async () => {
        fireEvent.click(screen.getByText('Reply'));
      });
      expect(screen.getByText('Nope')).toBeTruthy();
      expect(textarea().value).toBe('hello');
    });

    it('hides the resolve checkbox when resolving is not allowed', () => {
      render(<CommentEditor {...makeProps()} />);
      expect(screen.queryByText('Resolve conversation')).toBeNull();
    });

    it('submits with resolve when the checkbox is checked', async () => {
      const props = makeProps({ canResolve: true });
      render(<CommentEditor {...props} />);
      type('done');
      fireEvent.click(screen.getByRole('checkbox'));
      expect(screen.getByText('Reply & resolve')).toBeTruthy();
      await act(async () => {
        fireEvent.click(screen.getByText('Reply & resolve'));
      });
      expect(props.onSubmit).toHaveBeenCalledWith('done', true);
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
      expect(screen.getByText('Reply')).toBeTruthy();
    });
  });

  describe('required mention', () => {
    it('warns when the reply drops the required mention', () => {
      render(<CommentEditor {...makeProps({ requiredMention: 'alice' })} />);
      type('hello');
      expect(screen.getByRole('status').textContent).toContain("doesn't mention @alice");
    });

    it('does not warn when the mention is present', () => {
      render(<CommentEditor {...makeProps({ requiredMention: 'alice' })} />);
      type('@Alice hello');
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('does not warn when the reply is empty', () => {
      render(<CommentEditor {...makeProps({ requiredMention: 'alice' })} />);
      expect(screen.queryByRole('status')).toBeNull();
    });
  });

  describe('preview', () => {
    it('shows a placeholder for an empty preview without fetching', () => {
      render(<CommentEditor {...makeProps()} />);
      fireEvent.click(screen.getByText('preview'));
      expect(screen.getByText('Nothing to preview.')).toBeTruthy();
      expect(screen.queryByLabelText('Bold (Ctrl+B)')).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('renders the markdown returned by the server', async () => {
      fetchMock.mockResolvedValue(new Response('<p><strong>hi</strong></p>'));
      const { container } = render(<CommentEditor {...makeProps()} />);
      type('**hi**');
      fireEvent.click(screen.getByText('preview'));
      expect(screen.getByText('Rendering preview…')).toBeTruthy();
      await waitFor(() => expect(container.querySelector('.markdown-body strong')?.textContent).toBe('hi'));
      expect(fetchMock).toHaveBeenCalledWith('/api/markdown', expect.objectContaining({ method: 'POST' }));
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: '**hi**', context: 'o/r' });
    });

    it('shows the server error message when rendering fails', async () => {
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Bad markdown' }), { status: 400 }));
      render(<CommentEditor {...makeProps()} />);
      type('hi');
      fireEvent.click(screen.getByText('preview'));
      await waitFor(() => expect(screen.getByText('Bad markdown')).toBeTruthy());
    });

    it('falls back to the status text when the error body is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('oops', { status: 500, statusText: 'Server Error' }));
      render(<CommentEditor {...makeProps()} />);
      type('hi');
      fireEvent.click(screen.getByText('preview'));
      await waitFor(() => expect(screen.getByText('Server Error')).toBeTruthy());
    });

    it('ignores a successful response that arrives after leaving the preview', async () => {
      let resolve!: (r: Response) => void;
      fetchMock.mockReturnValue(new Promise<Response>((r) => (resolve = r)));
      const { container } = render(<CommentEditor {...makeProps()} />);
      type('hi');
      fireEvent.click(screen.getByText('preview'));
      fireEvent.click(screen.getByText('write'));
      await act(async () => {
        resolve(new Response('<p>late</p>'));
      });
      fireEvent.click(screen.getByText('preview'));
      expect(container.querySelector('.markdown-body')?.innerHTML ?? '').not.toContain('late');
    });

    it('ignores a failure that arrives after leaving the preview', async () => {
      let reject!: (e: Error) => void;
      fetchMock
        .mockReturnValueOnce(new Promise<Response>((_r, rj) => (reject = rj)))
        .mockReturnValue(new Promise<Response>(() => {}));
      render(<CommentEditor {...makeProps()} />);
      type('hi');
      fireEvent.click(screen.getByText('preview'));
      fireEvent.click(screen.getByText('write'));
      await act(async () => {
        reject(new Error('late failure'));
      });
      fireEvent.click(screen.getByText('preview'));
      expect(screen.queryByText('late failure')).toBeNull();
    });
  });
});

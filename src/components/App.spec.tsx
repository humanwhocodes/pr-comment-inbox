/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the inbox app shell: loading, filtering, sorting, and thread actions.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeActor, makeComment, makeData, makeInlineThread, makeTopLevelThread } from '../../tests/fixtures';
import type { PullRequestData } from '../lib/types';
import App from './App';

const API = '/api/pr/o/r/1';
const STORAGE_KEY = 'pr-comments:o/r#1';

type Handler = (init?: RequestInit) => Response | Promise<Response>;

let handlers: Record<string, Handler>;
let fetchMock: ReturnType<typeof vi.fn>;

/**
 * Creates a JSON response.
 * @param body Value to serialize.
 * @param init Response options.
 * @returns JSON response.
 */
function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init });
}

/**
 * Returns the fetch calls made to a URL.
 * @param url URL to look for.
 * @returns Matching fetch calls.
 */
function callsTo(url: string): [string, RequestInit | undefined][] {
  return fetchMock.mock.calls.filter(([u]) => u === url) as [string, RequestInit | undefined][];
}

/**
 * Parses the JSON body of the most recent call to a URL.
 * @param url URL to look for.
 * @returns Parsed request body.
 */
function lastBody(url: string): Record<string, unknown> {
  const calls = callsTo(url);
  return JSON.parse(String(calls[calls.length - 1][1]?.body));
}

/**
 * Waits for Preact's deferred (after-paint) effects to run.
 * @returns Promise that resolves once pending effects have flushed.
 */
async function flushEffects() {
  await act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)));
}

/**
 * Renders the app and waits for the initial load to finish.
 * @param demo Whether to render in demo mode.
 * @returns Promise that resolves once the data has loaded.
 */
async function renderApp(demo = false) {
  render(<App owner="o" repo="r" number={1} demo={demo} />);
  await screen.findByText(/^Synced/);
  // Preact runs effects after paint, so wait for the auto-select effect to pick a thread.
  await waitFor(() => expect(screen.queryByText('Select a thread to read it.')).toBeNull());
}

/**
 * Returns the author logins of the listed threads, in order.
 * @returns Author logins.
 */
function listed(): string[] {
  return Array.from(document.querySelectorAll('aside ul > li .font-semibold')).map((e) => e.textContent ?? '');
}

/**
 * Returns the location label of the thread shown in the detail pane.
 * @returns Location text, or null when no thread is shown.
 */
function selectedLocation(): string | null {
  return document.querySelector('main header .font-mono')?.textContent ?? null;
}

/**
 * Clicks a filter chip.
 * @param label Chip label.
 * @returns {void}
 */
function chooseFilter(label: string) {
  fireEvent.click(screen.getByText(label, { selector: 'aside button' }));
}

/**
 * Types into the reply editor and submits it.
 * @param text Reply text.
 * @param resolve Whether to tick "Resolve conversation" first.
 * @returns Promise that resolves once the submission settles.
 */
async function submitReply(text: string, resolve = false) {
  // The editor resets to its initial value in an effect; let it run before typing.
  await flushEffects();
  fireEvent.input(screen.getByPlaceholderText(/^Reply to/), { target: { value: text } });
  if (resolve) {
    fireEvent.click(screen.getByText('Resolve conversation'));
  }
  await act(async () => {
    fireEvent.keyDown(screen.getByPlaceholderText(/^Reply to/), { key: 'Enter', ctrlKey: true });
  });
}

/**
 * Builds six threads that cover every filter and sort key.
 * - alice: inline b.ts:10, outdated, 01-03
 * - bob: inline b.ts:2, resolved, 01-07
 * - carol: top-level, mentions viewer, 01-02
 * - dave: top-level, read, 01-04
 * - erin: inline a.ts (no line), 01-05
 * - frank: inline a.ts:3, 01-06
 * @returns Pull request data.
 */
function richData(): PullRequestData {
  const c = (login: string, body = `note from ${login}`) =>
    makeComment({ id: `${login}-c`, author: makeActor(login), body, bodyHTML: `<p>${body}</p>` });
  return makeData({
    threads: [
      makeInlineThread({ id: 'A', path: 'b.ts', line: 10, isOutdated: true, updatedAt: '2026-01-03T00:00:00Z', comments: [c('alice')] }),
      makeInlineThread({ id: 'B', path: 'b.ts', line: 2, isResolved: true, updatedAt: '2026-01-07T00:00:00Z', comments: [c('bob')] }),
      makeTopLevelThread({ id: 'C', authorLogin: 'carol', mentions: ['viewer'], updatedAt: '2026-01-02T00:00:00Z', comments: [c('carol')] }),
      makeTopLevelThread({ id: 'D', authorLogin: 'dave', updatedAt: '2026-01-04T00:00:00Z', comments: [c('dave', 'unique phrase')] }),
      makeInlineThread({ id: 'E', path: 'a.ts', line: null, updatedAt: '2026-01-05T00:00:00Z', comments: [c('erin')] }),
      makeInlineThread({ id: 'F', path: 'a.ts', line: 3, updatedAt: '2026-01-06T00:00:00Z', comments: [c('frank')] }),
    ],
  });
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    handlers = { [API]: () => json(makeData()) };
    fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const handler = handlers[url];
      if (!handler) {
        throw new Error(`Unexpected fetch: ${url}`);
      }
      return handler(init);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe('loading', () => {
    it('shows a loading state before data arrives', async () => {
      let resolve!: (r: Response) => void;
      handlers[API] = () => new Promise((r) => (resolve = r));
      render(<App owner="o" repo="r" number={1} demo={false} />);
      expect(screen.getByText('Loading pull request from GitHub…')).toBeTruthy();
      expect(screen.getByText('Loading comments…')).toBeTruthy();
      await act(async () => {
        resolve(json(makeData()));
      });
      await waitFor(() => expect(screen.queryByText('Loading pull request from GitHub…')).toBeNull());
    });

    it('loads the pull request and selects the first thread', async () => {
      await renderApp();
      expect(callsTo(API)[0][1]).toEqual({ headers: { accept: 'application/json' } });
      expect(selectedLocation()).toBe('src/index.ts:2');
      expect(screen.getByText('@ abcdef1')).toBeTruthy();
    });

    it('encodes the owner and repo in the API path', async () => {
      handlers['/api/pr/a%2Fb/c%20d/2'] = () => json(makeData());
      render(<App owner="a/b" repo="c d" number={2} demo={false} />);
      await screen.findByText(/^Synced/);
    });

    it('shows the API error message and retries', async () => {
      handlers[API] = () => json({ error: 'Rate limited' }, { status: 429 });
      render(<App owner="o" repo="r" number={1} demo={false} />);
      expect(await screen.findByText('Rate limited')).toBeTruthy();
      expect(screen.queryByText('Sign in again')).toBeNull();
      handlers[API] = () => json(makeData());
      fireEvent.click(screen.getByText('Retry'));
      await screen.findByText(/^Synced/);
      expect(screen.queryByText('Rate limited')).toBeNull();
    });

    it('falls back to the HTTP status and offers sign-in for auth errors', async () => {
      handlers[API] = () => new Response('nope', { status: 401, statusText: 'Unauthorized' });
      render(<App owner="o" repo="r" number={1} demo={false} />);
      expect(await screen.findByText('401 Unauthorized')).toBeTruthy();
      expect(screen.getByText('Sign in again').getAttribute('href')).toMatch(/^\/\?next=/);
      expect(screen.getByText('No comment threads on this pull request yet.')).toBeTruthy();
    });

    it('shows network errors', async () => {
      handlers[API] = () => {
        throw new Error('Network down');
      };
      render(<App owner="o" repo="r" number={1} demo={false} />);
      expect(await screen.findByText('Network down')).toBeTruthy();
    });

    it('refreshes from the sidebar', async () => {
      await renderApp();
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Refresh from GitHub'));
      });
      expect(callsTo(API)).toHaveLength(2);
    });

    it('shows an empty state when there are no threads', async () => {
      handlers[API] = () => json(makeData({ threads: [] }));
      await renderApp();
      expect(screen.getByText('No comment threads on this pull request yet.')).toBeTruthy();
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      handlers[API] = () => json(richData());
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ read: { D: '2026-01-04T00:00:00Z' } }));
    });

    it('computes counts for every filter', async () => {
      await renderApp();
      const chip = (label: string) => screen.getByText(label, { selector: 'aside button' }).textContent;
      expect(chip('Inbox')).toBe('Inbox(4)');
      expect(chip('Resolved')).toBe('Resolved(1)');
      expect(chip('Outdated')).toBe('Outdated(1)');
      expect(chip('@mentions')).toBe('@mentions(1)');
      expect(chip('Read')).toBe('Read(1)');
      expect(chip('All')).toBe('All(6)');
    });

    it.each([
      ['Inbox', ['frank', 'erin', 'alice', 'carol']],
      ['Resolved', ['bob']],
      ['Outdated', ['alice']],
      ['@mentions', ['carol']],
      ['Read', ['dave']],
      ['All', ['frank', 'erin', 'dave', 'alice', 'carol', 'bob']],
    ])('shows the %s threads', async (label, expected) => {
      await renderApp();
      chooseFilter(label);
      expect(listed()).toEqual(expected);
    });

    it('resurfaces a resolved thread with activity since it was read', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ read: { B: '2026-01-01T00:00:00Z' } }));
      await renderApp();
      expect(listed()).toContain('bob');
    });

    it('treats malformed stored state as empty', async () => {
      localStorage.setItem(STORAGE_KEY, '{}');
      await renderApp();
      expect(listed()).toContain('dave');
    });

    it.each([
      ['a.ts', ['frank', 'erin']],
      ['CAROL', ['carol']],
      ['unique phrase', ['dave']],
      ['  ', ['frank', 'erin', 'dave', 'alice', 'carol', 'bob']],
    ])('searches for %j', async (query, expected) => {
      await renderApp();
      chooseFilter('All');
      fireEvent.input(screen.getByPlaceholderText('Search comments, files, people'), { target: { value: query } });
      expect(listed()).toEqual(expected);
    });

    it('explains an empty view', async () => {
      await renderApp();
      fireEvent.input(screen.getByPlaceholderText('Search comments, files, people'), { target: { value: 'zzz' } });
      expect(listed()).toEqual([]);
      expect(screen.getByText(/When you select a comment on the left/)).toBeTruthy();
    });

    it('clears checked threads when the filter changes', async () => {
      await renderApp();
      fireEvent.click(screen.getByLabelText('Select thread by alice'));
      expect(screen.getByText('1 selected')).toBeTruthy();
      chooseFilter('All');
      expect(screen.getByText('Select all (6)')).toBeTruthy();
    });
  });

  describe('sorting', () => {
    beforeEach(() => {
      handlers[API] = () => json(richData());
    });

    it.each([
      ['unresolved', ['frank', 'erin', 'dave', 'alice', 'carol', 'bob']],
      ['newest', ['bob', 'frank', 'erin', 'dave', 'alice', 'carol']],
      ['oldest', ['carol', 'alice', 'dave', 'erin', 'frank', 'bob']],
      ['file', ['erin', 'frank', 'bob', 'alice', 'carol', 'dave']],
    ])('sorts by %s', async (sort, expected) => {
      await renderApp();
      chooseFilter('All');
      fireEvent.change(screen.getByLabelText('Sort threads'), { target: { value: sort } });
      expect(listed()).toEqual(expected);
    });
  });

  describe('selection and read state', () => {
    beforeEach(() => {
      handlers[API] = () => json(richData());
    });

    it('opens a clicked thread and returns to the list on mobile', async () => {
      await renderApp();
      const listWrapper = document.querySelector('aside')!.parentElement!;
      expect(listWrapper.className).toContain('block');
      fireEvent.click(screen.getByRole('button', { name: /carol/ }));
      expect(selectedLocation()).toBe('Top-level comment');
      expect(listWrapper.className).toContain('hidden lg:block');
      fireEvent.click(screen.getByLabelText('Back to list'));
      expect(listWrapper.className).not.toContain('hidden');
    });

    it('advances to the next thread after marking the current one read', async () => {
      await renderApp();
      expect(selectedLocation()).toBe('a.ts:3');
      fireEvent.click(screen.getByText('Mark read', { selector: 'main span' }));
      expect(selectedLocation()).toBe('a.ts');
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).read).toEqual({ F: '2026-01-06T00:00:00Z' });
    });

    it('moves to the previous thread when the last one is marked read', async () => {
      await renderApp();
      fireEvent.click(screen.getByRole('button', { name: /carol/ }));
      fireEvent.click(screen.getByText('Mark read', { selector: 'main span' }));
      expect(selectedLocation()).toBe('b.ts:10');
    });

    it('stays put when marking the only thread read', async () => {
      handlers[API] = () => json(makeData());
      await renderApp();
      chooseFilter('All');
      fireEvent.click(screen.getByText('Mark read', { selector: 'main span' }));
      expect(selectedLocation()).toBe('src/index.ts:2');
      expect(screen.getByText('Mark unread', { selector: 'main span' })).toBeTruthy();
    });

    it('stays put when the selected thread is hidden by search', async () => {
      await renderApp();
      fireEvent.click(screen.getByRole('button', { name: /carol/ }));
      fireEvent.input(screen.getByPlaceholderText('Search comments, files, people'), { target: { value: 'frank' } });
      fireEvent.click(screen.getByText('Mark read', { selector: 'main span' }));
      expect(selectedLocation()).toBe('Top-level comment');
    });

    it('marks a thread unread without changing the selection', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ read: { D: '2026-01-04T00:00:00Z' } }));
      await renderApp();
      chooseFilter('All');
      fireEvent.click(screen.getByRole('button', { name: /dave/ }));
      fireEvent.click(screen.getByText('Mark unread', { selector: 'main span' }));
      expect(selectedLocation()).toBe('Top-level comment');
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).read).toEqual({});
    });

    it('bulk selects, toggles, and marks threads read', async () => {
      await renderApp();
      fireEvent.click(screen.getByText('Select all (5)').closest('label')!.querySelector('input')!);
      expect(screen.getByText('5 selected')).toBeTruthy();
      fireEvent.click(screen.getByLabelText('Select thread by alice'));
      expect(screen.getByText('4 selected')).toBeTruthy();
      fireEvent.click(screen.getByLabelText('Select thread by alice'));
      expect(screen.getByText('5 selected')).toBeTruthy();
      fireEvent.click(screen.getByText('Mark read', { selector: 'aside button' }));
      expect(listed()).toEqual([]);
      expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)!).read).sort()).toEqual(['A', 'C', 'D', 'E', 'F']);
    });

    it('clears a full selection from the select-all checkbox', async () => {
      await renderApp();
      const box = () => document.querySelector<HTMLInputElement>('aside label.cursor-pointer input')!;
      fireEvent.click(box());
      fireEvent.click(box());
      expect(screen.getByText('Select all (5)')).toBeTruthy();
    });

    it('keeps working when storage is unavailable', async () => {
      const setItem = vi.fn(() => {
        throw new Error('quota');
      });
      vi.stubGlobal('localStorage', { getItem: () => null, setItem });
      await renderApp();
      fireEvent.click(screen.getByText('Mark read', { selector: 'main span' }));
      expect(setItem).toHaveBeenCalled();
      expect(selectedLocation()).toBe('a.ts');
    });
  });

  describe('resolving', () => {
    it('resolves a thread and marks it read', async () => {
      handlers[`${API}/resolve`] = () => json({ isResolved: true });
      await renderApp();
      chooseFilter('All');
      await act(async () => {
        fireEvent.click(screen.getByText('Resolve thread'));
      });
      await screen.findByText('This conversation is resolved on GitHub.');
      expect(lastBody(`${API}/resolve`)).toEqual({ threadId: 't1', resolved: true });
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).read).toEqual({ t1: '2026-01-01T00:00:00Z' });
    });

    it('unresolves a thread without marking it read', async () => {
      handlers[API] = () =>
        json(
          makeData({
            threads: [makeInlineThread({ isResolved: true }), makeTopLevelThread()],
          }),
        );
      handlers[`${API}/resolve`] = () => json({ isResolved: false });
      await renderApp();
      chooseFilter('All');
      fireEvent.click(screen.getByRole('button', { name: /reviewer/ }));
      await act(async () => {
        fireEvent.click(screen.getByText('Unresolve'));
      });
      await screen.findByText('Unresolved conversation');
      expect(lastBody(`${API}/resolve`)).toEqual({ threadId: 't1', resolved: false });
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('replying', () => {
    it('posts a reply, reloads, and marks the thread read', async () => {
      handlers[`${API}/reply`] = () => json({ id: 'new', url: 'https://example.com/new' });
      await renderApp();
      const updated = makeData({ threads: [makeInlineThread({ updatedAt: '2026-02-01T00:00:00Z' })] });
      handlers[API] = () => json(updated);
      await submitReply('thanks');
      await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull());
      expect(lastBody(`${API}/reply`)).toEqual({ kind: 'inline', threadId: 't1', pullRequestId: 'PR_1', body: 'thanks' });
      expect(callsTo(API)).toHaveLength(2);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).read).toEqual({ t1: '2026-02-01T00:00:00Z' });
    });

    it('keeps the previous data when the reload fails', async () => {
      handlers[`${API}/reply`] = () => json({ id: 'new', url: 'u' });
      await renderApp();
      handlers[API] = () => json({ error: 'boom' }, { status: 500 });
      await submitReply('thanks');
      await screen.findByText('boom');
      await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull());
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).read).toEqual({ t1: '2026-01-01T00:00:00Z' });
    });

    it('skips marking read when the thread disappears after reloading', async () => {
      handlers[`${API}/reply`] = () => json({ id: 'new', url: 'u' });
      await renderApp();
      handlers[API] = () => json(makeData({ threads: [] }));
      await submitReply('thanks');
      await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull());
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).read).toEqual({});
    });

    it('replies and resolves in one step', async () => {
      handlers[`${API}/reply`] = () => json({ id: 'new', url: 'u' });
      handlers[`${API}/resolve`] = () => json({ isResolved: true });
      await renderApp();
      await submitReply('fixed', true);
      await waitFor(() => expect(callsTo(`${API}/resolve`)).toHaveLength(1));
      expect(lastBody(`${API}/resolve`)).toEqual({ threadId: 't1', resolved: true });
    });

    it('shows the error when resolving after replying fails', async () => {
      handlers[`${API}/reply`] = () => json({ id: 'new', url: 'u' });
      handlers[`${API}/resolve`] = () => json({ error: 'Cannot resolve' }, { status: 403 });
      await renderApp();
      await submitReply('fixed', true);
      await screen.findByText('Cannot resolve');
      expect((screen.getByPlaceholderText(/^Reply to/) as HTMLTextAreaElement).value).toBe('fixed');
    });

    it('shows the error when the reply fails', async () => {
      handlers[`${API}/reply`] = () => json({ error: 'Reply failed' }, { status: 500 });
      await renderApp();
      await submitReply('thanks');
      await screen.findByText('Reply failed');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    describe('in demo mode', () => {
      beforeEach(() => {
        handlers[API] = () =>
          json(makeData({ demo: true, threads: [makeTopLevelThread(), makeInlineThread({ updatedAt: '2025-01-01T00:00:00Z' })] }));
        handlers[`${API}/reply`] = () => json({ id: 'demo-reply', url: 'https://example.com/demo' });
      });

      it('appends the rendered reply locally without reloading', async () => {
        handlers['/api/markdown'] = () => new Response('<p><em>rendered</em></p>');
        await renderApp(true);
        await submitReply('@commenter hi');
        await waitFor(() => expect(document.querySelector('main em')?.textContent).toBe('rendered'));
        await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull());
        expect(callsTo(API)).toHaveLength(1);
        expect(lastBody('/api/markdown')).toEqual({ text: '@commenter hi' });
        expect(lastBody(`${API}/reply`).kind).toBe('toplevel');
        expect(Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEY)!).read)).toEqual(['top1']);
      });

      it('escapes the reply when markdown rendering fails', async () => {
        handlers['/api/markdown'] = () => new Response('', { status: 500 });
        await renderApp(true);
        await submitReply('@commenter a < b & c\nnext');
        await waitFor(() => expect(document.querySelectorAll('main article')).toHaveLength(2));
        const last = Array.from(document.querySelectorAll('main article .markdown-body')).pop()!;
        expect(last.innerHTML).toBe('<p>@commenter a &lt; b &amp; c<br>next</p>');
      });

      it('escapes the reply when the markdown request throws', async () => {
        handlers['/api/markdown'] = () => {
          throw new Error('offline');
        };
        await renderApp(true);
        await submitReply('@commenter hi');
        await waitFor(() => expect(document.querySelectorAll('main article')).toHaveLength(2));
        const last = Array.from(document.querySelectorAll('main article .markdown-body')).pop()!;
        expect(last.innerHTML).toBe('<p>@commenter hi</p>');
      });

      it('adds inline replies as review comments', async () => {
        handlers['/api/markdown'] = () => new Response('<p>ok</p>');
        await renderApp(true);
        fireEvent.click(screen.getByRole('button', { name: /reviewer/ }));
        await submitReply('ok');
        await screen.findByText('You');
        expect(lastBody(`${API}/reply`).kind).toBe('inline');
      });
    });
  });

  describe('accepting suggestions', () => {
    const suggestionThread = (overrides = {}) =>
      makeInlineThread({ comments: [makeComment({ id: 'sc', body: '```suggestion\nnew\n```' })], ...overrides });

    it('applies a suggestion to the PR branch and reloads', async () => {
      handlers[API] = () => json(makeData({ threads: [suggestionThread()] }));
      handlers[`${API}/suggestion`] = () => json({ ok: true });
      await renderApp();
      await act(async () => {
        fireEvent.click(screen.getByText('Apply suggestion'));
      });
      expect(lastBody(`${API}/suggestion`)).toEqual({
        owner: 'o',
        repo: 'r',
        branch: 'feature',
        path: 'src/index.ts',
        startLine: 2,
        endLine: 2,
        suggestion: 'new\n',
        author: 'reviewer',
      });
      expect(callsTo(API)).toHaveLength(2);
    });

    it('targets the head repository and full line range for forks', async () => {
      const data = makeData({ threads: [suggestionThread({ startLine: 1, line: 3 })] });
      data.pr.headRepositoryOwner = 'fork-owner';
      data.pr.headRepositoryName = 'fork-repo';
      handlers[API] = () => json(data);
      handlers[`${API}/suggestion`] = () => json({ ok: true });
      await renderApp();
      await act(async () => {
        fireEvent.click(screen.getByText('Apply suggestion'));
      });
      expect(lastBody(`${API}/suggestion`)).toMatchObject({ owner: 'fork-owner', repo: 'fork-repo', startLine: 1, endLine: 3 });
    });

    it('shows an error banner when applying fails', async () => {
      handlers[API] = () => json(makeData({ threads: [suggestionThread()] }));
      handlers[`${API}/suggestion`] = () => json({ error: 'Conflict' }, { status: 409 });
      await renderApp();
      await act(async () => {
        fireEvent.click(screen.getByText('Apply suggestion'));
      });
      await waitFor(() => expect(screen.getByText('Conflict')).toBeTruthy());
      expect(callsTo(API)).toHaveLength(1);
    });
  });
});

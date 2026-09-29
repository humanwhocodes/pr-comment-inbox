/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the pull-request picker form.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PrPicker from './PrPicker';

describe('PrPicker', () => {
  let href: string;

  beforeEach(() => {
    href = '';
    vi.stubGlobal('location', {
      get href() {
        return href;
      },
      set href(value: string) {
        href = value;
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  /**
   * Types a value into the picker input and submits the form.
   * @param value Text to enter.
   * @returns {void}
   */
  function submit(value: string) {
    const input = screen.getByLabelText('Open a pull request');
    fireEvent.input(input, { target: { value } });
    fireEvent.submit(input.closest('form')!);
  }

  it('navigates to a pull request entered as a full URL', () => {
    render(<PrPicker />);
    submit('https://github.com/humanwhocodes/pr-comments/pull/42');
    expect(href).toBe('/humanwhocodes/pr-comments/pull/42');
  });

  it('resolves #number against the current repository', () => {
    render(<PrPicker current={{ owner: 'humanwhocodes', repo: 'pr-comments', number: 1 }} />);
    submit('#7');
    expect(href).toBe('/humanwhocodes/pr-comments/pull/7');
  });

  it('shows an error and does not navigate for invalid input', () => {
    render(<PrPicker />);
    submit('#7');
    expect(href).toBe('');
    expect(screen.getByText('Enter a GitHub pull request URL or owner/repo#number.')).toBeTruthy();
    expect(screen.getByLabelText('Open a pull request').getAttribute('aria-invalid')).toBe('true');
  });

  it('clears the error when the input changes', () => {
    render(<PrPicker />);
    submit('nope');
    fireEvent.input(screen.getByLabelText('Open a pull request'), { target: { value: 'nope2' } });
    expect(screen.queryByText(/Enter a GitHub pull request URL/)).toBeNull();
  });
});

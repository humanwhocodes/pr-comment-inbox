/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the app header and pull-request state badge.
 */

import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { makeData } from '../../tests/fixtures';
import type { PullRequestInfo } from '../lib/types';
import Header from './Header';

/**
 * Renders the header with pull-request data using the given PR overrides.
 * @param pr Fields to override on the pull request.
 * @param demo Whether the header is in demo mode.
 * @returns Render result.
 */
function renderWith(pr: Partial<PullRequestInfo> = {}, demo = false) {
  const data = makeData();
  return render(<Header owner="o" repo="r" number={1} data={{ ...data, pr: { ...data.pr, ...pr } }} demo={demo} />);
}

describe('Header', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows a loading placeholder when there is no data', () => {
    const { container } = render(<Header owner="o" repo="r" number={1} data={null} demo={false} />);
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
    expect(container.querySelector('form[action="/api/auth/logout"]')).toBeNull();
  });

  it('renders pull request details when data is present', () => {
    renderWith();
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('o/r').getAttribute('href')).toBe('https://github.com/o/r');
    expect(screen.getByText('feature → main')).toBeTruthy();
    expect(screen.getByText('View on GitHub').closest('a')?.getAttribute('href')).toBe('https://github.com/o/r/pull/1');
    expect(screen.getByTitle('@viewer')).toBeTruthy();
  });

  it('shows the sign-out button outside demo mode', () => {
    renderWith();
    expect(screen.getByText('Sign out')).toBeTruthy();
    expect(screen.queryByText('Demo')).toBeNull();
  });

  it('shows the demo badge and hides sign-out in demo mode', () => {
    renderWith({}, true);
    expect(screen.getByText('Demo')).toBeTruthy();
    expect(screen.queryByText('Sign out')).toBeNull();
  });

  it.each([
    [{ state: 'OPEN', isDraft: false }, 'Open'],
    [{ state: 'OPEN', isDraft: true }, 'Draft'],
    [{ state: 'CLOSED', isDraft: false }, 'Closed'],
    [{ state: 'MERGED', isDraft: false }, 'Merged'],
  ] as const)('shows the state badge for %o', (pr, label) => {
    const { container } = renderWith(pr);
    expect(container.querySelector('h1 + div .badge')?.textContent?.trim()).toBe(label);
  });

  it('includes the PR switcher and theme toggle', () => {
    renderWith();
    expect(screen.getByTitle('Switch to another pull request')).toBeTruthy();
    expect(screen.getByLabelText('Switch to dark mode')).toBeTruthy();
  });
});

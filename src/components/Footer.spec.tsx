/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the shared footer.
 */

import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import Footer from './Footer';

describe('Footer', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the author, source, and donate links', () => {
    render(<Footer />);
    expect(screen.getByText('Nicholas C. Zakas').getAttribute('href')).toBe('https://humanwhocodes.com');
    expect(screen.getByText('Source').closest('a')?.getAttribute('href')).toBe(
      'https://github.com/humanwhocodes/pr-comment-inbox',
    );
    expect(screen.getByText('Donate').getAttribute('href')).toBe('https://humanwhocodes.com/donate');
  });

  it('appends a custom class to the footer', () => {
    const { container } = render(<Footer class="extra-class" />);
    expect(container.querySelector('footer')?.className).toContain('extra-class');
  });

  it('renders without a custom class', () => {
    const { container } = render(<Footer />);
    expect(container.querySelector('footer')?.className).not.toContain('undefined');
  });
});

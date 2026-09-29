/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the light/dark theme toggle.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark');
  });

  it('offers dark mode when the page is light', () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to dark mode').getAttribute('title')).toBe('Switch to dark mode');
  });

  it('offers light mode when the page is already dark', () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    expect(screen.getByLabelText('Switch to light mode')).toBeTruthy();
  });

  it('switches to dark mode and persists the choice', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Switch to dark mode'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(screen.getByLabelText('Switch to light mode')).toBeTruthy();
  });

  it('switches back to light mode and persists the choice', () => {
    document.documentElement.classList.add('dark');
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Switch to light mode'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('still toggles when localStorage throws', () => {
    const setItem = vi.fn(() => {
      throw new Error('quota');
    });
    vi.stubGlobal('localStorage', { setItem });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByLabelText('Switch to dark mode'));
    expect(setItem).toHaveBeenCalled();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});

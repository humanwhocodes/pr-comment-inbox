/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the SVG icon components.
 */

import { cleanup, render } from '@testing-library/preact';
import type { ComponentType } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';
import * as Icons from './Icons';

const entries = Object.entries(Icons) as [string, ComponentType<{ size?: number; class?: string }>][];

describe('Icons', () => {
  afterEach(() => {
    cleanup();
  });

  it.each(entries)('%s renders a hidden 16px svg by default', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('16');
    expect(svg.getAttribute('height')).toBe('16');
    expect(svg.getAttribute('viewBox')).toBe('0 0 16 16');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it.each(entries)('%s accepts a custom size and passes through other props', (_name, Icon) => {
    const { container } = render(<Icon size={24} class="custom" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe('24');
    expect(svg.getAttribute('height')).toBe('24');
    expect(svg.getAttribute('class')).toContain('custom');
  });
});

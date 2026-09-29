/**
 * @vitest-environment happy-dom
 * @fileoverview Unit tests for the header pull-request switcher dialog.
 */

import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import PrSwitcher from './PrSwitcher';

const current = { owner: 'humanwhocodes', repo: 'pr-comments', number: 1 };

/**
 * Returns the switcher's dialog element.
 * @returns The dialog element.
 * @throws {Error} When no dialog is rendered.
 */
function getDialog(): HTMLDialogElement {
  const dialog = document.querySelector('dialog');
  if (!dialog) {
    throw new Error('Dialog not rendered');
  }
  return dialog;
}

/**
 * Clicks the "Switch PR" button and waits for effects to flush.
 * @returns {Promise<void>}
 */
async function openDialog() {
  await act(() => {
    fireEvent.click(screen.getByTitle('Switch to another pull request'));
  });
}

describe('PrSwitcher', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps the dialog closed until the button is clicked', () => {
    render(<PrSwitcher current={current} />);
    expect(getDialog().open).toBe(false);
  });

  it('opens the dialog when the button is clicked', async () => {
    render(<PrSwitcher current={current} />);
    await openDialog();
    expect(getDialog().open).toBe(true);
    expect(screen.getByLabelText('Open a pull request')).toBeTruthy();
  });

  it('closes the dialog with the close button', async () => {
    render(<PrSwitcher current={current} />);
    await openDialog();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(getDialog().open).toBe(false);
  });

  it('closes the dialog when the backdrop is clicked', async () => {
    render(<PrSwitcher current={current} />);
    await openDialog();
    fireEvent.click(getDialog());
    expect(getDialog().open).toBe(false);
  });

  it('does not close the dialog when its content is clicked', async () => {
    render(<PrSwitcher current={current} />);
    await openDialog();
    fireEvent.click(screen.getByText('Switch pull request'));
    expect(getDialog().open).toBe(true);
  });

  it('clears previously entered text when reopened', async () => {
    render(<PrSwitcher current={current} />);
    await openDialog();
    fireEvent.input(screen.getByLabelText('Open a pull request'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByLabelText('Close'));
    await openDialog();
    expect((screen.getByLabelText('Open a pull request') as HTMLInputElement).value).toBe('');
  });
});

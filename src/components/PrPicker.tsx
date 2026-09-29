/**
 * @fileoverview Implements the pull-request reference input and navigation picker.
 */

import { useState } from 'preact/hooks';
import { GitPullRequestIcon } from './Icons';
import { parsePrReference, prPath, type PrReference } from '../lib/pr-reference';

interface Props {
  /** Pull request currently being viewed; enables `#123` shorthand for the same repository. */
  current?: PrReference;
  /** Focuses the input when the picker mounts. */
  autoFocus?: boolean;
}

/**
 * Renders a form that navigates to a pull request entered as a URL or reference.
 * @param props Component props.
 * @param props.current Pull request currently being viewed, if any.
 * @param props.autoFocus Whether to focus the input on mount.
 * @returns Pull request picker form.
 */
export default function PrPicker({ current, autoFocus = false }: Props) {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  /**
   * Navigates to the entered pull request or flags the input as invalid.
   * @param e Form submit event.
   * @returns {void}
   */
  function submit(e: Event) {
    e.preventDefault();
    const ref = parsePrReference(value, current);
    if (!ref) {
      setInvalid(true);
      return;
    }
    window.location.href = prPath(ref);
  }

  return (
    <form onSubmit={submit} class="flex flex-col gap-2">
      <label class="text-sm font-medium" for="pr-ref">
        Open a pull request
      </label>
      <div class="flex gap-2">
        <input
          id="pr-ref"
          value={value}
          autoFocus={autoFocus}
          aria-invalid={invalid}
          onInput={(e) => {
            setValue((e.target as HTMLInputElement).value);
            setInvalid(false);
          }}
          placeholder={
            current ? 'https://github.com/owner/repo/pull/123, owner/repo#123, or #123' : 'https://github.com/owner/repo/pull/123 or owner/repo#123'
          }
          class="min-w-0 flex-1 rounded-md border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button type="submit" class="btn btn-primary">
          <GitPullRequestIcon /> Open
        </button>
      </div>
      {invalid && (
        <p class="text-xs text-danger">
          {current
            ? 'Enter a GitHub pull request URL, owner/repo#number, or #number.'
            : 'Enter a GitHub pull request URL or owner/repo#number.'}
        </p>
      )}
    </form>
  );
}

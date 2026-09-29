/**
 * @fileoverview Header button that opens a dialog for switching to another pull request.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { GitPullRequestIcon, XIcon } from './Icons';
import PrPicker from './PrPicker';
import type { PrReference } from '../lib/pr-reference';

interface Props {
  /** Pull request currently being viewed. */
  current: PrReference;
}

/**
 * Renders a "Switch PR" button and the modal dialog it opens.
 * @param props Component props.
 * @param props.current Pull request currently being viewed.
 * @returns Switch button and dialog.
 */
export default function PrSwitcher({ current }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Incremented on each open; used as the picker key so it remounts with an empty input.
  const [openCount, setOpenCount] = useState(0);

  // Show the dialog only after the fresh picker renders so showModal() can autofocus its input.
  useEffect(() => {
    if (openCount > 0) {
      dialog.current?.showModal();
    }
  }, [openCount]);

  /**
   * Closes the switch dialog.
   * @returns {void}
   */
  function close() {
    dialog.current?.close();
  }

  return (
    <>
      <button
        type="button"
        class="btn btn-sm"
        onClick={() => setOpenCount((n) => n + 1)}
        title="Switch to another pull request"
      >
        <GitPullRequestIcon size={14} />
        <span class="hidden sm:inline">Switch PR</span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="pr-switch-title"
        class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-canvas p-0 text-fg shadow-xl backdrop:bg-black/40"
        onClick={(e) => {
          // Clicks on the backdrop target the dialog element itself.
          if (e.target === dialog.current) {
            close();
          }
        }}
      >
        <div class="flex items-center border-b border-border px-4 py-3">
          <h2 id="pr-switch-title" class="text-sm font-semibold">
            Switch pull request
          </h2>
          <button type="button" class="ml-auto text-fg-muted hover:text-fg" onClick={close} aria-label="Close">
            <XIcon />
          </button>
        </div>
        <div class="p-4">
          <PrPicker key={openCount} current={current} autoFocus />
        </div>
      </dialog>
    </>
  );
}

/**
 * @fileoverview Provides the markdown reply editor with formatting actions and preview support.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { mentionsLogin } from '../lib/mentions';
import {
  AlertIcon,
  BoldIcon,
  CodeIcon,
  HeadingIcon,
  ItalicIcon,
  LinkIcon,
  ListOrderedIcon,
  ListUnorderedIcon,
  MentionIcon,
  QuoteIcon,
  SpinnerIcon,
  TasklistIcon,
} from './Icons';

interface Props {
  owner: string;
  repo: string;
  initialValue?: string;
  placeholder?: string;
  submitLabel: string;
  submitWithResolveLabel: string;
  /** Whether to show the "Resolve conversation" checkbox. */
  canResolve: boolean;
  /** Login the reply must @-mention to stay in this thread; warns when it's missing. */
  requiredMention?: string;
  busy: boolean;
  onSubmit: (body: string, resolve: boolean) => Promise<void>;
}

type Wrap = { before: string; after?: string; block?: boolean; linePrefix?: string };

const TOOLS: { key: string; title: string; icon: preact.ComponentType<{ size?: number }>; wrap: Wrap }[] = [
  { key: 'heading', title: 'Heading', icon: HeadingIcon, wrap: { before: '', linePrefix: '### ' } },
  { key: 'bold', title: 'Bold (Ctrl+B)', icon: BoldIcon, wrap: { before: '**', after: '**' } },
  { key: 'italic', title: 'Italic (Ctrl+I)', icon: ItalicIcon, wrap: { before: '_', after: '_' } },
  { key: 'quote', title: 'Quote', icon: QuoteIcon, wrap: { before: '', linePrefix: '> ' } },
  { key: 'code', title: 'Code (Ctrl+E)', icon: CodeIcon, wrap: { before: '`', after: '`' } },
  { key: 'link', title: 'Link (Ctrl+K)', icon: LinkIcon, wrap: { before: '[', after: '](url)' } },
  { key: 'ul', title: 'Bulleted list', icon: ListUnorderedIcon, wrap: { before: '', linePrefix: '- ' } },
  { key: 'ol', title: 'Numbered list', icon: ListOrderedIcon, wrap: { before: '', linePrefix: '1. ' } },
  { key: 'task', title: 'Task list', icon: TasklistIcon, wrap: { before: '', linePrefix: '- [ ] ' } },
  { key: 'mention', title: 'Mention a user', icon: MentionIcon, wrap: { before: '@' } },
];

export default function CommentEditor(props: Props) {
  const { owner, repo, initialValue = '', placeholder, submitLabel, submitWithResolveLabel, canResolve, requiredMention, busy, onSubmit } = props;
  const [value, setValue] = useState(initialValue);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [preview, setPreview] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [resolve, setResolve] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
    setTab('write');
    setResolve(false);
    setError(null);
  }, [initialValue]);

  useEffect(() => {
    if (tab !== 'preview') {
      return;
    }
    if (value.trim() === '') {
      setPreview('');
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    fetch('/api/markdown', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: value, context: `${owner}/${repo}` }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const payload = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error ?? r.statusText);
        }
        return r.text();
      })
      .then((html) => {
        if (!cancelled) {
          setPreview(html);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setPreviewError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab, value, owner, repo]);

  /**
   * Applies markdown formatting around the current selection.
   * @param wrap Wrap behavior for the selected tool.
   */
  function apply(wrap: Wrap) {
    const el = textarea.current;
    if (!el) {
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end);
    let next: string;
    let cursorStart: number;
    let cursorEnd: number;

    if (wrap.linePrefix) {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const segment = value.slice(lineStart, end);
      const prefixed = segment
        .split('\n')
        .map((line) => (line.startsWith(wrap.linePrefix!) ? line.slice(wrap.linePrefix!.length) : wrap.linePrefix + line))
        .join('\n');
      next = value.slice(0, lineStart) + prefixed + value.slice(end);
      cursorStart = lineStart;
      cursorEnd = lineStart + prefixed.length;
    } else {
      const after = wrap.after ?? '';
      next = value.slice(0, start) + wrap.before + selected + after + value.slice(end);
      cursorStart = start + wrap.before.length;
      cursorEnd = cursorStart + selected.length;
    }
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  /**
   * Handles keyboard shortcuts in the editor.
   * @param e Keyboard event from the textarea.
   */
  function onKeyDown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      void submit();
      return;
    }
    if (!mod) {
      return;
    }
    const key = e.key.toLowerCase();
    const tool =
      key === 'b' ? 'bold' : key === 'i' ? 'italic' : key === 'e' ? 'code' : key === 'k' ? 'link' : null;
    if (tool) {
      e.preventDefault();
      apply(TOOLS.find((t) => t.key === tool)!.wrap);
    }
  }

  /**
   * Submits the current reply content.
   * @returns Promise that resolves when submit completes.
   */
  async function submit() {
    const body = value.trim();
    if (!body || busy) {
      return;
    }
    setError(null);
    try {
      await onSubmit(body, canResolve && resolve);
      setValue('');
      setTab('write');
      setResolve(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const empty = value.trim() === '';
  const missingMention = !!requiredMention && !empty && !mentionsLogin(value, requiredMention);

  return (
    <div class="rounded-lg border border-border bg-canvas">
      <div class="flex flex-wrap items-center gap-1 border-b border-border px-2 pt-2">
        <div class="flex">
          {(['write', 'preview'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              class={`-mb-px rounded-t-md border px-3 py-1.5 text-sm font-medium capitalize ${
                tab === t
                  ? 'border-border border-b-canvas bg-canvas text-fg'
                  : 'border-transparent text-fg-muted hover:text-fg'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === 'write' && (
          <div class="ml-auto flex items-center gap-0.5 pb-1">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                type="button"
                title={t.title}
                aria-label={t.title}
                onClick={() => apply(t.wrap)}
                class="rounded p-1.5 text-fg-muted hover:bg-canvas-inset hover:text-fg"
              >
                <t.icon size={16} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div class="p-2">
        {tab === 'write' ? (
          <textarea
            ref={textarea}
            value={value}
            onInput={(e) => setValue((e.target as HTMLTextAreaElement).value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? 'Leave a comment'}
            rows={5}
            disabled={busy}
            class="scrollbar-thin block w-full resize-y rounded-md border border-border bg-canvas-subtle px-3 py-2 font-sans text-sm leading-relaxed outline-none focus:border-accent focus:bg-canvas focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
          />
        ) : (
          <div class="min-h-[8rem] rounded-md border border-dashed border-border px-3 py-2">
            {previewLoading && (
              <p class="flex items-center gap-2 text-sm text-fg-muted">
                <SpinnerIcon /> Rendering preview…
              </p>
            )}
            {!previewLoading && previewError && <p class="text-sm text-danger">{previewError}</p>}
            {!previewLoading && !previewError && empty && <p class="text-sm text-fg-muted">Nothing to preview.</p>}
            {!previewLoading && !previewError && !empty && (
              <div class="markdown-body" dangerouslySetInnerHTML={{ __html: preview }} />
            )}
          </div>
        )}
      </div>

      {missingMention && (
        <div
          role="status"
          class="mx-2 mb-2 flex items-start gap-2 rounded-md border border-attention/40 bg-attention-bg px-3 py-2 text-sm text-attention"
        >
          <AlertIcon size={14} class="mt-0.5 shrink-0" />
          <span>
            This reply doesn't mention @{requiredMention}, so it won't appear in this thread. Add the @mention back to keep
            it here.
          </span>
        </div>
      )}

      <div class="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2">
        <span class="text-xs text-fg-muted">Markdown is supported. Ctrl+Enter to submit.</span>
        {error && <span class="text-xs text-danger">{error}</span>}
        <span class="ml-auto flex items-center gap-3">
          {canResolve && (
            <label class="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={resolve}
                onChange={(e) => setResolve((e.target as HTMLInputElement).checked)}
                class="h-4 w-4 accent-accent"
              />
              Resolve conversation
            </label>
          )}
          <button type="button" class="btn btn-primary" disabled={empty || busy} onClick={() => void submit()}>
            {busy && <SpinnerIcon />}
            {canResolve && resolve ? submitWithResolveLabel : submitLabel}
          </button>
        </span>
      </div>
    </div>
  );
}

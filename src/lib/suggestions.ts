import type { InlineThread } from './types';
import { parseHunk } from './ui';

/** A line of code the suggestion would replace. */
export interface SourceLine {
  no: number | null;
  text: string;
}

interface SuggestionRow {
  type: 'add' | 'del';
  no: number | null;
  /** Trusted HTML (either GitHub-rendered or escaped by us). */
  html: string;
}

function escapeHTML(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * The lines an inline thread is attached to, as they read on the commented side
 * of the diff. These are what a ```suggestion block replaces.
 * @param thread Inline thread with diff metadata.
 * @returns Source lines that would be replaced by a suggestion.
 */
export function threadSourceLines(thread: InlineThread): SourceLine[] {
  const all = parseHunk(thread.diffHunk);
  const left = thread.diffSide === 'LEFT';
  const onSide = all.filter((l) => l.type === 'context' || l.type === (left ? 'del' : 'add'));
  const no = (l: (typeof all)[number]) => (left ? l.oldNo : l.newNo);
  const end = thread.line;
  const start = thread.startLine ?? thread.line;

  let lines = onSide.filter((l) => {
    const n = no(l);
    return n != null && start != null && end != null && n >= start && n <= end;
  });
  if (lines.length === 0) {
    const span = start != null && end != null ? end - start + 1 : 1;
    lines = onSide.slice(-span);
  }
  return lines.map((l) => ({ no: no(l), text: l.text }));
}

function renderRows(rows: SuggestionRow[]): string {
  const body = rows
    .map((r) => {
      const cls = r.type === 'add' ? 'diff-add' : 'diff-del';
      const marker = r.type === 'add' ? '+' : '-';
      return `<div class="suggestion-line ${cls}"><span class="diff-line-num">${r.no ?? ''}</span><span class="diff-line-marker">${marker}</span><span class="diff-line-content">${r.html || ' '}</span></div>`;
    })
    .join('');
  return `<div class="suggestion"><div class="suggestion-header">Suggested change</div><div class="suggestion-body scrollbar-thin">${body}</div></div>`;
}

/** GitHub's own rendering: a table of blob-code-deletion / blob-code-addition rows. */
function rowsFromTable(el: Element): SuggestionRow[] {
  const rows: SuggestionRow[] = [];
  for (const tr of Array.from(el.querySelectorAll('tr'))) {
    const code = tr.querySelector('.blob-code-addition, .blob-code-deletion, [class*="blob-code-inner"]');
    if (!code) {
      continue;
    }
    const type = code.className.includes('addition') ? 'add' : code.className.includes('deletion') ? 'del' : null;
    if (!type) {
      continue;
    }
    const num = tr.querySelector('[data-line-number]')?.getAttribute('data-line-number');
    rows.push({ type, no: num ? Number(num) : null, html: code.innerHTML });
  }
  return rows;
}

/** A plain fenced ```suggestion block: diff it against the commented lines ourselves. */
function rowsFromCode(text: string, source: SourceLine[]): SuggestionRow[] {
  const added = text.replace(/\n$/, '');
  const addLines = added === '' ? [] : added.split('\n');
  const first = source.find((s) => s.no != null)?.no ?? null;
  return [
    ...source.map((s): SuggestionRow => ({ type: 'del', no: s.no, html: escapeHTML(s.text) })),
    ...addLines.map((t, i): SuggestionRow => ({ type: 'add', no: first != null ? first + i : null, html: escapeHTML(t) })),
  ];
}

/**
 * Rewrite suggested-change blocks in a comment's HTML into GitHub-style diffs.
 * Handles both GitHub's pre-rendered suggestion tables and bare
 * ```suggestion code blocks (e.g. from the /markdown API).
 * @param html Comment HTML.
 * @param source Source lines tied to the comment location.
 * @returns HTML with suggestion blocks rewritten to diff-style markup.
 */
export function renderSuggestions(html: string, source: SourceLine[] = []): string {
  if (!/suggest/i.test(html) || typeof document === 'undefined') {
    return html;
  }
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const root = tpl.content;
  let changed = false;

  for (const blob of Array.from(root.querySelectorAll('.js-suggested-changes-blob'))) {
    const rows = rowsFromTable(blob);
    if (rows.length === 0) {
      continue;
    }
    blob.outerHTML = renderRows(rows);
    changed = true;
  }

  const fenced = root.querySelectorAll(
    '.highlight-source-suggestion, pre[lang="suggestion"], code.language-suggestion',
  );
  for (const el of Array.from(fenced)) {
    const target = el.closest('.highlight-source-suggestion') ?? el.closest('pre') ?? el;
    // Nested matches (a <pre> inside .highlight-source-suggestion) are already replaced.
    if (!root.contains(target)) {
      continue;
    }
    const text = target.textContent ?? '';
    target.outerHTML = renderRows(rowsFromCode(text, source));
    changed = true;
  }

  return changed ? tpl.innerHTML : html;
}

/**
 * Extracts fenced suggestion blocks from markdown text.
 * @param markdown Markdown content that may include suggestion fences.
 * @returns Suggestion block contents in encounter order.
 */
export function extractSuggestionBlocks(markdown: string): string[] {
  const blocks: string[] = [];
  const re = /```suggestion[^\n]*\n([\s\S]*?)```/gim;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown))) {
    blocks.push(match[1] ?? '');
  }
  return blocks;
}

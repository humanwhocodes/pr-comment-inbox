import { useState } from 'preact/hooks';
import type { InlineThread } from '../lib/types';
import { parseHunk } from '../lib/ui';
import { ChevronDownIcon, FileCodeIcon } from './Icons';

function extLabel(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const names: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX', mjs: 'JavaScript', cjs: 'JavaScript',
    rs: 'Rust', py: 'Python', go: 'Go', rb: 'Ruby', java: 'Java', kt: 'Kotlin', swift: 'Swift',
    c: 'C', h: 'C', cpp: 'C++', cs: 'C#', css: 'CSS', scss: 'SCSS', html: 'HTML', md: 'Markdown',
    json: 'JSON', yml: 'YAML', yaml: 'YAML', toml: 'TOML', sh: 'Shell', sql: 'SQL', astro: 'Astro',
  };
  return names[ext] ?? (ext ? ext.toUpperCase() : 'Text');
}

export default function DiffHunk({ thread }: { thread: InlineThread }) {
  const [collapsed, setCollapsed] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const allLines = parseHunk(thread.diffHunk);
  const start = thread.startLine ?? thread.line;
  const end = thread.line;

  function sideNo(l: { oldNo: number | null; newNo: number | null }) {
    return thread.diffSide === 'LEFT' ? l.oldNo : l.newNo;
  }
  function isTarget(no: number | null) {
    return no != null && end != null && no === end;
  }
  function inRange(no: number | null) {
    return no != null && start != null && end != null && no >= start && no <= end;
  }

  // Only the lines the comment was attached to. GitHub's diffHunk ends at the
  // commented line, so if the numbers don't line up (outdated threads), fall back
  // to the tail of the hunk covering the same number of lines.
  let attached = allLines.filter((l) => inRange(sideNo(l)));
  if (attached.length === 0) {
    const span = start != null && end != null ? end - start + 1 : 1;
    attached = allLines.filter((l) => l.type !== 'hunk').slice(-span);
  }
  const hiddenCount = allLines.length - attached.length;
  const lines = showContext ? allLines : attached;
  const adds = lines.filter((l) => l.type === 'add').length;
  const dels = lines.filter((l) => l.type === 'del').length;

  return (
    <section class="overflow-hidden rounded-lg border border-border bg-canvas">
      <header class="flex items-center gap-2 border-b border-border bg-canvas-subtle px-3 py-2 text-sm">
        <button
          type="button"
          class="rounded p-0.5 text-fg-muted hover:bg-canvas-inset"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand diff' : 'Collapse diff'}
        >
          <ChevronDownIcon class={collapsed ? '-rotate-90 transition-transform' : 'transition-transform'} />
        </button>
        <FileCodeIcon class="text-fg-muted" />
        <span class="truncate font-mono text-[13px]">{thread.path}</span>
        {adds > 0 && <span class="badge bg-success-bg text-success">+{adds}</span>}
        {dels > 0 && <span class="badge bg-danger-bg text-danger">-{dels}</span>}
        <span class="ml-auto flex items-center gap-2">
          {hiddenCount > 0 && !collapsed && (
            <button
              type="button"
              class="text-xs font-medium text-accent hover:underline"
              onClick={() => setShowContext((s) => !s)}
            >
              {showContext ? 'Hide context' : `Show ${hiddenCount} more ${hiddenCount === 1 ? 'line' : 'lines'} of context`}
            </button>
          )}
          <span class="hidden rounded border border-border px-1.5 py-0.5 text-[11px] text-fg-muted sm:inline">
            {extLabel(thread.path)}
          </span>
        </span>
      </header>
      {!collapsed && (
        <div class="scrollbar-thin overflow-x-auto">
          {lines.length === 0 && <p class="px-3 py-2 text-sm text-fg-muted">No diff context available.</p>}
          {/* w-max + min-w-full keeps every row as wide as the longest line so backgrounds span the scroll area */}
          <div class="w-max min-w-full">
            {lines.map((l, i) => {
              const target = isTarget(sideNo(l));
              const ranged = inRange(sideNo(l));
              const cls =
                l.type === 'add' ? 'diff-add' : l.type === 'del' ? 'diff-del' : l.type === 'hunk' ? 'diff-hunk' : '';
              return (
                <div key={i} class={`diff-line ${cls} ${target ? 'diff-target' : ''} ${ranged && !target ? 'bg-accent/5' : ''}`}>
                  <span class="diff-line-num">{l.oldNo ?? ''}</span>
                  <span class="diff-line-num">{l.newNo ?? ''}</span>
                  <span class={`diff-line-marker ${l.type === 'add' ? 'text-success' : l.type === 'del' ? 'text-danger' : 'text-fg-muted'}`}>
                    {l.type === 'add' ? '+' : l.type === 'del' ? '-' : ''}
                  </span>
                  <span class={`diff-line-content ${l.type === 'hunk' ? 'text-fg-muted' : ''}`}>{l.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

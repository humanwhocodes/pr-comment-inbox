import type { Comment, InlineThread, Thread } from './types';

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function longDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Rough markdown → plain text for list excerpts. */
export function excerpt(markdown: string, max = 180): string {
  let text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+\.\s+)/gm, '')
    .replace(/[*_~`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length > max) text = text.slice(0, max - 1).trimEnd() + '…';
  return text;
}

export const REACTION_EMOJI: Record<string, string> = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀',
};

export function associationLabel(assoc: string): string | null {
  switch (assoc) {
    case 'OWNER':
      return 'Owner';
    case 'MEMBER':
      return 'Member';
    case 'COLLABORATOR':
      return 'Collaborator';
    case 'CONTRIBUTOR':
      return 'Contributor';
    case 'FIRST_TIME_CONTRIBUTOR':
    case 'FIRST_TIMER':
      return 'First-time contributor';
    default:
      return null;
  }
}

export function firstComment(thread: Thread): Comment {
  return thread.comments[0];
}

export function isInline(thread: Thread): thread is InlineThread {
  return thread.kind === 'inline';
}

export function threadLocation(thread: Thread): string {
  if (thread.kind === 'inline') {
    return thread.line != null ? `${thread.path}:${thread.line}` : thread.path;
  }
  return 'Top-level comment';
}

/* ------------------------------------------------------------------ */
/* Diff hunk parsing                                                   */
/* ------------------------------------------------------------------ */

export interface DiffLine {
  type: 'hunk' | 'add' | 'del' | 'context' | 'meta';
  oldNo: number | null;
  newNo: number | null;
  text: string;
}

export function parseHunk(hunk: string): DiffLine[] {
  const out: DiffLine[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const raw of hunk.split('\n')) {
    const header = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (header) {
      oldNo = Number(header[1]);
      newNo = Number(header[2]);
      out.push({ type: 'hunk', oldNo: null, newNo: null, text: raw });
      continue;
    }
    const marker = raw[0];
    const text = raw.slice(1);
    if (marker === '+') {
      out.push({ type: 'add', oldNo: null, newNo: newNo++, text });
    } else if (marker === '-') {
      out.push({ type: 'del', oldNo: oldNo++, newNo: null, text });
    } else if (marker === '\\') {
      out.push({ type: 'meta', oldNo: null, newNo: null, text: raw });
    } else {
      out.push({ type: 'context', oldNo: oldNo++, newNo: newNo++, text });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Local storage                                                       */
/* ------------------------------------------------------------------ */

export interface LocalState {
  /** Thread id → updatedAt that was marked read. Newer activity makes it unread again. */
  read: Record<string, string>;
}

const EMPTY: LocalState = { read: {} };

export function storageKey(owner: string, repo: string, number: number) {
  return `pr-comments:${owner.toLowerCase()}/${repo.toLowerCase()}#${number}`;
}

export function loadLocal(key: string): LocalState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<LocalState>;
    return { read: parsed.read ?? {} };
  } catch {
    return { ...EMPTY };
  }
}

export function saveLocal(key: string, state: LocalState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore quota / private mode */
  }
}

import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { Comment, PullRequestData, Thread } from '../lib/types';
import { excerpt, loadLocal, saveLocal, storageKey, threadLocation, type LocalState } from '../lib/ui';
import Header from './Header';
import { AlertIcon, CommentIcon, SpinnerIcon } from './Icons';
import Sidebar, { type Filter, type Sort, type ThreadItem } from './Sidebar';
import ThreadView from './ThreadView';

interface Props {
  owner: string;
  repo: string;
  number: number;
  demo: boolean;
}

async function readError(res: Response): Promise<string> {
  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  return payload.error ?? `${res.status} ${res.statusText}`;
}

export default function App({ owner, repo, number, demo }: Props) {
  const apiBase = `/api/pr/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${number}`;
  const key = useMemo(() => storageKey(owner, repo, number), [owner, repo, number]);

  const [data, setData] = useState<PullRequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<LocalState>({ resolved: [], read: {} });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('unresolved');
  const [sort, setSort] = useState<Sort>('unresolved');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  /* ---------------- data loading ---------------- */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(await readError(res));
      setData((await res.json()) as PullRequestData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    setLocal(loadLocal(key));
    void load();
  }, [key, load]);

  const updateLocal = useCallback(
    (fn: (prev: LocalState) => LocalState) => {
      setLocal((prev) => {
        const next = fn(prev);
        saveLocal(key, next);
        return next;
      });
    },
    [key],
  );

  /* ---------------- derived state ---------------- */

  const items: ThreadItem[] = useMemo(() => {
    if (!data) return [];
    const viewer = data.viewer.login.toLowerCase();
    return data.threads.map((thread) => ({
      thread,
      isResolved: thread.kind === 'inline' ? thread.isResolved : local.resolved.includes(thread.id),
      isRead: (local.read[thread.id] ?? '') >= thread.updatedAt,
      isOutdated: thread.kind === 'inline' && thread.isOutdated,
      mentionsViewer: thread.mentions.includes(viewer),
    }));
  }, [data, local]);

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      unresolved: items.filter((i) => !i.isResolved && !i.isRead).length,
      resolved: items.filter((i) => i.isResolved).length,
      outdated: items.filter((i) => i.isOutdated).length,
      mentions: items.filter((i) => i.mentionsViewer && !i.isRead).length,
      read: items.filter((i) => i.isRead).length,
      all: items.length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (t: Thread) =>
      !q ||
      threadLocation(t).toLowerCase().includes(q) ||
      t.comments.some(
        (c: Comment) => c.author.login.toLowerCase().includes(q) || excerpt(c.body, 10_000).toLowerCase().includes(q),
      );

    const byFilter = items.filter((i) => {
      switch (filter) {
        case 'unresolved':
          return !i.isResolved && !i.isRead;
        case 'resolved':
          return i.isResolved;
        case 'outdated':
          return i.isOutdated;
        case 'mentions':
          return i.mentionsViewer && !i.isRead;
        case 'read':
          return i.isRead;
        default:
          return true;
      }
    });

    const sorted = [...byFilter.filter((i) => matches(i.thread))];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'unresolved':
          if (a.isResolved !== b.isResolved) return a.isResolved ? 1 : -1;
          return b.thread.updatedAt.localeCompare(a.thread.updatedAt);
        case 'newest':
          return b.thread.updatedAt.localeCompare(a.thread.updatedAt);
        case 'oldest':
          return a.thread.updatedAt.localeCompare(b.thread.updatedAt);
        case 'file': {
          if (a.thread.kind !== b.thread.kind) return a.thread.kind === 'inline' ? -1 : 1;
          if (a.thread.kind === 'inline' && b.thread.kind === 'inline') {
            return a.thread.path.localeCompare(b.thread.path) || (a.thread.line ?? 0) - (b.thread.line ?? 0);
          }
          return a.thread.updatedAt.localeCompare(b.thread.updatedAt);
        }
      }
    });
    return sorted;
  }, [items, filter, sort, search]);

  const selected = items.find((i) => i.thread.id === selectedId) ?? null;

  // Keep a sensible selection: first visible thread when nothing (or something hidden) is selected.
  useEffect(() => {
    if (visible.length === 0) return;
    if (!selectedId || !items.some((i) => i.thread.id === selectedId)) {
      setSelectedId(visible[0].thread.id);
    }
  }, [visible, items, selectedId]);

  /* ---------------- actions ---------------- */

  function markRead(ids: string[], read: boolean) {
    if (!data) return;
    updateLocal((prev) => {
      const next = { ...prev, read: { ...prev.read } };
      for (const id of ids) {
        const thread = data.threads.find((t) => t.id === id);
        if (!thread) continue;
        if (read) next.read[id] = thread.updatedAt;
        else delete next.read[id];
      }
      return next;
    });
  }

  async function resolveThread(item: ThreadItem, resolved: boolean) {
    const { thread } = item;
    if (thread.kind === 'toplevel') {
      updateLocal((prev) => ({
        ...prev,
        resolved: resolved ? [...new Set([...prev.resolved, thread.id])] : prev.resolved.filter((id) => id !== thread.id),
      }));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ threadId: thread.id, resolved }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const result = (await res.json()) as { isResolved: boolean };
      setData((prev) =>
        prev && {
          ...prev,
          threads: prev.threads.map((t) => (t.id === thread.id && t.kind === 'inline' ? { ...t, isResolved: result.isResolved } : t)),
        },
      );
    } finally {
      setBusy(false);
    }
  }

  async function reply(item: ThreadItem, body: string, resolve: boolean) {
    if (!data) return;
    const { thread } = item;
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/reply`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: thread.kind,
          threadId: thread.id,
          pullRequestId: data.pr.id,
          body,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const created = (await res.json()) as { id: string; url: string };

      if (demo) {
        // Simulate the round trip locally.
        const now = new Date().toISOString();
        const escaped = `<p>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`;
        const bodyHTML = await fetch('/api/markdown', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text: body }),
        })
          .then((r) => (r.ok ? r.text() : escaped))
          .catch(() => escaped);
        const comment: Comment = {
          id: created.id,
          kind: thread.kind === 'inline' ? 'reviewComment' : 'issue',
          author: data.viewer,
          authorAssociation: 'OWNER',
          body,
          bodyHTML,
          createdAt: now,
          url: created.url,
          reactions: [],
        };
        setData((prev) =>
          prev && {
            ...prev,
            threads: prev.threads.map((t) =>
              t.id === thread.id ? { ...t, comments: [...t.comments, comment], updatedAt: now } : t,
            ),
          },
        );
      }
    } finally {
      setBusy(false);
    }

    if (resolve) await resolveThread(item, true);
    if (!demo) await load();
    // A reply from the viewer counts as having read the thread up to now.
    if (!resolve) markRead([thread.id], true);
  }

  function select(id: string) {
    setSelectedId(id);
    setMobileShowThread(true);
  }

  /* ---------------- render ---------------- */

  return (
    <div class="flex h-full min-h-0 flex-col">
      <Header owner={owner} repo={repo} number={number} data={data} demo={demo} />

      {error && (
        <div class="flex items-center gap-2 border-b border-danger/30 bg-danger-bg px-4 py-2 text-sm text-danger">
          <AlertIcon />
          <span>{error}</span>
          <button type="button" class="btn btn-sm ml-auto" onClick={() => void load()}>
            Retry
          </button>
          {/401|403/.test(error) && (
            <a href={`/?next=${encodeURIComponent(location.pathname)}`} class="btn btn-sm">
              Sign in again
            </a>
          )}
        </div>
      )}

      <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,400px)_1fr]">
        <div class={`min-h-0 ${mobileShowThread ? 'hidden lg:block' : 'block'}`}>
          <Sidebar
            items={visible}
            counts={counts}
            total={items.length}
            filter={filter}
            setFilter={(f) => {
              setFilter(f);
              setChecked(new Set());
            }}
            sort={sort}
            setSort={setSort}
            search={search}
            setSearch={setSearch}
            selectedId={selectedId}
            onSelect={select}
            checked={checked}
            onToggleChecked={(id) =>
              setChecked((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            onCheckAll={() => setChecked(new Set(visible.map((i) => i.thread.id)))}
            onClearChecked={() => setChecked(new Set())}
            onMarkRead={markRead}
            fetchedAt={data?.fetchedAt ?? null}
            headRef={data?.pr.headRefOid ?? null}
            loading={loading}
            onRefresh={() => void load()}
          />
        </div>

        <main class={`min-h-0 ${mobileShowThread ? 'block' : 'hidden lg:block'}`}>
          {data && selected ? (
            <ThreadView
              key={selected.thread.id}
              item={selected}
              data={data}
              busy={busy}
              onReply={(body, resolve) => reply(selected, body, resolve)}
              onResolve={(resolved) => resolveThread(selected, resolved)}
              onMarkRead={(read) => markRead([selected.thread.id], read)}
              onBack={() => setMobileShowThread(false)}
            />
          ) : (
            <div class="flex h-full flex-col items-center justify-center gap-3 bg-canvas-subtle p-8 text-center text-fg-muted">
              {loading ? (
                <>
                  <SpinnerIcon size={24} />
                  <p class="text-sm">Loading pull request from GitHub…</p>
                </>
              ) : (
                <>
                  <CommentIcon size={32} class="opacity-40" />
                  <p class="text-sm">
                    {items.length === 0 ? 'No comment threads on this pull request yet.' : 'Select a thread to read it.'}
                  </p>
                </>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

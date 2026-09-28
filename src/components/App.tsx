import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { Comment, PullRequestData, Thread } from '../lib/types';
import { excerpt, loadLocal, saveLocal, storageKey, threadLocation, type LocalState } from '../lib/ui';
import Footer from './Footer';
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
  const [local, setLocal] = useState<LocalState>({ read: {} });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('inbox');
  const [sort, setSort] = useState<Sort>('unresolved');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);

  /* ---------------- data loading ---------------- */

  const load = useCallback(async (): Promise<PullRequestData | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiBase, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(await readError(res));
      const fresh = (await res.json()) as PullRequestData;
      setData(fresh);
      return fresh;
    } catch (err) {
      setError((err as Error).message);
      return null;
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
    return data.threads.map((thread) => {
      const readAt = local.read[thread.id];
      const isResolved = thread.kind === 'inline' && thread.isResolved;
      const isRead = readAt !== undefined && readAt >= thread.updatedAt;
      // A resolved thread only resurfaces if the viewer had read it and something happened since.
      const hasNewActivity = readAt !== undefined && readAt < thread.updatedAt;
      return {
        thread,
        isResolved,
        isRead,
        needsAttention: !isRead && (!isResolved || hasNewActivity),
        isOutdated: thread.kind === 'inline' && thread.isOutdated,
        mentionsViewer: thread.mentions.includes(viewer),
      };
    });
  }, [data, local]);

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      inbox: items.filter((i) => i.needsAttention).length,
      resolved: items.filter((i) => i.isResolved).length,
      outdated: items.filter((i) => i.isOutdated).length,
      mentions: items.filter((i) => i.mentionsViewer && i.needsAttention).length,
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
        case 'inbox':
          return i.needsAttention;
        case 'resolved':
          return i.isResolved;
        case 'outdated':
          return i.isOutdated;
        case 'mentions':
          return i.mentionsViewer && i.needsAttention;
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

  /** `source` lets callers that just refetched pass fresh data instead of this render's `data`. */
  function markRead(ids: string[], read: boolean, source: PullRequestData | null = data) {
    if (!source) return;
    updateLocal((prev) => {
      const next = { ...prev, read: { ...prev.read } };
      for (const id of ids) {
        const thread = source.threads.find((t) => t.id === id);
        if (!thread) continue;
        if (read) next.read[id] = thread.updatedAt;
        else delete next.read[id];
      }
      return next;
    });
  }

  async function resolveThread(item: ThreadItem, resolved: boolean, manageBusy = true) {
    const { thread } = item;
    // Only review threads have a resolved state; top-level threads use read/unread instead.
    if (thread.kind !== 'inline') return;
    if (manageBusy) setBusy(true);
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
      // Resolving means you've dealt with it; mark read so any later reply brings it back to the inbox.
      if (result.isResolved) markRead([thread.id], true);
    } finally {
      if (manageBusy) setBusy(false);
    }
  }

  async function reply(item: ThreadItem, body: string, resolve: boolean) {
    if (!data) return;
    const { thread } = item;
    let latest: PullRequestData | null = data;
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
        latest = {
          ...data,
          threads: data.threads.map((t) =>
            t.id === thread.id ? { ...t, comments: [...t.comments, comment], updatedAt: now } : t,
          ),
        };
        setData(latest);
      }
      if (resolve) await resolveThread(item, true, false);
      if (!demo) latest = (await load()) ?? latest;
      // A reply from the viewer counts as having read the thread up to and including that reply.
      markRead([thread.id], true, latest);
    } finally {
      setBusy(false);
    }
  }

  async function acceptSuggestion(item: ThreadItem, commentId: string, suggestion: string) {
    if (!data || item.thread.kind !== 'inline' || item.thread.line == null) return;
    const startLine = item.thread.startLine ?? item.thread.line;
    const endLine = item.thread.line;
    const headOwner = data.pr.headRepositoryOwner ?? data.owner;
    const headRepo = data.pr.headRepositoryName ?? data.repo;
    setBusy(true);
    setError(null);
    try {
      const comment = item.thread.comments.find((c) => c.id === commentId);
      const res = await fetch(`${apiBase}/suggestion`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          owner: headOwner,
          repo: headRepo,
          branch: data.pr.headRefName,
          path: item.thread.path,
          startLine,
          endLine,
          suggestion,
          author: comment?.author.login ?? 'reviewer',
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function select(id: string) {
    setSelectedId(id);
    setMobileShowThread(true);
  }

  function markSelectedFromThreadView(read: boolean) {
    if (!selected) return;

    const currentId = selected.thread.id;
    const currentIndex = visible.findIndex((item) => item.thread.id === currentId);
    const nextId = currentIndex >= 0 ? visible[currentIndex + 1]?.thread.id ?? null : null;
    const prevId = currentIndex > 0 ? visible[currentIndex - 1]?.thread.id ?? null : null;

    markRead([currentId], read);

    if (!read) return;
    if (nextId) {
      setSelectedId(nextId);
      return;
    }
    if (prevId) setSelectedId(prevId);
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

      <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
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

        <main class={`min-h-0 min-w-0 ${mobileShowThread ? 'block' : 'hidden lg:block'}`}>
          {data && selected ? (
            <ThreadView
              key={selected.thread.id}
              item={selected}
              data={data}
              busy={busy}
              onReply={(body, resolve) => reply(selected, body, resolve)}
              onResolve={(resolved) => resolveThread(selected, resolved)}
              onAcceptSuggestion={(commentId, suggestion) => acceptSuggestion(selected, commentId, suggestion)}
              onMarkRead={markSelectedFromThreadView}
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

      <Footer class="border-t border-border bg-canvas-subtle px-4 py-1.5" />
    </div>
  );
}

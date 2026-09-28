import type { Actor, Comment, InlineThread, PullRequestData } from './types';
import { buildTopLevelThreads } from './github';

export const DEMO_OWNER = 'demo';
export const DEMO_REPO = 'demo';
export const DEMO_NUMBER = 1;

export function isDemo(owner: string, repo: string, number: number) {
  return owner === DEMO_OWNER && repo === DEMO_REPO && number === DEMO_NUMBER;
}

function who(login: string): Actor {
  return { login, avatarUrl: `https://github.com/identicons/${login}.png`, url: `https://github.com/${login}` };
}

const dan = who('dan-johnson');
const sarah = who('sarah-codes');
const alex = who('alex-infra');
const sophia = who('sophia-core');
const secops = who('bot-security');
const john = who('johndoe');

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let seq = 0;
function comment(
  author: Actor,
  createdAt: string,
  body: string,
  bodyHTML: string,
  extra: Partial<Comment> = {},
): Comment {
  seq += 1;
  return {
    id: `demo-comment-${seq}`,
    kind: 'issue',
    author,
    authorAssociation: 'CONTRIBUTOR',
    body,
    bodyHTML,
    createdAt,
    url: `https://github.com/octocat/syntax-engine/pull/1428#discussion_r${seq}`,
    reactions: [],
    ...extra,
  };
}

function mention(login: string) {
  return `<a class="user-mention" href="https://github.com/${login}">@${login}</a>`;
}

export function demoData(): PullRequestData {
  seq = 0;

  const inline: InlineThread[] = [
    {
      id: 'demo-thread-1',
      kind: 'inline',
      path: 'src/compiler/ast-stream.ts',
      line: 142,
      startLine: null,
      diffSide: 'RIGHT',
      diffHunk: [
        '@@ -138,9 +139,12 @@ export class AstStream {',
        '   public processChunk(chunk: Uint8Array): StreamResult {',
        '     const len = chunk.byteLength;',
        '-    const buffer = Buffer.allocUnsafe(len); // Old per-chunk allocation',
        '-    chunk.copy(buffer);',
        '+    // Proposed zero-copy slice from shared slab allocator',
        '+    const slice = this.slabPool.acquire(len);',
        '+    slice.set(chunk);',
      ].join('\n'),
      isResolved: false,
      isOutdated: false,
      viewerCanResolve: true,
      viewerCanUnresolve: true,
      reviewState: 'CHANGES_REQUESTED',
      comments: [
        comment(
          dan,
          minutesAgo(24),
          'Can we avoid allocating a new `Buffer` on every chunk iteration here? Under high throughput scenarios (>50k req/s), V8 GC spikes significantly when allocating short-lived buffers in this hot path.\n\nHave we considered reusing the pooled `SlabBuffer` or borrowing from the connection ring buffer directly?\n\nSuggested pattern:\n\n```ts\nconst pooled = connection.borrowBuffer(chunk.length);\n```',
          '<p>Can we avoid allocating a new <code>Buffer</code> on every chunk iteration here? Under high throughput scenarios (&gt;50k req/s), V8 GC spikes significantly when allocating short-lived buffers in this hot path.</p><p>Have we considered reusing the pooled <code>SlabBuffer</code> or borrowing from the connection ring buffer directly?</p><p>Suggested pattern:</p><pre><code>const pooled = connection.borrowBuffer(chunk.length);\n</code></pre>',
          {
            kind: 'reviewComment',
            reviewState: 'CHANGES_REQUESTED',
            authorAssociation: 'MEMBER',
            reactions: [
              { content: 'THUMBS_UP', count: 3, viewerHasReacted: false },
              { content: 'EYES', count: 2, viewerHasReacted: true },
              { content: 'HEART', count: 1, viewerHasReacted: false },
            ],
          },
        ),
        comment(
          john,
          minutesAgo(12),
          'Great point Dan! I benchmarked `slabPool.acquire(len)` vs the ring buffer borrow. Ring buffer avoids GC completely but requires cross-thread synchronization during concurrent AST worker spawns.\n\nI updated line 141 to use the shared slab allocator which reclaimed 92% of the GC pauses without locking overhead. If you prefer, I can introduce per-worker ring buffers in a follow-up commit today!',
          '<p>Great point Dan! I benchmarked <code>slabPool.acquire(len)</code> vs the ring buffer borrow. Ring buffer avoids GC completely but requires cross-thread synchronization during concurrent AST worker spawns.</p><p>I updated line 141 to use the shared slab allocator which reclaimed 92% of the GC pauses without locking overhead. If you prefer, I can introduce per-worker ring buffers in a follow-up commit today!</p>',
          {
            kind: 'reviewComment',
            authorAssociation: 'OWNER',
            reactions: [{ content: 'ROCKET', count: 2, viewerHasReacted: false }],
          },
        ),
      ],
      updatedAt: minutesAgo(12),
      mentions: [],
    },
    {
      id: 'demo-thread-2',
      kind: 'inline',
      path: 'src/lexer/token-stream.rs',
      line: 88,
      startLine: null,
      diffSide: 'RIGHT',
      diffHunk: [
        '@@ -84,7 +84,9 @@ impl TokenStream {',
        '     fn next_glyph(&mut self) -> Option<char> {',
        '         match self.peek() {',
        '-            Some(c) => Some(c),',
        '+            Some(c) if c.is_ascii() => Some(c),',
        '+            Some(c) => self.decode_multibyte(c),',
      ].join('\n'),
      isResolved: false,
      isOutdated: false,
      viewerCanResolve: true,
      viewerCanUnresolve: true,
      reviewState: 'COMMENTED',
      comments: [
        comment(
          sarah,
          minutesAgo(120),
          "Nit: let's verify unicode boundary surrogate pairs in this match arm to prevent splitting multi-byte glyphs.\n\n```suggestion\n            Some(c) if c.len_utf8() > 1 => self.decode_multibyte(c),\n```",
          "<p>Nit: let's verify unicode boundary surrogate pairs in this match arm to prevent splitting multi-byte glyphs.</p>" +
            '<div class="my-2 border rounded-2 js-suggested-changes-blob diff-view js-check-hidden-unicode"><div class="f6 p-2 lh-condensed border-bottom d-flex"><div class="flex-auto flex-items-center color-fg-muted">Suggested change</div></div><div itemprop="text" class="blob-wrapper data file"><table class="d-table tab-size mb-0 width-full" data-paste-markdown-skip=""><tbody>' +
            '<tr class="border-0"><td class="blob-num blob-num-deletion text-right border-0 px-2 py-1 lh-default" data-line-number="88"></td><td class="border-0 px-2 py-1 blob-code-inner blob-code-deletion js-blob-code-deletion blob-code-marker-deletion">            Some(c) =&gt; self.decode_multibyte(c),</td></tr>' +
            '<tr class="border-0"><td class="blob-num blob-num-addition text-right border-0 px-2 py-1 lh-default" data-line-number="88"></td><td class="border-0 px-2 py-1 blob-code-inner blob-code-addition js-blob-code-addition blob-code-marker-addition">            Some(c) <span class="x x-first x-last">if c.len_utf8() &gt; 1 </span>=&gt; self.decode_multibyte(c),</td></tr>' +
            '</tbody></table></div></div>',
          { kind: 'reviewComment', reviewState: 'COMMENTED' },
        ),
        comment(
          john,
          minutesAgo(95),
          'Good catch, added a test with 🎉 and a combining character in `token_stream_tests.rs`.',
          '<p>Good catch, added a test with 🎉 and a combining character in <code>token_stream_tests.rs</code>.</p>',
          { kind: 'reviewComment', authorAssociation: 'OWNER' },
        ),
      ],
      updatedAt: minutesAgo(95),
      mentions: [],
    },
    {
      id: 'demo-thread-3',
      kind: 'inline',
      path: 'infra/docker/benchmarks.yml',
      line: 19,
      startLine: null,
      diffSide: 'RIGHT',
      diffHunk: [
        '@@ -15,6 +15,8 @@ services:',
        '   bench:',
        '     image: syntax-engine/bench:latest',
        '+    deploy:',
        '+      resources:',
        '+        limits: { memory: 512M }',
      ].join('\n'),
      isResolved: true,
      isOutdated: true,
      viewerCanResolve: true,
      viewerCanUnresolve: true,
      reviewState: 'COMMENTED',
      comments: [
        comment(
          alex,
          minutesAgo(240),
          'CI runner memory threshold looks low for the stress test step. Bump to 1G?\n\n```suggestion\n        limits: { memory: 1G }\n```',
          '<p>CI runner memory threshold looks low for the stress test step. Bump to 1G?</p><pre lang="suggestion" class="notranslate"><code class="notranslate">        limits: { memory: 1G }\n</code></pre>',
          { kind: 'reviewComment', reviewState: 'COMMENTED' },
        ),
        comment(john, minutesAgo(200), 'Done in 4f2a9c1.', '<p>Done in 4f2a9c1.</p>', {
          kind: 'reviewComment',
          authorAssociation: 'OWNER',
        }),
      ],
      updatedAt: minutesAgo(200),
      mentions: [],
    },
  ];

  const topLevel: Comment[] = [
    comment(
      sophia,
      minutesAgo(60 * 26),
      'Great cleanup of the legacy AST visitor, benchmark showed +14% throughput in cold runs!',
      '<p>Great cleanup of the legacy AST visitor, benchmark showed +14% throughput in cold runs!</p>',
      { kind: 'review', reviewState: 'APPROVED', authorAssociation: 'MEMBER' },
    ),
    comment(
      john,
      minutesAgo(60 * 25),
      'Thanks @sophia-core! The visitor rewrite also drops the recursion depth limit, so deeply nested templates parse now.',
      `<p>Thanks ${mention('sophia-core')}! The visitor rewrite also drops the recursion depth limit, so deeply nested templates parse now.</p>`,
      { authorAssociation: 'OWNER' },
    ),
    comment(
      dan,
      minutesAgo(60 * 24),
      '@sophia-core did you run the warm benchmark too? Cold runs tend to overstate wins from allocator changes.',
      `<p>${mention('sophia-core')} did you run the warm benchmark too? Cold runs tend to overstate wins from allocator changes.</p>`,
      { authorAssociation: 'MEMBER' },
    ),
    comment(
      sophia,
      minutesAgo(60 * 23),
      'Warm runs are +9%, still solid. Numbers are in the PR description table.',
      '<p>Warm runs are +9%, still solid. Numbers are in the PR description table.</p>',
      { authorAssociation: 'MEMBER' },
    ),
    comment(
      secops,
      minutesAgo(60 * 22),
      '**Dependency security advisory GHSA-79v8**: bump minor version to `2.4.1` to patch memory leak vector.\n\n- [ ] Update `package.json`\n- [ ] Re-run `npm audit`',
      '<p><strong>Dependency security advisory GHSA-79v8</strong>: bump minor version to <code>2.4.1</code> to patch memory leak vector.</p><ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" disabled> Update <code>package.json</code></li><li class="task-list-item"><input type="checkbox" disabled> Re-run <code>npm audit</code></li></ul>',
      { authorAssociation: 'NONE' },
    ),
    comment(
      dan,
      minutesAgo(30),
      'Requesting changes for the buffer allocation on the hot path, see inline.',
      '<p>Requesting changes for the buffer allocation on the hot path, see inline.</p>',
      { kind: 'review', reviewState: 'CHANGES_REQUESTED', authorAssociation: 'MEMBER' },
    ),
  ];

  const threads = [...inline, ...buildTopLevelThreads(topLevel)];

  return {
    owner: DEMO_OWNER,
    repo: DEMO_REPO,
    viewer: john,
    pr: {
      id: 'demo-pr',
      number: DEMO_NUMBER,
      title: 'feat: streaming AST compiler with slab-allocated chunks',
      url: 'https://github.com/octocat/syntax-engine/pull/1428',
      state: 'OPEN',
      isDraft: false,
      baseRefName: 'main',
      headRefName: 'feat/stream-ast',
      headRefOid: '4f2a9c1e0b7d3a5c6f8e9d0a1b2c3d4e5f6a7b8c',
      author: john,
      reviewDecision: 'CHANGES_REQUESTED',
      changedFiles: 14,
      additions: 612,
      deletions: 208,
      createdAt: minutesAgo(60 * 48),
    },
    threads,
    fetchedAt: new Date().toISOString(),
    demo: true,
  };
}

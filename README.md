# PR Comment Inbox

A comment-centric view of GitHub pull requests. The left pane is an inbox of
review threads (inline code comments and top-level conversation comments); the
right pane shows the selected thread with its diff context, a GitHub-style
markdown reply box, and resolve / mark-read controls.

Built with [Astro](https://astro.build) (server output on
[Cloudflare Workers](https://workers.cloudflare.com)), [Preact](https://preactjs.com)
islands, and [Tailwind CSS v4](https://tailwindcss.com). Light and dark mode follow
the system and can be toggled.

## How threads work

| Thread type | Left pane shows              | Right pane shows                                                                                  | Resolve                                             |
| ----------- | ---------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Inline      | First comment of the thread  | The GitHub review thread as-is, with the diff hunk                                                | Real GitHub resolve/unresolve (GraphQL)             |
| Top-level   | First comment by each author | Every top-level comment (or review body) by that author, plus any comment that `@mentions` them   | Hidden locally; stored in `localStorage`            |

"Mark read" hides a thread from the Unresolved / @mentions views until it gets new
activity (the read marker stores the thread's last-activity time). Read state is also
kept in `localStorage`, per pull request.

Replies use the GitHub API: inline replies go to the review thread; top-level replies
are posted as new PR comments and are pre-filled with `@author` so they land in the
same thread. Markdown previews are rendered by GitHub's `/markdown` endpoint, so what
you see is what GitHub will show.

## Setup

```bash
npm install
npm run dev
```

Then open <http://localhost:4321>. There are two ways to sign in:

1. **Personal access token** (works immediately). Paste a classic token with the
   `repo` scope, or a fine-grained token with *Pull requests: read & write*. It's
   stored in an HTTP-only cookie and only ever sent to `api.github.com` by the worker.
2. **GitHub OAuth app** (optional). Create an OAuth app at
   <https://github.com/settings/developers> with the callback URL
   `http://localhost:4321/api/auth/callback` (or your deployed origin), copy
   `.dev.vars.example` to `.dev.vars`, and fill in `GITHUB_CLIENT_ID` and
   `GITHUB_CLIENT_SECRET`. A "Sign in with GitHub" button appears when both are set.

No token handy? <http://localhost:4321/demo/demo/pull/1> loads a fixture pull request
where replies and resolves are simulated locally.

## Deploy

```bash
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npm run deploy
```

Both secrets are optional; skip them to use token sign-in only.

## Project layout

```
src/
  components/      Preact islands (App, Sidebar, ThreadView, CommentEditor, DiffHunk, …)
  layouts/         Base HTML layout with the theme bootstrap script
  lib/github.ts    GraphQL queries, mutations, and thread normalization
  lib/demo.ts      Fixture data for the demo pull request
  lib/ui.ts        Formatting helpers, diff-hunk parser, localStorage helpers
  pages/           Sign-in page, PR page, and /api routes (auth, pr data, reply, resolve, markdown)
  middleware.ts    Reads the token cookie into Astro.locals
```

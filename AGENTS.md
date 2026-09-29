# AGENTS

## Project overview

PR Comment Inbox is an Astro + Preact application for triaging and replying to GitHub pull request comments.

- **Frontend:** Preact components in `src/components`
- **Server/API:** Astro pages and API routes in `src/pages` and `src/pages/api`
- **Domain logic:** data normalization and helpers in `src/lib`
- **Runtime target:** Cloudflare Workers (`@astrojs/cloudflare`, `wrangler`)
- **Styling:** Tailwind CSS
- **Testing:** Vitest (`*.spec.ts`/`*.spec.tsx`)

## Contribution rules

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.
- Use conventional commit format for pull request titles.
- Add and maintain JSDoc comments for functions, including:
  - `@param` for every parameter
  - `@returns` for non-void returns
  - `@throws` for thrown errors
- Add a top-level `@fileoverview` JSDoc comment to TypeScript files explaining the file purpose.
- Prefer multi-line block statements for `if` and `while` conditions.

## Testing guidance

- **Unit tests** validate a single function/module in isolation and should live next to the source file as `*.spec.ts`/`*.spec.tsx`.
- **Integration tests** validate behavior across multiple modules or workflows and should live in the top-level `tests/` directory.
- Keep tests focused on observable behavior and avoid coupling to implementation details when possible.

## Helpful project structure

- `src/components`: interactive UI (thread list, thread detail, editor, etc.)
- `src/lib`: GitHub API clients, parsing/formatting helpers, and shared types
- `src/pages`: route entrypoints and API handlers
- `tests`: integration test coverage
- `public`: static assets

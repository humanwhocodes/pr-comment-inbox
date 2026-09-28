# AGENTS

## Contribution rules

- Use [Conventional Commits](https://www.conventionalcommits.org/) for all commit messages.
- Use conventional commit format for pull request titles.
- Add and maintain JSDoc comments for functions, including:
  - `@param` for every parameter
  - `@returns` for non-void returns
  - `@throws` for thrown errors
- Prefer multi-line block statements for `if` and `while` conditions.
- Add unit tests as `*.spec.ts` / `*.spec.tsx` files next to source files.
- Keep integration tests in the top-level `tests/` directory.

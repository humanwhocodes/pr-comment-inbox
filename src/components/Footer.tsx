import { MarkGithubIcon } from './Icons';

interface Props {
  class?: string;
}

export default function Footer({ class: className = '' }: Props) {
  return (
    <footer class={`flex items-center justify-between gap-4 text-xs text-fg-muted ${className}`}>
      <span>
        Made with <span aria-label="love">❤️</span> by{' '}
        <a href="https://humanwhocodes.com" target="_blank" rel="noreferrer" class="text-accent hover:underline">
          Nicholas C. Zakas
        </a>
      </span>
      <span class="flex items-center gap-2">
        <a
          href="https://github.com/humanwhocodes/pr-comment-inbox"
          target="_blank"
          rel="noreferrer"
          class="flex items-center gap-1 text-accent hover:underline"
        >
          <MarkGithubIcon size={12} />
          Source
        </a>
        <span aria-hidden="true">|</span>
        <a href="https://humanwhocodes.com/donate" target="_blank" rel="noreferrer" class="text-accent hover:underline">
          Donate
        </a>
      </span>
    </footer>
  );
}

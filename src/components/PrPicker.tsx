import { useState } from 'preact/hooks';
import { GitPullRequestIcon } from './Icons';

/** Accepts a full GitHub PR URL, `owner/repo#123`, or `owner/repo/pull/123`. */
export function parsePrReference(input: string): { owner: string; repo: string; number: number } | null {
  const text = input.trim();
  const url = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i.exec(text);
  if (url) return { owner: url[1], repo: url[2], number: Number(url[3]) };
  const short = /^([^/\s#]+)\/([^/\s#]+)(?:#|\/pull\/)(\d+)$/i.exec(text);
  if (short) return { owner: short[1], repo: short[2], number: Number(short[3]) };
  return null;
}

export default function PrPicker() {
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  function submit(e: Event) {
    e.preventDefault();
    const ref = parsePrReference(value);
    if (!ref) {
      setInvalid(true);
      return;
    }
    window.location.href = `/${ref.owner}/${ref.repo}/pull/${ref.number}`;
  }

  return (
    <form onSubmit={submit} class="flex flex-col gap-2">
      <label class="text-sm font-medium" for="pr-ref">
        Open a pull request
      </label>
      <div class="flex gap-2">
        <input
          id="pr-ref"
          value={value}
          onInput={(e) => {
            setValue((e.target as HTMLInputElement).value);
            setInvalid(false);
          }}
          placeholder="https://github.com/owner/repo/pull/123 or owner/repo#123"
          class="min-w-0 flex-1 rounded-md border border-border bg-canvas px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        <button type="submit" class="btn btn-primary">
          <GitPullRequestIcon /> Open
        </button>
      </div>
      {invalid && <p class="text-xs text-danger">Enter a GitHub pull request URL or owner/repo#number.</p>}
    </form>
  );
}

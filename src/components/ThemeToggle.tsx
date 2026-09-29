/**
 * @fileoverview Handles light/dark theme toggling and persistence in the UI.
 */

import { useEffect, useState } from 'preact/hooks';
import { MoonIcon, SunIcon } from './Icons';

function currentlyDark() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(currentlyDark);

  useEffect(() => {
    setDark(currentlyDark());
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light');
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      class="btn btn-sm"
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

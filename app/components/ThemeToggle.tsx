'use client';

import { Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'music-delight-theme';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const prefersDark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(prefersDark);
    if (!prefersDark) {
      document.body.classList.add('light-mode');
    }
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      if (next) {
        document.body.classList.remove('light-mode');
        window.localStorage.setItem(STORAGE_KEY, 'dark');
      } else {
        document.body.classList.add('light-mode');
        window.localStorage.setItem(STORAGE_KEY, 'light');
      }
      return next;
    });
  }, []);

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '11px 12px',
        border: '1px solid rgba(148,163,184,.14)',
        borderRadius: 11,
        background: 'transparent',
        color: '#8995ad',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{dark ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
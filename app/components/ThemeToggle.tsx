'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [light, setLight] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem('music-delight-theme');
    const nextLight = saved !== 'dark';
    setLight(nextLight);
    document.body.classList.toggle('light-mode', nextLight);
  }, []);

  const toggle = () => {
    const nextLight = !light;
    setLight(nextLight);
    document.body.classList.toggle('light-mode', nextLight);
    window.localStorage.setItem('music-delight-theme', nextLight ? 'light' : 'dark');
  };

  return <button className="themeToggle" onClick={toggle} aria-label={`Switch to ${light ? 'dark' : 'light'} mode`} title={`Switch to ${light ? 'dark' : 'light'} mode`}>
    {light ? <Moon size={16}/> : <Sun size={16}/>} <span>{light ? 'Dark' : 'Light'}</span>
    <style jsx global>{`.themeToggle{position:fixed;right:18px;top:16px;z-index:5000;display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid rgba(148,163,184,.24);border-radius:10px;background:rgba(15,23,42,.9);color:#e2e8f0;font-size:11px;font-weight:800;cursor:pointer;box-shadow:0 6px 20px rgba(15,23,42,.16)}.light-mode .themeToggle{background:#fff;color:#334155;border-color:#cbd5e1}@media(max-width:900px){.themeToggle{top:11px;right:64px}}`}</style>
  </button>;
}

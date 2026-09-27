import { useEffect, useState } from 'react';

export interface Settings { theme: 'auto' | 'dark' | 'light'; confirmTouch: boolean; size: 9 | 13 | 19 }
const KEY = 'go.settings.v1';
const DEFAULTS: Settings = { theme: 'auto', confirmTouch: true, size: 9 };

function read(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(read);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
    const root = document.documentElement;
    if (s.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', s.theme);
  }, [s]);
  return [s, patch => setS(prev => ({ ...prev, ...patch }))];
}

export function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  return [v, next => { setV(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignoré */ } }];
}

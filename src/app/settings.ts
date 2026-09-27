import { useEffect, useState, useSyncExternalStore } from 'react';
import { themeGoban, type IdThemeGoban, type ThemeGoban } from '../ui/boardArt';
import { lireXp, niveauDe, themeDebloque } from './xp';
import { installAudioUnlock, setSoundEnabled } from '../ui/sound';
import { setHapticsEnabled } from '../ui/haptics';
import type { ReglageAide } from './partie';

// `aide` : « Aide de Mochi en partie » (#35). `auto` : contre Pomme et Caillou seulement.
// `vibrations` : réglable à part du son (#165).
export interface Settings { theme: 'auto' | 'dark' | 'light'; confirmTouch: boolean; size: 9 | 13 | 19; sound: boolean; vibrations: boolean; celebrations: boolean; aide: ReglageAide }
const KEY = 'go.settings.v1';
const DEFAULTS: Settings = { theme: 'auto', confirmTouch: true, size: 9, sound: true, vibrations: true, celebrations: true, aide: 'auto' };

function read(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [s, setS] = useState<Settings>(read);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
    const root = document.documentElement;
    if (s.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', s.theme);
    // Sons du goban (réglage « Sons ») : le contexte audio démarre au premier geste.
    setSoundEnabled(s.sound);
    if (s.sound) installAudioUnlock();
    setHapticsEnabled(s.vibrations);
  }, [s]);
  return [s, patch => setS(prev => ({ ...prev, ...patch }))];
}

export function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  return [v, next => { setV(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignoré */ } }];
}

// --- Thème du goban (#109) : gardé sur l'appareil, appliqué seulement s'il est débloqué par le niveau. ---
export const THEME_GOBAN_KEY = 'go.themeGoban.v1';
const abonnesTheme = new Set<() => void>();

export function lireThemeGoban(): IdThemeGoban {
  let id: string | null = null;
  try { id = JSON.parse(localStorage.getItem(THEME_GOBAN_KEY) || 'null'); } catch { /* stockage indisponible */ }
  const t = themeGoban(id);
  return themeDebloque(t.id, niveauDe(lireXp()).niveau) ? t.id : 'kaya';
}

export function choisirThemeGoban(id: IdThemeGoban): void {
  try { localStorage.setItem(THEME_GOBAN_KEY, JSON.stringify(id)); } catch { /* le choix reste pour la session */ }
  abonnesTheme.forEach(fn => fn());
}

const abonnerTheme = (fn: () => void) => { abonnesTheme.add(fn); return () => { abonnesTheme.delete(fn); }; };

/** Identifiant du thème choisi, mis à jour dans tous les écrans quand le Profil le change. */
export function useIdThemeGoban(): IdThemeGoban {
  return useSyncExternalStore(abonnerTheme, lireThemeGoban, () => 'kaya');
}
export function useThemeGoban(): ThemeGoban {
  return themeGoban(useIdThemeGoban());
}

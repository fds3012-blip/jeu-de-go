import { useEffect, useState, useSyncExternalStore } from 'react';
import { themeGoban, type IdThemeGoban, type ThemeGoban } from '../ui/boardArt';
import { lireXp, niveauDe, themeDebloque } from './xp';
import { installAudioUnlock, setSoundEnabled } from '../ui/sound';
import { setHapticsEnabled } from '../ui/haptics';
import { noterReglage } from './reglagesDates';
import type { ReglageAide } from './aideMochi';
import type { Cadence } from '../go/pendule';

// `aide` : « Aide de Mochi en partie » (#35). `auto` : contre Pomme et Caillou seulement.
// `vibrations` : réglable à part du son (#165).
// #365 (joueur de club) : `coordonnees` (lettres et chiffres autour du goban des parties et de la revue), `dernierCoup`
// (rond sur la dernière pierre posée), `numerosRevue` (numéros des coups sur les pierres, en revue), `cadence` (temps
// de jeu proposé d'abord pour une partie en direct), `serieVisible` (flamme, record et fêtes de série). Gardés sur
// l'appareil ; avec un compte, aussi synchronisés entre ses appareils (#448, src/data/reglages.ts).
export interface Settings {
  theme: 'auto' | 'dark' | 'light'; confirmTouch: boolean; size: 9 | 13 | 19; sound: boolean; vibrations: boolean; celebrations: boolean; aide: ReglageAide;
  coordonnees: boolean; dernierCoup: boolean; numerosRevue: boolean; cadence: Cadence; serieVisible: boolean;
  /** Coach Mochi pendant les parties contre l'IA (#470). Voir `coachActif`. */
  coach: ReglageCoach;
}

/** Coach Mochi (#470) : `auto` = pendant les 10 premières parties (par défaut), `oui` = toujours, `non` = jamais. */
export type ReglageCoach = 'auto' | 'oui' | 'non';
/** Parties pendant lesquelles le coach est actif par défaut. */
export const PARTIES_AVEC_COACH = 10;
/** Le coach parle-t-il dans cette partie ? `partiesJouees` : parties déjà finies sur l'appareil (compteur de l'accueil). */
export function coachActif(reglage: ReglageCoach | undefined, partiesJouees: number): boolean {
  if (reglage === 'oui') return true;
  if (reglage === 'non') return false;
  return partiesJouees < PARTIES_AVEC_COACH;
}
const KEY = 'go.settings.v1';
/** Valeurs par défaut (#448 : un réglage jamais changé n'est pas envoyé au serveur). */
export const DEFAULTS: Settings = {
  theme: 'auto', confirmTouch: true, size: 9, sound: true, vibrations: true, celebrations: true, aide: 'auto',
  coordonnees: true, dernierCoup: true, numerosRevue: false, cadence: 'normale', serieVisible: true, coach: 'auto',
};
const CADENCES_CONNUES: readonly string[] = ['rapide', 'normale', 'lente'];

/** Réglages lus, valeurs abîmées remplacées par celles par défaut (stockage modifié à la main, ancienne version). */
export function lireSettings(brut: unknown): Settings {
  const o = brut && typeof brut === 'object' ? (brut as Record<string, unknown>) : {};
  const s = { ...DEFAULTS, ...o } as Settings;
  for (const k of ['coordonnees', 'dernierCoup', 'numerosRevue', 'serieVisible'] as const) if (typeof s[k] !== 'boolean') s[k] = DEFAULTS[k];
  if (!CADENCES_CONNUES.includes(s.cadence)) s.cadence = DEFAULTS.cadence;
  if (!(['auto', 'oui', 'non'] as unknown[]).includes(s.coach)) s.coach = DEFAULTS.coach;
  return s;
}

function read(): Settings {
  try { return lireSettings(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { return DEFAULTS; }
}

// --- Préférences de plateau et de série (#365), lues par les écrans sans passer de props ---
/** Ce que les écrans de partie, de revue et d'étude lisent des réglages, sans que l'App le leur passe. */
export type Preferences = Pick<Settings, 'coordonnees' | 'dernierCoup' | 'numerosRevue' | 'serieVisible' | 'cadence'>;
let preferences: Preferences = extrairePreferences(read());
const abonnesPrefs = new Set<() => void>();
function extrairePreferences(s: Settings): Preferences {
  return { coordonnees: s.coordonnees, dernierCoup: s.dernierCoup, numerosRevue: s.numerosRevue, serieVisible: s.serieVisible, cadence: s.cadence };
}
/** Publie les préférences (même objet tant que rien ne change : pas de rendu inutile). */
function publierPreferences(s: Settings): void {
  const p = extrairePreferences(s);
  if ((Object.keys(p) as (keyof Preferences)[]).every(k => p[k] === preferences[k])) return;
  preferences = p;
  abonnesPrefs.forEach(fn => fn());
}
const abonnerPrefs = (fn: () => void) => { abonnesPrefs.add(fn); return () => { abonnesPrefs.delete(fn); }; };
/** Préférences courantes, mises à jour dans tous les écrans quand les Réglages changent. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(abonnerPrefs, () => preferences, () => preferences);
}

// Réglages partagés par tous les écrans (#448 : la synchronisation du compte les change aussi, sans passer par React).
let courant: Settings = read();
const abonnesSettings = new Set<() => void>();
const abonnerSettings = (fn: () => void) => { abonnesSettings.add(fn); return () => { abonnesSettings.delete(fn); }; };

/** Réglages courants (lecture hors React). */
export const settingsCourants = (): Settings => courant;

/**
 * Change des réglages sans noter de date de changement : sert à la synchronisation du compte (#448), qui applique
 * les valeurs reçues du serveur. Les changements du joueur passent par `useSettings`, qui note la date.
 */
export function appliquerSettings(patch: Partial<Settings>): void {
  const s = lireSettings({ ...courant, ...patch });
  if ((Object.keys(s) as (keyof Settings)[]).every(k => s[k] === courant[k])) return;
  courant = s;
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ }
  publierPreferences(s);
  abonnesSettings.forEach(fn => fn());
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const s = useSyncExternalStore(abonnerSettings, settingsCourants, settingsCourants);
  useEffect(() => {
    const root = document.documentElement;
    if (s.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', s.theme);
    // Sons du goban (réglage « Sons ») : le contexte audio démarre au premier geste.
    setSoundEnabled(s.sound);
    if (s.sound) installAudioUnlock();
    setHapticsEnabled(s.vibrations);
    publierPreferences(s);
  }, [s]);
  return [s, patch => {
    // #448 : chaque réglage vraiment changé par le joueur est daté, pour la synchronisation entre ses appareils.
    for (const k of Object.keys(patch) as (keyof Settings)[]) if (patch[k] !== undefined && patch[k] !== courant[k]) noterReglage(k);
    appliquerSettings(patch);
  }];
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

/** Lit le décor choisi tel qu'il est gardé (sans le contrôle du niveau) : sert à la synchronisation (#448). */
export function themeGobanGarde(): IdThemeGoban | null {
  try { const id = JSON.parse(localStorage.getItem(THEME_GOBAN_KEY) || 'null') as unknown; return typeof id === 'string' ? themeGoban(id).id : null; } catch { return null; }
}

/** Décor choisi dans le Profil. `noter` : faux quand il vient du serveur (#448), pour ne pas le dater de nouveau. */
export function choisirThemeGoban(id: IdThemeGoban, noter = true): void {
  if (noter) noterReglage('themeGoban');
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

// Connexion avec Google (#354), Apple et Facebook (#411, docs/growth/connexion-google-apple.md, 4.2 et 4.3). Google refuse la connexion dans
// les navigateurs intégrés aux apps (erreur `disallowed_useragent`) : Messenger, Facebook, Instagram, TikTok, LINE,
// Snapchat, et toute WebView Android (`; wv)`). Dans l'app installée sur l'écran d'accueil d'iPhone, la session
// reviendrait dans Safari et pas dans l'app. Là, le bouton Google est caché et le code par e-mail est l'action
// principale. En cas de doute, Google reste montré : le code est juste en dessous.
// Module pur : tout ce qu'il lit est passé en paramètre (testé avec des agents utilisateurs réels).

/** Agents utilisateurs des navigateurs intégrés. Base commune avec src/app/installation.ts. */
const INTEGRE = /FBAN\/|FBAV\/|FB_IAB\/|FB4A|MessengerForiOS|Orca-Android|Instagram|Line\/|Snapchat|TikTok|musical_ly|BytedanceWebview|; wv\)/i;

export type Os = 'android' | 'ios' | 'autre';

export interface Appareil {
  userAgent: string;
  /** `navigator.platform` : les iPad récents se déclarent « MacIntel ». */
  platform?: string;
  maxTouchPoints?: number;
  /** `navigator.standalone` (Safari iOS) ou `(display-mode: standalone)` : l'app installée est ouverte. */
  installee?: boolean;
}

export interface ContexteNavigateur {
  os: Os;
  /** Navigateur intégré à une app (Google y est bloqué). */
  integre: boolean;
  /** App installée sur l'écran d'accueil d'un iPhone ou d'un iPad (phase 1 : pas de Google). */
  appIos: boolean;
}

export function contexteNavigateur(a: Appareil): ContexteNavigateur {
  const ua = a.userAgent ?? '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (a.platform === 'MacIntel' && (a.maxTouchPoints ?? 0) > 1);
  const os: Os = ios ? 'ios' : /Android/i.test(ua) ? 'android' : 'autre';
  return { os, integre: INTEGRE.test(ua), appIos: ios && a.installee === true };
}

/**
 * Aide sous le code quand les fournisseurs (Google, Apple, Facebook : src/app/fournisseurs.ts) sont cachés par un
 * navigateur intégré : ouvrir dans Chrome (Android) ou Safari (iPhone). `active` : au moins un fournisseur réglé.
 */
export function aideNavigateur(c: ContexteNavigateur, active: boolean): 'android' | 'ios' | null {
  if (!active || !c.integre) return null;
  return c.os === 'android' ? 'android' : c.os === 'ios' ? 'ios' : null;
}

/**
 * Lien `intent://` qui ouvre la même page dans Chrome (Android). Si Chrome manque, `browser_fallback_url` rouvre la
 * page telle quelle. Le fragment n'y passe pas (la syntaxe `#Intent;…` l'occupe) ; de toute façon, le jeton d'un défi
 * est déjà retiré de l'adresse au chargement (src/app/adresseDefi.ts, constat E14) : il ne doit pas fuiter ici non plus.
 */
export function lienChrome(adresse: string): string {
  const u = new URL(adresse);
  const page = `${u.host}${u.pathname}${u.search}`;
  const repli = encodeURIComponent(`${u.protocol}//${page}`);
  return `intent://${page}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${repli};end`;
}

/** Contexte de ce navigateur (lecture de `navigator`). */
export function contexteActuel(): ContexteNavigateur {
  if (typeof navigator === 'undefined') return { os: 'autre', integre: false, appIos: false };
  const nav = navigator as Navigator & { standalone?: boolean };
  const installee = nav.standalone === true || (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches === true);
  return contexteNavigateur({ userAgent: nav.userAgent, platform: nav.platform, maxTouchPoints: nav.maxTouchPoints, installee });
}

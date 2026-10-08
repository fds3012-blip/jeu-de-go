// Aperçus riches des liens partagés (#285, #364), sans serveur : des pages statiques produites au build.
//
// WhatsApp, Messages, Discord ou Slack lisent les balises Open Graph de la page du lien, sans exécuter le JS et sans
// le fragment (`#…`). Pour qu'un lien de défi, de partie ou de Go du jour ait son propre titre et sa propre image, chaque
// lien court a donc sa page : une copie de dist/index.html (la même app, octet pour octet hors des balises d'aperçu),
// servie par une réécriture de vercel.json. Aucune fonction serveur, aucun coût : des fichiers statiques.
//
// - `/en` : l'accueil en anglais, même promesse que `/` (index.html) et même image avec Mochi, en anglais (#489) ;
// - `/defi`, `/en/defi` : « Un ami te défie au go » (le jeton est dans le fragment : jamais lu par le serveur) ;
// - `/partie`, `/en/partie` : « Une partie de go à revoir » ;
// - `/j/N`, `/en/j/N` : « Go du jour n° N », du jour J−30 au jour J+45 (date du build) ; au-delà, `404.html`, la même app
//   avec l'aperçu général. Le problème n'est jamais lisible sur l'image (pas de spoiler) ;
// - `404.html` : toute adresse inconnue ouvre l'app (aperçu général), au lieu de la page 404 de l'hébergeur.
// Ces pages portent `noindex` et pas de lien canonique : seules `/` et les pages de référencement sont indexées.
// index.html remet l'adresse à sa forme habituelle avant tout le reste (fonction `adresseCourte`).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

export const SITE = 'https://mochi-go.app';
/** Go du jour n° 1 (src/app/goDuJour.ts, LANCEMENT). */
const LANCEMENT = '2026-09-27';
/** Pages du Go du jour : de J−AVANT à J+APRES autour de la date du build. */
export const AVANT = 30;
export const APRES = 45;

export interface Apercu {
  /** Chemin de la page (`defi`, `en/j/42`) ; vide pour la page 404. */
  chemin: string;
  langue: 'fr' | 'en';
  titre: string;
  description: string;
  image: string;
  imageAlt: string;
}

const DESCRIPTION_JOUR = {
  fr: 'Un défi de go par jour. Gratuit, sans compte : ta première pierre en 1 minute.',
  en: 'One go puzzle a day. Free, no account: your first stone in 1 minute.',
};
const ALT_JOUR = {
  fr: 'Un goban avec quelques pierres et la question : trouveras-tu le bon coup ?',
  en: 'A go board with a few stones and the question: can you find the right move?',
};

/** Aperçus fixes : accueil anglais, défi par lien et partie partagée (ou étude, même lien), en français et en anglais. */
export const APERCUS_FIXES: readonly Apercu[] = [
  { chemin: 'en', langue: 'en', titre: 'Mochi Go: learn Go by playing', image: 'apercu-accueil-en.png',
    description: 'Beginners welcome: lessons, puzzles, games against the computer or your friends. Free, no ads.',
    imageAlt: 'Mochi, the little coach cat, next to a go board: learn Go by playing, beginners welcome.' },
  { chemin: 'defi', langue: 'fr', titre: 'Un ami te défie au go', image: 'apercu-defi.png',
    description: 'Partie 9 × 9, 3 jours par coup. Gratuit : ouvre le lien et joue ton premier coup.',
    imageAlt: 'Deux pierres de go face à face et l’invitation : un ami te défie.' },
  { chemin: 'en/defi', langue: 'en', titre: 'A friend challenges you to a game of go', image: 'apercu-defi-en.png',
    description: '9 × 9 game, 3 days per move. Free: open the link and play your first move.',
    imageAlt: 'Two go stones face to face and the invitation: a friend challenges you.' },
  { chemin: 'partie', langue: 'fr', titre: 'Une partie de go à revoir', image: 'apercu-partie.png',
    description: 'Revois cette partie coup par coup, sans compte. Puis joue la tienne : c’est gratuit.',
    imageAlt: 'Un goban en fin de partie et l’invitation à la revoir.' },
  { chemin: 'en/partie', langue: 'en', titre: 'A go game to replay', image: 'apercu-partie-en.png',
    description: 'Replay this game move by move, no account needed. Then play your own: it’s free.',
    imageAlt: 'A go board at the end of a game and the invitation to replay it.' },
];

/** Aperçu du Go du jour n° `n`. */
export function apercuJour(n: number, langue: 'fr' | 'en'): Apercu {
  return langue === 'fr'
    ? { chemin: `j/${n}`, langue, titre: `Go du jour n° ${n} : trouveras-tu le bon coup ?`, description: DESCRIPTION_JOUR.fr, image: 'apercu.png', imageAlt: ALT_JOUR.fr }
    : { chemin: `en/j/${n}`, langue, titre: `Daily go #${n}: can you find the right move?`, description: DESCRIPTION_JOUR.en, image: 'apercu-en.png', imageAlt: ALT_JOUR.en };
}

/** Numéro du Go du jour à une date (heure de Paris), comme `numeroDuJour` de src/app/goDuJour.ts. */
export function numeroAu(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const v = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const jour = (y: number, m: number, d: number) => Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
  const [ly, lm, ld] = LANCEMENT.split('-').map(Number);
  return jour(v('year'), v('month'), v('day')) - jour(ly, lm, ld) + 1;
}

/** Toutes les pages d'aperçu d'un build fait à `instant`. */
export function apercus(instant: Date): Apercu[] {
  const j = numeroAu(instant);
  const jours: Apercu[] = [];
  for (let n = Math.max(1, j - AVANT); n <= j + APRES; n++) jours.push(apercuJour(n, 'fr'), apercuJour(n, 'en'));
  return [...APERCUS_FIXES, ...jours];
}

const echapper = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Remplace le contenu d'une balise `<meta property|name="cle" content="…">` (erreur si elle manque). */
function remplacer(html: string, cle: string, valeur: string): string {
  const re = new RegExp(`(<meta\\s+(?:property|name)="${cle.replace(/[:.]/g, '\\$&')}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`Balise d'aperçu absente d'index.html : ${cle}`);
  return html.replace(re, (_t, a: string, b: string) => `${a}${echapper(valeur)}${b}`);
}

/** Page d'aperçu : index.html avec d'autres balises d'aperçu, `noindex`, et la langue de la page. */
export function pageApercu(html: string, a: Apercu | null): string {
  let h = html;
  if (a) {
    const url = `${SITE}/${a.chemin}`;
    const image = `${SITE}/${a.image}`;
    for (const [cle, v] of [
      ['og:url', url], ['og:title', a.titre], ['og:description', a.description], ['og:image', image], ['og:image:alt', a.imageAlt],
      ['twitter:title', a.titre], ['twitter:description', a.description], ['twitter:image', image], ['twitter:image:alt', a.imageAlt],
      ['og:locale', a.langue === 'en' ? 'en_US' : 'fr_FR'], ['og:locale:alternate', a.langue === 'en' ? 'fr_FR' : 'en_US'],
    ] as const) h = remplacer(h, cle, v);
    if (a.langue === 'en') h = h.replace('<html lang="fr">', '<html lang="en">');
  }
  // Pages d'aperçu et 404 non indexées : pas de doublon de `/` pour les moteurs, donc pas de lien canonique vers elle.
  h = h.replace(/\n\s*<link rel="canonical"[^>]*>/, '');
  return h.replace('<meta name="description"', '<meta name="robots" content="noindex" />\n    <meta name="description"');
}

/** Écrit les pages d'aperçu à côté de dist/index.html. */
export function ecrireApercus(dossier: string, instant = new Date()): string[] {
  const html = readFileSync(join(dossier, 'index.html'), 'utf8');
  const ecrits: string[] = [];
  const ecrire = (chemin: string, contenu: string) => {
    const f = join(dossier, chemin);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, contenu);
    ecrits.push(chemin);
  };
  for (const a of apercus(instant)) ecrire(`${a.chemin}/index.html`, pageApercu(html, a));
  ecrire('404.html', pageApercu(html, null));
  return ecrits;
}

interface Reecriture { source: string; destination: string }

/**
 * Réécritures de vercel.json appliquées à une adresse (`/j/42` → `/j/42/index.html`), ou null. Sous-ensemble de la
 * syntaxe de Vercel (path-to-regexp) : chemins fixes et paramètres `:nom` ou `:nom(motif)`.
 */
export function reecrire(chemin: string, reecritures: readonly Reecriture[]): string | null {
  for (const r of reecritures) {
    const noms: string[] = [];
    const motif = r.source.replace(/:(\w+)(\(([^)]*)\))?/g, (_t, nom: string, _p, re?: string) => { noms.push(nom); return `(${re ?? '[^/]+'})`; });
    const m = new RegExp(`^${motif}$`).exec(chemin);
    if (!m) continue;
    return noms.reduce((d, nom, i) => d.replace(`:${nom}`, m[i + 1]), r.destination);
  }
  return null;
}

/**
 * Plugin Vite : les pages d'aperçu, une fois dist/index.html écrit (build) ; et `vite preview` applique les mêmes
 * réécritures que Vercel (vercel.json), pour que les tests de bout en bout ouvrent les liens courts comme en production.
 */
export function pagesApercu(): Plugin {
  let dossier = 'dist';
  return {
    name: 'go-pages-apercu',
    configResolved(c) { dossier = join(c.root, c.build.outDir); },
    closeBundle() { if (existsSync(join(dossier, 'index.html'))) ecrireApercus(dossier); },
    configurePreviewServer(server) {
      const vercel = JSON.parse(readFileSync(join(server.config.root, 'vercel.json'), 'utf8')) as { rewrites?: Reecriture[] };
      server.middlewares.use((req, _res, next) => {
        const [chemin, requete] = (req.url ?? '/').split(/\?(.*)/s, 2);
        const cible = reecrire(chemin, vercel.rewrites ?? []);
        if (cible && existsSync(join(dossier, cible))) req.url = cible + (requete ? `?${requete}` : '');
        next();
      });
    },
  };
}

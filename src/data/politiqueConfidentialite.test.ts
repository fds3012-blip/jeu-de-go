// Cohérence entre le code et la politique de confidentialité (issues #223 et #111).
// La politique doit citer, dans la partie destinée aux joueurs (sections 1 à 8), chaque clé gardée sur l'appareil,
// chaque cache et chaque événement envoyé à PostHog : un ajout dans le code sans ligne dans
// docs/juridique/politique-confidentialite.md fait échouer ce test. La section 9 (écarts, pour Florian et l'avocat)
// ne compte pas : citer un événement seulement là ne suffit pas.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS } from './analytics';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const politique = readFileSync(join(racine, 'docs/juridique/politique-confidentialite.md'), 'utf8');

/** Texte entre deux titres (le second exclu), ou jusqu'à la fin. */
function entre(texte: string, debut: string, fin?: string): string {
  const i = texte.indexOf(debut);
  if (i < 0) return '';
  const j = fin ? texte.indexOf(fin, i + debut.length) : -1;
  return texte.slice(i, j < 0 ? undefined : j);
}
/** Partie publiée pour les joueurs : sections 1 à 8. */
const partieJoueurs = entre(politique, '## 1. ', '## 9. ');
const surAppareil = entre(politique, '### 3.1 ', '### 3.2 ');
const mesure = entre(politique, '### 3.3 ', '### 3.4 ');

/** Fichiers source hors tests (les tests sèment parfois des clés factices). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(nom => {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.(ts|tsx)$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}
const code = sources(join(racine, 'src')).map(f => ({ f: relative(racine, f), texte: readFileSync(f, 'utf8') }));

/** Clés de stockage local écrites en dur dans le code : 'go.xxx.v1', et les préfixes comme 'go.evenement.'. */
function clesDuCode(): string[] {
  const cles = new Set<string>();
  for (const { texte } of code) {
    for (const m of texte.matchAll(/['"`](go\.[a-z0-9-]+(?:\.[a-z0-9_-]+)*\.?)['"`]/gi)) cles.add(m[1]);
  }
  return [...cles].sort();
}

/** Événements cités dans la liste « Événements envoyés » de la section 3.3. */
function evenementsCites(): string[] {
  const liste = entre(mesure, '**Événements envoyés**', 'Chaque événement porte');
  return [...liste.matchAll(/`([a-z]+(?:_[a-z]+)*)`/g)].map(m => m[1]);
}

describe('politique de confidentialité et code', () => {
  it('trouve bien ses sections et des clés dans le code (garde-fou du test lui-même)', () => {
    expect(partieJoueurs.length).toBeGreaterThan(1000);
    expect(surAppareil).toContain('`go.settings.v1`');
    expect(mesure).toContain('`app_ouverte`');
    const cles = clesDuCode();
    expect(cles).toContain('go.consentement.v1');
    expect(cles).toContain('go.settings.v1');
    expect(cles).toContain('go.evenement.');
    expect(evenementsCites().length).toBeGreaterThan(20);
  });

  it('rappelle en tête qu’une relecture par un avocat ou un DPO est requise', () => {
    const tete = politique.slice(0, 800);
    expect(tete).toMatch(/avocat/);
    expect(tete).toMatch(/DPO/);
    expect(tete).toMatch(/avant la mise en production/);
  });

  it('cite chaque clé de stockage de l’appareil dans la section 3.1', () => {
    // Une clé suivie d'un nom (go.evenement.premiere_pierre) est couverte par son préfixe (go.evenement.).
    const cles = clesDuCode();
    const prefixes = cles.filter(k => k.endsWith('.'));
    const absentes = cles.filter(k => !surAppareil.includes('`' + k) && !prefixes.some(p => k !== p && k.startsWith(p)));
    expect(absentes).toEqual([]);
  });

  it('ne cite pas de clé qui n’existe plus dans le code', () => {
    const cles = clesDuCode();
    const citees = [...surAppareil.matchAll(/`(go\.[^`\s<]+)/g)].map(m => m[1]);
    const perimees = citees.filter(k => !cles.includes(k) && !cles.some(p => p.endsWith('.') && k.startsWith(p)));
    expect(perimees).toEqual([]);
  });

  it('cite les caches du navigateur (réseau de l’IA, service worker)', () => {
    const loader = readFileSync(join(racine, 'src/engine/katago/loader.ts'), 'utf8');
    const reseau = loader.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/)?.[1];
    expect(reseau).toBeTruthy();
    expect(surAppareil).toContain('`' + reseau + '`');

    const sw = readFileSync(join(racine, 'public/sw.js'), 'utf8');
    const version = sw.match(/const VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
    const modele = sw.match(/const CACHE\s*=\s*`([^`]+)`/)?.[1];
    expect(version && modele).toBeTruthy();
    expect(surAppareil).toContain('`' + modele!.replace('${VERSION}', version!) + '`');
  });

  it('cite la session de connexion Supabase gardée sur l’appareil', () => {
    // Sans `storageKey` ni `persistSession: false`, supabase-js garde la session dans localStorage sous `sb-<réf>-auth-token`.
    const client = readFileSync(join(racine, 'src/data/supabase.ts'), 'utf8');
    expect(client).toContain('createClient');
    expect(client).not.toMatch(/storageKey|persistSession/);
    expect(surAppareil).toContain('`sb-');
    expect(surAppareil).toMatch(/auth-token/);
  });

  it('cite chaque événement envoyé à PostHog dans la section 3.3', () => {
    const cites = evenementsCites();
    const absents = Object.values(EVENTS).filter(e => !cites.includes(e));
    expect(absents).toEqual([]);
  });

  it('ne cite pas en section 3.3 d’événement que le code n’envoie pas', () => {
    const connus: string[] = Object.values(EVENTS);
    expect(evenementsCites().filter(e => !connus.includes(e))).toEqual([]);
  });

  it('chaque événement de EVENTS est vraiment envoyé quelque part dans le code', () => {
    const cles = Object.keys(EVENTS);
    const hors = code.filter(({ f }) => !f.endsWith('src/data/analytics.ts')).map(({ texte }) => texte).join('\n');
    expect(cles.filter(k => !new RegExp(`EVENTS\\.${k}\\b`).test(hors))).toEqual([]);
  });

  it('aucun envoi ne contourne EVENTS ni analytics.ts', () => {
    const fautes: string[] = [];
    for (const { f, texte } of code) {
      if (f.endsWith('src/data/analytics.ts')) continue;
      // track('nom') ou trackOnce("nom") avec un nom écrit en dur : il échapperait à la liste de la politique.
      if (/\btrack(?:Once)?\(\s*['"`]/.test(texte)) fautes.push(`${f} : nom d'événement en dur`);
      // Import direct des SDK : tout envoi doit passer par analytics.ts (niveaux de consentement).
      if (/from\s+['"](posthog-js|@sentry\/[a-z-]+)['"]|import\(\s*['"](posthog-js|@sentry\/[a-z-]+)['"]\s*\)/.test(texte)) fautes.push(`${f} : SDK importé hors analytics.ts`);
    }
    expect(fautes).toEqual([]);
  });

  it('garde les marqueurs à compléter par Florian, sans coordonnées inventées', () => {
    expect(politique).toContain('[À COMPLÉTER PAR FLORIAN : nom ou raison sociale]');
    expect(politique).toContain('[À COMPLÉTER PAR FLORIAN : adresse postale]');
    expect(politique).toContain('[À COMPLÉTER PAR FLORIAN : adresse e-mail de contact]');
    // Aucune adresse e-mail réelle dans le texte destiné aux joueurs.
    expect(politique).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
  });

  it('décrit les données gardées par le défi par lien (#81) : défi, date limite, session sans compte', () => {
    const migration = readFileSync(join(racine, 'supabase/migrations/20260929003100_defi_par_lien.sql'), 'utf8');
    expect(migration).toMatch(/create table public\.defis/);
    expect(partieJoueurs).toContain('**Défi par lien**');
    expect(partieJoueurs).toMatch(/date limite du coup en cours/);
    expect(partieJoueurs).toContain('**Session sans compte**');
  });

  it('donne la même durée que la purge des sessions sans compte (#318)', () => {
    const purge = readFileSync(join(racine, 'supabase/migrations/20260929220100_purge_anonymes.sql'), 'utf8');
    const jours = purge.match(/purger_anonymes_inactifs\((\d+)\)/)?.[1];
    expect(jours).toBe('60');
    expect(partieJoueurs).toContain(`**${jours} jours sans activité**`);
  });

  it('décrit les limites des sessions sans compte (#316) : 3 défis en attente au plus', () => {
    const garde = readFileSync(join(racine, 'supabase/migrations/20260929100100_garde_anonymes.sql'), 'utf8');
    const max = garde.match(/is_anonymous'\)::boolean, false\) then (\d+) else/)?.[1];
    expect(max).toBe('3');
    expect(partieJoueurs).toContain(`${max} en attente au plus`);
  });
});

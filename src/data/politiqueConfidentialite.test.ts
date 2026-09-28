// Cohérence entre le code et la politique de confidentialité (issue #223).
// La politique doit citer chaque clé gardée sur l'appareil et chaque événement envoyé à PostHog :
// un ajout dans le code sans ligne dans docs/juridique/politique-confidentialite.md fait échouer ce test.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENTS } from './analytics';

const racine = fileURLToPath(new URL('../../', import.meta.url));
const politique = readFileSync(join(racine, 'docs/juridique/politique-confidentialite.md'), 'utf8');

/** Fichiers source hors tests (les tests sèment parfois des clés factices). */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(nom => {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return /\.(ts|tsx)$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

/** Clés de stockage local écrites en dur dans le code : 'go.xxx.v1', et les préfixes comme 'go.evenement.'. */
function clesDuCode(): string[] {
  const cles = new Set<string>();
  for (const f of sources(join(racine, 'src'))) {
    for (const m of readFileSync(f, 'utf8').matchAll(/['"`](go\.[a-z0-9-]+(?:\.[a-z0-9_-]+)*\.?)['"`]/gi)) cles.add(m[1]);
  }
  return [...cles].sort();
}

describe('politique de confidentialité et code', () => {
  it('trouve bien des clés dans le code (garde-fou du test lui-même)', () => {
    const cles = clesDuCode();
    expect(cles).toContain('go.consentement.v1');
    expect(cles).toContain('go.settings.v1');
  });

  it('cite chaque clé de stockage de l’appareil', () => {
    // Une clé suivie d'un nom (go.evenement.premiere_pierre) est couverte par son préfixe (go.evenement.).
    const cles = clesDuCode();
    const prefixes = cles.filter(k => k.endsWith('.'));
    const absentes = cles.filter(k => !politique.includes('`' + k) && !prefixes.some(p => k !== p && k.startsWith(p)));
    expect(absentes).toEqual([]);
  });

  it('cite chaque événement envoyé à PostHog', () => {
    const absents = Object.values(EVENTS).filter(e => !politique.includes('`' + e + '`'));
    expect(absents).toEqual([]);
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
    expect(politique).toContain('**Défi par lien**');
    expect(politique).toMatch(/date limite du coup en cours/);
    expect(politique).toContain('**Session sans compte**');
  });
});

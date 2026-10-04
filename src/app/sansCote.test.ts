// Décision de Florian (#137, #284) : aucune cote affichée dans les problèmes. La cote existe, invisible.
// Tous les textes que l'écran Problèmes et son lecteur (verdict compris) peuvent afficher, connecté ou non, sont lus
// dans le code ; aucun ne doit contenir « cote » (français) ni « rating » (anglais).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOGUES, type Cle } from '../content/i18n/secondaires';

/** Fichiers de l'écran Problèmes : écran, lecteur, sections du haut, messages d'erreur du chargement. */
const FICHIERS = ['app/Puzzles.tsx', 'ui/RevisionDuJour.tsx', 'ui/MesErreurs.tsx', 'data/puzzles.ts', 'app/aide.ts'];
const sources = FICHIERS.map(f => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'));
const toutes = Object.keys(CATALOGUES.fr) as Cle[];

/** Clés appelées par `t('…')` ou `tr('…')`, et clés à gabarit (`palier.${id}.kyu`) développées sur le catalogue. */
function clesAffichees(): Cle[] {
  const cles = new Set<Cle>();
  for (const s of sources) {
    for (const m of s.matchAll(/\bt(?:r)?\(\s*'([^']+)'/g)) cles.add(m[1] as Cle);
    for (const m of s.matchAll(/\bt(?:r)?\(\s*`([^`]+)`/g)) {
      const motif = new RegExp('^' + m[1].split(/\$\{[^}]+\}/).map(p => p.replace(/[.*+?^()|[\]\\]/g, '\\$&')).join('[^.]+') + '$');
      for (const k of toutes) if (motif.test(k)) cles.add(k);
    }
  }
  return [...cles];
}

const texte = (v: unknown) => (typeof v === 'string' ? v : Object.values(v as Record<string, string>).join(' '));

describe('aucune cote affichée dans les problèmes (#137)', () => {
  const cles = clesAffichees();

  it('lit bien les textes de l’écran', () => {
    expect(cles.length).toBeGreaterThan(40);
    for (const k of ['pb.continuer', 'pb.horsLigne', 'pb.invitation.mot', 'palier.novice.kyu', 'erreur.reussis'] as Cle[]) {
      if (k in CATALOGUES.fr) expect(cles).toContain(k);
    }
    for (const k of cles) expect(CATALOGUES.fr, k).toHaveProperty([k]);
  });

  it('français : jamais « cote »', () => {
    const fautifs = cles.filter(k => /\bcotes?\b/i.test(texte(CATALOGUES.fr[k])));
    expect(fautifs).toEqual([]);
  });

  it('anglais : jamais « rating »', () => {
    const fautifs = cles.filter(k => /\bratings?\b/i.test(texte(CATALOGUES.en[k])));
    expect(fautifs).toEqual([]);
  });

  it('les anciennes clés de cote n’existent plus', () => {
    for (const k of ['pb.taCote', 'pb.pourTaCote', 'pb.coteLegende', 'pb.chargementCote', 'compte.cotes', 'erreur.cote', 'compte.cote']) {
      expect(CATALOGUES.fr).not.toHaveProperty([k]);
      expect(CATALOGUES.en).not.toHaveProperty([k]);
    }
  });

  it('recette du 02/10 au soir : « Mon compte » n’affiche pas la cote non plus', () => {
    const compte = readFileSync(new URL('../app/Account.tsx', import.meta.url), 'utf8');
    expect(compte).not.toMatch(/\.rating\b/);
  });

  it('l’écran n’affiche ni la cote du serveur ni un écart de cote', () => {
    const ecran = sources[0];
    expect(ecran).not.toMatch(/stats\.rating\}/);
    expect(ecran).not.toMatch(/<Defile\b/);
    expect(ecran).not.toMatch(/\becart\(/);
  });
});

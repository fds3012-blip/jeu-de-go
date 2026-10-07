import { describe, expect, it } from 'vitest';
import type { ErreurGardee } from './erreurs';
import { ACQUIS, ETAT_VIDE, type EtatRevisions } from './revisionEspacee';
import { appliquerLignes, contenuValide, ligneValide, lignesLocales, MAX_ENVOI, type Ligne } from './revisionsSynchro';

const ROWS = ['.........', '.........', '..O...X..', '.........', '....X....', '.........', '..X...O..', '.........', '.........'];
const erreur = (id: string, o: Partial<ErreurGardee> = {}): ErreurGardee => ({
  id, creeLe: '2026-10-01T10:00:00.000Z', prochain: '2026-10-08', rates: 1, reussites: 0, maj: 100,
  size: 9, rows: ROWS, toPlay: 1, reponses: [58], joue: 0, coup: 14, adversaire: 'Léa', ...o,
});

describe('ce que l’appareil envoie (#469)', () => {
  it('erreurs avec leur position mais sans adversaire, marques acquises, problèmes', () => {
    const etat: EtatRevisions = {
      problemes: { b1: { etape: 2, prochain: '2026-10-14', echecs: 1, maj: 50 } },
      acquises: { 'erreur-vieille': 40, 'erreur-a': 10 },
    };
    const l = lignesLocales([erreur('erreur-a'), erreur('pas-une-cle')], etat);
    expect(l.map(x => x.cle)).toEqual(['erreur-a', 'erreur-vieille', 'pb:b1']);
    expect(l[0].contenu).toEqual({ creeLe: '2026-10-01T10:00:00.000Z', size: 9, rows: ROWS, toPlay: 1, reponses: [58], joue: 0, coup: 14 });
    expect(JSON.stringify(l)).not.toContain('Léa');
    expect(l[1]).toEqual({ cle: 'erreur-vieille', genre: 'erreur', etape: ACQUIS, prochain: null, echecs: 0, maj: 40, contenu: null });
    expect(l[2]).toEqual({ cle: 'pb:b1', genre: 'probleme', etape: 2, prochain: '2026-10-14', echecs: 1, maj: 50 });
  });

  it('200 lignes au plus par envoi : les problèmes les plus récents', () => {
    const problemes = Object.fromEntries(Array.from({ length: 250 }, (_, i) => [`p${i}`, { etape: 0, prochain: '2026-10-08', echecs: 1, maj: i }]));
    const l = lignesLocales([erreur('erreur-a')], { ...ETAT_VIDE, problemes });
    expect(l).toHaveLength(MAX_ENVOI);
    expect(l[1].cle).toBe('pb:p249');
  });
});

describe('ce que l’appareil applique', () => {
  const ligne = (o: Partial<Ligne> & { cle: string }): Ligne => ({
    genre: o.cle.startsWith('erreur-') ? 'erreur' : 'probleme', etape: 1, prochain: '2026-10-10', echecs: 2, maj: 200, ...o,
  });

  it('le plus récent gagne, élément par élément', () => {
    const etat: EtatRevisions = { problemes: { b1: { etape: 0, prochain: '2026-10-08', echecs: 1, maj: 300 } }, acquises: {} };
    const r = appliquerLignes([erreur('erreur-a')], etat, [
      ligne({ cle: 'erreur-a', etape: 2, prochain: '2026-10-15', maj: 200 }), // plus récent que 100 : gagne
      ligne({ cle: 'pb:b1', etape: 3, maj: 250 }),                             // plus ancien que 300 : ignoré
      ligne({ cle: 'pb:b2', etape: 1, prochain: '2026-10-09', maj: 10 }),      // inconnu : ajouté
    ]);
    expect(r.change).toBe(true);
    expect(r.erreurs[0]).toMatchObject({ id: 'erreur-a', reussites: 2, prochain: '2026-10-15', rates: 2, maj: 200, adversaire: 'Léa' });
    expect(r.etat.problemes.b1.maj).toBe(300);
    expect(r.etat.problemes.b2).toEqual({ etape: 1, prochain: '2026-10-09', echecs: 2, maj: 10 });
  });

  it('erreur acquise ailleurs : elle quitte la liste et sa marque reste', () => {
    const r = appliquerLignes([erreur('erreur-a')], ETAT_VIDE, [ligne({ cle: 'erreur-a', etape: ACQUIS, prochain: null, maj: 500, contenu: null })]);
    expect(r.erreurs).toEqual([]);
    expect(r.etat.acquises).toEqual({ 'erreur-a': 500 });
  });

  it('erreur venue d’un autre appareil : ajoutée avec sa position, sans adversaire ; sans position, ignorée', () => {
    const contenu = { creeLe: '2026-10-02T10:00:00.000Z', size: 9 as const, rows: ROWS, toPlay: 1 as const, reponses: [58], joue: 0, coup: 9 };
    const r = appliquerLignes([], { ...ETAT_VIDE, acquises: { 'erreur-n': 1 } }, [
      ligne({ cle: 'erreur-n', maj: 600, contenu }), ligne({ cle: 'erreur-sans', maj: 600, contenu: null }),
    ]);
    expect(r.erreurs).toHaveLength(1);
    expect(r.erreurs[0]).toMatchObject({ id: 'erreur-n', coup: 9, reussites: 1, rates: 2, prochain: '2026-10-10' });
    expect(r.erreurs[0].adversaire).toBeUndefined();
    expect(r.etat.acquises).toEqual({});
  });

  it('rien de plus récent : rien ne change', () => {
    const etat: EtatRevisions = { problemes: { b1: { etape: 0, prochain: '2026-10-08', echecs: 1, maj: 300 } }, acquises: { 'erreur-z': 900 } };
    const r = appliquerLignes([erreur('erreur-a')], etat, [ligne({ cle: 'pb:b1', maj: 300 }), ligne({ cle: 'erreur-a', maj: 100 }), ligne({ cle: 'erreur-z', etape: 0, maj: 800 })]);
    expect(r.change).toBe(false);
    expect(r.etat).toBe(etat);
  });

  it('relit la réponse du serveur en écartant ce qui est mal formé', () => {
    expect(ligneValide({ cle: 'pb:b1', etape: 1, prochain: '2026-10-10', echecs: 0, maj: 5, contenu: null })).toMatchObject({ genre: 'probleme' });
    expect(ligneValide({ cle: 'email', etape: 1, prochain: '2026-10-10', echecs: 0, maj: 5 })).toBeNull();
    expect(ligneValide({ cle: 'pb:b1', etape: 7, prochain: '2026-10-10', echecs: 0, maj: 5 })).toBeNull();
    expect(ligneValide({ cle: 'erreur-a', etape: 1, prochain: '2026-10-10', echecs: 0, maj: 5, contenu: { size: 9 } })).toMatchObject({ contenu: null });
    expect(contenuValide({ creeLe: '2026-10-02T10:00:00.000Z', size: 9, rows: ROWS, toPlay: 1, reponses: [81], joue: 0, coup: 9 })).toBeNull();
    expect(contenuValide({ creeLe: '2026-10-02T10:00:00.000Z', size: 9, rows: ROWS, toPlay: 1, reponses: [80], joue: -1, coup: 9 })).not.toBeNull();
  });
});

// Conseil de Mochi (#80) : limite gratuite préparée (pas active), propriétés des événements, contour du calque.
import { describe, expect, it } from 'vitest';
import { CONSEILS_GRATUITS_PAR_PARTIE, conseilsRestants, proprietesDemande, proprietesNote } from './conseilMochi';
import { contour } from '../ui/conseilCalque';
import { EVENTS } from '../data/analytics';

describe('limite gratuite du conseil', () => {
  it('pas activée : aucune limite', () => {
    expect(CONSEILS_GRATUITS_PAR_PARTIE).toBeNull();
    expect(conseilsRestants(0)).toBe(Infinity);
    expect(conseilsRestants(500)).toBe(Infinity);
  });

  it('prête : avec une limite, le compte baisse jusqu’à 0 ; Premium n’a pas de limite', () => {
    expect(conseilsRestants(0, false, 3)).toBe(3);
    expect(conseilsRestants(2, false, 3)).toBe(1);
    expect(conseilsRestants(5, false, 3)).toBe(0);
    expect(conseilsRestants(5, true, 3)).toBe(Infinity);
  });
});

describe('événements du conseil', () => {
  it('noms stables', () => {
    expect(EVENTS.conseilDemande).toBe('conseil_demande');
    expect(EVENTS.conseilNote).toBe('conseil_note');
  });

  it('conseil_demande : modèle ou « aucun », jamais de coup ni de position', () => {
    expect(proprietesDemande('grand-coup', { taille: 9, adversaire: 'pomme', coup: 4, katago: true, ms: 812.4 }))
      .toEqual({ modele: 'grand-coup', taille: 9, adversaire: 'pomme', coup: 4, katago: true, ms: 812 });
    expect(proprietesDemande(null, { taille: 19, adversaire: 'caillou', coup: 30, katago: false, ms: 3 }).modele).toBe('aucun');
  });

  it('conseil_note : utile ou non, par modèle', () => {
    expect(proprietesNote('coup-a-eviter', false, { taille: 13, adversaire: 'pomme' })).toEqual({ modele: 'coup-a-eviter', utile: false, taille: 13, adversaire: 'pomme' });
  });
});

describe('calque du conseil : contour de la zone', () => {
  it('un point seul : quatre côtés', () => expect(contour([40], 9)).toHaveLength(4));
  it('deux points voisins : six côtés (le côté commun disparaît)', () => expect(contour([40, 41], 9)).toHaveLength(6));
  it('un carré 2 × 2 : huit côtés', () => expect(contour([40, 41, 49, 50], 9)).toHaveLength(8));
  it('le bord du plateau n’est pas un voisin : pas de fuite d’une ligne à l’autre', () => expect(contour([8, 9], 9)).toHaveLength(8));
});

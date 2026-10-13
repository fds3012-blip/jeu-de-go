// Revue en 3 catégories jusqu'à 15 kyu (#527) : seuil de niveau, regroupement des notes, libellés.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { affichageNote, CATEGORIES, categorieDe, compteCategories, KYU_CATEGORIES, NOTES_DE, revueSimple, revueSimpleAppareil, SCEAU_CATEGORIE } from './categoriesRevue';
import { COTE_DEPART, COTE_KEY } from './coteJoueur';
import { kyuDeCote, KYU_ANCRE_COTE, POINTS_PAR_KYU } from './placement';
import { NOTE_INFO, NOTES, positionsDepuisSgf, seuilsKataGo, seuilsSimple, type Note, type NoteCoup } from './revue';
import { commentaire } from './parcours';
import { traduire } from '../content/i18n/secondaires';

// Environnement Node : un localStorage en mémoire suffit.
const memoire = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => { memoire.set(k, v); }, clear: () => memoire.clear() });

const coteDuKyu = (k: number) => KYU_ANCRE_COTE + (25 - k) * POINTS_PAR_KYU;

describe('niveau : 3 catégories jusqu’à 15 kyu inclus, notes détaillées au-delà', () => {
  it('le débutant (cote de départ, 25 kyu) a la revue simple', () => {
    expect(kyuDeCote(COTE_DEPART)).toBe(25);
    expect(revueSimple(COTE_DEPART)).toBe(true);
  });
  it('15 kyu : simple ; 14 kyu : détaillée', () => {
    expect(KYU_CATEGORIES).toBe(15);
    expect(kyuDeCote(coteDuKyu(15))).toBe(15);
    expect(revueSimple(coteDuKyu(15))).toBe(true);
    expect(kyuDeCote(coteDuKyu(14))).toBe(14);
    expect(revueSimple(coteDuKyu(14))).toBe(false);
    expect(revueSimple(coteDuKyu(1))).toBe(false);
  });
  describe('sur l’appareil', () => {
    afterEach(() => localStorage.clear());
    it('sans cote gardée, ou cote abîmée : débutant', () => {
      expect(revueSimpleAppareil()).toBe(true);
      localStorage.setItem(COTE_KEY, '{pas du json');
      expect(revueSimpleAppareil()).toBe(true);
    });
    it('cote gardée d’un joueur fort : notes détaillées', () => {
      localStorage.setItem(COTE_KEY, JSON.stringify({ cote: coteDuKyu(10), essais: 30, serie: 0, jour: 0, vusDuJour: [] }));
      expect(revueSimpleAppareil()).toBe(false);
    });
  });
});

describe('regroupement des notes', () => {
  it('chaque note, sauf le Coup manqué, est dans une seule catégorie', () => {
    for (const n of NOTES) {
      const dans = CATEGORIES.filter(c => NOTES_DE[c].includes(n));
      expect(dans.length, n).toBe(n === 'manque' ? 0 : 1);
    }
  });
  it('les notes sans perte (ou presque) sont des bons coups ; Imprécision : coup imprécis ; Erreur et Gaffe : erreur', () => {
    const attendu: Record<Exclude<Note, 'manque'>, string> = {
      brillant: 'bon', meilleur: 'bon', excellent: 'bon', bon: 'bon', classique: 'bon', solide: 'bon', force: 'bon',
      imprecision: 'imprecis', erreur: 'erreur', grosse: 'erreur',
    };
    for (const [note, c] of Object.entries(attendu)) expect(categorieDe({ note: note as Note, perte: 0 }, 9), note).toBe(c);
  });
  it('Coup manqué : rangé d’après sa perte, au seuil d’Imprécision de KataGo (taille du plateau comprise)', () => {
    for (const size of [9, 13, 19]) {
      const s = seuilsKataGo(size).imprecision;
      expect(categorieDe({ note: 'manque', perte: s }, size)).toBe('imprecis');
      expect(categorieDe({ note: 'manque', perte: s + 0.01 }, size)).toBe('erreur');
    }
  });
  it('les définitions de la légende tiennent : un « bon coup » perd au plus le seuil Bon (ou Solide), une erreur plus que celui d’Imprécision', () => {
    // Seuils de notation (revue.ts) : la perte d'une Imprécision est au-dessus des bons coups, celle d'une Erreur au-dessus.
    for (const size of [9, 19]) {
      const k = seuilsKataGo(size), m = seuilsSimple(size);
      expect(k.bon).toBeLessThan(k.imprecision);
      expect(k.imprecision).toBeLessThan(k.erreur);
      expect(m.solide).toBeLessThan(m.imprecision);
    }
  });
  it('sceau de chaque catégorie : ✓, ?!, ?', () => {
    expect(CATEGORIES.map(c => NOTE_INFO[SCEAU_CATEGORIE[c]].symbole)).toEqual(['✓', '?!', '?']);
  });
});

describe('décompte et affichage', () => {
  const coup = (coup: number, couleur: 1 | 2, note: Note, perte = 0): NoteCoup => ({ coup, couleur, note, perte });
  const notes = [
    coup(1, 1, 'classique'), coup(2, 2, 'meilleur'), coup(3, 1, 'brillant'), coup(4, 2, 'grosse', 9), coup(5, 1, 'manque', 2),
    null, coup(7, 1, 'erreur', 5), coup(8, 2, 'imprecision', 2), coup(9, 1, 'manque', 5), coup(10, 2, 'force'),
  ];
  it('compte les coups de chaque camp par catégorie (les coups non notés ne comptent pas)', () => {
    expect(compteCategories(notes, 1, 9)).toEqual({ bon: 2, imprecis: 1, erreur: 2 });
    expect(compteCategories(notes, 2, 9)).toEqual({ bon: 2, imprecis: 1, erreur: 1 });
  });
  it('revue simple : sceau et libellé de la catégorie ; sinon, la note détaillée', () => {
    expect(affichageNote({ note: 'grosse', perte: 9 }, 9, true)).toEqual({ sceau: 'erreur', libelle: 'Erreur' });
    expect(affichageNote({ note: 'classique', perte: 0 }, 9, true)).toEqual({ sceau: 'bon', libelle: 'Bon coup' });
    expect(affichageNote({ note: 'manque', perte: 2 }, 9, true)).toEqual({ sceau: 'imprecision', libelle: 'Coup imprécis' });
    expect(affichageNote({ note: 'grosse', perte: 9 }, 9, false)).toEqual({ sceau: 'grosse', libelle: 'Gaffe' });
  });
  it('libellés et définitions en français et en anglais', () => {
    for (const c of CATEGORIES) {
      for (const l of ['fr', 'en'] as const) {
        expect(traduire(l, `categorie.${c}`)).not.toBe('');
        expect(traduire(l, `categorie.aide.${c}`)).not.toBe('');
      }
    }
    expect(traduire('en', 'categorie.imprecis')).toBe('Inaccurate move');
  });
});

describe('parcours : le titre dit la catégorie en revue simple, le détail ne change pas', () => {
  const { positions } = positionsDepuisSgf('(;GM[1]FF[4]SZ[9]KM[6.5];B[ee];W[cc])');
  const o = { toi: true, nom: 'Pomme' };
  it('Gaffe : « E5 est une erreur » (simple), « E5 est une gaffe » (détaillée)', () => {
    const n = { coup: 1, couleur: 1 as const, note: 'grosse' as const, perte: 9 };
    const simple = commentaire(n, positions, { ...o, simple: true }), detaille = commentaire(n, positions, o);
    expect(simple.titre).toBe('E5 est une erreur');
    expect(detaille.titre).toBe('E5 est une gaffe');
    expect(simple.detail).toBe(detaille.detail);
  });
  it('Coup manqué de petite perte : « coup imprécis » ; Classique : « bon coup »', () => {
    expect(commentaire({ coup: 1, couleur: 1, note: 'manque', perte: 2 }, positions, { ...o, simple: true }).titre).toBe('E5 est un coup imprécis');
    expect(commentaire({ coup: 1, couleur: 1, note: 'classique', perte: 0, raison: 'tengen' }, positions, { ...o, simple: true }).titre).toBe('E5 est un bon coup');
  });
});

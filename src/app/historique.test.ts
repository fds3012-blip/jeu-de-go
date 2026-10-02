import { afterEach, describe, expect, it } from 'vitest';
import { choisirLangue } from '../content/i18n';
import {
  ajouterPartie, dateRelative, depuisDefi, depuisRevue, etiquette, fusionner, issueDe, lireHistorique, lireResultat,
  MAX_PARTIES, nomAdversaire, phraseResultat, portraitDe, trier, type LigneDefi, type PartieHistorique,
} from './historique';

const SGF = (re = 'B+6.5', coups = ';B[ee];W[cc]') => `(;GM[1]FF[4]CA[UTF-8]SZ[9]KM[6.5]RU[Japanese]PB[Toi]PW[Pomme]RE[${re}]${coups})`;
const partie = (p: Partial<PartieHistorique> = {}): PartieHistorique => ({
  id: p.date ?? '2026-10-02T10:00:00.000Z', date: '2026-10-02T10:00:00.000Z', sgf: SGF(), mode: 'ordi', taille: 9, joueur: 1, adversaire: 'pomme', resultat: 'B+6.5', ...p,
});

afterEach(() => choisirLangue('fr'));

describe('tri et rangement', () => {
  it('range la plus récente en premier, et garde l’ordre d’arrivée à date égale', () => {
    const a = partie({ id: 'a', date: '2026-09-01T10:00:00Z', sgf: 'a' });
    const b = partie({ id: 'b', date: '2026-10-01T10:00:00Z', sgf: 'b' });
    const c = partie({ id: 'c', date: '2026-10-01T10:00:00Z', sgf: 'c' });
    expect(trier([a, b, c]).map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('ajoute une partie, remplace une partie de même identifiant, et en garde 50 au plus', () => {
    let l: PartieHistorique[] = [];
    for (let i = 0; i < 60; i++) l = ajouterPartie(l, partie({ id: `p${i}`, date: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), sgf: SGF('B+1', `;B[${String.fromCharCode(97 + (i % 19))}${String.fromCharCode(97 + Math.floor(i / 19))}]`) }));
    expect(l).toHaveLength(MAX_PARTIES);
    expect(l[0].id).toBe('p59');
    expect(l.at(-1)!.id).toBe('p10');
    const remplacee = ajouterPartie(l, { ...l[3], resultat: 'W+R' });
    expect(remplacee).toHaveLength(MAX_PARTIES);
    expect(remplacee.filter(p => p.id === l[3].id)).toEqual([{ ...l[3], resultat: 'W+R' }]);
  });

  // Recette du 02/10 au soir, L3 : trois parties abandonnées au même coup ne faisaient qu'une ligne.
  it('garde deux parties jouées au SGF identique, mais un fichier importé deux fois une seule fois', () => {
    const a = partie({ id: '2026-10-02T10:00:00.000Z', date: '2026-10-02T10:00:00.000Z', sgf: SGF('W+R', ';B[ee]') });
    const b = partie({ id: '2026-10-02T10:05:00.000Z', date: '2026-10-02T10:05:00.000Z', sgf: SGF('W+R', ';B[ee]') });
    expect(ajouterPartie(ajouterPartie([], a), b).map(p => p.id)).toEqual([b.id, a.id]);
    const i1 = partie({ id: 'i1', date: '2026-10-02T11:00:00.000Z', mode: 'import', sgf: SGF('B+R', ';B[cc]') });
    const i2 = { ...i1, id: 'i2', date: '2026-10-02T11:10:00.000Z' };
    expect(ajouterPartie(ajouterPartie([a], i1), i2).map(p => p.id)).toEqual(['i2', a.id]);
    // Une partie jouée et un import du même SGF restent deux lignes.
    expect(ajouterPartie([a], { ...a, id: 'i3', mode: 'import', date: '2026-10-02T12:00:00.000Z' })).toHaveLength(2);
  });

  it('ne garde pas une partie quittée sans aucun coup (L3), sauf un fichier importé', () => {
    const date = '2026-10-02T12:00:00.000Z';
    const vide = SGF('W+R', '');
    expect(depuisRevue({ sgf: vide, date, adversaire: 'pomme' })).toBeNull();
    expect(depuisRevue({ sgf: vide, date }, 'deux')).toBeNull();
    expect(depuisRevue({ sgf: vide, date, importee: true })).toMatchObject({ mode: 'import' });
    expect(lireHistorique([], { sgf: vide, date, adversaire: 'pomme' })).toEqual([]);
    // Une passe compte comme un coup : la partie est gardée.
    expect(depuisRevue({ sgf: SGF('W+R', ';B[tt]'), date, adversaire: 'pomme' })).not.toBeNull();
  });

  it('lit l’appareil en écartant les entrées abîmées, et y ajoute la dernière partie de la revue', () => {
    const brut = [partie(), { id: 'x' }, null, 'texte', { ...partie({ id: 'y' }), mode: 'inconnu' }, { ...partie({ id: 'z' }), date: 'hier' }];
    expect(lireHistorique(brut)).toHaveLength(1);
    expect(lireHistorique('pas une liste')).toEqual([]);
    const revue = { sgf: SGF('W+R', ';B[dd]'), adversaire: 'caillou', date: '2026-10-02T12:00:00.000Z' };
    const l = lireHistorique(brut, revue);
    expect(l).toHaveLength(2);
    expect(l[0]).toMatchObject({ id: revue.date, mode: 'ordi', adversaire: 'caillou', joueur: 1, taille: 9, resultat: 'W+R' });
    // Déjà dans la liste (même date) : pas de doublon.
    expect(lireHistorique(l, revue)).toHaveLength(2);
  });

  it('déduit le mode de la partie gardée pour la revue', () => {
    const date = '2026-10-02T12:00:00.000Z';
    expect(depuisRevue({ sgf: SGF(), date })).toMatchObject({ mode: 'deux', joueur: null });
    expect(depuisRevue({ sgf: SGF(), date, importee: true, joueur: 2, adversaire: 'Shusaku' })).toMatchObject({ mode: 'import', joueur: 2, adversaire: 'Shusaku' });
    expect(depuisRevue({ sgf: SGF(), date, adversaire: 'pomme' }, 'guidee')).toMatchObject({ mode: 'guidee', joueur: 1 });
    expect(depuisRevue({ sgf: 'abîmé', date })).toBeNull();
    expect(depuisRevue(null)).toBeNull();
  });
});

describe('défis par lien terminés', () => {
  const ligne = (p: Partial<LigneDefi> = {}): LigneDefi => ({
    id: 'g1', size: 9, komi: '6.5', rules: 'japanese', handicap: 0, moves: 'eeccdd', black_id: 'moi', white_id: 'ami',
    status: 'finished', result: 'W+R', updated_at: '2026-09-30T08:00:00Z', ...p,
  });
  it('donne le camp du joueur, le SGF et le résultat', () => {
    const blanc = depuisDefi(ligne(), 'ami')!;
    expect(blanc).toMatchObject({ id: 'defi:g1', mode: 'defi', joueur: 2, taille: 9, resultat: 'W+R' });
    expect(blanc.sgf).toMatch(/RE\[W\+R\];B\[ee\];W\[cc\];B\[dd\]\)$/);
    expect(issueDe(blanc)).toBe('victoire');
    expect(issueDe(depuisDefi(ligne(), 'moi')!)).toBe('defaite');
  });
  it('nomme l’ami par son pseudo (#400), sinon « Ton ami »', () => {
    const nomme = depuisDefi(ligne(), 'moi', 'W+R', 'Lea_du_go')!;
    expect(nomAdversaire(nomme)).toBe('Lea_du_go');
    expect(etiquette(nomme, new Date('2026-09-30T12:00:00Z'))).toMatch(/^Lea_du_go\. /);
    expect(nomAdversaire(depuisDefi(ligne(), 'moi', 'W+R', null)!)).toBe('Ton ami');
    expect(nomAdversaire(depuisDefi(ligne(), 'moi')!)).toBe('Ton ami');
  });
  it('écarte une partie en cours, une partie d’un autre joueur et des coups illisibles', () => {
    expect(depuisDefi(ligne({ status: 'active', result: null }), 'moi')).toBeNull();
    expect(depuisDefi(ligne(), 'quelquun')).toBeNull();
    expect(depuisDefi(ligne({ moves: 'eec' }), 'moi')).toBeNull();
  });
  it('fusionne sans doublon, la plus récente en premier', () => {
    const d = depuisDefi(ligne(), 'moi')!;
    const l = fusionner([partie()], [d, d]);
    expect(l.map(p => p.id)).toEqual(['2026-10-02T10:00:00.000Z', 'defi:g1']);
  });
});

describe('résultat en mots', () => {
  it('lit les résultats SGF', () => {
    expect(lireResultat('B+6.5')).toEqual({ vainqueur: 1, raison: 'points', marge: 6.5 });
    expect(lireResultat('W+R')).toEqual({ vainqueur: 2, raison: 'abandon' });
    expect(lireResultat('w+resign')).toEqual({ vainqueur: 2, raison: 'abandon' });
    expect(lireResultat('B+T')).toEqual({ vainqueur: 1, raison: 'temps' });
    expect(lireResultat('0')).toEqual({ vainqueur: 0, raison: 'egalite' });
    expect(lireResultat('?')).toBeNull();
    expect(lireResultat(undefined)).toBeNull();
  });

  it('parle au joueur, au tutoiement, avec la virgule française', () => {
    expect(phraseResultat(partie())).toBe('Tu as gagné de 6,5 points');
    expect(phraseResultat(partie({ resultat: 'B+0.5' }))).toBe('Tu as gagné de 0,5 point');
    expect(phraseResultat(partie({ resultat: 'W+12' }))).toBe('Tu as perdu de 12 points');
    expect(phraseResultat(partie({ resultat: 'W+R' }))).toBe('Tu as abandonné');
    expect(phraseResultat(partie({ resultat: 'B+R' }))).toBe('Tu as gagné par abandon');
    expect(phraseResultat(partie({ resultat: 'W+T', joueur: 2 }))).toBe('Tu as gagné au temps');
    expect(phraseResultat(partie({ resultat: '0' }))).toBe('Égalité parfaite');
    expect(phraseResultat(partie({ resultat: undefined }))).toBe('Résultat inconnu');
  });

  it('nomme le camp gagnant dans une partie à deux', () => {
    const deux = partie({ mode: 'deux', joueur: null, adversaire: undefined });
    expect(phraseResultat({ ...deux, resultat: 'W+3.5' })).toBe('Blanc gagne de 3,5 points');
    expect(phraseResultat({ ...deux, resultat: 'B+R' })).toBe('Noir gagne par abandon');
    expect(issueDe({ ...deux, resultat: 'B+R' })).toBeNull();
    expect(nomAdversaire(deux)).toBe('Partie à deux');
  });

  it('existe en anglais', () => {
    choisirLangue('en');
    expect(phraseResultat(partie())).toBe('You won by 6.5 points');
    expect(phraseResultat(partie({ resultat: 'W+R' }))).toBe('You resigned');
  });

  it('donne l’issue du sceau', () => {
    expect(issueDe(partie())).toBe('victoire');
    expect(issueDe(partie({ resultat: 'W+1' }))).toBe('defaite');
    expect(issueDe(partie({ resultat: '0' }))).toBe('egalite');
    expect(issueDe(partie({ resultat: undefined }))).toBeNull();
  });
});

describe('adversaire et date', () => {
  it('nomme l’adversaire et choisit son portrait', () => {
    expect(nomAdversaire(partie())).toBe('Pomme');
    expect(portraitDe(partie())).toBe('pomme');
    expect(nomAdversaire(partie({ mode: 'guidee', adversaire: undefined }))).toBe('Mochi');
    expect(portraitDe(partie({ mode: 'guidee' }))).toBeNull();
    expect(nomAdversaire(partie({ mode: 'import', adversaire: 'Honinbo Shusaku' }))).toBe('Honinbo Shusaku');
    expect(nomAdversaire(partie({ mode: 'import', adversaire: undefined }))).toBe('Partie importée');
    expect(nomAdversaire(partie({ mode: 'defi', adversaire: undefined }))).toBe('Ton ami');
    expect(nomAdversaire(partie({ mode: 'ordi', adversaire: 'inconnu' }))).toBe('L’ordi');
  });

  it('dit la date en mots : aujourd’hui, hier, il y a 3 jours, puis la date', () => {
    const maintenant = new Date(2026, 9, 2, 9, 0);
    expect(dateRelative(new Date(2026, 9, 2, 0, 5).toISOString(), maintenant)).toBe('Aujourd’hui');
    expect(dateRelative(new Date(2026, 9, 1, 23, 50).toISOString(), maintenant)).toBe('Hier');
    expect(dateRelative(new Date(2026, 8, 29, 12).toISOString(), maintenant)).toBe('Il y a 3 jours');
    expect(dateRelative(new Date(2026, 8, 12, 12).toISOString(), maintenant)).toMatch(/^12 sept\.?$/);
    expect(dateRelative(new Date(2025, 8, 12, 12).toISOString(), maintenant)).toMatch(/2025/);
    expect(dateRelative('pas une date', maintenant)).toBe('');
  });

  it('donne une étiquette complète aux lecteurs d’écran', () => {
    expect(etiquette(partie({ date: new Date(2026, 9, 2, 8).toISOString() }), new Date(2026, 9, 2, 9)))
      .toBe('Pomme. Tu as gagné de 6,5 points. Aujourd’hui, plateau 9 × 9.');
  });
});

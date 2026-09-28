// Issue #167, étape 4 : écran de partie, récit du score, fin de partie et revue passés par `t`.
// Le français reste strictement identique aux textes d'origine (constantes gardées dans le code), l'anglais suit.
import {
  ALERTE_ATARI, ALERTE_FRONTIERES, CORRIGER_MORTES, descriptionIndices, descriptionQuiMene, DOUTE_MORTES, EXPLICATION_ATARI,
  EXPLICATION_MORTES, EXPLICATION_PASSER, libelleAvantage, libelleCoup, messageAtari, messageComptage, messageIndice, messagePasser,
  PLUS_D_INDICE, phraseQuiMene, SERRE,
} from '../../app/partie';
import { GENERIQUES, LONGUEUR_MAX, repliques, type Situation } from '../../app/repliques';
import { annonceKomi } from '../../app/equilibrage';
import { campsRecit, EXPLICATION_KOMI, ligneCompteur, ligneDeuxieme, ligneKomi, ligneResultat, type Recit } from '../../app/score';
import { fin, leconMochi, texteBilan, texteCoups, type StatsPartie } from '../../app/bilan';
import { AUCUNE_ERREUR, NOTE_INFO, NOTES, PERTES_DIFFUSES, phraseNote, SANS_KATAGO } from '../../app/revue';
import { libelleGels } from '../../app/gel';
import { annonceAtari, annonceConfirmation, annonceCoup, nomIntersection } from '../../ui/Board';
import { fromLabel } from '../../go/coords';
import { choisirLangue, nombre, traduire } from './index';

const recit = (gagnant: 0 | 1 | 2, marge: number, deuxieme: Recit['deuxieme'] = { type: 'prisonniers', noir: 3, blanc: 1 }): Recit =>
  ({ territoire: [], territoireNoir: 0, territoireBlanc: 0, deuxieme, komi: 6.5, noir: 0, blanc: 0, gagnant, marge });
const stats: StatsPartie = { coups: 34, capturesMoi: 3, capturesAdv: 0, atarisSubis: 0, abandon: false, marge: 12, komi: 6.5 };
const LISTE = [{ id: 'pomme', nom: 'Pomme' }, { id: 'caillou', nom: 'Caillou' }];
const N = 9, at = (l: string) => fromLabel(l, N);

describe('français identique aux textes d’origine', () => {
  it('constantes de l’aide de Mochi', () => {
    expect(traduire('fr', 'partie.atari.alerte')).toBe(ALERTE_ATARI);
    expect(traduire('fr', 'partie.atari.explication')).toBe(EXPLICATION_ATARI);
    expect(traduire('fr', 'partie.passer.explication')).toBe(EXPLICATION_PASSER);
    expect(traduire('fr', 'partie.indice.plusDIndice')).toBe(PLUS_D_INDICE);
    expect(traduire('fr', 'quiMene.serre')).toBe(SERRE);
    expect(traduire('fr', 'partie.mortes.explication')).toBe(EXPLICATION_MORTES);
    expect(traduire('fr', 'partie.mortes.corriger')).toBe(CORRIGER_MORTES);
    expect(traduire('fr', 'partie.mortes.doute')).toBe(DOUTE_MORTES);
    expect(traduire('fr', 'partie.frontieres')).toBe(ALERTE_FRONTIERES);
    expect(traduire('fr', 'recit.explicationKomi')).toBe(EXPLICATION_KOMI);
    expect(traduire('fr', 'revue.aucuneErreur')).toBe(AUCUNE_ERREUR);
    expect(traduire('fr', 'revue.sansKataGo')).toBe(SANS_KATAGO);
    expect(traduire('fr', 'revue.pertesDiffuses')).toBe(PERTES_DIFFUSES);
  });

  it('messages de la partie', () => {
    expect(libelleAvantage(3.4)).toBe('Noir +3,5');
    expect(libelleAvantage(-12)).toBe('Blanc +12');
    expect(libelleAvantage(0.1)).toBe('À égalité');
    expect(libelleCoup(9, -1, 9)).toBe('9. passe');
    expect(messageAtari(true)).toBe(`${ALERTE_ATARI} ${EXPLICATION_ATARI}`);
    expect(messagePasser('Pomme', true)).toBe(`Pomme passe. Plus rien à gagner ? Passe aussi, et on compte. ${EXPLICATION_PASSER}`);
    expect(messageIndice(0)).toBe(`Regarde dans le cercle vert : il y a un bon coup. ${PLUS_D_INDICE}`);
    expect([0, 1, 2].map(descriptionIndices)).toEqual(["Plus d'indice pour cette partie", '1 indice restant', '2 indices restants']);
    expect([0, 1, 3].map(descriptionQuiMene)).toEqual(['Plus disponible pour cette partie', 'Encore 1 fois dans cette partie', 'Encore 3 fois dans cette partie']);
    expect(phraseQuiMene(-7.6, 'katago')).toBe("Blanc mène d'environ 8 points.");
    expect(messageComptage('Deux passes : la partie est finie.', 0, false)).toBe('Deux passes : la partie est finie. Aucune pierre morte. Si un groupe ne peut plus vivre, touche-le pour le compter comme prisonnier.');
    expect(messageComptage('x', 2, false)).toBe(`${EXPLICATION_MORTES} Touche un groupe pour corriger.`);
    for (const s of Object.keys(GENERIQUES) as Situation[]) expect(repliques('pomme', s)).toEqual(GENERIQUES[s]);
    expect([0, 1, 2, 3].map(n => traduire('fr', 'partie.ordiCapture', { nom: 'Pomme', n, point: 'D4' })))
      .toEqual(['Pomme capture 0 pierre en D4.', 'Pomme capture 1 pierre en D4.', 'Pomme capture 2 pierres en D4.', 'Pomme capture 3 pierres en D4.']);
  });

  it('annonce du komi', () => {
    expect(annonceKomi(0, 0.5)).toBe('Le komi, ce sont des points donnés à Blanc parce que Noir commence. Pour tes premières parties, il est de 0,5.');
    expect(annonceKomi(1, 0.5)).toBe('Cette partie encore, le komi est de 0,5 point.');
    expect(annonceKomi(2, 0.5)).toBe('Dernière partie avec un komi de 0,5 point.');
    expect(annonceKomi(3, 6.5)).toBe('Le komi passe à 6,5 points, sa valeur habituelle.');
  });

  it('récit du score et fin de partie', () => {
    expect(ligneDeuxieme(recit(1, 3))).toBe('+ 3 prisonniers pour Noir, + 1 pour Blanc');
    expect(ligneDeuxieme(recit(1, 3, { type: 'pierres', noir: 1, blanc: 0 }))).toBe('+ 1 pierre pour Noir');
    expect(ligneDeuxieme(recit(1, 3, { type: 'prisonniers', noir: 0, blanc: 0 }))).toBe('Aucun prisonnier');
    expect(ligneKomi(-100)).toBe('− 100 komi pour Blanc');
    expect(ligneResultat(recit(1, 1.5), campsRecit('Pomme'))).toBe('Tu gagnes de 1,5 point !');
    expect(ligneResultat(recit(2, 2), campsRecit('Pomme'))).toBe('Pomme gagne de 2 points');
    expect(ligneCompteur(18, 12.5)).toBe('Noir 18 · Blanc 12,5');
    expect([1.5, 2, 3.5].map(v => traduire('fr', 'fin.marge', { n: v, v: nombre(v, 'fr'), plateau: '9 × 9' })))
      .toEqual(['de 1,5 point sur 9 × 9', 'de 2 points sur 9 × 9', 'de 3,5 points sur 9 × 9']);
    expect(texteBilan({ v: 2, d: 1 })).toBe('2 victoires, 1 défaite');
    expect(texteCoups(0, 0)).toBe('Aucun coup joué, aucune pierre capturée.');
    expect(texteCoups(1, 1)).toBe('1 coup, 1 pierre capturée.');
    expect(fin(LISTE[0], 'victoire', stats, { pomme: { v: 1, d: 0 } }, LISTE)).toEqual({
      mochi: "Tes 3 captures ont fait la différence. Caillou t'attend : prêt ?", cta: 'Défier Caillou', cible: 'caillou',
      bilan: { texte: '34 coups, 3 pierres capturées. Ton bilan contre Pomme : ', gras: '1 victoire' },
    });
    expect(leconMochi('defaite', { ...stats, capturesAdv: 4 }, 'Pomme').texte).toBe("Pomme a pris 4 pierres. La leçon sur l'atari t'apprend à les sauver.");
    expect(leconMochi('defaite', { ...stats, marge: 3 }, 'Pomme').texte).toBe('Sans le komi, les 6,5 points donnés à Blanc qui joue en second, tu gagnais !');
  });

  it('revue, lecteur d’écran et pastille des gels', () => {
    expect(NOTES.map(n => NOTE_INFO[n].libelle)).toEqual(['Brillant', 'Meilleur coup', 'Excellent', 'Bon', 'Solide', 'Imprécision', 'Erreur', 'Grosse erreur']);
    expect(phraseNote({ coup: 3, couleur: 1, note: 'bon', perte: 0.4 })).toBe('Bon coup, à peine un point de moins que le meilleur.');
    expect(phraseNote({ coup: 3, couleur: 1, note: 'grosse', perte: 7.2 })).toBe('Grosse erreur : environ 7 points de perdus.');
    for (const n of [0, 1, 2, 5]) expect(traduire('fr', n === 0 ? 'gel.aucun' : 'gel.reserve', { n })).toBe(libelleGels(n));
    expect(annonceConfirmation('D4')).toBe('D4 : appuie encore pour poser');
    const b = new Int8Array(N * N);
    b[at('D4')] = 1;
    expect(nomIntersection(at('D4'), b, N, at('D4'))).toBe('D4, pierre noire, dernier coup');
    expect(annonceCoup(2, at('C3'), 2, N)).toBe('Blanc joue C3 et prend 2 pierres');
  });
});

describe('en anglais', () => {
  beforeEach(() => choisirLangue('en'));
  afterEach(() => choisirLangue('fr'));

  it('messages de la partie, nombres avec un point', () => {
    expect(libelleAvantage(3.4)).toBe('Black +3.5');
    expect(libelleAvantage(0)).toBe('Even');
    expect(libelleCoup(9, -1, 9)).toBe('9. pass');
    expect(messageAtari(false)).toBe('Atari! Your group has only one liberty left. Save it or strike back.');
    expect([0, 1, 2].map(descriptionIndices)).toEqual(['No more hints this game', '1 hint left', '2 hints left']);
    expect([1, 2].map(descriptionQuiMene)).toEqual(['1 more time this game', '2 more times this game']);
    expect(annonceKomi(0, 0.5)).toBe('Komi is points given to White because Black plays first. For your first games, it’s 0.5.');
  });

  it('répliques : 15 caractères au plus, comme en français', () => {
    for (const s of Object.keys(GENERIQUES) as Situation[]) {
      const liste = repliques('pomme', s);
      expect(liste).toHaveLength(GENERIQUES[s].length);
      for (const r of liste) {
        expect(r.length, r).toBeLessThanOrEqual(LONGUEUR_MAX);
        expect(GENERIQUES[s]).not.toContain(r);
      }
    }
  });

  it('récit du score, bilan et leçon de Mochi', () => {
    expect(ligneDeuxieme(recit(1, 3), campsRecit('Pomme'))).toBe('+ 3 prisoners for you, + 1 for Pomme');
    expect(ligneKomi(6.5, campsRecit('Pomme'))).toBe('+ 6.5 komi for Pomme');
    expect(ligneResultat(recit(1, 1), campsRecit('Pomme'))).toBe('You win by 1 point!');
    expect(ligneResultat(recit(1, 1.5), campsRecit())).toBe('Black wins by 1.5 points');
    expect(ligneResultat(recit(0, 0))).toBe('Draw');
    expect(fin(LISTE[0], 'victoire', stats, { pomme: { v: 1, d: 0 } }, LISTE)).toMatchObject({
      mochi: 'Your 3 captures made the difference. Caillou is waiting for you: ready?', cta: 'Challenge Caillou',
      bilan: { texte: '34 moves, 3 stones captured. Your record vs Pomme: ', gras: '1 win' },
    });
    expect(texteBilan({ v: 0, d: 2 })).toBe('2 losses');
  });

  it('revue et lecteur d’écran', () => {
    expect(NOTES.map(n => NOTE_INFO[n].libelle)).toEqual(['Brilliant', 'Best move', 'Excellent', 'Good', 'Solid', 'Inaccuracy', 'Mistake', 'Blunder']);
    expect(phraseNote({ coup: 3, couleur: 1, note: 'erreur', perte: 4 })).toBe('Mistake: about 4 points lost.');
    const b = new Int8Array(N * N);
    b[at('D4')] = 1; b[at('D5')] = 2; b[at('C4')] = 2; b[at('E4')] = 2;
    expect(annonceAtari(b, at('E4'), N, { 2: 'Pomme' })).toBe('Atari: your stone D4 has only one liberty left, at D3.');
    expect(annonceCoup(2, at('C3'), 1, N, { 2: 'Pomme' })).toBe('Pomme played C3, capturing 1 stone');
    expect(nomIntersection(at('E5'), b, N)).toBe('E5, empty');
  });
});

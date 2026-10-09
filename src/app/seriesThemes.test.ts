import { describe, expect, it } from 'vitest';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { ETAT_INITIAL, cible, noter, type EtatCote } from './coteJoueur';
import {
  MIN_PAR_SERIE, SERIES_THEMES, nettoyerSeries, noterSerie, problemesDe, prochainDeSerie, serieDe, seriesDisponibles,
} from './seriesThemes';

const BANQUE = parsePuzzles(ALL_PUZZLES);
const pb = (id: string) => BANQUE.find(p => p.id === id)!;

describe('séries par thème (#471) : regroupement des thèmes existants', () => {
  it('range les problèmes de référence dans la bonne série', () => {
    expect(serieDe(pb('b1'))).toBe('capturer'); // capture
    expect(serieDe(pb('a09'))).toBe('capturer'); // vers le bord
    expect(serieDe(pb('a10'))).toBe('capturer'); // atari : pousser vers ses pierres
    expect(serieDe(pb('b4'))).toBe('sauver'); // atari : « Sauve ta pierre », pierre noire marquée
    expect(serieDe(pb('b5'))).toBe('sauver');
    expect(serieDe(pb('a07'))).toBe('sauver'); // capturer pour se sauver : la pierre à sauver est marquée
    expect(serieDe(pb('m07'))).toBe('vie-mort');
    expect(serieDe(pb('d07'))).toBe('vie-mort'); // course aux libertés
    expect(serieDe(pb('w01'))).toBe('vie-mort'); // seki
    expect(serieDe(pb('s2'))).toBe('relier-couper');
    expect(serieDe(pb('w05'))).toBe('fin-de-partie');
    expect(serieDe(pb('w08'))).toBe('fin-de-partie'); // compter
    expect(serieDe(pb('c1'))).toBe('tesuji'); // double atari
    expect(serieDe(pb('b6'))).toBe('tesuji'); // échelle
    expect(serieDe(pb('c3'))).toBe('tesuji'); // filet
    expect(serieDe(pb('c4'))).toBe('tesuji'); // prise en retour
  });

  it('chaque problème de « Sauver » demande de sauver sa propre pierre marquée', () => {
    const sauver = problemesDe(BANQUE, 'sauver');
    expect(sauver.length).toBeGreaterThanOrEqual(MIN_PAR_SERIE);
    for (const p of sauver) expect(p.rows.join(''), p.id).toMatch(p.toPlay === 1 ? /S/ : /T/);
  });

  it('le ko et l’ouverture n’entrent dans aucune série', () => {
    expect(serieDe(pb('x02'))).toBeUndefined();
    expect(serieDe(pb('x04'))).toBeUndefined();
    expect(serieDe({ id: 'inconnu', difficulty: 500, rows: ['.'], toPlay: 1 })).toBeUndefined();
  });

  it('n’affiche que les séries assez fournies, dans l’ordre (aucun problème inventé)', () => {
    const dispo = seriesDisponibles(BANQUE);
    for (const s of dispo) expect(problemesDe(BANQUE, s).length, s).toBeGreaterThanOrEqual(MIN_PAR_SERIE);
    for (const s of SERIES_THEMES.filter(s => !dispo.includes(s))) expect(problemesDe(BANQUE, s).length, s).toBeLessThan(MIN_PAR_SERIE);
    expect(dispo).toEqual(SERIES_THEMES.filter(s => dispo.includes(s)));
    // Banque du 08/10 (#500) : avec le lot Y, la fin de partie atteint 8 problèmes ; les six séries sont affichées.
    expect(dispo).toEqual(['capturer', 'sauver', 'vie-mort', 'relier-couper', 'fin-de-partie', 'tesuji']);
    expect(problemesDe(BANQUE, 'fin-de-partie').length).toBeGreaterThanOrEqual(MIN_PAR_SERIE);
  });

  it('le Go du jour ne compte pas et ne se joue pas dans une série', () => {
    const peu = BANQUE.filter(p => serieDe(p) === 'sauver').slice(0, MIN_PAR_SERIE);
    expect(seriesDisponibles(peu)).toEqual(['sauver']);
    expect(seriesDisponibles(peu, peu[0].id)).toEqual([]);
    expect(problemesDe(peu, 'sauver', peu[0].id).map(p => p.id)).not.toContain(peu[0].id);
  });
});

describe('prochain problème d’une série, à ta mesure', () => {
  const opts = { reussis: new Set<string>(), jour: 100, alea: () => 0 };

  it('reste dans la série et vise la difficulté de « Continuer »', () => {
    const p = prochainDeSerie(BANQUE, 'capturer', ETAT_INITIAL, opts)!;
    expect(serieDe(p)).toBe('capturer');
    const c = cible(ETAT_INITIAL);
    const ecart = Math.min(...problemesDe(BANQUE, 'capturer').map(q => Math.abs(q.difficulty - c)));
    expect(Math.abs(p.difficulty - c)).toBe(ecart);
  });

  it('suit la cote : un joueur fort reçoit des problèmes plus durs', () => {
    const fort: EtatCote = { ...ETAT_INITIAL, cote: 1400, essais: 40 };
    const facile = prochainDeSerie(BANQUE, 'vie-mort', ETAT_INITIAL, opts)!;
    const dur = prochainDeSerie(BANQUE, 'vie-mort', fort, opts)!;
    expect(dur.difficulty).toBeGreaterThan(facile.difficulty);
  });

  it('après un échec, le suivant est plus facile', () => {
    const premier = prochainDeSerie(BANQUE, 'tesuji', { ...ETAT_INITIAL, cote: 1100, essais: 30 }, opts)!;
    const apres = noter({ ...ETAT_INITIAL, cote: 1100, essais: 30 }, premier, 'rate', 100);
    const suivant = prochainDeSerie(BANQUE, 'tesuji', apres, { ...opts, eviter: premier.id })!;
    expect(suivant.id).not.toBe(premier.id);
    expect(suivant.difficulty).toBeLessThan(premier.difficulty);
  });

  it('exclut le Go du jour et ne repropose jamais le même de suite', () => {
    const premier = prochainDeSerie(BANQUE, 'sauver', ETAT_INITIAL, opts)!;
    const sansLui = prochainDeSerie(BANQUE, 'sauver', ETAT_INITIAL, { ...opts, goDuJour: premier.id })!;
    expect(sansLui.id).not.toBe(premier.id);
    const ensuite = prochainDeSerie(BANQUE, 'sauver', ETAT_INITIAL, { ...opts, eviter: premier.id })!;
    expect(ensuite.id).not.toBe(premier.id);
  });

  it('tout réussi : la série continue avec un problème déjà vu, jamais le même de suite', () => {
    const tous = new Set(problemesDe(BANQUE, 'relier-couper').map(p => p.id));
    const p = prochainDeSerie(BANQUE, 'relier-couper', ETAT_INITIAL, { ...opts, reussis: tous })!;
    expect(tous.has(p.id)).toBe(true);
    const q = prochainDeSerie(BANQUE, 'relier-couper', ETAT_INITIAL, { ...opts, reussis: tous, eviter: p.id })!;
    expect(q.id).not.toBe(p.id);
  });

  it('série vide : rien à proposer', () => {
    expect(prochainDeSerie([], 'capturer', ETAT_INITIAL, opts)).toBeUndefined();
  });
});

describe('réussites d’affilée et record par série', () => {
  it('compte les réussites du premier coup, revient à 0 sur un échec, garde le record', () => {
    let e = nettoyerSeries(null);
    e = noterSerie(e, 'capturer', true).etat;
    e = noterSerie(e, 'capturer', true).etat;
    expect(e.capturer).toEqual({ affilee: 2, record: 2 });
    e = noterSerie(e, 'capturer', false).etat;
    expect(e.capturer).toEqual({ affilee: 0, record: 2 });
    expect(e.sauver).toBeUndefined(); // chaque série a son compteur
  });

  it('signale un nouveau record seulement quand l’ancien est dépassé', () => {
    let e = noterSerie({}, 'tesuji', true);
    expect(e.nouveauRecord).toBe(false); // première réussite : rien à battre
    e = noterSerie({ tesuji: { affilee: 2, record: 2 } }, 'tesuji', true);
    expect(e.nouveauRecord).toBe(true);
    e = noterSerie({ tesuji: { affilee: 1, record: 3 } }, 'tesuji', true);
    expect(e.nouveauRecord).toBe(false);
    expect(noterSerie({ tesuji: { affilee: 3, record: 3 } }, 'tesuji', false).nouveauRecord).toBe(false);
  });

  it('relit un stockage abîmé sans planter', () => {
    expect(nettoyerSeries('x')).toEqual({});
    expect(nettoyerSeries([1])).toEqual({});
    expect(nettoyerSeries({ capturer: { affilee: -2, record: 'a' }, inconnue: { affilee: 3, record: 3 }, sauver: { affilee: 4.7, record: 2 } }))
      .toEqual({ capturer: { affilee: 0, record: 0 }, sauver: { affilee: 4, record: 4 } });
  });
});

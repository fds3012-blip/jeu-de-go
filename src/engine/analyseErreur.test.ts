// #673 : analyse d'une erreur de la revue (bon coup, variantes, propriétés), KataGo seulement.
import { afterEach, describe, expect, it } from 'vitest';
import { setKataGo, type Analysis, type AnalyzeOptions, type KataGoBackend } from './index';
import { analyseErreur, brancherApprofondi, VISITES_ERREUR, type Approfondi } from './revueKataGo';
import { newPosition, play, type Position } from '../go/rules';

const avant = newPosition(9), apres = play(avant, 40) as Position;

function faux(state: 'pret' | 'chargement', reponses: ((p: Position) => Analysis | Promise<Analysis>)): KataGoBackend & { options: AnalyzeOptions[] } {
  const k: KataGoBackend & { options: AnalyzeOptions[] } = {
    options: [],
    info: { state } as KataGoBackend['info'],
    async analyze(pos, o) { k.options.push(o); return reponses(pos); },
  };
  return k;
}
const analyse = (moves: Analysis['moves'], extra: Partial<Analysis> = {}): Analysis =>
  ({ moves, winrate: 0.5, lead: 0, ownership: new Float32Array(81).fill(0.1), visits: VISITES_ERREUR, ms: 1, engine: 'faux', ...extra });

describe('analyseErreur (#673)', () => {
  afterEach(() => setKataGo(undefined));

  it('sans KataGo prêt ni réseau en cache : rien (jamais le moteur simple)', async () => {
    setKataGo(faux('chargement', () => analyse([])));
    expect(await analyseErreur(avant, apres, 6.5)).toEqual({ katago: false });
  });

  it('les deux recherches : bon coup, variante et propriété après lui ; réponse de l’adversaire et propriété après ton coup', async () => {
    const ownBon = new Float32Array(81).fill(0.5);
    const k = faux('pret', p => (p === avant
      ? analyse([{ move: 30, visits: 50, prior: 0.4, winrate: 0.6, lead: 3, scoreLoss: 0, pv: [30, 31, 32] }], { ownershipApres: ownBon })
      : analyse([{ move: 50, visits: 44, prior: 0.4, winrate: 0.6, lead: 2, scoreLoss: 0, pv: [50, 51] }])));
    setKataGo(k);
    const r = await analyseErreur(avant, apres, 7, 'chinese');
    expect(r).toMatchObject({ katago: true, move: 30, lead: 3, visites: 50, pv: [30, 31, 32], riposte: { visites: 44, pv: [50, 51] } });
    expect(r.katago && r.ownBon).toBe(ownBon);
    expect(r.katago && r.ownJoue?.[0]).toBeCloseTo(0.1);
    expect(k.options.map(o => [o.visits, o.komi, o.regles])).toEqual([[VISITES_ERREUR, 7, 'chinese'], [VISITES_ERREUR, 7, 'chinese']]);
  });

  it('seconde recherche en échec : le bon coup reste, sans réponse ni propriété après ton coup', async () => {
    setKataGo(faux('pret', p => { if (p !== avant) throw new Error('panne'); return analyse([{ move: 30, visits: 50, prior: 0.4, winrate: 0.6, lead: 3, scoreLoss: 0 }]); }));
    const r = await analyseErreur(avant, apres, 6.5);
    expect(r).toEqual({ katago: true, move: 30, lead: 3, visites: 50 });
  });

  it('aucun coup proposé : pas de bon coup', async () => {
    setKataGo(faux('pret', () => analyse([], { lead: 1.5 })));
    expect(await analyseErreur(avant, apres, 6.5)).toEqual({ katago: true, move: null, lead: 1.5, visites: 0 });
  });
});

// C8 (#732) : « Analyse approfondie » dans l'analyse d'une erreur. Le petit réseau reste la référence et le repli.
describe('analyseErreur avec l’analyse approfondie (C8)', () => {
  afterEach(() => { setKataGo(undefined); brancherApprofondi(null); });
  const petit = () => faux('pret', p => (p === avant
    ? analyse([{ move: 30, visits: 50, prior: 0.4, winrate: 0.6, lead: 3, scoreLoss: 0, pv: [30] }])
    : analyse([{ move: 50, visits: 44, prior: 0.4, winrate: 0.6, lead: 2, scoreLoss: 0, pv: [50] }])));
  const fort = () => faux('pret', p => (p === avant
    ? analyse([{ move: 31, visits: 60, prior: 0.4, winrate: 0.6, lead: 8, scoreLoss: 0, pv: [31] }])
    : analyse([{ move: 51, visits: 55, prior: 0.4, winrate: 0.6, lead: 1, scoreLoss: 0, pv: [51] }])));
  const brancher = (k: KataGoBackend | null, extra: Partial<Approfondi> = {}) => {
    const journal = { echecs: 0 };
    brancherApprofondi({ fournir: async () => k, echec: () => { journal.echecs++; }, raisonRepli: () => null, options: o => ({ ...o, timeMs: (o.timeMs ?? 0) * 3 }), ...extra });
    return journal;
  };

  it('désactivée (rien de branché) : le petit réseau, résultat inchangé', async () => {
    setKataGo(petit());
    const r = await analyseErreur(avant, apres, 6.5);
    expect(r).toMatchObject({ katago: true, move: 30, lead: 3 });
    expect(r.katago && r.approfondie).toBeUndefined();
    expect(r.katago && r.leadJoue).toBeUndefined();
  });

  it('activée : le réseau approfondi, ses deux avances (jamais mélangées) et plus de temps accordé', async () => {
    const p = petit(), f = fort();
    setKataGo(p);
    brancher(f);
    const r = await analyseErreur(avant, apres, 6.5);
    expect(r).toMatchObject({ katago: true, move: 31, lead: 8, leadJoue: -1, approfondie: true });
    expect(p.options).toHaveLength(0);
    expect(f.options.map(o => [o.visits, o.timeMs])).toEqual([[VISITES_ERREUR, VISITES_ERREUR * 120], [VISITES_ERREUR, VISITES_ERREUR * 120]]);
  });

  it('repli silencieux : pas de réseau approfondi, ou il échoue en route, ou il n’a pas de seconde recherche', async () => {
    setKataGo(petit());
    brancher(null);
    expect(await analyseErreur(avant, apres, 6.5)).toMatchObject({ katago: true, move: 30 });

    const casse = faux('pret', () => { throw new Error('GPU perdu'); });
    const j = brancher(casse);
    const r = await analyseErreur(avant, apres, 6.5);
    expect(r).toMatchObject({ katago: true, move: 30, lead: 3 });
    expect(r.katago && r.approfondie).toBeUndefined();
    expect(j.echecs).toBe(1);

    const sansRiposte = faux('pret', p => (p === avant ? analyse([{ move: 31, visits: 60, prior: 0.4, winrate: 0.6, lead: 8, scoreLoss: 0 }]) : (() => { throw new Error('délai'); })()));
    brancher(sansRiposte);
    expect(await analyseErreur(avant, apres, 6.5)).toMatchObject({ move: 30 });
  });
});

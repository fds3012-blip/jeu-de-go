import { describe, expect, it } from 'vitest';

/** Espaces insécables (« 2\u00a0jours ») lues comme des espaces. */
const sp = (s: string) => s.replace(/\u00a0/g, ' ');
import { aJouer, jetonDeLAdresse, lireResultat, phraseEtat, phraseIssue, resumeDefi, texteDelai, vueDefi } from './defiAmi';
import type { Game } from '../data/games';
import type { Defi } from '../data/defi';

const JETON = 'Ab3_-x'.padEnd(32, 'Z');
const NOIR = 'ami', BLANC = 'createur';
const T0 = Date.parse('2026-09-29T10:00:00Z');
const H = 3_600_000;

const partie = (p: Partial<Game> = {}): Game => ({
  id: 'g', black_id: NOIR, white_id: BLANC, created_by: BLANC, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: '',
  status: 'active', counting: false, dead_stones: null, dead_proposed_by: null, result: null, resumed_at: 0, prive: true, rated: false,
  analysis: null, bot_id: null, invite_code: null, score_black: null, score_white: null, created_at: '', updated_at: '', ...p,
}) as Game;
const defi = (limite: string | null = new Date(T0 + 50 * H).toISOString()): Defi => ({
  partie_id: 'g', jeton: JETON, createur_id: BLANC, invite_id: NOIR, delai_coup: '3 days', date_limite: limite,
  lien_expire_le: '', cree_le: '2026-09-29T09:00:00Z',
});

describe('adresse du lien', () => {
  it('lit `#defi=JETON` et rien d’autre', () => {
    expect(jetonDeLAdresse(`#defi=${JETON}`)).toBe(JETON);
    expect(jetonDeLAdresse(`#${JETON}`)).toBeNull();
    expect(jetonDeLAdresse('#defi=court')).toBeNull();
    expect(jetonDeLAdresse('')).toBeNull();
  });
});

describe('à qui de jouer', () => {
  it('l’ami a Noir et commence ; le créateur attend', () => {
    const ami = vueDefi(partie(), defi(), NOIR, T0);
    expect(ami).toMatchObject({ phase: 'jeu', couleur: 1, trait: 1, aMoi: true, mesCoups: 0, restant: 50 * H });
    const createur = vueDefi(partie(), defi(), BLANC, T0);
    expect(createur).toMatchObject({ couleur: 2, aMoi: false });
    expect(sp(phraseEtat(ami))).toBe('À toi de jouer. Il te reste 2 jours et 2 h.');
    expect(sp(phraseEtat(createur))).toBe('Au tour de ton ami. Il lui reste 2 jours et 2 h.');
    // #393 : le pseudo de l'ami, quand il est connu.
    expect(sp(phraseEtat(createur, 'Lea_du_go'))).toBe('Au tour de Lea_du_go. Il lui reste 2 jours et 2 h.');
    expect(sp(phraseEtat(ami, 'Florian'))).toBe('À toi de jouer. Il te reste 2 jours et 2 h.');
  });

  it('comptage : le pseudo de l’ami dans la proposition (#393)', () => {
    const autre = vueDefi(partie({ moves: 'eett', counting: true, dead_proposed_by: BLANC }), defi(), NOIR, T0);
    expect(phraseEtat(autre, 'Lea_du_go')).toBe('Lea_du_go propose ce compte. Tu es d’accord ?');
    expect(phraseEtat(autre)).toBe('Ton ami propose ce compte. Tu es d’accord ?');
    const moi = vueDefi(partie({ moves: 'eett', counting: true, dead_proposed_by: NOIR }), defi(), NOIR, T0);
    expect(phraseEtat(moi, 'Lea_du_go')).toBe('Compte proposé. Lea_du_go doit l’accepter.');
  });

  it('après un coup de Noir, c’est à Blanc ; Noir a joué une fois', () => {
    const v = vueDefi(partie({ moves: 'ee' }), defi(), NOIR, T0);
    expect(v).toMatchObject({ trait: 2, aMoi: false, mesCoups: 1 });
    expect(v.pos.board[4 * 9 + 4]).toBe(1);
    expect(v.pos.lastMove).toBe(40);
  });

  it('un tiers ne joue pas', () => {
    expect(vueDefi(partie(), defi(), 'autre', T0)).toMatchObject({ couleur: null, aMoi: false });
  });

  it('avant l’arrivée de l’ami : attente, sans délai', () => {
    const v = vueDefi(partie({ status: 'waiting', black_id: null }), defi(null), BLANC, T0);
    expect(v).toMatchObject({ phase: 'attente', restant: null });
    expect(resumeDefi(v)).toEqual({ etat: 'Lien pas encore ouvert', aMoi: false });
  });

  it('comptage : qui a proposé', () => {
    const p = partie({ moves: 'eett', counting: true, dead_stones: 'ee', dead_proposed_by: BLANC });
    expect(vueDefi(p, defi(), NOIR, T0)).toMatchObject({ phase: 'comptage', proposeParAutre: true, proposeParMoi: false, mortes: [40] });
    expect(vueDefi(p, defi(), BLANC, T0)).toMatchObject({ proposeParMoi: true });
  });

  it('la ligne de la liste nomme l’ami quand son pseudo est connu (#400)', () => {
    const aLui = vueDefi(partie({ moves: 'ee' }), defi(), NOIR, T0);
    expect(resumeDefi(aLui, 'Lea_du_go')).toEqual({ etat: 'Au tour de Lea_du_go', aMoi: false });
    expect(resumeDefi(aLui)).toEqual({ etat: 'Au tour de ton ami', aMoi: false });
    // Ami qui a abandonné : « Tu as gagné : Lea_du_go a abandonné. » ; défaite aux points, l'ami est le sujet.
    const abandon = vueDefi(partie({ moves: 'ee', status: 'finished', result: 'W+R' }), defi(), BLANC, T0);
    expect(resumeDefi(abandon, 'Lea_du_go').etat).toBe('Tu as gagné : Lea_du_go a abandonné.');
    expect(resumeDefi(abandon).etat).toBe('Tu as gagné : ton ami a abandonné.');
    const points = vueDefi(partie({ moves: 'ee', status: 'finished', result: 'B+3.5' }), defi(), BLANC, T0);
    expect(phraseIssue(points.issue, 'Lea_du_go')).toBe('Lea_du_go a gagné de 3,5 points.');
    expect(phraseEtat(points, 'Lea_du_go')).toBe('Lea_du_go a gagné de 3,5 points.');
  });

  it('compte les défis à jouer', () => {
    expect(aJouer([vueDefi(partie(), defi(), NOIR, T0), vueDefi(partie(), defi(), BLANC, T0)])).toBe(1);
  });
});

describe('délai de 3 jours', () => {
  it('en mots', () => {
    expect(sp(texteDelai(72 * H))).toBe('3 jours');
    expect(sp(texteDelai(25 * H))).toBe('1 jour et 1 h');
    expect(sp(texteDelai(5 * H + 10))).toBe('5 h');
    expect(sp(texteDelai(20 * 60_000))).toBe('moins d’une heure');
  });

  it('résultat au temps, du point de vue de chacun', () => {
    const p = partie({ status: 'finished', result: 'W+T' });
    const perdant = vueDefi(p, defi(), NOIR, T0);
    expect(perdant.issue).toEqual({ gagne: false, raison: 'temps' });
    expect(phraseEtat(perdant)).toBe('Perdu au temps : 3 jours sont passés sans ton coup.');
    expect(phraseEtat(vueDefi(p, defi(), BLANC, T0))).toBe('Tu as gagné au temps : ton ami n’a pas joué en 3 jours.');
  });

  it('le résultat constaté à la lecture prime sur la ligne lue', () => {
    expect(vueDefi(partie(), defi(), NOIR, T0, 'W+T').phase).toBe('fini');
  });
});

describe('lireResultat', () => {
  it('points, abandon, égalité', () => {
    expect(lireResultat('B+3.5', 1)).toEqual({ gagne: true, raison: 'points', marge: 3.5 });
    expect(lireResultat('B+R', 2)).toEqual({ gagne: false, raison: 'abandon' });
    expect(lireResultat('0', 1)).toEqual({ gagne: null, raison: 'egalite' });
    expect(lireResultat(null, 1)).toBeNull();
  });
});

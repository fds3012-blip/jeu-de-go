import { describe, expect, it } from 'vitest';
import { issueMesure, phraseDirect, phraseFinDirect, texteCadence, vueDirect } from './direct';
import type { EtatDirect } from '../go/pendule';
import type { Game } from '../data/games';
import { CATALOGUE_DIRECT, type CleDirect } from '../content/i18n/direct';

const NOIR = 'noir-0000', BLANC = 'blanc-000';
const partie = { id: 'p', black_id: NOIR, white_id: BLANC, size: 9, komi: 6.5, rules: 'japanese', handicap: 0, moves: '', rated: true } as unknown as Game;
const T0 = 1_000_000;
const etat = (e: Partial<EtatDirect> = {}): EtatDirect => ({
  statut: 'active', resultat: null, coups: '', comptage: false, mortes: null, mortesPar: null, cadence: 'normale', periodeMs: 30_000,
  noir: { ms: 600_000, periodes: 3, vuLe: T0 }, blanc: { ms: 600_000, periodes: 3, vuLe: T0 }, traitDepuis: T0, maintenant: T0, ...e,
});

describe('vue de la partie en direct', () => {
  it('Noir commence : c’est à lui ; Blanc attend', () => {
    const v = vueDirect(partie, etat(), NOIR, T0 + 3_000);
    expect(v).toMatchObject({ phase: 'jeu', couleur: 1, trait: 1, aMoi: true, mesCoups: 0, absenceLui: null });
    expect(v.cadrans[1].ms).toBe(597_000);
    expect(phraseDirect(v, 'Léa', true)).toBe('Partie classée contre Léa. À toi de commencer !');
    const w = vueDirect(partie, etat(), BLANC, T0 + 3_000);
    expect(w.aMoi).toBe(false);
    expect(phraseDirect(w, 'Léa', true)).toBe('Au tour de Léa.');
  });
  it('adversaire silencieux depuis plus de 15 s, à lui de jouer : le temps qui lui reste pour revenir', () => {
    const v = vueDirect(partie, etat({ noir: { ms: 600_000, periodes: 3, vuLe: T0 - 30_000 }, traitDepuis: T0 - 30_000 }), BLANC, T0 + 0);
    expect(v.absenceLui).toBe(30);
    expect(phraseDirect(v, 'Léa', true)).toBe('Léa n’est plus là. Encore 30 s pour revenir.');
    // C'est à moi : son silence ne compte pas.
    expect(vueDirect(partie, etat({ coups: 'ee', blanc: { ms: 600_000, periodes: 3, vuLe: T0 - 40_000 } }), BLANC, T0).absenceLui).toBe(null);
  });
  it('hors ligne : dit clairement que la pendule tourne', () => {
    expect(phraseDirect(vueDirect(partie, etat(), NOIR, T0), 'Léa', false)).toBe('Tu es hors ligne. Ta pendule tourne : reviens vite.');
  });
  it('byo-yomi : le temps de la période', () => {
    const v = vueDirect(partie, etat({ coups: 'eecc', noir: { ms: 0, periodes: 2, vuLe: T0 } }), NOIR, T0 + 12_000);
    expect(phraseDirect(v, 'Léa', true)).toBe('Byo-yomi : joue en moins de 18 s.');
  });
  it('comptage : proposer, accepter, attendre', () => {
    const c = etat({ coups: 'eecctttt', comptage: true, traitDepuis: null });
    expect(phraseDirect(vueDirect(partie, c, NOIR, T0), 'Léa', true)).toMatch(/^Vous avez passé/);
    expect(phraseDirect(vueDirect(partie, { ...c, mortes: '', mortesPar: BLANC }, NOIR, T0), 'Léa', true)).toBe('Léa propose ce compte. Tu es d’accord ?');
    expect(phraseDirect(vueDirect(partie, { ...c, mortes: '', mortesPar: NOIR }, NOIR, T0), 'Léa', true)).toBe('Compte proposé. Léa doit l’accepter.');
  });
  it('fins : points, temps, abandon, égalité, annulée', () => {
    const fin = (resultat: string | null, statut: EtatDirect['statut'] = 'finished') => vueDirect(partie, etat({ statut, resultat, traitDepuis: null }), NOIR, T0);
    expect(phraseFinDirect(fin('B+3.5'), 'Léa')).toBe('Tu as gagné de 3,5 points !');
    expect(phraseFinDirect(fin('W+12'), 'Léa')).toBe('Léa a gagné de 12 points.');
    expect(phraseFinDirect(fin('W+T'), 'Léa')).toBe('Perdu au temps.');
    expect(phraseFinDirect(fin('B+T'), 'Léa')).toBe('Tu as gagné au temps !');
    expect(phraseFinDirect(fin('B+R'), 'Léa')).toBe('Léa abandonne. Tu as gagné !');
    expect(phraseFinDirect(fin('W+R'), 'Léa')).toBe('Tu as abandonné.');
    expect(phraseFinDirect(fin('0'), 'Léa')).toBe('Égalité parfaite.');
    const annulee = fin(null, 'aborted');
    expect(annulee.phase).toBe('annulee');
    expect(phraseFinDirect(annulee, 'Léa')).toMatch(/Ta cote ne bouge pas/);
    expect([issueMesure(fin('B+T')), issueMesure(fin('W+R')), issueMesure(fin('0')), issueMesure(annulee), issueMesure(vueDirect(partie, etat(), NOIR, T0))])
      .toEqual(['victoire', 'defaite', 'egalite', 'annulee', null]);
  });
  it('temps de jeu écrit', () => {
    expect(texteCadence('normale')).toBe('10 min + 3 × 30 s');
    expect(texteCadence('rapide')).toBe('5 min + 3 × 20 s');
  });
});

describe('textes du direct', () => {
  const cles = Object.keys(CATALOGUE_DIRECT.fr) as CleDirect[];
  it('mêmes clés en français et en anglais, aucune vide', () => {
    expect(Object.keys(CATALOGUE_DIRECT.en).sort()).toEqual([...cles].sort());
    for (const k of cles) { expect(CATALOGUE_DIRECT.fr[k].trim()).not.toBe(''); expect(CATALOGUE_DIRECT.en[k].trim()).not.toBe(''); }
  });
  it('tutoiement, phrases courtes, mêmes variables', () => {
    for (const k of cles) {
      const s = CATALOGUE_DIRECT.fr[k];
      // « Vous avez passé tous les deux » : les deux joueurs, pas du vouvoiement.
      if (k !== 'direct.etat.comptage') expect(s, k).not.toMatch(/\b(vous|votre|vos)\b/i);
      for (const phrase of s.split(/[.!?]\s/)) expect(phrase.split(/\s+/).length, `${k} : ${phrase}`).toBeLessThanOrEqual(16);
      const vars = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      expect(vars(CATALOGUE_DIRECT.en[k]), k).toEqual(vars(s));
    }
  });
  it('byo-yomi expliqué là où on choisit le temps de jeu', () => {
    expect(CATALOGUE_DIRECT.fr['direct.byoyomi']).toMatch(/c’est le byo-yomi/);
  });
});

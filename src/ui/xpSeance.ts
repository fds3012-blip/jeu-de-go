// #509 (lot L1, n° 2) : l'XP d'une séance (« Rejouer mes erreurs », révisions du jour) se lit en un seul montant, dans
// la carte de fin : le gain de la séance, le bonus « première fois » et l'objectif de la semaine atteint en route.
// C'est le gain réel de la barre d'XP ; la pastille globale ne le répète pas (l'écran marque l'XP vue).
import { useEffect, useRef } from 'react';
import { abonnerXp, type Gain } from '../app/xp';

export interface XpSeance {
  /** Total gagné pendant la séance, bonus et objectif compris. */
  points: number;
  /** Part du bonus « première fois ». */
  bonus: number;
  /** Part de l'objectif de la semaine. */
  objectif: number;
}

export const XP_SEANCE_VIDE: XpSeance = { points: 0, bonus: 0, objectif: 0 };

/** Ajoute un gain au total de la séance. */
export function ajouterGain(x: XpSeance, g: Pick<Gain, 'source' | 'points' | 'bonus'>): XpSeance {
  return { points: x.points + g.points, bonus: x.bonus + g.bonus, objectif: x.objectif + (g.source === 'objectif' ? g.points : 0) };
}

/** Additionne chaque gain d'XP tant que l'écran de la séance est monté. */
export function useXpSeance() {
  const total = useRef<XpSeance>(XP_SEANCE_VIDE);
  useEffect(() => abonnerXp(g => { total.current = ajouterGain(total.current, g); }), []);
  return total;
}

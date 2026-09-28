// Accueil (issues #23 et #40, phase 4) : la réplique de l'adversaire, l'action principale, et l'échelle des adversaires.
import { fr } from '../ui/typo';
import { t } from '../content/i18n';
import { battu, type Bilan } from './bilan';
import { estRetour, repliqueDuJour } from './flamme';

/** Historique minimal des parties, gardé en localStorage. `ordi` : parties contre l'ordi lancées (#160, voir equilibrage.ts). */
export interface Parties { n: number; dernier?: string; ordi?: number }
export const PARTIES_KEY = 'go.parties.v1';
/** Bulle « but du jeu » affichée une seule fois, au début de la première partie contre l'ordi. */
export const INTRO_KEY = 'go.intro-but.v1';

export const introBut = (nom: string) =>
  fr(t('accueil.introBut', { nom }));

export interface Accueil {
  /** Réplique de l'adversaire, dans sa bulle sur le plateau d'accueil. */
  bulle: string;
  /** Libellé visible de l'action principale : une seule ligne, même sur iPhone SE (issue #85). */
  cta: string;
  /** Nom accessible du bouton : le libellé visible, complété par l'adversaire quand le sceau le porte (WCAG 2.5.3). */
  ctaNom: string;
  /** Nouveau joueur : ni partie ni leçon. */
  nouveau: boolean;
}

/**
 * Textes de l'accueil (espaces fines insécables avant ? ! : grâce à `fr`). L'adversaire parle, et sa réplique
 * invite à la même action que le bouton principal. Issue #119 : elle ne dit plus de toucher le plateau,
 * pour qu'il n'y ait qu'une seule action principale.
 * - Nouveau joueur (aucune partie, aucune leçon) : première pierre au centre.
 * - Leçons faites mais aucune partie : on l'invite à sa première partie.
 * - Joueur qui revient : « Rejouer contre X » si c'est son dernier adversaire, sinon « Jouer contre X ».
 */
/** Contexte du jour (issue #213) : la bulle change selon le jour, le Go du jour et le retour après une absence. */
export interface Jour {
  /** Numéro du Go du jour d'aujourd'hui. */
  numero: number;
  /** Jours depuis la visite précédente (0 : déjà venu aujourd'hui ou hier, ou premier passage). */
  absence: number;
  duJourFait: boolean;
  titreDuJour?: string;
}

/**
 * Réplique du joueur qui revient, choisie par jour (même jour, même réplique) :
 * - après une absence (3 jours ou plus) : un accueil chaleureux, sans reproche ;
 * - sinon, une rotation de répliques, dont une sur le Go du jour (à faire, ou fait).
 */
function bulleDuJour(jour: Jour, rejouer: boolean, plateau: string): string {
  if (estRetour(jour.absence)) {
    return repliqueDuJour([
      () => t('accueil.bulle.retour.0'),
      () => t('accueil.bulle.retour.1', { plateau }),
      () => t('accueil.bulle.retour.2'),
    ], jour.numero)();
  }
  const duJour = jour.duJourFait
    ? () => t('accueil.bulle.duJourFait', { plateau })
    : jour.titreDuJour ? () => t('accueil.bulle.duJour', { titre: jour.titreDuJour! }) : () => t('accueil.bulle.jour', { plateau });
  const lignes = rejouer
    ? [() => t('accueil.bulle.rejouer', { plateau }), () => t('accueil.bulle.revanche'), duJour, () => t('accueil.bulle.jour', { plateau })]
    : [() => t('accueil.bulle.jouer', { plateau }), duJour, () => t('accueil.bulle.jour', { plateau })];
  return repliqueDuJour(lignes, jour.numero)();
}

export function accueil(parties: Parties, lecons: number, adv: { id: string; nom: string }, taille: number, jour?: Jour): Accueil {
  const plateau = `${taille}\u00A0×\u00A0${taille}`; // insécables : « 9 × 9 » ne se coupe pas
  if (parties.n === 0) {
    // Le nom de l'adversaire est déjà juste au-dessus, en grand, et son sceau est dans le bouton.
    const cta = t('accueil.cta.premiere');
    const ctaNom = t('accueil.cta.premiereNom', { nom: adv.nom });
    if (lecons === 0) return { nouveau: true, cta, ctaNom, bulle: fr(t('accueil.bulle.nouveau')) };
    return { nouveau: false, cta, ctaNom, bulle: fr(t('accueil.bulle.lecons', { n: lecons })) };
  }
  const rejouer = parties.dernier === adv.id;
  const cta = t(rejouer ? 'accueil.cta.rejouer' : 'accueil.cta.jouer', { nom: adv.nom });
  return {
    nouveau: false,
    cta,
    ctaNom: cta,
    bulle: fr(jour ? bulleDuJour(jour, rejouer, plateau) : t(rejouer ? 'accueil.bulle.rejouer' : 'accueil.bulle.jouer', { plateau })),
  };
}

export interface Echelon<T> {
  adv: T;
  battu: boolean;
  /** On peut le choisir. Pomme et Caillou le sont toujours ; ensuite, il faut avoir battu le précédent. */
  ouvert: boolean;
  /** Verrouillé : l'adversaire à battre d'abord (le premier ouvert et pas encore battu en dessous). */
  requis?: T;
}

/** Nombre d'adversaires ouverts d'office, quel que soit le bilan. */
export const OUVERTS_D_OFFICE = 2;

/** Échelle des adversaires, dans l'ordre, avec leur verrou calculé à partir du bilan (`go.bilan.v1`). */
export function echelle<T extends { id: string }>(liste: readonly T[], bilan: Bilan): Echelon<T>[] {
  const out: Echelon<T>[] = [];
  liste.forEach((adv, i) => {
    const b = battu(bilan, adv.id);
    const ouvert = i < OUVERTS_D_OFFICE || battu(bilan, liste[i - 1].id);
    let requis: T | undefined;
    if (!ouvert) {
      // Le premier adversaire ouvert et pas encore battu, en remontant vers le bas de l'échelle.
      for (let j = i - 1; j >= 0 && !requis; j--) if (out[j].ouvert && !out[j].battu) requis = out[j].adv;
      requis ??= liste[i - 1];
    }
    out.push({ adv, battu: b, ouvert, requis });
  });
  return out;
}

/**
 * Adversaire réellement proposé : celui choisi s'il est ouvert, sinon celui qu'il faut battre d'abord.
 * (Un choix fait avant l'arrivée des verrous peut désigner un adversaire verrouillé.)
 */
export function adversaireOuvert<T extends { id: string }>(liste: readonly T[], bilan: Bilan, id: string): T {
  const e = echelle(liste, bilan).find(x => x.adv.id === id);
  if (!e) return liste[0];
  return e.ouvert ? e.adv : (e.requis ?? liste[0]);
}

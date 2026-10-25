// #673 : format des analyses de KataGo figées pour l'analyse expliquée (src/go/explications-katago.json, produit par
// outils/explicationsKataGo.ts) et passage vers l'entrée du générateur (src/go/explication.ts).
import type { Position } from './rules';
import type { Entree } from './explication';

/** Les deux recherches d'une erreur, comme `analyseErreur` (src/engine/revueKataGo.ts). Propriétés arrondies au centième. */
export interface FigeErreur {
  id: string;
  /** Vraies parties : numéro du coup, note et avance de Noir après le coup (revue à 32 visites). */
  coup?: number;
  note?: string;
  avance?: number;
  /** Points perdus : ceux de la note (vraies parties), sinon l'écart des deux recherches. */
  perte: number;
  joue: number;
  bon: number;
  /** Avance du joueur au trait après le bon coup, et de l'adversaire après ton coup (sa meilleure réponse). */
  leadBon: number;
  leadRiposte: number;
  visitesBon: number;
  pvBon: number[];
  ownBon?: number[];
  visitesRiposte: number;
  pvRiposte: number[];
  ownJoue?: number[];
}

export interface FigeExplications {
  reglages: { modele: string; visites: number; visitesRevue: number };
  cas: FigeErreur[];
  parties: { id: string; sgf: string; erreurs: FigeErreur[] }[];
}

/** Entrée du générateur pour une erreur figée, depuis la position d'avant. */
export function entreeDe(avant: Position, f: FigeErreur): Entree {
  return {
    avant, joue: f.joue, bon: f.bon, perte: f.perte,
    pvBon: f.pvBon, visitesBon: f.visitesBon, ownBon: f.ownBon ?? null,
    pvRiposte: f.pvRiposte, visitesRiposte: f.visitesRiposte, ownJoue: f.ownJoue ?? null,
  };
}

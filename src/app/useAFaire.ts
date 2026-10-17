// Notifications dans l'app (#367) : crochet léger du JS initial. Le calcul (aFaire.ts) et la lecture des défis
// (aFaireCharge.ts) arrivent après le premier écran, par import dynamique : l'accueil s'affiche sans les attendre,
// les pastilles et la tuile du défi se posent un instant après (budget du JS initial, scripts/budget-bundle.mjs).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Db } from '../data/supabase';
import type { Onglet } from '../ui/onglets';
import type { DefiEnAttente, DonneesAFaire, ElementAFaire } from './aFaire';
import type { RechercheLente } from '../data/lente';
import { useOnline } from './hooks';
import { premierEcran } from '../premierEcran';

type Module = typeof import('./aFaireCharge');
let chargement: Promise<Module> | null = null;
const charger = () => (chargement ??= premierEcran().then(() => import('./aFaireCharge')));

/** Intervalle de relecture des défis tant que l'app est visible : le coup d'un ami apparaît sans recharger. */
export const RELECTURE_MS = 60_000;

const AUCUNE: ReadonlyMap<Onglet, string> = new Map();
const AUCUN: DefiEnAttente[] = [];

export interface EntreeAFaire extends Omit<DonneesAFaire, 'defis' | 'leconEnCours' | 'demandesAmis'> {
  /** #359 : compte complet, qui a des amis : ses demandes reçues sont lues avec le reste (#584). */
  amis: boolean;
  lecons: readonly { id: string; title: string; steps: readonly unknown[] }[];
  progres: Readonly<Record<string, number>>;
}

/**
 * Ce qui attend le joueur. Les défis sont relus au retour sur l'app, toutes les minutes tant qu'elle est visible, à
 * chaque notification du joueur (temps réel, sous la RLS, #367) et au retour d'une partie. #584 : à un changement de
 * `cle` (écran affiché), seulement si la lecture gardée a plus d'une minute ou si « À faire » a changé depuis
 * (src/app/aFaireCharge.ts). Rien sans session, hors ligne ou inactif (pendant une partie) pour les défis.
 */
export function useAFaire(db: Db | null, userId: string | undefined, cle: string, actif: boolean, entree: EntreeAFaire): {
  defis: DefiEnAttente[]; elements: ElementAFaire[]; pastilles: ReadonlyMap<Onglet, string>;
  /** #369 : un ami t'a rappelé le Go du jour aujourd'hui. */
  rappelGoDuJour: boolean;
  /** #440 : recherche de partie lente en cours, ou adversaire trouvé pendant l'absence. */
  recherche: RechercheLente | null;
  /** #359 : demandes d'ami reçues (pastille du Profil, « Mes amis »). */
  demandesAmis: number;
  /** Relit tout de suite (après l'annulation d'une recherche, par exemple). */
  relire: () => void;
} {
  const online = useOnline();
  const [mod, setMod] = useState<Module | null>(null);
  const [defis, setDefis] = useState<DefiEnAttente[]>([]);
  // #369 : rappel du Go du jour d'un ami, lu avec les défis.
  const [rappel, setRappel] = useState(false);
  const [recherche, setRecherche] = useState<RechercheLente | null>(null);
  const [demandes, setDemandes] = useState(0);
  const [tic, setTic] = useState(0);
  const pseudos = useRef(new Map<string, string | null>());
  // #584 : la prochaine lecture passe outre la lecture gardée (première, retour d'une partie, relecture demandée).
  const forcer = useRef(true);

  useEffect(() => {
    let vivant = true;
    charger().then(m => { if (vivant) setMod(m); }, () => { /* hors ligne sans le module : pas de pastille */ });
    return () => { vivant = false; };
  }, []);

  // Relecture : retour sur l'app, minuterie, temps réel.
  useEffect(() => {
    if (!mod || !db || !userId || !online || !actif) return;
    const relire = () => { if (document.visibilityState !== 'hidden') { forcer.current = true; setTic(n => n + 1); } };
    document.addEventListener('visibilitychange', relire);
    const id = setInterval(relire, RELECTURE_MS);
    // Temps réel : la file de notifications du joueur seul (filtre et RLS, #367), pas toute la table `games`, que la
    // RLS ouvre aux parties publiques de tous les joueurs : chaque coup joué n'importe où relançait une lecture.
    let arreter: (() => void) | null = null;
    try {
      arreter = mod.ecouterNotifications(db, userId, relire);
    } catch { /* temps réel indisponible : la minuterie suffit */ }
    return () => {
      document.removeEventListener('visibilitychange', relire);
      clearInterval(id);
      arreter?.();
    };
  }, [mod, db, userId, online, actif]);

  useEffect(() => {
    if (!actif) forcer.current = true;
    if (!mod || !db || !userId || !online || !actif) return;
    let vivant = true;
    mod.chargerAFaireFrais(db, userId, pseudos.current, entree.amis, forcer.current).then(l => {
      if (vivant) { setDefis(l.defis); setRappel(l.rappelGoDuJour); setRecherche(l.recherche); setDemandes(l.demandesAmis); }
    }, () => { if (vivant) { setDefis([]); setRappel(false); setRecherche(null); setDemandes(0); } });
    forcer.current = false;
    return () => { vivant = false; };
  }, [mod, db, userId, online, actif, cle, tic, entree.amis]);

  const liste = userId && online ? defis : AUCUN;
  const rappelGoDuJour = !!userId && online && rappel;
  const { lecons, progres, premier, serie, duJourFait, goDuJour } = entree;
  const demandesAmis = userId && online && entree.amis ? demandes : 0;
  const titreDuJour = goDuJour?.titre, numero = goDuJour?.numero;
  const elements = useMemo(() => mod ? mod.elementsAFaire({
    premier, defis: liste, serie, duJourFait, demandesAmis, rappelGoDuJour,
    goDuJour: numero !== undefined && titreDuJour !== undefined ? { numero, titre: titreDuJour } : null,
    leconEnCours: mod.leconEnCours(lecons, progres),
  }) : [], [mod, premier, liste, serie, duJourFait, demandesAmis, rappelGoDuJour, numero, titreDuJour, lecons, progres]);
  const pastilles = useMemo(() => mod ? mod.ongletsAPastille(elements) : AUCUNE, [mod, elements]);
  const relire = useCallback(() => { forcer.current = true; setTic(n => n + 1); }, []);
  return { defis: liste, elements, pastilles, rappelGoDuJour, recherche: userId && online ? recherche : null, demandesAmis, relire };
}

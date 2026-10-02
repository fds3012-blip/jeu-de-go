// Notifications dans l'app (#367) : crochet léger du JS initial. Le calcul (aFaire.ts) et la lecture des défis
// (aFaireCharge.ts) arrivent après le premier écran, par import dynamique : l'accueil s'affiche sans les attendre,
// les pastilles et la tuile du défi se posent un instant après (budget du JS initial, scripts/budget-bundle.mjs).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Db } from '../data/supabase';
import type { Onglet } from '../ui/onglets';
import type { DefiEnAttente, DonneesAFaire, ElementAFaire } from './aFaire';
import { useOnline } from './hooks';
import { premierEcran } from '../premierEcran';

type Module = typeof import('./aFaireCharge');
let chargement: Promise<Module> | null = null;
const charger = () => (chargement ??= premierEcran().then(() => import('./aFaireCharge')));

/** Intervalle de relecture des défis tant que l'app est visible : le coup d'un ami apparaît sans recharger. */
export const RELECTURE_MS = 60_000;

const AUCUNE: ReadonlyMap<Onglet, string> = new Map();
const AUCUN: DefiEnAttente[] = [];

export interface EntreeAFaire extends Omit<DonneesAFaire, 'defis' | 'leconEnCours'> {
  lecons: readonly { id: string; title: string; steps: readonly unknown[] }[];
  progres: Readonly<Record<string, number>>;
}

/**
 * Ce qui attend le joueur. Les défis sont relus à chaque changement de `cle` (écran affiché), au retour sur l'app,
 * toutes les minutes tant qu'elle est visible, et à chaque changement d'une de ses parties (temps réel, sous la RLS).
 * Rien sans session, hors ligne ou inactif (pendant une partie) pour les défis.
 */
export function useAFaire(db: Db | null, userId: string | undefined, cle: string, actif: boolean, entree: EntreeAFaire): {
  defis: DefiEnAttente[]; elements: ElementAFaire[]; pastilles: ReadonlyMap<Onglet, string>;
} {
  const online = useOnline();
  const [mod, setMod] = useState<Module | null>(null);
  const [defis, setDefis] = useState<DefiEnAttente[]>([]);
  const [tic, setTic] = useState(0);
  const pseudos = useRef(new Map<string, string | null>());

  useEffect(() => {
    let vivant = true;
    charger().then(m => { if (vivant) setMod(m); }, () => { /* hors ligne sans le module : pas de pastille */ });
    return () => { vivant = false; };
  }, []);

  // Relecture : retour sur l'app, minuterie, temps réel.
  useEffect(() => {
    if (!mod || !db || !userId || !online || !actif) return;
    const relire = () => { if (document.visibilityState !== 'hidden') setTic(n => n + 1); };
    document.addEventListener('visibilitychange', relire);
    const id = setInterval(relire, RELECTURE_MS);
    let canal: ReturnType<Db['channel']> | null = null;
    try {
      canal = db.channel(`a-faire-${userId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games' }, relire)
        .subscribe();
    } catch { /* temps réel indisponible : la minuterie suffit */ }
    return () => {
      document.removeEventListener('visibilitychange', relire);
      clearInterval(id);
      if (canal) void db.removeChannel(canal);
    };
  }, [mod, db, userId, online, actif]);

  useEffect(() => {
    if (!mod || !db || !userId || !online || !actif) return;
    let vivant = true;
    mod.chargerDefis(db, userId, pseudos.current).then(l => { if (vivant) setDefis(l); }, () => { if (vivant) setDefis([]); });
    return () => { vivant = false; };
  }, [mod, db, userId, online, actif, cle, tic]);

  const liste = userId && online ? defis : AUCUN;
  const { lecons, progres, premier, serie, duJourFait, goDuJour, demandesAmis } = entree;
  const titreDuJour = goDuJour?.titre, numero = goDuJour?.numero;
  const elements = useMemo(() => mod ? mod.elementsAFaire({
    premier, defis: liste, serie, duJourFait, demandesAmis,
    goDuJour: numero !== undefined && titreDuJour !== undefined ? { numero, titre: titreDuJour } : null,
    leconEnCours: mod.leconEnCours(lecons, progres),
  }) : [], [mod, premier, liste, serie, duJourFait, demandesAmis, numero, titreDuJour, lecons, progres]);
  const pastilles = useMemo(() => mod ? mod.ongletsAPastille(elements) : AUCUNE, [mod, elements]);
  return { defis: liste, elements, pastilles };
}

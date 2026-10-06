// Suivi temps réel fiable d'une partie (issue #425) : le coup de l'adversaire doit arriver en moins de 500 ms.
//
// Supabase Realtime pousse la ligne modifiée (`postgres_changes`, RLS appliquée par le serveur) : l'écran l'affiche
// telle quelle, sans relire la base. Ce module ajoute ce que le simple `.subscribe()` ne faisait pas :
// - un sujet de canal unique à chaque abonnement : `db.channel(sujet)` rend le canal existant s'il a le même nom, et
//   un écran qui se réabonne (effet relancé) récupérait le canal en train d'être fermé, donc plus aucun événement ;
// - le suivi de l'état de l'abonnement : erreur, délai dépassé ou fermeture → nouvel abonnement (1 s, 2 s, 5 s, 10 s) ;
// - au retour au premier plan (`visibilitychange`, `pageshow`) ou du réseau (`online`) : relecture immédiate, puis
//   nouvel abonnement. Sur iOS, la connexion WebSocket meurt pendant la mise en arrière-plan, et la bibliothèque ne
//   s'en aperçoit qu'au battement suivant (jusqu'à 25 s, plus le délai de reconnexion) : les coups n'arrivaient plus ;
// - un chien de garde : sans confirmation de l'abonnement en 3 s, la connexion est refaite (connexion à demi ouverte),
//   puis le délai double à chaque nouvel essai (réseau lent) ;
// - une relecture (`rattraper`) à chaque abonnement confirmé : rien n'est perdu entre deux connexions.
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Game } from './games';
import type { Db } from './supabase';

/** Une table suivie : ses lignes modifiées (UPDATE) qui passent le filtre, par exemple `id=eq.<uuid>`. */
export interface Liaison {
  table: string;
  filtre: string;
  /** La ligne après modification, telle que le serveur l'a écrite (visible par ce joueur, RLS comprise). */
  surLigne: (ligne: Record<string, unknown>) => void;
  /** Événement suivi : UPDATE par défaut ; INSERT pour une table où l'on ne fait qu'ajouter (#373 : messages en partie). */
  evenement?: 'UPDATE' | 'INSERT';
}

export interface OptionsSuivi {
  /** Relire l'état complet : abonnement (re)confirmé, retour au premier plan, retour du réseau. */
  rattraper: () => void;
  /** Délais de réabonnement après un échec (ms). */
  delais?: readonly number[];
  /** Délai d'attente de la confirmation de l'abonnement avant de refaire la connexion (ms). */
  gardeMs?: number;
  /** Mise en arrière-plan plus courte que ceci : pas de nouvel abonnement au retour, seulement la relecture (ms). */
  absenceMs?: number;
}

export const DELAIS_REABONNEMENT = [1000, 2000, 5000, 10_000] as const;
export const GARDE_MS = 3000;
export const ABSENCE_MS = 1000;

let numero = 0;

/**
 * Suit des lignes en temps réel, de façon fiable. Renvoie la fonction qui arrête le suivi.
 * `nom` préfixe le sujet du canal (`defi-<id>`, `direct-<id>`) ; un numéro le rend unique.
 */
export function suivreLignes(db: Db, nom: string, liaisons: readonly Liaison[], o: OptionsSuivi): () => void {
  const delais = o.delais ?? DELAIS_REABONNEMENT;
  const gardeMs = o.gardeMs ?? GARDE_MS;
  const absenceMs = o.absenceMs ?? ABSENCE_MS;
  let canal: RealtimeChannel | null = null;
  let arrete = false;
  let essais = 0;
  let reconnexions = 0;
  let reprise: ReturnType<typeof setTimeout> | undefined;
  let garde: ReturnType<typeof setTimeout> | undefined;
  let cacheDepuis: number | null = typeof document !== 'undefined' && document.visibilityState === 'hidden' ? Date.now() : null;

  const fermer = () => {
    clearTimeout(garde);
    if (canal) { const c = canal; canal = null; void db.removeChannel(c); }
  };

  /** Refait la connexion WebSocket (à demi ouverte après une mise en veille) ; les canaux se réabonnent seuls. */
  const reconnecter = () => {
    const rt = db.realtime;
    void Promise.resolve(rt.disconnect()).catch(() => undefined).then(() => { if (!arrete) { rt.connect(); abonner(); } });
  };

  const echec = () => {
    if (arrete) return;
    fermer();
    clearTimeout(reprise);
    const d = delais[Math.min(essais, delais.length - 1)];
    essais++;
    reprise = setTimeout(abonner, d);
  };

  function abonner() {
    if (arrete) return;
    clearTimeout(reprise);
    fermer();
    let c = db.channel(`${nom}-${++numero}`);
    for (const l of liaisons) {
      c = c.on('postgres_changes', { event: l.evenement ?? 'UPDATE', schema: 'public', table: l.table, filter: l.filtre },
        p => { if (!arrete && c === canal && p.new && typeof p.new === 'object') l.surLigne(p.new as Record<string, unknown>); });
    }
    canal = c;
    // Réseau lent : chaque nouvelle tentative attend deux fois plus longtemps (au plus 30 s) avant de tout refaire.
    garde = setTimeout(() => { if (!arrete && canal === c) { reconnexions++; reconnecter(); } }, Math.min(30_000, gardeMs * 2 ** reconnexions));
    c.subscribe(etat => {
      if (arrete || canal !== c) return;
      if (etat === 'SUBSCRIBED') {
        clearTimeout(garde);
        essais = 0;
        reconnexions = 0;
        o.rattraper();
      } else if (etat === 'CHANNEL_ERROR' || etat === 'TIMED_OUT' || etat === 'CLOSED') {
        echec();
      }
    });
  }

  /** Retour au premier plan ou du réseau : relecture tout de suite, nouvel abonnement si l'absence a duré. */
  const reveil = (force: boolean) => {
    if (arrete) return;
    const absence = cacheDepuis === null ? 0 : Date.now() - cacheDepuis;
    cacheDepuis = null;
    o.rattraper();
    if (force || absence >= absenceMs || !db.realtime.isConnected() || canal?.state !== 'joined') {
      essais = 0;
      if (!db.realtime.isConnected()) db.realtime.connect();
      abonner();
    }
  };
  const visibilite = () => {
    if (document.visibilityState === 'hidden') { cacheDepuis ??= Date.now(); return; }
    reveil(false);
  };
  const enLigne = () => reveil(true);
  const pageshow = (e: PageTransitionEvent) => { if (e.persisted) reveil(true); };

  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', visibilite);
    window.addEventListener('online', enLigne);
    window.addEventListener('pageshow', pageshow);
  }
  abonner();

  return () => {
    arrete = true;
    clearTimeout(reprise);
    fermer();
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilite);
      window.removeEventListener('online', enLigne);
      window.removeEventListener('pageshow', pageshow);
    }
  };
}

type Champ = 'texte' | 'texteOuNull' | 'booleen' | 'nombre' | 'nombreOuNull';
const accepte = (v: unknown, c: Champ): boolean =>
  c === 'texte' ? typeof v === 'string'
    : c === 'texteOuNull' ? v === null || typeof v === 'string'
      : c === 'booleen' ? typeof v === 'boolean'
        : c === 'nombre' ? typeof v === 'number' && Number.isFinite(v)
          : v === null || (typeof v === 'number' && Number.isFinite(v));

/** Colonnes de `games` qu'un événement peut changer pendant la partie, avec leur type attendu. */
const CHAMPS_PARTIE: Partial<Record<keyof Game, Champ>> = {
  moves: 'texte', status: 'texte', result: 'texteOuNull', counting: 'booleen', dead_stones: 'texteOuNull',
  dead_proposed_by: 'texteOuNull', resumed_at: 'nombre', score_black: 'nombreOuNull', score_white: 'nombreOuNull',
  black_id: 'texteOuNull', white_id: 'texteOuNull', updated_at: 'texte'
};

/**
 * Applique à la partie affichée la ligne poussée par le temps réel. Seules les colonnes connues, bien typées et
 * présentes sont reprises (une grande colonne inchangée peut manquer dans l'événement). Renvoie null si la ligne est
 * plus ancienne que l'affichage (moins de coups : événement en retard, ou coup affiché d'avance chez qui joue).
 */
export function fusionnerPartie<G extends Pick<Game, 'moves'>>(actuelle: G, ligne: Record<string, unknown>): G | null {
  if (typeof ligne.moves === 'string' && ligne.moves.length < actuelle.moves.length) return null;
  const patch: Record<string, unknown> = {};
  for (const [cle, champ] of Object.entries(CHAMPS_PARTIE)) {
    if (cle in ligne && accepte(ligne[cle], champ!)) patch[cle] = ligne[cle];
  }
  return { ...actuelle, ...patch };
}

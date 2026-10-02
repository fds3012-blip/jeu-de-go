// Défis où c'est ton tour (#338, #367), à part de l'écran des défis (src/app/Defis.tsx) : l'accueil, la barre de
// navigation et le Profil s'en servent sans charger le code des défis, chargé à la demande (#323, src/app/ecrans.ts).
// Lecture sous la RLS actuelle : le joueur ne lit que ses propres défis et parties ; les pseudos sont publics.
import { useEffect, useRef, useState } from 'react';
import { mesDefis, type EtatDefi } from '../data/defi';
import type { Db } from '../data/supabase';
import { resumeDefi, vueDefi } from './defiAmi';
import { useOnline } from './hooks';
import type { DefiEnAttente } from './aFaire';

/** Intervalle de relecture tant que l'app est visible : le coup d'un ami apparaît sans recharger. */
export const RELECTURE_MS = 60_000;

/** Défis où c'est au joueur d'agir (jouer, ou répondre au comptage), avec l'id de l'adversaire. Logique pure. */
export function defisEnAttente(etats: readonly EtatDefi[], userId: string, maintenant = Date.now()): (DefiEnAttente & { adversaireId: string | null })[] {
  return etats.flatMap(d => {
    const v = vueDefi(d.partie, d.defi, userId, maintenant, d.resultat);
    if (!resumeDefi(v).aMoi) return [];
    const adversaireId = (v.couleur === 1 ? d.partie.white_id : d.partie.black_id) ?? null;
    return [{ partieId: d.partie.id, adversaire: null, adversaireId, restant: v.restant, comptage: v.phase === 'comptage' }];
  });
}

/**
 * Défis en attente du joueur. Relus à chaque changement de `cle` (écran affiché), au retour sur l'app, toutes les
 * minutes tant qu'elle est visible, et à chaque changement d'une de ses parties (temps réel, sous la RLS).
 * Vide sans session, hors ligne, inactif (pendant une partie) ou en erreur.
 */
export function useDefisEnAttente(db: Db | null, userId: string | undefined, cle: string, actif: boolean): DefiEnAttente[] {
  const online = useOnline();
  const [liste, setListe] = useState<DefiEnAttente[]>([]);
  const [tic, setTic] = useState(0);
  const pseudos = useRef(new Map<string, string | null>());

  // Relecture : retour sur l'app, minuterie, temps réel.
  useEffect(() => {
    if (!db || !userId || !online || !actif) return;
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
  }, [db, userId, online, actif]);

  useEffect(() => {
    if (!db || !userId || !online || !actif) return;
    let vivant = true;
    void (async () => {
      const r = await mesDefis(db, userId);
      if (!vivant) return;
      if (!r.ok) { setListe([]); return; }
      const attente = defisEnAttente(r.value, userId);
      const inconnus = [...new Set(attente.flatMap(x => x.adversaireId && !pseudos.current.has(x.adversaireId) ? [x.adversaireId] : []))];
      if (inconnus.length) {
        const p = await db.from('profiles').select('id, username').in('id', inconnus);
        if (!vivant) return;
        for (const id of inconnus) pseudos.current.set(id, (p.data ?? []).find(x => x.id === id)?.username ?? null);
      }
      setListe(attente.map(({ adversaireId, ...x }) => ({ ...x, adversaire: adversaireId ? pseudos.current.get(adversaireId) ?? null : null })));
    })().catch(() => { if (vivant) setListe([]); });
    return () => { vivant = false; };
  }, [db, userId, online, actif, cle, tic]);

  return userId && online ? liste : [];
}

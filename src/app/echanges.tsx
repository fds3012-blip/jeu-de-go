// Échanges dans une partie à deux (#373 : « Dire », messages prédéfinis et émotes ; #363 : « Signaler ce joueur »),
// partagés par la partie en direct (Direct.tsx) et la partie entre amis (Defis.tsx). Le hook rend des morceaux à poser
// dans l'écran sans le réorganiser : la bulle de chaque bandeau, l'action « Dire » de la barre, « Signaler » et le
// réglage du menu « Plus », les liens de fin de partie et les feuilles.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Action } from '../ui/Partie';
import { BulleEchange, FeuilleDire, FeuilleSignaler, IconeDire, IconeSignaler, InterrupteurMessages } from '../ui/Securite';
import {
  DELAI_MESSAGES_MS, DUREE_BULLE_MS, MESSAGES_PAR_PARTIE, abonnerMessages, abonnerMessagesCoupes, couperMessages, direEnPartie, estEmote,
  lireMessagesCoupes, type CodeMessage
} from '../data/securite';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { tsec } from '../content/i18n/securite';

/** Réglage « Messages de l'adversaire » partagé par tous les écrans (gardé sur l'appareil). */
export function useMessagesCoupes(): [boolean, (coupes: boolean, depuis: 'partie') => void] {
  const coupes = useSyncExternalStore(abonnerMessagesCoupes, lireMessagesCoupes, () => false);
  const changer = useCallback((c: boolean, depuis: 'partie') => {
    couperMessages(c);
    track(EVENTS.messagesAdversaireCoupes, { coupes: c, depuis });
  }, []);
  return [coupes, changer];
}

interface Options {
  db: Db;
  partieId: string;
  userId: string | null | undefined;
  /** Pseudo de l'adversaire (ou « Ton ami » / « Ton adversaire »). */
  nom: string;
  /** Partie entre deux humains, joueur avec un compte : sinon rien n'est proposé. */
  actif: boolean;
  online: boolean;
  mode: 'direct' | 'defi';
  /** Compte avec pseudo (signaler l'exige). */
  compte?: boolean;
}

export interface Echanges {
  bulleLui: ReactNode;
  bulleMoi: ReactNode;
  /** Action « Dire » de la barre (aide, à gauche), ou null. */
  action: Action | null;
  /** « Signaler {nom} » pour le menu « Plus ». */
  menu: Action[];
  /** Réglage « Messages de l'adversaire » du menu « Plus ». */
  reglage: ReactNode;
  /** « Dire » et « Signaler » sous la fin de partie (la barre d'actions a disparu). */
  liensFin: ReactNode;
  feuilles: ReactNode;
}

export function useEchanges({ db, partieId, userId, nom, actif, online, mode, compte = true }: Options): Echanges {
  const [coupes, changerCoupes] = useMessagesCoupes();
  const [bulleLui, setBulleLui] = useState<{ code: CodeMessage; k: number } | null>(null);
  const [bulleMoi, setBulleMoi] = useState<{ code: CodeMessage; k: number } | null>(null);
  const [dire, setDire] = useState(false);
  const [signaler, setSignaler] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [envoyes, setEnvoyes] = useState(0);
  const dernier = useRef(0);
  const k = useRef(0);

  // Messages de l'adversaire en temps réel ; coupés, rien ne s'affiche.
  useEffect(() => {
    if (!actif) return;
    return abonnerMessages(db, partieId, m => {
      if (m.auteur === userId || lireMessagesCoupes()) return;
      setBulleLui({ code: m.code, k: ++k.current });
    });
  }, [db, partieId, userId, actif]);
  useEffect(() => { if (coupes) setBulleLui(null); }, [coupes]);
  // Chaque bulle s'efface après 3 s.
  useEffect(() => {
    if (!bulleLui) return;
    const t = window.setTimeout(() => setBulleLui(b => (b?.k === bulleLui.k ? null : b)), DUREE_BULLE_MS);
    return () => clearTimeout(t);
  }, [bulleLui]);
  useEffect(() => {
    if (!bulleMoi) return;
    const t = window.setTimeout(() => setBulleMoi(b => (b?.k === bulleMoi.k ? null : b)), DUREE_BULLE_MS);
    return () => clearTimeout(t);
  }, [bulleMoi]);

  const envoyer = useCallback(async (code: CodeMessage): Promise<string | null> => {
    if (!online) return tsec('erreur.horsLigne');
    // Le serveur refuse aussi (3 s, 10 par partie) : ici, on évite seulement un aller-retour inutile.
    if (Date.now() - dernier.current < DELAI_MESSAGES_MS) return tsec('erreur.tropVite');
    setEnvoi(true);
    const r = await direEnPartie(db, partieId, code);
    setEnvoi(false);
    if (!r.ok) return r.error;
    dernier.current = Date.now();
    setEnvoyes(n => n + 1);
    setBulleMoi({ code, k: ++k.current });
    // Ni la partie ni l'adversaire : le genre, le code (prédéfini) et le mode.
    track(EVENTS.messagePartieEnvoye, { genre: estEmote(code) ? 'emote' : 'message', code, mode });
    return null;
  }, [db, partieId, online, mode]);

  if (!actif) return { bulleLui: null, bulleMoi: null, action: null, menu: [], reglage: null, liensFin: null, feuilles: null };

  const ouvrirSignaler = () => { setDire(false); setSignaler(true); };
  return {
    bulleLui: bulleLui && !coupes ? <BulleEchange key={bulleLui.k} code={bulleLui.code} qui={nom} /> : null,
    bulleMoi: bulleMoi ? <BulleEchange key={bulleMoi.k} code={bulleMoi.code} qui={null} /> : null,
    action: { label: tsec('dire.action'), icone: <IconeDire />, onClick: () => setDire(true), action: 'dire', groupe: 'aide', disabled: !online },
    menu: [{ label: tsec('signaler.joueur', { nom }), icone: <IconeSignaler />, onClick: ouvrirSignaler, action: 'signaler' }],
    reglage: <InterrupteurMessages coupes={coupes} onChange={c => changerCoupes(c, 'partie')} />,
    liensFin: (
      <div className="echanges-fin">
        <button type="button" className="lien" onClick={() => setDire(true)} disabled={!online}>{tsec('dire.action')}</button>
        <button type="button" className="lien lien-discret" onClick={ouvrirSignaler}>{tsec('signaler.joueurAction')}</button>
      </div>
    ),
    feuilles: (
      <>
        <FeuilleDire ouvert={dire} onFermer={() => setDire(false)} onDire={envoyer} nom={nom} restants={MESSAGES_PAR_PARTIE - envoyes} envoi={envoi}
          coupes={coupes} onCouper={c => changerCoupes(c, 'partie')} onSignaler={ouvrirSignaler} />
        <FeuilleSignaler db={db} ouvert={signaler} onFermer={() => setSignaler(false)} compte={compte} online={online}
          cible={{ type: 'joueur', nom, partie: partieId, depuis: 'partie' }} />
      </>
    ),
  };
}


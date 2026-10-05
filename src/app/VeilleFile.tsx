// File jamais vide (#436) : pendant la partie contre l'IA proposée au bout de 25 s d'attente, le joueur reste dans la
// file. Cette bande, posée au-dessus de la partie, rappelle find_match toutes les 2,5 s (présence `vu_le`), et dit
// honnêtement ce qui se passe :
// - « Je cherche toujours un joueur pour toi. » et « Ne plus chercher » ;
// - un humain est trouvé : « Un joueur est prêt ! », « Rejoindre » ou « Rester ». Non bloquant : la partie contre l'IA
//   continue dessous. « Rester » (ou quitter la partie IA sans répondre) annule la partie en direct par le serveur
//   (`refuser_partie_direct`, aucune cote ne bouge) et sort de la file.
// La partie contre l'IA n'est jamais classée (#417) ; l'IA garde son nom et son portrait, jamais déguisée en humain.
// Chargé à la demande avec l'écran du direct (src/app/ecrans.ts).
import { useEffect, useRef, useState } from 'react';
import { Mochi } from '../ui/Mochi';
import { ATTENTE_MS } from '../go/pendule';
import { annulerAttente, chercherAdversaire, refuserPartieDirect } from '../data/direct';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { td } from '../content/i18n/direct';
import { fr } from '../ui/typo';
import { useOnline } from './hooks';
import type { Params } from './direct';
import '../ui/direct.css';

interface Props {
  db: Db;
  /** Réglages demandés dans la file (9 × 9, normale, japonais par défaut). */
  demande: Params;
  /** Début de l'attente (heure du client) : `attente_s` de `partie_en_ligne_commencee`. */
  depuis: number;
  /** « Rejoindre » : la partie en direct s'ouvre (la partie contre l'IA est quittée). */
  onRejoindre: (partieId: string) => void;
  /** « Rester » ou « Ne plus chercher » : la bande disparaît, la partie contre l'IA continue. */
  onArret: () => void;
}

export function VeilleFile({ db, demande, depuis, onRejoindre, onArret }: Props) {
  const online = useOnline();
  const [pret, setPret] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Ce qu'il reste à rendre en quittant : la place dans la file, ou la partie trouvée et pas encore rejointe.
  const aRendre = useRef<{ file: boolean; partie: string | null }>({ file: true, partie: null });
  // L'appel de l'écran parent change à chaque rendu : gardé à part, il ne relance pas la recherche.
  const arret = useRef(onArret);
  arret.current = onArret;

  useEffect(() => {
    if (!online || pret) return;
    let vivant = true, minuterie = 0;
    const chercher = async () => {
      const r = await chercherAdversaire(db, demande.taille, demande.cadence, demande.regles);
      if (!vivant) return;
      if (!r.ok) { aRendre.current.file = false; arret.current(); return; }
      if (r.value) { aRendre.current = { file: false, partie: r.value }; setPret(r.value); return; }
      minuterie = window.setTimeout(() => { void chercher(); }, ATTENTE_MS);
    };
    void chercher();
    return () => { vivant = false; clearTimeout(minuterie); };
  }, [db, demande, online, pret]);

  // La partie contre l'IA est quittée sans répondre : la place est rendue, la partie trouvée annulée (jamais laissée
  // à un adversaire qui attendrait pour rien).
  useEffect(() => () => {
    const { file, partie } = aRendre.current;
    if (partie) void refuserPartieDirect(db, partie);
    else if (file) void annulerAttente(db);
  }, [db]);

  function rejoindre() {
    if (!pret) return;
    aRendre.current = { file: false, partie: null };
    track(EVENTS.partieEnLigneCommencee, { taille: demande.taille, cadence: demande.cadence, regles: demande.regles, attente_s: Math.round((Date.now() - depuis) / 1000) });
    onRejoindre(pret);
  }

  async function rester() {
    setEnvoi(true);
    const { partie } = aRendre.current;
    aRendre.current = { file: false, partie: null };
    if (partie) await refuserPartieDirect(db, partie);
    else await annulerAttente(db);
    setEnvoi(false);
    onArret();
  }

  if (pret) {
    return (
      <section className="veille-file pret" aria-label={td('direct.veille.aria')} data-testid="veille-file">
        <Mochi size={36} />
        <div className="veille-file-texte" role="alert">
          <p className="veille-file-titre">{fr(td('direct.veille.pret'))}</p>
          <p className="small">{fr(td('direct.veille.pretDetail'))}</p>
        </div>
        <div className="veille-file-actions">
          <button type="button" className="btn primary" onClick={rejoindre} disabled={envoi}>{td('direct.veille.rejoindre')}</button>
          <button type="button" className="btn" onClick={() => { void rester(); }} disabled={envoi}>{td('direct.veille.rester')}</button>
        </div>
      </section>
    );
  }
  return (
    <section className="veille-file" aria-label={td('direct.veille.aria')} data-testid="veille-file">
      <Mochi size={28} />
      <p className="small veille-file-texte" role="status">{fr(td('direct.veille.cherche'))}</p>
      <button type="button" className="lien" onClick={() => { void rester(); }} disabled={envoi}>{td('direct.veille.arreter')}</button>
    </section>
  );
}

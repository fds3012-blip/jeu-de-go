// Fête d'un nouveau titre mensuel (#561), à l'ouverture de l'app, une seule fois par titre sur l'appareil.
// Chargée à la demande par App.tsx pour un compte complet seulement (hors JS et CSS initiaux). Elle lit SES titres
// (RLS), et si le titre du mois dernier n'a pas encore été fêté ici, demande son tour dans la file des célébrations
// (src/ui/fileFetes.ts : jamais sur une consigne, une fête à la fois). Carte discrète en haut de l'écran, 5 s ou un
// toucher ; immobile avec les mouvements réduits ou sans célébrations. Rien sous le garde-fou des 200 joueurs actifs
// (le serveur n'écrit alors aucun titre). Mesure : `titre_obtenu` (niveau du titre seulement).
import { useEffect, useRef, useState } from 'react';
import { aFeter, lireMoisFete, POURCENT, TITRE_FETE_KEY, titreDuMoisDernier, type TitreDuMois } from '../app/titres';
import { readLocal, writeLocal } from '../app/hooks';
import { chargerMesTitres } from '../data/titres';
import { EVENTS, track } from '../data/analytics';
import type { Db } from '../data/supabase';
import { nomMois, nomTitre, ttitre } from '../content/i18n/titres';
import { terminerFete, useTour } from './celebrations';
import { mouvementsReduits } from './defilement';
import { SceauTitre } from './SceauTitre';
import { fr } from './typo';
import './titres.css';

/** Durée d'affichage, comme la fête de niveau. */
export const DUREE_FETE_TITRE_MS = 5000;

export default function FeteTitre({ db, userId, celebrer }: { db: Db; userId: string; celebrer: boolean }) {
  const [titre, setTitre] = useState<TitreDuMois | null>(null);
  const [fini, setFini] = useState(false);
  useEffect(() => {
    let vivant = true;
    void chargerMesTitres(db, userId).then(t => {
      const dernier = titreDuMoisDernier(t);
      if (vivant && aFeter(dernier, lireMoisFete(readLocal<unknown>(TITRE_FETE_KEY, null)))) setTitre(dernier);
    });
    return () => { vivant = false; };
  }, [db, userId]);
  const tour = useTour('titre', !!titre && !fini);
  // Montrée : notée fêtée tout de suite (une seule fois, même si l'app se ferme pendant la carte), mesurée une fois.
  const notee = useRef(false);
  useEffect(() => {
    if (!tour || !titre || notee.current) return;
    notee.current = true;
    writeLocal(TITRE_FETE_KEY, titre.mois);
    track(EVENTS.titreObtenu, { niveau: titre.titre });
  }, [tour, titre]);
  useEffect(() => {
    if (!tour) return;
    const fin = window.setTimeout(() => setFini(true), DUREE_FETE_TITRE_MS);
    return () => window.clearTimeout(fin);
  }, [tour]);
  if (!tour || !titre) return null;
  const nom = nomTitre(titre.titre), mois = nomMois(titre.mois), pourcent = POURCENT[titre.titre];
  const fermer = () => { setFini(true); terminerFete('titre'); };
  return (
    <div className={`fete-titre${celebrer && !mouvementsReduits() ? ' anime' : ''}`} role="status" data-testid="fete-titre" data-titre={titre.titre}>
      <button type="button" onClick={fermer} aria-label={fr(ttitre('titres.feteAria', { titre: nom, mois, pourcent }))}>
        <SceauTitre titre={titre.titre} taille={44} />
        <span className="fete-titre-texte">
          <b>{fr(ttitre('titres.fete', { titre: nom }))}</b>
          <small>{fr(ttitre('titres.feteDetail', { mois, pourcent }))}</small>
        </span>
      </button>
    </div>
  );
}

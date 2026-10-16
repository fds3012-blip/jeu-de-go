// Textes des titres mensuels (#561), FR et EN. Hors du catalogue principal (JS initial) : ils n'arrivent qu'avec le
// Profil et la fête du titre, chargés à la demande. Phrases courtes, tutoiement.
import { langue, type Langue } from './index';
import type { Titre } from '../../app/titres';

const FR = {
  'titres.ligne': 'Titre du mois dernier :',
  'titres.maitre': 'Maître du mois',
  'titres.expert': 'Expert du mois',
  'titres.habitue': 'Habitué du mois',
  'titres.detail': 'Top {pourcent} % des joueurs actifs.',
  'titres.fete': 'Nouveau titre : {titre} !',
  'titres.feteDetail': 'Top {pourcent} % des joueurs de {mois}. Bravo !',
  'titres.feteAria': '{titre} : top {pourcent} % des joueurs de {mois}. Toucher pour fermer.',
} as const;

export type CleTitres = keyof typeof FR;

const EN: { readonly [K in CleTitres]: string } = {
  'titres.ligne': 'Last month’s title:',
  'titres.maitre': 'Master of the month',
  'titres.expert': 'Expert of the month',
  'titres.habitue': 'Regular of the month',
  'titres.detail': 'Top {pourcent}% of active players.',
  'titres.fete': 'New title: {titre}!',
  'titres.feteDetail': 'Top {pourcent}% of players in {mois}. Well done!',
  'titres.feteAria': '{titre}: top {pourcent}% of players in {mois}. Tap to close.',
};

export const CATALOGUE_TITRES: Record<Langue, { readonly [K in CleTitres]: string }> = { fr: FR, en: EN };

/** Texte des titres dans une langue donnée, variables `{nom}` remplacées. */
export function traduireTitres(l: Langue, cle: CleTitres, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_TITRES[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte des titres dans la langue de l'interface. */
export const ttitre = (cle: CleTitres, vars?: Record<string, string | number>): string => traduireTitres(langue(), cle, vars);

/** Nom du titre : « Expert du mois ». */
export const nomTitre = (titre: Titre, l: Langue = langue()): string => traduireTitres(l, `titres.${titre}`);

/** Nom du mois d'un `AAAA-MM-01` : « septembre », « September ». */
export function nomMois(mois: string, l: Langue = langue()): string {
  const d = new Date(`${mois.slice(0, 7)}-15T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? mois : d.toLocaleDateString(l === 'en' ? 'en-GB' : 'fr-FR', { month: 'long', timeZone: 'UTC' });
}

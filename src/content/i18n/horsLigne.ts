// Textes « Hors ligne clair et IA prête » (#538) : réglage « L'IA sur ton téléphone » et proposition de Caillou hors
// ligne, FR et EN. Hors du catalogue principal (fr.ts, dans le JS initial) : ils n'arrivent qu'avec le Profil et la
// feuille de repli, chargés à la demande. Le type d'EN impose la parité des clés (testée dans horsLigne.test.ts).
// Règles du catalogue : phrases courtes, tutoiement. « IA » : le programme qui analyse tes parties et fait jouer les
// adversaires forts (KataGo), expliqué dans l'aide du réglage.
import { langue, type Langue } from './index';

const FR = {
  'ia.groupe': 'L’IA sur ton téléphone',
  'ia.libelle': 'IA d’analyse',
  'ia.aide': 'Elle analyse tes parties et fait jouer Bambou et les adversaires plus forts. Une fois téléchargée, elle marche sans réseau.',
  'ia.verification': 'Je regarde si elle est là…',
  'ia.prete': 'Prête, même hors ligne. Elle prend {taille} Mo.',
  'ia.aTelecharger': '{taille} Mo à télécharger, une seule fois. Mieux en Wi-Fi.',
  'ia.enCours': 'Téléchargement…',
  'ia.progression': '{recu} / {total} Mo',
  'ia.progressionAria': 'Téléchargement de l’IA',
  'ia.echec': 'Le téléchargement n’a pas abouti. Réessaie, de préférence en Wi-Fi.',
  'ia.horsLigne': 'Tu es hors ligne : connecte-toi pour la télécharger.',
  'ia.telecharger': 'Télécharger l’IA maintenant',
  'ia.reessayer': 'Réessayer',
  'ia.liberer': 'Libérer la place',
  'ia.liberee': 'Place libérée. Tu pourras la retélécharger ici.',
  'ia.faite': 'C’est fait : l’IA est sur ton téléphone.',

  'repli.titre': '{nom} a besoin de l’IA',
  'repli.texte': 'Tu es hors ligne et l’IA n’est pas encore sur ton téléphone. Caillou, lui, joue sans réseau.',
  'repli.astuce': 'Avec du réseau, télécharge l’IA dans Profil, Réglages.',
  'repli.caillou': 'Jouer contre Caillou',
  'repli.plusTard': 'Plus tard',
};

export type CleHorsLigne = keyof typeof FR;

const EN: { readonly [K in CleHorsLigne]: string } = {
  'ia.groupe': 'AI on your phone',
  'ia.libelle': 'Analysis AI',
  'ia.aide': 'It reviews your games and plays Bambou and the stronger opponents. Once downloaded, it works offline.',
  'ia.verification': 'Checking if it’s here…',
  'ia.prete': 'Ready, even offline. It takes {taille} MB.',
  'ia.aTelecharger': '{taille} MB to download, just once. Best on Wi-Fi.',
  'ia.enCours': 'Downloading…',
  'ia.progression': '{recu} / {total} MB',
  'ia.progressionAria': 'AI download',
  'ia.echec': 'The download didn’t finish. Try again, ideally on Wi-Fi.',
  'ia.horsLigne': 'You’re offline: connect to download it.',
  'ia.telecharger': 'Download the AI now',
  'ia.reessayer': 'Try again',
  'ia.liberer': 'Free up space',
  'ia.liberee': 'Space freed. You can download it again here.',
  'ia.faite': 'Done: the AI is on your phone.',

  'repli.titre': '{nom} needs the AI',
  'repli.texte': 'You’re offline and the AI isn’t on your phone yet. Caillou plays without the network.',
  'repli.astuce': 'With a connection, download the AI in Profile, Settings.',
  'repli.caillou': 'Play Caillou',
  'repli.plusTard': 'Later',
};

export const CATALOGUE_HORS_LIGNE: Record<Langue, { readonly [K in CleHorsLigne]: string }> = { fr: FR, en: EN };

/** Texte dans une langue donnée, variables `{n}` remplacées. */
export function traduireHorsLigne(l: Langue, cle: CleHorsLigne, vars: Record<string, string | number> = {}): string {
  const brut = CATALOGUE_HORS_LIGNE[l][cle] || FR[cle];
  return brut.replace(/\{(\w+)\}/g, (tout, nom: string) => (nom in vars ? String(vars[nom]) : tout));
}

/** Texte dans la langue de l'interface. */
export const thl = (cle: CleHorsLigne, vars?: Record<string, string | number>): string => traduireHorsLigne(langue(), cle, vars);

// #353 : « Crée ton compte » ou « Connecte-toi », et la bascule de l'un vers l'autre.
// Trois façons d'envoyer le code, une seule vérification par voie :
// - `creation` : pas de session, nouveau compte (`signInWithOtp`, `shouldCreateUser: true`) → code `email` ;
// - `liaison` : session anonyme d'un ancien défi, l'e-mail est ajouté à la même session (`updateUser`) → code `email_change` ;
// - `connexion` : compte qui existe déjà (`signInWithOtp`, `shouldCreateUser: false`) → code `email`.
// Une liaison refusée parce que l'adresse a déjà un compte bascule tout de suite en connexion : c'est le cas de
// Florian (ancienne session anonyme d'un défi + vrai compte). La partie anonyme reste à l'ancienne session.

export type Sens = 'creer' | 'connecter';
export type Voie = 'creation' | 'liaison' | 'connexion';

/** Voie d'envoi du code selon ce que le joueur a choisi et la session en place. */
export function voieEnvoi(sens: Sens, anonyme: boolean): Voie {
  if (sens === 'connecter') return 'connexion';
  return anonyme ? 'liaison' : 'creation';
}

/** Type de code à vérifier (`verifyOtp`) pour une voie. */
export const typeCode = (voie: Voie): 'email' | 'email_change' => voie === 'liaison' ? 'email_change' : 'email';

/** Après un envoi refusé : que faire ? */
export type Suite =
  | { faire: 'basculer' } // adresse déjà prise en liaison : envoyer un code de connexion à la place
  | { faire: 'creer' } // aucun compte en connexion : message, et le lien « Créer un compte » est là
  | { faire: 'erreur' };

export function apresRefus(voie: Voie, raison: 'pris' | 'inconnu' | undefined): Suite {
  if (voie === 'liaison' && raison === 'pris') return { faire: 'basculer' };
  if (voie === 'connexion' && raison === 'inconnu') return { faire: 'creer' };
  return { faire: 'erreur' };
}

/** La case d'âge et des conditions n'est demandée qu'à la création d'un compte (liaison comprise). */
export const demandeAge = (sens: Sens) => sens === 'creer';

// Issue #167, étape 5 : Apprendre, lecteur de leçon, compte, confidentialité, gel, raison du moteur et rythme passés par `t`.
// Le français reste strictement identique aux textes d'origine (recopiés ici), l'anglais suit le glossaire.
import { LESSONS } from '../lessons';
import { ACQUIS, acquis } from '../acquis';
import { CHAPITRES_A_VENIR, boutonChemin, chapitresAVenir, finDeLecon } from '../../app/apprendre';
import { messageGel } from '../../app/gel';
import { messageContinue } from '../../app/rythme';
import { raisonFrontiere, raisonPoints } from '../../engine/simple';
import { confirmationValide, motSuppression } from '../../data/account';
import { usernameErrorFromDb, validateUsername } from '../../data/username';
import { fromLabel } from '../../go/coords';
import { fr as typo } from '../../ui/typo';
import { CATALOGUES, choisirLangue, traduire, type Cle } from './index';

const F = ' ';
const plein = (id: string) => LESSONS.find(l => l.id === id)!.steps.length;

/** Textes d'origine, tels qu'ils étaient écrits dans les écrans avant l'étape 5 (après la typographie de `fr()` quand l'écran l'applique). */
const ORIGINAUX: [Cle, string, boolean?][] = [
  ['apprendre.synchro.local', 'Ta progression reste sur ce téléphone. Connecte-toi dans Profil pour la garder partout.'],
  ['apprendre.synchro.sync', 'Synchronisation de ta progression…'],
  ['apprendre.synchro.ok', 'Progression enregistrée sur ton compte.'],
  ['apprendre.synchro.error', 'Hors ligne : ta progression est gardée ici et partira plus tard.'],
  ['apprendre.chapitre.termine', 'Chapitre terminé.'],
  ['apprendre.chapitre.suite', 'Tout est fait. La suite arrive bientôt.'],
  ['apprendre.bientot', 'Bientôt'],
  ['apprendre.bientot.texte', 'Cinq autres chapitres sont en préparation, jusqu’au niveau des joueurs de club.'],
  ['lecon.terminer', 'Terminer la leçon'],
  ['lecon.retourChemin', 'Retour au chemin'],
  ['lecon.taReponse', 'Ta réponse'],
  ['lecon.poseVert', 'Pose ta pierre sur le point vert.'],
  ['lecteur.progression', 'Progression de la leçon'],
  ['compte.titre', 'Ton compte'],
  ['compte.indisponible', `La connexion n’est pas disponible pour le moment. Tu peux jouer et apprendre sans compte${F}: ta progression reste sur ce téléphone.`, true],
  ['compte.chargement', 'Chargement de ton compte…'],
  ['compte.chargementProfil', 'Chargement de ton profil…'],
  ['compte.deconnecter', 'Me déconnecter'],
  ['compte.changerPseudo', 'Changer de pseudo'],
  ['compte.supprimer', 'Supprimer mon compte'],
  ['compte.supprimer.titre', `Supprimer ton compte${F}?`, true],
  ['compte.supprimer.texte', 'C’est définitif. On efface ton profil, ton pseudo, ta cote, tes badges, ta progression et ton adresse e-mail.'],
  ['compte.supprimer.parties', `Tes parties contre d’autres joueurs restent pour eux, sans ton nom${F}: tu y deviens «${F}joueur supprimé${F}».`, true],
  ['compte.supprimer.enCours', 'Suppression…'],
  ['compte.supprimer.definitif', 'Supprimer définitivement'],
  ['compte.annuler', 'Annuler'],
  ['compte.emailInvalide', 'Entre une adresse e-mail valide.'],
  ['compte.regardeEmails', 'Regarde tes e-mails'],
  ['compte.changerAdresse', 'Changer d’adresse'],
  ['compte.creer', 'Crée ton compte'],
  ['compte.email', 'Ton adresse e-mail'],
  ['compte.envoi', 'Envoi…'],
  ['compte.recevoirLien', 'Recevoir mon lien'],
  ['compte.nouveauPseudo', 'Ton nouveau pseudo'],
  ['compte.choisisPseudo', 'Choisis ton pseudo'],
  ['compte.pseudo', 'Pseudo'],
  ['compte.enregistrement', 'Enregistrement…'],
  ['compte.valider', 'Valider'],
  ['erreur.tropDEssais', 'Trop d’essais. Attends une minute et réessaie.'],
  ['erreur.envoiLien', 'Impossible d’envoyer le lien. Vérifie ton adresse.'],
  ['erreur.profil', 'Impossible de charger ton profil.'],
  ['erreur.serie', 'Impossible de charger ta série.'],
  ['erreur.gels', 'Impossible de charger tes gels.'],
  ['erreur.suppression', 'La suppression n’a pas abouti. Ton compte est intact. Réessaie dans un moment.'],
  ['erreur.serveur', 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.'],
  ['erreur.progression', 'Impossible de charger ta progression.'],
  ['erreur.progressionNonEnregistree', 'Progression non enregistrée.'],
  ['erreur.problemes', 'Impossible de charger les problèmes.'],
  ['erreur.cote', 'Impossible de charger ta cote.'],
  ['erreur.essai', 'Essai non enregistré. Vérifie ta connexion.'],
  ['erreur.enregistrerSerie', 'Impossible d’enregistrer ta série.'],
  ['accord.titre', `Tu m’aides à chasser les bugs${F}?`, true],
  ['accord.texte', 'Si le jeu plante chez toi, l’équipe reçoit un rapport et répare plus vite. Elle voit aussi si tu reviens jouer, pour garder ce qui te plaît. Jamais ton e-mail ni tes coups.'],
  ['accord.note', 'Sans ton accord, on compte juste les parties, sans savoir qui joue.'],
  ['accord.lire', 'Lire les conditions'],
  ['accord.oui', 'Oui, j’aide'],
  ['accord.non', 'Non merci'],
  ['profil.conditions', 'Conditions et confidentialité'],
  ['profil.retour', 'Retour'],
  ['conditions.bugs', 'Rapports de bugs et suivi détaillé'],
  ['conditions.bugsAide', 'Seulement avec ton accord. Refuser ne t’enlève aucune fonction.'],
  ['conditions.comptage', 'Comptage anonyme des parties'],
  ['conditions.comptageAide', 'Anonyme, sans cookie. Tu peux le couper.'],
  ['conditions.intro', 'Pas de pub. Tes données ne sont jamais vendues.'],
  ['conditions.garde', 'Ce qu’on garde'],
  ['conditions.garde.telephone', `Sur ton téléphone${F}:`, true],
  ['conditions.garde.telephoneTexte', `tes réglages et ta progression. L’ordi calcule ses coups ici${F}: tes parties contre lui ne partent pas.`, true],
  ['conditions.garde.compte', `Si tu crées un compte${F}:`, true],
  ['conditions.garde.compteTexte', 'ton e-mail, ton pseudo, ta cote, tes parties en ligne, tes badges. Chez Supabase, à Paris.'],
  ['conditions.garde.comptage', `Comptage anonyme${F}:`, true],
  ['conditions.garde.comptageTexte', `quelques événements (partie jouée, leçon finie) chez PostHog, dans l’Union européenne. Sans cookie ni lien avec ton compte${F}: le numéro tiré au hasard change à chaque ouverture de l’app. Ton adresse IP n’est pas gardée, et elle ne sert pas à te localiser.`, true],
  ['conditions.garde.oui', `Seulement si tu dis oui${F}:`, true],
  ['conditions.garde.ouiTexte', `les rapports de bug chez Sentry, et un numéro gardé sur ton téléphone pour voir si tu reviens jouer. Jamais ton e-mail ni tes coups. Tu changes d’avis${F}? Ce numéro est effacé.`, true],
  ['conditions.pourquoi', 'Pourquoi'],
  ['conditions.pourquoi.1', 'Ton compte sert à te connecter, à jouer en ligne et à garder ta progression partout.'],
  ['conditions.pourquoi.2', 'Le comptage nous dit combien de parties se jouent. Les rapports de bug nous aident à réparer vite.'],
  ['conditions.pourquoi.3', 'Le site est hébergé par Vercel. Personne d’autre ne reçoit tes données.'],
  ['conditions.duree', 'Combien de temps'],
  ['conditions.duree.compte', `Compte${F}:`, true],
  ['conditions.duree.compteTexte', `tant qu’il existe. Supprime-le quand tu veux${F}: Profil, sous ton compte.`, true],
  ['conditions.duree.comptage', `Comptage et suivi${F}:`, true],
  ['conditions.duree.comptageTexte', '1 an, puis effacés.'],
  ['conditions.duree.telephone', `Sur ton téléphone${F}:`, true],
  ['conditions.duree.telephoneTexte', 'jusqu’à ce que tu effaces les données du site ou l’app.'],
  ['conditions.droits', 'Tes droits'],
  ['conditions.droits.1', 'Change d’avis quand tu veux avec les interrupteurs en haut de la page.'],
  ['conditions.droits.2', 'Tu peux demander à voir, corriger ou effacer tes données. On répond sous un mois.'],
  ['conditions.droits.3', `Moins de 15 ans${F}? Crée ton compte avec un parent.`, true],
  ['conditions.droits.4', `Un souci${F}? Tu peux aussi saisir la CNIL.`, true],
  ['conditions.contact', `Contact${F}: bientôt disponible`, true],
];

describe('français identique aux textes d’origine', () => {
  it('textes fixes des écrans (typographie de fr() comprise)', () => {
    for (const [cle, texte, typographie] of ORIGINAUX) {
      const brut = (traduire as (l: 'fr', c: Cle) => string)('fr', cle);
      expect(typographie ? typo(brut) : brut, cle).toBe(texte);
    }
  });

  it('chemin des leçons, bouton principal et fin de leçon', () => {
    expect(chapitresAVenir()).toEqual(CHAPITRES_A_VENIR);
    expect(boutonChemin(LESSONS, {})).toEqual({ texte: 'Commencer', verbe: 'Commencer', id: 'l1' });
    expect(boutonChemin(LESSONS, { l1: 1 })!.texte).toBe(`Reprendre la leçon : ${'Libertés et capture'}`);
    const tout = Object.fromEntries(LESSONS.map(l => [l.id, plein(l.id)]));
    expect(boutonChemin(LESSONS, tout)).toMatchObject({ verbe: 'Revoir' });
    expect(finDeLecon(LESSONS, 'l1').titre).toBe('Leçon terminée');
    expect(finDeLecon(LESSONS, LESSONS[LESSONS.length - 1].id).titre).toBe('Chapitre terminé');
    // `${faites} leçon${faites > 1 ? 's' : ''} faite${faites > 1 ? 's' : ''} sur ${total}. Continue !`
    expect([1, 2, 6].map(n => traduire('fr', 'apprendre.bases.progres', { n, total: 7 })))
      .toEqual(['1 leçon faite sur 7. Continue !', '2 leçons faites sur 7. Continue !', '6 leçons faites sur 7. Continue !']);
    expect(traduire('fr', 'apprendre.pas', { rang: 2, titre: 'Atari', etat: traduire('fr', 'apprendre.pas.faite') })).toBe('Leçon 2 : Atari, terminée');
    expect(traduire('fr', 'apprendre.pas', { rang: 3, titre: 'Ko', etat: traduire('fr', 'apprendre.pas.encours') })).toBe('Leçon 3 : Ko, prochaine étape');
    expect(traduire('fr', 'apprendre.pas', { rang: 4, titre: 'Ko', etat: '' })).toBe('Leçon 4 : Ko');
  });

  it('phrase de fin de chaque leçon', () => {
    for (const l of LESSONS) expect(acquis(l.id)).toBe(ACQUIS[l.id]);
    expect(acquis('inconnue')).toBe('Une leçon de plus dans ta poche.');
    choisirLangue('en');
    expect(acquis('l5')).toBe('You know a group with two eyes can never die.');
    expect(acquis('inconnue')).toBe('One more lesson in your pocket.');
    choisirLangue('fr');
  });

  it('lecteur de leçon : pluriels comme les textes d’origine', () => {
    expect([0, 1, 2, 5].map(n => traduire('fr', 'lecteur.etapes', { n, total: 5 })))
      .toEqual(['0 étape faite sur 5', '1 étape faite sur 5', '2 étapes faites sur 5', '5 étapes faites sur 5']);
    expect([1, 2].map(n => traduire('fr', 'lecon.libertes', { n }))).toEqual(['1 liberté', '2 libertés']);
    expect([0, 1, 2].map(n => traduire('fr', 'lecon.point', { n }))).toEqual(['point', 'point', 'points']);
    expect(traduire('fr', 'lecon.essaieEncore', { no: 'Pas tout à fait.' })).toBe('Pas tout à fait. Essaie encore.');
  });

  it('compte : textes avec variables', () => {
    expect(traduire('fr', 'compte.cotes', { cote: 1500, pb: 1200 })).toBe('Cote 1500 · Problèmes 1200');
    expect(traduire('fr', 'compte.supprimer.tape', { mot: motSuppression() })).toBe('Pour confirmer, tape SUPPRIMER');
    expect(traduire('fr', 'compte.lienEnvoye', { email: 'a@b.fr' })).toBe('On t’a envoyé un lien à a@b.fr. Ouvre-le sur ce téléphone pour te connecter.');
    expect(typo(traduire('fr', 'compte.pseudoAide', { min: 3, max: 24 }))).toBe(`C’est le nom que verront les autres joueurs. De 3 à 24 caractères${F}: lettres, chiffres, _ et -.`);
    expect(validateUsername('ab')).toEqual({ ok: false, error: 'Au moins 3 caractères.' });
    expect(validateUsername('a'.repeat(25))).toEqual({ ok: false, error: '24 caractères au maximum.' });
    expect(validateUsername('élan')).toEqual({ ok: false, error: 'Lettres sans accent, chiffres, _ et - seulement.' });
    expect(['23505', '23514', undefined].map(usernameErrorFromDb))
      .toEqual(['Ce pseudo est déjà pris. Essaie-en un autre.', 'Ce pseudo n’est pas valide.', 'Impossible d’enregistrer ton pseudo. Réessaie.']);
  });

  it('gel, raison du moteur et phrase de Pomme', () => {
    // `Ton gel a protégé ta série de ${jours} jour${jours > 1 ? 's' : ''} !`
    expect([1, 2, 12].map(messageGel)).toEqual(['Ton gel a protégé ta série de 1 jour !', 'Ton gel a protégé ta série de 2 jours !', 'Ton gel a protégé ta série de 12 jours !']);
    const e4 = fromLabel('E4', 9);
    expect(raisonFrontiere(e4, 9).texte).toBe('il reste une frontière à fermer en E4');
    expect(raisonPoints(e4, 1.2, 9).texte).toBe('il reste un point à prendre en E4');
    expect(raisonPoints(e4, 3.4, 9).texte).toBe('il reste 3 points à prendre en E4');
    expect(messageContinue('Pomme', raisonFrontiere(e4, 9))).toBe('Pomme continue : il reste une frontière à fermer en E4.');
    expect(messageContinue('Pomme', raisonPoints(e4, 3, 9))).toBe('Pomme continue : il reste 3 points à prendre en E4.');
  });
});

describe('en anglais', () => {
  beforeEach(() => choisirLangue('en'));
  afterEach(() => choisirLangue('fr'));

  it('aucune clé de l’étape 5 ne reste en français', () => {
    for (const [cle] of ORIGINAUX) {
      if (cle === 'compte.pseudo') continue; // « Pseudo » → « Username »
      expect(CATALOGUES.en[cle], cle).not.toEqual(CATALOGUES.fr[cle]);
    }
    expect(traduire('en', 'compte.pseudo')).toBe('Username');
  });

  it('chemin, lecteur et fin de leçon', () => {
    expect(chapitresAVenir()).toEqual(['Capture and save', 'Life and death', 'Shape and tesuji, the clever moves', 'Opening on 19\u00A0×\u00A019', 'Endgame and counting']);
    expect(boutonChemin(LESSONS, {})).toEqual({ texte: 'Start', verbe: 'Start', id: 'l1' });
    expect(boutonChemin(LESSONS, { l1: 1 })).toMatchObject({ verbe: 'Resume', texte: 'Resume the lesson: Libertés et capture' });
    expect(finDeLecon(LESSONS, 'l1').titre).toBe('Lesson complete');
    expect(traduire('en', 'apprendre.bases.progres', { n: 1, total: 7 })).toBe('1 of 7 lessons done. Keep going!');
    expect(traduire('en', 'lecteur.etapes', { n: 2, total: 5 })).toBe('2 of 5 steps done');
    expect([1, 2].map(n => traduire('en', 'lecon.libertes', { n }))).toEqual(['1 liberty', '2 liberties']);
    expect([0, 1, 2].map(n => traduire('en', 'lecon.point', { n }))).toEqual(['points', 'point', 'points']);
  });

  it('compte : le mot de confirmation suit la langue, le français reste accepté', () => {
    expect(motSuppression()).toBe('DELETE');
    expect(confirmationValide(' delete ')).toBe(true);
    expect(confirmationValide('SUPPRIMER')).toBe(true);
    expect(confirmationValide('DELET')).toBe(false);
    expect(validateUsername('ab')).toEqual({ ok: false, error: 'At least 3 characters.' });
    expect(usernameErrorFromDb('23505')).toBe('This username is taken. Try another one.');
  });

  it('gel et raison du moteur', () => {
    expect(messageGel(7)).toBe('Your freeze protected your 7-day streak!');
    const e4 = fromLabel('E4', 9);
    expect(messageContinue('Pomme', raisonFrontiere(e4, 9))).toBe('Pomme keeps playing: there’s still a border to close at E4.');
    expect(messageContinue('Pomme', raisonPoints(e4, 1, 9))).toBe('Pomme keeps playing: there’s still one point to take at E4.');
    expect(messageContinue('Pomme', raisonPoints(e4, 4, 9))).toBe('Pomme keeps playing: there are still 4 points to take at E4.');
  });
});

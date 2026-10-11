// « Tu connais le go ? » (#523) : au tout premier lancement, à la place de l'accueil épuré, jusqu'à une réponse.
// Logique (quand la poser, où mène chaque réponse) : src/app/connaitGo.ts.
//
// Légère, dans le JS initial : Mochi, une question, trois réponses de même taille et de même poids (aucune n'est l'action
// principale), et « Plus tard », un lien discret. Ce n'est pas une boîte de dialogue posée par-dessus : c'est le contenu
// de l'accueil, dans la page. Le bandeau de consentement (#485, non modal, en bas) reste donc lisible et touchable, et
// la page garde sous elle la place du bandeau (accueil.css, `--accord-h`) : rien ne se recouvre, à 320 px comme à 390 px.
// Lecteurs d'écran : une région nommée par la question (titre de niveau 2) ; le bandeau, s'il est là, garde le focus
// d'arrivée (#485), puis Tab mène à ses choix et à la page.
import { PortraitMochi } from '../ui/Portrait';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';
import type { ChoixGo } from './connaitGo';

export function QuestionGo({ onChoisir }: { onChoisir: (c: ChoixGo) => void }) {
  return (
    <section className="question-go" aria-labelledby="question-go-titre" data-testid="question-go">
      <PortraitMochi taille={72} decoratif />
      <h2 id="question-go-titre">{fr(t('connait.titre'))}</h2>
      <p>{fr(t('connait.texte'))}</p>
      <div className="question-go-reponses" role="group" aria-labelledby="question-go-titre">
        <button type="button" className="btn" data-reponse="jamais" onClick={() => onChoisir('jamais')}>{t('connait.jamais')}</button>
        <button type="button" className="btn" data-reponse="un_peu" onClick={() => onChoisir('un_peu')}>{t('connait.unPeu')}</button>
        <button type="button" className="btn" data-reponse="sait" onClick={() => onChoisir('sait')}>{t('connait.sait')}</button>
      </div>
      <button type="button" className="lien" data-reponse="plus_tard" onClick={() => onChoisir('plus_tard')}>{t('connait.plusTard')}</button>
    </section>
  );
}

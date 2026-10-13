// « Mentions légales » dans l'app (issue #530). Même texte que la page statique `/mentions-legales/`
// (src/content/mentionsLegales.ts). Les champs que l'éditeur doit encore remplir sont surlignés « À compléter ».
import { Fragment } from 'react';
import { MENTIONS, morceaux } from '../content/mentionsLegales';
import { langue } from '../content/i18n';
import { fr } from '../ui/typo';
import '../ui/donnees.css';

/** Paragraphe avec ses champs à compléter et ses liens. `/confidentialite` ouvre la page de l'app, sans recharger. */
function Paragraphe({ texte, aCompleter, onConditions }: { texte: string; aCompleter: string; onConditions: () => void }) {
  return (
    <p>
      {morceaux(texte).map((m, i) => (
        <Fragment key={i}>
          {'texte' in m ? fr(m.texte)
            : 'aCompleter' in m ? <mark className="a-completer"><span className="a-completer-etiquette">{aCompleter} :</span> {m.aCompleter}</mark>
            : m.adresse.startsWith('/confidentialite') ? <button type="button" className="lien lien-texte" onClick={onConditions}>{m.lien}</button>
            : <a href={m.adresse} target="_blank" rel="noopener noreferrer">{m.lien}</a>}
        </Fragment>
      ))}
    </p>
  );
}

export function MentionsLegales({ onConditions }: { onConditions: () => void }) {
  const m = MENTIONS[langue()];
  return (
    <div className="mentions" data-testid="mentions-legales">
      <p className="mentions-intro">{fr(m.intro)}</p>
      {m.sections.map(s => (
        <section key={s.id} className="mentions-section" aria-labelledby={`mentions-${s.id}`}>
          <h3 id={`mentions-${s.id}`}>{s.titre}</h3>
          {s.paragraphes.map((p, i) => <Paragraphe key={i} texte={p} aCompleter={m.aCompleter} onConditions={onConditions} />)}
        </section>
      ))}
      <div className="mentions-maj"><Paragraphe texte={m.miseAJour} aCompleter={m.aCompleter} onConditions={onConditions} /></div>
    </div>
  );
}

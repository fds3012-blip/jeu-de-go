// Formulaire de retours en 3 questions (#537, prérequis P7 du plan d'acquisition). Ouvert depuis l'aide (fiche
// « Questions », « Donner mon avis ») et depuis « Nous écrire » du Profil sans compte. Sans compte, sans rien de
// l'appelant : src/data/retours.ts. Chargé à la demande, avec son CSS (retours.css) : rien dans le premier écran.
// Une seule action principale, « Envoyer » ; puis Mochi : « Merci ! ». Cibles de 44 px au moins.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Mochi } from './Mochi';
import { fr } from './typo';
import { ADRESSE_CONTACT, CONSEILS, SOURCES, TEXTE_MAX, envoyerRetour, preparerRetour, type Conseil, type ResultatEnvoi, type Source } from '../data/retours';
import { EVENTS, track } from '../data/analytics';
import { langue } from '../content/i18n/index';
import { tret } from '../content/i18n/retours';
import './retours.css';

type Erreur = 'conseil' | Extract<ResultatEnvoi, { ok: false }>['erreur'];

/** Lien vers l'adresse de contact, dans une phrase `{adresse}`. */
function AvecAdresse({ texte }: { texte: string }) {
  const [avant, apres = ''] = fr(texte).split('{adresse}');
  return <>{avant}<a href={`mailto:${ADRESSE_CONTACT}`}>{ADRESSE_CONTACT}</a>{apres}</>;
}

export default function Retours({ onRetour, depuis }: { onRetour: () => void; depuis: 'aide' | 'profil' }) {
  const [conseil, setConseil] = useState<Conseil | null>(null);
  const [ameliorer, setAmeliorer] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<Erreur | null>(null);
  const [fait, setFait] = useState(false);
  const id = useId();
  const refTitre = useRef<HTMLHeadingElement>(null);
  const refConseil = useRef<HTMLFieldSetElement>(null);
  const refMerci = useRef<HTMLDivElement>(null);

  useEffect(() => { refTitre.current?.focus(); }, []);
  useEffect(() => { if (fait) refMerci.current?.focus(); }, [fait]);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (envoi) return;
    const v = preparerRetour({ conseil, ameliorer, source, langue: langue() });
    if (!v.ok) {
      setErreur('conseil');
      refConseil.current?.querySelector('input')?.focus();
      return;
    }
    setEnvoi(true); setErreur(null);
    const r = await envoyerRetour(v.corps);
    setEnvoi(false);
    if (!r.ok) { setErreur(r.erreur); return; }
    // Jamais le texte : la réponse 1, la source, et s'il y avait un texte.
    track(EVENTS.retourEnvoye, { conseil: v.corps.p_conseil, source: v.corps.p_source, texte: v.corps.p_ameliorer !== null, depuis });
    setFait(true);
  }

  if (fait) {
    return (
      <div className="retours retours-merci" ref={refMerci} tabIndex={-1} role="status" data-testid="retours-merci">
        <div className="retours-merci-tete">
          <Mochi size={56} />
          <p className="retours-merci-titre">{fr(tret('merci'))}</p>
        </div>
        <p className="muted small"><AvecAdresse texte={tret('merciDetail')} /></p>
        <button type="button" className="btn primary" onClick={onRetour}>{tret('fermer')}</button>
      </div>
    );
  }

  const erreurConseil = erreur === 'conseil';
  return (
    <form className="retours" onSubmit={envoyer} noValidate aria-labelledby={`${id}-titre`} data-testid="retours">
      <div className="retours-tete">
        <h3 id={`${id}-titre`} ref={refTitre} tabIndex={-1}>{tret('titre')}</h3>
        <button type="button" className="lien" onClick={onRetour}>{tret('retour')}</button>
      </div>
      <p className="muted small">{fr(tret('intro'))}</p>

      <fieldset ref={refConseil} className="retours-question" aria-describedby={erreurConseil ? `${id}-erreur-conseil` : undefined}>
        <legend>{fr(tret('conseil.question'))}</legend>
        {erreurConseil && <p id={`${id}-erreur-conseil`} className="small retours-erreur" role="alert">{fr(tret('erreur.conseil'))}</p>}
        <div className="retours-choix-ligne">
          {CONSEILS.map(c => (
            <label key={c} className="retours-choix">
              <input type="radio" name={`${id}-conseil`} value={c} checked={conseil === c} required aria-invalid={erreurConseil || undefined}
                onChange={() => { setConseil(c); if (erreurConseil) setErreur(null); }} />
              <span>{tret(`conseil.${c}`)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="retours-question">
        <label className="retours-libelle" htmlFor={`${id}-texte`}>{fr(tret('ameliorer.question'))}</label>
        <textarea id={`${id}-texte`} className="retours-texte" rows={3} maxLength={TEXTE_MAX} value={ameliorer}
          aria-describedby={`${id}-aide`} onChange={e => setAmeliorer(e.target.value)} />
        <p id={`${id}-aide`} className="muted small retours-aide">
          <span>{fr(tret('ameliorer.aide'))}</span>
          <span className="retours-compteur" aria-hidden="true">{tret('ameliorer.compteur', { n: ameliorer.length })}</span>
        </p>
      </div>

      <fieldset className="retours-question">
        <legend>{fr(tret('source.question'))}</legend>
        {SOURCES.map(s => (
          <label key={s} className="retours-choix retours-choix-liste">
            <input type="radio" name={`${id}-source`} value={s} checked={source === s} onChange={() => setSource(s)} />
            <span>{tret(`source.${s}`)}</span>
          </label>
        ))}
      </fieldset>

      {erreur && !erreurConseil && (
        <p className="small retours-erreur" role="alert">
          {erreur === 'indisponible' ? <AvecAdresse texte={tret('erreur.indisponible')} /> : fr(tret(`erreur.${erreur}`))}
        </p>
      )}
      <button type="submit" className="btn primary" disabled={envoi} aria-busy={envoi}>{tret(envoi ? 'envoi' : 'envoyer')}</button>
      <p className="muted small">{fr(tret('mention'))}</p>
    </form>
  );
}

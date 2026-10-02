// « Mes amis » (issue #359), sous-vue du Profil.
// - Vide : deux pierres, une phrase, et une seule action, « Ajouter » (bouton principal), avec le pseudo exact.
// - Sinon : demandes reçues (Accepter / Refuser), tes amis (« Défier » crée la partie sans lien, puis l'ouvre avec
//   l'écran du défi #81), demandes envoyées (Annuler). Le champ d'ajout reste en haut, en action secondaire.
// Données et règles : src/data/amis.ts (le serveur fait foi : supabase/migrations/20261002010100_amis.sql).
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { defierAmi, demanderAmi, grouperAmis, repondreAmi, retirerAmi } from '../data/amis';
import type { Db } from '../data/supabase';
import { EVENTS, track } from '../data/analytics';
import { useAmis } from './amisListe';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';

interface Props {
  db: Db | null;
  /** Partie créée par « Défier » : l'app l'ouvre avec l'écran du défi. */
  onDefi: (partieId: string) => void;
}

export function Amis({ db, onDefi }: Props) {
  const { liste, recharger, online } = useAmis(db, true);
  const [saisie, setSaisie] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  // Action en cours sur une ligne (une à la fois), erreur de la ligne, retrait à confirmer.
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreurLigne, setErreurLigne] = useState<{ pseudo: string; texte: string } | null>(null);
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);
  const champ = useRef<HTMLInputElement>(null);
  const idChamp = useId();
  const idAide = useId();

  // La confirmation du retrait s'efface d'elle-même : jamais de bouton piégé qui reste armé.
  useEffect(() => {
    if (!aConfirmer) return;
    const fin = setTimeout(() => setAConfirmer(null), 4000);
    return () => clearTimeout(fin);
  }, [aConfirmer]);

  if (!db) return <p className="card muted">{fr(t('amis.indisponible'))}</p>;

  async function ajouter(e: FormEvent) {
    e.preventDefault();
    if (!db || envoi) return;
    setEnvoi(true); setRetour(null);
    const pseudo = saisie.trim().replace(/^@/, '');
    const r = await demanderAmi(db, pseudo);
    setEnvoi(false);
    if (!r.ok) { setRetour({ ok: false, texte: r.error }); champ.current?.focus(); return; }
    if (r.value === 'amis') track(EVENTS.amiAjoute, { comment: 'croisee' });
    setRetour({ ok: true, texte: t(r.value === 'amis' ? 'amis.devenusAmis' : 'amis.envoyee', { pseudo }) });
    setSaisie('');
    recharger();
  }

  async function agir(pseudo: string, action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (occupe) return;
    setOccupe(pseudo); setErreurLigne(null); setAConfirmer(null); setRetour(null);
    const r = await action();
    setOccupe(null);
    if (!r.ok) setErreurLigne({ pseudo, texte: r.error });
    recharger();
  }

  const repondre = (pseudo: string, accepter: boolean) => agir(pseudo, async () => {
    const r = await repondreAmi(db, pseudo, accepter);
    if (r.ok && r.value === 'amis') track(EVENTS.amiAjoute, { comment: 'acceptation' });
    return r;
  });
  const retirer = (pseudo: string) => {
    if (aConfirmer !== pseudo) { setAConfirmer(pseudo); return; }
    void agir(pseudo, () => retirerAmi(db, pseudo));
  };
  async function defier(pseudo: string) {
    if (!db || occupe) return;
    setOccupe(pseudo); setErreurLigne(null); setAConfirmer(null);
    const r = await defierAmi(db, pseudo);
    setOccupe(null);
    if (!r.ok) { setErreurLigne({ pseudo, texte: r.error }); return; }
    // Jamais le pseudo ni la partie dans l'événement.
    track(EVENTS.defiDepuisProfil, {});
    onDefi(r.value);
  }

  const amis = liste.etat === 'pret' ? liste.amis : [];
  const groupes = grouperAmis(amis);
  const vide = liste.etat === 'pret' && amis.length === 0;
  const erreurDe = (pseudo: string) => erreurLigne?.pseudo === pseudo
    ? <p className="ami-erreur small" role="alert">{fr(erreurLigne.texte)}</p> : null;

  const formulaire = (
    <form className={`amis-ajout${vide ? ' amis-ajout-vide' : ' card'}`} onSubmit={ajouter} noValidate>
      {!vide && <label className="amis-ajout-titre" htmlFor={idChamp}>{t('amis.ajouter.titre')}</label>}
      {vide && <label className="sr-only" htmlFor={idChamp}>{t('amis.ajouter.label')}</label>}
      <div className="amis-ajout-ligne">
        <input ref={champ} id={idChamp} className="amis-champ" type="text" inputMode="text" autoComplete="off" autoCapitalize="off"
          autoCorrect="off" spellCheck={false} enterKeyHint="send" maxLength={25} value={saisie}
          placeholder={t('amis.ajouter.placeholder')} aria-describedby={idAide} aria-invalid={retour && !retour.ok ? true : undefined}
          onChange={e => { setSaisie(e.target.value); if (retour && !retour.ok) setRetour(null); }} />
        {!vide && (
          <button type="submit" className="btn amis-ajouter" disabled={envoi || !online || !saisie.trim()} aria-busy={envoi}>
            {t(envoi ? 'amis.ajouter.envoi' : 'amis.ajouter.bouton')}
          </button>
        )}
      </div>
      <p id={idAide} className={`amis-aide small${retour ? (retour.ok ? ' ok' : ' erreur') : ''}`} role={retour ? (retour.ok ? 'status' : 'alert') : undefined}>
        {fr(retour ? retour.texte : t('amis.ajouter.aide'))}
      </p>
      {vide && (
        <button type="submit" className="btn primary amis-cta" disabled={envoi || !online} aria-busy={envoi}>
          {t(envoi ? 'amis.ajouter.envoi' : 'amis.ajouter.bouton')}
        </button>
      )}
    </form>
  );

  return (
    <div className="amis" data-testid="amis" data-vide={vide || undefined}>
      {!online && <p className="card small" role="status">{fr(t('amis.horsLigne'))}</p>}
      {vide ? (
        <div className="amis-vide">
          <span className="amis-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /><span className="stone b" /></span>
          <p className="amis-vide-titre">{t('amis.vide.titre')}</p>
          <p className="amis-vide-texte">{fr(t('defi.amis.videTexte'))}</p>
        </div>
      ) : null}
      {(vide || liste.etat !== 'chargement') && formulaire}

      {liste.etat === 'chargement' && online && <p className="muted small" aria-busy="true">{t('amis.chargement')}</p>}
      {liste.etat === 'erreur' && (
        <p className="card small" role="alert">{fr(t('amis.erreur.chargement'))} <button type="button" className="lien" onClick={recharger}>{t('amis.reessayer')}</button></p>
      )}

      {groupes.recue.length > 0 && (
        <Groupe titre={t('amis.recues.titre')} id="amis-recues">
          {groupes.recue.map(a => (
            <li key={a.pseudo} className="ami">
              <div className="ami-ligne">
                <Initiale pseudo={a.pseudo} />
                <span className="ami-texte"><b>{a.pseudo}</b><small>{t('amis.recue')}</small></span>
                <span className="ami-actions">
                  <button type="button" className="lien ami-discret" disabled={occupe !== null} aria-label={t('amis.refuserAria', { pseudo: a.pseudo })}
                    onClick={() => repondre(a.pseudo, false)}>{t('amis.refuser')}</button>
                  <button type="button" className="ami-pilule plein" disabled={occupe !== null} aria-busy={occupe === a.pseudo}
                    aria-label={t('amis.accepterAria', { pseudo: a.pseudo })} onClick={() => repondre(a.pseudo, true)}>{t('amis.accepter')}</button>
                </span>
              </div>
              {erreurDe(a.pseudo)}
            </li>
          ))}
        </Groupe>
      )}

      {groupes.ami.length > 0 && (
        <Groupe titre={t('amis.liste.titre')} id="amis-liste" pied={<p className="muted small amis-regle">{fr(t('defi.amis.regle'))}</p>}>
          {groupes.ami.map(a => (
            <li key={a.pseudo} className="ami">
              <div className="ami-ligne">
                <Initiale pseudo={a.pseudo} />
                <span className="ami-texte"><b>{a.pseudo}</b></span>
                <span className="ami-actions">
                  <button type="button" className={`ami-retirer${aConfirmer === a.pseudo ? ' arme' : ''}`} disabled={occupe !== null}
                    aria-label={t(aConfirmer === a.pseudo ? 'amis.retirerConfirmerAria' : 'amis.retirerAria', { pseudo: a.pseudo })}
                    onClick={() => retirer(a.pseudo)}>
                    {aConfirmer === a.pseudo ? fr(t('amis.retirerConfirmer'))
                      : <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>}
                  </button>
                  <button type="button" className="ami-pilule" disabled={occupe !== null || !online} aria-busy={occupe === a.pseudo}
                    aria-label={t('defi.amis.defierAria', { pseudo: a.pseudo })} onClick={() => defier(a.pseudo)}>
                    <span className="ami-pilule-pierres" aria-hidden="true"><span className="stone b" /><span className="stone w" /></span>
                    {t(occupe === a.pseudo ? 'defi.amis.creation' : 'defi.amis.defier')}
                  </button>
                </span>
              </div>
              {erreurDe(a.pseudo)}
            </li>
          ))}
        </Groupe>
      )}

      {groupes.envoyee.length > 0 && (
        <Groupe titre={t('amis.envoyees.titre')} id="amis-envoyees">
          {groupes.envoyee.map(a => (
            <li key={a.pseudo} className="ami">
              <div className="ami-ligne">
                <Initiale pseudo={a.pseudo} />
                <span className="ami-texte"><b>{a.pseudo}</b><small>{t('amis.attente')}</small></span>
                <span className="ami-actions">
                  <button type="button" className="lien ami-discret" disabled={occupe !== null} aria-label={t('amis.annulerAria', { pseudo: a.pseudo })}
                    onClick={() => agir(a.pseudo, () => retirerAmi(db, a.pseudo))}>{t('amis.annuler')}</button>
                </span>
              </div>
              {erreurDe(a.pseudo)}
            </li>
          ))}
        </Groupe>
      )}
    </div>
  );
}

function Groupe({ titre, id, pied, children }: { titre: string; id: string; pied?: ReactNode; children: ReactNode }) {
  return (
    <section className="amis-groupe" aria-labelledby={id}>
      <h3 id={id} className="lignes-titre">{titre}</h3>
      <ul className="amis-liste">{children}</ul>
      {pied}
    </section>
  );
}

/** Pastille avec l'initiale du pseudo (décorative : le pseudo est écrit à côté). */
function Initiale({ pseudo }: { pseudo: string }) {
  return <span className="ami-initiale" aria-hidden="true">{pseudo.slice(0, 1).toUpperCase()}</span>;
}

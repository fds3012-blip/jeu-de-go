import { useEffect, useRef, type ReactNode } from 'react';
import { setConsent, setOpposition } from '../data/analytics';
import { useConsentement, useOpposition } from './consentement';
import { LigneInterrupteur } from '../ui/Reglage';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';

/**
 * Consentement (issue #50, forme revue en #485) : bandeau bas compact, non modal, au premier lancement.
 * L'accueil reste visible et utilisable dessous (« jouer » n'est jamais caché) ; sans réponse, rien de non essentiel
 * n'est chargé (src/data/analytics.ts). Le focus va au titre à l'ouverture, sans être piégé : Tab ressort vers la page.
 * Échap (focus dans le bandeau) ferme sans choix (`onIgnorer`) : il reviendra au prochain lancement.
 */
export function ConsentModal({ visible, onConditions, onIgnorer }: { visible: boolean; onConditions: () => void; onIgnorer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (visible && !d.open) {
      d.show?.();
      // Focus sur le titre : lu en premier par les lecteurs d'écran, sans mettre en avant un des deux choix.
      d.querySelector<HTMLElement>('#accord-titre')?.focus({ preventScroll: true });
    }
    if (!visible && d.open) d.close();
  }, [visible]);

  // Hauteur du bandeau en variable CSS : la page garde de quoi défiler au-dessus (profil.css, `--accord-h`).
  useEffect(() => {
    const d = ref.current;
    if (!d || !visible || typeof ResizeObserver === 'undefined') return;
    const racine = document.documentElement;
    const ro = new ResizeObserver(() => racine.style.setProperty('--accord-h', `${Math.ceil(d.offsetHeight)}px`));
    ro.observe(d);
    return () => { ro.disconnect(); racine.style.removeProperty('--accord-h'); };
  }, [visible]);

  return (
    <dialog ref={ref} className="accord" aria-labelledby="accord-titre" aria-describedby="accord-texte"
      // Non modal : le navigateur ne gère pas Échap, on le fait ici. Une fermeture que l'app n'a pas demandée vaut « pas de choix ».
      onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); onIgnorer(); } }} onClose={() => { if (visible) onIgnorer(); }}>
      {/* Contenu toujours rendu : la sortie en fondu garde le texte visible jusqu'au bout. */}
      <div className="accord-corps">
        {/* Titre et texte sur une même ligne de lecture : le bandeau tient en quatre lignes à 320 px. */}
        <div className="accord-message">
          <h2 id="accord-titre" tabIndex={-1}>{fr(t('accord.titre'))}</h2>{' '}
          <p id="accord-texte">{t('accord.texte')} {t('accord.note')}</p>
        </div>
        {/* Deux choix de même taille et de même poids : aucun n'est mis en avant (issue #64, CNIL). */}
        <div className="accord-actions">
          <button type="button" className="lien accord-conditions" onClick={onConditions}>{t('accord.lire')}</button>
          <button type="button" className="btn accord-choix" onClick={() => setConsent('accepte')}>{t('accord.oui')}</button>
          <button type="button" className="btn accord-choix" onClick={() => setConsent('refuse')}>{t('accord.non')}</button>
        </div>
      </div>
    </dialog>
  );
}

/** Page « Conditions et confidentialité » : l'interrupteur pour changer d'avis, puis les données collectées. */
export function Conditions({ onRetour }: { onRetour: () => void }) {
  const consent = useConsentement();
  const oppose = useOpposition();
  return (
    <section className="sous-vue" aria-labelledby="conditions-titre">
      <button type="button" className="back retour" onClick={onRetour}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>{t('profil.retour')}
      </button>
      <h2 id="conditions-titre">{t('profil.conditions')}</h2>
      <div className="lignes">
        <LigneInterrupteur libelle={t('conditions.bugs')} aide={t('conditions.bugsAide')}
          actif={consent === 'accepte'} onChange={v => setConsent(v ? 'accepte' : 'refuse')} />
        <LigneInterrupteur libelle={t('conditions.comptage')} aide={t('conditions.comptageAide')}
          actif={!oppose} onChange={v => setOpposition(!v)} />
      </div>
      <div className="conditions-texte">
        <p className="conditions-intro">{t('conditions.intro')}</p>
        <Repli titre={t('conditions.garde')} ouvert>
          <p><strong>{fr(t('conditions.garde.telephone'))}</strong> {fr(t('conditions.garde.telephoneTexte'))}</p>
          <p><strong>{fr(t('conditions.garde.compte'))}</strong> {t('conditions.garde.compteTexte')}</p>
          {/* #354 : données reçues de Google (art. 14 RGPD), et comment retirer l'accès. */}
          <p data-testid="conditions-google"><strong>{fr(t('conditions.garde.google'))}</strong> {fr(t('conditions.garde.googleTexte'))}</p>
          <p><strong>{fr(t('conditions.garde.defi'))}</strong> {t('conditions.garde.defiTexte')}</p>
          <p><strong>{fr(t('conditions.garde.amis'))}</strong> {fr(t('conditions.garde.amisTexte'))}</p>
          <p><strong>{fr(t('conditions.garde.comptage'))}</strong> {fr(t('conditions.garde.comptageTexte'))}</p>
          <p><strong>{fr(t('conditions.garde.oui'))}</strong> {fr(t('conditions.garde.ouiTexte'))}</p>
        </Repli>
        <Repli titre={t('conditions.pourquoi')}>
          <p>{t('conditions.pourquoi.1')}</p>
          <p>{t('conditions.pourquoi.2')}</p>
          <p>{fr(t('conditions.pourquoi.3'))}</p>
        </Repli>
        <Repli titre={t('conditions.duree')}>
          <p><strong>{fr(t('conditions.duree.compte'))}</strong> {fr(t('conditions.duree.compteTexte'))}</p>
          <p><strong>{fr(t('conditions.duree.defi'))}</strong> {t('conditions.duree.defiTexte')}</p>
          <p><strong>{fr(t('conditions.duree.notifications'))}</strong> {fr(t('conditions.duree.notificationsTexte'))}</p>
          <p><strong>{fr(t('conditions.duree.comptage'))}</strong> {t('conditions.duree.comptageTexte')}</p>
          <p><strong>{fr(t('conditions.duree.telephone'))}</strong> {t('conditions.duree.telephoneTexte')}</p>
        </Repli>
        <Repli titre={t('conditions.droits')}>
          <p>{t('conditions.droits.1')}</p>
          <p>{t('conditions.droits.2')}</p>
          <p>{fr(t('conditions.droits.3'))}</p>
          <p>{fr(t('conditions.droits.4'))}</p>
          {/* Aucune adresse inventée : le contact sera ajouté par l'éditeur (docs/juridique/politique-confidentialite.md). */}
          <p className="conditions-contact">{fr(t('conditions.contact'))}</p>
        </Repli>
      </div>
    </section>
  );
}

/** Section repliable native : clavier et lecteur d'écran gérés par le navigateur. */
function Repli({ titre, ouvert, children }: { titre: string; ouvert?: boolean; children: ReactNode }) {
  return (
    <details className="card small repli" open={ouvert}>
      <summary><h3>{titre}</h3></summary>
      <div className="repli-corps">{children}</div>
    </details>
  );
}

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { setConsent, setOpposition } from '../data/analytics';
import { useConsentement, useOpposition } from './consentement';
import { Sceau } from '../ui/Sceau';
import { LigneInterrupteur } from '../ui/Reglage';
import { fr } from '../ui/typo';
import { t } from '../content/i18n';

/**
 * Fenêtre de consentement (issue #50) : posée une seule fois, au premier lancement.
 * Boîte de dialogue modale native : le reste de la page est inerte ; Tab tourne dans la fenêtre.
 * Échap ferme sans choix (`onIgnorer`) : elle reviendra au prochain lancement.
 */
export function ConsentModal({ visible, onConditions, onIgnorer }: { visible: boolean; onConditions: () => void; onIgnorer: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (visible && !d.open) {
      d.showModal?.();
      // Focus sur le titre : lu en premier par les lecteurs d'écran, sans mettre en avant un des deux choix.
      d.querySelector<HTMLElement>('#accord-titre')?.focus();
    }
    if (!visible && d.open) d.close();
  }, [visible]);

  // Focus piégé : Tab et Maj+Tab tournent entre le premier et le dernier bouton de la fenêtre.
  const piege = (e: KeyboardEvent<HTMLDialogElement>) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const cibles = [...ref.current.querySelectorAll<HTMLElement>('button, a[href]')];
    if (!cibles.length) return;
    const premier = cibles[0], dernier = cibles[cibles.length - 1];
    const actif = document.activeElement as HTMLElement | null;
    const dedans = !!actif && cibles.includes(actif);
    // Depuis le titre (focus d'ouverture) ou hors des boutons : on repart du premier ou du dernier.
    if (e.shiftKey && (actif === premier || !dedans)) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && (actif === dernier || !dedans)) { e.preventDefault(); premier.focus(); }
  };

  return (
    <dialog ref={ref} className="accord" aria-modal="true" aria-labelledby="accord-titre" aria-describedby="accord-texte"
      // Échap : `cancel`, ou directement `close` quand le navigateur saute `cancel` (aucun geste avant).
      // Une fermeture que l'app n'a pas demandée (visible encore vrai) vaut « pas de choix ».
      onCancel={e => { e.preventDefault(); onIgnorer(); }} onClose={() => { if (visible) onIgnorer(); }} onKeyDown={piege}>
      {/* Contenu toujours rendu : la sortie en fondu garde le texte visible jusqu'au bout. */}
      <div className="accord-corps">
        <Sceau id="mochi" taille={48} />
        <h2 id="accord-titre" tabIndex={-1}>{fr(t('accord.titre'))}</h2>
        <p id="accord-texte">{t('accord.texte')}</p>
        <p className="accord-note">{t('accord.note')}</p>
        <button type="button" className="lien accord-conditions" onClick={onConditions}>{t('accord.lire')}</button>
        {/* Deux choix de même taille et de même poids : aucun n'est mis en avant (issue #64, CNIL). */}
        <div className="accord-actions">
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

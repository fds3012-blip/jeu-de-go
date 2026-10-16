import type { ReactNode } from 'react';
import { EnteteEcran } from '../ui/BoutonRetour';
import { setConsent, setOpposition } from '../data/analytics';
import { useConsentement, useOpposition } from './consentement';
import { LigneInterrupteur } from '../ui/Reglage';
import { fr } from '../ui/typo';
import { t } from '../content/i18n/secondaires';

/**
 * Page « Conditions et confidentialité » : l'interrupteur pour changer d'avis, puis les données collectées.
 * #530 : `lignes` (« Mes données ») et `pied` (« Mentions légales ») viennent du Profil.
 * #563 : module à part, chargé avec le Profil (seul à afficher cette page) ; ses textes sont dans frEcrans.ts.
 * Le bandeau de consentement, lui, reste dans le JS initial (src/app/Confidentialite.tsx).
 */
export function Conditions({ onRetour, lignes, pied }: { onRetour: () => void; lignes?: ReactNode; pied?: ReactNode }) {
  const consent = useConsentement();
  const oppose = useOpposition();
  return (
    <section className="sous-vue" aria-labelledby="conditions-titre">
      <EnteteEcran id="conditions-titre" titre={t('profil.conditions')} retour={t('profil.retour')} onRetour={onRetour} />
      <div className="lignes">
        <LigneInterrupteur libelle={t('conditions.bugs')} aide={t('conditions.bugsAide')}
          actif={consent === 'accepte'} onChange={v => setConsent(v ? 'accepte' : 'refuse')} />
        <LigneInterrupteur libelle={t('conditions.comptage')} aide={t('conditions.comptageAide')}
          actif={!oppose} onChange={v => setOpposition(!v)} />
        {lignes}
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
          <p>{fr(t('conditions.droits.2'))}</p>
          <p>{fr(t('conditions.droits.3'))}</p>
          <p>{fr(t('conditions.droits.4'))}</p>
          {/* Aucune adresse inventée : le contact sera ajouté par l'éditeur (docs/juridique/politique-confidentialite.md). */}
          <p className="conditions-contact">{fr(t('conditions.contact'))}</p>
        </Repli>
        {pied}
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

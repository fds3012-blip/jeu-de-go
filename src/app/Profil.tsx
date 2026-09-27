// Onglet Profil (issue #50) : une carte d'identité, quatre réglages en lignes, deux liens. Tient sans défiler.
import { Account } from './Account';
import { Conditions } from './Confidentialite';
import type { Settings } from './settings';
import { identite, texteSerie } from './identite';
import { LigneChoix, LigneInterrupteur, LigneLien } from '../ui/Reglage';

export type VueProfil = 'menu' | 'compte' | 'conditions';

const THEMES = [
  { valeur: 'dark', libelle: 'Sombre' },
  { valeur: 'light', libelle: 'Clair' },
  { valeur: 'auto', libelle: 'Auto' },
] as const;

interface Props {
  vue: VueProfil;
  onVue: (v: VueProfil) => void;
  settings: Settings;
  set: (patch: Partial<Settings>) => void;
  /** Pseudo et cote du joueur connecté, null sans compte. */
  profil: { pseudo: string | null; cote: number } | null;
  serie: number;
}

export function Profil({ vue, onVue, settings, set, profil, serie }: Props) {
  const retour = () => { onVue('menu'); window.scrollTo({ top: 0 }); };
  if (vue === 'conditions') return <Conditions onRetour={retour} />;
  if (vue === 'compte') {
    return (
      <section className="sous-vue" aria-labelledby="compte-titre">
        <button type="button" className="back retour" onClick={retour}>
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>Retour
        </button>
        <h2 id="compte-titre">Mon compte</h2>
        <Account />
      </section>
    );
  }

  const id = identite(profil, serie);
  return (
    <div className="profil">
      <section className="identite" aria-label="Ton profil">
        {id.initiale ? <span className="avatar" aria-hidden="true">{id.initiale}</span> : <span className="stone b" aria-hidden="true" />}
        <div className="identite-texte">
          <b>{id.nom}</b>
          <span>{id.detail}</span>
        </div>
        {id.serie > 0 && <span className="identite-serie" role="img" aria-label={`Série de ${texteSerie(id.serie)}`}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" /></svg>{id.serie}
        </span>}
      </section>

      <h2>Réglages</h2>
      <div className="lignes">
        <LigneChoix libelle="Thème" options={THEMES} valeur={settings.theme} onChange={t => set({ theme: t })} />
        <LigneInterrupteur libelle="Confirmer au doigt" aide="Une seconde touche pose la pierre." actif={settings.confirmTouch} onChange={v => set({ confirmTouch: v })} />
        <LigneInterrupteur libelle="Sons" actif={settings.sound} onChange={v => set({ sound: v })} />
        <LigneInterrupteur libelle="Célébrations" aide="Confettis et carillon quand tu gagnes." actif={settings.celebrations} onChange={v => set({ celebrations: v })} />
      </div>

      <div className="lignes">
        <LigneLien libelle="Mon compte" valeur={profil?.pseudo ?? (profil ? undefined : 'Se connecter')} onClick={() => onVue('compte')} />
        <LigneLien libelle="Conditions et confidentialité" onClick={() => onVue('conditions')} />
      </div>
    </div>
  );
}

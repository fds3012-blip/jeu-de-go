// Onglet Profil (issue #50) : une carte d'identité, quatre réglages en lignes, deux liens. Tient sans défiler.
import { Account } from './Account';
import { Conditions } from './Confidentialite';
import { choisirThemeGoban, useIdThemeGoban, type Settings } from './settings';
import { lireXp, niveauDe, niveauRequis, themeDebloque } from './xp';
import { ORDRE_THEMES, THEMES_GOBAN } from '../ui/boardArt';
import { identite, texteSerie } from './identite';
import { inviterCompte } from './serieLocale';
import { LigneBascules, LigneChoix, LigneInterrupteur, LigneLien } from '../ui/Reglage';
import { hapticStone } from '../ui/haptics';
import { playStone } from '../ui/sound';
import { useMemo } from 'react';
import { readLocal } from './hooks';
import { BILAN_KEY, lireBilan } from './bilan';
import { PARTIES_KEY, type Parties } from './home';
import { paliers } from './paliers';
import { badges, statistiques } from './vitrine';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { Statistiques, VitrineBadges } from '../ui/Vitrine';
import { t } from '../content/i18n';

const SOLVED_KEY = 'go.problemes.v1';

/** Données locales du Profil vivant (#103) : problèmes réussis, parties, bilan, paliers complets. */
function useDonnees(serie: number) {
  return useMemo(() => {
    const reussis = new Set(Object.keys(readLocal<Record<string, true>>(SOLVED_KEY, {}) ?? {}));
    const parties = readLocal<Parties>(PARTIES_KEY, { n: 0 })?.n ?? 0;
    const bilan = lireBilan(readLocal<unknown>(BILAN_KEY, {}));
    const d = { reussis: reussis.size, serie, parties, bilan, paliers: paliers(parsePuzzles(ALL_PUZZLES), reussis) };
    return { stats: statistiques(d), badges: badges(d) };
  }, [serie]);
}

export type VueProfil = 'menu' | 'compte' | 'conditions';

// Libellés traduits (#167) : calculés à l'affichage, dans la langue de l'interface.
const themes = () => [
  { valeur: 'dark', libelle: t('profil.theme.sombre') },
  { valeur: 'light', libelle: t('profil.theme.clair') },
  { valeur: 'auto', libelle: t('profil.theme.auto') },
] as const;

// Aide de Mochi en partie (#35) : « Débutants » = contre Pomme et Caillou seulement (par défaut).
const aides = () => [
  { valeur: 'auto', libelle: t('profil.aide.auto') },
  { valeur: 'oui', libelle: t('profil.aide.oui') },
  { valeur: 'non', libelle: t('profil.aide.non') },
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
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>{t('profil.retour')}
        </button>
        <h2 id="compte-titre">{t('profil.compte')}</h2>
        <Account />
      </section>
    );
  }

  return <Menu onVue={onVue} settings={settings} set={set} profil={profil} serie={serie} />;
}

function Menu({ onVue, settings, set, profil, serie }: Omit<Props, 'vue'>) {
  const id = identite(profil, serie);
  const donnees = useDonnees(serie);
  return (
    <div className="profil">
      <section className="identite" aria-label={t('profil.aria')}>
        {id.initiale ? <span className="avatar" aria-hidden="true">{id.initiale}</span> : <span className="stone b" aria-hidden="true" />}
        <div className="identite-texte">
          <b>{id.nom}</b>
          {/* #161 : au 3e jour de série sans compte, la ligne sous « Invité » propose le compte ; l'action reste « Mon compte ». */}
          <span>{inviterCompte(!!profil, id.serie) ? t('serie.invitation') : id.detail}</span>
        </div>
        {id.serie > 0 && <span className="identite-serie" role="img" aria-label={t('profil.serieAria', { jours: texteSerie(id.serie) })}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" /></svg>{id.serie}
        </span>}
        <Statistiques stats={donnees.stats} />
      </section>
      <VitrineBadges liste={donnees.badges} />

      <h2>{t('profil.reglages')}</h2>
      <div className="lignes">
        <LigneChoix libelle={t('profil.theme')} options={themes()} valeur={settings.theme} onChange={v => set({ theme: v })} />
        <LigneGoban />
        <LigneInterrupteur libelle={t('profil.confirmer')} aide={t('profil.confirmerAide')} actif={settings.confirmTouch} onChange={v => set({ confirmTouch: v })} />
        <LigneBascules libelle={t('profil.sons')} bascules={[
          // #165 : un aperçu à l'allumage, le claquement de pierre ou une petite vibration.
          { libelle: t('profil.son'), actif: settings.sound, onChange: v => { set({ sound: v }); if (v) setTimeout(() => playStone(40, 9), 0); } },
          { libelle: t('profil.vibrations'), actif: settings.vibrations, onChange: v => { set({ vibrations: v }); if (v) setTimeout(hapticStone, 0); } },
        ]} />
        <LigneInterrupteur libelle={t('profil.celebrations')} aide={t('profil.celebrationsAide')} actif={settings.celebrations} onChange={v => set({ celebrations: v })} />
        <LigneChoix libelle={t('profil.aide')} options={aides()} valeur={settings.aide} onChange={a => set({ aide: a })} />
      </div>

      <div className="lignes">
        <LigneLien libelle={t('profil.compte')} valeur={profil?.pseudo ?? (profil ? undefined : t('profil.seConnecter'))} onClick={() => onVue('compte')} />
        <LigneLien libelle={t('profil.conditions')} onClick={() => onVue('conditions')} />
      </div>
    </div>
  );
}

/**
 * Thème du goban (#109) sur une seule ligne : quatre pastilles de 44 px. Un thème pas encore débloqué
 * reste visible avec son niveau requis, pour donner envie sans rien cacher.
 */
function LigneGoban() {
  const actuel = useIdThemeGoban();
  const niveau = niveauDe(lireXp()).niveau;
  return (
    <div className="ligne ligne-choix ligne-goban" role="group" aria-label={t('profil.goban')}>
      <span className="ligne-libelle" aria-hidden="true">{t('profil.goban')}</span>
      <span className="pastilles">
        {ORDRE_THEMES.map(id => {
          const th = THEMES_GOBAN[id], ouvert = themeDebloque(id, niveau), requis = niveauRequis(id);
          return (
            <button key={id} type="button" className="pastille" aria-pressed={actuel === id} aria-disabled={!ouvert || undefined}
              aria-label={ouvert ? t(`theme.${id}`) : t('profil.gobanVerrou', { nom: t(`theme.${id}`), niveau: requis })} data-theme-goban={id}
              onClick={() => { if (ouvert) choisirThemeGoban(id); }}>
              <span className="pastille-bois" style={{ background: `radial-gradient(circle at 40% 35%, ${th.fond[0]}, ${th.fond[1]} 60%, ${th.fond[2]})` }}>
                <span className="pastille-pierre" style={{ background: `radial-gradient(circle at 38% 32%, ${th.blanche[0]}, ${th.blanche[1]} 55%, ${th.blanche[3]})` }} />
                <span className="pastille-ligne" style={{ background: th.ligne }} />
              </span>
              {!ouvert && <span className="pastille-niveau" aria-hidden="true">{t('profil.gobanNiveau', { niveau: requis })}</span>}
            </button>
          );
        })}
      </span>
    </div>
  );
}

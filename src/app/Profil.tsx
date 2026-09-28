// Onglet Profil (issue #50) : tient sans défiler.
// #214 : « Ton parcours » d'abord (niveau et XP, record, leçons, adversaires battus, problèmes réussis, vitrine) ;
// les réglages passent derrière une ligne « Réglages » (sous-vue), comme chez chess.com ; ligne « Installer l'app ».
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
import { useEffect, useMemo, type ReactNode } from 'react';
import { readLocal, writeLocal } from './hooks';
import { BILAN_KEY, lireBilan } from './bilan';
import { PARTIES_KEY, type Parties } from './home';
import { paliers } from './paliers';
import { BADGES_KEY, badges, lireBadges, memoriser, statistiques, type Parcours } from './vitrine';
import { ALL_PUZZLES } from '../content/puzzles';
import { parsePuzzles } from '../data/puzzles';
import { Statistiques, VitrineBadges } from '../ui/Vitrine';
import { BarreNiveau } from '../ui/Niveau';
import { ProposerInstallation, usePlateformeInstallation } from '../ui/ProposerInstallation';
import { etatInstallation, installable } from './installation';
import { LANGUES, langue, memoriserChoixLangue, t, type Langue } from '../content/i18n';

const SOLVED_KEY = 'go.problemes.v1';

/**
 * Données locales du Profil vivant (#103) : problèmes réussis, parties, bilan, paliers complets.
 * #212 : le record de série, et les badges gagnés gardés pour toujours sur l'appareil.
 */
function useDonnees(serie: number, record: number, parcours: Parcours) {
  const { lecons: { faites, total }, adversaires } = parcours;
  const donnees = useMemo(() => {
    const reussis = new Set(Object.keys(readLocal<Record<string, true>>(SOLVED_KEY, {}) ?? {}));
    const parties = readLocal<Parties>(PARTIES_KEY, { n: 0 })?.n ?? 0;
    const bilan = lireBilan(readLocal<unknown>(BILAN_KEY, {}));
    const d = { reussis: reussis.size, serie, record, parties, bilan, paliers: paliers(parsePuzzles(ALL_PUZZLES), reussis) };
    const gagnes = lireBadges(readLocal<unknown>(BADGES_KEY, []));
    const liste = badges(d, gagnes);
    return { stats: statistiques(d, { lecons: { faites, total }, adversaires }), badges: liste, gagnes, apres: memoriser(gagnes, liste) };
  }, [serie, record, faites, total, adversaires]);
  useEffect(() => { if (donnees.apres !== donnees.gagnes) writeLocal(BADGES_KEY, donnees.apres); }, [donnees]);
  return donnees;
}

export type VueProfil = 'menu' | 'reglages' | 'installer' | 'compte' | 'conditions';

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
  /** Plus longue série connue (#212). */
  record?: number;
  /** « Ton parcours » (#214) : leçons terminées et taille de l'échelle des adversaires. */
  parcours: Parcours;
}

/** Sous-vue du Profil : « Retour » en haut, un titre, un contenu. */
function SousVue({ id, titre, onRetour, children }: { id: string; titre: string; onRetour: () => void; children: ReactNode }) {
  return (
    <section className="sous-vue" aria-labelledby={id}>
      <button type="button" className="back retour" onClick={onRetour}>
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M10 3.5 5.5 8 10 12.5" /></svg>{t('profil.retour')}
      </button>
      <h2 id={id}>{titre}</h2>
      {children}
    </section>
  );
}

export function Profil({ vue, onVue, settings, set, profil, serie, record = 0, parcours }: Props) {
  const retour = () => { onVue('menu'); window.scrollTo({ top: 0 }); };
  if (vue === 'conditions') return <Conditions onRetour={retour} />;
  if (vue === 'compte') return <SousVue id="compte-titre" titre={t('profil.compte')} onRetour={retour}><Account /></SousVue>;
  if (vue === 'reglages') return <SousVue id="reglages-titre" titre={t('profil.reglages')} onRetour={retour}><Reglages settings={settings} set={set} /></SousVue>;
  if (vue === 'installer') {
    return (
      <SousVue id="installer-titre" titre={t('profil.installer')} onRetour={retour}>
        <ProposerInstallation moment="profil" onFin={retour} />
      </SousVue>
    );
  }

  return <Menu onVue={onVue} settings={settings} set={set} profil={profil} serie={serie} record={record} parcours={parcours} />;
}

function Menu({ onVue, profil, serie, record = 0, parcours }: Omit<Props, 'vue'>) {
  const id = identite(profil, serie);
  const donnees = useDonnees(serie, record, parcours);
  // Ligne « Installer l'app » (#214) : tant que l'app est installable ici et pas installée.
  const proposerInstallation = installable(usePlateformeInstallation(), etatInstallation());
  return (
    <div className="profil">
      <h2 className="profil-titre">{t('profil.parcours')}</h2>
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
        <div className="identite-niveau"><BarreNiveau /></div>
        <Statistiques stats={donnees.stats} />
      </section>
      <VitrineBadges liste={donnees.badges} />

      <div className="lignes">
        <LigneLien libelle={t('profil.reglages')} valeur={t('profil.reglagesResume')} onClick={() => onVue('reglages')} />
        {proposerInstallation && <LigneLien libelle={t('profil.installer')} onClick={() => onVue('installer')} />}
        <LigneLien libelle={t('profil.compte')} valeur={profil?.pseudo ?? (profil ? undefined : t('profil.seConnecter'))} onClick={() => onVue('compte')} />
        <LigneLien libelle={t('profil.conditions')} onClick={() => onVue('conditions')} />
      </div>
    </div>
  );
}

/** Réglages (sous-vue depuis #214) : les six lignes d'avant, inchangées. */
function Reglages({ settings, set }: Pick<Props, 'settings' | 'set'>) {
  return (
    <div className="profil">
      <div className="lignes">
        <LigneLangue />
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
    </div>
  );
}

/**
 * Langue de l'interface (#167) : « Français / English », chaque nom écrit dans sa langue (attribut `lang` pour les lecteurs
 * d'écran). Le choix est gardé sur l'appareil (`go.langue.v1`) et prime sur `?lang` et sur l'appareil. La page se recharge
 * pour tout traduire d'un coup, leçons et problèmes compris.
 */
function LigneLangue() {
  const actuelle = langue();
  const choisir = (l: Langue) => {
    if (l === actuelle) return;
    memoriserChoixLangue(l);
    location.reload();
  };
  return (
    <div className="ligne ligne-choix" role="group" aria-label={t('profil.langue')}>
      <span className="ligne-libelle" aria-hidden="true">{t('profil.langue')}</span>
      <span className="seg">
        {LANGUES.map(l => <button type="button" key={l} lang={l} aria-pressed={actuelle === l} onClick={() => choisir(l)}>{t(`langue.${l}`)}</button>)}
      </span>
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

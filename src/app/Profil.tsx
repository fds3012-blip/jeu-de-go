// Onglet Profil (issue #50) : une carte d'identité, quatre réglages en lignes, deux liens. Tient sans défiler.
import { Account } from './Account';
import { Conditions } from './Confidentialite';
import { choisirThemeGoban, useIdThemeGoban, type Settings } from './settings';
import { lireXp, niveauDe, niveauRequis, themeDebloque } from './xp';
import { ORDRE_THEMES, THEMES_GOBAN } from '../ui/boardArt';
import { identite, texteSerie } from './identite';
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

const THEMES = [
  { valeur: 'dark', libelle: 'Sombre' },
  { valeur: 'light', libelle: 'Clair' },
  { valeur: 'auto', libelle: 'Auto' },
] as const;

// Aide de Mochi en partie (#35) : « Débutants » = contre Pomme et Caillou seulement (par défaut).
const AIDES = [
  { valeur: 'auto', libelle: 'Débutants' },
  { valeur: 'oui', libelle: 'Toujours' },
  { valeur: 'non', libelle: 'Jamais' },
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

  return <Menu onVue={onVue} settings={settings} set={set} profil={profil} serie={serie} />;
}

function Menu({ onVue, settings, set, profil, serie }: Omit<Props, 'vue'>) {
  const id = identite(profil, serie);
  const donnees = useDonnees(serie);
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
        <Statistiques stats={donnees.stats} />
      </section>
      <VitrineBadges liste={donnees.badges} />

      <h2>Réglages</h2>
      <div className="lignes">
        <LigneChoix libelle="Thème" options={THEMES} valeur={settings.theme} onChange={t => set({ theme: t })} />
        <LigneGoban />
        <LigneInterrupteur libelle="Confirmer au doigt" aide="Une seconde touche pose la pierre." actif={settings.confirmTouch} onChange={v => set({ confirmTouch: v })} />
        <LigneBascules libelle="Sons" bascules={[
          // Un aperçu à l'allumage : le claquement de pierre, ou une petite vibration.
          { libelle: 'Son', actif: settings.sound, onChange: v => { set({ sound: v }); if (v) setTimeout(() => playStone(40, 9), 0); } },
          { libelle: 'Vibrations', actif: settings.vibrations, onChange: v => { set({ vibrations: v }); if (v) setTimeout(hapticStone, 0); } },
        ]} />
        <LigneInterrupteur libelle="Célébrations" aide="Confettis et carillon quand tu gagnes." actif={settings.celebrations} onChange={v => set({ celebrations: v })} />
        <LigneChoix libelle="Aide de Mochi" options={AIDES} valeur={settings.aide} onChange={a => set({ aide: a })} />
      </div>

      <div className="lignes">
        <LigneLien libelle="Mon compte" valeur={profil?.pseudo ?? (profil ? undefined : 'Se connecter')} onClick={() => onVue('compte')} />
        <LigneLien libelle="Conditions et confidentialité" onClick={() => onVue('conditions')} />
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
    <div className="ligne ligne-choix ligne-goban" role="group" aria-label="Goban">
      <span className="ligne-libelle" aria-hidden="true">Goban</span>
      <span className="pastilles">
        {ORDRE_THEMES.map(id => {
          const t = THEMES_GOBAN[id], ouvert = themeDebloque(id, niveau), requis = niveauRequis(id);
          return (
            <button key={id} type="button" className="pastille" aria-pressed={actuel === id} aria-disabled={!ouvert || undefined}
              aria-label={ouvert ? t.nom : `${t.nom}, débloqué au niveau ${requis}`} data-theme-goban={id}
              onClick={() => { if (ouvert) choisirThemeGoban(id); }}>
              <span className="pastille-bois" style={{ background: `radial-gradient(circle at 40% 35%, ${t.fond[0]}, ${t.fond[1]} 60%, ${t.fond[2]})` }}>
                <span className="pastille-pierre" style={{ background: `radial-gradient(circle at 38% 32%, ${t.blanche[0]}, ${t.blanche[1]} 55%, ${t.blanche[3]})` }} />
                <span className="pastille-ligne" style={{ background: t.ligne }} />
              </span>
              {!ouvert && <span className="pastille-niveau" aria-hidden="true">Niv. {requis}</span>}
            </button>
          );
        })}
      </span>
    </div>
  );
}

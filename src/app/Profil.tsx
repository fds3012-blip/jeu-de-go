// Onglet Profil (issue #50) : tient sans défiler.
// #214 : « Ton parcours » d'abord (niveau et XP, record, leçons, adversaires battus, problèmes réussis, vitrine) ;
// les réglages passent derrière une ligne « Réglages » (sous-vue), comme chez chess.com ; ligne « Installer l'app ».
import { Account } from './Account';
import { Conditions } from './Confidentialite';
import { ImportSgf } from './ImportSgf';
import { MesParties } from './MesParties';
import { historiqueAppareil } from './historique';
import type { Db } from '../data/supabase';
import { choisirThemeGoban, useIdThemeGoban, type Settings } from './settings';
import { lireXp, niveauDe, niveauRequis, themeDebloque } from './xp';
import { ORDRE_THEMES, THEMES_GOBAN } from '../ui/boardArt';
import { identite, texteSerie } from './identite';
import { inviterCompte } from './serieLocale';
import { LigneBascules, LigneChoix, LigneIcone, LigneInterrupteur, LigneLien } from '../ui/Reglage';
import { IconeReglage, type IconeReglageId } from '../ui/IconesReglages';
import { hapticStone } from '../ui/haptics';
import { playStone } from '../ui/sound';
import { Suspense, lazy, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { EVENTS, analyticsConfig, estEquipe, setEquipe, subscribeConsent, track } from '../data/analytics';
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
import { clePubliqueVapid, resumeRappel } from './rappel';
import { ReglageRappel } from '../ui/ProposerRappel';
import { LANGUES, langue, memoriserChoixLangue, t, type Langue } from '../content/i18n/secondaires';
import type { Placement } from './placement';
import { Amis } from './Amis';
import { BoutonAide } from '../ui/BoutonAide';
import { CarteCote } from '../ui/Cote';
import { grade, tc, texteCote } from '../content/i18n/cote';
import type { ProfilJoueur } from './hooks';
import { Semaine } from './Semaine';
import { etatSemaine, nombreAtteints } from './semaine';
import { te } from '../content/i18n/emulation';
import '../ui/emulation.css';
import { FeuilleSignaler } from '../ui/Securite';
import { tsec } from '../content/i18n/securite';
import { tk } from '../content/i18n/club';
import { Board } from '../ui/Board';
import { CADENCES_ORDRE, CADENCES } from '../go/pendule';
import '../ui/club.css';

// Joueur de club (#368, #372) : sous-écrans chargés à la demande, hors du morceau du Profil.
const MesStatistiques = lazy(() => import('./Statistiques'));
const Etude = lazy(() => import('./Etude'));

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
    const apres = memoriser(gagnes, liste);
    // #214 : badges gagnés depuis la dernière visite du Profil ; ils s'impriment une fois dans la vitrine.
    const nouveaux = apres.filter(id => !gagnes.includes(id));
    return { stats: statistiques(d, { lecons: { faites, total }, adversaires }), badges: liste, gagnes, apres, nouveaux };
  }, [serie, record, faites, total, adversaires]);
  useEffect(() => { if (donnees.apres !== donnees.gagnes) writeLocal(BADGES_KEY, donnees.apres); }, [donnees]);
  return donnees;
}

export type VueProfil = 'menu' | 'reglages' | 'installer' | 'rappel' | 'compte' | 'conditions' | 'importer' | 'parties' | 'amis' | 'cote' | 'stats' | 'etude' | 'semaine';

// Libellés traduits (#167) : calculés à l'affichage, dans la langue de l'interface.
const themes = () => [
  { valeur: 'dark', libelle: t('profil.theme.sombre') },
  { valeur: 'light', libelle: t('profil.theme.clair') },
  { valeur: 'auto', libelle: t('profil.theme.auto') },
] as const;

// Aide de Mochi en partie (#35) : « Au début » = contre Pomme et Caillou seulement (par défaut).
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
  profil: (Pick<ProfilJoueur, 'pseudo' | 'cote'> & Partial<ProfilJoueur>) | null;
  /** #417 : le départ de la cote vient d'être choisi ; relire le profil. */
  onProfilChange?: () => void;
  serie: number;
  /** Plus longue série connue (#212). */
  record?: number;
  /** « Ton parcours » (#214) : leçons terminées et taille de l'échelle des adversaires. */
  parcours: Parcours;
  /** « Je sais déjà jouer » (#283) : niveau estimé (discret, une ligne) et placement à refaire. */
  placement?: Placement | null;
  onPlacement?: () => void;
  /**
   * « Mes amis » (#359) : service Supabase, compte complet (e-mail et pseudo) ou non, ouverture de l'écran de compte
   * sinon, et partie créée par « Défier ». Absent sans service de compte : pas de ligne.
   */
  amis?: { db: Db; compte: boolean; demandes: number; onCompte: () => void; onDefi: (partieId: string) => void };
  /** « Mes parties » (#358) : état vide, « Joue ta première partie ». */
  onJouer?: () => void;
  /** « Mes parties » : défis par lien terminés, lus dans Supabase pour la session ouverte. */
  db?: Db | null;
  userId?: string;
  /** « Ta semaine » (#369) : l'objectif « problèmes » mène à l'onglet Problèmes. */
  onProblemes?: () => void;
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

export function Profil({ vue, onVue, settings, set, profil, serie, record = 0, parcours, placement, onPlacement, onJouer, db, userId, amis, onProfilChange, onProblemes }: Props) {
  const retour = () => { onVue('menu'); window.scrollTo({ top: 0 }); };
  // #358 : toutes les parties terminées, et leur revue.
  // #286 : « Analyser une partie » est dans « Mes parties » depuis #358 (le Profil tient sans défiler) ; on y revient.
  if (vue === 'parties') return <MesParties onRetour={retour} onJouer={onJouer ?? retour} onImporter={() => onVue('importer')} onEtudier={() => onVue('etude')} db={db} userId={userId} confirmTouch={settings.confirmTouch} />;
  if (vue === 'conditions') return <Conditions onRetour={retour} />;
  // #286 : analyser une partie jouée ailleurs (SGF), action secondaire du Profil.
  if (vue === 'importer') return <ImportSgf onRetour={() => { onVue('parties'); window.scrollTo({ top: 0 }); }} pseudo={profil?.pseudo} confirmTouch={settings.confirmTouch} />;
  if (vue === 'amis' && amis?.compte) {
    return <SousVue id="amis-titre" titre={t('amis.titre')} onRetour={retour}><Amis db={amis.db} onDefi={amis.onDefi} /></SousVue>;
  }
  // #417 : ta cote de jeu (parties classées entre humains), sa courbe de 30 jours et le point de départ.
  if (vue === 'cote' && amis?.compte && userId) {
    return <SousVue id="cote-titre" titre={tc('cote.titre')} onRetour={retour}><CarteCote db={amis.db} userId={userId} onChange={onProfilChange} /></SousVue>;
  }
  // #369 : tes objectifs de la semaine et ce que tu as fait depuis lundi (avec un compte : tes amis battus, ta cote).
  if (vue === 'semaine') {
    return (
      <SousVue id="semaine-titre" titre={te('semaine.titre')} onRetour={retour}>
        <Semaine db={amis?.compte ? amis.db : null}
          actions={{ parties: onJouer ?? retour, problemes: onProblemes ?? retour, erreurs: () => { onVue('parties'); window.scrollTo({ top: 0 }); } }} />
      </SousVue>
    );
  }
  // #368 : « Mes statistiques » (cote sur 90 jours, précision, erreurs par phase, bilan). Action principale : revoir une partie.
  if (vue === 'stats') {
    const compte = !!amis?.compte && !!userId;
    return (
      <SousVue id="stats-titre" titre={tk('stats.titre')} onRetour={retour}>
        <Suspense fallback={<p className="muted" aria-busy="true">{tk('stats.chargement')}</p>}>
          <MesStatistiques db={compte ? amis!.db : null} userId={compte ? userId : undefined} onRevoir={() => { onVue('parties'); window.scrollTo({ top: 0 }); }} />
        </Suspense>
      </SousVue>
    );
  }
  // #372 : « Étudier une position » (goban libre, variantes, analyse KataGo à la demande).
  if (vue === 'etude') {
    return (
      <SousVue id="etude-titre" titre={tk('etude.titre')} onRetour={() => { onVue('parties'); window.scrollTo({ top: 0 }); }}>
        <Suspense fallback={<p className="muted" aria-busy="true">…</p>}><Etude confirmTouch={settings.confirmTouch} /></Suspense>
      </SousVue>
    );
  }
  if (vue === 'compte') return <SousVue id="compte-titre" titre={t('profil.compte')} onRetour={retour}><Account /></SousVue>;
  if (vue === 'reglages') return <SousVue id="reglages-titre" titre={t('profil.reglages')} onRetour={retour}><Reglages settings={settings} set={set} /></SousVue>;
  if (vue === 'rappel') {
    return (
      <SousVue id="rappel-titre" titre={t('profil.rappel')} onRetour={retour}>
        <ReglageRappel compte={!!profil?.pseudo} onCompte={() => onVue('compte')} onInstaller={() => onVue('installer')} />
      </SousVue>
    );
  }
  if (vue === 'installer') {
    return (
      <SousVue id="installer-titre" titre={t('profil.installer')} onRetour={retour}>
        <ProposerInstallation moment="profil" onFin={retour} />
      </SousVue>
    );
  }

  return <Menu onVue={onVue} settings={settings} set={set} profil={profil} serie={serie} record={record} parcours={parcours} placement={placement} onPlacement={onPlacement} userId={userId} amis={amis} />;
}

/** Date courte du placement (« 28/09 »), dans la langue de l'interface. */
function dateCourte(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(langue() === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: '2-digit' });
}

function Menu({ onVue, settings, profil, serie, record = 0, parcours, placement, onPlacement, userId, amis }: Omit<Props, 'vue'>) {
  // #365 : « Montrer la série » éteint, ni flamme, ni record, ni badge de série ; la série continue d'être comptée.
  const serieVisible = settings.serieVisible;
  const id = identite(profil, serieVisible ? serie : 0);
  const nParties = useMemo(() => historiqueAppareil().length, []);
  const valeurParties = nParties ? t('historique.profilResume', { n: nParties }) : userId ? undefined : t('historique.profilVide');
  // #359 : demandes d'ami reçues (lues par l'app, aussi pour la pastille de l'onglet).
  const demandes = amis?.demandes ?? 0;
  const donnees = useDonnees(serie, record, parcours);
  // Ligne « Installer l'app » (#214) : tant que l'app est installable ici et pas installée.
  const proposerInstallation = installable(usePlateformeInstallation(), etatInstallation());
  const atteints = useMemo(() => nombreAtteints(etatSemaine().courante), []);
  // #363 : feuille « Nous écrire » (bug, idée, autre).
  const [ecrire, setEcrire] = useState(false);
  return (
    <div className="profil">
      {/* #362 : « Aide » à droite du titre, sans prendre de hauteur (le Profil tient sans défiler en 390 × 844). */}
      <div className="profil-titre-ligne">
        <h2 className="profil-titre">{t('profil.parcours')}</h2>
        <BoutonAide depuis="profil" fiche="regles" libelle={t('profil.aideJeu')} />
      </div>
      <section className="identite" aria-label={t('profil.aria')}>
        {id.initiale ? <span className="avatar" aria-hidden="true">{id.initiale}</span> : <span className="stone b" aria-hidden="true" />}
        <div className="identite-texte">
          <b>{id.nom}</b>
          {/* #161 : au 3e jour de série sans compte, la ligne sous « Invité » propose le compte ; l'action reste « Mon compte ». */}
          <span>{serieVisible && inviterCompte(!!profil, id.serie) ? t('serie.invitation') : id.detail}</span>
        </div>
        {id.serie > 0 && <span className="identite-serie" role="img" aria-label={t('profil.serieAria', { jours: texteSerie(id.serie) })}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d="M8.6 1.2c.4 2.3 3.9 3.9 3.9 7.9A4.5 4.5 0 0 1 8 13.8a4.5 4.5 0 0 1-4.5-4.6c0-2 1-3.2 2-4 0 1.4.6 2.4 1.5 2.7C6.6 5.6 7.4 3 8.6 1.2Z" fill="currentColor" /></svg>{id.serie}
        </span>}
        <div className="identite-niveau"><BarreNiveau /></div>
        <Statistiques stats={serieVisible ? donnees.stats : donnees.stats.filter(s => s.id !== 'record')} />
      </section>
      <VitrineBadges liste={serieVisible ? donnees.badges : donnees.badges.filter(b => b.id !== 'serie-7')} nouveaux={donnees.nouveaux} />

      <div className="lignes">
        {/* #358 : tes parties passées, en tête : c'est la ligne qu'on rouvre le plus. « Analyser une partie » (#286) y est.
            #359 : « Mes amis » partage cette ligne (deux moitiés) : le Profil tient toujours sans défiler en 390 × 844. */}
        {amis ? (
          <div className="ligne ligne-double">
            <DemiLigne icone="parties" libelle={t('historique.titre')} valeur={valeurParties} onClick={() => onVue('parties')} />
            <DemiLigne icone="amis" libelle={t('amis.titre')}
              valeur={!amis.compte ? t('amis.profil.sansCompte')
                : demandes > 0 ? <span className="amis-demandes"><span className="amis-point" aria-hidden="true" />{t('amis.profil.demandes', { n: demandes })}</span> : undefined}
              onClick={() => (amis.compte ? onVue('amis') : amis.onCompte())} />
          </div>
        ) : <LigneLien icone={<IconeReglage id="parties" />} libelle={t('historique.titre')} valeur={valeurParties} onClick={() => onVue('parties')} />}
        {/* #283 : le kyu estimé ne s'affiche qu'ici, sur une ligne, avec sa date ; la ligne relance le placement.
            #417 : avec un compte complet, « Ta cote » partage cette ligne (deux moitiés) : le Profil tient toujours sans défiler. */}
        {amis?.compte && profil && onPlacement ? (
          <div className="ligne ligne-double">
            <DemiLigne icone="cote" libelle={tc('cote.ligne')} testId="ligne-cote"
              valeur={!profil.parties && !profil.depart ? tc('cote.ligneDepart') : `${grade(profil.cote)} · ${texteCote(profil.cote, profil.provisoire ?? true)}`}
              onClick={() => onVue('cote')} />
            <DemiLigne icone="placement" libelle={placement?.fait && placement.kyu !== null ? t('placement.profil') : tc('cote.lignePlacement')}
              valeur={placement?.fait && placement.kyu !== null ? t('placement.profilValeur', { kyu: placement.kyu, date: dateCourte(placement.date) }) : undefined}
              onClick={onPlacement} />
          </div>
        ) : onPlacement && (placement?.fait && placement.kyu !== null
          ? <LigneLien icone={<IconeReglage id="placement" />} libelle={t('placement.profil')} valeur={t('placement.profilValeur', { kyu: placement.kyu, date: dateCourte(placement.date) })} onClick={onPlacement} />
          : <LigneLien icone={<IconeReglage id="placement" />} libelle={t(placement?.fait ? 'placement.profilRefaire' : 'placement.profilFaire')} onClick={onPlacement} />)}
        {/* #368 : « Statistiques » ; #369 : « Ta semaine » : les deux lectures de ta progression partagent une ligne (deux
            moitiés) ; « Réglages » rejoint « Mon compte » plus bas : le Profil tient toujours sans défiler en 390 × 844.
            #372 : « Étudier une position » est dans « Mes parties », à côté de « Analyser une partie jouée ailleurs ». */}
        <div className="ligne ligne-double">
          <DemiLigne icone="semaine" libelle={te('semaine.ligne')} valeur={te('semaine.ligneValeur', { n: atteints })} onClick={() => onVue('semaine')} testId="ligne-semaine" />
          <DemiLigne icone="stats" libelle={tk('stats.ligne')} valeur={tk('stats.ligneValeur')} testId="ligne-stats" onClick={() => onVue('stats')} />
        </div>
        {/* #36 : rappel du Go du jour, dès que le rappel est configuré (clé publique VAPID). */}
        {clePubliqueVapid() !== '' && <LigneLien icone={<IconeReglage id="rappel" />} libelle={t('profil.rappel')} valeur={resumeRappel()} onClick={() => onVue('rappel')} />}
        {proposerInstallation && <LigneLien icone={<IconeReglage id="installer" />} libelle={t('profil.installer')} onClick={() => onVue('installer')} />}
        {/* #369 : « Réglages » et « Mon compte » partagent une ligne (deux moitiés, ce qui te concerne toi et l'app). */}
        <div className="ligne ligne-double">
          <DemiLigne icone="reglages" libelle={t('profil.reglages')} valeur={t('profil.reglagesResume')} onClick={() => onVue('reglages')} />
          <DemiLigne icone="compte" libelle={t('profil.compte')} valeur={profil?.pseudo ?? (profil ? undefined : t('profil.seConnecter'))} onClick={() => onVue('compte')} />
        </div>
        {/* #363 : « Nous écrire » partage la ligne des conditions (deux moitiés) : le Profil tient toujours sans défiler. */}
        {amis ? (
          <div className="ligne ligne-double">
            <DemiLigne icone="ecrire" libelle={tsec('signaler.ecrire')} valeur={tsec('signaler.ecrireDetail')} testId="ligne-ecrire" onClick={() => setEcrire(true)} />
            <DemiLigne icone="conditions" libelle={t('profil.conditions')} onClick={() => onVue('conditions')} />
          </div>
        ) : <LigneLien icone={<IconeReglage id="conditions" />} libelle={t('profil.conditions')} onClick={() => onVue('conditions')} />}
      </div>
      {amis && <FeuilleSignaler db={amis.db} ouvert={ecrire} onFermer={() => setEcrire(false)} cible={{ type: 'ecrire' }} compte={amis.compte} onCompte={amis.onCompte} />}
    </div>
  );
}

/** Moitié d'une ligne du Profil (#359) : icône, libellé, valeur dessous, 48 px de haut. */
function DemiLigne({ icone, libelle, valeur, onClick, testId }: { icone: IconeReglageId; libelle: string; valeur?: ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button type="button" className="ligne-demi" onClick={onClick} data-testid={testId}>
      <LigneIcone><IconeReglage id={icone} /></LigneIcone>
      <span className="ligne-demi-texte">
        <span className="ligne-libelle">{libelle}</span>
        {valeur && <span className="ligne-demi-valeur">{valeur}</span>}
      </span>
    </button>
  );
}

/**
 * Réglages (sous-vue depuis #214), groupés avec une icône par ligne (#103) : apparence, plateau, pendant la partie,
 * rythme, progression, sons et fêtes. #365 : un aperçu du goban en tête montre chaque changement de l'apparence et du
 * plateau ; l'écran défile, groupé par titres. Chaque changement est mesuré (`reglage_change`, propriété `cle`).
 */
function Reglages({ settings, set }: Pick<Props, 'settings' | 'set'>) {
  const regler = <K extends keyof Settings>(cle: K, valeur: Settings[K]) => {
    set({ [cle]: valeur } as Partial<Settings>);
    track(EVENTS.reglageChange, { cle, valeur: String(valeur) });
  };
  return (
    <div className="profil profil-reglages">
      <ApercuPlateau settings={settings} />
      <h3 className="lignes-titre">{t('profil.groupe.apparence')}</h3>
      <div className="lignes">
        <LigneLangue />
        <LigneChoix icone={<IconeReglage id="theme" />} libelle={t('profil.theme')} options={themes()} valeur={settings.theme} onChange={v => regler('theme', v)} />
        <LigneGoban />
      </div>
      <h3 className="lignes-titre">{tk('reglages.groupe.plateau')}</h3>
      <div className="lignes">
        <LigneInterrupteur icone={<IconeReglage id="coordonnees" />} libelle={tk('reglages.coordonnees')} aide={tk('reglages.coordonneesAide')} actif={settings.coordonnees} onChange={v => regler('coordonnees', v)} />
        <LigneInterrupteur icone={<IconeReglage id="dernier" />} libelle={tk('reglages.dernierCoup')} aide={tk('reglages.dernierCoupAide')} actif={settings.dernierCoup} onChange={v => regler('dernierCoup', v)} />
        <LigneInterrupteur icone={<IconeReglage id="numeros" />} libelle={tk('reglages.numeros')} aide={tk('reglages.numerosAide')} actif={settings.numerosRevue} onChange={v => regler('numerosRevue', v)} />
      </div>
      <h3 className="lignes-titre">{t('profil.groupe.jeu')}</h3>
      <div className="lignes">
        <LigneInterrupteur icone={<IconeReglage id="confirmer" />} libelle={t('profil.confirmer')} aide={t('profil.confirmerAide')} actif={settings.confirmTouch} onChange={v => regler('confirmTouch', v)} />
        <LigneChoix icone={<IconeReglage id="aide" />} libelle={t('profil.aide')} options={aides()} valeur={settings.aide} onChange={a => regler('aide', a)} />
      </div>
      <h3 className="lignes-titre">{tk('reglages.groupe.rythme')}</h3>
      <div className="lignes">
        <LigneCadence valeur={settings.cadence} onChange={c => regler('cadence', c)} />
      </div>
      <h3 className="lignes-titre">{tk('reglages.groupe.progression')}</h3>
      <div className="lignes">
        <LigneInterrupteur icone={<IconeReglage id="serie" />} libelle={tk('reglages.serie')} aide={tk('reglages.serieAide')} actif={settings.serieVisible} onChange={v => regler('serieVisible', v)} />
      </div>
      <h3 className="lignes-titre">{t('profil.groupe.sons')}</h3>
      <div className="lignes">
        <LigneBascules icone={<IconeReglage id="sons" />} libelle={t('profil.sons')} bascules={[
          // #165 : un aperçu à l'allumage, le claquement de pierre ou une petite vibration.
          { libelle: t('profil.son'), actif: settings.sound, onChange: v => { regler('sound', v); if (v) setTimeout(() => playStone(40, 9), 0); } },
          { libelle: t('profil.vibrations'), actif: settings.vibrations, onChange: v => { regler('vibrations', v); if (v) setTimeout(hapticStone, 0); } },
        ]} />
        <LigneInterrupteur icone={<IconeReglage id="celebrations" />} libelle={t('profil.celebrations')} aide={t('profil.celebrationsAide')} actif={settings.celebrations} onChange={v => regler('celebrations', v)} />
      </div>
      <LigneVersion />
    </div>
  );
}

/** Position de l'aperçu (#365) : 9 × 9, six coups, le dernier en E5. Index y * 9 + x. */
const APERCU_COUPS = [2 * 9 + 2, 6 * 9 + 6, 6 * 9 + 2, 2 * 9 + 6, 3 * 9 + 5, 4 * 9 + 4] as const;
const APERCU_PLATEAU = (() => { const b = new Int8Array(81); APERCU_COUPS.forEach((p, i) => { b[p] = i % 2 ? 2 : 1; }); return b; })();
const APERCU_NUMEROS: ReadonlyMap<number, number> = new Map(APERCU_COUPS.map((p, i) => [p, i + 1]));

/** Aperçu du goban (#365) : thème, coordonnées, dernier coup et numéros, tels que les Réglages les donnent. */
function ApercuPlateau({ settings }: { settings: Settings }) {
  return (
    <figure className="reglages-apercu" aria-label={tk('reglages.apercuAria')} data-testid="reglages-apercu">
      <Board size={9} board={APERCU_PLATEAU} marks={{ last: settings.dernierCoup ? APERCU_COUPS[APERCU_COUPS.length - 1] : null }}
        coordonnees={settings.coordonnees} numeros={settings.numerosRevue ? APERCU_NUMEROS : null} />
      <figcaption className="muted small" aria-hidden="true">{tk('reglages.apercu')}</figcaption>
    </figure>
  );
}

/** Temps de jeu proposé d'abord pour une partie en ligne (#365) : 5, 10 ou 20 minutes chacun. */
function LigneCadence({ valeur, onChange }: { valeur: Settings['cadence']; onChange: (c: Settings['cadence']) => void }) {
  return (
    <div className="ligne ligne-choix" role="group" aria-label={tk('reglages.cadence')}>
      <LigneIcone><IconeReglage id="cadence" /></LigneIcone>
      <span className="ligne-libelle" aria-hidden="true">{tk('reglages.cadence')}</span>
      <span className="seg">
        {CADENCES_ORDRE.map(c => (
          <button type="button" key={c} aria-pressed={valeur === c} onClick={() => onChange(c)}
            aria-label={tk('reglages.cadenceAria', { min: CADENCES[c].mainMs / 60_000 })}>{tk(`reglages.cadence.${c}`)}</button>
        ))}
      </span>
    </div>
  );
}

/** Touchers rapprochés (4 s au plus entre le premier et le dernier) qui basculent le drapeau de l'équipe. */
const TOUCHERS_EQUIPE = 7;

/**
 * Version de l'app (#437), en bas des réglages. Réglage caché : 7 touchers rapprochés basculent le drapeau
 * « appareil de l'équipe » (src/data/analytics.ts, `setEquipe`), qui coupe PostHog et les compteurs anonymes.
 */
function LigneVersion() {
  const equipe = useSyncExternalStore(subscribeConsent, estEquipe, () => false);
  const touchers = useRef<number[]>([]);
  const toucher = () => {
    const maintenant = Date.now();
    touchers.current = [...touchers.current.filter(d => maintenant - d < 4000), maintenant];
    if (touchers.current.length < TOUCHERS_EQUIPE) return;
    touchers.current = [];
    setEquipe(!estEquipe());
  };
  return (
    <p className="profil-version">
      <button type="button" data-testid="version-app" onClick={toucher}>{t('profil.version', { v: analyticsConfig().release.slice(0, 7) })}</button>
      <span role="status">{equipe ? t('profil.equipe') : ''}</span>
    </p>
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
      <LigneIcone><IconeReglage id="langue" /></LigneIcone>
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
      <LigneIcone><IconeReglage id="goban" /></LigneIcone>
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

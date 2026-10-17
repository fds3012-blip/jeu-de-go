// #605 (lot N0) : modèle de navigation, une pile par onglet. Règles A2, A3, A4, A7, A8 et A12 de DESIGN.md.
import { describe, expect, it } from 'vitest';
import {
  ACTIVITES, BLOQUANTS, FEUILLES, ONGLETS_ORDRE, changerOnglet, courant, estActivite, estFeuille, estRacine, navigationInitiale,
  ongletDe, ouvrir, profondeur, racine, retour, type Ecran, type Navigation,
} from './navigation';

/** Ouvre plusieurs écrans d'affilée. */
const suite = (nav: Navigation, ...ecrans: (Ecran | [Ecran, string])[]) =>
  ecrans.reduce((n, e) => ouvrir(n, Array.isArray(e) ? { ecran: e[0], id: e[1] } : { ecran: e }), nav);
const ecrans = (nav: Navigation, o = nav.onglet) => nav.piles[o].map(e => (e.id ? `${e.ecran}:${e.id}` : e.ecran));

/**
 * Tous les écrans de l'inventaire (§ 3 du document d'architecture), une fois chacun. `Record<Ecran, …>` : un écran
 * ajouté au type sans être listé ici (ou l'inverse) ne compile pas.
 */
const INVENTAIRE: Record<Ecran, 0> = {
  jouer: 0, apprendre: 0, problemes: 0, profil: 0,
  question_go: 0, feuille_changer: 0, feuille_plus: 0, en_ligne_direct: 0, en_ligne_lente: 0, partie_ordi: 0, partie_deux: 0,
  partie_direct: 0, partie_defi: 0, revue: 0, rejouer_erreurs: 0, placement: 0, defis: 0, defi_arrivee: 0, partie_partagee: 0,
  seance_revisions: 0,
  intro_regles: 0, partie_decouverte: 0, partie_guidee: 0, lecon: 0, serie_lecon: 0, theme: 0, ouvertures: 0, ouverture: 0,
  probleme: 0, course: 0, series_theme: 0, serie_theme: 0, tous_problemes: 0,
  mes_parties: 0, importer: 0, etude: 0, amis: 0, joueur: 0, cote: 0, semaine: 0, stats: 0, rappel: 0, installer: 0, reglages: 0,
  compte: 0, donnees: 0, mentions: 0, conditions: 0,
  creer_compte: 0, pseudo: 0, accord_conditions: 0, aide: 0, feuille_partager: 0, feuille_ecrire: 0, feuille_partage_partie: 0,
  repli_hors_ligne: 0, consentement: 0,
};
const TOUS = Object.keys(INVENTAIRE) as Ecran[];

describe('navigation : inventaire des écrans (#605)', () => {
  it('quatre racines, dans l’ordre de la barre du bas (A1)', () => {
    expect(ONGLETS_ORDRE).toEqual(['jouer', 'apprendre', 'problemes', 'profil']);
    expect(TOUS.filter(estRacine)).toEqual(['jouer', 'apprendre', 'problemes', 'profil']);
  });

  it('chaque écran a une seule maison, ou se pose par-dessus (A2)', () => {
    const maisons = Object.fromEntries(TOUS.map(e => [e, ongletDe(e)]));
    expect(TOUS).toHaveLength(57);
    // Identifiants stables, aussi valeurs de la propriété `ecran` du suivi : minuscules et tirets bas.
    for (const e of TOUS) expect(e).toMatch(/^[a-z]+(_[a-z]+)*$/);
    expect(maisons).toMatchObject({
      jouer: 'jouer', apprendre: 'apprendre', problemes: 'problemes', profil: 'profil',
      feuille_changer: 'jouer', partie_ordi: 'jouer', placement: 'jouer', seance_revisions: 'jouer', partie_partagee: 'jouer',
      partie_guidee: 'apprendre', partie_decouverte: 'apprendre', intro_regles: 'apprendre', lecon: 'apprendre', ouverture: 'apprendre',
      probleme: 'problemes', course: 'problemes', tous_problemes: 'problemes',
      reglages: 'profil', joueur: 'profil', mentions: 'profil', conditions: 'profil',
      creer_compte: null, pseudo: null, accord_conditions: null, aide: null, consentement: null, repli_hors_ligne: null,
    });
  });

  it('les familles : feuilles, activités, écrans bloquants', () => {
    for (const e of FEUILLES) expect(TOUS).toContain(e);
    for (const e of ACTIVITES) expect(TOUS).toContain(e);
    for (const e of BLOQUANTS) expect(TOUS).toContain(e);
    expect(estFeuille('aide')).toBe(true);
    expect(estFeuille('feuille_changer')).toBe(true);
    expect(estFeuille('reglages')).toBe(false);
    expect(estActivite('partie_direct')).toBe(true);
    expect(estActivite('lecon')).toBe(true);
    expect(estActivite('placement')).toBe(true);
    expect(estActivite('apprendre')).toBe(false);
    expect(estActivite('reglages')).toBe(false);
    // Aucune racine n'est une activité ou une feuille.
    for (const o of ONGLETS_ORDRE) { expect(estActivite(o)).toBe(false); expect(estFeuille(o)).toBe(false); }
  });
});

describe('navigation : piles par onglet', () => {
  it('au lancement : chaque onglet sur sa racine, profondeur 0 sur Jouer', () => {
    const nav = navigationInitiale();
    expect(nav.onglet).toBe('jouer');
    for (const o of ONGLETS_ORDRE) expect(nav.piles[o]).toEqual([racine(o)]);
    expect(courant(nav)).toEqual({ ecran: 'jouer' });
    expect(profondeur(nav)).toBe(0);
  });

  it('un lien peut ouvrir l’app sur un autre onglet (Go du jour, politique)', () => {
    const nav = navigationInitiale('problemes');
    expect(courant(nav)).toEqual({ ecran: 'problemes' });
    expect(profondeur(nav)).toBe(1);
  });

  it('ouvrir empile sur l’onglet courant, sans en changer (A3)', () => {
    const nav = suite(navigationInitiale('profil'), 'compte', 'donnees');
    expect(nav.onglet).toBe('profil');
    expect(ecrans(nav)).toEqual(['profil', 'compte', 'donnees']);
    expect(profondeur(nav)).toBe(3);
    // Raccourci : une leçon ouverte depuis la fin d'une partie se pose sur Jouer.
    const n2 = suite(navigationInitiale(), 'partie_ordi', ['lecon', 'atari']);
    expect(n2.onglet).toBe('jouer');
    expect(ecrans(n2)).toEqual(['jouer', 'partie_ordi', 'lecon:atari']);
    expect(ecrans(n2, 'apprendre')).toEqual(['apprendre']);
  });

  it('ouvrir une racine change d’onglet', () => {
    const nav = ouvrir(suite(navigationInitiale(), 'defis'), { ecran: 'profil' });
    expect(nav.onglet).toBe('profil');
    expect(ecrans(nav, 'jouer')).toEqual(['jouer', 'defis']);
  });

  it('le même écran deux fois de suite n’empile qu’une fois (double toucher)', () => {
    const nav = suite(navigationInitiale('apprendre'), ['lecon', 'atari'], ['lecon', 'atari']);
    expect(ecrans(nav)).toEqual(['apprendre', 'lecon:atari']);
    // Une autre leçon s'empile (« Leçon suivante » remplacera la sienne en N2, ici elle s'empile).
    expect(ecrans(ouvrir(nav, { ecran: 'lecon', id: 'ko' }))).toEqual(['apprendre', 'lecon:atari', 'lecon:ko']);
  });

  it('un profil remplace un profil : pas de pile sans fond (A4)', () => {
    const nav = suite(navigationInitiale('profil'), 'amis', ['joueur', 'Ana'], ['joueur', 'Bo'], ['joueur', 'Cy']);
    expect(ecrans(nav)).toEqual(['profil', 'amis', 'joueur:Cy']);
    expect(retour(nav).nav.piles.profil.map(e => e.ecran)).toEqual(['profil', 'amis']);
  });

  it('une feuille remplace une feuille (A12)', () => {
    const nav = suite(navigationInitiale(), 'feuille_plus', 'aide');
    expect(ecrans(nav)).toEqual(['jouer', 'aide']);
    // Une feuille sur un écran s'empile normalement.
    expect(ecrans(suite(navigationInitiale('profil'), 'reglages', 'aide'))).toEqual(['profil', 'reglages', 'aide']);
  });

  it('ouvrir ne touche jamais aux piles des autres onglets', () => {
    const avant = suite(navigationInitiale('apprendre'), 'ouvertures');
    const apres = ouvrir(changerOnglet(avant, 'profil'), { ecran: 'reglages' });
    expect(apres.piles.apprendre).toBe(avant.piles.apprendre);
    expect(apres.piles.jouer).toBe(avant.piles.jouer);
    expect(apres.piles.problemes).toBe(avant.piles.problemes);
  });

  it('ne modifie pas la navigation reçue (pur)', () => {
    const nav = suite(navigationInitiale('profil'), 'reglages');
    const copie = JSON.stringify(nav);
    ouvrir(nav, { ecran: 'compte' });
    retour(nav);
    changerOnglet(nav, 'jouer');
    changerOnglet(nav, 'profil');
    expect(JSON.stringify(nav)).toBe(copie);
  });
});

describe('navigation : changer d’onglet (A8)', () => {
  it('l’onglet quitté garde sa pile ; on la retrouve en revenant', () => {
    let nav = suite(navigationInitiale('apprendre'), ['lecon', 'atari']);
    nav = changerOnglet(nav, 'problemes');
    nav = ouvrir(nav, { ecran: 'probleme', id: 'p12' });
    nav = changerOnglet(nav, 'apprendre');
    expect(courant(nav)).toEqual({ ecran: 'lecon', id: 'atari' });
    nav = changerOnglet(nav, 'problemes');
    expect(courant(nav)).toEqual({ ecran: 'probleme', id: 'p12' });
  });

  it('toucher l’onglet actif ramène à sa racine (les quatre onglets)', () => {
    for (const o of ONGLETS_ORDRE) {
      const nav = changerOnglet(suite(navigationInitiale(o), o === 'profil' ? 'reglages' : 'aide', 'aide'), o);
      expect(ecrans(nav)).toEqual([o]);
      expect(nav.onglet).toBe(o);
    }
  });

  it('toucher l’onglet actif à sa racine ne change rien', () => {
    const nav = navigationInitiale('problemes');
    expect(changerOnglet(nav, 'problemes')).toBe(nav);
  });

  it('une feuille ouverte ne survit pas au changement d’onglet', () => {
    const nav = changerOnglet(suite(navigationInitiale(), 'defis', 'feuille_partager'), 'profil');
    expect(ecrans(nav, 'jouer')).toEqual(['jouer', 'defis']);
  });
});

describe('navigation : retour (A7)', () => {
  it('dépile l’écran du haut', () => {
    const r = retour(suite(navigationInitiale('profil'), 'compte', 'donnees'));
    expect(r.effet).toBe('depile');
    expect(ecrans(r.nav)).toEqual(['profil', 'compte']);
  });

  it('une feuille se ferme d’abord', () => {
    const r = retour(suite(navigationInitiale(), 'partie_ordi', 'aide'));
    expect(r.effet).toBe('depile');
    expect(courant(r.nav)).toEqual({ ecran: 'partie_ordi' });
  });

  it('à la racine d’Apprendre, de Problèmes ou du Profil : retour à Jouer, sa pile gardée', () => {
    for (const o of ['apprendre', 'problemes', 'profil'] as const) {
      const depart = changerOnglet(suite(navigationInitiale(), 'defis'), o);
      const r = retour(depart);
      expect(r.effet).toBe('vers_jouer');
      expect(r.nav.onglet).toBe('jouer');
      expect(courant(r.nav)).toEqual({ ecran: 'defis' });
      expect(r.nav.piles[o]).toEqual([racine(o)]);
    }
  });

  it('à la racine de Jouer : le système sort, rien ne change', () => {
    const nav = navigationInitiale();
    const r = retour(nav);
    expect(r.effet).toBe('sortir');
    expect(r.nav).toBe(nav);
  });

  it('un écran bloquant ne se quitte pas', () => {
    for (const e of BLOQUANTS) {
      const nav = ouvrir(navigationInitiale(), { ecran: e });
      const r = retour(nav);
      expect(r.effet).toBe('bloque');
      expect(r.nav).toBe(nav);
    }
  });

  it('profondeur = nombre de retours avant que le système ne sorte', () => {
    const cas: Navigation[] = [
      navigationInitiale(),
      suite(navigationInitiale(), 'feuille_changer'),
      suite(navigationInitiale(), 'en_ligne_direct', 'partie_direct'),
      navigationInitiale('profil'),
      suite(navigationInitiale('profil'), 'reglages'),
      suite(navigationInitiale('profil'), 'compte', 'donnees', 'aide'),
      suite(navigationInitiale('apprendre'), 'theme', ['lecon', 'atari']),
    ];
    for (const depart of cas) {
      let nav = depart, n = 0;
      for (let r = retour(nav); r.effet !== 'sortir'; r = retour(nav)) { nav = r.nav; n++; expect(n).toBeLessThan(20); }
      expect(n, ecrans(depart).join(' › ')).toBe(profondeur(depart));
      expect(courant(nav)).toEqual({ ecran: 'jouer' });
    }
  });
});

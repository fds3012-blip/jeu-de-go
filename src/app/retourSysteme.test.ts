// #606 (N1) : la garde d'historique du retour du système, avec un historique, une fenêtre et un document simulés.
// Parcours complets dans le vrai navigateur : e2e/retour-systeme.spec.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const suivis: { nom: string; props: unknown }[] = [];
vi.mock('../data/analytics', () => ({
  EVENTS: { retourSysteme: 'retour_systeme' },
  track: (nom: string, props: unknown) => { suivis.push({ nom, props }); },
}));

const { brancherRetourSysteme, ecranDe, faireRetour } = await import('./retourSysteme');
type Branchement = Parameters<typeof brancherRetourSysteme>[0] extends () => infer B ? B : never;

/** Tâches en attente (popstate, requestAnimationFrame, setTimeout) : jouées par `vider`. */
let file: (() => void)[] = [];
async function vider() {
  for (let n = 0; file.length && n < 100; n++) { const f = file.shift()!; f(); await Promise.resolve(); }
}

class Fenetre {
  ecouteurs = new Map<string, Set<(e: unknown) => void>>();
  addEventListener(t: string, f: (e: unknown) => void) { if (!this.ecouteurs.has(t)) this.ecouteurs.set(t, new Set()); this.ecouteurs.get(t)!.add(f); }
  removeEventListener(t: string, f: (e: unknown) => void) { this.ecouteurs.get(t)?.delete(f); }
  emettre(t: string, e: unknown) { for (const f of [...(this.ecouteurs.get(t) ?? [])]) f(e); }
  requestAnimationFrame(f: () => void) { file.push(f); return file.length; }
  cancelAnimationFrame() {}
  setTimeout(f: () => void) { file.push(f); return 0; }
  location = { hash: '' };
}

/** Historique du navigateur : `back` est asynchrone, comme le vrai ; avant la première entrée, l'app est quittée. */
class Historique {
  entrees: { state: unknown }[] = [{ state: null }];
  i = 0;
  sortie = false;
  constructor(private w: Fenetre) {}
  get state() { return this.entrees[this.i].state; }
  get length() { return this.entrees.length; }
  pushState(s: unknown) { this.entrees.splice(this.i + 1); this.entrees.push({ state: s }); this.i++; }
  replaceState(s: unknown) { this.entrees[this.i] = { state: s }; }
  back() {
    file.push(() => {
      if (this.i === 0) { this.sortie = true; return; }
      this.i--;
      this.w.emettre('popstate', { state: this.state });
    });
  }
  /** Lien `#defi=` ouvert dans l'onglet : nouvelle entrée sans état, puis `popstate`. */
  /** Comme le navigateur : `popstate`, puis `hashchange`, où l'app retire le fragment de l'adresse. */
  lien() {
    this.w.location.hash = '#defi=abc'; this.pushState(null); this.w.emettre('popstate', { state: null });
    this.w.location.hash = ''; this.w.emettre('hashchange', {});
  }
}

/** Document : une fenêtre `<dialog>` ouverte et un bouton « ‹ », ou rien. */
const dom = {
  /** `modale: false` : bandeau ouvert par `show()` (consentement). */
  fenetre: null as null | { cancel: boolean; fermee: boolean; modale?: boolean },
  boutonRetour: null as null | (() => void),
};
function element(clic?: () => void) { return { getClientRects: () => [1], click: clic ?? (() => {}) }; }
const documentFaux = {
  body: {},
  querySelector(sel: string) {
    if (sel.includes('.retour') && dom.boutonRetour) return {};
    return null;
  },
  querySelectorAll(sel: string) {
    if (sel === 'dialog[open]') {
      const f = dom.fenetre;
      if (!f || f.fermee) return [];
      return [{ dispatchEvent: () => !f.cancel, close: () => { f.fermee = true; }, matches: (m: string) => m === ':modal' && f.modale !== false }];
    }
    if (sel.startsWith('.retour') && dom.boutonRetour) return [element(dom.boutonRetour)];
    return [];
  },
};

let w: Fenetre, h: Historique;
/** L'app simulée : l'écran courant, comme une pile ; la racine de Jouer est `['jouer']`. */
let pile: string[];
const sorties: string[] = [];
const lire = (): Branchement => ({
  horsRacine: () => pile.length > 1 || pile[0] !== 'jouer',
  repli: () => { sorties.push('repli'); if (pile[0] !== 'jouer') pile = ['jouer']; },
  // L'écran du haut, comme une vue du Profil : `ecranDe` la reprend telle quelle.
  etat: () => [{ quoi: 'onglet', onglet: 'profil' }, 'profil', pile[pile.length - 1], false, false, false, false, false, false],
});
/** Ouvre un écran par-dessus : son bouton « ‹ » dépile. */
function ouvrirEcran(e: string) {
  pile = [...pile, e];
  dom.boutonRetour = () => { sorties.push(`‹ ${pile[pile.length - 1]}`); pile = pile.slice(0, -1); if (pile.length === 1) dom.boutonRetour = null; };
}

beforeEach(() => {
  file = []; suivis.length = 0; sorties.length = 0;
  dom.fenetre = null; dom.boutonRetour = null;
  w = new Fenetre(); h = new Historique(w); pile = ['jouer'];
  vi.stubGlobal('document', documentFaux);
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { vi.unstubAllGlobals(); });

function brancher() {
  const r = brancherRetourSysteme(lire, h as unknown as History, w as unknown as Window);
  return { ...r, verifier: async () => { r.verifier(); await vider(); } };
}
const retourSysteme = async () => { h.back(); await vider(); };

describe('retour du système (#606)', () => {
  it('à la racine de Jouer : aucune entrée en plus, le retour sort de l’app', async () => {
    brancher();
    await vider();
    expect(h.length).toBe(1);
    expect(h.state).toMatchObject({ mochiNav: 0, garde: false });
    await retourSysteme();
    expect(h.sortie).toBe(true);
    expect(suivis).toEqual([]);
  });

  it('un écran ouvert pose une garde ; le retour fait « ‹ », puis retire la garde à la racine', async () => {
    const r = brancher();
    ouvrirEcran('reglages');
    await r.verifier();
    expect(h.i).toBe(1);
    expect(h.state).toMatchObject({ garde: true });
    await retourSysteme();
    expect(sorties).toEqual(['‹ reglages']);
    expect(suivis).toEqual([{ nom: 'retour_systeme', props: { ecran: 'reglages' } }]);
    expect(pile).toEqual(['jouer']);
    // Revenu à la racine : la garde reposée par précaution est retirée ; le retour suivant sort.
    expect(h.i).toBe(0);
    await retourSysteme();
    expect(h.sortie).toBe(true);
  });

  it('chaque retour fait un « ‹ » jusqu’à Jouer : Profil › Mon compte › Mes données', async () => {
    const r = brancher();
    pile = ['profil'];
    ouvrirEcran('compte');
    ouvrirEcran('donnees');
    await r.verifier();
    await retourSysteme();
    await retourSysteme();
    expect(pile).toEqual(['profil']);
    expect(h.state).toMatchObject({ garde: true });
    await retourSysteme();
    expect(sorties).toEqual(['‹ donnees', '‹ compte', 'repli']);
    expect(pile).toEqual(['jouer']);
    expect(h.i).toBe(0);
    expect(h.sortie).toBe(false);
  });

  it('deux retours rapides : la garde revient avant le second, l’app ne se ferme pas', async () => {
    const r = brancher();
    pile = ['profil'];
    ouvrirEcran('reglages');
    await r.verifier();
    h.back();
    h.back();
    await vider();
    expect(h.sortie).toBe(false);
    expect(sorties).toEqual(['‹ reglages', 'repli']);
    expect(pile).toEqual(['jouer']);
  });

  it('une feuille se ferme d’abord, comme par Échap ; une feuille qui refuse reste ouverte', async () => {
    const r = brancher();
    ouvrirEcran('reglages');
    dom.fenetre = { cancel: false, fermee: false };
    await r.verifier();
    await retourSysteme();
    expect(dom.fenetre.fermee).toBe(true);
    expect(sorties).toEqual([]);
    expect(pile).toEqual(['jouer', 'reglages']);
    dom.fenetre = { cancel: true, fermee: false };
    faireRetour(lire());
    expect(dom.fenetre.fermee).toBe(false);
  });

  it('un lien ouvert dans l’onglet (nouvelle entrée sans état) n’est pas pris pour un retour', async () => {
    const r = brancher();
    ouvrirEcran('reglages');
    await r.verifier();
    h.lien();
    await vider();
    expect(sorties).toEqual([]);
    // L'entrée du lien devient une entrée de l'app (rang 2) ; l'écran ouvert y repose sa garde (rang 3).
    expect(h.entrees[2].state).toMatchObject({ mochiNav: 2, garde: false });
    expect(h.state).toMatchObject({ garde: true, mochiNav: 3 });
    await retourSysteme();
    expect(sorties).toEqual(['‹ reglages']);
  });

  it('fragment vidé par supabase-js au retour d’un fournisseur (`#`, nouvelle entrée) : pas un retour', async () => {
    const r = brancher();
    pile = ['jouer'];
    dom.boutonRetour = () => { sorties.push('‹ compte'); };
    await r.verifier();
    expect(h.state).toMatchObject({ garde: true, mochiNav: 1 });
    h.pushState(null);
    w.emettre('popstate', { state: null });
    await vider();
    expect(sorties).toEqual([]);
    expect(h.entrees[2].state).toMatchObject({ mochiNav: 2, garde: false });
    expect(h.state).toMatchObject({ garde: true, mochiNav: 3 });
  });

  it('retrait de la garde : jamais pendant un départ de la page (navigation interrompue)', async () => {
    const r = brancher();
    ouvrirEcran('reglages');
    await r.verifier();
    expect(h.i).toBe(1);
    dom.boutonRetour!();
    r.verifier();
    w.emettre('beforeunload', {});
    await vider();
    expect(h.i).toBe(1);
  });

  it('bandeau non modal à la racine de Jouer (consentement) : ni garde ni retrait, le retour le laisse (#638)', async () => {
    const r = brancher();
    dom.fenetre = { cancel: false, fermee: false, modale: false };
    await r.verifier();
    expect(h.length).toBe(1);
    expect(h.state).toMatchObject({ garde: false });
    // Réponse au bandeau : rien à retirer, donc aucun `history.back()` qui couperait un rechargement.
    dom.fenetre.fermee = true;
    await r.verifier();
    expect(h.length).toBe(1);
    expect(h.i).toBe(0);
    // Sur un autre écran, le retour ne ferme pas le bandeau : il fait « ‹ ».
    dom.fenetre = { cancel: false, fermee: false, modale: false };
    ouvrirEcran('reglages');
    await r.verifier();
    await retourSysteme();
    expect(dom.fenetre.fermee).toBe(false);
    expect(sorties).toEqual(['‹ reglages']);
  });

  it('rechargement sur une garde : l’entrée devient celle de l’app', async () => {
    h.replaceState({ mochiNav: 4, garde: true });
    brancher();
    await vider();
    expect(h.state).toMatchObject({ mochiNav: 0, garde: false });
    expect(h.length).toBe(1);
  });

  it('Échap fait le retour, sauf fenêtre ouverte, champ de saisie, ou touche déjà prise', async () => {
    const r = brancher();
    pile = ['profil'];
    ouvrirEcran('reglages');
    await r.verifier();
    const touche = (e: Partial<KeyboardEvent> & { defaultPrevented?: boolean }) => w.emettre('keydown', { key: 'Escape', repeat: false, defaultPrevented: false, target: null, ...e });
    touche({ target: { tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget });
    touche({ defaultPrevented: true });
    await vider();
    expect(sorties).toEqual([]);
    touche({});
    await vider();
    expect(sorties).toEqual(['‹ reglages']);
    expect(suivis.at(-1)).toEqual({ nom: 'retour_systeme', props: { ecran: 'reglages' } });
    touche({});
    await vider();
    expect(pile).toEqual(['jouer']);
    // À la racine de Jouer : rien.
    touche({});
    await vider();
    expect(sorties).toEqual(['‹ reglages', 'repli']);
  });

  it('arreter : plus d’écoute', async () => {
    const r = brancher();
    r.arreter();
    ouvrirEcran('reglages');
    w.emettre('popstate', { state: { mochiNav: 0 } });
    await vider();
    expect(sorties).toEqual([]);
  });

  it('ecranDe : l’identifiant de l’écran pour le suivi', () => {
    const non = [false, false, false, false, false, false] as const;
    const e = (t: Parameters<typeof ecranDe>[0][0], onglet: 'jouer' | 'apprendre' | 'problemes' | 'profil' = 'jouer', vue = 'menu', ...f: boolean[]) =>
      ecranDe([t, onglet, vue, ...([...f, ...non].slice(0, 6) as [boolean, boolean, boolean, boolean, boolean, boolean])]);
    expect(e({ quoi: 'accueil' })).toBe('jouer');
    expect(e({ quoi: 'accueil' }, 'jouer', 'menu', false, false, false, false, true)).toBe('feuille_changer');
    expect(e({ quoi: 'accueil' }, 'jouer', 'menu', true)).toBe('aide');
    expect(e({ quoi: 'partie', contre: 'Pomme' })).toBe('partie_ordi');
    expect(e({ quoi: 'partie', contre: null })).toBe('partie_deux');
    expect(e({ quoi: 'partie', contre: 'Mochi', guidee: true })).toBe('partie_guidee');
    expect(e({ quoi: 'direct' }, 'jouer', 'menu', false, false, false, true)).toBe('partie_direct');
    expect(e({ quoi: 'direct' })).toBe('en_ligne_direct');
    expect(e({ quoi: 'enLigne' })).toBe('partie_defi');
    expect(e({ quoi: 'placement' })).toBe('placement');
    expect(e({ quoi: 'revisions' })).toBe('seance_revisions');
    expect(e({ quoi: 'lecon', titre: 'Atari' }, 'apprendre')).toBe('lecon');
    expect(e({ quoi: 'lecon', titre: 'Atari' }, 'apprendre', 'menu', false, false, true)).toBe('theme');
    expect(e({ quoi: 'lecon', titre: 'Règles' }, 'jouer', 'menu', false, false, false, false, false, true)).toBe('intro_regles');
    expect(e({ quoi: 'onglet', onglet: 'apprendre' }, 'apprendre', 'menu', false, true)).toBe('serie_lecon');
    expect(e({ quoi: 'onglet', onglet: 'problemes' }, 'problemes')).toBe('problemes');
    expect(e({ quoi: 'onglet', onglet: 'profil' }, 'profil')).toBe('profil');
    expect(e({ quoi: 'onglet', onglet: 'profil' }, 'profil', 'parties')).toBe('mes_parties');
    expect(e({ quoi: 'onglet', onglet: 'profil' }, 'profil', 'reglages')).toBe('reglages');
    expect(e({ quoi: 'compte' })).toBe('creer_compte');
  });
});

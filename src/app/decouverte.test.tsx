// Partie de découverte (#524) : progression par notions, sauvegarde sur l'appareil (reprise), textes dans la langue de
// l'interface, et premier rendu de l'écran (une seule action principale, progression visible, reprise annoncée).
import { renderToStaticMarkup } from 'react-dom/server';
import { NOTIONS, SCENARIO } from '../content/decouverte';
import { choisirLangue } from '../content/i18n';
import { AVANCEMENT_VIDE, DECOUVERTE_KEY, avancer, cleErreur, lireAvancement, progression, td, terminer } from './decouverte';
import { etatDecouverte } from './decouverteEtat';
import { PartieDecouverte } from './PartieDecouverte';

const rendu = () => renderToStaticMarkup(<PartieDecouverte onFin={() => {}} onQuitter={() => {}} />).replace(/[\u00a0\u202f]/g, ' ');
const stock = new Map<string, string>();
beforeEach(() => {
  stock.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stock.get(k) ?? null,
    setItem: (k: string, v: string) => { stock.set(k, v); },
    removeItem: (k: string) => { stock.delete(k); },
  });
});
afterEach(() => { vi.unstubAllGlobals(); choisirLangue('fr'); });

describe('avancement gardé sur l’appareil', () => {
  it('lit une valeur absente, abîmée ou hors du scénario comme un début de partie, sans erreur', () => {
    for (const brut of [null, undefined, 'x', 3, [], {}, { etape: -1 }, { etape: 1.5 }, { etape: SCENARIO.length }, { etape: '4' }]) {
      expect(lireAvancement(brut), JSON.stringify(brut)).toEqual(AVANCEMENT_VIDE);
    }
    expect(lireAvancement({ etape: 7, fini: true })).toEqual({ etape: 7, fini: true });
    expect(lireAvancement({ etape: 7, fini: 'oui' })).toEqual({ etape: 7, fini: false });
  });

  it('avance moment par moment, garde « déjà finie », et une partie terminée se rejoue depuis le début', () => {
    let a = AVANCEMENT_VIDE;
    a = avancer(a, 5);
    expect(a).toEqual({ etape: 5, fini: false });
    expect(avancer(a, 999).etape).toBe(SCENARIO.length - 1);
    expect(terminer()).toEqual({ etape: 0, fini: true });
    // Rejouée après une première fin : on avance, mais « déjà finie » reste (l'XP ne revient pas).
    expect(avancer(terminer(), 3)).toEqual({ etape: 3, fini: true });
  });

  it('dit à Apprendre si la partie est nouvelle, en cours ou déjà finie (sans charger le scénario)', () => {
    expect(etatDecouverte(null)).toBe('nouvelle');
    expect(etatDecouverte({ etape: 0, fini: false })).toBe('nouvelle');
    expect(etatDecouverte({ etape: 4, fini: false })).toBe('encours');
    expect(etatDecouverte({ etape: 0, fini: true })).toBe('finie');
    expect(etatDecouverte({ etape: 9, fini: true })).toBe('finie');
  });
});

describe('progression par notions', () => {
  it('va de 1 / 15 au premier moment à 15 / 15 au comptage, sans jamais reculer', () => {
    expect(progression(0)).toEqual({ n: 1, total: 15, notion: 'poser' });
    expect(progression(SCENARIO.length - 1)).toEqual({ n: 15, total: 15, notion: 'comptage' });
    let avant = 0;
    for (let i = 0; i < SCENARIO.length; i++) {
      const { n } = progression(i);
      expect(n).toBeGreaterThanOrEqual(avant);
      expect(n - avant).toBeLessThanOrEqual(1);
      avant = n;
    }
    expect(NOTIONS.every((_, k) => SCENARIO.some((__, i) => progression(i).n === k + 1))).toBe(true);
  });
});

describe('textes', () => {
  it('français avec la typographie française, anglais si l’interface est en anglais', () => {
    expect(td('ecran.notions', { n: 3, total: 15 })).toBe('3 / 15 notions');
    expect(td('atari.bravo')).toBe('Atari\u202F! Ma pierre n’a plus qu’une liberté.');
    choisirLangue('en');
    expect(td('ecran.notions', { n: 3, total: 15 })).toBe('3 / 15 ideas');
    expect(td('atari.bravo')).toBe('Atari! My stone only has one liberty left.');
  });

  it('une erreur a son explication propre si le scénario en a une, sinon celle du moment', () => {
    expect(cleErreur('echelle', 'E6', ['E6'])).toBe('echelle.non.E6');
    expect(cleErreur('echelle', 'A1', ['E6'])).toBe('echelle.non');
    expect(cleErreur('poser', 'A1')).toBe('poser.non');
  });
});

describe('écran (premier rendu)', () => {
  it('début : la notion, « 1 / 15 notions », la consigne de Mochi, le point marqué, et aucun bouton à côté du plateau', () => {
    const html = rendu();
    expect(html).toContain('Poser une pierre');
    expect(html).toContain('1 / 15 notions');
    expect(html).toContain('aria-valuenow="1"');
    expect(html).toContain('Tu as Noir, tu commences.');
    expect(html).toContain('data-repere="E5"');
    expect(html).toContain('Point marqué : E5');
    expect(html).not.toContain('class="cta"');
    expect(html).toContain('aria-label="Quitter la partie de découverte"');
    expect(html).not.toContain('On reprend');
  });

  it('reprise après un rechargement : même moment, même position, et Mochi le dit', () => {
    const i = SCENARIO.findIndex(m => m.id === 'echelle');
    stock.set(DECOUVERTE_KEY, JSON.stringify({ etape: i, fini: false }));
    const html = rendu();
    expect(html).toContain('On reprend là où tu t’étais arrêté.');
    expect(html).toContain('L’échelle');
    expect(html).toContain('7 / 15 notions');
    expect(html).toContain('data-repere="F7"');
  });

  it('un moment à lire (comptage) a une seule action : « Continuer »', () => {
    stock.set(DECOUVERTE_KEY, JSON.stringify({ etape: SCENARIO.findIndex(m => m.id === 'compte2'), fini: false }));
    const html = rendu();
    expect(html.match(/class="cta"/g)).toHaveLength(1);
    expect(html).toContain('>Continuer</button>');
    expect(html).toContain('Tu en as 39.');
  });

  it('pierre morte : on n’y répond pas, l’action principale est « Passer »', () => {
    stock.set(DECOUVERTE_KEY, JSON.stringify({ etape: SCENARIO.findIndex(m => m.id === 'mort'), fini: false }));
    const html = rendu();
    expect(html.match(/class="cta"/g)).toHaveLength(1);
    expect(html).toContain('data-action="passer"');
    expect(html).toContain('>Passer</button>');
  });

  it('en anglais', () => {
    choisirLangue('en');
    const html = rendu();
    expect(html).toContain('Placing a stone');
    expect(html).toContain('1 / 15 ideas');
    expect(html).toContain('You have Black, you start.');
  });
});

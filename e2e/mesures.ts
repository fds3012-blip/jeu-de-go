import type { Page } from '@playwright/test';

// Mesures d'accessibilité et de mise en page d'un écran : défilement horizontal, cibles sous 44 px, actions principales
// (`.cta`, `.btn.primary`), contraste WCAG de chaque texte visible, textes coupés, éléments hors écran.
// Partagé par l'audit visuel (e2e/audit-visuel.spec.ts) et le parcours débutant v3 (e2e/parcours-debutant-v3.spec.ts).

export type Mesure = {
  ecran: string; theme: string; largeur: number;
  defilement: number; cibles: { texte: string; w: number; h: number }[]; principales: number;
  contrastes: { texte: string; ratio: number; couleur: string; fond: string; taille: number; gras: boolean }[];
  coupes: string[]; horsEcran: string[]; alertes: string[];
};

/** Mesures d'accessibilité et de mise en page de l'écran affiché (voir en-tête). */
export async function mesurer(page: Page, ecran: string, theme: string, largeur: number): Promise<Mesure> {
  return page.evaluate(({ ecran, theme, largeur }) => {
    // Texte réservé aux lecteurs d'écran (`.sr-only` : boîte de 1 px à débordement caché, ou découpée) : jamais vu,
    // donc ni contraste, ni cible, ni texte coupé à mesurer.
    const lecteurSeul = (el: Element) => {
      for (let e: Element | null = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        if (s.overflow === 'hidden' && (r.width <= 2 || r.height <= 2)) return true;
        if (s.clip === 'rect(0px, 0px, 0px, 0px)' || s.clipPath === 'inset(50%)') return true;
      }
      return false;
    };
    const vis = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.top < innerHeight && !lecteurSeul(el);
    };
    const texteDe = (el: Element) => ((el as HTMLElement).innerText || el.getAttribute('aria-label') || el.tagName).replace(/\s+/g, ' ').trim().slice(0, 50);
    // Zone active : la fenêtre modale ouverte, sinon la page entière (ce qui est sous une modale n'est pas évalué).
    const modale = [...document.querySelectorAll('dialog[open], [aria-modal="true"]')].find(vis) ?? null;
    const racine: ParentNode = modale ?? document;
    const dansModale = (el: Element) => !modale || modale.contains(el);
    const cibles = [...racine.querySelectorAll('button, a[href], input, [role="button"], [role="switch"], [role="tab"], select, textarea')]
      .filter(el => vis(el) && dansModale(el) && !el.closest('[aria-hidden="true"]') && (el as HTMLInputElement).type !== 'checkbox')
      .map(el => { const r = el.getBoundingClientRect(); return { texte: texteDe(el), w: Math.round(r.width), h: Math.round(r.height), x: r.x }; })
      .filter(c => c.w < 44 || c.h < 44);
    const horsEcran = [...racine.querySelectorAll('button, a[href], input')].filter(vis)
      .filter(el => { const r = el.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(texteDe);
    const principales = [...document.querySelectorAll('.cta, .btn.primary')].filter(vis).filter(dansModale).length;

    // Contraste WCAG : couleur du texte (avec son opacité) sur le premier fond opaque trouvé en remontant.
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return [0, 0, 0, 0];
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    };
    const lum = ([r, g, b]: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const compose = (dessus: number[], dessous: number[]) => { const a = dessus[3]; return [0, 1, 2].map(i => Math.round(dessus[i] * a + dessous[i] * (1 - a))).concat(1); };
    const fondDe = (el: Element): { fond: number[]; via: string; incertain: boolean } => {
      const couches: number[][] = [];
      let incertain = false;
      let via = '';
      let e: Element | null = el;
      while (e) {
        const s = getComputedStyle(e);
        const bg = parse(s.backgroundColor);
        if (s.backgroundImage !== 'none' || e.tagName === 'IMG' || e.tagName === 'svg' || e.tagName === 'CANVAS') incertain = true;
        if (bg[3] > 0) { couches.push(bg); via = via || (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : e.tagName.toLowerCase()); if (bg[3] >= 1) break; }
        e = e.parentElement;
      }
      if (!couches.length || couches[couches.length - 1][3] < 1) couches.push([255, 255, 255, 1]);
      let fond = couches.pop()!;
      while (couches.length) fond = compose(couches.pop()!, fond);
      return { fond, via, incertain };
    };
    const ratio = (a: number[], b: number[]) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
    const contrastes: Mesure['contrastes'] = [];
    const vus = new Set<string>();
    const marche = document.createTreeWalker(racine instanceof Document ? racine.body : racine, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = marche.nextNode())) {
      const txt = (n.textContent ?? '').replace(/\s+/g, ' ').trim();
      const el = n.parentElement;
      if (!txt || !el || !vis(el) || el.closest('[aria-hidden="true"]') && !el.closest('button')) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      // Commande inactive (désactivée) : exemptée du contraste par WCAG 1.4.3.
      if (el.closest('[disabled], [aria-disabled="true"]')) continue;
      const s = getComputedStyle(el);
      const taille = parseFloat(s.fontSize);
      const poids = parseInt(s.fontWeight, 10) || 400;
      const gras = poids >= 700;
      // Opacité héritée : l'élément et ses parents.
      let op = 1; let p: Element | null = el;
      while (p) { op *= parseFloat(getComputedStyle(p).opacity) || 1; p = p.parentElement; }
      const col = parse(s.color); col[3] *= op;
      const { fond, via, incertain } = fondDe(el);
      const couleur = compose(col, fond);
      const r = ratio(couleur, fond);
      const grand = taille >= 24 || (taille >= 18.66 && gras);
      const seuil = grand ? 3 : 4.5;
      const cle = txt.slice(0, 40) + '|' + via;
      if (r < seuil && !vus.has(cle)) {
        vus.add(cle);
        contrastes.push({ texte: txt.slice(0, 50) + (incertain ? ' [fond incertain]' : ''), ratio: Math.round(r * 100) / 100, couleur: `rgb(${couleur.slice(0, 3).join(',')})`, fond: `rgb(${fond.slice(0, 3).join(',')}) ${via}`, taille, gras });
      }
    }
    // Textes coupés : points de suspension actifs, ou boîte à débordement caché dont le texte dépasse.
    const coupes = [...racine.querySelectorAll('*')].filter(vis).filter(el => {
      const s = getComputedStyle(el);
      const he = el as HTMLElement;
      if (!he.innerText?.trim()) return false;
      if (s.textOverflow === 'ellipsis' && s.overflow !== 'visible' && he.scrollWidth > he.clientWidth + 1) return true;
      return s.overflowY === 'hidden' && he.scrollHeight > he.clientHeight + 2 && he.children.length === 0;
    }).map(texteDe);
    return { ecran, theme, largeur, defilement: document.documentElement.scrollWidth - innerWidth, cibles, principales, contrastes, coupes, horsEcran, alertes: [] };
  }, { ecran, theme, largeur });
}

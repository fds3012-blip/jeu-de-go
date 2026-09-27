/// <reference types="vite/client" />
import { renderToStaticMarkup } from 'react-dom/server';
import { BarreNav, IconeNav } from './IconesNav';
import { ONGLETS, type Onglet } from './onglets';
import { Reflexion } from './Reflexion';
import navCss from './nav.css?raw';

// Issue #51 : identité « deux pierres ». Rendu statique (environnement node, sans DOM).

const barre = (actif: Onglet) => renderToStaticMarkup(<BarreNav actif={actif} onChoisir={() => {}} />);
const boutons = (html: string) => html.match(/<button[\s\S]*?<\/button>/g) ?? [];

describe('BarreNav', () => {
  it('garde les quatre libellés, dans l\'ordre, sous une navigation nommée', () => {
    const html = barre('jouer');
    expect(html).toMatch(/^<nav class="nav" aria-label="Navigation principale">/);
    expect(ONGLETS.map(o => o.libelle)).toEqual(['Jouer', 'Apprendre', 'Problèmes', 'Profil']);
    const b = boutons(html);
    expect(b).toHaveLength(4);
    ONGLETS.forEach((o, i) => expect(b[i]).toContain(`>${o.libelle}</span>`));
  });

  for (const o of ONGLETS) {
    it(`marque seulement « ${o.libelle} » avec aria-current="page" quand il est actif`, () => {
      const b = boutons(barre(o.id));
      const courants = b.filter(x => x.includes('aria-current="page"'));
      expect(courants).toHaveLength(1);
      expect(courants[0]).toContain(`onglet-${o.id}`);
      expect(courants[0]).toContain('icone-nav icone-' + o.id + ' active');
    });
  }

  it('cache les icônes et le point indicateur aux lecteurs d\'écran (le libellé suffit)', () => {
    const html = barre('problemes');
    expect(html.match(/<svg[^>]*>/g)!.every(s => s.includes('aria-hidden="true"'))).toBe(true);
    expect(html.match(/class="onglet-point"[^>]*/g)!.every(s => s.includes('aria-hidden="true"'))).toBe(true);
  });

  it('appelle onChoisir avec l\'onglet touché', () => {
    const choisis: Onglet[] = [];
    const el = BarreNav({ actif: 'jouer', onChoisir: o => choisis.push(o) });
    const enfants = (el.props as { children: { props: { onClick: () => void } }[] }).children;
    enfants[2].props.onClick();
    expect(choisis).toEqual(['problemes']);
  });
});

describe('IconeNav', () => {
  for (const o of ONGLETS) {
    it(`${o.libelle} : 28 px, pierres en matière seulement à l'état actif`, () => {
      const inactif = renderToStaticMarkup(<IconeNav onglet={o.id} />);
      const actif = renderToStaticMarkup(<IconeNav onglet={o.id} actif />);
      for (const svg of [inactif, actif]) expect(svg).toMatch(/viewBox="0 0 28 28" width="28" height="28"/);
      // Inactif : encre brume seulement, aucune matière ni accent.
      expect(inactif).not.toContain('radialGradient');
      expect(inactif).not.toMatch(/accent-|sceau-fond/);
      // Actif : dégradés du goban et une pièce qui « tombe ».
      expect(actif).toContain('radialGradient');
      expect(actif).toContain('class="pose"');
    });
  }

  it('donne à chaque onglet actif sa pièce d\'accent', () => {
    const actif = (o: Onglet) => renderToStaticMarkup(<IconeNav onglet={o} actif />);
    expect(actif('jouer')).toContain('accent-trait');
    expect(actif('apprendre')).toContain('accent-pointille');
    expect(actif('problemes')).toContain('accent-plein');
    expect(actif('profil')).toContain('sceau-fond');
  });

  it('donne des identifiants de dégradé uniques à chaque icône', () => {
    const html = barre('jouer') + renderToStaticMarkup(<><IconeNav onglet="jouer" actif /><IconeNav onglet="profil" actif /></>);
    const ids = [...html.matchAll(/<radialGradient id="([^"]+)"/g)].map(m => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Reflexion', () => {
  it('est décorative sans libellé, et annoncée avec', () => {
    expect(renderToStaticMarkup(<Reflexion />)).toMatch(/^<span class="reflexion" style="width:22px;height:22px" aria-hidden="true">/);
    const annonce = renderToStaticMarkup(<Reflexion libelle="Pomme réfléchit" />);
    expect(annonce).toContain('role="status"');
    expect(annonce).toContain('<span class="sr-only">Pomme réfléchit</span>');
  });

  it('dessine une noire et une blanche qui se touchent', () => {
    const html = renderToStaticMarkup(<Reflexion />);
    const r = [...html.matchAll(/<circle class="pierre-([nb])" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)]
      .map(m => ({ c: m[1], x: +m[2], y: +m[3], r: +m[4] }));
    expect(r.map(p => p.c).sort()).toEqual(['b', 'n']);
    const d = Math.hypot(r[0].x - r[1].x, r[0].y - r[1].y);
    expect(d).toBeLessThanOrEqual(r[0].r + r[1].r);
  });
});

describe('mouvements (nav.css)', () => {
  it('fait tomber la pierre de 1,15 à 1 à l\'activation, seulement sans préférence de mouvement réduit', () => {
    expect(navCss).toMatch(/@keyframes nav-pose \{ from \{ transform: scale\(1\.15\); \} to \{ transform: scale\(1\); \} \}/);
    const libre = navCss.slice(navCss.indexOf('@media (prefers-reduced-motion: no-preference)'));
    expect(libre.slice(0, libre.indexOf('@keyframes'))).toContain('animation: nav-pose var(--duree-pose) var(--ease-pose)');
    // L'animation n'est déclarée nulle part ailleurs.
    expect(navCss.match(/animation: nav-pose/g)).toHaveLength(1);
  });

  it('fait partir le point de l\'onglet actif de 0,8 et non de plus bas (#62)', () => {
    expect(navCss).toMatch(/@keyframes nav-point \{ from \{ transform: scale\(\.8\); \} to \{ transform: scale\(1\); \} \}/);
  });

  it('remplace la rotation par un fondu en mouvements réduits', () => {
    const reduit = navCss.slice(navCss.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduit.slice(0, reduit.indexOf('}\n}'))).not.toContain('orbite');
    expect(reduit).toContain('animation: allume');
  });
});

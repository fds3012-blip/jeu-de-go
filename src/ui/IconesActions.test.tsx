import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { IconeAction, type NomAction } from './IconesActions';
import { BarreActions, Icone } from './Partie';

const NOMS_ACTIONS: NomAction[] = ['indice', 'quimene', 'annuler', 'passer', 'abandonner'];
// Lu sur disque : Partie.tsx importe déjà partie.css, et Vitest rend alors l'import ?raw vide.
const partieCss = readFileSync(new URL('./partie.css', import.meta.url), 'utf8');

// Issue #65 : icônes de la barre d'actions, même famille que la barre de navigation. Rendu statique (node, sans DOM).

const barre = (armee = false, premierCoup = true) => renderToStaticMarkup(
  <BarreActions label="Actions de la partie" actions={[
    { label: 'Indice', icone: <Icone nom="indice" />, onClick: () => {} },
    { label: 'Annuler', icone: <Icone nom="annuler" />, onClick: () => {}, disabled: premierCoup },
    { label: 'Passer', icone: <Icone nom="passer" />, onClick: () => {} },
    { label: armee ? 'Confirmer ?' : 'Abandonner', icone: <Icone nom="abandonner" />, onClick: () => {}, danger: armee },
  ]} />,
);
const boutons = (html: string) => html.match(/<button[\s\S]*?<\/button>/g) ?? [];

describe('IconeAction', () => {
  for (const nom of NOMS_ACTIONS) {
    it(`${nom} : 28 px, décorative, dessinée avec des pierres du goban`, () => {
      const svg = renderToStaticMarkup(<IconeAction nom={nom} />);
      expect(svg).toMatch(/^<svg class="icone-action icone-[a-z]+" viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" focusable="false">/);
      expect(svg).toContain(`icone-${nom}`);
      expect(svg).toContain('radialGradient');
      // Une pièce « pose » : c'est elle qui s'enfonce à l'appui.
      expect(svg).toContain('class="pose"');
    });
  }

  it('garde la seule couleur d\'accent au repos pour l\'indice (halo jade)', () => {
    const html = NOMS_ACTIONS.map(n => renderToStaticMarkup(<IconeAction nom={n} />));
    expect(html[0]).toContain('class="lueur"');
    html.slice(1).forEach(h => expect(h).not.toContain('lueur'));
    // Les pierres de Annuler, Passer et Abandonner ont la matière du goban.
    html.slice(1).forEach(h => expect(h).toContain('class="pierre-n"'));
  });

  it('pose une pierre sur le couvercle retourné pour abandonner, avec le cadre du sceau prêt', () => {
    const svg = renderToStaticMarkup(<IconeAction nom="abandonner" />);
    expect(svg).toContain('couvercle-bois');
    expect(svg).toContain('couvercle-cadre');
  });

  it('donne des identifiants de dégradé uniques à chaque icône', () => {
    const ids = [...barre().matchAll(/<radialGradient id="([^"]+)"/g)].map(m => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('BarreActions avec les icônes « deux pierres »', () => {
  it('garde les quatre libellés et l\'ordre (tests e2e)', () => {
    const b = boutons(barre());
    expect(b.map(x => x.match(/<span>([^<]+)<\/span>/)![1])).toEqual(['Indice', 'Annuler', 'Passer', 'Abandonner']);
    b.forEach(x => expect(x).toContain('class="icone-action'));
  });

  it('désactive Annuler au premier coup, et passe Abandonner en « Confirmer ? » en vermillon', () => {
    expect(boutons(barre())[1]).toMatch(/^<button type="button" disabled=""/);
    const confirmer = boutons(barre(true))[3];
    expect(confirmer).toContain('class="danger"');
    expect(confirmer).toContain('Confirmer ?');
  });

  it('garde les chevrons au trait pour la relecture', () => {
    expect(renderToStaticMarkup(<Icone nom="precedent" />)).toMatch(/^<svg class="icone-trait" viewBox="0 0 26 26"/);
  });
});

describe('états (partie.css)', () => {
  it('désactivé : encre brume sans voile d\'opacité, pierres repassées à l\'encre', () => {
    expect(partieCss).toMatch(/\.actions button:disabled \{ color: var\(--muted\); cursor: default; \}/);
    expect(partieCss).toContain('.actions button:disabled .icone-action .pierre-n { fill: currentColor;');
  });

  it('appui : la pierre s\'enfonce en transform seulement, et seulement sans mouvement réduit', () => {
    const libre = partieCss.slice(partieCss.indexOf('/* Appui'));
    const bloc = libre.slice(libre.indexOf('@media (prefers-reduced-motion: no-preference)'), libre.indexOf('@keyframes action-pose'));
    expect(bloc).toMatch(/:active \.icone-action \.pose \{ transform: translateY\([\d.]+px\) scale\(\.9\); \}/);
    expect(partieCss).not.toMatch(/\.actions button[^{]*:active \{[^}]*background/);
    expect(partieCss.match(/animation: action-pose/g)).toHaveLength(1);
    expect(bloc).toContain('animation: action-pose');
  });

  it('Confirmer ? : le couvercle devient hanko', () => {
    expect(partieCss).toContain('.actions .danger .icone-action .couvercle-dessus { fill: var(--hanko);');
  });
});

describe('BarreActions : « Passer » se distingue des aides (#236, N7)', () => {
  const html = renderToStaticMarkup(
    <BarreActions label="Actions" actions={[
      { label: 'Indice', icone: null, onClick: () => {} },
      { label: 'Qui mène ?', icone: null, onClick: () => {} },
      { label: 'Annuler', icone: null, onClick: () => {} },
      { label: 'Passer', icone: null, onClick: () => {}, groupe: 'decision', principale: true },
      { label: 'Abandonner', icone: null, onClick: () => {}, groupe: 'decision' },
    ]} />);
  it('aides à gauche, filet, décisions à droite ; « Passer » en dernier, bouton plein', () => {
    const aides = html.slice(html.indexOf('actions-aides'), html.indexOf('actions-filet'));
    const decisions = html.slice(html.indexOf('actions-decisions'));
    expect(aides).toContain('Qui mène ?');
    expect(aides).not.toContain('Passer');
    expect(decisions.indexOf('Abandonner')).toBeLessThan(decisions.indexOf('Passer'));
    expect(html.match(/class="decider"/g)).toHaveLength(1);
  });
  it('bouton plein : au moins 44 px de haut, cerné et en gras', () => {
    const regle = partieCss.match(/\.actions button\.decider \{[^}]*\}/)?.[0] ?? '';
    expect(Number(regle.match(/min-height: (\d+)px/)?.[1])).toBeGreaterThanOrEqual(44);
    expect(regle).toContain('box-shadow: inset');
    expect(regle).toContain('font-weight: var(--fw-bold)');
  });
  it('sans groupes : une seule rangée, comme avant', () => {
    expect(barre()).not.toContain('actions-filet');
  });
});

describe('BarreActions : bouton mis en évidence (#120)', () => {
  const rendu = (disabled = false) => renderToStaticMarkup(
    <BarreActions label="Actions" actions={[{ label: 'Passer', icone: null, onClick: () => {}, evidence: true, pulse: true, disabled }]} />);
  it('ajoute evidence et pulse, libellé inchangé', () => {
    expect(rendu()).toContain('class="evidence pulse"');
    expect(rendu()).toContain('<span>Passer</span>');
  });
  it('pas de mise en évidence sur un bouton désactivé', () => {
    expect(rendu(true)).not.toContain('evidence');
  });
  it('la pulsation ne tourne que si les mouvements ne sont pas réduits', () => {
    const i = partieCss.indexOf('.actions button.pulse::after');
    const media = partieCss.lastIndexOf('@media (prefers-reduced-motion: no-preference)', i);
    expect(i).toBeGreaterThan(0);
    expect(partieCss.slice(media, i)).not.toMatch(/\n\}/);
  });
});

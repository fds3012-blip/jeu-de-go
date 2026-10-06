// Feuilles « Dire » et « Signaler » (#373, #363), rendues sans navigateur : contenu, libellés accessibles, une seule
// action principale. Le parcours complet (bulle chez l'adversaire en moins de 5 s, 3 s à l'écran, réglage coupé,
// signalement et blocage) est dans e2e/securite.spec.ts.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BulleEchange, FeuilleDire, FeuilleSignaler } from './Securite';
import type { Db } from '../data/supabase';

const db = {} as Db;
const rien = () => undefined;

describe('feuille « Dire »', () => {
  const html = renderToStaticMarkup(<FeuilleDire ouvert onFermer={rien} onDire={async () => null} nom="Léa" restants={10} envoi={false} coupes={false} onCouper={rien} onSignaler={rien} />);

  it('6 messages tout prêts et 4 émotes de Mochi, pas de champ de texte', () => {
    const texte = html.replace(/[\u00a0\u202f]|&nbsp;/g, ' ');
    for (const m of ['Bonne partie !', 'Bien joué !', 'Merci !', 'Joli coup !', 'Oups !', 'À la prochaine !']) expect(texte).toContain(m);
    expect(html.match(/class="dire-message"/g)).toHaveLength(6);
    expect(html.match(/class="dire-emote"/g)).toHaveLength(4);
    for (const e of ['Mochi fait coucou', 'Mochi est content', 'Mochi est fier', 'Mochi réfléchit']) expect(html).toContain(`aria-label="${e}"`);
    expect(html).not.toMatch(/<textarea|<input/);
  });

  it('le réglage pour couper, et « Signaler » à côté', () => {
    expect(html).toMatch(/role="switch" aria-checked="true"[^>]*>.*Messages de l’adversaire/);
    expect(html).toContain('Signaler Léa');
  });

  it('plus de message possible : boutons désactivés, le reste dit', () => {
    const fin = renderToStaticMarkup(<FeuilleDire ouvert onFermer={rien} onDire={async () => null} nom="Léa" restants={0} envoi={false} coupes onCouper={rien} onSignaler={rien} />);
    expect(fin.match(/class="dire-message" disabled=""/g)).toHaveLength(6);
    expect(fin).toContain('0 messages restants');
    expect(fin).toMatch(/role="switch" aria-checked="false"/);
  });
});

describe('bulle d’un message', () => {
  it('le texte traduit, annoncé avec le nom', () => {
    const html = renderToStaticMarkup(<BulleEchange code="bien_joue" qui="Léa" />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Léa dit : Bien joué !"');
  });
  it('une émote montre Mochi', () => {
    const html = renderToStaticMarkup(<BulleEchange code="mochi_fier" qui={null} />);
    expect(html).toContain('data-humeur="fier"');
    expect(html).toContain('aria-label="Tu dis : Mochi est fier"');
  });
});

describe('feuille « Signaler »', () => {
  it('un joueur : motifs, détail facultatif, « Bloquer aussi », une seule action principale', () => {
    const html = renderToStaticMarkup(<FeuilleSignaler db={db} ouvert onFermer={rien} compte cible={{ type: 'joueur', nom: 'Léa', partie: 'p1', depuis: 'partie' }} />);
    expect(html).toContain('Signaler Léa');
    expect(html.match(/type="radio"/g)).toHaveLength(5);
    expect(html).toContain('Bloquer aussi Léa');
    expect(html).toContain('Bloquer Léa');
    expect(html).toContain('maxLength="500"');
    expect(html.match(/btn primary/g)).toHaveLength(1);
    expect(html).toContain('ne saura pas que c’est toi');
  });

  it('« Nous écrire » : sujet, message obligatoire, pas de blocage', () => {
    const html = renderToStaticMarkup(<FeuilleSignaler db={db} ouvert onFermer={rien} compte cible={{ type: 'ecrire' }} />);
    expect(html).toContain('Un bug');
    expect(html).toContain('required=""');
    expect(html).not.toContain('Bloquer');
  });

  it('un problème : motifs du problème', () => {
    const html = renderToStaticMarkup(<FeuilleSignaler db={db} ouvert onFermer={rien} compte cible={{ type: 'probleme', probleme: 'ko-3' }} />);
    expect(html).toContain('La réponse me semble fausse');
    expect(html.match(/type="radio"/g)).toHaveLength(3);
  });

  it('sans compte : la feuille propose de le créer', () => {
    const html = renderToStaticMarkup(<FeuilleSignaler db={db} ouvert onFermer={rien} compte={false} onCompte={rien} cible={{ type: 'ecrire' }} />);
    expect(html).toContain('Créer mon compte');
    expect(html).not.toContain('<textarea');
  });
});

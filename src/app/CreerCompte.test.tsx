import { renderToStaticMarkup } from 'react-dom/server';
import type { Db } from '../data/supabase';
import { CreerCompte, PseudoObligatoire } from './CreerCompte';
import { DefiArrivee } from './Defis';
import { compteVientDEtreCree, moyenConnexion, noterConnexionParCode } from './entonnoir';

// #343 : écrans du compte obligatoire, rendus avec un Supabase simulé (aucun appel au rendu).
const db = { auth: {}, from: () => { throw new Error('aucun appel au rendu'); } } as unknown as Db;
/** Rendu statique, espaces insécables (typographie française) ramenées à des espaces simples. */
const rendu = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/[\u00a0\u202f]/g, ' ');
beforeEach(() => { vi.stubGlobal('navigator', { onLine: true }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('« Crée ton compte » (#343)', () => {
  it('dit pourquoi, ce qui est gardé, et n’a qu’une action principale', () => {
    const html = rendu(<CreerCompte db={db} raison="parties" onRetour={() => {}} />);
    expect(html).toContain('Crée ton compte');
    expect(html).toContain('Tu as joué tes 3 parties d’essai.');
    for (const garde of ['ta progression', 'ta série de jours', 'tes badges', 'tes parties']) expect(html).toContain(garde);
    expect(html).toContain('Ta série et tes leçons te suivent aussi sur tes autres appareils.');
    expect(html.match(/btn primary/g)).toHaveLength(1);
    expect(html).toContain('Recevoir mon code');
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('Plus tard');
    // Case d'âge (texte juridique), jamais cochée d'avance.
    expect(html).toContain('J’ai 15 ans ou plus, ou un parent est d’accord. J’accepte les ');
    expect(html).toContain('type="checkbox"');
    expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
    expect(html).toContain('Tu as moins de 15 ans ?');
  });

  it('a un texte par raison', () => {
    for (const [raison, texte] of [['lecons', 'Les 3 premières leçons sont libres.'], ['problemes', 'Le Go du jour reste libre.'], ['defi', 'Pour défier un ami']] as const) {
      expect(rendu(<CreerCompte db={db} raison={raison} onRetour={() => {}} />)).toContain(texte);
    }
  });
});

describe('pseudo obligatoire (#343)', () => {
  it('règles visibles, une action, sortie par la déconnexion seulement', () => {
    const html = rendu(<PseudoObligatoire db={db} userId="u1" onChoisi={() => {}} onDeconnecter={() => {}} />);
    expect(html).toContain('Choisis ton pseudo');
    expect(html).toContain('De 3 à 24 caractères : lettres sans accent, chiffres, _ et -.');
    expect(html).toContain('C’est mon pseudo');
    expect(html).toContain('Me déconnecter');
    expect(html).not.toContain('Plus tard');
    expect(html.match(/btn primary/g)).toHaveLength(1);
  });
});

describe('entonnoir essai → compte (#343)', () => {
  it('`compte_cree` quand la session devient « connecté sans pseudo »', () => {
    expect(compteVientDEtreCree(null, 'sans_pseudo')).toBe(true);
    expect(compteVientDEtreCree('aucun', 'sans_pseudo')).toBe(true);
    expect(compteVientDEtreCree('chargement', 'sans_pseudo')).toBe(true);
    expect(compteVientDEtreCree('sans_pseudo', 'sans_pseudo')).toBe(false);
    expect(compteVientDEtreCree('aucun', 'complet')).toBe(false);
  });

  it('moyen de connexion : le lien par défaut, le code une fois accepté', () => {
    expect(moyenConnexion()).toBe('lien');
    noterConnexionParCode();
    expect(moyenConnexion()).toBe('code');
  });
});

describe('arrivée par un lien de défi (#343)', () => {
  it('sans compte : qui invite, le plateau, puis la création du compte', () => {
    const html = rendu(<DefiArrivee db={db} jeton={'A'.repeat(32)} inviteur="Florian" compte="aucun" onPartie={() => {}} onAccueil={() => {}} />);
    expect(html).toContain('Florian te défie !');
    expect(html).toContain('Plateau 9 × 9 vide');
    expect(html).toContain('Crée ton compte pour jouer');
    expect(html).toContain('Recevoir mon code');
  });

  it('lien sans pseudo (ancien lien) : « Ton ami te défie ! »', () => {
    const html = rendu(<DefiArrivee db={db} jeton={'A'.repeat(32)} compte="aucun" onPartie={() => {}} onAccueil={() => {}} />);
    expect(html).toContain('Ton ami te défie !');
  });
});

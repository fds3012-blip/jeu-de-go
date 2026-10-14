import { describe, expect, it } from 'vitest';
import { bandeauReseau, besoinReseau, etatIA, proposerRepli, REPLI_HORS_LIGNE } from './horsLigne';
import { ORDRE_MODES } from './modes';
import { OPPONENTS, opponent } from '../engine/adversaires';

describe('hors ligne clair (#538)', () => {
  it('seuls la partie en ligne et les défis entre amis ont besoin du réseau', () => {
    expect(ORDRE_MODES.filter(besoinReseau)).toEqual(['en_ligne', 'ami']);
  });

  it('bandeau : ce qui marche sur l’accueil, « il faut internet » sur les écrans réseau, rien ailleurs', () => {
    expect(bandeauReseau({ enLigne: true, accueil: true, ecranReseau: false })).toBeNull();
    expect(bandeauReseau({ enLigne: false, accueil: true, ecranReseau: false })).toBe('accueil');
    expect(bandeauReseau({ enLigne: false, accueil: false, ecranReseau: true })).toBe('reseau');
    // Partie, leçon, problème : ça marche, pas de bandeau.
    expect(bandeauReseau({ enLigne: false, accueil: false, ecranReseau: false })).toBeNull();
  });

  it('repli vers Caillou : seulement hors ligne, contre un adversaire KataGo, sans IA sur le téléphone', () => {
    expect(proposerRepli({ katago: true, enLigne: false, iaDispo: false })).toBe(true);
    expect(proposerRepli({ katago: true, enLigne: false, iaDispo: null })).toBe(true);
    expect(proposerRepli({ katago: true, enLigne: false, iaDispo: true })).toBe(false);
    expect(proposerRepli({ katago: true, enLigne: true, iaDispo: false })).toBe(false);
    expect(proposerRepli({ katago: false, enLigne: false, iaDispo: false })).toBe(false);
  });

  it('Caillou joue sans KataGo, et c’est le plus fort à le faire', () => {
    expect(opponent(REPLI_HORS_LIGNE).katago).toBeUndefined();
    const sans = OPPONENTS.filter(o => !o.katago).map(o => o.id);
    expect(sans[sans.length - 1]).toBe(REPLI_HORS_LIGNE);
  });

  it('état de l’IA dans les Réglages', () => {
    const base = { enCache: false as boolean | null, enCours: false, echec: false, enLigne: true };
    expect(etatIA({ ...base, enCache: null })).toBe('verification');
    expect(etatIA({ ...base, enCache: true })).toBe('prete');
    expect(etatIA({ ...base, enCache: true, enLigne: false })).toBe('prete');
    expect(etatIA(base)).toBe('a-telecharger');
    expect(etatIA({ ...base, echec: true })).toBe('echec');
    expect(etatIA({ ...base, enLigne: false })).toBe('hors-ligne');
    expect(etatIA({ ...base, enCours: true })).toBe('en-cours');
  });
});

describe('textes du hors ligne et de l’IA (#538) : français et anglais', () => {
  const variables = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
  it('mêmes clés, aucun texte vide, mêmes variables', async () => {
    const { CATALOGUE_HORS_LIGNE } = await import('../content/i18n/horsLigne');
    const { fr, en } = CATALOGUE_HORS_LIGNE;
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const k of Object.keys(fr) as (keyof typeof fr)[]) {
      expect(fr[k].trim(), k).not.toBe('');
      expect(en[k].trim(), k).not.toBe('');
      expect(variables(en[k]), k).toEqual(variables(fr[k]));
    }
  });

  it('tutoiement, phrases courtes, et la taille de l’IA dite avant le téléchargement', async () => {
    const { traduireHorsLigne } = await import('../content/i18n/horsLigne');
    expect(traduireHorsLigne('fr', 'ia.aTelecharger', { taille: '3,8' })).toBe('3,8 Mo à télécharger, une seule fois. Mieux en Wi-Fi.');
    expect(traduireHorsLigne('en', 'ia.aTelecharger', { taille: '3.8' })).toBe('3.8 MB to download, just once. Best on Wi-Fi.');
    expect(traduireHorsLigne('fr', 'repli.titre', { nom: 'Bambou' })).toBe('Bambou a besoin de l’IA');
    expect(traduireHorsLigne('fr', 'ia.aide')).not.toMatch(/\bvous\b/i);
  });
});

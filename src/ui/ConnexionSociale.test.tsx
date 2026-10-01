import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Db } from '../data/supabase';
import { ConnexionSociale, FOURNISSEURS_ACTIFS } from './ConnexionSociale';

// #353 (préparation) : emplacement des boutons « Connexion avec Google / Apple », masqué par une constante.
const db = { auth: {} } as unknown as Db;
const rendu = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el).replace(/[\u00a0\u202f]/g, " ");

describe('ConnexionSociale', () => {
  it('masqué par défaut : aucun fournisseur actif', () => {
    expect(FOURNISSEURS_ACTIFS).toEqual([]);
    expect(rendu(<ConnexionSociale db={db} />)).toBe('');
  });

  it('une fois activé : boutons secondaires (jamais l’action principale), puis « ou »', () => {
    const html = rendu(<ConnexionSociale db={db} fournisseurs={['apple', 'google']} />);
    expect(html).toContain('Connexion avec Apple');
    expect(html).toContain('Connexion avec Google');
    expect(html).not.toContain('primary');
    expect(html.indexOf('Apple')).toBeLessThan(html.indexOf('Google'));
    expect(html).toContain('>ou<');
  });
});

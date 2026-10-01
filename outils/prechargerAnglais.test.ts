import { runInNewContext } from 'node:vm';
import { detecterLangue, LANGUE_KEY } from '../src/content/i18n/detection';
import { scriptPrechargement } from './prechargerAnglais';

/** Lance le script dans un faux navigateur ; renvoie l'adresse préchargée, ou null. */
function executer(search: string, langues: string[], choix: string | null, stockageCasse = false): string | null {
  const liens: { rel: string; href: string }[] = [];
  const contexte = {
    JSON, String, URLSearchParams,
    location: { search },
    navigator: { languages: langues, language: langues[0] },
    localStorage: { getItem: (k: string) => { if (stockageCasse) throw new Error('bloqué'); return k === LANGUE_KEY ? choix : null; } },
    document: { createElement: () => ({}), head: { appendChild: (l: { rel: string; href: string }) => liens.push(l) } },
  };
  runInNewContext(scriptPrechargement('/assets/anglaisContenu-x.js'), contexte);
  return liens.length ? liens[0].href : null;
}

describe('préchargement des textes anglais (#325) : même langue que detecterLangue', () => {
  const cas: [string, string[], string | null][] = [
    ['', ['fr-FR'], null], ['', ['en-US'], null], ['', ['en-GB', 'fr'], null], ['', ['es-ES', 'en'], null],
    ['', ['de-DE', 'fr-FR'], null], ['', ['de-DE'], null], ['', [], null], ['', ['EN_us'], null],
    ['?lang=en', ['fr-FR'], null], ['?lang=EN', ['fr-FR'], null], ['?lang=fr', ['en-US'], null], ['?lang=de', ['en-US'], null],
    ['?lang=en', ['en-US'], JSON.stringify('fr')], ['', ['fr-FR'], JSON.stringify('en')], ['', ['en-US'], JSON.stringify('de')],
    ['', ['en-US'], 'pas du JSON'], ['?x=1&lang=en', ['fr'], null],
  ];
  it.each(cas)('search %j, appareil %j, choix %j', (search, langues, brut) => {
    let choix: string | null = null;
    try { const v = JSON.parse(brut ?? 'null') as unknown; choix = typeof v === 'string' ? v : null; } catch { /* comme lireChoixLangue */ }
    const attendu = detecterLangue(search, langues, true, choix === 'fr' || choix === 'en' ? choix : null);
    expect(executer(search, langues, brut)).toBe(attendu === 'en' ? '/assets/anglaisContenu-x.js' : null);
  });

  it('stockage bloqué : suit l’adresse puis l’appareil', () => {
    expect(executer('', ['en-US'], null, true)).toBe('/assets/anglaisContenu-x.js');
    expect(executer('?lang=fr', ['en-US'], null, true)).toBeNull();
  });
});

// Constat juridique E14 (#81) : le jeton d'un défi par lien ne part jamais vers PostHog ou Sentry.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { prendreJeton, sansJeton } from './adresseDefi';
import { sansJetonDefi, sansLocalisation, sentrySansJeton } from '../data/analytics';

const JETON = 'Ab3_-x'.padEnd(32, 'Z');
const lire = (chemin: string) => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');

describe('le jeton quitte l’adresse', () => {
  it('lit le jeton puis retire le fragment, en gardant chemin et query', () => {
    const hist = { state: { a: 1 }, replaceState: vi.fn() };
    expect(prendreJeton({ hash: `#defi=${JETON}`, pathname: '/', search: '?lang=en' }, hist)).toBe(JETON);
    expect(hist.replaceState).toHaveBeenCalledWith({ a: 1 }, '', '/?lang=en');
  });

  it('retire aussi un jeton mal formé (défi introuvable), sans le lire', () => {
    const hist = { state: null, replaceState: vi.fn() };
    expect(prendreJeton({ hash: '#defi=tronque', pathname: '/', search: '' }, hist)).toBe('');
    expect(hist.replaceState).toHaveBeenCalledTimes(1);
  });

  it('ne touche pas une adresse sans défi', () => {
    const hist = { state: null, replaceState: vi.fn() };
    expect(prendreJeton({ hash: '#erreur-test', pathname: '/', search: '' }, hist)).toBeNull();
    expect(hist.replaceState).not.toHaveBeenCalled();
  });

  it('est fait avant la mesure : premier import de main.tsx, avant App et analytics', () => {
    const imports = [...lire('../main.tsx').matchAll(/^import .*?['"](.+?)['"];?$/gm)].map(m => m[1]);
    expect(imports[0]).toBe('./app/adresseDefi');
    // Et le module ne dépend pas de la mesure (qui serait alors chargée avant lui).
    expect(lire('./adresseDefi.ts')).not.toMatch(/analytics/);
  });
});

describe('filet de sécurité avant envoi', () => {
  it('PostHog : $current_url sans jeton', () => {
    const ev = sansLocalisation({ event: 'app_ouverte', properties: { $current_url: `https://go.exemple/?x=1#defi=${JETON}`, a: 1 } });
    expect(ev.properties).toEqual({ $current_url: 'https://go.exemple/?x=1', a: 1, $geoip_disable: true });
    expect(JSON.stringify(ev)).not.toContain(JETON);
    const inchange = { a: 'rien' };
    expect(sansJetonDefi(inchange)).toBe(inchange);
  });

  it('Sentry : adresse de la page sans jeton', () => {
    const ev = sentrySansJeton({ request: { url: `https://go.exemple/#defi=${JETON}` } });
    expect(ev.request.url).toBe('https://go.exemple/');
    expect(sansJeton(`https://go.exemple/#defi=${JETON}`)).toBe('https://go.exemple/');
  });

  it('les événements defi_* ne portent ni jeton, ni partie, ni lien', () => {
    const sources = ['./Defis.tsx', './Account.tsx'].map(lire).join('\n');
    const appels = [...sources.matchAll(/track\(EVENTS\.defi\w+,\s*(\{[^}]*\})/g)].map(m => m[1]);
    expect(appels.length).toBe(3);
    for (const props of appels) expect(props).not.toMatch(/jeton|partie|lien|id\b|email/i);
  });
});

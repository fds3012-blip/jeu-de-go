// Partager l'app (#521) : texte (vrai, court, tutoiement), lien selon la langue, règle de l'invitation et plafond,
// feuille native puis copie, et mesure `app_partagee` sans donnée personnelle.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';

const track = vi.fn();
vi.mock('../data/analytics', async orig => ({ ...(await orig<typeof import('../data/analytics')>()), track: (...a: unknown[]) => track(...a) }));

const { DELAI_INVITATION_MS, INVITATION_APP_KEY, doitInviter, lienApp, lireDerniere } = await import('./partageApp');
const { traduirePartage } = await import('../content/i18n/partage');
const { partagerApp } = await import('./envoiApp');
const { BoutonPartagerApp } = await import('../ui/PartagerApp');
const { EVENTS } = await import('../data/analytics');

const JOUR = 24 * 3600 * 1000;
const base = { partiesFinies: 2, secondes: 120, derniere: null, maintenant: Date.UTC(2026, 9, 10, 12), enPartie: false };

describe('texte et lien', () => {
  it('lien : la page d’accueil, /en en anglais', () => {
    expect(lienApp('fr')).toBe('https://mochi-go.app');
    expect(lienApp('en')).toBe('https://mochi-go.app/en');
  });

  it('texte court, tutoiement, et rien d’inventé : gratuit, sans pub, débutants bienvenus (docs/marketing/fiches-stores.md)', () => {
    const fr = traduirePartage('fr', 'app.texte');
    const en = traduirePartage('en', 'app.texte');
    expect(fr).toBe('Je joue au go sur Mochi Go : c’est gratuit, sans pub, et on apprend en jouant, même débutant. Viens essayer !');
    expect(en).toBe('I play go on Mochi Go: it’s free, no ads, and you learn by playing, even as a beginner. Come and try it!');
    for (const t of [fr, en]) {
      expect(t.length).toBeLessThanOrEqual(120);
      expect(t).not.toMatch(/meilleur|n° ?1|best|#1|toujours gratuit|always free|\d+ ?(joueurs|players)/i);
      expect(t).not.toContain('http'); // le lien part à part (champ `url` de la feuille, ou après le texte copié)
    }
    // La fiche des stores dit la même chose : gratuit et sans publicité, pour les débutants.
    const fiche = readFileSync(new URL('../../docs/marketing/fiches-stores.md', import.meta.url), 'utf8');
    expect(fiche).toContain('Gratuit et sans publicité.');
    expect(fiche).toMatch(/Free(,| and) no ads|ad-free|no ads/i);
  });

  it('libellés fr et en de la ligne et de l’invitation', () => {
    expect(traduirePartage('fr', 'app.ligne')).toBe('Partager Mochi Go');
    expect(traduirePartage('en', 'app.ligne')).toBe('Share Mochi Go');
    expect(traduirePartage('fr', 'app.invitation')).toBe('Ça te plaît ? Fais découvrir le go à un ami.');
    expect(traduirePartage('en', 'app.invitation')).toBe('Enjoying it? Show a friend the game of go.');
  });
});

describe('règle de l’invitation', () => {
  it('permise après la 2e partie finie, passé la première minute, sans invitation récente', () => {
    expect(doitInviter(base)).toBe(true);
  });
  it('jamais avant la 2e partie finie', () => {
    expect(doitInviter({ ...base, partiesFinies: 0 })).toBe(false);
    expect(doitInviter({ ...base, partiesFinies: 1 })).toBe(false);
  });
  it('jamais dans la première minute', () => {
    expect(doitInviter({ ...base, secondes: 0 })).toBe(false);
    expect(doitInviter({ ...base, secondes: 59 })).toBe(false);
    expect(doitInviter({ ...base, secondes: 60 })).toBe(true);
  });
  it('jamais pendant une partie', () => {
    expect(doitInviter({ ...base, enPartie: true })).toBe(false);
  });
  it('plafond : au plus une fois par semaine', () => {
    expect(doitInviter({ ...base, derniere: base.maintenant - JOUR })).toBe(false);
    expect(doitInviter({ ...base, derniere: base.maintenant - 6 * JOUR })).toBe(false);
    expect(doitInviter({ ...base, derniere: base.maintenant - DELAI_INVITATION_MS })).toBe(true);
    expect(doitInviter({ ...base, derniere: base.maintenant - 30 * JOUR })).toBe(true);
  });
  it('horloge reculée : un repère loin dans le futur ne bloque pas pour des mois', () => {
    expect(doitInviter({ ...base, derniere: base.maintenant + JOUR })).toBe(false);
    expect(doitInviter({ ...base, derniere: base.maintenant + 200 * JOUR })).toBe(true);
  });
  it('repère abîmé : ignoré', () => {
    expect(lireDerniere('abc')).toBeNull();
    expect(lireDerniere(-4)).toBeNull();
    expect(lireDerniere(null)).toBeNull();
    expect(lireDerniere(Number.NaN)).toBeNull();
    expect(lireDerniere(1_760_000_000_000)).toBe(1_760_000_000_000);
    expect(INVITATION_APP_KEY).toBe('go.invitation-app.v1');
  });
});

describe('partage : feuille native, sinon copie', () => {
  afterEach(() => { vi.unstubAllGlobals(); track.mockClear(); });

  it('feuille native : titre, texte et lien ; mesure `natif`', async () => {
    const share = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { share, clipboard: { writeText: vi.fn() } });
    expect(await partagerApp('profil')).toBe('');
    expect(share).toHaveBeenCalledWith({ title: 'Mochi Go', text: traduirePartage('fr', 'app.texte'), url: 'https://mochi-go.app' });
    expect(track).toHaveBeenCalledWith(EVENTS.appPartagee, { depuis: 'profil', methode: 'natif' });
  });

  it('feuille fermée sans envoyer : `abandon`, et pas de copie', async () => {
    const writeText = vi.fn();
    vi.stubGlobal('navigator', { share: vi.fn(async () => { throw new DOMException('fermé', 'AbortError'); }), clipboard: { writeText } });
    expect(await partagerApp('victoire')).toBe('');
    expect(writeText).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(EVENTS.appPartagee, { depuis: 'victoire', methode: 'natif', abandon: true });
  });

  it('sans feuille native : texte et lien copiés ; mesure `copie`', async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await partagerApp('lecon')).toBe('copie');
    expect(writeText).toHaveBeenCalledWith(`${traduirePartage('fr', 'app.texte')} https://mochi-go.app`);
    expect(track).toHaveBeenCalledWith(EVENTS.appPartagee, { depuis: 'lecon', methode: 'copie' });
  });

  it('copie impossible : le lien à copier à la main, rien n’est mesuré', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => { throw new Error('refusé'); }) } });
    expect(await partagerApp('record')).toBe('manuel');
    expect(track).not.toHaveBeenCalled();
  });

  it('aucune donnée personnelle dans les propriétés mesurées', async () => {
    vi.stubGlobal('navigator', { share: vi.fn(async () => undefined) });
    await partagerApp('profil');
    const [, props] = track.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.keys(props).sort()).toEqual(['depuis', 'methode']);
    expect(JSON.stringify(props)).not.toMatch(/http|mochi-go/);
  });
});

describe('« Partager Mochi Go » du Profil', () => {
  it('un bouton (action directe) : nom accessible complet, mot visible court ; zone d’annonce présente et vide', () => {
    const html = renderToStaticMarkup(<BoutonPartagerApp />);
    expect(html).toMatch(/^<button type="button" class="partager-app-profil"[^>]*aria-label="Partager Mochi Go"/);
    // Le mot visible est contenu dans le nom accessible (WCAG 2.5.3).
    expect(html).toContain('>Partager</span>');
    expect(html).toMatch(/<p class="sr-only" role="status" aria-live="polite"><\/p>/);
  });
  it('libellés fr et en', () => {
    expect(traduirePartage('fr', 'app.court')).toBe('Partager');
    expect(traduirePartage('en', 'app.court')).toBe('Share');
  });
});

// Lien d'invitation (#729) : `/i#CODE` ou `/en/i#CODE`, lu par le script en tête d'index.html (aucun octet dans le JS
// initial). Le code reste dans le fragment ; l'adresse redevient `/`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lienInvitation } from '../data/invitation';

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');
const source = html.match(/function codeInvitation\(chemin, fragment\) \{[\s\S]*?\n {6}\}/)?.[0];
const codeInvitation = new Function(`${source}; return codeInvitation;`)() as (c: string, f: string) => string | null;
const CODE = 'abcdefghijklmnopqrstuvwxyzABCD_-';

describe('code d’invitation lu dans l’adresse', () => {
  it('se trouve dans index.html, avant l’ouverture animée', () => {
    expect(source).toBeTruthy();
    expect(html.indexOf('function codeInvitation')).toBeLessThan(html.indexOf('function modeOuverture'));
  });

  it('lit le code de `/i` et `/en/i`, avec ou sans « invitation= »', () => {
    expect(codeInvitation('/i', `#${CODE}`)).toBe(CODE);
    expect(codeInvitation('/en/i', `#${CODE}`)).toBe(CODE);
    expect(codeInvitation('/i/', `#invitation=${CODE}`)).toBe(CODE);
    expect(codeInvitation('/i', `#${CODE}&utm=x`)).toBe(CODE);
  });

  it('un lien abîmé donne « vide » (l’adresse est tout de même nettoyée) ; une autre adresse donne null', () => {
    expect(codeInvitation('/i', '')).toBe('');
    expect(codeInvitation('/i', '#court')).toBe('');
    expect(codeInvitation('/i', `#${CODE}x`)).toBe('');
    expect(codeInvitation('/i', `#${CODE.slice(1)}!`)).toBe('');
    for (const chemin of ['/', '/defi', '/en', '/in', '/i/x', '/ii', '/en/defi', '/j/42', '/profil']) expect(codeInvitation(chemin, `#${CODE}`)).toBeNull();
  });

  it('le lien que l’app partage se relit de bout en bout', () => {
    for (const l of ['fr', 'en'] as const) {
      const u = new URL(lienInvitation(CODE, l));
      expect(codeInvitation(u.pathname, u.hash)).toBe(CODE);
    }
  });

  it('le script garde le code sur l’appareil, signale l’ouverture et ne laisse rien dans l’adresse', () => {
    const bloc = html.match(/\(function \(\) \{\s*try \{\s*var i = codeInvitation[\s\S]*?\}\)\(\);/)?.[0] ?? '';
    expect(bloc).toContain("localStorage.setItem('go.invitation.v1'");
    expect(bloc).toContain("setAttribute('data-invitation'");
    expect(bloc).toContain("history.replaceState(history.state, '', '/' + location.search)");
    // Le jeton de l'invitation n'est jamais envoyé au serveur (fragment) ni à la mesure (adresse remise à `/`).
    expect(bloc).not.toContain('fetch(');
  });
});

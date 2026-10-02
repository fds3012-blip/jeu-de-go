import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _reinitialiserMiseAJour, abonnerNouvelleVersion, ecouterNouvelleVersion, estMiseAJour, nouvelleVersionPrete } from './miseAJour';

/** Faux conteneur de service worker : un contrôleur réglable et l'événement `controllerchange`. */
function fauxSw(controleur: boolean) {
  const ecouteurs = new Set<() => void>();
  return {
    controller: controleur ? {} : null,
    addEventListener: (_t: 'controllerchange', f: () => void) => { ecouteurs.add(f); },
    removeEventListener: (_t: 'controllerchange', f: () => void) => { ecouteurs.delete(f); },
    changer(nouveau: boolean) { this.controller = nouveau ? {} : null; ecouteurs.forEach(f => f()); },
    get nombre() { return ecouteurs.size; },
  };
}

describe('nouvelle version prête (robustesse)', () => {
  beforeEach(_reinitialiserMiseAJour);

  it('estMiseAJour : seulement si la page avait déjà un contrôleur et en a un nouveau', () => {
    expect(estMiseAJour(true, true)).toBe(true);
    expect(estMiseAJour(false, true)).toBe(false);
    expect(estMiseAJour(true, false)).toBe(false);
  });

  it('première visite : le premier service worker prend la page, ce n’est pas une mise à jour', () => {
    const sw = fauxSw(false);
    ecouterNouvelleVersion(sw);
    sw.changer(true);
    expect(nouvelleVersionPrete()).toBe(false);
    // Puis un déploiement : cette fois, c'est une mise à jour.
    sw.changer(true);
    expect(nouvelleVersionPrete()).toBe(true);
  });

  it('visite suivante : un nouveau contrôleur signale la mise à jour, une fois, aux abonnés', () => {
    const sw = fauxSw(true);
    const arreter = ecouterNouvelleVersion(sw);
    const f = vi.fn();
    abonnerNouvelleVersion(f);
    sw.changer(true);
    sw.changer(true);
    expect(f).toHaveBeenCalledTimes(1);
    expect(nouvelleVersionPrete()).toBe(true);
    arreter();
    expect(sw.nombre).toBe(0);
  });

  it('sans service worker (navigateur ancien, Node) : sans effet', () => {
    expect(() => ecouterNouvelleVersion(undefined)()).not.toThrow();
    expect(nouvelleVersionPrete()).toBe(false);
  });
});

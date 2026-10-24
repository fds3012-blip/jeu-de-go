import { describe, expect, it } from 'vitest';
import { FINE, fr } from './typo';

describe('fr : espaces fines insécables', () => {
  it('remplace l\'espace avant ? ! : ;', () => {
    expect(fr('Prêt ? Oui ! Le but : gagner ; vite.')).toBe(`Prêt${FINE}? Oui${FINE}! Le but${FINE}: gagner${FINE}; vite.`);
  });

  it('remplace aussi une espace insécable ou plusieurs espaces', () => {
    expect(fr('Bravo !')).toBe(`Bravo${FINE}!`);
    expect(fr('Bravo  !')).toBe(`Bravo${FINE}!`);
  });

  it('traite l\'intérieur des guillemets français', () => {
    expect(fr('Leçon « L\'échelle »')).toBe(`Leçon «${FINE}L’échelle${FINE}»`);
  });

  it('n\'ajoute pas d\'espace là où il n\'y en a pas', () => {
    expect(fr('https://go.example/a?b=1')).toBe('https://go.example/a?b=1');
    expect(fr('10:30')).toBe('10:30');
    expect(fr('Quoi?!')).toBe('Quoi?!');
  });

  it('met l\'apostrophe typographique entre deux lettres, et nulle part ailleurs (#693)', () => {
    expect(fr('Il n\'y a qu\'une liberté : sauve-la d\'abord, aujourd\'hui.')).toBe(`Il n’y a qu’une liberté${FINE}: sauve-la d’abord, aujourd’hui.`);
    expect(fr('Joue \'E4\' ou "D4" ; l\'1')).toBe(`Joue 'E4' ou "D4"${FINE}; l'1`);
    expect(fr('déjà ’ typographique')).toBe('déjà ’ typographique');
  });

  it('est idempotente', () => {
    const t = 'Nouveau au go ? Pose ta pierre !';
    expect(fr(fr(t))).toBe(fr(t));
  });
});

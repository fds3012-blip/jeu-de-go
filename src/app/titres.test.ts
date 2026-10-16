// Titres mensuels (#561) : lecture des lignes, mois de Paris, titre du mois dernier, fête une seule fois, noms et sceaux.
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { aFeter, lireMoisFete, lireTitres, moisPrecedent, POURCENT, TITRES, titreDuMoisDernier, type TitreDuMois } from './titres';
import { nomMois, nomTitre, traduireTitres } from '../content/i18n/titres';
import { SceauTitre } from '../ui/SceauTitre';
import { ajouter, avancer, FILE_VIDE, terminer } from '../ui/fileFetes';

const paris = (iso: string) => Date.parse(iso);

describe('lecture des titres', () => {
  it('garde les lignes bien formées, du plus récent au plus ancien', () => {
    expect(lireTitres([
      { mois: '2026-08-01', titre: 'habitue' },
      { mois: '2026-09-01', titre: 'expert' },
      { mois: '2026-09-15', titre: 'maitre' }, // pas un 1er du mois
      { mois: '2026-07-01', titre: 'champion' }, // titre inconnu
      null, 'x', { mois: 202609, titre: 'expert' },
    ])).toEqual([{ mois: '2026-09-01', titre: 'expert' }, { mois: '2026-08-01', titre: 'habitue' }]);
    expect(lireTitres(null)).toEqual([]);
    expect(lireTitres({ mois: '2026-09-01', titre: 'expert' })).toEqual([]);
  });
});

describe('mois de Paris', () => {
  it('le mois précédent suit le calendrier de Paris, pas celui d’UTC', () => {
    expect(moisPrecedent(paris('2026-10-16T12:00:00Z'))).toBe('2026-09-01');
    // 1er octobre à 0 h 30 à Paris = 30 septembre 22 h 30 UTC : on est déjà en octobre à Paris.
    expect(moisPrecedent(paris('2026-09-30T22:30:00Z'))).toBe('2026-09-01');
    expect(moisPrecedent(paris('2026-09-30T21:30:00Z'))).toBe('2026-08-01');
    // Janvier : décembre de l'année d'avant (heure d'hiver).
    expect(moisPrecedent(paris('2027-01-01T00:30:00Z'))).toBe('2026-12-01');
    expect(moisPrecedent(paris('2026-12-31T22:59:00Z'))).toBe('2026-11-01');
  });

  it('titre du mois dernier : seulement celui du mois qui vient de finir', () => {
    const titres: TitreDuMois[] = [{ mois: '2026-09-01', titre: 'expert' }, { mois: '2026-07-01', titre: 'maitre' }];
    expect(titreDuMoisDernier(titres, paris('2026-10-02T10:00:00Z'))).toEqual({ mois: '2026-09-01', titre: 'expert' });
    // En novembre, le titre de septembre n'est plus « le mois dernier » ; celui de juillet non plus.
    expect(titreDuMoisDernier(titres, paris('2026-11-02T10:00:00Z'))).toBeNull();
    // Garde-fou : sous 200 actifs, le serveur n'écrit rien : aucune ligne, aucun titre.
    expect(titreDuMoisDernier([], paris('2026-10-02T10:00:00Z'))).toBeNull();
  });
});

describe('fête une seule fois', () => {
  const septembre: TitreDuMois = { mois: '2026-09-01', titre: 'expert' };
  it('un titre jamais fêté : oui ; déjà fêté : non ; plus ancien que le dernier fêté : non', () => {
    expect(aFeter(septembre, null)).toBe(true);
    expect(aFeter(septembre, '2026-09-01')).toBe(false);
    expect(aFeter(septembre, '2026-10-01')).toBe(false);
    expect(aFeter({ mois: '2026-10-01', titre: 'maitre' }, '2026-09-01')).toBe(true);
    expect(aFeter(null, null)).toBe(false);
  });

  it('ouverture, fête notée, réouverture : une seule fête', () => {
    let stocke: unknown = null;
    let fetes = 0;
    for (let ouverture = 0; ouverture < 3; ouverture++) {
      if (aFeter(septembre, lireMoisFete(stocke))) { fetes++; stocke = septembre.mois; }
    }
    expect(fetes).toBe(1);
  });

  it('repère abîmé : relu comme absent', () => {
    expect(lireMoisFete('2026-09')).toBeNull();
    expect(lireMoisFete(42)).toBeNull();
    expect(lireMoisFete('2026-09-01')).toBe('2026-09-01');
  });

  it('dans la file : après l’XP et le niveau, avant les propositions ; une seule à la fois', () => {
    let e = ajouter(FILE_VIDE, { genre: 'installation' });
    e = ajouter(e, { genre: 'titre' });
    e = ajouter(e, { genre: 'titre' });
    e = ajouter(e, { genre: 'niveau', niveau: 3 });
    expect(e.attente.map(f => f.genre)).toEqual(['niveau', 'titre', 'installation']);
    e = avancer(terminer(avancer(e)));
    expect(e.actif).toEqual({ genre: 'titre' });
  });
});

describe('noms et sceaux', () => {
  it('trois titres, du plus haut au plus bas, avec leur part des joueurs actifs (rappel des coupures du serveur)', () => {
    expect(TITRES).toEqual(['maitre', 'expert', 'habitue']);
    expect(TITRES.map(t => POURCENT[t])).toEqual([1, 5, 20]);
    const migration = readFileSync(new URL('../../supabase/migrations/20261016150000_titres_mensuels.sql', import.meta.url), 'utf8');
    for (const t of TITRES) expect(migration).toContain(`'${t}'`);
    expect(migration).toMatch(/ceil\(v_actifs \* 0\.01\)[\s\S]*ceil\(v_actifs \* 0\.05\)[\s\S]*ceil\(v_actifs \* 0\.20\)/);
    expect(migration).toMatch(/v_min_actifs constant integer := 200/);
    expect(migration).toMatch(/v_min_parties constant integer := 10/);
  });

  it('noms en français et en anglais, mois dans la langue', () => {
    expect(TITRES.map(t => nomTitre(t, 'fr'))).toEqual(['Maître du mois', 'Expert du mois', 'Habitué du mois']);
    expect(TITRES.map(t => nomTitre(t, 'en'))).toEqual(['Master of the month', 'Expert of the month', 'Regular of the month']);
    expect(nomMois('2026-09-01', 'fr')).toBe('septembre');
    expect(nomMois('2026-09-01', 'en')).toBe('September');
    expect(traduireTitres('fr', 'titres.fete', { titre: 'Expert du mois' })).toBe('Nouveau titre : Expert du mois !');
  });

  it('un sceau par titre : encre du palier, 1, 2 ou 3 pierres ; décoratif', () => {
    const rendu = (t: (typeof TITRES)[number]) => renderToStaticMarkup(createElement(SceauTitre, { titre: t }));
    expect(TITRES.map(t => (rendu(t).match(/<circle/g) ?? []).length)).toEqual([3, 2, 1]);
    expect(rendu('habitue')).toContain('#D2432C');
    expect(rendu('expert')).toContain('#2F4B8A');
    expect(rendu('maitre')).toContain('#E9B949');
    for (const t of TITRES) expect(rendu(t)).toContain('aria-hidden="true"');
  });
});

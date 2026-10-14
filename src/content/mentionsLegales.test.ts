// Mentions légales (#530) : parité FR/EN, champs à compléter bien marqués (aucune identité inventée), textes de
// « Mes données » (parité, tutoiement, variables).
import { describe, expect, it } from 'vitest';
import { ADRESSE_MENTIONS, MENTIONS, champsACompleter, morceaux } from './mentionsLegales';
import { CATALOGUE_DONNEES, traduireDonnees, type CleDonnees } from './i18n/donnees';

describe('mentions légales', () => {
  it('mêmes sections, mêmes paragraphes et mêmes champs à compléter en français et en anglais', () => {
    const fr = MENTIONS.fr, en = MENTIONS.en;
    expect(en.sections.map(s => s.id)).toEqual(fr.sections.map(s => s.id));
    fr.sections.forEach((s, i) => {
      expect(en.sections[i].paragraphes.length, s.id).toBe(s.paragraphes.length);
      s.paragraphes.forEach((p, j) => {
        const champs = (t: string) => morceaux(t).filter(m => 'aCompleter' in m).length;
        const liens = (t: string) => morceaux(t).flatMap(m => ('lien' in m ? [m.adresse.replace('?lang=en', '')] : []));
        expect(champs(en.sections[i].paragraphes[j]), `${s.id} ${j}`).toBe(champs(p));
        expect(liens(en.sections[i].paragraphes[j]), `${s.id} ${j}`).toEqual(liens(p));
      });
    });
    expect(champsACompleter('en')).toHaveLength(champsACompleter('fr').length);
  });

  it('éditeur, adresse, contact, directeur de la publication, DPO et date restent à compléter par l’éditeur', () => {
    const champs = champsACompleter('fr').join(' | ');
    for (const attendu of [/raison sociale/, /adresse postale/, /e-mail de contact/, /téléphone/, /directeur de la publication/, /DPO/, /date/]) {
      expect(champs).toMatch(attendu);
    }
    // Aucune valeur inventée là où l'éditeur doit répondre : pas d'adresse, d'e-mail ni de numéro écrits en dur.
    const texte = JSON.stringify(MENTIONS);
    expect(texte).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    expect(texte).not.toMatch(/\b\d{5}\b/);
    expect(texte).not.toMatch(/\+?\d[\d .]{8,}\d/);
  });

  it('cite les hébergeurs et leurs régions, et renvoie à la politique de confidentialité', () => {
    for (const l of ['fr', 'en'] as const) {
      const t = JSON.stringify(MENTIONS[l]);
      expect(t).toMatch(/Vercel Inc\./);
      expect(t).toMatch(/Supabase Inc\./);
      expect(t).toMatch(/eu-west-3/);
      expect(t).toMatch(/\]\(\/confidentialite/);
    }
    expect(ADRESSE_MENTIONS).toEqual({ fr: '/mentions-legales/', en: '/en/legal-notice/' });
  });

  it('découpe texte, champs et liens', () => {
    expect(morceaux('A {{x}} et [lien](/b).')).toEqual([{ texte: 'A ' }, { aCompleter: 'x' }, { texte: ' et ' }, { lien: 'lien', adresse: '/b' }, { texte: '.' }]);
    expect(morceaux('rien')).toEqual([{ texte: 'rien' }]);
  });
});

describe('textes de « Mes données »', () => {
  const cles = Object.keys(CATALOGUE_DONNEES.fr) as CleDonnees[];
  it('chaque clé a un texte non vide en français et en anglais, avec les mêmes variables', () => {
    for (const k of cles) {
      expect(CATALOGUE_DONNEES.fr[k].trim(), k).not.toBe('');
      expect(CATALOGUE_DONNEES.en[k].trim(), k).not.toBe('');
      const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
      expect(vars(CATALOGUE_DONNEES.en[k]), k).toEqual(vars(CATALOGUE_DONNEES.fr[k]));
    }
    expect(Object.keys(CATALOGUE_DONNEES.en).sort()).toEqual([...cles].sort());
  });

  it('tutoiement, phrases courtes', () => {
    for (const k of cles) {
      expect(CATALOGUE_DONNEES.fr[k], k).not.toMatch(/\b(vous|votre|vos)\b/i);
      for (const phrase of CATALOGUE_DONNEES.fr[k].split(/[.!?]\s/)) expect(phrase.split(/\s+/).length, k).toBeLessThanOrEqual(40);
    }
  });

  it('variables remplacées', () => {
    expect(traduireDonnees('fr', 'donnees.limite', { n: 12 })).toBe('Tu as déjà téléchargé tes données 3 fois en une heure. Réessaie dans 12 min.');
    expect(traduireDonnees('en', 'donnees.fait', { fichier: 'f.json' })).toBe('Done: f.json is in your downloads.');
  });
});

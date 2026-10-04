// Réglages de connexion Supabase versionnés (#414) : contrôle des fichiers, sans réseau.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ecarts, erreurs, reglages } from './config-auth.mjs';

describe('réglages de connexion Supabase (#414)', () => {
  const r = reglages();

  it('les fichiers du dépôt sont valides', () => {
    expect(erreurs(r)).toEqual([]);
  });

  it('le code envoyé a la longueur attendue par l’app', () => {
    const app = readFileSync(new URL('../src/data/account.ts', import.meta.url), 'utf8');
    const longueur = Number(/LONGUEUR_CODE\s*=\s*(\d+)/.exec(app)?.[1]);
    expect(r.mailer_otp_length).toBe(longueur);
  });

  it('aucun secret dans le dépôt : une clé de secret est refusée', () => {
    expect(erreurs({ ...r, smtp_pass: 'x' })).toContain('clé interdite (secret) : smtp_pass');
    expect(erreurs({ ...r, external_google_secret: 'x' })).toContain('clé interdite (secret) : external_google_secret');
  });

  it('un modèle sans code est refusé', () => {
    expect(erreurs({ ...r, mailer_templates_magic_link_content: '<p>Bonjour</p>' }))
      .toContain('mailer_templates_magic_link_content doit contenir {{ .Token }}');
  });

  it('textes en français, marque Mochi Go, adresse de production', () => {
    expect(r.site_url).toBe('https://mochi-go.app');
    expect(r.uri_allow_list).toContain('https://mochi-go.app/**');
    expect(r.uri_allow_list).toContain('https://jeu-de-go.vercel.app/**');
    expect(r.mailer_subjects_magic_link).toMatch(/Mochi Go/);
    expect(r.mailer_templates_confirmation_content).toMatch(/pseudo/);
  });

  it('les écarts ne donnent que des noms de clés, jamais de valeurs', () => {
    expect(ecarts({ a: 1, b: 'x' }, { a: 1, b: 'y', smtp_pass: 'secret' })).toEqual(['b']);
  });
});

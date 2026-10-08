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

  it('#473 : chaque e-mail et chaque objet existe en anglais (user_metadata.langue = en) et en français, code dans les deux', () => {
    // Condition sûre même sans `langue` (comptes créés avant #473) : printf rend « <no value> », donc le français.
    // Rendu vérifié avec text/template et html/template de Go (moteur des modèles Supabase) : en, fr, vide, absent.
    const SI = '{{ if eq (printf "%v" .Data.langue) "en" }}';
    for (const cle of ['mailer_subjects_magic_link', 'mailer_subjects_confirmation', 'mailer_subjects_email_change',
      'mailer_templates_magic_link_content', 'mailer_templates_confirmation_content', 'mailer_templates_email_change_content']) {
      const v = r[cle];
      expect(v.startsWith(SI), cle).toBe(true);
      expect(v.trim().endsWith('{{ end }}'), cle).toBe(true);
      const [anglais, francais] = v.slice(SI.length, v.trim().length - '{{ end }}'.length).split('{{ else }}');
      expect(francais, cle).toBeDefined();
      for (const branche of [anglais, francais]) expect(branche, cle).toContain('{{ .Token }}');
      expect(anglais, cle).not.toMatch(/[àâçéèêîôûœ]|\b(ton|ta|tes|tu|code pour)\b/i);
      expect(francais, cle).toMatch(/\b(ton|ta|tu)\b/);
      if (cle.includes('content')) for (const branche of [anglais, francais]) expect(branche, cle).toContain('{{ .ConfirmationURL }}');
    }
  });

  it('les écarts ne donnent que des noms de clés, jamais de valeurs', () => {
    expect(ecarts({ a: 1, b: 'x' }, { a: 1, b: 'y', smtp_pass: 'secret' })).toEqual(['b']);
  });
});

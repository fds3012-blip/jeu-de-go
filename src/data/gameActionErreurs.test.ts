// #578 (revue de sécurité) : la fonction serveur `game-action` ne renvoie jamais un message SQL brut au client.
// Le client affiche le `message` français tel quel (src/content/i18n/refus.ts) : un message de Postgres y montrerait
// des noms de tables, de colonnes ou de contraintes. Les erreurs de la base passent par un code traduit.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { refusDepuisSql } from '../go/defi-action';

const index = readFileSync(fileURLToPath(new URL('../../supabase/functions/game-action/index.ts', import.meta.url)), 'utf8');

describe('game-action : erreurs de la base', () => {
  it('aucun error.message renvoyé au client (refuse ou json)', () => {
    expect(index).not.toMatch(/refuse\([^)]*error\.message/);
    expect(index).not.toMatch(/json\([^)]*error\.message/);
    // Les messages bruts vont seulement dans les journaux de la fonction.
    expect(index).toMatch(/console\.error\('finish_game_by_score'/);
    expect(index).toMatch(/refusDepuisSql\(/);
  });

  it('une erreur SQL inconnue devient un refus générique, sans le texte de Postgres', () => {
    const r = refusDepuisSql({ code: '23505', message: 'duplicate key value violates unique constraint "games_pkey"' });
    expect(r).toEqual({ status: 500, body: { ok: false, error: 'ecriture', message: 'Impossible d’enregistrer.' } });
    expect(JSON.stringify(r)).not.toMatch(/games_pkey|constraint/);
  });
});

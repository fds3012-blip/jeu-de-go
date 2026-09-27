import { createSupabase } from './supabase';

describe('createSupabase', () => {
  it('vaut null sans variables d’environnement (mode hors connexion)', () => {
    expect(createSupabase({})).toBeNull();
    expect(createSupabase({ VITE_SUPABASE_URL: 'https://exemple.supabase.co' })).toBeNull();
    expect(createSupabase({ VITE_SUPABASE_ANON_KEY: 'cle' })).toBeNull();
    expect(createSupabase({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: ' ' })).toBeNull();
  });

  it('vaut null si l’URL est invalide', () => {
    expect(createSupabase({ VITE_SUPABASE_URL: 'pas une url', VITE_SUPABASE_ANON_KEY: 'cle' })).toBeNull();
  });

  it('crée un client quand les deux variables sont présentes', () => {
    const db = createSupabase({ VITE_SUPABASE_URL: 'https://exemple.supabase.co', VITE_SUPABASE_ANON_KEY: 'cle-publique' });
    expect(db).not.toBeNull();
    expect(typeof db?.auth.signInWithOtp).toBe('function');
  });
});

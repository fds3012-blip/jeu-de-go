# Lots de problèmes

Un fichier `.ts` par lot, qui fait `export default` un tableau de `PuzzleRow`. Le format est le même que dans `../puzzles.ts`. Chaque lot est chargé automatiquement dans `ALL_PUZZLES`, trié par difficulté.

Pour chaque lot :

- **Identifiants** : un préfixe propre au lot, pour éviter toute collision.
- **Migration** : une migration d'insertion dans `supabase/migrations`, identique au fichier du lot. Pas de `delete`, pas d'`update`, et `on conflict (id) do nothing`.
- **Test** : un test `src/go/*.test.ts` qui prouve chaque problème.
  - La position de départ est légale.
  - La réponse atteint l'objectif, quelle que soit la défense.
  - Les réponses acceptées sont exactement les coups gagnants.

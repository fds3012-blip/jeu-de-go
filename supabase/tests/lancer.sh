#!/usr/bin/env bash
# Rejoue toutes les migrations sur un Postgres 16 jetable, puis lance les tests SQL de supabase/tests/*.test.sql.
# Aucune connexion au projet de production : tout se passe dans un dossier temporaire, effacé à la fin.
# Usage : bash supabase/tests/lancer.sh   (Postgres 16 installé : initdb, pg_ctl, psql)
# Contre une base Supabase locale ou une branche : psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/<fichier>.test.sql
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
racine="$(cd "$ici/../.." && pwd)"
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
tmp="$(mktemp -d)"
port="${PG_PORT:-54329}"
executer() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
[ "$(id -u)" = 0 ] && chown postgres "$tmp"
arreter() { executer "'$bin/pg_ctl' -D '$tmp/data' -m immediate stop" >/dev/null 2>&1 || true; rm -rf "$tmp"; }
trap arreter EXIT
executer "'$bin/initdb' -D '$tmp/data' -U postgres -A trust" >/dev/null
executer "'$bin/pg_ctl' -D '$tmp/data' -o \"-p $port -k $tmp -c listen_addresses='' -c wal_level=logical\" -l '$tmp/log' -w start" >/dev/null
psql_() { psql -h "$tmp" -p "$port" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }
psql_ -f "$ici/supabase_minimal.sql" >/dev/null
version="$(psql_ -At -c 'show server_version_num')"
for f in "$racine"/supabase/migrations/*.sql; do
  # Le privilège MAINTAIN n'existe qu'à partir de Postgres 17 (la production est en 17).
  if [ "$version" -lt 170000 ] && grep -qi 'revoke maintain' "$f"; then echo "Ignorée (Postgres < 17) : $(basename "$f")"; continue; fi
  psql_ -f "$f" >/dev/null 2>"$tmp/err" || { echo "Migration en échec : $(basename "$f")"; cat "$tmp/err"; exit 1; }
done
echo "Migrations appliquées."
statut=0
for t in "$ici"/*.test.sql; do
  if psql_ -f "$t" 2>&1; then echo "OK  $(basename "$t")"; else echo "ÉCHEC  $(basename "$t")"; statut=1; fi
done
exit $statut

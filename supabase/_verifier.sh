#!/data/data/com.termux/files/usr/bin/bash
# Rejoue le schéma AbsenceTrack sur un PostgreSQL local + les vérifications.
# Usage : bash supabase/_verifier.sh
set -e

SOCK="$HOME/pgsock"
PORT=5439
PGDATA="$HOME/pgdata_at"
DB=at_verif
Q="psql -h $SOCK -p $PORT -U postgres"

# 1) serveur local (demarre si besoin)
if ! $Q -d postgres -c 'select 1' >/dev/null 2>&1; then
  echo "[*] demarrage du PostgreSQL local..."
  pg_ctl -D "$PGDATA" -o "-k $SOCK -p $PORT" -l "$HOME/pglog.txt" start
  sleep 2
fi

# 2) base neuve a chaque passage
$Q -d postgres -q -c "drop database if exists $DB" >/dev/null
$Q -d postgres -q -c "create database $DB"
P="psql -h $SOCK -p $PORT -U postgres -d $DB -q"
$P -c "create role authenticated" 2>/dev/null || true
$P -c "create role anon"          2>/dev/null || true
$P -c "create schema if not exists auth"
$P -c "create table if not exists auth.users(id uuid primary key, email text)"
$P -c "create or replace function auth.uid() returns uuid language sql stable as \$\$
       select nullif(current_setting('app.uid', true), '')::uuid \$\$"
# Supabase accorde « all » a authenticated/anon des la creation de chaque table
$P -c "alter default privileges in schema public grant all on tables to authenticated, anon"
$P -c "alter default privileges in schema public grant all on sequences to authenticated, anon"

# 3) le schema, en mode strict : la moindre erreur arrete tout
echo "[*] application de supabase/schema.sql (mode strict)..."
psql -h $SOCK -p $PORT -U postgres -d $DB -q -v ON_ERROR_STOP=1 \
  -f "$(dirname "$0")/schema.sql" >/dev/null
echo "[OK] schema applique sans erreur"

# 4) les verifications : la sortie brute est gardee, le verdict est lisible
echo ""
SORTIE="$HOME/verif_absencetrack.txt"
psql -h $SOCK -p $PORT -U postgres -d $DB -f "$(dirname "$0")/verif_schema.sql" > "$SORTIE" 2>&1 || true
python "$(dirname "$0")/_rapport.py" "$SORTIE"
echo ""
echo "(sortie brute conservee dans $SORTIE)"

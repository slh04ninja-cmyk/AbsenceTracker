#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Rejoue les migrations AbsenceTrack sur un PostgreSQL et lance les bancs d'essai.
#
#   usage local (Termux)  : bash supabase/_verifier.sh
#       -> démarre le PostgreSQL local ($HOME/pgdata_at, socket $HOME/pgsock:5439)
#   usage CI / autre base : AT_DB_HOST=localhost AT_DB_PORT=5432 PGPASSWORD=... \
#                           bash supabase/_verifier.sh
#
# Chaque banc d'essai tourne dans SA PROPRE base : les données et les droits d'un
# banc ne peuvent pas influencer le verdict d'un autre (piège déjà rencontré).
# ---------------------------------------------------------------------------
set -e

ICI="$(dirname "$0")"

if [ -n "$AT_DB_HOST" ]; then                 # PostgreSQL déjà en place (CI)
  SERVEUR="-h $AT_DB_HOST -p ${AT_DB_PORT:-5432}"
  DEMARRER=0
else                                          # Termux : socket local + démarrage auto
  SOCK="$HOME/pgsock"
  PORT=5439
  PGDATA="$HOME/pgdata_at"
  SERVEUR="-h $SOCK -p $PORT"
  DEMARRER=1
fi
Q="psql $SERVEUR -U postgres"

if [ "$DEMARRER" = "1" ]; then
  if ! $Q -d postgres -c 'select 1' >/dev/null 2>&1; then
    echo "[*] demarrage du PostgreSQL local..."
    pg_ctl -D "$PGDATA" -o "-k $SOCK -p $PORT" -l "$HOME/pglog.txt" start
    sleep 2
  fi
fi

# prepare_base <nom_de_base> : base neuve + le minimum que Supabase fournit
prepare_base() {
  local DB="$1"
  $Q -d postgres -q -c "drop database if exists $DB" >/dev/null
  $Q -d postgres -q -c "create database $DB"
  local P="psql $SERVEUR -U postgres -d $DB -q"
  $P -c "create role authenticated" 2>/dev/null || true
  $P -c "create role anon"          2>/dev/null || true
  $P -c "create schema if not exists auth"
  $P -c "create table if not exists auth.users(id uuid primary key, email text)"
  $P -c "create or replace function auth.uid() returns uuid language sql stable as \$\$
         select nullif(current_setting('app.uid', true), '')::uuid \$\$"
  # Supabase accorde « all » a authenticated/anon des la creation de chaque objet
  $P -c "alter default privileges in schema public grant all on tables to authenticated, anon"
  $P -c "alter default privileges in schema public grant all on sequences to authenticated, anon"
  $P -c "alter default privileges in schema public grant all on functions to authenticated, anon"
  # les migrations, dans l'ordre, en mode strict
  local f
  for f in "$ICI"/migrations/*.sql; do
    echo "    - migrations/$(basename "$f")"
    psql $SERVEUR -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
  done
}

ECHEC=0
for t in "$ICI"/tests/verif_*.sql; do
  BASE="at_$(basename "$t" .sql)"
  echo ""
  echo "=================================================================="
  echo "== $(basename "$t")   (base neuve : $BASE)"
  echo "=================================================================="
  prepare_base "$BASE"
  SORTIE="$HOME/$(basename "$t" .sql)_sortie.txt"
  psql $SERVEUR -U postgres -d "$BASE" -f "$t" > "$SORTIE" 2>&1 || true
  PY="$(command -v python3 || command -v python)"
  "$PY" "$ICI/_rapport.py" "$SORTIE" "$t" || ECHEC=1
  echo "(sortie brute : $SORTIE)"
done

echo ""
if [ "$ECHEC" = "0" ]; then
  echo "[OK] migrations appliquees et tous les bancs d'essai au vert."
else
  echo "[ATTENTION] au moins un banc d'essai a des cas inattendus."
fi
exit $ECHEC

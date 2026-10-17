#!/usr/bin/env bash

# SQLite snapshot via the online backup API. Writes a database file to $1.
# Never copy a live database with cp: in WAL mode recent writes live in the -wal file.

dump_sqlite() {
  local out_db="$1"
  local src
  src=$(sqlite_database_path "$DATABASE_URL")

  require_cmd sqlite3

  # sqlite3 would create an empty database at a mistyped path and back that up
  [ -f "$src" ] || die "SQLite database not found: $src"
  [[ "$out_db" != *"'"* ]] || die "backup path must not contain a single quote: $out_db"

  if ! sqlite3 -bail -cmd ".timeout 10000" "$src" ".backup '$out_db'"; then
    rm -f "$out_db"
    die "sqlite3 .backup failed"
  fi

  # The copy keeps the source's WAL mode; switch it back so the archive is one self-contained file
  if [ "$(sqlite3 "$out_db" 'PRAGMA journal_mode=DELETE;' 'PRAGMA quick_check;' | tail -1)" != "ok" ]; then
    rm -f "$out_db"
    die "snapshot failed quick_check"
  fi
}

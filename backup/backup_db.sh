#!/usr/bin/env bash
# Backup PostgreSQL, MySQL or SQLite to a zip archive and upload to configured storage(s).
# Config: copy .env.example → .env (or export vars). See README.md.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"
# shellcheck source=lib/db_url.sh
source "${SCRIPT_DIR}/lib/db_url.sh"

load_dotenv "${SCRIPT_DIR}/.env"

# Defaults (only applied when unset after env / .env)
: "${DATABASE_URL:=postgres://root:pass@localhost:5432/smartcity_prod}"
# DB_ENGINE must be set in .env (postgres | mysql | sqlite) — no URL auto-detect
: "${STORAGE_TYPE:=gcs}"
: "${GCS_BUCKET:=your-backup-bucket}"
: "${GCS_CREDENTIALS:=}"
: "${GCS_PREFIX:=${GCS_PREFIX_DB:-db}}"
: "${LOCAL_DIR:=}"
: "${LOCAL_PREFIX:=${LOCAL_PREFIX_DB:-db}}"
: "${S3_BUCKET:=}"
: "${S3_REGION:=}"
: "${S3_PREFIX:=${S3_PREFIX_DB:-db}}"
: "${RETENTION_DAYS:=14}"
: "${KEEP_LOCAL:=0}"

resolve_db_engine
export DB_ENGINE

case "$DB_ENGINE" in
  postgres)
    # shellcheck source=lib/db_postgres.sh
    source "${SCRIPT_DIR}/lib/db_postgres.sh"
    ;;
  mysql)
    # shellcheck source=lib/db_mysql.sh
    source "${SCRIPT_DIR}/lib/db_mysql.sh"
    ;;
  sqlite)
    # shellcheck source=lib/db_sqlite.sh
    source "${SCRIPT_DIR}/lib/db_sqlite.sh"
    ;;
  *)
    die "unsupported DB_ENGINE: $DB_ENGINE"
    ;;
esac

# shellcheck source=lib/storage.sh
source "${SCRIPT_DIR}/lib/storage.sh"

require_cmd zip
require_cmd unzip

TIMESTAMP=$(backup_timestamp)
# SQLite backs up the database file itself, the others a SQL dump
if [ "$DB_ENGINE" = "sqlite" ]; then DUMP_EXT=db; else DUMP_EXT=sql; fi
DUMP_FILE="${SCRIPT_DIR}/db_${TIMESTAMP}.${DUMP_EXT}"
ZIP_FILE="${DUMP_FILE}.zip"

cleanup_partial() {
  rm -f "$DUMP_FILE" "${DUMP_FILE}.raw" "${DUMP_FILE}-wal" "${DUMP_FILE}-shm"
  if [ -f "$ZIP_FILE" ] && [ "${UPLOAD_OK:-0}" != "1" ]; then
    rm -f "$ZIP_FILE"
  fi
}
trap cleanup_partial EXIT

log "Starting DB backup (engine=$DB_ENGINE)"
case "$DB_ENGINE" in
  postgres)
    log "Database host: $(database_url_host "$DATABASE_URL")"
    dump_postgres "$DUMP_FILE"
    ;;
  mysql)
    log "Database host: $(database_url_host "$DATABASE_URL")"
    dump_mysql "$DUMP_FILE"
    ;;
  sqlite)
    log "Database file: $(sqlite_database_path "$DATABASE_URL")"
    dump_sqlite "$DUMP_FILE"
    ;;
esac

if ! zip_file "$DUMP_FILE" "$ZIP_FILE"; then
  die "failed to create zip archive"
fi
rm -f "$DUMP_FILE"

SIZE=$(du -h "$ZIP_FILE" | cut -f1)
log "Created $ZIP_FILE ($SIZE)"

storage_upload "$ZIP_FILE"
UPLOAD_OK=1
log "Upload complete"

if [ "$KEEP_LOCAL" != "1" ]; then
  rm -f "$ZIP_FILE"
  log "Removed local zip (KEEP_LOCAL=0)"
fi

prune_local "$SCRIPT_DIR" "db" "$RETENTION_DAYS"
prune_remote "$RETENTION_DAYS"

log "DB backup finished"

#!/bin/bash
# ─────────────────────────────────────────────────────
# Credit Repair Pro — Automated Database Backup Script
# ─────────────────────────────────────────────────────
# Usage:
#   ./scripts/backup-db.sh                    # Full backup
#   ./scripts/backup-db.sh --data-only        # Data only (no schema)
#   ./scripts/backup-db.sh --schema-only      # Schema only
#
# Environment variables (with defaults):
#   POSTGRES_USER     (default: creditrepair)
#   POSTGRES_DB       (default: creditrepair)
#   POSTGRES_HOST     (default: postgres)
#   BACKUP_DIR        (default: /backups)
#   BACKUP_RETENTION  (default: 30 days)
#   BACKUP_COMPRESS   (default: true)
#
# Recommended cron (daily at 2 AM):
#   0 2 * * * /app/scripts/backup-db.sh >> /var/log/backup.log 2>&1
# ─────────────────────────────────────────────────────

set -euo pipefail

# ─── Configuration ───────────────────────────────────
POSTGRES_USER="${POSTGRES_USER:-creditrepair}"
POSTGRES_DB="${POSTGRES_DB:-creditrepair}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-30}"  # days
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="creditrepair_${TIMESTAMP}"
MODE="${1:-full}"

# ─── Colors ──────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN:${NC}  $1"; }
log_error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"; }

# ─── Ensure backup directory exists ──────────────────
mkdir -p "${BACKUP_DIR}/daily"
mkdir -p "${BACKUP_DIR}/weekly"
mkdir -p "${BACKUP_DIR}/monthly"

# ─── Determine backup type ──────────────────────────
PG_DUMP_OPTS="--no-owner --no-acl --if-exists --clean"

case "$MODE" in
  --data-only)
    PG_DUMP_OPTS="${PG_DUMP_OPTS} --data-only"
    BACKUP_NAME="${BACKUP_NAME}_data"
    log_info "Starting DATA-ONLY backup..."
    ;;
  --schema-only)
    PG_DUMP_OPTS="${PG_DUMP_OPTS} --schema-only"
    BACKUP_NAME="${BACKUP_NAME}_schema"
    log_info "Starting SCHEMA-ONLY backup..."
    ;;
  *)
    log_info "Starting FULL backup..."
    ;;
esac

# ─── Pre-flight checks ──────────────────────────────
log_info "Database: ${POSTGRES_DB}@${POSTGRES_HOST}:${POSTGRES_PORT}"

# Test database connectivity
if ! pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -q 2>/dev/null; then
  log_error "Database is not reachable at ${POSTGRES_HOST}:${POSTGRES_PORT}"
  exit 1
fi

# ─── Execute backup ─────────────────────────────────
BACKUP_FILE="${BACKUP_DIR}/daily/${BACKUP_NAME}.sql.gz"
START_TIME=$(date +%s)

log_info "Backing up to: ${BACKUP_FILE}"

pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --format=plain \
  ${PG_DUMP_OPTS} \
  | gzip -9 > "${BACKUP_FILE}"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
FILE_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)

log_info "Backup completed in ${DURATION}s — Size: ${FILE_SIZE}"

# ─── Create weekly backup (every Sunday) ────────────
DAY_OF_WEEK=$(date +%u)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
  WEEKLY_FILE="${BACKUP_DIR}/weekly/${BACKUP_NAME}_weekly.sql.gz"
  cp "${BACKUP_FILE}" "${WEEKLY_FILE}"
  log_info "Weekly backup created: ${WEEKLY_FILE}"
fi

# ─── Create monthly backup (1st of month) ───────────
DAY_OF_MONTH=$(date +%d)
if [ "$DAY_OF_MONTH" -eq "01" ]; then
  MONTHLY_FILE="${BACKUP_DIR}/monthly/${BACKUP_NAME}_monthly.sql.gz"
  cp "${BACKUP_FILE}" "${MONTHLY_FILE}"
  log_info "Monthly backup created: ${MONTHLY_FILE}"
fi

# ─── Cleanup old backups ────────────────────────────
log_info "Cleaning up backups older than ${BACKUP_RETENTION} days..."

DELETED_DAILY=$(find "${BACKUP_DIR}/daily" -name "*.sql.gz" -mtime "+${BACKUP_RETENTION}" -delete -print | wc -l)
DELETED_WEEKLY=$(find "${BACKUP_DIR}/weekly" -name "*.sql.gz" -mtime "+90" -delete -print | wc -l)
DELETED_MONTHLY=$(find "${BACKUP_DIR}/monthly" -name "*.sql.gz" -mtime "+365" -delete -print | wc -l)

[ "$DELETED_DAILY" -gt 0 ] && log_info "Deleted ${DELETED_DAILY} old daily backup(s)"
[ "$DELETED_WEEKLY" -gt 0 ] && log_info "Deleted ${DELETED_WEEKLY} old weekly backup(s)"
[ "$DELETED_MONTHLY" -gt 0 ] && log_info "Deleted ${DELETED_MONTHLY} old monthly backup(s)"

# ─── Verify backup integrity ────────────────────────
if gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  log_info "✅ Backup integrity verified"
else
  log_error "❌ Backup file is corrupted!"
  exit 1
fi

# ─── Summary ─────────────────────────────────────────
TOTAL_BACKUPS=$(find "${BACKUP_DIR}" -name "*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

log_info "═══════════════════════════════════"
log_info "  Backup Summary"
log_info "  File:     ${BACKUP_FILE}"
log_info "  Size:     ${FILE_SIZE}"
log_info "  Duration: ${DURATION}s"
log_info "  Total backups on disk: ${TOTAL_BACKUPS} (${TOTAL_SIZE})"
log_info "═══════════════════════════════════"

exit 0

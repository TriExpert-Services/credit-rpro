#!/bin/bash
# ─────────────────────────────────────────────────────
# Credit Repair Pro — Database Restore Script
# ─────────────────────────────────────────────────────
# Usage:
#   ./scripts/restore-db.sh <backup_file.sql.gz>
#   ./scripts/restore-db.sh /backups/daily/creditrepair_20260208_020000.sql.gz
#
# ⚠️  WARNING: This will DROP and recreate the database!
# ─────────────────────────────────────────────────────

set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-creditrepair}"
POSTGRES_DB="${POSTGRES_DB:-creditrepair}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN:${NC}  $1"; }
log_error() { echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"; }

# ─── Validate input ─────────────────────────────────
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  log_error "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  find /backups -name "*.sql.gz" -printf "  %T+ %p (%s bytes)\n" 2>/dev/null | sort -r | head -20
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  log_error "Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

# ─── Verify integrity ───────────────────────────────
log_info "Verifying backup integrity..."
if ! gzip -t "${BACKUP_FILE}" 2>/dev/null; then
  log_error "Backup file is corrupted: ${BACKUP_FILE}"
  exit 1
fi
log_info "✅ Backup file is valid"

# ─── Confirm ─────────────────────────────────────────
FILE_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
log_warn "⚠️  This will RESTORE the database: ${POSTGRES_DB}"
log_warn "   From: ${BACKUP_FILE} (${FILE_SIZE})"
log_warn "   Host: ${POSTGRES_HOST}:${POSTGRES_PORT}"
echo ""

if [ -t 0 ]; then
  # Interactive terminal — ask for confirmation
  read -p "Are you sure? Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    log_info "Restore cancelled."
    exit 0
  fi
fi

# ─── Restore ─────────────────────────────────────────
START_TIME=$(date +%s)

log_info "Restoring database from backup..."

gunzip -c "${BACKUP_FILE}" | psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --single-transaction \
  --set ON_ERROR_STOP=1 \
  2>&1

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_info "═══════════════════════════════════"
log_info "  ✅ Database restored successfully"
log_info "  Duration: ${DURATION}s"
log_info "  Source: ${BACKUP_FILE}"
log_info "═══════════════════════════════════"

exit 0

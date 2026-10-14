#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# Remote Daily Database Backup
# Dumps PostgreSQL → CIFS share  \\192.168.1.25\backup\YYYY-MM-DD\
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
DB_NAME="prismv2"
DB_USER="prismuser"
PGPASSWORD="seed@2026"
export PGPASSWORD

SMB_HOST="130.1.23.208"
SMB_SHARE="BackUp_Attendance"
SMB_CREDS="/etc/samba/backup.creds"

MOUNT_POINT="/mnt/remote-backup"
LOG_FILE="/var/log/db-backup.log"

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }
fail() { log "ERROR: $*"; cleanup; exit 1; }

cleanup() {
  rm -f "$TMP_BACKUP" 2>/dev/null || true
  if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
    umount "$MOUNT_POINT" 2>/dev/null || true
    log "Remote share unmounted."
  fi
}
trap cleanup EXIT

# ── Variables ─────────────────────────────────────────────────────────────────
DATE=$(date '+%Y-%m-%d')
TIME=$(date '+%H%M')
TMP_BACKUP="/tmp/database_backup_${DATE}_${TIME}.backup"
REMOTE_DIR="${DATE}"
REMOTE_FILE="${REMOTE_DIR}/database_backup_${DATE}_${TIME}.backup"

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log "Database backup started"
log "Target: \\\\${SMB_HOST}\\${SMB_SHARE}\\${REMOTE_FILE}"

# ── Step 1: Dump database locally ─────────────────────────────────────────────
log "[1/4] Dumping database '${DB_NAME}'..."
if pg_dump -h localhost -U "$DB_USER" -Fc -d "$DB_NAME" -f "$TMP_BACKUP"; then
  SIZE=$(du -sh "$TMP_BACKUP" | cut -f1)
  log "[1/4] Dump complete — size: ${SIZE}"
else
  fail "pg_dump failed for database '${DB_NAME}'"
fi

# ── Step 2: Mount remote share ────────────────────────────────────────────────
log "[2/4] Mounting //${SMB_HOST}/${SMB_SHARE}..."
mkdir -p "$MOUNT_POINT"

if mountpoint -q "$MOUNT_POINT"; then
  log "[2/4] Share already mounted."
else
  if mount -t cifs "//${SMB_HOST}/${SMB_SHARE}" "$MOUNT_POINT" \
      -o credentials="${SMB_CREDS}",vers=3.0,iocharset=utf8,noperm; then
    log "[2/4] Share mounted at ${MOUNT_POINT}"
  else
    fail "Could not mount //${SMB_HOST}/${SMB_SHARE} — check network/credentials"
  fi
fi

# ── Step 3: Create dated folder ───────────────────────────────────────────────
log "[3/4] Creating backup folder: ${MOUNT_POINT}/${DATE}"
if ! mkdir -p "${MOUNT_POINT}/${DATE}"; then
  fail "Could not create folder '${DATE}' on remote share — check write permissions for user 'test'"
fi

# ── Step 4: Copy backup file ──────────────────────────────────────────────────
log "[4/4] Copying backup to remote share..."
if cp "$TMP_BACKUP" "${MOUNT_POINT}/${REMOTE_FILE}"; then
  FINAL_SIZE=$(du -sh "${MOUNT_POINT}/${REMOTE_FILE}" | cut -f1)
  log "[4/4] Backup saved: \\\\${SMB_HOST}\\${SMB_SHARE}\\${REMOTE_FILE} (${FINAL_SIZE})"
  log "Database backup completed successfully ✓"
else
  fail "Failed to copy backup file to remote share"
fi

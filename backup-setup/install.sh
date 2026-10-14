#!/bin/bash
# Run as root: sudo bash install.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/5] Installing SMB credentials..."
mkdir -p /etc/samba
cp "$SCRIPT_DIR/backup.creds" /etc/samba/backup.creds
chmod 600 /etc/samba/backup.creds
chown root:root /etc/samba/backup.creds

echo "[2/5] Installing backup script..."
cp "$SCRIPT_DIR/db-backup-remote.sh" /usr/local/bin/db-backup-remote.sh
chmod 755 /usr/local/bin/db-backup-remote.sh
chown root:root /usr/local/bin/db-backup-remote.sh

echo "[3/5] Installing cron job..."
cp "$SCRIPT_DIR/db-backup.cron" /etc/cron.d/db-backup
chmod 644 /etc/cron.d/db-backup
chown root:root /etc/cron.d/db-backup

echo "[4/5] Installing logrotate config..."
cp "$SCRIPT_DIR/db-backup-logrotate" /etc/logrotate.d/db-backup
chmod 644 /etc/logrotate.d/db-backup

echo "[5/5] Creating mount point and log file..."
mkdir -p /mnt/remote-backup
touch /var/log/db-backup.log
chmod 640 /var/log/db-backup.log

echo ""
echo "Installation complete!"
echo ""
echo "Files installed:"
echo "  /etc/samba/backup.creds          (SMB credentials)"
echo "  /usr/local/bin/db-backup-remote.sh  (backup script)"
echo "  /etc/cron.d/db-backup            (runs at 23:59 daily)"
echo "  /etc/logrotate.d/db-backup       (weekly log rotation)"
echo "  /mnt/remote-backup               (CIFS mount point)"
echo "  /var/log/db-backup.log           (backup log)"
echo ""
echo "To run a backup NOW (test run):"
echo "  sudo /usr/local/bin/db-backup-remote.sh"
echo ""
echo "To watch the log:"
echo "  tail -f /var/log/db-backup.log"

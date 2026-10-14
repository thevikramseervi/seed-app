#!/usr/bin/env bash
set -u

APP_DIR="/home/test/Desktop/full-stack-app"
PM2_APP_NAME_BACKEND="attendease-backend"
PM2_APP_NAME_HTTPS="attendease-https"
PG_CLUSTER="12 main"

cd "$APP_DIR" || {
  echo "App directory not found: $APP_DIR"
  exit 1
}

require_pm2() {
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "PM2 is not installed. Installing..."
    npm install -g pm2
  fi
}

start_postgres_if_needed() {
  if command -v pg_isready >/dev/null 2>&1; then
    if ! pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
      echo "PostgreSQL is not running. Starting it..."
      if command -v pg_ctlcluster >/dev/null 2>&1; then
        if command -v sudo >/dev/null 2>&1; then
          sudo pg_ctlcluster 12 main start || true
        else
          pg_ctlcluster 12 main start || true
        fi
      fi
    fi
  fi
}

start_app() {
  require_pm2
  start_postgres_if_needed

  if pm2 show "$PM2_APP_NAME_BACKEND" >/dev/null 2>&1; then
    echo "Backend app already running via PM2."
  else
    echo "Starting backend app..."
    pm2 start ecosystem.config.js --env production --update-env
  fi

  if ! pm2 show "$PM2_APP_NAME_BACKEND" >/dev/null 2>&1; then
    echo "Failed to start backend app. Check logs with: ./prod-app.sh logs"
    exit 1
  fi

  echo "Application started successfully."
  echo "Health checks:"
  curl -fsS http://127.0.0.1:3000/api/health/live || true
  curl -k -fsS https://130.1.35.63:8443/api/health/live || true
}

restart_app() {
  require_pm2
  start_postgres_if_needed
  echo "Restarting app stack..."
  pm2 restart all --update-env
  echo "Restart complete."
  pm2 status
}

stop_app() {
  require_pm2
  echo "Stopping app stack..."
  pm2 stop all || true
  pm2 delete all || true
  echo "Stopped."
}

show_logs() {
  require_pm2
  if [ "$#" -gt 0 ]; then
    pm2 logs "$@" --lines 200
  else
    pm2 logs --lines 200
  fi
}

show_status() {
  require_pm2
  pm2 status
}

health_check() {
  echo "=== Backend health ==="
  curl -sS -D - -o /tmp/backend-health.txt http://127.0.0.1:3000/api/health/live || true
  echo "---"
  cat /tmp/backend-health.txt 2>/dev/null || true

  echo "=== Frontend health ==="
  curl -k -sS -D - -o /tmp/frontend-health.txt https://130.1.35.63:8443/api/health/live || true
  echo "---"
  cat /tmp/frontend-health.txt 2>/dev/null || true
}

usage() {
  cat <<'EOF'
Usage:
  ./prod-app.sh start
  ./prod-app.sh restart
  ./prod-app.sh stop
  ./prod-app.sh logs [app-name]
  ./prod-app.sh status
  ./prod-app.sh health

Notes:
  - PM2 is used for auto-restart on crash.
  - ecosystem.config.js already contains autorestart=true for production.
EOF
}

case "${1:-}" in
  start)
    start_app
    ;;
  restart)
    restart_app
    ;;
  stop)
    stop_app
    ;;
  logs)
    shift
    show_logs "$@"
    ;;
  status)
    show_status
    ;;
  health)
    health_check
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
 esac

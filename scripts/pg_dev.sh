#!/usr/bin/env bash
# Start/stop/check the local dev Postgres (Postgres.app binaries, vendored under
# .tools/ -- no system install, no Docker required). See README.md for why.
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN=".tools/Postgres.app/Contents/Versions/16/bin"
PGDATA=".tools/pgdata"
LOG=".tools/pglogs/server.log"

case "${1:-}" in
  start)
    "$PGBIN/pg_ctl" -D "$PGDATA" -l "$LOG" -o "-p 5432 -k /tmp" start
    ;;
  stop)
    "$PGBIN/pg_ctl" -D "$PGDATA" stop -m fast
    ;;
  status)
    "$PGBIN/pg_ctl" -D "$PGDATA" status
    ;;
  psql)
    "$PGBIN/psql" -h localhost -p 5432 -U courtiq -d courtiq
    ;;
  *)
    echo "Usage: $0 {start|stop|status|psql}"
    exit 1
    ;;
esac

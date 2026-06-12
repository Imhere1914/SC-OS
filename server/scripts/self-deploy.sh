#!/bin/bash
# Gated self-deploy: staging -> live with build gate + health check + rollback
#
# Pipeline:
#   1. Build staging (/opt/ai-os-staging) — abort if the build fails (live untouched)
#   2. Snapshot live (/opt/ai-os) to /opt/ai-os-backup-last
#   3. Rsync staging over live (env files / node_modules / dist excluded)
#   4. Rebuild live — on failure: restore backup, rebuild, restart, exit 2
#   5. Restart ai-os-sc + ai-os-hfm
#   6. Health-check :8787 and :8788 /api/health for up to 30s
#      — on failure: restore backup, rebuild, restart, exit 3
#   7. exit 0 DEPLOYED
#
# Exit codes: 0 deployed · 1 staging build failed · 2 live build failed (rolled back)
#             3 health check failed (rolled back) · 4 precondition failed
set -u
STAGING=/opt/ai-os-staging
LIVE=/opt/ai-os
BACKUP=/opt/ai-os-backup-last
log(){ echo "[self-deploy $(date +%H:%M:%S)] $*"; }

restore_backup(){
  log "Restoring live from backup ${BACKUP}..."
  rsync -a --delete --exclude '.env.*' --exclude node_modules --exclude dist "$BACKUP/" "$LIVE/"
  log "Rebuilding restored live..."
  ( cd "$LIVE" && npm install --silent --include=dev && npm run build )
  log "Restarting services after restore..."
  systemctl restart ai-os-sc ai-os-hfm
}

# ── Preconditions ─────────────────────────────────────────────────────────────
if [ ! -d "$STAGING" ]; then
  log "FAILED: staging directory $STAGING does not exist"
  exit 4
fi
if [ ! -d "$LIVE" ]; then
  log "FAILED: live directory $LIVE does not exist"
  exit 4
fi

# ── 1. Staging build gate ─────────────────────────────────────────────────────
log "Step 1/6: building staging ($STAGING)..."
if ! ( cd "$STAGING" && npm install --silent --include=dev && npm run build ); then
  log "STAGING BUILD FAILED — live platform untouched"
  exit 1
fi
log "Staging build OK"

# ── 2. Snapshot live ──────────────────────────────────────────────────────────
log "Step 2/6: snapshotting live -> $BACKUP..."
mkdir -p "$BACKUP"
if ! rsync -a --delete --exclude node_modules --exclude dist "$LIVE/" "$BACKUP/"; then
  log "FAILED: could not snapshot live — aborting before touching anything"
  exit 4
fi
log "Backup snapshot OK"

# ── 3. Sync staging over live ─────────────────────────────────────────────────
log "Step 3/6: syncing staging -> live (env files preserved)..."
if ! rsync -a --delete --exclude '.env.*' --exclude node_modules --exclude dist "$STAGING/" "$LIVE/"; then
  log "Sync failed — restoring from backup"
  restore_backup
  log "LIVE BUILD FAILED — ROLLED BACK"
  exit 2
fi
log "Sync OK"

# ── 4. Live build gate ────────────────────────────────────────────────────────
log "Step 4/6: rebuilding live..."
if ! ( cd "$LIVE" && npm install --silent --include=dev && npm run build ); then
  log "Live build failed — rolling back"
  restore_backup
  log "LIVE BUILD FAILED — ROLLED BACK"
  exit 2
fi
log "Live build OK"

# ── 5. Restart services ───────────────────────────────────────────────────────
log "Step 5/6: restarting ai-os-sc + ai-os-hfm..."
systemctl restart ai-os-sc ai-os-hfm

# ── 6. Health check ───────────────────────────────────────────────────────────
log "Step 6/6: health-checking :8787 and :8788 (up to 30s)..."
healthy=0
for i in $(seq 1 30); do
  ok_sc=$(curl -sf --max-time 2 http://localhost:8787/api/health 2>/dev/null || true)
  ok_hfm=$(curl -sf --max-time 2 http://localhost:8788/api/health 2>/dev/null || true)
  if echo "$ok_sc" | grep -q '"ok":true' && echo "$ok_hfm" | grep -q '"ok":true'; then
    healthy=1
    log "Both instances healthy after ${i}s"
    break
  fi
  sleep 1
done

if [ "$healthy" -ne 1 ]; then
  log "Health check timed out — rolling back"
  restore_backup
  log "HEALTH CHECK FAILED — ROLLED BACK"
  exit 3
fi

log "DEPLOYED"
exit 0

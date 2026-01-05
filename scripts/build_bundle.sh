#!/usr/bin/env bash
set -euo pipefail

# build_bundle.sh
# Build a portable bundle containing:
# - frontend `dist/` built with relative API paths
# - backend binary
# - onboarding web server (scripts/onboard_server.py)
# - simple README
# Usage:
#   bash scripts/build_bundle.sh /path/to/output/bundle-dir

OUT_DIR="${1:-$(pwd)/bundle}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT"
BACKEND_DIR="$REPO_ROOT/backend"

echo "Repo root: $REPO_ROOT"
echo "Output bundle dir: $OUT_DIR"

mkdir -p "$OUT_DIR"

echo "Building frontend (Vite) with relative API paths (VITE_API_URL='')"
cd "$FRONTEND_DIR"
export VITE_API_URL=''
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
npm run build

echo "Copying frontend dist"
mkdir -p "$OUT_DIR/frontend"
cp -R "$FRONTEND_DIR/dist/"* "$OUT_DIR/frontend/"

echo "Building backend (Go)"
cd "$BACKEND_DIR"
mkdir -p "$OUT_DIR/bin"
go build -o "$OUT_DIR/bin/bizcalc-server" ./main.go

echo "Copy onboard server and templates"
mkdir -p "$OUT_DIR/onboard"
cp -R "$REPO_ROOT/scripts/onboard_server.py" "$OUT_DIR/onboard/" 2>/dev/null || true
cp -R "$REPO_ROOT/scripts/templates" "$OUT_DIR/onboard/" 2>/dev/null || true

echo "Copy migrate.sql (if present)"
[ -f "$BACKEND_DIR/migrate.sql" ] && cp "$BACKEND_DIR/migrate.sql" "$OUT_DIR/" || true

echo "Writing README into bundle"
cat > "$OUT_DIR/README.md" <<'README'
BizCalc bundle

Contents:
- /bin/bizcalc-server    - backend binary
- /frontend/             - built frontend (static files)
- /onboard/onboard_server.py - tiny onboarding web form (requires Python + Flask)
- migrate.sql (optional)

Usage on a VPS:
1) Copy the bundle directory to the VPS (e.g., /opt/bizcalc-bundle)
2) Move files into place: create /opt/bizcalc and copy `/bin` and `/frontend` there
3) Run the onboard server as root to open the onboarding form (it writes systemd and nginx configs):
   sudo python3 /opt/bizcalc/onboard/onboard_server.py --host 127.0.0.1 --port 8080
4) Open http://127.0.0.1:8080 on the VPS or via SSH port forwarding to fill the onboarding form.

Security note: The onboard server performs privileged operations (writes to /etc and restarts services). Run it only on a trusted machine and stop it after use.
README

echo "Bundle created at: $OUT_DIR"

exit 0

#!/usr/bin/env bash
set -euo pipefail

# deploy_vps.sh
# Minimal, idempotent script to deploy this repo to a Debian/Ubuntu VPS
# Run as root (via sudo): `sudo bash scripts/deploy_vps.sh`

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="/opt/bizcalc"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR"
DIST_DIR="$FRONTEND_DIR/dist"

echo "Repo: $REPO_DIR"
echo "App dir: $APP_DIR"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root. Use: sudo bash $0" >&2
  exit 2
fi

apt_get_install() {
  apt-get update -y
  apt-get install -y "$@"
}

echo "Installing system packages (nginx, git, build tools, sqlite3)..."
apt_get_install nginx git build-essential sqlite3 ca-certificates curl

if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js (18.x) from NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt_get_install nodejs
fi

if ! command -v go >/dev/null 2>&1; then
  echo "Installing Go (from apt: golang-go)..."
  apt_get_install golang-go
fi

echo "Preparing app directory: $APP_DIR"
mkdir -p "$APP_DIR/frontend" "$APP_DIR/data" "$APP_DIR/uploads" "$APP_DIR/logs"
chown -R www-data:www-data "$APP_DIR" || true

echo "Building frontend (Vite)..."
cd "$REPO_DIR"
if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi
npm run build

echo "Copying frontend build to $APP_DIR/frontend/dist"
rm -rf "$APP_DIR/frontend/dist" || true
mkdir -p "$APP_DIR/frontend"
cp -R "$REPO_DIR/dist" "$APP_DIR/frontend/dist"
chown -R www-data:www-data "$APP_DIR/frontend/dist"

echo "Building backend (Go)..."
cd "$BACKEND_DIR"
GOBIN_PATH="$APP_DIR/bizcalc-server"
go build -o "$GOBIN_PATH" ./main.go
cp -f migrate.sql "$APP_DIR/" || true
chmod +x "$GOBIN_PATH"
chown root:root "$GOBIN_PATH"

echo "Ensuring data & uploads directories exist"
mkdir -p "$APP_DIR/data" "$APP_DIR/uploads"
chown -R www-data:www-data "$APP_DIR/data" "$APP_DIR/uploads"

echo "Creating systemd service for backend"
cat >/etc/systemd/system/bizcalc.service <<'UNIT'
[Unit]
Description=BizCalc Go API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/bizcalc
Environment=PORT=3000
ExecStart=/opt/bizcalc/bizcalc-server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now bizcalc.service

echo "Writing nginx site configuration"
cat >/etc/nginx/sites-available/bizcalc <<'NGINX'
server {
    listen 80;
    server_name _;
    root /opt/bizcalc/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/bizcalc /etc/nginx/sites-enabled/bizcalc
rm -f /etc/nginx/sites-enabled/default || true

echo "Testing nginx configuration"
nginx -t
echo "Restarting nginx"
systemctl restart nginx

echo "Deployment complete."
echo "Frontend served from: http://<your-server>/"
echo "Backend API proxied at: http://<your-server>/api/ (listening on port 3000 locally)"

cat >/opt/bizcalc/DEPLOY_NOTES.txt <<'NOTES'
Quick notes:
- Run this script on a Debian/Ubuntu VPS as root: `sudo bash scripts/deploy_vps.sh`
- To add TLS: install certbot and run `certbot --nginx -d yourdomain.example`
- Back up `/opt/bizcalc/data` and `/opt/bizcalc/uploads` regularly. SQLite DB lives in `data/db.sqlite`.
- For high availability and scaling, migrate from SQLite to Postgres and use a proper CI/CD pipeline.
NOTES

echo "Wrote /opt/bizcalc/DEPLOY_NOTES.txt"

exit 0

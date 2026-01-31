# BizCalc Deployment Guide

Complete step-by-step guide to deploy BizCalc on a VPS (Ubuntu/Debian).

## Architecture Overview

BizCalc is a full-stack business management application with:
- **Frontend**: React + TypeScript + Vite (SPA)
- **Backend**: Go + Fiber framework
- **Database**: SQLite (file-based)
- **Web Server**: Nginx (reverse proxy)

## Prerequisites on VPS

- Ubuntu 20.04+ or Debian 11+ VPS
- Root or sudo access
- Go installed (you mentioned Go is already installed)
- Internet connection

## Quick Deploy (Automated)

If you want to use the automated script:

```bash
# Clone your repository
cd /tmp
git clone <your-repo-url> bizcalc
cd bizcalc

# Run the deployment script as root
sudo bash scripts/deploy_vps.sh
```

**Note**: The script installs Node.js, builds the frontend, builds the backend, configures Nginx, and sets up a systemd service.

## Manual Deployment (Step-by-Step)

If the automated script failed or you want more control, follow these manual steps:

### Step 1: Install Required Dependencies

```bash
# Update system packages
sudo apt-get update -y
sudo apt-get upgrade -y

# Install Nginx (web server)
sudo apt-get install -y nginx

# Install Node.js 18.x (required for building frontend)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt-get install -y nodejs

# Install build essentials
sudo apt-get install -y git build-essential ca-certificates

# Verify installations
node --version  # Should show v18.x
npm --version
go version     # Should show Go version
nginx -v       # Should show Nginx version
```

### Step 2: Clone and Prepare Application

```bash
# Create application directory
sudo mkdir -p /opt/bizcalc
cd /opt/bizcalc

# Clone your repository (or upload your code)
# Option A: Clone from Git
git clone <your-repo-url> source
cd source

# Option B: Upload via SCP from your local machine
# From your local Windows machine in PowerShell:
# scp -r e:\work\bizcalc user@your-vps-ip:/tmp/
# Then on VPS: sudo mv /tmp/bizcalc /opt/bizcalc/source
```

### Step 3: Build Frontend

```bash
cd /opt/bizcalc/source

# Install frontend dependencies
npm install --no-audit --no-fund

# IMPORTANT: Set API URL to empty string so frontend uses relative paths
# This makes /api/ requests go through Nginx proxy
export VITE_API_URL=""

# Build the frontend (creates dist/ folder)
npm run build

# Verify the build
ls -la dist/  # Should see index.html and assets/

# Verify API URL is not hardcoded to localhost
grep -r "localhost:3000" dist/ || echo "Good! No localhost:3000 found"
```

### Step 4: Build Backend

```bash
cd /opt/bizcalc/source/backend

# Download Go dependencies
go mod download

# Build the Go binary
go build -o /opt/bizcalc/bizcalc-server ./main.go

# Copy migration SQL file
cp migrate.sql /opt/bizcalc/

# Verify the binary
ls -la /opt/bizcalc/bizcalc-server  # Should be executable
```

### Step 5: Create Required Directories

```bash
# Create data and uploads directories
sudo mkdir -p /opt/bizcalc/data
sudo mkdir -p /opt/bizcalc/uploads
sudo mkdir -p /opt/bizcalc/logs

# Set proper ownership (www-data is Nginx user)
sudo chown -R www-data:www-data /opt/bizcalc/data
sudo chown -R www-data:www-data /opt/bizcalc/uploads
sudo chown -R www-data:www-data /opt/bizcalc/logs

# Make binary executable
sudo chmod +x /opt/bizcalc/bizcalc-server
```

### Step 6: Copy Frontend Build

```bash
# Copy the built frontend to final location
sudo mkdir -p /opt/bizcalc/frontend
sudo cp -R /opt/bizcalc/source/dist /opt/bizcalc/frontend/

# Set ownership
sudo chown -R www-data:www-data /opt/bizcalc/frontend
```

### Step 7: Configure Backend Service (Systemd)

Create a systemd service to run the backend automatically:

```bash
sudo nano /etc/systemd/system/bizcalc.service
```

Paste this configuration:

```ini
[Unit]
Description=BizCalc Go API Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/bizcalc
Environment=PORT=3000
ExecStart=/opt/bizcalc/bizcalc-server
Restart=always
RestartSec=5
StandardOutput=append:/opt/bizcalc/logs/backend.log
StandardError=append:/opt/bizcalc/logs/backend-error.log

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable bizcalc.service

# Start the service
sudo systemctl start bizcalc.service

# Check status
sudo systemctl status bizcalc.service
```

### Step 8: Configure Nginx

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/bizcalc
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name _;  # Replace _ with your domain if you have one
    
    # Frontend - serve static files
    root /opt/bizcalc/frontend/dist;
    index index.html;

    # Backend API - proxy to Go server
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

    # Frontend - SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Optional: Increase upload size if needed
    client_max_body_size 50M;
}
```

Enable the site and restart Nginx:

```bash
# Enable the site
sudo ln -sf /etc/nginx/sites-available/bizcalc /etc/nginx/sites-enabled/bizcalc

# Remove default site (optional)
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Verify Nginx is running
sudo systemctl status nginx
```

### Step 9: Configure Firewall (Optional but Recommended)

```bash
# Allow HTTP traffic
sudo ufw allow 80/tcp

# Allow HTTPS traffic (for future SSL setup)
sudo ufw allow 443/tcp

# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 10: Verify Deployment

```bash
# Check backend service
sudo systemctl status bizcalc.service

# Check backend logs
sudo tail -f /opt/bizcalc/logs/backend.log

# Check if backend is listening on port 3000
sudo netstat -tlnp | grep 3000
# OR
sudo ss -tlnp | grep 3000

# Check Nginx
sudo systemctl status nginx

# Test from command line
curl http://localhost/
curl http://localhost/api/health  # Or whatever endpoint exists
```

Access your application:
- Open browser: `http://your-vps-ip/`
- API endpoint: `http://your-vps-ip/api/`

## Troubleshooting

### Backend Not Starting

```bash
# Check detailed service status
sudo journalctl -u bizcalc.service -n 50 --no-pager

# Check backend error logs
sudo cat /opt/bizcalc/logs/backend-error.log

# Check if port 3000 is already in use
sudo netstat -tlnp | grep 3000

# Test backend manually
cd /opt/bizcalc
sudo -u www-data ./bizcalc-server
```

### Frontend Not Loading

```bash
# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify frontend files exist
ls -la /opt/bizcalc/frontend/dist/

# Test Nginx configuration
sudo nginx -t

# Check file permissions
sudo ls -la /opt/bizcalc/frontend/dist/index.html
```

### API Calls Failing (CORS or Proxy Issues)

1. Check Nginx proxy configuration in `/etc/nginx/sites-available/bizcalc`
2. Verify backend is running: `sudo systemctl status bizcalc.service`
3. Check browser console for errors
4. Ensure API calls in frontend use `/api/` prefix

### Database Issues

```bash
# Check if database file exists
ls -la /opt/bizcalc/data/db.sqlite

# Check permissions
sudo ls -la /opt/bizcalc/data/

# If database is missing, backend should create it on startup
# Check backend logs for database initialization
sudo tail -f /opt/bizcalc/logs/backend.log
```

### Permission Denied Errors

```bash
# Fix ownership of all application files
sudo chown -R www-data:www-data /opt/bizcalc/data
sudo chown -R www-data:www-data /opt/bizcalc/uploads
sudo chown -R www-data:www-data /opt/bizcalc/frontend

# Fix permissions
sudo chmod -R 755 /opt/bizcalc/frontend
sudo chmod -R 775 /opt/bizcalc/data
sudo chmod -R 775 /opt/bizcalc/uploads
```

## SSL/HTTPS Setup (Optional but Recommended)

Install Let's Encrypt SSL certificate:

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com

# Certbot will automatically update Nginx config
# Certificate auto-renewal is handled by certbot timer

# Verify auto-renewal works
sudo certbot renew --dry-run
```

## Updating the Application

### Update Frontend

```bash
cd /opt/bizcalc/source
git pull  # Or upload new code

# Rebuild frontend with correct API URL
npm install
export VITE_API_URL=""  # Important: use relative URLs
npm run build

# Copy new build
sudo cp -R dist/* /opt/bizcalc/frontend/dist/

# Verify no localhost hardcoded
grep -r "localhost:3000" /opt/bizcalc/frontend/dist/ || echo "✓ Clean build"

# No need to restart anything for frontend
```

### Update Backend

```bash
cd /opt/bizcalc/source/backend
git pull  # Or upload new code

# Rebuild
go build -o /opt/bizcalc/bizcalc-server ./main.go

# Copy migration if changed
cp migrate.sql /opt/bizcalc/

# Restart service
sudo systemctl restart bizcalc.service

# Check status
sudo systemctl status bizcalc.service
```

## Backup

Create regular backups of your data:

```bash
# Backup database and uploads
sudo tar -czf /root/bizcalc-backup-$(date +%Y%m%d).tar.gz \
  /opt/bizcalc/data \
  /opt/bizcalc/uploads

# Download backup to your local machine
# From your local machine:
# scp user@vps-ip:/root/bizcalc-backup-*.tar.gz .
```

Set up automated backups with cron:

```bash
sudo crontab -e

# Add this line for daily backup at 2 AM
0 2 * * * tar -czf /root/bizcalc-backup-$(date +\%Y\%m\%d).tar.gz /opt/bizcalc/data /opt/bizcalc/uploads && find /root/bizcalc-backup-* -mtime +7 -delete
```

## Monitoring

### View Logs

```bash
# Backend logs
sudo tail -f /opt/bizcalc/logs/backend.log

# Backend errors
sudo tail -f /opt/bizcalc/logs/backend-error.log

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Service logs (systemd journal)
sudo journalctl -u bizcalc.service -f
```

### Check Service Status

```bash
# Backend service
sudo systemctl status bizcalc.service

# Nginx
sudo systemctl status nginx

# View all running services
sudo systemctl list-units --type=service --state=running
```

## File Structure on VPS

After deployment, your VPS should have this structure:

```
/opt/bizcalc/
├── bizcalc-server          # Go binary (backend)
├── migrate.sql             # Database migration file
├── data/
│   └── db.sqlite          # SQLite database (auto-created)
├── uploads/
│   └── transactions/      # Uploaded files
├── frontend/
│   └── dist/              # Built frontend files
│       ├── index.html
│       └── assets/
├── logs/
│   ├── backend.log
│   └── backend-error.log
└── source/                # Source code (optional, for updates)
    ├── backend/
    ├── src/
    └── ...
```

## Common Issues and Solutions

### 1. "Only frontend deployed, but not working"

**Symptom**: Frontend loads but API calls fail (CORS errors, connection refused, or 404s)

**Root Cause**: Frontend was built with wrong API URL (pointing to localhost:3000)

**Solution**:
```bash
# Check if frontend has hardcoded localhost
grep -r "localhost:3000" /opt/bizcalc/frontend/dist/assets/

# If found, rebuild frontend with correct API URL
cd /opt/bizcalc/source
export VITE_API_URL=""  # Use empty string for relative URLs
npm run build
sudo cp -R dist/* /opt/bizcalc/frontend/dist/

# Verify backend is running
sudo systemctl status bizcalc.service

# Test API through Nginx proxy
curl http://localhost/api/health

# Should return: {"ok":true}
```

### 2. "502 Bad Gateway"

**Symptom**: Nginx shows 502 error when accessing `/api/*`

**Solution**:
- Backend is not running or crashed
- Start backend: `sudo systemctl start bizcalc.service`
- Check logs: `sudo journalctl -u bizcalc.service -n 50`

### 3. "404 Not Found" on page refresh

**Symptom**: Works on homepage, but refresh on other routes gives 404

**Solution**:
- This is SPA routing issue
- Ensure Nginx config has `try_files $uri $uri/ /index.html;`
- Restart Nginx: `sudo systemctl restart nginx`

### 4. Frontend files not accessible

**Symptom**: Blank page or "Permission denied" in Nginx logs

**Solution**:
```bash
sudo chown -R www-data:www-data /opt/bizcalc/frontend
sudo chmod -R 755 /opt/bizcalc/frontend
sudo systemctl restart nginx
```

## Performance Optimization

### For production use:

1. **Enable Gzip compression** in Nginx (add to server block):
```nginx
gzip on;
gzip_vary on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

2. **Cache static assets** (add to location block):
```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

3. **Consider migrating to PostgreSQL** for better performance at scale

## Need Help?

- Check logs: Backend logs in `/opt/bizcalc/logs/`, Nginx logs in `/var/log/nginx/`
- Verify services: `sudo systemctl status bizcalc.service nginx`
- Test connectivity: `curl http://localhost/` and `curl http://localhost:3000/`

#!/usr/bin/env bash
set -euo pipefail

# fix_vps_deployment.sh
# Quick fix script to rebuild frontend with correct API URL
# Run this on your VPS where the code is already deployed

echo "=== BizCalc Deployment Fix Script ==="
echo ""

# Check if we're on the VPS
if [ ! -d "/opt/bizcalc" ]; then
  echo "ERROR: /opt/bizcalc directory not found!"
  echo "This script should be run on your VPS where BizCalc is deployed."
  exit 1
fi

# Check if source code exists
if [ ! -d "/opt/bizcalc/source" ]; then
  echo "ERROR: /opt/bizcalc/source directory not found!"
  echo "Please ensure your source code is in /opt/bizcalc/source/"
  exit 1
fi

cd /opt/bizcalc/source

echo "✓ Found source code"
echo ""

# Test backend first
echo "1. Testing backend service..."
if systemctl is-active --quiet bizcalc.service; then
  echo "✓ Backend service is running"
else
  echo "✗ Backend service is NOT running"
  echo "  Starting backend service..."
  systemctl start bizcalc.service
  sleep 2
  if systemctl is-active --quiet bizcalc.service; then
    echo "✓ Backend service started successfully"
  else
    echo "✗ Failed to start backend service"
    echo "  Check logs: journalctl -u bizcalc.service -n 50"
    exit 1
  fi
fi

# Test backend API
echo ""
echo "2. Testing backend API..."
if curl -s http://localhost:3000/api/health | grep -q "ok"; then
  echo "✓ Backend API is responding"
else
  echo "✗ Backend API is not responding correctly"
  echo "  Response: $(curl -s http://localhost:3000/api/health)"
  echo "  Check backend logs: tail -50 /opt/bizcalc/logs/backend.log"
  exit 1
fi

# Check current frontend build
echo ""
echo "3. Checking current frontend build..."
if grep -r "localhost:3000" /opt/bizcalc/frontend/dist/assets/ >/dev/null 2>&1; then
  echo "✗ Frontend has hardcoded localhost:3000 URLs (THIS IS THE PROBLEM!)"
  echo "  Frontend is trying to connect to localhost:3000 from browser"
  echo "  We need to rebuild with relative URLs"
  NEEDS_REBUILD=true
else
  echo "✓ Frontend looks good (no hardcoded localhost)"
  NEEDS_REBUILD=false
fi

# Rebuild frontend if needed
if [ "$NEEDS_REBUILD" = true ]; then
  echo ""
  echo "4. Rebuilding frontend with correct API URL..."
  
  # Check if node is installed
  if ! command -v npm >/dev/null 2>&1; then
    echo "✗ npm is not installed!"
    echo "  Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
  fi
  
  echo "  Installing dependencies..."
  npm install --no-audit --no-fund
  
  echo "  Building frontend (this may take a minute)..."
  # Set VITE_API_URL to empty string so it uses relative paths
  export VITE_API_URL=""
  npm run build
  
  # Verify build doesn't have localhost
  if grep -r "localhost:3000" dist/assets/ >/dev/null 2>&1; then
    echo "✗ Build still contains localhost:3000! Something went wrong."
    exit 1
  fi
  
  echo "  Copying new build to /opt/bizcalc/frontend/dist/"
  cp -R dist/* /opt/bizcalc/frontend/dist/
  
  echo "✓ Frontend rebuilt successfully"
else
  echo ""
  echo "4. Frontend already looks good, skipping rebuild"
fi

# Test Nginx
echo ""
echo "5. Testing Nginx configuration..."
if nginx -t 2>&1 | grep -q "successful"; then
  echo "✓ Nginx configuration is valid"
else
  echo "✗ Nginx configuration has errors"
  nginx -t
  exit 1
fi

# Check if Nginx proxy is working
echo ""
echo "6. Testing Nginx proxy..."
if curl -s http://localhost/api/health | grep -q "ok"; then
  echo "✓ Nginx proxy to backend is working"
else
  echo "✗ Nginx proxy is not working correctly"
  echo "  Response: $(curl -s http://localhost/api/health)"
  echo "  Check Nginx config: /etc/nginx/sites-available/bizcalc"
  echo "  Check Nginx logs: tail -50 /var/log/nginx/error.log"
fi

# Check frontend is being served
echo ""
echo "7. Testing frontend is being served..."
if curl -s http://localhost/ | grep -q "<!DOCTYPE html>"; then
  echo "✓ Frontend HTML is being served"
else
  echo "✗ Frontend is not being served correctly"
  echo "  Check Nginx logs: tail -50 /var/log/nginx/error.log"
fi

echo ""
echo "=== Diagnosis Complete ==="
echo ""
echo "Summary:"
echo "  Backend service: $(systemctl is-active bizcalc.service)"
echo "  Backend API: $(curl -s http://localhost:3000/api/health 2>/dev/null || echo 'not responding')"
echo "  Nginx proxy: $(curl -s http://localhost/api/health 2>/dev/null || echo 'not responding')"
echo "  Frontend: $(curl -s -o /dev/null -w '%{http_code}' http://localhost/)"
echo ""

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "Your application should now be accessible at:"
echo "  http://$SERVER_IP/"
echo ""
echo "If you have a domain pointed to this server:"
echo "  http://yourdomain.com/"
echo ""

# Check for common issues
echo "Common next steps:"
echo "  • Add SSL certificate: sudo certbot --nginx -d yourdomain.com"
echo "  • View backend logs: sudo tail -f /opt/bizcalc/logs/backend.log"
echo "  • View Nginx logs: sudo tail -f /var/log/nginx/access.log"
echo "  • Restart services: sudo systemctl restart bizcalc nginx"
echo ""

exit 0

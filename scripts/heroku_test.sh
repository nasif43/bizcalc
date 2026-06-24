#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${BUILD_DIR:-$ROOT_DIR}"
SERVER_PORT="${PORT:-3000}"
SERVER_URL="http://127.0.0.1:${SERVER_PORT}"
BINARY_NAME="bizcalc"
PID_FILE="/tmp/bizcalc_test_server.pid"
PASS=0
FAIL=0

cleanup() {
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null || true
    rm -f "$PID_FILE"
  fi
}
trap cleanup EXIT

red()   { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
blue()  { printf '\033[1;34m%s\033[0m\n' "$*"; }

assert() {
  local desc="$1" rc="$2"
  if [ "$rc" -eq 0 ]; then
    green "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    red "  ✗ $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
blue "══════════════════════════════════════════"
blue "  BizCalc Heroku Deployment Test Suite"
blue "══════════════════════════════════════════"
echo ""

# ── Step 1: Build Frontend ──────────────────────────────────
echo "── Step 1: Build Frontend ──"
cd "$ROOT_DIR"
npm ci --no-audit --no-fund 2>&1 | tail -1
npm run build 2>&1 | tail -1

if [ -d "$ROOT_DIR/dist" ] && [ -f "$ROOT_DIR/dist/index.html" ]; then
  assert "Frontend build exists (dist/index.html)" 0
else
  assert "Frontend build exists (dist/index.html)" 1
  red "Aborting: frontend build required for Go embed"
  exit 1
fi

# Confirm no hardcoded localhost
if grep -rq "localhost:3000" "$ROOT_DIR/dist" 2>/dev/null; then
  assert "No hardcoded localhost:3000 in frontend build" 1
else
  assert "No hardcoded localhost:3000 in frontend build" 0
fi

# ── Step 2: Build Go Binary ──────────────────────────────────
echo ""
echo "── Step 2: Build Go Binary ──"
cd "$ROOT_DIR"
go build -o "$BINARY_NAME" .

if [ -f "$ROOT_DIR/$BINARY_NAME" ]; then
  BINARY_SIZE=$(stat -c%s "$ROOT_DIR/$BINARY_NAME" 2>/dev/null || stat -f%z "$ROOT_DIR/$BINARY_NAME" 2>/dev/null)
  assert "Go binary built (${BINARY_SIZE} bytes)" 0
else
  assert "Go binary built" 1
  exit 1
fi

# Verify frontend is embedded in the binary
EMBED_CHECK=$(strings "$ROOT_DIR/$BINARY_NAME" | grep -c "<div id=\"root\">" || true)
if [ "$EMBED_CHECK" -gt 0 ]; then
  assert "Frontend is embedded in binary (found index.html content)" 0
else
  assert "Frontend is embedded in binary" 1
fi

# ── Step 3: Start Server ────────────────────────────────────
echo ""
echo "── Step 3: Start Server ──"
cd "$ROOT_DIR"
rm -rf data uploads
./bizcalc &
SERVER_PID=$!
echo $SERVER_PID > "$PID_FILE"

sleep 2

if kill -0 "$SERVER_PID" 2>/dev/null; then
  assert "Server process is running" 0
else
  assert "Server process is running" 1
  exit 1
fi

# ── Step 4: Smoke Tests ─────────────────────────────────────
echo ""
echo "── Step 4: Smoke Tests ──"

# 4a: Health endpoint
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/api/health")
assert "Health endpoint returns 200 (got $HEALTH)" $([ "$HEALTH" = "200" ] && echo 0 || echo 1)

HEALTH_BODY=$(curl -s "$SERVER_URL/api/health")
assert "Health endpoint returns valid JSON" $([ "$(echo "$HEALTH_BODY" | python3 -c 'import sys,json; print(json.load(sys.stdin)["ok"])' 2>/dev/null)" = "True" ] && echo 0 || echo 1)

# 4b: Frontend serves index.html
IDX_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/")
assert "Frontend root returns 200 (got $IDX_CODE)" $([ "$IDX_CODE" = "200" ] && echo 0 || echo 1)

IDX_TYPE=$(curl -s -o /dev/null -w "%{content_type}" "$SERVER_URL/")
assert "Frontend root Content-Type is text/html" $([[ "$IDX_TYPE" == *"text/html"* ]] && echo 0 || echo 1)

IDX_CONTENT=$(curl -s "$SERVER_URL/")
assert "Frontend root contains <div id=\"root\">" $([[ "$IDX_CONTENT" == *'<div id="root">'* ]] && echo 0 || echo 1)

# 4c: SPA fallback
SPA_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/calculator")
assert "SPA fallback returns 200 for /calculator (got $SPA_CODE)" $([ "$SPA_CODE" = "200" ] && echo 0 || echo 1)

SPA_CODE2=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/ledger/some/deep/path")
assert "SPA fallback returns 200 for deep path (got $SPA_CODE2)" $([ "$SPA_CODE2" = "200" ] && echo 0 || echo 1)

SPA_CONTENT=$(curl -s "$SERVER_URL/ledger")
assert "SPA fallback contains <div id=\"root\">" $([[ "$SPA_CONTENT" == *'<div id="root">'* ]] && echo 0 || echo 1)

SPA_TYPE=$(curl -s -o /dev/null -w "%{content_type}" "$SERVER_URL/ledger")
assert "SPA fallback Content-Type is text/html" $([[ "$SPA_TYPE" == *"text/html"* ]] && echo 0 || echo 1)

# 4d: API endpoint (contacts should be seeded)
API_CONTACTS=$(curl -s "$SERVER_URL/api/collections/contacts/records")
assert "Contacts API returns items" $([[ "$(echo "$API_CONTACTS" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["items"]))' 2>/dev/null)" -gt 0 ]] && echo 0 || echo 1)

API_INVENTORY=$(curl -s "$SERVER_URL/api/collections/inventory_items/records")
assert "Inventory API returns items" $([[ "$(echo "$API_INVENTORY" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["items"]))' 2>/dev/null)" -gt 0 ]] && echo 0 || echo 1)

API_TRANSACTIONS=$(curl -s "$SERVER_URL/api/collections/transactions/records")
assert "Transactions API returns items" $([[ "$(echo "$API_TRANSACTIONS" | python3 -c 'import sys,json; print(len(json.load(sys.stdin)["items"]))' 2>/dev/null)" -gt 0 ]] && echo 0 || echo 1)

# 4e: Static asset serving (JS files from Vite build)
ASSET_FILE=$(cd "$ROOT_DIR/dist" && ls assets/*.js 2>/dev/null | head -1)
if [ -n "$ASSET_FILE" ]; then
  ASSET_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/$ASSET_FILE")
  assert "Static JS asset returns 200 (got $ASSET_CODE)" $([ "$ASSET_CODE" = "200" ] && echo 0 || echo 1)
  
  ASSET_TYPE=$(curl -s -o /dev/null -w "%{content_type}" "$SERVER_URL/$ASSET_FILE")
  assert "Static JS asset Content-Type is javascript" $([[ "$ASSET_TYPE" == *"javascript"* ]] && echo 0 || echo 1)
fi

# 4f: Create a new contact via API
CREATE_RESP=$(curl -s -X POST "$SERVER_URL/api/collections/contacts/records" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Created","phone":"+0000000000","type":"customer"}')
assert "Create contact API returns id" $([ "$(echo "$CREATE_RESP" | python3 -c 'import sys,json; print("id" in json.load(sys.stdin))' 2>/dev/null)" = "True" ] && echo 0 || echo 1)

# 4g: File upload test
echo "test file content" > /tmp/bizcalc_test_upload.txt
UPLOAD_RESP=$(curl -s -X POST "$SERVER_URL/api/collections/contacts/records/test-id/files/image" \
  -F "file=@/tmp/bizcalc_test_upload.txt")
assert "File upload returns 200" $([ -n "$UPLOAD_RESP" ] && echo 0 || echo 1)
rm -f /tmp/bizcalc_test_upload.txt

# 4h: 404 for unknown API collections
UNKNOWN_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVER_URL/api/collections/unknown/records")
assert "Unknown collection returns 404 (got $UNKNOWN_CODE)" $([ "$UNKNOWN_CODE" = "404" ] && echo 0 || echo 1)

# ── Step 5: Results ─────────────────────────────────────────
echo ""
blue "══════════════════════════════════════════"
blue "  Results: $PASS passed, $FAIL failed"
blue "══════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0

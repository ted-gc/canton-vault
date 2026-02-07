#!/bin/bash
# Canton Vault - Full Verification Script
# Verifies everything that can be verified given available tools

set -e
cd "$(dirname "$0")/.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 Canton Vault Verification Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0

# ===== Check Dependencies =====
echo "📦 Checking dependencies..."

if command -v node &> /dev/null; then
  echo "   ✅ Node.js: $(node --version)"
else
  echo "   ❌ Node.js not found"
  ERRORS=$((ERRORS + 1))
fi

if command -v docker &> /dev/null; then
  echo "   ✅ Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
  DOCKER_AVAILABLE=1
else
  echo "   ⚠️  Docker not available (LocalNet requires Docker)"
  DOCKER_AVAILABLE=0
fi

if [ -x "$HOME/.daml/bin/daml" ]; then
  export PATH="$HOME/.daml/bin:$PATH"
  echo "   ✅ Daml SDK: $($HOME/.daml/bin/daml version 2>/dev/null | head -1 || echo 'installed')"
  DAML_AVAILABLE=1
elif command -v daml &> /dev/null; then
  echo "   ✅ Daml SDK: $(daml version | head -1)"
  DAML_AVAILABLE=1
else
  echo "   ⚠️  Daml SDK not installed (run: curl -sSL https://get.daml.com/ | sh)"
  DAML_AVAILABLE=0
fi

echo ""

# ===== TypeScript Compilation =====
echo "🔨 Checking TypeScript compilation..."

cd backend
if npx tsc --noEmit 2>&1; then
  echo "   ✅ Backend TypeScript compiles"
else
  echo "   ❌ Backend TypeScript errors"
  ERRORS=$((ERRORS + 1))
fi
cd ..

echo ""

# ===== Daml Compilation =====
if [ "$DAML_AVAILABLE" = "1" ]; then
  echo "🔨 Compiling Daml..."
  if daml build 2>&1; then
    echo "   ✅ Daml compiles"
  else
    echo "   ❌ Daml compilation failed"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "⏭️  Skipping Daml compilation (SDK not installed)"
fi

echo ""

# ===== Backend Tests =====
echo "🧪 Running backend integration tests..."

# Start backend if not running
STARTED_BACKEND=0
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "   Starting backend..."
  cd backend
  npm run dev > /dev/null 2>&1 &
  BACKEND_PID=$!
  cd ..
  STARTED_BACKEND=1
  sleep 3
fi

if curl -s http://localhost:3000/health > /dev/null 2>&1; then
  if npx tsx tests/integration.test.ts 2>&1; then
    echo ""
  else
    echo "   ❌ Integration tests failed"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "   ❌ Backend not reachable"
  ERRORS=$((ERRORS + 1))
fi

# Stop backend if we started it
if [ "$STARTED_BACKEND" = "1" ]; then
  kill $BACKEND_PID 2>/dev/null || true
fi

echo ""

# ===== LocalNet (if Docker available) =====
if [ "$DOCKER_AVAILABLE" = "1" ]; then
  echo "🐳 Checking LocalNet..."
  
  if curl -s http://localhost:6201/livez > /dev/null 2>&1; then
    echo "   ✅ Canton JSON API is running"
    
    # Test contract query
    CONTRACTS=$(curl -s -X POST http://localhost:6201/v2/query \
      -H "Content-Type: application/json" \
      -d '{"templateId": "Splice.Vault.Vault:Vault"}' 2>/dev/null | jq -r '.result | length' 2>/dev/null || echo "0")
    
    echo "   📊 Vault contracts on ledger: $CONTRACTS"
  else
    echo "   ⚠️  LocalNet not running"
    echo "   To start: cd localnet && ./scripts/init-network.sh"
  fi
else
  echo "⏭️  Skipping LocalNet checks (Docker not available)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $ERRORS -eq 0 ]; then
  echo "✅ All verifications passed!"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
else
  echo "❌ $ERRORS verification(s) failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

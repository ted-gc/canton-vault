#!/bin/bash
# Canton Vault Test Runner
# Runs integration tests against the backend API

set -e

cd "$(dirname "$0")/.."

echo "🧪 Canton Vault Test Suite"
echo ""

# Check if backend is running
if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
  echo "⚠️  Backend not running. Starting it..."
  cd backend
  npm run dev &
  BACKEND_PID=$!
  cd ..
  sleep 3
  
  # Verify it started
  if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "❌ Failed to start backend"
    exit 1
  fi
  echo "✅ Backend started (PID: $BACKEND_PID)"
  echo ""
fi

# Run integration tests
echo "Running integration tests..."
echo ""
npx tsx tests/integration.test.ts

# If we started the backend, stop it
if [ -n "$BACKEND_PID" ]; then
  echo "Stopping backend..."
  kill $BACKEND_PID 2>/dev/null || true
fi

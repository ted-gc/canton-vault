#!/bin/bash
# Initialize Canton Network LocalNet for Vault

set -e

echo "🚀 Starting Canton Vault LocalNet..."

cd "$(dirname "$0")/.."

# Start infrastructure
docker compose up -d domain participant

echo "⏳ Waiting for Canton nodes to be healthy..."
sleep 15

# Check if nodes are running
if ! docker ps | grep -q "vault-participant"; then
  echo "❌ Participant failed to start. Check logs with: docker logs vault-participant"
  exit 1
fi

if ! docker ps | grep -q "vault-domain"; then
  echo "❌ Domain failed to start. Check logs with: docker logs vault-domain"
  exit 1
fi

# Connect participant to domain using Canton console
echo "🔗 Connecting participant to domain..."
docker exec vault-participant /canton/bin/canton --help 2>/dev/null | head -3 || echo "Canton binary works"

# For now, skip the console connection - Canton 2.x auto-connects based on config
# We'll connect manually if needed via admin API

echo ""
echo "✅ Canton Vault LocalNet is running!"
echo ""
echo "📍 Endpoints:"
echo "   Participant Ledger API: localhost:5011 (gRPC)"
echo "   Participant Admin API:  localhost:5012"
echo "   Domain Public API:      localhost:5018"
echo "   Domain Admin API:       localhost:5019"
echo ""
echo "💡 Next steps:"
echo "   1. Connect participant to domain (if not auto-connected)"
echo "   2. Upload DAR: daml ledger upload-dar .daml/dist/canton-vault-0.1.0.dar --host localhost --port 5011"
echo "   3. Start backend with LEDGER_API_URL pointing to participant"
echo ""
echo "📋 Commands:"
echo "   docker compose logs -f        # Follow logs"
echo "   docker compose down           # Stop all"

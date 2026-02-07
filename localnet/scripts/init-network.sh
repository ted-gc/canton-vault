#!/bin/bash
# Initialize Canton Network LocalNet for Vault

set -e

echo "🚀 Starting Canton Vault LocalNet..."

# Start infrastructure
docker compose up -d domain participant

echo "⏳ Waiting for Canton nodes to be healthy..."
sleep 10

# Connect participant to domain
echo "🔗 Connecting participant to domain..."
docker exec vault-participant canton remote_console \
  --command "participants.local.domains.connect_local(domains.local)"

# Start JSON API
docker compose up -d json-api

echo "⏳ Waiting for JSON API..."
sleep 5

# Upload DAR
if [ -f "../daml/.daml/dist/canton-vault-0.1.0.dar" ]; then
  echo "📦 Uploading DAR package..."
  curl -X POST "http://localhost:6201/v2/packages" \
    -H "Content-Type: application/octet-stream" \
    -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsZWRnZXJJZCI6InZhdWx0LWxlZGdlciIsImFwcGxpY2F0aW9uSWQiOiJkZXYiLCJhY3RBcyI6W10sInJlYWRBcyI6W119.dev" \
    --data-binary @"../daml/.daml/dist/canton-vault-0.1.0.dar"
  echo ""
fi

# Start application services
echo "🏗️ Starting backend and frontend..."
docker compose up -d backend frontend

echo ""
echo "✅ Canton Vault LocalNet is running!"
echo ""
echo "📍 Endpoints:"
echo "   Frontend:      http://localhost:3001"
echo "   Backend API:   http://localhost:3000"
echo "   JSON API:      http://localhost:6201"
echo "   Participant:   localhost:5011 (gRPC)"
echo "   Domain:        localhost:5018 (public)"
echo ""
echo "💡 Commands:"
echo "   docker compose logs -f        # Follow logs"
echo "   docker compose down           # Stop all"
echo "   ./scripts/init-network.sh     # Reinitialize"

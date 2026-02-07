#!/bin/bash
# Clean Canton Vault LocalNet data

echo "🧹 Cleaning Canton Vault LocalNet..."
docker compose down -v
rm -rf data/*

echo "✅ LocalNet cleaned."

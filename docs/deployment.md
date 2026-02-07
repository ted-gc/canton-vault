# Deployment Guide

Deploy Canton Vault to LocalNet, TestNet, or MainNet.

## Deployment Options

| Environment | Use Case | Canton Network |
|-------------|----------|----------------|
| LocalNet | Development | Local Docker |
| DevNet | Integration testing | Public DevNet |
| TestNet | Staging | Public TestNet |
| MainNet | Production | Public MainNet |

---

## LocalNet Deployment

The fastest way to run a complete Canton environment locally.

### Prerequisites

- Docker Desktop (8GB+ RAM)
- docker-compose v2+

### Quick Start

```bash
cd canton-vault/localnet
./scripts/init-network.sh
```

This starts:
- Canton Domain (synchronizer)
- Canton Participant node
- JSON API (HTTP ledger access)
- Vault Backend
- Vault Frontend

### Verify Deployment

```bash
# Check all containers
docker compose ps

# Expected output:
NAME                STATUS
vault-domain        Up (healthy)
vault-participant   Up (healthy)
vault-json-api      Up (healthy)
vault-backend       Up (healthy)
vault-frontend      Up (healthy)
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| Backend API | http://localhost:3000 |
| JSON API | http://localhost:6201 |
| Participant Admin | localhost:5012 |
| Domain Admin | localhost:5019 |

### Upload DAR Package

```bash
# Build Daml
cd canton-vault
daml build

# Upload to participant
curl -X POST "http://localhost:6201/v2/packages" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @".daml/dist/canton-vault-0.1.0.dar"
```

### Create Initial Vault

```bash
# Via JSON API
curl -X POST "http://localhost:6201/v2/commands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [{
      "create": {
        "templateId": "Splice.Vault.Vault:Vault",
        "arguments": {
          "operator": "vault-operator::...",
          "config": {
            "underlyingAsset": {"label": "USDC", "issuer": "issuer::..."},
            "shareInstrumentId": "cUSDv",
            "depositLimit": {"Some": "10000000"},
            "minDeposit": "10",
            "withdrawalDelay": null,
            "managementFeeBps": 25,
            "performanceFeeBps": 500
          },
          "totalAssets": "0",
          "totalShares": "0"
        }
      }
    }],
    "actAs": ["vault-operator::..."],
    "commandId": "create-vault-001"
  }'
```

### Stop LocalNet

```bash
./scripts/stop.sh
```

### Clean All Data

```bash
./scripts/clean.sh
```

---

## DevNet Deployment

Connect to the Canton Network development environment.

### Prerequisites

1. **SV Sponsorship**: Contact a [Super Validator](https://sync.global/sv-network/) for DevNet access
2. **Validator Node**: Get VPN credentials from your SV
3. **Party ID**: Obtain a party ID on DevNet

### Configure Backend

Create `.env` file:

```bash
# DevNet Configuration
LEDGER_API_URL=https://your-validator.devnet.canton.network:6201/v2
LEDGER_ACCESS_TOKEN=eyJhbG...
LEDGER_SUBMIT=true
PORT=3000
```

### Deploy Backend

```bash
cd backend
npm run build

# Deploy to your server
# Example with PM2:
pm2 start dist/server.js --name vault-backend
```

### Deploy Frontend

```bash
cd frontend

# Build for production
npm run build

# Deploy to Vercel
vercel --prod

# Or other hosting:
# - Netlify: netlify deploy --prod
# - AWS: aws s3 sync .next/static s3://your-bucket
```

### Environment Variables (Frontend)

```bash
NEXT_PUBLIC_API_URL=https://api.your-vault.com
NEXT_PUBLIC_CANTON_NETWORK=devnet
```

---

## TestNet Deployment

Staging environment for pre-production testing.

### Differences from DevNet

- More stable
- Closer to production behavior
- Stricter onboarding requirements

### Steps

1. Apply for TestNet access via your SV
2. Follow DevNet deployment steps with TestNet credentials
3. Update `NEXT_PUBLIC_CANTON_NETWORK=testnet`

---

## MainNet Deployment

Production deployment on the Canton Network.

### Pre-Deployment Checklist

- [ ] Security audit of Daml contracts
- [ ] Penetration testing of backend/frontend
- [ ] Regulatory compliance review
- [ ] Operational runbooks
- [ ] Monitoring and alerting setup
- [ ] Incident response plan
- [ ] Backup and recovery procedures

### Infrastructure Requirements

| Component | Recommendation |
|-----------|----------------|
| Backend | 2+ instances, load balanced |
| Database | Managed PostgreSQL (if needed) |
| CDN | CloudFlare / AWS CloudFront |
| Monitoring | Datadog / Grafana |
| Secrets | HashiCorp Vault / AWS Secrets |

### High Availability Architecture

```
                    ┌─────────────┐
                    │   CDN/LB    │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Frontend   │ │  Frontend   │ │  Frontend   │
    │  (Vercel)   │ │  (Vercel)   │ │  (Vercel)   │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │  API Load   │
                    │  Balancer   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  Backend    │ │  Backend    │ │  Backend    │
    │  Instance 1 │ │  Instance 2 │ │  Instance 3 │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    ┌──────▼──────┐
                    │   Canton    │
                    │  Validator  │
                    │    Node     │
                    └─────────────┘
```

### Security Hardening

1. **API Security**
   ```bash
   # Rate limiting
   npm install express-rate-limit
   
   # Helmet for HTTP headers
   npm install helmet
   
   # Input validation
   npm install joi
   ```

2. **Environment Variables**
   - Never commit secrets
   - Use secret management (Vault, AWS Secrets Manager)
   - Rotate tokens regularly

3. **HTTPS Only**
   - Enforce TLS 1.3
   - HSTS headers
   - Certificate pinning for mobile

### Monitoring Setup

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"
  
  grafana:
    image: grafana/grafana
    ports:
      - "3002:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secret
```

### Alerting Rules

```yaml
# prometheus/alerts.yml
groups:
  - name: vault-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        
      - alert: LowLiquidity
        expr: vault_total_assets < 10000
        for: 10m
        labels:
          severity: warning
```

---

## Daml Package Versioning

### Version Scheme

```
canton-vault-{major}.{minor}.{patch}.dar
```

### Upgrade Process

1. Build new DAR:
   ```bash
   daml build
   ```

2. Upload to participant:
   ```bash
   curl -X POST "https://api.vault.com/v2/packages" \
     -H "Authorization: Bearer $TOKEN" \
     --data-binary @".daml/dist/canton-vault-0.2.0.dar"
   ```

3. Migrate contracts (if needed):
   ```daml
   -- Migration script
   migrateVaults = do
     vaults <- query @OldVault
     forA vaults \(cid, v) -> do
       archive cid
       create NewVault with
         operator = v.operator
         config = upgradeConfig v.config
         totalAssets = v.totalAssets
         totalShares = v.totalShares
   ```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs vault-participant

# Common issues:
# - Port already in use: lsof -i :5011
# - Insufficient memory: Increase Docker RAM
# - Network issues: docker network prune
```

### JSON API connection refused

```bash
# Verify participant is healthy
curl http://localhost:5012/health

# Check JSON API logs
docker compose logs vault-json-api
```

### DAR upload fails

```bash
# Check package format
daml damlc validate .daml/dist/canton-vault-0.1.0.dar

# Check participant connectivity
grpcurl -plaintext localhost:5011 list
```

### Frontend can't reach backend

```bash
# Check CORS settings in backend
# Verify API_URL environment variable
# Check network policies if in Kubernetes
```

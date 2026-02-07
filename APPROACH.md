# APPROACH.md - Development Guidelines

## Core Principle: Deliver Complete Solutions

When given a task, deliver the **full working solution**, not just scaffolding or config files.

### What "Complete" Means

1. **Code compiles/runs** - No syntax errors, all imports resolve
2. **Actually tested** - Run it, verify it works, show the output
3. **Integration verified** - If it depends on other services, start those services
4. **End-to-end flow works** - Not just individual pieces

### Common Failures to Avoid

❌ "Created config files" → but never started the services  
❌ "Added the endpoint" → but never tested it returns data  
❌ "Wrote the Daml" → but never compiled it  
❌ "Set up localnet" → but never verified contracts deploy  

### Correct Approach

✅ Create config → Start services → Verify they're healthy  
✅ Add endpoint → Call it → Show the response  
✅ Write Daml → Compile → Run tests → Show passing  
✅ Set up localnet → Start it → Deploy DAR → Query contracts → Verify data  

## Before Declaring "Done"

Run the verification checklist:

```bash
# 1. Services are running
curl http://localhost:3000/health  # Backend
curl http://localhost:3001         # Frontend  
curl http://localhost:6201/livez   # Canton JSON API (if localnet)

# 2. Data flows work
curl http://localhost:3000/api/vaults  # Returns vault list

# 3. Integration tests pass
npm test  # or ./scripts/test-integration.sh
```

## LocalNet Checklist

When setting up Canton LocalNet:

- [ ] Docker is running
- [ ] `docker compose up` succeeds
- [ ] Canton participant healthy
- [ ] Canton domain healthy
- [ ] JSON API responds
- [ ] DAR uploaded
- [ ] Initial contracts created
- [ ] Backend can query contracts
- [ ] Frontend displays real data

## Testing Requirements

Every feature needs:

1. **Unit tests** - For business logic
2. **Integration tests** - For API endpoints
3. **E2E tests** - For full user flows

After any refactoring, run the full test suite before declaring complete.

/**
 * Canton Vault Integration Tests
 * 
 * Run with: npx tsx tests/integration.test.ts
 * 
 * Tests the full API flow - works in both demo mode and against real Canton.
 */

const BASE_URL = process.env.API_URL || "http://localhost:3000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`✅ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message, duration: Date.now() - start });
    console.log(`❌ ${name}: ${err.message}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function api(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ===== Tests =====

async function testHealthCheck() {
  const data = await api("/health");
  assert(data.status === "ok", "Health check should return ok");
}

async function testListVaults() {
  const vaults = await api("/api/vaults");
  assert(Array.isArray(vaults), "Should return array");
  assert(vaults.length > 0, "Should have at least one vault");
  assert(vaults[0].id, "Vault should have id");
  assert(vaults[0].name, "Vault should have name");
  assert(typeof vaults[0].totalAssets === "number", "Should have totalAssets");
  assert(typeof vaults[0].sharePrice === "number", "Should have sharePrice");
}

async function testGetVault() {
  const vaults = await api("/api/vaults");
  const vault = await api(`/api/vaults/${vaults[0].id}`);
  assert(vault.id === vaults[0].id, "Should return correct vault");
  assert(vault.underlyingAsset, "Should have underlyingAsset");
}

async function testGetVaultNotFound() {
  try {
    await api("/api/vaults/nonexistent-vault-xyz");
    throw new Error("Should have thrown");
  } catch (err: any) {
    assert(err.message.includes("not found") || err.message.includes("404"), "Should return not found");
  }
}

async function testGetUnderlyingHoldings() {
  const holdings = await api("/api/underlying/test-user");
  assert(Array.isArray(holdings), "Should return array");
  // In demo mode, should have default holdings
  if (holdings.length > 0) {
    assert(holdings[0].instrument, "Holding should have instrument");
    assert(typeof holdings[0].amount === "number", "Holding should have amount");
  }
}

async function testGetShareHoldings() {
  const vaults = await api("/api/vaults");
  const holdings = await api(`/api/vaults/${vaults[0].id}/holdings/test-user`);
  assert(typeof holdings.shares === "number", "Should have shares");
  assert(typeof holdings.value === "number", "Should have value");
}

async function testDepositFlow() {
  const party = `test-deposit-${Date.now()}`;
  const vaults = await api("/api/vaults");
  const vault = vaults[0];
  
  // Get initial underlying
  const initialUnderlying = await api(`/api/underlying/${party}`);
  const usdc = initialUnderlying.find((h: any) => h.instrument === vault.underlyingAsset);
  assert(usdc, `Should have ${vault.underlyingAsset} holding`);
  const initialAmount = usdc.amount;
  
  // Get initial shares
  const initialShares = await api(`/api/vaults/${vault.id}/holdings/${party}`);
  
  // Deposit
  const depositAmount = 100;
  const depositResult = await api(`/api/vaults/${vault.id}/deposit`, {
    method: "POST",
    body: JSON.stringify({ party, amount: depositAmount }),
  });
  assert(depositResult.status === "accepted", "Deposit should be accepted");
  assert(depositResult.shares > 0, "Should receive shares");
  
  // Verify underlying decreased
  const afterUnderlying = await api(`/api/underlying/${party}`);
  const afterUsdc = afterUnderlying.find((h: any) => h.instrument === vault.underlyingAsset);
  assert(afterUsdc.amount === initialAmount - depositAmount, "Underlying should decrease");
  
  // Verify shares increased
  const afterShares = await api(`/api/vaults/${vault.id}/holdings/${party}`);
  assert(afterShares.shares > initialShares.shares, "Shares should increase");
}

async function testRedeemFlow() {
  const party = `test-redeem-${Date.now()}`;
  const vaults = await api("/api/vaults");
  const vault = vaults[0];
  
  // First deposit to have something to redeem
  await api(`/api/vaults/${vault.id}/deposit`, {
    method: "POST",
    body: JSON.stringify({ party, amount: 500 }),
  });
  
  const beforeShares = await api(`/api/vaults/${vault.id}/holdings/${party}`);
  const beforeUnderlying = await api(`/api/underlying/${party}`);
  const beforeUsdc = beforeUnderlying.find((h: any) => h.instrument === vault.underlyingAsset);
  
  // Redeem half
  const redeemShares = beforeShares.shares / 2;
  const redeemResult = await api(`/api/vaults/${vault.id}/redeem`, {
    method: "POST",
    body: JSON.stringify({ party, shares: redeemShares }),
  });
  assert(redeemResult.status === "accepted", "Redeem should be accepted");
  assert(redeemResult.assets > 0, "Should receive assets");
  
  // Verify shares decreased
  const afterShares = await api(`/api/vaults/${vault.id}/holdings/${party}`);
  assert(afterShares.shares < beforeShares.shares, "Shares should decrease");
  
  // Verify underlying increased
  const afterUnderlying = await api(`/api/underlying/${party}`);
  const afterUsdc = afterUnderlying.find((h: any) => h.instrument === vault.underlyingAsset);
  assert(afterUsdc.amount > beforeUsdc.amount, "Underlying should increase");
}

async function testInsufficientBalance() {
  const party = `test-insufficient-${Date.now()}`;
  const vaults = await api("/api/vaults");
  
  try {
    // Try to deposit more than available
    await api(`/api/vaults/${vaults[0].id}/deposit`, {
      method: "POST",
      body: JSON.stringify({ party, amount: 999999999 }),
    });
    throw new Error("Should have thrown");
  } catch (err: any) {
    assert(err.message.includes("Insufficient"), "Should fail with insufficient balance");
  }
}

async function testInsufficientShares() {
  const party = `test-nosahres-${Date.now()}`;
  const vaults = await api("/api/vaults");
  
  try {
    // Try to redeem without any shares
    await api(`/api/vaults/${vaults[0].id}/redeem`, {
      method: "POST",
      body: JSON.stringify({ party, shares: 100 }),
    });
    throw new Error("Should have thrown");
  } catch (err: any) {
    assert(err.message.includes("Insufficient"), "Should fail with insufficient shares");
  }
}

// ===== Run All Tests =====

async function main() {
  console.log(`\n🧪 Canton Vault Integration Tests`);
  console.log(`   API: ${BASE_URL}\n`);
  
  // Check if API is up
  try {
    await fetch(`${BASE_URL}/health`);
  } catch {
    console.error("❌ API not reachable. Start the backend first:");
    console.error("   cd ~/canton-vault/backend && npm run dev\n");
    process.exit(1);
  }
  
  await test("Health check", testHealthCheck);
  await test("List vaults", testListVaults);
  await test("Get vault by ID", testGetVault);
  await test("Get vault not found", testGetVaultNotFound);
  await test("Get underlying holdings", testGetUnderlyingHoldings);
  await test("Get share holdings", testGetShareHoldings);
  await test("Deposit flow", testDepositFlow);
  await test("Redeem flow", testRedeemFlow);
  await test("Insufficient balance error", testInsufficientBalance);
  await test("Insufficient shares error", testInsufficientShares);
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed (${totalTime}ms)`);
  
  if (failed > 0) {
    console.log(`\nFailed tests:`);
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  }
  
  console.log(`\n✅ All tests passed!\n`);
}

main();

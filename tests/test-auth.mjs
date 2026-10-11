import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { authManager, isLoopbackRequest, isValidOriginAndHost } from '../server/authManager.ts';

console.log('================================================================');
console.log('  FamilyVault — Zero-Database Local Authentication Tests        ');
console.log('================================================================\n');

const AUTH_FILE = path.resolve(process.cwd(), '.familyvault_auth.json');
const BACKUP_AUTH_FILE = path.resolve(process.cwd(), '.familyvault_auth.json.bak');

// Back up existing auth file if present
let hadOriginalAuthFile = false;
if (fs.existsSync(AUTH_FILE)) {
  hadOriginalAuthFile = true;
  fs.copyFileSync(AUTH_FILE, BACKUP_AUTH_FILE);
  fs.unlinkSync(AUTH_FILE);
}

try {
  // -----------------------------------------------------------------------------
  // Test 1: Unconfigured State
  // -----------------------------------------------------------------------------
  console.log('[TEST 1] Verifying unconfigured state...');
  assert.strictEqual(authManager.isConfigured(), false, 'Vault should not be configured initially');
  console.log('  [PASS] Correctly identifies unconfigured vault.\n');

  // -----------------------------------------------------------------------------
  // Test 2: Master Password Validation
  // -----------------------------------------------------------------------------
  console.log('[TEST 2] Testing master password validation (min length 8)...');
  const shortRes = authManager.setup('1234');
  assert.strictEqual(shortRes.success, false);
  assert(shortRes.error?.includes('at least 8 characters'));
  console.log('  [PASS] Short password rejected.\n');

  // -----------------------------------------------------------------------------
  // Test 3: Successful Setup
  // -----------------------------------------------------------------------------
  console.log('[TEST 3] Testing initial setup with valid master password...');
  const testPassword = 'StrongMasterVaultPassphrase#2026';
  const setupRes = authManager.setup(testPassword);
  assert.strictEqual(setupRes.success, true);
  assert(typeof setupRes.token === 'string' && setupRes.token.length === 64);
  assert.strictEqual(authManager.isConfigured(), true);
  assert(fs.existsSync(AUTH_FILE), 'Credential file must exist on disk');

  // Verify stored format
  const stored = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  assert(typeof stored.saltHex === 'string' && stored.saltHex.length === 64, 'Salt must be 32 bytes hex');
  assert(typeof stored.hashHex === 'string' && stored.hashHex.length === 128, 'Hash must be 64 bytes hex');
  assert.strictEqual(stored.iterations, 100000);
  assert.strictEqual(stored.digest, 'sha512');
  assert(!JSON.stringify(stored).includes(testPassword), 'Plaintext password must NEVER be in stored file');
  console.log('  [PASS] Setup successfully initialized salted PBKDF2 hash credential file.\n');

  // -----------------------------------------------------------------------------
  // Test 4: Prevent Re-setup When Already Configured
  // -----------------------------------------------------------------------------
  console.log('[TEST 4] Testing prevention of re-setup...');
  const reSetupRes = authManager.setup('AnotherPassword123');
  assert.strictEqual(reSetupRes.success, false);
  assert(reSetupRes.error?.includes('already configured'));
  console.log('  [PASS] Re-setup prevented.\n');

  // -----------------------------------------------------------------------------
  // Test 5: Login with Wrong Password
  // -----------------------------------------------------------------------------
  console.log('[TEST 5] Testing login with incorrect password...');
  const wrongLogin = authManager.login('WrongPassword#9999');
  assert.strictEqual(wrongLogin.success, false);
  assert(wrongLogin.error?.includes('Incorrect'));
  console.log('  [PASS] Incorrect password rejected safely.\n');

  // -----------------------------------------------------------------------------
  // Test 6: Login with Correct Password
  // -----------------------------------------------------------------------------
  console.log('[TEST 6] Testing login with correct master password...');
  const correctLogin = authManager.login(testPassword);
  assert.strictEqual(correctLogin.success, true);
  assert(typeof correctLogin.token === 'string' && correctLogin.token.length === 64);
  console.log('  [PASS] Correct password accepted and session token issued.\n');

  // -----------------------------------------------------------------------------
  // Test 7: Session Validation & Invalidation
  // -----------------------------------------------------------------------------
  console.log('[TEST 7] Testing session validation and logout...');
  assert.strictEqual(authManager.validateSession(correctLogin.token), true);
  assert.strictEqual(authManager.validateSession('invalid-random-token'), false);

  // Invalidate
  authManager.invalidateSession(correctLogin.token);
  assert.strictEqual(authManager.validateSession(correctLogin.token), false);
  console.log('  [PASS] Session validated and successfully invalidated on logout.\n');

  // -----------------------------------------------------------------------------
  // Test 8: Loopback & Host Security Guards
  // -----------------------------------------------------------------------------
  console.log('[TEST 8] Testing loopback and host/origin verification...');
  const localReq = {
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: 'localhost:5173', origin: 'http://localhost:5173' }
  };
  assert.strictEqual(isLoopbackRequest(localReq), true);
  assert.strictEqual(isValidOriginAndHost(localReq), true);

  const evilReq = {
    socket: { remoteAddress: '192.168.1.50' },
    headers: { host: 'evil-attacker.com', origin: 'http://evil-attacker.com' }
  };
  assert.strictEqual(isLoopbackRequest(evilReq), false);
  assert.strictEqual(isValidOriginAndHost(evilReq), false);
  console.log('  [PASS] Security guards reject non-loopback / untrusted hosts.\n');

  console.log('================================================================');
  console.log('  ALL AUTHENTICATION TESTS PASSED SUCCESSFULLY!                 ');
  console.log('================================================================\n');
} finally {
  // Clean up test file
  if (fs.existsSync(AUTH_FILE)) {
    fs.unlinkSync(AUTH_FILE);
  }
  if (hadOriginalAuthFile && fs.existsSync(BACKUP_AUTH_FILE)) {
    fs.copyFileSync(BACKUP_AUTH_FILE, AUTH_FILE);
    fs.unlinkSync(BACKUP_AUTH_FILE);
  }
}

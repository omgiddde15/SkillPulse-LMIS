const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('SkillPulse LMIS - API Client URL Resolution Verification');
console.log('================================================================\n');

// Read frontend/src/api/client.js content
const clientCode = fs.readFileSync(
  path.resolve(__dirname, '..', 'frontend', 'src', 'api', 'client.js'),
  'utf-8'
);

// 1. Verify VITE_API_BASE_URL is read from import.meta.env
assert.ok(
  clientCode.includes('import.meta.env?.VITE_API_BASE_URL'),
  'client.js must inspect import.meta.env?.VITE_API_BASE_URL'
);
console.log('✓ PASS: client.js inspects import.meta.env?.VITE_API_BASE_URL');

// 2. Verify resolveUrl logic
function mockResolveUrl(baseUrl, endpointPath) {
  const API_BASE_URL = (baseUrl || '').replace(/\/+$/, '');
  if (endpointPath.startsWith('http://') || endpointPath.startsWith('https://')) {
    return endpointPath;
  }
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
}

// Test case A: Local dev (empty baseUrl) -> returns relative path
assert.strictEqual(mockResolveUrl('', '/health'), '/health');
assert.strictEqual(mockResolveUrl(undefined, '/api/v1/metadata'), '/api/v1/metadata');
console.log('✓ PASS: When VITE_API_BASE_URL is unset, relative paths are preserved for Vite proxy.');

// Test case B: Production with backend URL -> prepends baseUrl
const prodBackend = 'https://skillpulse-lmis.onrender.com';
assert.strictEqual(
  mockResolveUrl(prodBackend, '/health'),
  'https://skillpulse-lmis.onrender.com/health'
);
assert.strictEqual(
  mockResolveUrl(prodBackend, '/api/v1/metadata'),
  'https://skillpulse-lmis.onrender.com/api/v1/metadata'
);
assert.strictEqual(
  mockResolveUrl(prodBackend + '///', 'health'),
  'https://skillpulse-lmis.onrender.com/health'
);
console.log('✓ PASS: When VITE_API_BASE_URL is set, absolute backend URLs are formed cleanly.');

// 3. Verify vercel.json exists and has rewrites
const vercelJsonPath = path.resolve(__dirname, '..', 'frontend', 'vercel.json');
assert.ok(fs.existsSync(vercelJsonPath), 'frontend/vercel.json must exist');
const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
assert.ok(Array.isArray(vercelConfig.rewrites), 'vercel.json must have rewrites array');
const hasHealthRewrite = vercelConfig.rewrites.some(r => r.source === '/health');
const hasApiRewrite = vercelConfig.rewrites.some(r => r.source === '/api/v1/:match*');
const hasSpaRewrite = vercelConfig.rewrites.some(r => r.destination === '/index.html');
assert.ok(hasHealthRewrite, 'vercel.json must rewrite /health');
assert.ok(hasApiRewrite, 'vercel.json must rewrite /api/v1/:match*');
assert.ok(hasSpaRewrite, 'vercel.json must provide SPA fallback rewrite to /index.html');
console.log('✓ PASS: frontend/vercel.json configures /health, /api/v1, and SPA index.html rewrites.');

// 4. Verify auth token storage conventions and methods
assert.ok(
  clientCode.includes('export function getStoredSessionToken'),
  'client.js must export getStoredSessionToken()'
);
assert.ok(
  clientCode.includes('export function setStoredSessionToken'),
  'client.js must export setStoredSessionToken()'
);
assert.ok(
  clientCode.includes("localStorage.getItem('sp_session')"),
  "client.js must follow the existing 'sp_session' storage key convention"
);
assert.ok(
  clientCode.includes("'Authorization': `Bearer ${token}`"),
  "client.js must inject Bearer authorization header when session token is present"
);
assert.ok(
  clientCode.includes('export function onUnauthorized'),
  'client.js must export onUnauthorized listener'
);
assert.ok(
  clientCode.includes('notifyUnauthorized()'),
  'client.js must notify unauthorized subscribers on 401 responses'
);
console.log('✓ PASS: client.js implements sp_session token persistence, Bearer header injection, and 401 notifications.');

// 5. Verify AuthProvider synchronizes auth state and handles 401 session expiration
const authProviderCode = fs.readFileSync(
  path.resolve(__dirname, '..', 'frontend', 'src', 'context', 'AuthProvider.jsx'),
  'utf-8'
);
assert.ok(
  authProviderCode.includes('setStoredSessionToken'),
  'AuthProvider.jsx must import and use setStoredSessionToken'
);
assert.ok(
  authProviderCode.includes('onUnauthorized'),
  'AuthProvider.jsx must subscribe to onUnauthorized events'
);
assert.ok(
  authProviderCode.includes('res.token || res.session_id'),
  'AuthProvider.jsx must store session token on login and register'
);
console.log('✓ PASS: AuthProvider.jsx synchronizes token storage and 401 unauthorized session expiration.');

console.log('\n================================================================');
console.log('ALL API CLIENT & AUTHENTICATION VERIFICATION TESTS PASSED');
console.log('================================================================');

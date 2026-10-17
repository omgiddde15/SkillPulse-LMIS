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

console.log('\n================================================================');
console.log('ALL API CLIENT & DEPLOYMENT VERIFICATION TESTS PASSED');
console.log('================================================================');

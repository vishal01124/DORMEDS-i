#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  PharmaDist Pro — Pre-Deploy Validation Script
//  Run before pushing: node scripts/pre-deploy-check.js
//  Catches issues BEFORE they reach Render
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server');
let errors = 0;
let warnings = 0;

function pass(msg) { console.log(`  ✅ ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); errors++; }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); warnings++; }

console.log('\n🔍 PharmaDist Pre-Deploy Check\n' + '─'.repeat(45));

// ── 1. Critical files exist ──────────────────────────────────
console.log('\n📁 Critical Files:');
const critical = [
  'index.html', 'app.js', 'style.css',
  'server/server.js', 'server/package.json',
  'render.yaml', 'Procfile'
];
for (const f of critical) {
  fs.existsSync(path.join(ROOT, f)) ? pass(f) : fail(`MISSING: ${f}`);
}

// ── 2. package.json validity ─────────────────────────────────
console.log('\n📦 Package Validation:');
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(path.join(SERVER, 'package.json'), 'utf8'));
  pass('package.json is valid JSON');
} catch (e) {
  fail('package.json is invalid JSON: ' + e.message);
  process.exit(1);
}

// Check for caret/tilde ranges (risky)
const deps = pkg.dependencies || {};
for (const [name, ver] of Object.entries(deps)) {
  if (ver.startsWith('^') || ver.startsWith('~')) {
    warn(`${name}@${ver} uses a range — pin to exact version for safety`);
  }
}

// Check engines
if (pkg.engines?.node) {
  pass(`Node engine: ${pkg.engines.node}`);
} else {
  warn('No engines.node specified — Render may use an unexpected version');
}

// ── 3. Syntax check server.js ────────────────────────────────
console.log('\n🔧 Server Syntax:');
try {
  execSync('node --check server.js', { cwd: SERVER, stdio: 'pipe' });
  pass('server.js has no syntax errors');
} catch (e) {
  fail('server.js has syntax errors:\n' + e.stderr?.toString());
}

// ── 4. Check render.yaml matches reality ─────────────────────
console.log('\n🌐 Render Config:');
try {
  const yaml = fs.readFileSync(path.join(ROOT, 'render.yaml'), 'utf8');
  
  // Extract startCommand
  const startMatch = yaml.match(/startCommand:\s*(.+)/);
  if (startMatch) {
    const startCmd = startMatch[1].trim();
    // Verify the file referenced in startCommand exists
    const parts = startCmd.split(/\s+/);
    const scriptPath = parts.find(p => p.endsWith('.js'));
    if (scriptPath && fs.existsSync(path.join(ROOT, scriptPath))) {
      pass(`startCommand: "${startCmd}" — file exists`);
    } else if (scriptPath) {
      fail(`startCommand references "${scriptPath}" but file doesn't exist!`);
    }
  }

  // Extract buildCommand
  const buildMatch = yaml.match(/buildCommand:\s*(.+)/);
  if (buildMatch) {
    pass(`buildCommand: "${buildMatch[1].trim()}"`);
  }

  // Check healthCheckPath
  if (yaml.includes('healthCheckPath')) {
    pass('Health check endpoint configured');
  } else {
    warn('No healthCheckPath — Render won\'t auto-restart on failure');
  }
} catch (e) {
  fail('Cannot read render.yaml: ' + e.message);
}

// ── 5. Check Procfile matches render.yaml ────────────────────
console.log('\n📄 Procfile:');
try {
  const procfile = fs.readFileSync(path.join(ROOT, 'Procfile'), 'utf8').trim();
  pass(`Procfile: "${procfile}"`);
  const procScript = procfile.replace('web: ', '').split(/\s+/).find(p => p.endsWith('.js'));
  if (procScript && !fs.existsSync(path.join(ROOT, procScript))) {
    fail(`Procfile references "${procScript}" but file doesn't exist!`);
  }
} catch (e) {
  warn('No Procfile found (ok if only using render.yaml)');
}

// ── 6. Check for known bad patterns ──────────────────────────
console.log('\n🛡️ Safety Checks:');
const serverCode = fs.readFileSync(path.join(SERVER, 'server.js'), 'utf8');

// Check for SQLite references (should be PostgreSQL only)
if (serverCode.includes('better-sqlite3') || serverCode.includes('sqlite3')) {
  warn('server.js references SQLite — should only use PostgreSQL (pg) for Render');
}

// Check for hardcoded localhost URLs
const localhostMatches = serverCode.match(/https?:\/\/localhost:\d+/g);
if (localhostMatches) {
  warn(`Found hardcoded localhost URLs: ${[...new Set(localhostMatches)].join(', ')}`);
}

// Check that pg is in dependencies
if (!deps.pg) {
  fail('pg (PostgreSQL driver) is not in dependencies!');
} else {
  pass('PostgreSQL driver (pg) is listed');
}

// ── Summary ──────────────────────────────────────────────────
console.log('\n' + '─'.repeat(45));
if (errors > 0) {
  console.error(`\n💥 FAILED: ${errors} error(s), ${warnings} warning(s)`);
  console.error('   Fix errors above before pushing to Render!\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\n⚠️  PASSED with ${warnings} warning(s) — review above`);
  console.log('   Safe to deploy, but consider fixing warnings.\n');
} else {
  console.log('\n🎉 ALL CHECKS PASSED — safe to deploy!\n');
}

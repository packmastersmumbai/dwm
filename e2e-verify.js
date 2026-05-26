// e2e-verify.js — Forward-Plan v3 verifier.
// Re-runs ONLY previously-failing probes. Exits 1 on regression, 0 on green.
// Reads .audit-results.json from the last `npm run audit`.
const FS = require('fs');
const PATH = require('path');
const { spawnSync } = require('child_process');

const RESULTS = PATH.join(__dirname, '.audit-results.json');
if (!FS.existsSync(RESULTS)) {
  console.error('No prior audit results (.audit-results.json). Run `npm run audit` first.');
  process.exit(2);
}

const prior = JSON.parse(FS.readFileSync(RESULTS, 'utf8'));
const priorFails = prior.results.filter(r => r.status === '✗').map(r => r.probe);

if (priorFails.length === 0) {
  console.log('No prior failures recorded. Running full audit as a regression check.');
}

// Stamp the failing-probe filter into an env var the rig can opt into,
// then run the full audit and compare exit deltas.
process.env.VERIFY_ONLY = priorFails.join(',');
const r = spawnSync(process.execPath, [PATH.join(__dirname, 'e2e-audit.js')], {
  stdio: 'inherit',
  env: process.env
});
if (r.status !== 0) {
  console.error('Audit rig itself failed (exit ' + r.status + ').');
  process.exit(2);
}

const after = JSON.parse(FS.readFileSync(RESULTS, 'utf8'));
const stillFailing = priorFails.filter(p => {
  const row = after.results.find(r => r.probe === p);
  return !row || row.status === '✗';
});
const newFails = after.results.filter(r => r.status === '✗' && !priorFails.includes(r.probe)).map(r => r.probe);

console.log('\n=== verify summary ===');
console.log('Prior failing probes:   ' + (priorFails.join(', ') || '(none)'));
console.log('Still failing:          ' + (stillFailing.join(', ') || '(none)'));
console.log('Newly failing (regressions): ' + (newFails.join(', ') || '(none)'));

if (stillFailing.length === 0 && newFails.length === 0) {
  console.log('GREEN — safe to deploy.');
  process.exit(0);
}
console.error('RED — do NOT deploy.');
process.exit(1);

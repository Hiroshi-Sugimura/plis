// Lightweight runtime check for EL sanitize -> complementFacilities (pure node, no electron-store)
import './dateformat.mjs';
import EL from 'echonet-lite';

// Standalone sanitize function mirror
function sanitizeFacilities() {
  try {
    if (!EL.facilities || typeof EL.facilities !== 'object') return;
    for (const ip of Object.keys(EL.facilities)) {
      const fac = EL.facilities[ip];
      if (!fac || typeof fac !== 'object') {
        delete EL.facilities[ip];
        continue;
      }
      if (Array.isArray(fac.EOJs)) {
        fac.EOJs = fac.EOJs.filter((x) => typeof x === 'string');
      }
    }
  } catch (e) {
    console.error('sanitizeFacilities error:', e);
  }
}

// Craft malformed facilities that previously triggered undefined.match inside complementFacilities
EL.facilities = {
  '192.168.0.10': undefined,
  '192.168.0.11': { EOJs: ['028801', 'random', 123, null], Means: {} },
  '192.168.0.12': 'bad',
  '192.168.0.13': { EOJs: ['02f001'], Means: {} }
};

try {
  sanitizeFacilities();
  // After sanitize, running library complement should not throw
  EL.complementFacilities();
  console.log('[TEST] OK: complementFacilities survived with sanitized facilities');
  process.exit(0);
} catch (e) {
  console.error('[TEST] FAIL:', e?.stack || e);
  process.exit(1);
}

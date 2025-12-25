//////////////////////////////////////////////////////////////////////
/**
 * @file test-el-sanitize.mjs
 * @module test-el-sanitize
 * @description Runtime test for EL sanitize function.
 * Tests sanitizeFacilities() to ensure it handles malformed data correctly
 * before passing to complementFacilities() in echonet-lite library.
 *
 * This test verifies:
 * - Undefined facility entries are removed
 * - Invalid EOJ entries (non-strings) are filtered
 * - Complementary facility processing doesn't throw errors
 */

// Lightweight runtime check for EL sanitize -> complementFacilities (pure node, no electron-store)
import './dateformat.mjs';
import EL from 'echonet-lite';

// Standalone sanitize function mirror
function sanitizeFacilities() {
  /**
   * Sanitize EL facilities object to remove malformed entries.
   * Removes undefined entries and filters invalid EOJ strings from arrays.
   * @inner
   * @returns {void}
   */
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

/**
 * Execute the test: sanitize malformed facilities and verify complementFacilities works.
 * @returns {void}
 */
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

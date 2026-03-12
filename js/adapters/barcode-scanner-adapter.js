/**
 * BarcodeScannerAdapter
 *
 * Adapter for camera-based barcode scanning.
 *
 * Behaviour:
 *   - isAvailable() checks three conditions:
 *       1. navigator.mediaDevices is present in the browser.
 *       2. The page is running in a secure context (HTTPS or localhost).
 *       3. Camera permission is not explicitly denied.
 *     Resolves true only when all three pass; false otherwise.
 *
 *   - requestInput():
 *       When unavailable — rejects immediately with a structured capability
 *       object: { reason: "no_camera_support", fallback: "manual" }.
 *       When available   — resolves with a mock scanned barcode result
 *       (real scanning logic is not yet implemented).
 *
 * Registration:
 *   Self-registers with FoodInputController under the "scan" type when both
 *   FoodInputAdapter and FoodInputController are on the global scope.
 *
 * Lazy-load safe: guarded against double-definition on window.
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Capability rejection payload
  // ---------------------------------------------------------------------------

  const CAPABILITY_ERROR = Object.freeze({
    reason: 'no_camera_support',
    fallback: 'manual',
  });

  // ---------------------------------------------------------------------------
  // Mock scan result
  // ---------------------------------------------------------------------------

  const MOCK_SCAN_RESULT = Object.freeze({
    name: 'Scanned Food Item (mock)',
    calories: 150,
    protein: 5,
    carbs: 20,
    fat: 6,
  });

  // ---------------------------------------------------------------------------
  // BarcodeScannerAdapter
  // ---------------------------------------------------------------------------

  class BarcodeScannerAdapter extends (global.FoodInputAdapter || class {}) {
    /**
     * Detect whether camera-based scanning is usable in the current context.
     *
     * Three conditions must all be true:
     *   1. navigator.mediaDevices exists (browser API present).
     *   2. window.isSecureContext is true (HTTPS or localhost required).
     *   3. Camera permission state is not "denied" (queried via
     *      navigator.permissions when available; assumed allowed otherwise).
     *
     * @returns {Promise<boolean>}
     */
    isAvailable() {
      // Condition 1: mediaDevices API must be present.
      if (
        !global.navigator ||
        !global.navigator.mediaDevices
      ) {
        return Promise.resolve(false);
      }

      // Condition 2: secure context required for getUserMedia.
      if (!global.isSecureContext) {
        return Promise.resolve(false);
      }

      // Condition 3: check camera permission state when the Permissions API
      // is available; if it isn't, assume permission may be granted.
      if (
        global.navigator.permissions &&
        typeof global.navigator.permissions.query === 'function'
      ) {
        return global.navigator.permissions
          .query({ name: 'camera' })
          .then(function (result) {
            return result.state !== 'denied';
          })
          .catch(function () {
            // Permissions API present but query failed (e.g. unsupported
            // constraint on some browsers) — optimistically allow.
            return true;
          });
      }

      // Permissions API unavailable — mediaDevices present and secure context
      // satisfied, so assume available.
      return Promise.resolve(true);
    }

    /**
     * Request a barcode scan.
     *
     * Rejects immediately with the capability error object when the adapter is
     * not available.  Resolves with a mock food item when available.
     * Real camera/scanning logic will replace the mock in a future iteration.
     *
     * @returns {Promise<{name:string, calories:number, protein:number, carbs:number, fat:number}>}
     */
    requestInput() {
      return this.isAvailable().then(function (available) {
        if (!available) {
          return Promise.reject(CAPABILITY_ERROR);
        }

        // TODO: replace with real camera scanning logic.
        return {
          name: MOCK_SCAN_RESULT.name,
          calories: MOCK_SCAN_RESULT.calories,
          protein: MOCK_SCAN_RESULT.protein,
          carbs: MOCK_SCAN_RESULT.carbs,
          fat: MOCK_SCAN_RESULT.fat,
        };
      });
    }
  }

  // Expose the capability error shape as a static property for callers that
  // need to inspect the rejection value.
  BarcodeScannerAdapter.CAPABILITY_ERROR = CAPABILITY_ERROR;

  // ---------------------------------------------------------------------------
  // Install on global — lazy-load safe
  // ---------------------------------------------------------------------------

  if (global.BarcodeScannerAdapter) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[BarcodeScannerAdapter] Already defined — skipping re-definition.'
      );
    }
  } else {
    global.BarcodeScannerAdapter = BarcodeScannerAdapter;
  }

  // ---------------------------------------------------------------------------
  // Self-register with FoodInputController when available
  // ---------------------------------------------------------------------------

  if (
    global.FoodInputController &&
    typeof global.FoodInputController.registerAdapter === 'function'
  ) {
    global.FoodInputController.registerAdapter(
      'scan',
      new BarcodeScannerAdapter()
    );
  } else if (typeof console !== 'undefined') {
    console.warn(
      '[BarcodeScannerAdapter] FoodInputController not found — ' +
        'skipping auto-registration. Load food-input-controller.js ' +
        'before this script, or call ' +
        'FoodInputController.registerAdapter("scan", new BarcodeScannerAdapter()) manually.'
    );
  }
})(typeof window !== 'undefined' ? window : this);

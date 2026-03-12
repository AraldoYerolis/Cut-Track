/**
 * ManualBarcodeAdapter
 *
 * Adapter for manual barcode entry. Used when camera scanning is unavailable.
 *
 * Behaviour:
 *   - Prompts the user to type a numeric barcode (8–14 digits).
 *   - Validates the length and digit-only format.
 *   - Performs a simulated lookup against a built-in mock data map.
 *   - Resolves with a NormalizedFood object on success.
 *   - Rejects with a descriptive error when input is cancelled, invalid, or
 *     the barcode is not found in the mock database.
 *
 * Capability message (exposed as static property):
 *   "Camera scanning not supported on this device. Enter barcode manually."
 *
 * Registration:
 *   This file self-registers with FoodInputController under the "manual" type
 *   if both FoodInputAdapter and FoodInputController are already on the global
 *   scope when this script is evaluated.
 *
 * Lazy-load safe: guarded against double-definition on window.
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Capability message
  // ---------------------------------------------------------------------------

  const CAPABILITY_MESSAGE =
    'Camera scanning not supported on this device. Enter barcode manually.';

  // ---------------------------------------------------------------------------
  // Mock barcode database
  // Maps barcode string → NormalizedFood (minus the `source` field which the
  // controller injects automatically).
  // ---------------------------------------------------------------------------

  const MOCK_BARCODE_DB = Object.freeze({
    // EAN-8 (8 digits)
    '01234567': { name: 'Rice Cake', calories: 35, protein: 0.7, carbs: 7.3, fat: 0.3 },
    '04963406': { name: 'Granola Bar', calories: 190, protein: 4, carbs: 29, fat: 7 },

    // UPC-E (8 digits)
    '01260007': { name: 'Greek Yogurt (Plain, 100 g)', calories: 59, protein: 10, carbs: 3.6, fat: 0.4 },
    '07447806': { name: 'Canned Tuna (in water, 85 g)', calories: 100, protein: 22, carbs: 0, fat: 1 },

    // UPC-A (12 digits)
    '012345678905': { name: 'Banana (medium)', calories: 89, protein: 1.1, carbs: 23, fat: 0.3 },
    '049000028911': { name: 'Diet Cola (355 ml)', calories: 0, protein: 0, carbs: 0, fat: 0 },
    '016000275287': { name: 'Instant Oatmeal (packet)', calories: 150, protein: 5, carbs: 27, fat: 2.5 },
    '038000845031': { name: 'Corn Flakes (30 g)', calories: 100, protein: 2, carbs: 24, fat: 0 },
    '011110038364': { name: 'Whole Milk (240 ml)', calories: 150, protein: 8, carbs: 12, fat: 8 },
    '028400090179': { name: 'Baked Lays (28 g)', calories: 120, protein: 2, carbs: 23, fat: 2 },

    // EAN-13 (13 digits)
    '0012345678905': { name: 'Chicken Breast (100 g, cooked)', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
    '5000112637922': { name: 'Cheddar Cheese (30 g)', calories: 121, protein: 7.5, carbs: 0.1, fat: 10 },
    '5010477348571': { name: 'Skim Milk (240 ml)', calories: 83, protein: 8.3, carbs: 12.2, fat: 0.2 },
    '8001505005592': { name: 'Pasta (dry, 85 g)', calories: 310, protein: 11, carbs: 62, fat: 1.5 },

    // GTIN-14 (14 digits)
    '00012345678905': { name: 'Egg (large, 1 whole)', calories: 72, protein: 6, carbs: 0.4, fat: 5 },
    '10049000028918': { name: 'Sparkling Water (500 ml)', calories: 0, protein: 0, carbs: 0, fat: 0 },
  });

  // ---------------------------------------------------------------------------
  // ManualBarcodeAdapter
  // ---------------------------------------------------------------------------

  class ManualBarcodeAdapter extends (global.FoodInputAdapter || class {}) {
    /**
     * This adapter is always available — it only needs window.prompt(), which
     * every browser provides (except when blocked by sandboxing, which is
     * explicitly disallowed by most UI-embedding scenarios).
     *
     * @returns {Promise<boolean>}
     */
    isAvailable() {
      return Promise.resolve(
        typeof global.prompt === 'function'
      );
    }

    /**
     * Prompt the user for a barcode, validate it, and return the matching food.
     *
     * @returns {Promise<{name:string, calories:number, protein:number, carbs:number, fat:number}>}
     */
    requestInput() {
      return new Promise(function (resolve, reject) {
        const raw = global.prompt(
          CAPABILITY_MESSAGE + '\n\nEnter barcode (8–14 digits):'
        );

        // User cancelled the prompt (pressed Cancel or Esc).
        if (raw === null) {
          return reject(new Error('Barcode entry cancelled by user.'));
        }

        const trimmed = String(raw).trim();

        // Validate: digits only, 8–14 characters.
        if (!/^\d{8,14}$/.test(trimmed)) {
          return reject(
            new Error(
              `Invalid barcode "${trimmed}". ` +
                'A barcode must be 8–14 digits and contain no letters or symbols.'
            )
          );
        }

        // Look up in mock database.
        const entry = MOCK_BARCODE_DB[trimmed];
        if (!entry) {
          return reject(
            new Error(
              `Barcode "${trimmed}" was not found in the database. ` +
                'Please add the food manually instead.'
            )
          );
        }

        // Return a defensive copy so callers cannot mutate the mock db.
        resolve({
          name: entry.name,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
        });
      });
    }
  }

  // Expose the capability message as a static property.
  ManualBarcodeAdapter.CAPABILITY_MESSAGE = CAPABILITY_MESSAGE;

  // ---------------------------------------------------------------------------
  // Install on global — lazy-load safe
  // ---------------------------------------------------------------------------

  if (global.ManualBarcodeAdapter) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[ManualBarcodeAdapter] Already defined — skipping re-definition.'
      );
    }
  } else {
    global.ManualBarcodeAdapter = ManualBarcodeAdapter;
  }

  // ---------------------------------------------------------------------------
  // Self-register with FoodInputController when available
  // ---------------------------------------------------------------------------

  if (
    global.FoodInputController &&
    typeof global.FoodInputController.registerAdapter === 'function'
  ) {
    global.FoodInputController.registerAdapter(
      'manual',
      new ManualBarcodeAdapter()
    );
  } else if (typeof console !== 'undefined') {
    console.warn(
      '[ManualBarcodeAdapter] FoodInputController not found — ' +
        'skipping auto-registration. Load food-input-controller.js ' +
        'before this script, or call ' +
        'FoodInputController.registerAdapter("manual", new ManualBarcodeAdapter()) manually.'
    );
  }
})(typeof window !== 'undefined' ? window : this);

/**
 * FoodInputAdapter
 *
 * Base adapter contract for all food input sources.
 *
 * Concrete adapters extend this class and implement:
 *   - isAvailable()  → Promise<boolean>
 *   - requestInput() → Promise<NormalizedFood>
 *
 * NormalizedFood shape:
 *   {
 *     name:     string   — non-empty, trimmed
 *     calories: number   — finite, >= 0
 *     protein:  number   — finite, >= 0
 *     carbs:    number   — finite, >= 0
 *     fat:      number   — finite, >= 0
 *     source?:  string   — optional; defaults to the registered sourceType
 *   }
 *
 * Registration:
 *   FoodInputController.registerAdapter('scan', new MyScanAdapter());
 *
 * Lazy-load safe: guarded against double-definition on window.
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // FoodInputAdapter base class
  // ---------------------------------------------------------------------------

  class FoodInputAdapter {
    /**
     * Report whether this adapter can currently service a request.
     *
     * Subclasses should check device capabilities, browser API availability,
     * user permissions, network conditions, etc. before resolving.
     *
     * Returning false causes FoodInputController to throw a structured
     * AdapterError so callers can gracefully fall back to another source.
     *
     * @returns {Promise<boolean>}
     */
    isAvailable() {
      return Promise.resolve(false);
    }

    /**
     * Prompt the user (or underlying system) for a food selection and resolve
     * with a normalized food object.
     *
     * Subclasses MUST override this method.  The base implementation always
     * rejects so that incomplete adapters surface clearly during development.
     *
     * The resolved object must satisfy NormalizedFood (see file header).
     * FoodInputController re-validates the shape before dispatching events,
     * so returning extra fields is harmless but returning invalid values will
     * cause a structured AdapterError.
     *
     * @returns {Promise<{name:string, calories:number, protein:number, carbs:number, fat:number, source?:string}>}
     */
    requestInput() {
      return Promise.reject(
        new Error(
          'FoodInputAdapter.requestInput() must be implemented by subclass.'
        )
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Install on global — lazy-load safe
  // ---------------------------------------------------------------------------

  if (global.FoodInputAdapter) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[FoodInputAdapter] Already defined — skipping re-definition.'
      );
    }
  } else {
    global.FoodInputAdapter = FoodInputAdapter;
  }
})(typeof window !== 'undefined' ? window : this);

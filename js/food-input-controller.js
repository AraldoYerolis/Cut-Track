/**
 * FoodInputController
 *
 * Global singleton that brokers food input requests across source types.
 * Maintains a registry of adapters, dispatches food:selected events, and
 * provides structured error handling — with zero DOM access.
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /** All recognised source types. */
  const VALID_SOURCE_TYPES = Object.freeze([
    'scan',
    'manual',
    'favorites',
    'recent',
    'quickadd',
    'custom',
  ]);

  /** Event name dispatched when a food item is successfully selected. */
  const FOOD_SELECTED_EVENT = 'food:selected';

  // ---------------------------------------------------------------------------
  // Error helpers
  // ---------------------------------------------------------------------------

  /**
   * Structured error for adapter-level failures.
   * @param {string} sourceType
   * @param {string} message
   * @param {unknown} [cause]
   */
  function AdapterError(sourceType, message, cause) {
    const err = new Error(message);
    err.name = 'AdapterError';
    err.sourceType = sourceType;
    if (cause !== undefined) err.cause = cause;
    return err;
  }

  /**
   * Structured error for missing / unregistered adapters.
   * @param {string} sourceType
   */
  function CapabilityError(sourceType) {
    const err = new Error(
      `No adapter registered for source type "${sourceType}". ` +
        'Register an adapter via FoodInputController.registerAdapter() before requesting input.'
    );
    err.name = 'CapabilityError';
    err.sourceType = sourceType;
    return err;
  }

  // ---------------------------------------------------------------------------
  // Payload validation
  // ---------------------------------------------------------------------------

  const REQUIRED_FIELDS = ['name', 'calories', 'protein', 'carbs', 'fat'];

  /**
   * Validates the food payload returned by an adapter.
   * Throws a plain Error when required fields are missing or non-numeric.
   * @param {object} payload
   * @param {string} sourceType  Used in error messages.
   */
  function validatePayload(payload, sourceType) {
    if (!payload || typeof payload !== 'object') {
      throw new Error(
        `Adapter for "${sourceType}" must resolve with a plain object.`
      );
    }

    for (const field of REQUIRED_FIELDS) {
      if (!(field in payload)) {
        throw new Error(
          `Adapter for "${sourceType}" resolved without required field "${field}".`
        );
      }
    }

    const numericFields = ['calories', 'protein', 'carbs', 'fat'];
    for (const field of numericFields) {
      const val = payload[field];
      if (typeof val !== 'number' || !isFinite(val) || val < 0) {
        throw new Error(
          `Adapter for "${sourceType}" returned invalid value for "${field}": ${val}. ` +
            'Expected a finite non-negative number.'
        );
      }
    }

    if (typeof payload.name !== 'string' || payload.name.trim() === '') {
      throw new Error(
        `Adapter for "${sourceType}" returned an empty or non-string "name".`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Controller factory
  // ---------------------------------------------------------------------------

  function createFoodInputController() {
    /** @type {Map<string, Function>} */
    const adapters = new Map();

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Register an adapter for a given source type.
     *
     * An adapter is an async (or Promise-returning) function that, when called,
     * resolves with a food payload object:
     *   { name, calories, protein, carbs, fat, [source] }
     *
     * Registering a new adapter for an already-registered type replaces the
     * previous one — useful for feature detection / progressive enhancement.
     *
     * @param {string}   sourceType  One of the VALID_SOURCE_TYPES values.
     * @param {Function} adapterFn   () => Promise<FoodPayload>
     */
    function registerAdapter(sourceType, adapterFn) {
      if (!VALID_SOURCE_TYPES.includes(sourceType)) {
        throw new TypeError(
          `"${sourceType}" is not a recognised source type. ` +
            `Valid types: ${VALID_SOURCE_TYPES.join(', ')}.`
        );
      }

      if (typeof adapterFn !== 'function') {
        throw new TypeError(
          `Adapter for "${sourceType}" must be a function, got ${typeof adapterFn}.`
        );
      }

      adapters.set(sourceType, adapterFn);
    }

    /**
     * Unregister an adapter, making that source type unavailable again.
     * @param {string} sourceType
     */
    function unregisterAdapter(sourceType) {
      adapters.delete(sourceType);
    }

    /**
     * Returns true when an adapter is registered for the given source type.
     * @param {string} sourceType
     * @returns {boolean}
     */
    function hasAdapter(sourceType) {
      return adapters.has(sourceType);
    }

    /**
     * Request food input from the specified source.
     *
     * Lifecycle:
     *   1. Validates sourceType string.
     *   2. Rejects with CapabilityError if no adapter is registered.
     *   3. Calls the adapter; wraps any thrown/rejected value as AdapterError.
     *   4. Validates the resolved payload shape.
     *   5. Attaches `source` field from sourceType if not already present.
     *   6. Dispatches `food:selected` CustomEvent on `window`.
     *   7. Returns the normalised payload to the caller.
     *
     * @param {string} sourceType
     * @returns {Promise<{name:string, calories:number, protein:number, carbs:number, fat:number, source:string}>}
     */
    async function requestFoodInput(sourceType) {
      // 1. Validate sourceType
      if (typeof sourceType !== 'string' || sourceType.trim() === '') {
        throw new TypeError(
          'requestFoodInput() requires a non-empty string sourceType.'
        );
      }

      if (!VALID_SOURCE_TYPES.includes(sourceType)) {
        throw new TypeError(
          `"${sourceType}" is not a recognised source type. ` +
            `Valid types: ${VALID_SOURCE_TYPES.join(', ')}.`
        );
      }

      // 2. Capability check
      if (!adapters.has(sourceType)) {
        throw CapabilityError(sourceType);
      }

      const adapterFn = adapters.get(sourceType);

      // 3. Invoke adapter
      let rawPayload;
      try {
        rawPayload = await adapterFn();
      } catch (err) {
        throw AdapterError(
          sourceType,
          `Adapter for "${sourceType}" failed: ${err && err.message ? err.message : String(err)}`,
          err
        );
      }

      // 4. Validate payload shape
      try {
        validatePayload(rawPayload, sourceType);
      } catch (validationErr) {
        throw AdapterError(sourceType, validationErr.message, validationErr);
      }

      // 5. Normalise: ensure `source` field is present
      const payload = Object.assign({}, rawPayload, {
        name: String(rawPayload.name).trim(),
        calories: Number(rawPayload.calories),
        protein: Number(rawPayload.protein),
        carbs: Number(rawPayload.carbs),
        fat: Number(rawPayload.fat),
        source: typeof rawPayload.source === 'string' ? rawPayload.source : sourceType,
      });

      // 6. Dispatch event
      const event = new CustomEvent(FOOD_SELECTED_EVENT, {
        bubbles: true,
        cancelable: false,
        detail: payload,
      });
      global.dispatchEvent(event);

      // 7. Return to caller
      return payload;
    }

    // -----------------------------------------------------------------------
    // Expose
    // -----------------------------------------------------------------------

    return Object.freeze({
      registerAdapter,
      unregisterAdapter,
      hasAdapter,
      requestFoodInput,

      /** Expose constants for external reference. */
      VALID_SOURCE_TYPES,
      FOOD_SELECTED_EVENT,
    });
  }

  // ---------------------------------------------------------------------------
  // Install singleton
  // ---------------------------------------------------------------------------

  if (global.FoodInputController) {
    // Guard against accidental double-load — keep existing instance.
    if (typeof console !== 'undefined') {
      console.warn(
        '[FoodInputController] Already initialised — skipping re-initialisation.'
      );
    }
  } else {
    global.FoodInputController = createFoodInputController();
  }
})(typeof window !== 'undefined' ? window : this);

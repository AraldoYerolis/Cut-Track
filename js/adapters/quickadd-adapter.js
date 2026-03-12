/**
 * QuickAddAdapter
 *
 * Adapter for selecting a food item from the user's enabled quick-add foods,
 * ranked by historical usage frequency.
 *
 * Behaviour:
 *   - Reads enabled food IDs from the existing profile in localStorage
 *     (key: 'shred-profile') without modifying it.
 *   - Falls back to the global `userProfile` object when already in memory.
 *   - Cross-references against the global `foodDatabase` array (empty
 *     enabledFoodIds → all foods shown, matching the existing app behaviour).
 *   - Counts how many times each food appears across all log entries in
 *     localStorage (key: 'shred-logs') and sorts the list by that count
 *     descending so the most-used foods appear first.
 *   - Presents a lightweight modal overlay, reusing the host page's
 *     `.onboarding-overlay` / `.onboarding-modal` CSS classes and the
 *     existing `.quick-food-btn` / `.qf-*` button styles.
 *   - Does NOT alter the existing quick-add grid rendered by renderQuickAdd().
 *   - Resolves with a NormalizedFood object when the user taps a food.
 *   - Rejects when the user dismisses the modal (Cancel button, backdrop
 *     click, or Escape key).
 *
 * Registration:
 *   This file self-registers with FoodInputController under the "quickadd"
 *   source type if both FoodInputAdapter and FoodInputController are already
 *   on the global scope when this script is evaluated.
 *
 * Lazy-load safe: guarded against double-definition on window.
 */

(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /** localStorage key used by the application to persist the user profile. */
  const STORAGE_KEY = 'shred-profile';

  /** localStorage key used by the application to persist food logs. */
  const LOGS_KEY = 'shred-logs';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Return the array of enabled food entries, filtered by the user's
   * enabledFoodIds list and cross-referenced against the global foodDatabase.
   *
   * Priority for profile source:
   *   1. global.userProfile  (already parsed, kept in sync by the app)
   *   2. localStorage        (cold-start / adapter used before app init)
   *
   * When enabledFoodIds is empty the full foodDatabase is returned, matching
   * the behaviour of renderQuickAdd() in index.html.
   *
   * @returns {Array<{id:string, name:string, cal:number, prot:number, carb:number, fat:number}>}
   */
  function getEnabledFoods() {
    var enabledIds = [];

    if (global.userProfile && Array.isArray(global.userProfile.enabledFoodIds)) {
      enabledIds = global.userProfile.enabledFoodIds;
    } else {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          var profile = JSON.parse(raw);
          if (Array.isArray(profile.enabledFoodIds)) {
            enabledIds = profile.enabledFoodIds;
          }
        }
      } catch (_) {
        // Ignore JSON / storage errors — fall through with empty list.
      }
    }

    var db = Array.isArray(global.foodDatabase) ? global.foodDatabase : [];

    return enabledIds.length
      ? db.filter(function (f) { return enabledIds.includes(f.id); })
      : db.slice();
  }

  /**
   * Build a frequency map of food IDs from the stored log history.
   *
   * Reads 'shred-logs' from localStorage (falling back to the in-memory
   * global.logsByDate when available) and counts how many log entries
   * reference each food ID across all dates.
   *
   * @returns {Object.<string, number>}  Map of foodId → usage count.
   */
  function buildUsageFrequency() {
    var counts = {};

    var logsByDate = null;

    // Prefer the in-memory object (already parsed by the app).
    if (global.logsByDate && typeof global.logsByDate === 'object') {
      logsByDate = global.logsByDate;
    } else {
      try {
        var raw = localStorage.getItem(LOGS_KEY);
        if (raw) {
          logsByDate = JSON.parse(raw);
        }
      } catch (_) {
        // Ignore JSON / storage errors — return empty frequency map.
      }
    }

    if (!logsByDate) return counts;

    var dates = Object.keys(logsByDate);
    for (var i = 0; i < dates.length; i++) {
      var entries = logsByDate[dates[i]];
      if (!Array.isArray(entries)) continue;
      for (var j = 0; j < entries.length; j++) {
        var entry = entries[j];
        if (entry && typeof entry.foodId === 'string') {
          counts[entry.foodId] = (counts[entry.foodId] || 0) + 1;
        }
      }
    }

    return counts;
  }

  /**
   * Return the enabled food list sorted by historical usage frequency,
   * most-used first. Foods with equal (or zero) usage retain their original
   * relative order.
   *
   * @returns {Array<{id:string, name:string, cal:number, prot:number, carb:number, fat:number}>}
   */
  function getSortedFoods() {
    var foods = getEnabledFoods();
    var freq = buildUsageFrequency();

    // Stable sort: foods with higher usage counts come first.
    return foods.slice().sort(function (a, b) {
      return (freq[b.id] || 0) - (freq[a.id] || 0);
    });
  }

  /**
   * Build and mount a selection modal, then return a Promise that settles when
   * the user picks a food (resolve) or dismisses the dialog (reject).
   *
   * Reuses existing CSS classes from the host page:
   *   .onboarding-overlay  — full-screen dark backdrop
   *   .onboarding-modal    — centred card with border-radius / padding
   *   .quick-food-btn      — food card button with hover highlight
   *   .qf-name / .qf-macros / .qf-macros .p|.c|.f  — typography inside card
   *
   * @param {Array} foods  Non-empty list returned by getSortedFoods().
   * @returns {Promise<{name:string, calories:number, protein:number, carbs:number, fat:number}>}
   */
  function showSelectionModal(foods) {
    return new Promise(function (resolve, reject) {

      // ── Build overlay ──────────────────────────────────────────────────────

      var overlay = document.createElement('div');
      overlay.className = 'onboarding-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Quick add a food');

      var modal = document.createElement('div');
      modal.className = 'onboarding-modal';
      modal.style.cssText = 'max-height:80vh;overflow-y:auto;max-width:480px;width:100%;';

      // ── Header ─────────────────────────────────────────────────────────────

      var header = document.createElement('div');
      header.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;' +
        'margin-bottom:16px;';

      var title = document.createElement('h2');
      title.style.cssText = 'margin:0;font-size:20px;font-weight:700;';
      title.textContent = 'Quick Add';

      var closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.setAttribute('aria-label', 'Cancel');
      closeBtn.style.cssText =
        'background:none;border:none;font-size:18px;cursor:pointer;' +
        'color:inherit;padding:4px 8px;line-height:1;';

      header.appendChild(title);
      header.appendChild(closeBtn);

      // ── Food list ──────────────────────────────────────────────────────────

      var list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

      foods.forEach(function (f) {
        var btn = document.createElement('button');
        btn.className = 'quick-food-btn';
        btn.style.cssText = 'width:100%;text-align:left;';

        var nameEl = document.createElement('div');
        nameEl.className = 'qf-name';
        nameEl.textContent = f.name;

        var macrosEl = document.createElement('div');
        macrosEl.className = 'qf-macros';
        macrosEl.innerHTML =
          '<span style="color:var(--accent)">' + f.cal + ' cal</span>' +
          '<span class="p">' + f.prot + 'P</span>' +
          '<span class="c">' + f.carb + 'C</span>' +
          '<span class="f">' + f.fat + 'F</span>';

        btn.appendChild(nameEl);
        btn.appendChild(macrosEl);

        btn.addEventListener('click', function () {
          cleanup();
          resolve({
            name:     f.name,
            calories: f.cal,
            protein:  f.prot,
            carbs:    f.carb,
            fat:      f.fat,
          });
        });

        list.appendChild(btn);
      });

      // ── Assemble & mount ───────────────────────────────────────────────────

      modal.appendChild(header);
      modal.appendChild(list);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // ── Teardown helpers ───────────────────────────────────────────────────

      function cleanup() {
        document.removeEventListener('keydown', onKeyDown);
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }

      function cancel() {
        cleanup();
        reject(new Error('Quick add selection cancelled by user.'));
      }

      // ── Dismiss triggers ───────────────────────────────────────────────────

      closeBtn.addEventListener('click', cancel);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) { cancel(); }
      });

      function onKeyDown(e) {
        if (e.key === 'Escape') { cancel(); }
      }
      document.addEventListener('keydown', onKeyDown);
    });
  }

  // ---------------------------------------------------------------------------
  // QuickAddAdapter
  // ---------------------------------------------------------------------------

  class QuickAddAdapter extends (global.FoodInputAdapter || class {}) {
    /**
     * Available when the DOM is accessible and at least one enabled food
     * exists (or the full food database is non-empty when no IDs are pinned).
     *
     * @returns {Promise<boolean>}
     */
    isAvailable() {
      return Promise.resolve(
        typeof document !== 'undefined' &&
        getEnabledFoods().length > 0
      );
    }

    /**
     * Open the quick-add selection modal — foods sorted by historical usage
     * frequency — and resolve with the chosen food.
     *
     * @returns {Promise<{name:string, calories:number, protein:number, carbs:number, fat:number}>}
     */
    requestInput() {
      var foods = getSortedFoods();
      if (!foods.length) {
        return Promise.reject(
          new Error(
            'No quick-add foods available. ' +
            'Enable foods in the Foods tab to use this feature.'
          )
        );
      }
      return showSelectionModal(foods);
    }
  }

  // ---------------------------------------------------------------------------
  // Install on global — lazy-load safe
  // ---------------------------------------------------------------------------

  if (global.QuickAddAdapter) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[QuickAddAdapter] Already defined — skipping re-definition.'
      );
    }
  } else {
    global.QuickAddAdapter = QuickAddAdapter;
  }

  // ---------------------------------------------------------------------------
  // Self-register with FoodInputController when available
  // ---------------------------------------------------------------------------

  if (
    global.FoodInputController &&
    typeof global.FoodInputController.registerAdapter === 'function'
  ) {
    global.FoodInputController.registerAdapter(
      'quickadd',
      new QuickAddAdapter()
    );
  } else if (typeof console !== 'undefined') {
    console.warn(
      '[QuickAddAdapter] FoodInputController not found — ' +
        'skipping auto-registration. Load food-input-controller.js ' +
        'before this script, or call ' +
        'FoodInputController.registerAdapter("quickadd", new QuickAddAdapter()) manually.'
    );
  }
})(typeof window !== 'undefined' ? window : this);

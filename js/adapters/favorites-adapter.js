/**
 * FavoritesAdapter
 *
 * Adapter for selecting a food item from the user's saved favorites.
 *
 * Behaviour:
 *   - Reads the user's enabled food IDs from the existing profile in
 *     localStorage (key: 'shred-profile') without modifying it.
 *   - Falls back to the global `userProfile` object when already in memory.
 *   - Cross-references against the global `foodDatabase` array to build the
 *     selectable list (empty enabledFoodIds → all foods shown, matching the
 *     app's existing behaviour in toggleFavoritesPanel / renderQuickAdd).
 *   - Presents a lightweight modal overlay, reusing the host page's
 *     `.onboarding-overlay` / `.onboarding-modal` CSS classes and the
 *     existing `.quick-food-btn` / `.qf-*` button styles.
 *   - Resolves with a NormalizedFood object when the user taps a food.
 *   - Rejects when the user dismisses the modal (Cancel button, backdrop
 *     click, or Escape key).
 *
 * Registration:
 *   This file self-registers with FoodInputController under the "favorites"
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

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Return the array of food entries the user has marked as favourites.
   *
   * Priority:
   *   1. global.userProfile  (already parsed, kept in sync by the app)
   *   2. localStorage        (cold-start / adapter used before app init)
   *
   * When enabledFoodIds is empty the full foodDatabase is returned, matching
   * the behaviour of toggleFavoritesPanel() and renderQuickAdd() in index.html.
   *
   * @returns {Array<{id:string, name:string, cal:number, prot:number, carb:number, fat:number}>}
   */
  function getFavoriteFoods() {
    let enabledIds = [];

    if (global.userProfile && Array.isArray(global.userProfile.enabledFoodIds)) {
      enabledIds = global.userProfile.enabledFoodIds;
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const profile = JSON.parse(raw);
          if (Array.isArray(profile.enabledFoodIds)) {
            enabledIds = profile.enabledFoodIds;
          }
        }
      } catch (_) {
        // Ignore JSON / storage errors — fall through with empty list.
      }
    }

    const db = Array.isArray(global.foodDatabase) ? global.foodDatabase : [];

    return enabledIds.length
      ? db.filter(function (f) { return enabledIds.includes(f.id); })
      : db.slice();
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
   * @param {Array} foods  Non-empty list returned by getFavoriteFoods().
   * @returns {Promise<{name:string, calories:number, protein:number, carbs:number, fat:number}>}
   */
  function showSelectionModal(foods) {
    return new Promise(function (resolve, reject) {

      // ── Build overlay ──────────────────────────────────────────────────────

      var overlay = document.createElement('div');
      overlay.className = 'onboarding-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Select a favorite food');

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
      title.textContent = 'Select a Favorite';

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
        reject(new Error('Favorites selection cancelled by user.'));
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
  // FavoritesAdapter
  // ---------------------------------------------------------------------------

  class FavoritesAdapter extends (global.FoodInputAdapter || class {}) {
    /**
     * Available when the DOM is accessible and at least one favourite food
     * exists (or the full food database is non-empty when no IDs are pinned).
     *
     * @returns {Promise<boolean>}
     */
    isAvailable() {
      return Promise.resolve(
        typeof document !== 'undefined' &&
        getFavoriteFoods().length > 0
      );
    }

    /**
     * Open the favourites selection modal and resolve with the chosen food.
     *
     * @returns {Promise<{name:string, calories:number, protein:number, carbs:number, fat:number}>}
     */
    requestInput() {
      var foods = getFavoriteFoods();
      if (!foods.length) {
        return Promise.reject(
          new Error(
            'No favorite foods available. ' +
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

  if (global.FavoritesAdapter) {
    if (typeof console !== 'undefined') {
      console.warn(
        '[FavoritesAdapter] Already defined — skipping re-definition.'
      );
    }
  } else {
    global.FavoritesAdapter = FavoritesAdapter;
  }

  // ---------------------------------------------------------------------------
  // Self-register with FoodInputController when available
  // ---------------------------------------------------------------------------

  if (
    global.FoodInputController &&
    typeof global.FoodInputController.registerAdapter === 'function'
  ) {
    global.FoodInputController.registerAdapter(
      'favorites',
      new FavoritesAdapter()
    );
  } else if (typeof console !== 'undefined') {
    console.warn(
      '[FavoritesAdapter] FoodInputController not found — ' +
        'skipping auto-registration. Load food-input-controller.js ' +
        'before this script, or call ' +
        'FoodInputController.registerAdapter("favorites", new FavoritesAdapter()) manually.'
    );
  }
})(typeof window !== 'undefined' ? window : this);

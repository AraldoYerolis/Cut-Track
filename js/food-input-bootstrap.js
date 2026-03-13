/**
 * food-input-bootstrap.js
 *
 * Wires the FoodInputController to all available adapters and connects
 * the scan button and food:selected event to the existing logging pipeline.
 *
 * Safety contract:
 *  - Does NOT modify layout, CSS, DOM ids, or navigation.
 *  - Does NOT alter macro calculations or the logging pipeline internals.
 *  - ONLY registers adapters and forwards selected foods to existing globals.
 */

(function (global) {
  'use strict';

  var doc = global.document;
  var initRan = false;
  var badgeEl = null;

  if (!doc || !doc.documentElement) return;

  console.log('FOOD BOOTSTRAP FILE EXECUTED');
  doc.documentElement.setAttribute('data-food-bootstrap-file', 'executed');
  doc.documentElement.setAttribute('data-food-bootstrap-init', 'pending');

  function ensureBadge() {
    if (badgeEl && badgeEl.parentNode) return badgeEl;
    if (!doc.body) return null;

    badgeEl = doc.createElement('div');
    badgeEl.setAttribute('aria-hidden', 'true');
    badgeEl.style.cssText = [
      'position:fixed',
      'right:12px',
      'bottom:12px',
      'z-index:2147483647',
      'padding:6px 8px',
      'border-radius:999px',
      'background:rgba(0,0,0,0.82)',
      'color:#fff',
      'font:600 11px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
      'letter-spacing:0.02em',
      'pointer-events:none',
      'box-shadow:0 4px 12px rgba(0,0,0,0.35)'
    ].join(';');

    doc.body.appendChild(badgeEl);
    return badgeEl;
  }

  function updateBadge(text) {
    var el = ensureBadge();
    if (el) el.textContent = text;
  }

  updateBadge('BOOT FILE ONLY');

  function initFoodBootstrap() {
    if (initRan) return;
    initRan = true;

    console.log('FOOD BOOTSTRAP DOM READY');
    doc.documentElement.setAttribute('data-food-bootstrap-init', 'started');
    updateBadge('BOOT INIT STARTED');

    console.log('BOOTSTRAP LOADED');
    console.log('Controller:', global.FoodInputController);

    if (!global.FoodInputController) {
      console.warn('FoodInputController missing during bootstrap init');
      doc.documentElement.setAttribute('data-food-bootstrap-init', 'controller-missing');
      updateBadge('BOOT WAIT CTRL');
      return;
    }

    if (global.BarcodeScannerAdapter) {
      global.FoodInputController.registerAdapter('scan', new global.BarcodeScannerAdapter());
    }
    if (global.ManualBarcodeAdapter) {
      global.FoodInputController.registerAdapter('manual', new global.ManualBarcodeAdapter());
    }
    if (global.FavoritesAdapter) {
      global.FoodInputController.registerAdapter('favorites', new global.FavoritesAdapter());
    }
    if (global.QuickAddAdapter) {
      global.FoodInputController.registerAdapter('quickadd', new global.QuickAddAdapter());
    }

    doc.addEventListener('click', async function (e) {
      console.log('SCAN BUTTON HANDLER ENTERED');
      var scanButton = e.target && e.target.closest
        ? e.target.closest('[id*="scan"], [class*="scan"], [data-action="scan"]')
        : null;

      if (!scanButton) return;

      doc.documentElement.setAttribute('data-scan-tap', String(Date.now()));
      console.log('GLOBAL SCAN INTERCEPT');
      e.preventDefault();
      e.stopPropagation();

      try {
        await global.FoodInputController.requestFoodInput('scan');
      } catch (err) {
        console.log('Scan failed â manual fallback');
        await global.FoodInputController.requestFoodInput('manual');
      }
    }, true);

    doc.addEventListener('food:selected', function (event) {
      var detail = event.detail;
      if (!detail) return;

      if (!global.logsByDate[global.selectedDate]) {
        global.logsByDate[global.selectedDate] = [];
      }
      global.logItems = global.logsByDate[global.selectedDate];

      global.logItems.push({
        foodId: null,
        servings: 1,
        cal: detail.calories,
        prot: detail.protein,
        carb: detail.carbs,
        fat: detail.fat,
        name: detail.name
      });

      global.saveLog();
      global.renderLog();
      global.updateStats();
    });

    console.log('CUTOS Food Input Engine Ready');
    doc.documentElement.setAttribute('data-food-bootstrap-init', 'done');
    updateBadge('BOOT INIT DONE');
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', initFoodBootstrap, { once: true });
  } else {
    initFoodBootstrap();
  }
})(window);

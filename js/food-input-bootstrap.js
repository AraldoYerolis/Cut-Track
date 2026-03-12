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

document.addEventListener('DOMContentLoaded', function () {

  // ------------------------------------------------------------------
  // Diagnostic: confirm this file executed and the controller is live
  // ------------------------------------------------------------------
  console.log("BOOTSTRAP LOADED");
  console.log("Controller:", window.FoodInputController);

  // ------------------------------------------------------------------
  // 1. Register all input adapters with the controller
  // ------------------------------------------------------------------
  FoodInputController.registerAdapter('scan',      new BarcodeScannerAdapter());
  FoodInputController.registerAdapter('manual',    new ManualBarcodeAdapter());
  FoodInputController.registerAdapter('favorites', new FavoritesAdapter());
  FoodInputController.registerAdapter('quickadd',  new QuickAddAdapter());

  // ------------------------------------------------------------------
  // 2. Global scan click interceptor — catches any element whose id,
  //    class, or data-action indicates a scan intent, regardless of
  //    where in the DOM it lives. Falls back to manual entry if the
  //    camera adapter rejects.
  // ------------------------------------------------------------------
  document.addEventListener("click", async (e) => {
    const scanButton = e.target.closest('[id*="scan"], [class*="scan"], [data-action="scan"]');
    if (!scanButton) return;

    console.log("GLOBAL SCAN INTERCEPT");
    e.preventDefault();
    e.stopPropagation();

    try {
      await window.FoodInputController.requestFoodInput("scan");
    } catch (err) {
      console.log("Scan failed → manual fallback");
      await window.FoodInputController.requestFoodInput("manual");
    }
  });

  // ------------------------------------------------------------------
  // 3. Global food:selected listener — forwards to the existing log
  //    pipeline without changing how logging currently works.
  //
  //    The event is dispatched on window by FoodInputController but
  //    bubbles to document, so document.addEventListener captures it.
  //
  //    Logging mirrors the shape used by quickAdd() / addFood():
  //      { foodId, servings, cal, prot, carb, fat, name }
  // ------------------------------------------------------------------
  document.addEventListener('food:selected', function (event) {
    var detail = event.detail;

    if (!logsByDate[selectedDate]) {
      logsByDate[selectedDate] = [];
    }
    logItems = logsByDate[selectedDate];

    logItems.push({
      foodId:   null,
      servings: 1,
      cal:      detail.calories,
      prot:     detail.protein,
      carb:     detail.carbs,
      fat:      detail.fat,
      name:     detail.name
    });

    saveLog();
    renderLog();
    updateStats();
  });

  // ------------------------------------------------------------------
  // 4. Confirm engine is live
  // ------------------------------------------------------------------
  console.log('CUTOS Food Input Engine Ready');

});

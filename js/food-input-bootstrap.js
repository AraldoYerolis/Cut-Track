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
  // 1. Register all input adapters with the controller
  // ------------------------------------------------------------------
  FoodInputController.registerAdapter('scan',      new BarcodeScannerAdapter());
  FoodInputController.registerAdapter('manual',    new ManualBarcodeAdapter());
  FoodInputController.registerAdapter('favorites', new FavoritesAdapter());
  FoodInputController.registerAdapter('quickadd',  new QuickAddAdapter());

  // ------------------------------------------------------------------
  // 2. Attach click handler to the existing scan button (#btn-scan).
  //    Falls back to manual barcode entry if the camera adapter rejects.
  // ------------------------------------------------------------------
  var scanBtn = document.querySelector('#btn-scan');
  if (scanBtn) {
    // Clone and replace to strip ALL existing click listeners safely.
    var scanBtnClone = scanBtn.cloneNode(true);
    scanBtn.parentNode.replaceChild(scanBtnClone, scanBtn);

    scanBtnClone.addEventListener('click', async () => {
      try {
        await FoodInputController.requestFoodInput('scan');
      } catch (e) {
        await FoodInputController.requestFoodInput('manual');
      }
    });

    console.log('SCAN BUTTON OVERRIDDEN');
  }

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

'use strict';

const CHANNEL = 'summary-shown';

// Script exécuté dans la fenêtre du jeu. Observe le body : le jeu peut recréer la page de résultats.
const WATCH_SCRIPT = `(function () { try {
  if (window.__matchImpactObserver) { window.__matchImpactObserver.disconnect(); }
  var SELECTOR = '#bookingResults .bookingResultsFinalSummary';
  var wasVisible = false;
  function isVisible(el) { return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none'; }
  function check() {
    var visible = isVisible(document.querySelector(SELECTOR));
    if (visible && !wasVisible) {
      var showID = (typeof Booking !== 'undefined' && Booking && Booking.currentShow != null) ? Number(Booking.currentShow) : null;
      plugins.send('match-impact', '${CHANNEL}', { showID: isFinite(showID) ? showID : null });
    }
    wasVisible = visible;
  }
  wasVisible = isVisible(document.querySelector(SELECTOR));
  var observer = new MutationObserver(check);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  window.__matchImpactObserver = observer;
} catch (e) { console.error('[match-impact] surveillance', e); } })();`;

const STOP_SCRIPT = `(function () { try {
  if (window.__matchImpactObserver) { window.__matchImpactObserver.disconnect(); }
  delete window.__matchImpactObserver;
} catch (e) { console.error('[match-impact] arrêt surveillance', e); } })();`;

function createSummaryWatcher({ ui, ipc, onSummaryShown, logger }) {
  function start() {
    ipc.on(CHANNEL, (event, data) => onSummaryShown(data || {}));
    Promise.resolve(ui.executeJS(WATCH_SCRIPT)).catch((e) => logger.error('summaryWatcher.start', e));
  }

  function stop() {
    Promise.resolve(ui.executeJS(STOP_SCRIPT)).catch((e) => logger.error('summaryWatcher.stop', e));
  }

  return { start, stop };
}

module.exports = { createSummaryWatcher };

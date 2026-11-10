'use strict';
const { renderPanel, renderFloating, resolveAvatarsJs, RECAP_CSS } = require('../presentation/recapHtml');

function summaryScript(html) {
  return '(function () { try {'
    + " var side = document.querySelector('#bookingResults .br-summary-side');"
    + ' if (!side) return false;'
    + " var old = side.querySelector('.mi-panel'); if (old) old.remove();"
    + ` side.insertAdjacentHTML('beforeend', ${JSON.stringify(html)});`
    + ` ${resolveAvatarsJs("side.querySelector('.mi-panel')")}`
    + ' return true;'
    + " } catch (e) { console.error('[match-impact] panneau', e); return false; } })();";
}

function floatingScript(html) {
  return '(function () { try {'
    + " var old = document.getElementById('mi-floating'); if (old) old.remove();"
    + ` document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(html)});`
    + ` ${resolveAvatarsJs("document.getElementById('mi-floating')")}`
    + ' return true;'
    + " } catch (e) { console.error('[match-impact] panneau flottant', e); return false; } })();";
}

function createGameRecapView(ui, logger) {
  ui.injectCSS(RECAP_CSS);

  function showFloating(recap) {
    Promise.resolve(ui.executeJS(floatingScript(renderFloating(recap))))
      .catch((e) => logger.error('showFloating', e));
  }

  function showInSummary(recap) {
    Promise.resolve(ui.executeJS(summaryScript(renderPanel(recap))))
      .then((inserted) => { if (inserted !== true) showFloating(recap); })
      .catch((e) => { logger.error('showInSummary', e); showFloating(recap); });
  }

  return { showInSummary, showFloating };
}

module.exports = { createGameRecapView };

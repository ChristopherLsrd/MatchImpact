'use strict';
const {
  renderHistoryList, renderRecapBody, renderHistoryPageShell, resolveAvatarsJs,
} = require('../presentation/recapHtml');

const PAGE_ID = 'matchImpactPage';

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
  + '<path fill="currentColor" d="M64 64v384h416v-48H112V64H64zm96 256 96-112 80 64 128-144 32 32-160 176-80-64-64 80-32-32z"/></svg>';

const PAGE_SCRIPT = `(function () { try {
  window.MatchImpactPage = {
    init: function () {
      var list = document.getElementById('mi-history-list');
      var detail = document.getElementById('mi-history-detail');
      if (!list || !detail) return;
      list.innerHTML = '<div class="loading">Chargement…</div>';
      plugins.invoke('match-impact', 'history-list-html').then(function (html) {
        list.innerHTML = html;
        list.onclick = function (event) {
          var item = event.target.closest('[data-mi-index]');
          if (!item) return;
          list.querySelectorAll('[data-mi-index]').forEach(function (el) { el.classList.remove('active'); });
          item.classList.add('active');
          plugins.invoke('match-impact', 'recap-html', Number(item.getAttribute('data-mi-index'))).then(function (recapHtml) {
            detail.innerHTML = recapHtml;
            ${resolveAvatarsJs('detail')}
          }).catch(function (e) { console.error('[match-impact] récap', e); });
        };
      }).catch(function (e) { console.error('[match-impact] historique', e); });
    }
  };
} catch (e) { console.error('[match-impact] page historique', e); } })();`;

const STOP_SCRIPT = "(function () { try { delete window.MatchImpactPage; } catch (e) {} })();";

function createHistoryPage({ ui, ipc, queries, logger }) {
  function start() {
    ipc.handle('history-list-html', () => renderHistoryList(queries.listHistory()));
    ipc.handle('recap-html', (event, index) => {
      try {
        const recap = queries.getRecap(index);
        return recap ? renderRecapBody(recap) : '<div class="noResults">Récap introuvable.</div>';
      } catch (e) {
        logger.error('recap-html', e);
        return '<div class="noResults">Récap illisible.</div>';
      }
    });
    ui.addPage({
      id: PAGE_ID,
      title: 'Match Impact',
      backButton: 'mainOfficePage',
      initFunction: 'MatchImpactPage',
      html: renderHistoryPageShell(),
    });
    ui.addSideMenuItem({ pageId: PAGE_ID, label: 'Match Impact', section: 'bottom', svgIcon: ICON });
    Promise.resolve(ui.executeJS(PAGE_SCRIPT)).catch((e) => logger.error('historyPage.start', e));
  }

  function stop() {
    Promise.resolve(ui.executeJS(STOP_SCRIPT)).catch((e) => logger.error('historyPage.stop', e));
  }

  function reinject() {
    Promise.resolve(ui.executeJS(PAGE_SCRIPT)).catch((e) => logger.error('historyPage.reinject', e));
  }

  return { start, stop, reinject };
}

module.exports = { createHistoryPage };

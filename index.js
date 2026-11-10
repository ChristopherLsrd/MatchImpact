'use strict';
const path = require('path');

const PLUGIN_DIR = __dirname + path.sep;

// Le jeu vide le cache du module principal au rechargement à chaud ; on vide aussi celui de src/.
function purgeModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(PLUGIN_DIR) && key !== __filename) delete require.cache[key];
  }
}

let teardown = null;
let reinject = null;

module.exports = {
  activate(api) {
    purgeModuleCache();
    const { createShowTracker } = require('./src/application/ShowTracker');
    const { createHistoryQueries } = require('./src/application/HistoryQueries');
    const { createSqlRosterReader } = require('./src/adapters/SqlRosterReader');
    const { createStorageHistoryStore } = require('./src/adapters/StorageHistoryStore');
    const { createGameRecapView } = require('./src/adapters/GameRecapView');
    const { createGameSettings } = require('./src/adapters/GameSettings');
    const { createGameState } = require('./src/adapters/GameState');
    const { createSettingsEditor } = require('./src/application/SettingsEditor');
    const { createSummaryWatcher } = require('./src/adapters/summaryWatcher');
    const { createHistoryPage } = require('./src/adapters/historyPage');

    const logger = {
      log: (...args) => api.console.log(...args),
      error: (...args) => api.console.error(...args),
    };
    const settings = createGameSettings(api.settings);
    const roster = createSqlRosterReader((sql, params) => api.database.query(sql, params));
    const history = createStorageHistoryStore(api.storage);
    const view = createGameRecapView(api.ui, logger);
    const gameState = createGameState(api.game, (sql, params) => api.database.query(sql, params));

    const tracker = createShowTracker({ roster, history, view, settings, gameState, logger });
    const queries = createHistoryQueries({ history, logger });
    const settingsEditor = createSettingsEditor({ settings, logger });

    api.events.on('show:started', (event) => tracker.onShowStarted(event && event.data));
    api.events.on('show:ended', (event) => tracker.onShowEnded(event && event.data));

    const watcher = createSummaryWatcher({
      ui: api.ui, ipc: api.ipc, onSummaryShown: (payload) => tracker.onSummaryShown(payload), logger,
    });
    const page = createHistoryPage({ ui: api.ui, ipc: api.ipc, queries, settingsEditor, logger });
    watcher.start();
    page.start();
    view.refreshLocale();

    reinject = () => {
      view.refreshLocale();
      watcher.reinject();
      page.reinject();
    };

    teardown = () => {
      watcher.stop();
      page.stop();
      try { api.ui.widgets.removeAll(); } catch (e) { logger.error('widgets.removeAll', e); }
      Promise.resolve(api.ui.executeJS(
        "(function () { try { document.querySelectorAll('[data-plugin-id=\"match-impact\"]')"
        + '.forEach(function (el) { el.remove(); }); } catch (e) {} })();',
      )).catch((e) => logger.error('nettoyage', e));
    };

    logger.log('Match Impact activé.');
  },

  onRendererLoad() {
    if (reinject) reinject();
  },

  deactivate() {
    if (!teardown) return;
    try { teardown(); } catch (e) { /* le jeu nettoie le reste */ }
    teardown = null;
    reinject = null;
  },
};

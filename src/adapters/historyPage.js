'use strict';
const {
  renderHistoryList, renderRecapBody, renderHistoryPageShell, renderSettingsForm, resolveAvatarsJs, escapeHtml,
} = require('../presentation/recapHtml');
const { t } = require('../presentation/i18n');
const { SETTINGS_SCHEMA } = require('../application/ports');

const PAGE_ID = 'matchImpactPage';

const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
  + '<path fill="currentColor" d="M64 64v384h416v-48H112V64H64zm96 256 96-112 80 64 128-144 32 32-160 176-80-64-64 80-32-32z"/></svg>';

// Script exécuté dans la fenêtre du jeu. Chaque appel transmet la langue du jeu (I18n.locale).
const PAGE_SCRIPT = `(function () { try {
  function locale() {
    try { return (typeof I18n !== 'undefined' && I18n && I18n.locale) ? String(I18n.locale) : null; } catch (e) { return null; }
  }
  function invoke() {
    return plugins.invoke.apply(plugins, ['match-impact'].concat(Array.prototype.slice.call(arguments)));
  }
  function bindSettings(form) {
    var status = form.querySelector('.mi-settings-status');
    var timer = null;
    function show(text, isError) {
      if (!status) return;
      if (timer) { clearTimeout(timer); timer = null; }
      status.textContent = text || '';
      status.classList.toggle('is-error', !!isError);
      if (!isError) timer = setTimeout(function () { status.textContent = ''; }, 2000);
    }
    form.addEventListener('change', function (event) {
      var input = event.target;
      var key = input && input.getAttribute ? input.getAttribute('data-mi-setting') : null;
      if (!key) return;
      var value;
      if (input.type === 'checkbox') {
        value = input.checked;
      } else {
        if (input.value === '') return;
        value = Number(input.value);
        if (!isFinite(value)) return;
      }
      invoke('settings-set', key, value, locale()).then(function (result) {
        if (result && result.ok) {
          if (input.type === 'checkbox') { input.checked = result.value; } else { input.value = result.value; }
          show(form.getAttribute('data-mi-saved'), false);
        } else {
          show(form.getAttribute('data-mi-error'), true);
        }
      }).catch(function (e) {
        console.error('[match-impact] réglage', e);
        show(form.getAttribute('data-mi-error'), true);
      });
    });
  }
  window.MatchImpactPage = {
    init: function () {
      var list = document.getElementById('mi-history-list');
      var detail = document.getElementById('mi-history-detail');
      var button = document.getElementById('mi-settings-button');
      if (!list || !detail) return;
      list.innerHTML = '<div class="loading mi-loading"></div>';
      invoke('page-texts', locale()).then(function (texts) {
        if (!texts) return;
        var label = button ? button.querySelector('.mi-settings-label') : null;
        if (label) label.textContent = texts.settings;
        var pick = detail.querySelector('.mi-history-pick');
        if (pick) pick.textContent = texts.historyPick;
        var loading = list.querySelector('.mi-loading');
        if (loading) loading.textContent = texts.loading;
      }).catch(function (e) { console.error('[match-impact] textes', e); });
      invoke('history-list-html', locale()).then(function (html) {
        list.innerHTML = html;
        list.onclick = function (event) {
          var item = event.target.closest('[data-mi-index]');
          if (!item) return;
          list.querySelectorAll('[data-mi-index]').forEach(function (el) { el.classList.remove('active'); });
          if (button) button.classList.remove('active');
          item.classList.add('active');
          invoke('recap-html', Number(item.getAttribute('data-mi-index')), locale()).then(function (recapHtml) {
            detail.innerHTML = recapHtml;
            ${resolveAvatarsJs('detail')}
          }).catch(function (e) { console.error('[match-impact] récap', e); });
        };
      }).catch(function (e) { console.error('[match-impact] historique', e); });
      if (button) {
        button.onclick = function () {
          list.querySelectorAll('[data-mi-index]').forEach(function (el) { el.classList.remove('active'); });
          button.classList.add('active');
          invoke('settings-form-html', locale()).then(function (formHtml) {
            detail.innerHTML = formHtml;
            var form = detail.querySelector('form.mi-settings');
            if (form) bindSettings(form);
          }).catch(function (e) { console.error('[match-impact] réglages', e); });
        };
      }
    }
  };
} catch (e) { console.error('[match-impact] page historique', e); } })();`;

const STOP_SCRIPT = "(function () { try { delete window.MatchImpactPage; } catch (e) {} })();";

function noResults(locale, key) {
  return `<div class="noResults">${escapeHtml(t(locale, key))}</div>`;
}

function createHistoryPage({ ui, ipc, queries, settingsEditor, logger }) {
  function start() {
    ipc.handle('page-texts', (event, locale) => ({
      settings: t(locale, 'settings'),
      historyPick: t(locale, 'historyPick'),
      loading: t(locale, 'loading'),
    }));
    ipc.handle('history-list-html', (event, locale) => renderHistoryList(queries.listHistory(), locale));
    ipc.handle('recap-html', (event, index, locale) => {
      try {
        const recap = queries.getRecap(index);
        return recap ? renderRecapBody(recap, locale) : noResults(locale, 'recapMissing');
      } catch (e) {
        logger.error('recap-html', e);
        return noResults(locale, 'recapUnreadable');
      }
    });
    ipc.handle('settings-form-html', (event, locale) => {
      try {
        return renderSettingsForm(SETTINGS_SCHEMA, settingsEditor.getAll(), locale);
      } catch (e) {
        logger.error('settings-form-html', e);
        return noResults(locale, 'settings.error');
      }
    });
    ipc.handle('settings-set', (event, key, value) => settingsEditor.set(key, value));
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

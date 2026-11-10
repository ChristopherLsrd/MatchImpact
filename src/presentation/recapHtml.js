'use strict';

const PLUGIN_ATTR = 'data-plugin-id="match-impact"';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatValue(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function formatDelta(delta) {
  const arrow = delta > 0 ? '▲' : '▼';
  const sign = delta > 0 ? '+' : '−';
  return `${arrow} ${sign}${formatValue(Math.abs(delta))}`;
}

function changeRow(label, before, after, delta, good) {
  return `<tr class="mi-change ${good ? 'mi-good' : 'mi-bad'}">`
    + `<td class="mi-label">${escapeHtml(label)}</td>`
    + `<td class="mi-values">${formatValue(before)} → ${formatValue(after)}</td>`
    + `<td class="mi-delta">${formatDelta(delta)}</td></tr>`;
}

function renderWorker(worker, segments) {
  const segmentNames = worker.segments
    .map((i) => (segments[i] ? segments[i].name : ''))
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  const injury = worker.injury
    ? `<div class="mi-injury">Blessure : ${escapeHtml(worker.injury.type)}`
      + `${worker.injury.healDate ? ` (retour ${escapeHtml(worker.injury.healDate)})` : ''}</div>`
    : '';
  const changes = worker.changes.length
    ? `<table class="mi-changes"><tbody>${worker.changes
      .map((c) => changeRow(c.label, c.before, c.after, c.delta, c.inverted ? c.delta < 0 : c.delta > 0))
      .join('')}</tbody></table>`
    : (worker.injury ? '' : '<div class="mi-nochange">Aucun changement</div>');
  return '<div class="mi-worker">'
    + `<div class="mi-worker-head"><span class="mi-worker-name">${escapeHtml(worker.name)}</span>`
    + `<span class="mi-worker-segs">${segmentNames}</span></div>`
    + `${injury}${changes}</div>`;
}

function renderRelations(relations) {
  if (!relations.length) return '';
  return '<div class="mi-relations"><h4>Relations</h4><table class="mi-changes"><tbody>'
    + relations.map((r) => changeRow(`${r.name1} ↔ ${r.name2}`, r.before, r.after, r.delta, r.delta > 0)).join('')
    + '</tbody></table></div>';
}

function renderRecapBody(recap) {
  const header = `<div class="mi-show">${escapeHtml(recap.showName)}${recap.date ? ` · ${escapeHtml(recap.date)}` : ''}</div>`;
  if (!recap.workers.length && !recap.relations.length) {
    return `${header}<div class="noResults">Aucun participant suivi pour ce show.</div>`;
  }
  return header
    + recap.workers.map((w) => renderWorker(w, recap.segments)).join('')
    + renderRelations(recap.relations);
}

function renderPanel(recap) {
  return `<div class="panel mi-panel" ${PLUGIN_ATTR}>`
    + '<h3 class="mi-title">Match Impact'
    + '<span class="mi-toggle clickable" title="Replier" onclick="this.closest(\'.mi-panel\').classList.toggle(\'mi-collapsed\')">▾</span></h3>'
    + `<div class="panelContents mi-body">${renderRecapBody(recap)}</div></div>`;
}

function renderFloating(recap) {
  return `<div class="panel mi-panel mi-floating" id="mi-floating" ${PLUGIN_ATTR}>`
    + '<h3 class="mi-title">Match Impact'
    + '<span class="mi-close clickable" title="Fermer" onclick="this.closest(\'.mi-floating\').remove()">✕</span></h3>'
    + `<div class="panelContents mi-body">${renderRecapBody(recap)}</div></div>`;
}

function renderHistoryList(items) {
  if (!items.length) return '<div class="noResults">Aucun show enregistré pour l\'instant.</div>';
  return '<ul class="mi-history-list">'
    + items.map((i) => `<li class="clickable" data-mi-index="${Number(i.index)}">`
      + `<span class="mi-history-date">${escapeHtml(i.date)}</span> `
      + `<span class="mi-history-name">${escapeHtml(i.showName)}</span></li>`).join('')
    + '</ul>';
}

function renderHistoryPageShell() {
  return '<div class="leftRightSplit mi-history">'
    + '<div class="leftListContainer"><div class="leftList" id="mi-history-list"></div></div>'
    + '<div class="rightDetail" id="mi-history-detail"><div class="noResults">Choisis un show dans la liste.</div></div>'
    + '</div>';
}

const RECAP_CSS = [
  '.mi-panel .mi-title { display: flex; justify-content: space-between; align-items: center; }',
  '.mi-panel .mi-toggle, .mi-panel .mi-close { cursor: pointer; padding: 0 6px; }',
  '.mi-panel .mi-body { max-height: 45vh; overflow-y: auto; }',
  '.mi-panel.mi-collapsed .mi-body { display: none; }',
  '.mi-show { color: var(--color-2); margin-bottom: 8px; }',
  '.mi-worker { padding: 6px 0; border-bottom: var(--panel-border); }',
  '.mi-worker-head { display: flex; justify-content: space-between; gap: 8px; }',
  '.mi-worker-name { font-weight: bold; color: var(--color-0); }',
  '.mi-worker-segs { color: var(--color-2); font-size: 0.85em; text-align: right; }',
  '.mi-changes { width: 100%; border-collapse: collapse; }',
  '.mi-changes td { padding: 2px 4px; }',
  '.mi-values { text-align: right; color: var(--color-2); white-space: nowrap; }',
  '.mi-delta { text-align: right; white-space: nowrap; font-weight: bold; }',
  '.mi-good .mi-delta { color: var(--positive-effect); }',
  '.mi-bad .mi-delta { color: var(--negative-effect); }',
  '.mi-injury { color: var(--alert); font-weight: bold; }',
  '.mi-nochange { color: var(--color-2); font-style: italic; }',
  '.mi-relations h4 { margin: 8px 0 4px; color: var(--color-1); }',
  '.mi-floating { position: fixed; right: 16px; bottom: 16px; width: 420px; max-width: calc(100vw - 32px);'
    + ' z-index: 9000; background: var(--background-1); box-shadow: var(--panel-shadow); }',
  '.mi-history-list li { display: flex; gap: 8px; }',
  '.mi-history-date { color: var(--color-2); }',
].join('\n');

module.exports = {
  escapeHtml, renderRecapBody, renderPanel, renderFloating, renderHistoryList, renderHistoryPageShell, RECAP_CSS,
};

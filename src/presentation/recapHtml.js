'use strict';

const { resolveLocale, t, statLabel } = require('./i18n');

// Rendu du récap selon la maquette match-impact-cards.html (MATCH_IMPACT_DESIGN.md) :
// une card par catcheur, des lignes de stats à colonnes fixes, une pastille d'écart colorée.

const PLUGIN_ATTR = 'data-plugin-id="match-impact"';
const MINUS = '−';
const DELTA_ICON = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.5 L9 8 L1 8 Z" fill="currentColor"/></svg>';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const text = parts.length === 1
    ? parts[0].slice(0, 2)
    : parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
  return text.toUpperCase();
}

// 0 décimale si avant et après sont entiers, sinon 1 décimale pour les trois valeurs.
// L'écart est rendu sans signe : le signe est ajouté à l'affichage.
function formatStatValues(before, after, delta) {
  const digits = Number.isInteger(before) && Number.isInteger(after) ? 0 : 1;
  return {
    before: before.toFixed(digits),
    after: after.toFixed(digits),
    delta: Math.abs(delta).toFixed(digits),
  };
}

function renderDelta(delta, good, text) {
  if (delta === 0) return `<span class="mi-delta is-flat"><span>${text}</span></span>`;
  const classes = ['mi-delta', good ? 'is-good' : 'is-bad'];
  if (delta < 0) classes.push('is-down');
  const sign = delta > 0 ? '+' : MINUS;
  return `<span class="${classes.join(' ')}">${DELTA_ICON}<span>${sign}${text}</span></span>`;
}

function renderStat(label, before, after, delta, good) {
  const v = formatStatValues(before, after, delta);
  return '<div class="mi-stat">'
    + `<span class="mi-label">${escapeHtml(label)}</span>`
    + renderDelta(delta, good, v.delta)
    + `<span class="mi-before">${v.before}</span>`
    + '<span class="mi-arrow" aria-hidden="true">→</span>'
    + `<span class="mi-after">${v.after}</span>`
    + '</div>';
}

function renderInjury(injury, locale) {
  const text = injury.healDate
    ? t(locale, 'injuryReturn', { type: injury.type, date: injury.healDate })
    : String(injury.type);
  return `<div class="mi-stat mi-injury"><span class="mi-label">${escapeHtml(t(locale, 'injury'))}</span>`
    + `<span class="mi-injury-text">${escapeHtml(text)}</span></div>`;
}

function renderCard(worker, segments, locale) {
  const match = worker.segments
    .map((i) => (segments[i] ? segments[i].name : ''))
    .filter(Boolean)
    .join(' · ');
  const stats = worker.changes
    .map((c) => renderStat(statLabel(locale, c.key), c.before, c.after, c.delta, c.inverted ? c.delta < 0 : c.delta > 0))
    .join('');
  return '<article class="mi-card">'
    + '<div class="mi-id">'
    + `<div class="mi-avatar" role="img" aria-label="${escapeHtml(t(locale, 'photoOf', { name: worker.name }))}"`
    + ` data-mi-picture="${escapeHtml(worker.picture)}" data-mi-contract-picture="${escapeHtml(worker.contractPicture)}">`
    + `${escapeHtml(initials(worker.name))}</div>`
    + '<div class="mi-id-text">'
    + `<h3 class="mi-name">${escapeHtml(worker.name)}</h3>`
    + `<p class="mi-match" title="${escapeHtml(match)}">${escapeHtml(match)}</p>`
    + '</div></div>'
    + `<div class="mi-stats">${stats}${worker.injury ? renderInjury(worker.injury, locale) : ''}</div>`
    + '</article>';
}

function renderRelations(relations, locale) {
  if (!relations.length) return '';
  return '<article class="mi-card mi-relations">'
    + `<div class="mi-id"><div class="mi-id-text"><h3 class="mi-name">${escapeHtml(t(locale, 'relations'))}</h3></div></div>`
    + '<div class="mi-stats">'
    + relations.map((r) => renderStat(`${r.name1} ↔ ${r.name2}`, r.before, r.after, r.delta, r.delta > 0)).join('')
    + '</div></article>';
}

function shownWorkers(recap) {
  return recap.workers.filter((w) => w.changes.length || w.injury);
}

function renderRecapBody(recap, locale) {
  const lang = resolveLocale(locale);
  const show = `<p class="mi-show">${escapeHtml(recap.showName)}${recap.date ? ` · ${escapeHtml(recap.date)}` : ''}</p>`;
  const workers = shownWorkers(recap);
  const relations = recap.relations || [];
  const content = workers.length || relations.length
    ? workers.map((w) => renderCard(w, recap.segments, lang)).join('') + renderRelations(relations, lang)
    : `<div class="noResults">${escapeHtml(t(lang, 'noChange'))}</div>`;
  return `<div class="mi-recap" lang="${lang}">${show}${content}</div>`;
}

function renderCount(recap, locale) {
  const n = shownWorkers(recap).length;
  return `<span class="mi-count">${escapeHtml(t(locale, n > 1 ? 'wrestlers.many' : 'wrestlers.one', { n }))}</span>`;
}

function renderHeader(recap, button, locale) {
  return '<header class="mi-header"><h2>Match Impact</h2>'
    + `<div class="mi-header-tools">${renderCount(recap, locale)}${button}</div></header>`;
}

function renderPanel(recap, locale) {
  const lang = resolveLocale(locale);
  const label = escapeHtml(t(lang, 'collapse'));
  const toggle = `<button type="button" class="mi-toggle clickable" title="${label}" aria-label="${label}"`
    + ' onclick="this.closest(\'.mi-panel\').classList.toggle(\'mi-collapsed\')">▾</button>';
  return `<section class="mi-panel" ${PLUGIN_ATTR} aria-label="Match Impact" lang="${lang}">`
    + renderHeader(recap, toggle, lang)
    + renderRecapBody(recap, lang)
    + '</section>';
}

function renderFloating(recap, locale) {
  const lang = resolveLocale(locale);
  const label = escapeHtml(t(lang, 'close'));
  const close = `<button type="button" class="mi-close clickable" title="${label}" aria-label="${label}"`
    + ' onclick="this.closest(\'.mi-floating\').remove()">✕</button>';
  return `<section class="mi-panel mi-floating" id="mi-floating" ${PLUGIN_ATTR} aria-label="Match Impact" lang="${lang}">`
    + renderHeader(recap, close, lang)
    + renderRecapBody(recap, lang)
    + '</section>';
}

// Script exécuté dans la fenêtre du jeu : remplace les initiales par la photo du lutteur
// quand le jeu en a une (Game.getContractImage, comme ses propres écrans).
function resolveAvatarsJs(rootExpr) {
  return `(function (root) {
  try {
    if (!root || typeof Game === 'undefined' || !Game || typeof Game.getContractImage !== 'function') return;
    var fallback = typeof Game._getFallbackImage === 'function' ? Game._getFallbackImage('people') : null;
    var avatars = root.querySelectorAll('.mi-avatar[data-mi-picture]');
    Array.prototype.forEach.call(avatars, function (avatar) {
      var picture = avatar.getAttribute('data-mi-picture') || '';
      var contractPicture = avatar.getAttribute('data-mi-contract-picture') || '';
      if (!picture && !contractPicture) return;
      var src = Game.getContractImage(contractPicture, picture);
      if (!src || src === fallback) return;
      var img = document.createElement('img');
      img.alt = '';
      img.onload = function () { avatar.textContent = ''; avatar.appendChild(img); };
      img.src = src;
    });
  } catch (e) {}
})(${rootExpr});`;
}

function renderHistoryList(items, locale) {
  if (!items.length) return `<div class="noResults">${escapeHtml(t(locale, 'historyEmpty'))}</div>`;
  return '<ul class="mi-history-list">'
    + items.map((i) => `<li class="clickable" data-mi-index="${Number(i.index)}">`
      + `<span class="mi-history-date">${escapeHtml(i.date)}</span> `
      + `<span class="mi-history-name">${escapeHtml(i.showName)}</span></li>`).join('')
    + '</ul>';
}

// Coquille sans texte : le script de page la remplit dans la langue du jeu (handler page-texts).
function renderHistoryPageShell() {
  return '<div class="leftRightSplit mi-history">'
    + '<div class="leftListContainer">'
    + '<button type="button" class="mi-settings-button clickable" id="mi-settings-button">⚙ <span class="mi-settings-label"></span></button>'
    + '<div class="leftList" id="mi-history-list"></div></div>'
    + '<div class="rightDetail" id="mi-history-detail"><div class="noResults mi-history-pick"></div></div>'
    + '</div>';
}

// Les couleurs du design sont des tokens limités au plugin (pas de :root) pour ne pas
// toucher au thème du jeu.
const RECAP_CSS = [
  '.mi-panel, .mi-recap {',
  '  --mi-bg: #0f262c; --mi-card: #143239; --mi-border: #1f3d44;',
  '  --mi-avatar-bg: #1e4a54; --mi-avatar-ring: #2b5f6b;',
  '  --mi-text: #ffffff; --mi-text-2: #cfe2e6; --mi-muted: #8fa9ae; --mi-faint: #5f7c82;',
  '  --mi-good: #4ade80; --mi-good-bg: rgba(74, 222, 128, 0.12);',
  '  --mi-bad: #ff6b7f; --mi-bad-bg: rgba(255, 107, 127, 0.12);',
  '  --mi-radius: 12px;',
  '  font-family: Inter, system-ui, sans-serif; color: var(--mi-text-2); font-variant-numeric: tabular-nums;',
  '}',
  '.mi-panel { box-sizing: border-box; width: 100%; max-width: 760px; margin-top: 12px; padding: 20px;'
    + ' background: var(--mi-bg); border-radius: var(--mi-radius); display: flex; flex-direction: column; gap: 12px; }',
  '.mi-header { display: flex; align-items: center; justify-content: space-between; padding: 0 4px 8px;'
    + ' border-bottom: 1px solid var(--mi-border); }',
  '.mi-header h2 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;'
    + ' color: var(--mi-text-2); }',
  '.mi-header-tools { display: flex; align-items: center; gap: 8px; }',
  '.mi-count { font-size: 12px; color: var(--mi-muted); }',
  '.mi-toggle, .mi-close { background: none; border: 0; padding: 0 4px; color: var(--mi-muted); font-size: 14px;'
    + ' cursor: pointer; }',
  '.mi-toggle:hover, .mi-close:hover { color: var(--mi-text); }',
  '.mi-panel.mi-collapsed .mi-recap { display: none; }',
  '.mi-panel.mi-collapsed .mi-toggle { transform: rotate(-90deg); }',
  '.mi-recap { container: mi / inline-size; display: flex; flex-direction: column; gap: 12px; }',
  '.mi-show { margin: 0; padding: 0 4px; font-size: 12px; color: var(--mi-muted); }',
  '.mi-card { display: grid; grid-template-columns: 250px minmax(0, 1fr); align-items: center; gap: 24px;'
    + ' padding: 16px 20px; background: var(--mi-card); border: 1px solid var(--mi-border);'
    + ' border-radius: var(--mi-radius); }',
  '.mi-id { display: flex; align-items: center; gap: 12px; min-width: 0; }',
  '.mi-avatar { flex: 0 0 auto; width: 52px; height: 52px; border-radius: 50%; background: var(--mi-avatar-bg);'
    + ' border: 2px solid var(--mi-avatar-ring); box-sizing: border-box; overflow: hidden; display: flex;'
    + ' align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: var(--mi-text-2); }',
  '.mi-avatar img { width: 100%; height: 100%; object-fit: cover; }',
  '.mi-id-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }',
  '.mi-name { margin: 0; font-size: 15px; font-weight: 600; color: var(--mi-text); white-space: nowrap;'
    + ' overflow: hidden; text-overflow: ellipsis; }',
  '.mi-match { margin: 0; font-size: 12px; line-height: 1.4; color: var(--mi-muted); display: -webkit-box;'
    + ' -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }',
  '.mi-stats { display: flex; flex-direction: column; }',
  '.mi-stat { display: grid; grid-template-columns: minmax(0, 1fr) 80px 52px 22px 52px; align-items: center;'
    + ' column-gap: 8px; height: 36px; border-top: 1px solid var(--mi-border); font-size: 14px; }',
  '.mi-stat:first-child { border-top: none; }',
  '.mi-label { color: var(--mi-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
  '.mi-before { text-align: right; color: var(--mi-muted); }',
  '.mi-arrow { text-align: center; color: var(--mi-faint); }',
  '.mi-after { text-align: left; color: var(--mi-text); font-weight: 600; }',
  '.mi-delta { justify-self: start; display: inline-flex; align-items: center; justify-content: center; gap: 4px;'
    + ' min-width: 64px; height: 24px; padding: 0 8px; box-sizing: border-box; border-radius: 12px;'
    + ' font-size: 13px; font-weight: 700; }',
  '.mi-delta svg { width: 10px; height: 10px; }',
  '.mi-delta.is-good { color: var(--mi-good); background: var(--mi-good-bg); }',
  '.mi-delta.is-bad { color: var(--mi-bad); background: var(--mi-bad-bg); }',
  '.mi-delta.is-down svg { transform: rotate(180deg); }',
  '.mi-delta.is-flat { color: var(--mi-muted); background: transparent; }',
  '.mi-injury-text { grid-column: 2 / -1; color: var(--mi-bad); font-weight: 600; overflow: hidden;'
    + ' text-overflow: ellipsis; white-space: nowrap; }',
  '.mi-floating { position: fixed; right: 16px; bottom: 16px; width: min(760px, calc(100vw - 32px)); margin: 0;'
    + ' max-height: 70vh; overflow-y: auto; z-index: 9000; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }',
  '.rightDetail > .mi-recap { box-sizing: border-box; max-width: 760px; padding: 20px; background: var(--mi-bg);'
    + ' border-radius: var(--mi-radius); }',
  '.mi-history-list li { display: flex; gap: 8px; }',
  '.mi-history-date { color: var(--color-2); }',
  // Écran ou colonne étroite : identité au-dessus des stats.
  '@container mi (max-width: 560px) { .mi-card { grid-template-columns: minmax(0, 1fr); gap: 12px; } }',
  '@media (max-width: 560px) { .mi-card { grid-template-columns: minmax(0, 1fr); gap: 12px; } }',
].join('\n');

module.exports = {
  escapeHtml,
  initials,
  formatStatValues,
  renderRecapBody,
  renderPanel,
  renderFloating,
  renderHistoryList,
  renderHistoryPageShell,
  resolveAvatarsJs,
  RECAP_CSS,
};

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const html = require('../../src/presentation/recapHtml');

function recap(overrides = {}) {
  return {
    showID: 7,
    showName: 'Weekly',
    date: '2026-02-13',
    promotionID: 1,
    segments: [{ name: 'A vs B', type: 'Match', rating: 61 }, { name: 'Promo', type: 'Angle', rating: 70 }],
    workers: [
      {
        workerID: 1, name: 'Alpha', segments: [0, 1], injury: null,
        changes: [
          { key: 'entertainment', label: 'Divertissement', before: 62, after: 63.5, delta: 1.5, inverted: false },
          { key: 'fatigue', label: 'Fatigue', before: 10, after: 18, delta: 8, inverted: true },
          { key: 'momentum', label: 'Momentum', before: 50, after: 45, delta: -5, inverted: false },
        ],
      },
      { workerID: 2, name: 'Beta', segments: [0], injury: null, changes: [] },
    ],
    relations: [{ worker1: 1, name1: 'Alpha', worker2: 2, name2: 'Beta', before: 40, after: 45, delta: 5 }],
    ...overrides,
  };
}

test('escapeHtml échappe les caractères spéciaux', () => {
  assert.equal(html.escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(html.escapeHtml(null), '');
});

test('le corps affiche le show, les lutteurs et leurs segments', () => {
  const out = html.renderRecapBody(recap());
  assert.match(out, /Weekly/);
  assert.match(out, /2026-02-13/);
  assert.match(out, /Alpha/);
  assert.match(out, /A vs B · Promo/);
});

test('une ligne de stat montre avant, après et écart', () => {
  const out = html.renderRecapBody(recap());
  assert.match(out, /Divertissement/);
  assert.match(out, /62 → 63\.5/);
  assert.match(out, /▲ \+1\.5/);
  assert.match(out, /▼ −5/);
});

test('une hausse est positive, sauf pour la fatigue', () => {
  const out = html.renderRecapBody(recap());
  assert.match(out, /<tr class="mi-change mi-good"><td class="mi-label">Divertissement/);
  assert.match(out, /<tr class="mi-change mi-bad"><td class="mi-label">Fatigue/);
  assert.match(out, /<tr class="mi-change mi-bad"><td class="mi-label">Momentum/);
});

test('un lutteur sans changement affiche la mention', () => {
  assert.match(html.renderRecapBody(recap()), /Aucun changement/);
});

test('une blessure s\'affiche avec sa date de retour', () => {
  const r = recap();
  r.workers[1].injury = { type: 'Broken Arm', healDate: '2026-03-01' };
  const out = html.renderRecapBody(r);
  assert.match(out, /class="mi-injury"/);
  assert.match(out, /Broken Arm/);
  assert.match(out, /2026-03-01/);
});

test('les relations ont leur section', () => {
  const out = html.renderRecapBody(recap());
  assert.match(out, /Relations/);
  assert.match(out, /Alpha ↔ Beta/);
  assert.match(out, /40 → 45/);
});

test('pas de section relations sans relation', () => {
  assert.doesNotMatch(html.renderRecapBody(recap({ relations: [] })), /Relations/);
});

test('un récap vide affiche un message', () => {
  assert.match(html.renderRecapBody(recap({ workers: [], relations: [] })), /class="noResults"/);
});

test('le texte venu de la base est échappé', () => {
  const r = recap({ showName: '<b>x</b>' });
  r.workers[0].name = '<script>';
  const out = html.renderRecapBody(r);
  assert.doesNotMatch(out, /<script>/);
  assert.doesNotMatch(out, /<b>x<\/b>/);
});

test('le panneau est marqué, repliable et utilise les classes natives', () => {
  const out = html.renderPanel(recap());
  assert.match(out, /class="panel mi-panel"/);
  assert.match(out, /data-plugin-id="match-impact"/);
  assert.match(out, /class="panelContents mi-body"/);
  assert.match(out, /mi-collapsed/);
});

test('le panneau flottant a un identifiant et un bouton fermer', () => {
  const out = html.renderFloating(recap());
  assert.match(out, /id="mi-floating"/);
  assert.match(out, /data-plugin-id="match-impact"/);
  assert.match(out, /mi-close/);
});

test('la liste d\'historique porte les index et échappe les noms', () => {
  const out = html.renderHistoryList([{ index: 0, showName: '<i>W</i>', date: '2026-02-13', showID: 7 }]);
  assert.match(out, /data-mi-index="0"/);
  assert.match(out, /&lt;i&gt;W&lt;\/i&gt;/);
});

test('une liste d\'historique vide affiche un message', () => {
  assert.match(html.renderHistoryList([]), /class="noResults"/);
});

test('la page historique a ses deux zones', () => {
  const out = html.renderHistoryPageShell();
  assert.match(out, /id="mi-history-list"/);
  assert.match(out, /id="mi-history-detail"/);
  assert.match(out, /leftRightSplit/);
});

test('aucune couleur codée en dur', () => {
  assert.doesNotMatch(html.RECAP_CSS, /#[0-9a-f]{3,8}\b/i);
  assert.doesNotMatch(html.RECAP_CSS, /rgba?\(|hsla?\(/i);
  assert.doesNotMatch(html.renderPanel(recap()) + html.renderFloating(recap()), /style=/);
  assert.match(html.RECAP_CSS, /var\(--positive-effect\)/);
  assert.match(html.RECAP_CSS, /var\(--negative-effect\)/);
});

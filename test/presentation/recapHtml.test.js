'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const html = require('../../src/presentation/recapHtml');

// Les tests historiques vérifient le rendu français.
const fr = {
  renderRecapBody: (r) => html.renderRecapBody(r, 'fr'),
  renderPanel: (r) => html.renderPanel(r, 'fr'),
  renderFloating: (r) => html.renderFloating(r, 'fr'),
  renderHistoryList: (items) => html.renderHistoryList(items, 'fr'),
};

function recap(overrides = {}) {
  return {
    showID: 7,
    showName: 'Weekly',
    date: '2026-02-13',
    promotionID: 1,
    segments: [{ name: 'A vs B', type: 'Match', rating: 61 }, { name: 'Promo', type: 'Angle', rating: 70 }],
    workers: [
      {
        workerID: 1, name: 'Gustave Le Brun', segments: [0, 1], injury: null,
        picture: 'Gustave.png', contractPicture: null,
        changes: [
          { key: 'entertainment', label: 'Divertissement', before: 62, after: 63.5, delta: 1.5, inverted: false },
          { key: 'fatigue', label: 'Fatigue', before: 10, after: 18, delta: 8, inverted: true },
          { key: 'momentum', label: 'Momentum', before: 50, after: 45, delta: -5, inverted: false },
        ],
      },
      { workerID: 2, name: 'Beta', segments: [0], injury: null, picture: null, contractPicture: null, changes: [] },
    ],
    relations: [{ worker1: 1, name1: 'Gustave Le Brun', worker2: 2, name2: 'Beta', before: 40, after: 45, delta: 5 }],
    ...overrides,
  };
}

function statRows(out) {
  return out.match(/<div class="mi-stat">[\s\S]*?<\/div>/g) || [];
}

test('escapeHtml échappe les caractères spéciaux', () => {
  assert.equal(html.escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(html.escapeHtml(null), '');
});

test('initials : première et dernière initiale, ou deux lettres pour un nom seul', () => {
  assert.equal(html.initials('Gustave Le Brun'), 'GB');
  assert.equal(html.initials('Amale'), 'AM');
  assert.equal(html.initials('  '), '?');
});

test('formatStatValues : 0 décimale si avant et après sont entiers, sinon 1 pour les deux', () => {
  assert.deepEqual(html.formatStatValues(95, 100, 5), { before: '95', after: '100', delta: '5' });
  assert.deepEqual(html.formatStatValues(6.8, 9, 2.2), { before: '6.8', after: '9.0', delta: '2.2' });
});

test('une card par lutteur avec identité, segments et infobulle', () => {
  const out = fr.renderRecapBody(recap());
  assert.match(out, /<article class="mi-card">/);
  assert.match(out, /<h3 class="mi-name">Gustave Le Brun<\/h3>/);
  assert.match(out, /<p class="mi-match" title="A vs B · Promo">A vs B · Promo<\/p>/);
  assert.match(out, /Weekly · 2026-02-13/);
});

test('l\'avatar porte les initiales et les photos à résoudre dans le jeu', () => {
  const out = fr.renderRecapBody(recap());
  assert.match(out, /<div class="mi-avatar" role="img" aria-label="Photo de Gustave Le Brun" data-mi-picture="Gustave.png" data-mi-contract-picture="">GB<\/div>/);
});

test('une ligne de stat a cinq cellules : nom, pastille, avant, flèche, après', () => {
  const [divertissement, , momentum] = statRows(fr.renderRecapBody(recap()));
  assert.match(divertissement, /<span class="mi-label">Divertissement<\/span>/);
  assert.match(divertissement, /<span class="mi-delta is-good"><svg[^>]*>[\s\S]*<\/svg><span>\+1\.5<\/span><\/span>/);
  assert.match(divertissement, /<span class="mi-before">62\.0<\/span><span class="mi-arrow" aria-hidden="true">→<\/span><span class="mi-after">63\.5<\/span>/);
  assert.match(momentum, /<span class="mi-delta is-bad is-down"><svg[^>]*>[\s\S]*<\/svg><span>−5<\/span><\/span>/);
  assert.match(momentum, /<span class="mi-before">50<\/span>[\s\S]*<span class="mi-after">45<\/span>/);
});

test('la couleur suit le sens de la stat : une hausse de fatigue est mauvaise', () => {
  const [, fatigue] = statRows(fr.renderRecapBody(recap()));
  assert.match(fatigue, /<span class="mi-delta is-bad">/);
  assert.doesNotMatch(fatigue, /is-down/);
});

test('un écart nul est gris et sans flèche', () => {
  const r = recap();
  r.workers[0].changes = [{ key: 'stamina', label: 'Endurance', before: 70, after: 70, delta: 0, inverted: false }];
  const [row] = statRows(fr.renderRecapBody(r));
  assert.match(row, /<span class="mi-delta is-flat"><span>0<\/span><\/span>/);
});

test('seuls les lutteurs avec un changement ont une card', () => {
  const out = fr.renderPanel(recap());
  assert.doesNotMatch(out, /mi-name">Beta</);
  assert.match(out, /<span class="mi-count">1 catcheur<\/span>/);
});

test('le compteur passe au pluriel', () => {
  const r = recap();
  r.workers[1].changes = [{ key: 'morale', label: 'Moral', before: 1, after: 3, delta: 2, inverted: false }];
  assert.match(fr.renderPanel(r), /<span class="mi-count">2 catcheurs<\/span>/);
});

test('une blessure donne une card et une ligne d\'alerte', () => {
  const r = recap();
  r.workers[1].injury = { type: 'Broken Arm', healDate: '2026-03-01' };
  const out = fr.renderRecapBody(r);
  assert.match(out, /mi-name">Beta</);
  assert.match(out, /<div class="mi-stat mi-injury"><span class="mi-label">Blessure<\/span><span class="mi-injury-text">Broken Arm \(retour 2026-03-01\)<\/span><\/div>/);
});

test('les relations ont leur card, une hausse est bonne', () => {
  const out = fr.renderRecapBody(recap());
  assert.match(out, /<article class="mi-card mi-relations">/);
  assert.match(out, /<span class="mi-label">Gustave Le Brun ↔ Beta<\/span><span class="mi-delta is-good">/);
});

test('pas de card relations sans relation', () => {
  assert.doesNotMatch(fr.renderRecapBody(recap({ relations: [] })), /mi-relations/);
});

test('un récap sans changement affiche un message', () => {
  const r = recap({ relations: [] });
  r.workers[0].changes = [];
  assert.match(fr.renderRecapBody(r), /class="noResults"/);
});

test('le texte venu de la base est échappé, attributs compris', () => {
  const r = recap({ showName: '<b>x</b>' });
  r.workers[0].name = '<script>';
  r.workers[0].picture = '"><img src=x>';
  r.segments[0].name = '"onmouseover="x';
  const out = fr.renderRecapBody(r);
  assert.doesNotMatch(out, /<script>/);
  assert.doesNotMatch(out, /<b>x<\/b>/);
  assert.doesNotMatch(out, /"><img src=x>/);
  assert.doesNotMatch(out, /title=""onmouseover/);
});

test('le panneau est marqué, titré et repliable', () => {
  const out = fr.renderPanel(recap());
  assert.match(out, /^<section class="mi-panel" data-plugin-id="match-impact" aria-label="Match Impact" lang="fr">/);
  assert.match(out, /<header class="mi-header"><h2>Match Impact<\/h2>/);
  assert.match(out, /class="mi-toggle clickable"[^>]*mi-collapsed/);
});

test('le panneau flottant a un identifiant et un bouton fermer', () => {
  const out = fr.renderFloating(recap());
  assert.match(out, /^<section class="mi-panel mi-floating" id="mi-floating" data-plugin-id="match-impact" aria-label="Match Impact" lang="fr">/);
  assert.match(out, /class="mi-close clickable"[^>]*remove\(\)/);
});

test('le CSS fixe les colonnes communes à toutes les cards', () => {
  const css = html.RECAP_CSS;
  assert.match(css, /\.mi-card \{[^}]*grid-template-columns: 250px minmax\(0, 1fr\);/);
  assert.match(css, /\.mi-stat \{[^}]*grid-template-columns: minmax\(0, 1fr\) 80px 52px 22px 52px;/);
  assert.match(css, /\.mi-stat \{[^}]*height: 36px;/);
  assert.match(css, /\.mi-before \{ text-align: right;/);
  assert.match(css, /\.mi-arrow \{ text-align: center;/);
  assert.match(css, /\.mi-after \{ text-align: left;/);
  assert.match(css, /font-variant-numeric: tabular-nums;/);
});

test('le CSS reprend les tokens du design, limités au plugin', () => {
  const css = html.RECAP_CSS;
  for (const token of ['#0f262c', '#143239', '#1f3d44', '#cfe2e6', '#8fa9ae', '#5f7c82', '#4ade80', '#ff6b7f',
    'rgba(74, 222, 128, 0.12)', 'rgba(255, 107, 127, 0.12)']) {
    assert.ok(css.includes(token), `token manquant : ${token}`);
  }
  assert.doesNotMatch(css, /:root/);
  assert.match(css, /Inter, system-ui, sans-serif/);
});

test('le CSS passe la card sur une colonne sous 560 px', () => {
  assert.match(html.RECAP_CSS, /@container mi \(max-width: 560px\) \{ \.mi-card \{ grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(html.RECAP_CSS, /@media \(max-width: 560px\) \{ \.mi-card \{ grid-template-columns: minmax\(0, 1fr\);/);
});

test('le HTML ne contient aucun style en ligne', () => {
  assert.doesNotMatch(fr.renderPanel(recap()) + fr.renderFloating(recap()), /style=/);
});

test('le script des avatars est du JavaScript valide qui passe par Game.getContractImage', () => {
  const js = html.resolveAvatarsJs('root');
  assert.doesNotThrow(() => new Function('root', js));
  assert.match(js, /Game\.getContractImage/);
  assert.match(js, /data-mi-picture/);
});

test('le script des avatars remplace les initiales par la photo une fois chargée', () => {
  const avatar = {
    attrs: { 'data-mi-picture': 'A.png', 'data-mi-contract-picture': '' },
    textContent: 'AM',
    children: [],
    getAttribute(name) { return this.attrs[name]; },
    appendChild(child) { this.children.push(child); },
  };
  const root = { querySelectorAll: () => [avatar] };
  const images = [];
  const document = { createElement: () => { const img = {}; images.push(img); return img; } };
  const Game = { getContractImage: (c, p) => `images/people/${p}`, _getFallbackImage: () => 'images/people/noimage.png' };
  new Function('root', 'document', 'Game', html.resolveAvatarsJs('root'))(root, document, Game);
  assert.equal(images.length, 1);
  assert.equal(images[0].src, 'images/people/A.png');
  images[0].onload();
  assert.equal(avatar.textContent, '');
  assert.deepEqual(avatar.children, [images[0]]);
});

test('le script des avatars garde les initiales sans photo', () => {
  const avatar = { getAttribute: (n) => (n === 'data-mi-picture' ? 'A.png' : ''), textContent: 'AM' };
  const images = [];
  const document = { createElement: () => { const img = {}; images.push(img); return img; } };
  const Game = { getContractImage: () => 'images/people/noimage.png', _getFallbackImage: () => 'images/people/noimage.png' };
  new Function('root', 'document', 'Game', html.resolveAvatarsJs('root'))({ querySelectorAll: () => [avatar] }, document, Game);
  assert.equal(images.length, 0);
  assert.equal(avatar.textContent, 'AM');
});

test('la liste d\'historique porte les index et échappe les noms', () => {
  const out = fr.renderHistoryList([{ index: 0, showName: '<i>W</i>', date: '2026-02-13', showID: 7 }]);
  assert.match(out, /data-mi-index="0"/);
  assert.match(out, /&lt;i&gt;W&lt;\/i&gt;/);
});

test('une liste d\'historique vide affiche un message', () => {
  assert.match(fr.renderHistoryList([]), /class="noResults"/);
});

test('la page historique a ses deux zones et le bouton Réglages, sans texte', () => {
  const out = html.renderHistoryPageShell();
  assert.match(out, /id="mi-history-list"/);
  assert.match(out, /id="mi-history-detail"/);
  assert.match(out, /leftRightSplit/);
  assert.match(out, /<button type="button" class="mi-settings-button clickable" id="mi-settings-button">⚙ <span class="mi-settings-label"><\/span><\/button>/);
  assert.match(out, /<div class="noResults mi-history-pick"><\/div>/);
});

test('rendu anglais : compteur, libellés, photo, relations, langue', () => {
  const out = html.renderPanel(recap(), 'en');
  assert.match(out, /lang="en"/);
  assert.match(out, /<span class="mi-count">1 wrestler<\/span>/);
  assert.match(out, /title="Collapse"/);
  assert.match(out, /aria-label="Photo of Gustave Le Brun"/);
  assert.match(out, /<span class="mi-label">Entertainment<\/span>/);
  assert.match(out, /<h3 class="mi-name">Relationships<\/h3>/);
});

test('rendu anglais : blessure et message vide', () => {
  const r = recap();
  r.workers[1].injury = { type: 'Broken Arm', healDate: '2026-03-01' };
  assert.match(html.renderRecapBody(r, 'en'), /<span class="mi-label">Injury<\/span><span class="mi-injury-text">Broken Arm \(back 2026-03-01\)<\/span>/);
  const empty = recap({ relations: [] });
  empty.workers[0].changes = [];
  assert.match(html.renderRecapBody(empty, 'en'), /No notable change during this show\./);
});

test('une blessure sans date de retour affiche seulement le type', () => {
  const r = recap();
  r.workers[1].injury = { type: 'Sprain', healDate: null };
  assert.match(html.renderRecapBody(r, 'fr'), /<span class="mi-injury-text">Sprain<\/span>/);
});

test('sans langue, le rendu est en anglais', () => {
  assert.match(html.renderPanel(recap()), /1 wrestler/);
  assert.match(html.renderRecapBody(recap()), /<div class="mi-recap" lang="en">/);
});

test('le libellé archivé est ignoré : la stat est traduite depuis sa clé', () => {
  const r = recap();
  r.workers[0].changes = [{ key: 'stamina', label: 'Endurance', before: 70, after: 72, delta: 2, inverted: false }];
  assert.match(html.renderRecapBody(r, 'en'), /<span class="mi-label">Stamina<\/span>/);
  assert.doesNotMatch(html.renderRecapBody(r, 'en'), /Endurance/);
});

test('la liste d\'historique vide est traduite', () => {
  assert.match(html.renderHistoryList([], 'en'), /No show recorded yet\./);
  assert.match(html.renderHistoryList([], 'fr'), /Aucun show enregistré/);
});

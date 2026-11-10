'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderSettingsForm, RECAP_CSS } = require('../../src/presentation/recapHtml');
const { SETTINGS_SCHEMA } = require('../../src/application/ports');

const DEFAULTS = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));

function field(out, key) {
  const m = out.match(new RegExp(`<input[^>]*data-mi-setting="${key}"[^>]*>`));
  return m ? m[0] : null;
}

test('un champ par réglage, dans deux blocs', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, 'fr');
  for (const s of SETTINGS_SCHEMA) assert.ok(field(out, s.key), `champ manquant : ${s.key}`);
  assert.equal((out.match(/<fieldset class="mi-settings-block">/g) || []).length, 2);
  assert.match(out, /<legend>Stats suivies<\/legend>/);
  assert.match(out, /<legend>Affichage<\/legend>/);
  assert.ok(out.indexOf('data-mi-setting="trackRelationships"') < out.indexOf('<legend>Affichage</legend>'));
});

test('les cases reflètent les valeurs', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, { ...DEFAULTS, trackSkills: false }, 'fr');
  assert.match(field(out, 'trackSkills'), /type="checkbox"/);
  assert.doesNotMatch(field(out, 'trackSkills'), /checked/);
  assert.match(field(out, 'trackPopularity'), / checked/);
});

test('les nombres ont leur valeur, leurs bornes et leur pas', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, { ...DEFAULTS, minDelta: 2.5, historySize: 40 }, 'fr');
  assert.match(field(out, 'minDelta'), /type="number"[^>]* min="0" max="10" step="0\.1" value="2\.5"/);
  assert.match(field(out, 'historySize'), /type="number"[^>]* min="1" max="100" step="1" value="40"/);
});

test('une valeur absente prend le défaut du schéma', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, {}, 'fr');
  assert.match(field(out, 'minDelta'), /value="0\.5"/);
  assert.match(field(out, 'trackRelationships'), / checked/);
});

test('libellés, aides et messages dans la langue demandée', () => {
  const fr = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, 'fr');
  assert.match(fr, /<form class="mi-settings" lang="fr" data-mi-saved="Enregistré" data-mi-error="Échec de l&#39;enregistrement" onsubmit="return false">/);
  assert.match(fr, /<span class="mi-setting-label">Talent<\/span><span class="mi-setting-help">Simples ou détaillées selon le monde<\/span>/);
  assert.match(fr, /Les changements s&#39;appliquent dès le show suivant\./);
  const en = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, undefined);
  assert.match(en, /lang="en"/);
  assert.match(en, /<span class="mi-setting-label">Shows kept<\/span>/);
  assert.match(en, /<h2 class="mi-settings-title">Settings<\/h2>/);
});

test('une aide vide n\'ajoute pas de ligne', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, 'fr');
  assert.match(out, /<span class="mi-setting-label">Fatigue et endurance<\/span><\/span>/);
});

test('zone d\'état annoncée, valeurs échappées, aucun style en ligne', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, { ...DEFAULTS, minDelta: '"><b>x' }, 'fr');
  assert.match(out, /<p class="mi-settings-status" aria-live="polite"><\/p><\/form>$/);
  assert.doesNotMatch(out, /"><b>x/);
  assert.doesNotMatch(out, /style=/);
});

test('le CSS stylise le formulaire avec les tokens du plugin', () => {
  assert.match(RECAP_CSS, /\.mi-panel, \.mi-recap, \.mi-settings, \.mi-settings-button \{/);
  assert.match(RECAP_CSS, /\.mi-settings-block \{[^}]*background: var\(--mi-card\);/);
  assert.match(RECAP_CSS, /\.mi-settings-status\.is-error \{ color: var\(--mi-bad\); \}/);
  assert.match(RECAP_CSS, /\.mi-settings-button\.active \{/);
});

test('chaque réglage du schéma a sa place dans le formulaire', () => {
  const out = renderSettingsForm(SETTINGS_SCHEMA, DEFAULTS, 'en');
  const fields = out.match(/data-mi-setting="[^"]+"/g) || [];
  assert.equal(fields.length, SETTINGS_SCHEMA.length);
});

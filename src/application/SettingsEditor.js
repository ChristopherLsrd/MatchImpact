'use strict';
const { SETTINGS_SCHEMA, assertPort } = require('./ports');

const INTEGER_KEYS = Object.freeze(['historySize']);

/** Lit et modifie les réglages du plugin en contrôlant chaque valeur. */
function createSettingsEditor({ settings, logger }) {
  assertPort('Settings', settings);
  assertPort('Logger', logger);

  const byKey = new Map(SETTINGS_SCHEMA.map((def) => [def.key, def]));

  function getAll() {
    return Object.fromEntries(SETTINGS_SCHEMA.map((def) => [def.key, settings.get(def.key)]));
  }

  function normalize(def, value) {
    if (def.type === 'boolean') return typeof value === 'boolean' ? { ok: true, value } : { ok: false };
    if (def.type !== 'number' || typeof value !== 'number' || !Number.isFinite(value)) return { ok: false };
    let next = INTEGER_KEYS.includes(def.key) ? Math.round(value) : value;
    if (def.min !== undefined) next = Math.max(def.min, next);
    if (def.max !== undefined) next = Math.min(def.max, next);
    return { ok: true, value: next };
  }

  function set(key, value) {
    const def = byKey.get(key);
    if (!def) return { ok: false };
    const result = normalize(def, value);
    if (!result.ok) return result;
    try {
      settings.set(key, result.value);
      return result;
    } catch (e) {
      logger.error('settings.set', e);
      return { ok: false };
    }
  }

  return { getAll, set };
}

module.exports = { createSettingsEditor };

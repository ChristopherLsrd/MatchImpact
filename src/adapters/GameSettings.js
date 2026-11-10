'use strict';
const { SETTINGS_SCHEMA } = require('../application/ports');

function createGameSettings(settingsApi) {
  settingsApi.register(SETTINGS_SCHEMA.map((s) => ({ ...s })));
  const defaults = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));
  return {
    get(key) {
      const value = settingsApi.get(key);
      return value === undefined || value === null ? defaults[key] : value;
    },
    set(key, value) {
      settingsApi.set(key, value);
    },
  };
}

module.exports = { createGameSettings };

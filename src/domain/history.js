'use strict';

/** Renvoie une nouvelle liste : `recap` en tête, au plus `max` éléments. */
function addToHistory(list, recap, max) {
  const base = Array.isArray(list) ? list : [];
  const limit = Math.max(1, Math.floor(Number(max)) || 1);
  return [recap, ...base].slice(0, limit);
}

module.exports = { addToHistory };

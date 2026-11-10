'use strict';

const FILE = 'history.json';

function createStorageHistoryStore(storage) {
  return {
    load() {
      try {
        const data = storage.readJSON(FILE);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    },
    save(list) {
      storage.writeJSON(FILE, list);
    },
  };
}

module.exports = { createStorageHistoryStore };

'use strict';
const { assertPort } = require('./ports');

function createHistoryQueries({ history, logger }) {
  assertPort('HistoryStore', history);
  assertPort('Logger', logger);

  function listHistory() {
    try {
      return history.load().map((recap, index) => ({
        index,
        showName: String((recap && recap.showName) || ''),
        date: (recap && recap.date) || null,
        showID: recap && recap.showID !== undefined ? recap.showID : null,
      }));
    } catch (e) {
      logger.error('listHistory', e);
      return [];
    }
  }

  function getRecap(index) {
    try {
      const i = Number(index);
      if (!Number.isInteger(i) || i < 0) return null;
      return history.load()[i] || null;
    } catch (e) {
      logger.error('getRecap', e);
      return null;
    }
  }

  return { listHistory, getRecap };
}

module.exports = { createHistoryQueries };

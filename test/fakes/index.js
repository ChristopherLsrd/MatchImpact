'use strict';
const { SETTINGS_SCHEMA } = require('../../src/application/ports');

function createFakeRoster({
  roster = { workers: [], relations: [] },
  after = { workers: [], relations: [] },
  cards = {},
  latestShow = null,
} = {}) {
  const calls = [];
  return {
    calls,
    readRoster(promotionID) {
      calls.push(['readRoster', promotionID]);
      return roster;
    },
    readWorkers(ids, promotionID) {
      calls.push(['readWorkers', ids, promotionID]);
      return after.workers.filter((w) => ids.includes(w.workerID));
    },
    readRelations(ids) {
      calls.push(['readRelations', ids]);
      return after.relations.filter((r) => ids.includes(r.worker1) && ids.includes(r.worker2));
    },
    readCard(showID) {
      calls.push(['readCard', showID]);
      return cards[showID] || [];
    },
    findLatestCompletedShow(promotionID, date) {
      calls.push(['findLatestCompletedShow', promotionID, date]);
      return latestShow;
    },
  };
}

function createFakeHistoryStore(initial = []) {
  let list = initial.slice();
  return {
    saves: 0,
    get list() { return list; },
    load() { return list.slice(); },
    save(next) { this.saves += 1; list = next.slice(); },
  };
}

function createFakeView() {
  return {
    summary: [],
    floating: [],
    showInSummary(recap) { this.summary.push(recap); },
    showFloating(recap) { this.floating.push(recap); },
  };
}

function createFakeSettings(overrides = {}) {
  const values = Object.fromEntries(SETTINGS_SCHEMA.map((s) => [s.key, s.default]));
  Object.assign(values, overrides);
  return {
    get(key) { return values[key]; },
    set(key, value) { values[key] = value; },
  };
}

function createFakeGameState(promotionId = 1) {
  return { playerPromotionId() { return promotionId; } };
}

function createFakeLogger() {
  return {
    logs: [],
    errors: [],
    log(...args) { this.logs.push(args); },
    error(...args) { this.errors.push(args); },
  };
}

module.exports = {
  createFakeRoster, createFakeHistoryStore, createFakeView, createFakeSettings, createFakeGameState, createFakeLogger,
};

'use strict';

/**
 * @typedef {{workerID:number,name:string,stats:Object<string,number|null>,injuryType:string|null,injuryHealDate:string|null,picture?:string|null,contractPicture?:string|null}} WorkerRow
 * @typedef {{worker1:number,worker2:number,value:number}} Relation
 * @typedef {{workers:WorkerRow[],relations:Relation[]}} Snapshot
 * @typedef {{segmentID:number|null,name:string,type:string,rating:number|null,workers:{workerID:number,name:string}[]}} Segment
 *
 * Ports :
 * - RosterReader : readRoster(promotionID) → Snapshot ; readWorkers(ids, promotionID) → WorkerRow[] ;
 *   readRelations(ids) → Relation[] ; readCard(showID) → Segment[] ;
 *   findLatestCompletedShow(promotionID, date) → number|null
 * - HistoryStore : load() → Recap[] (vide si absent/corrompu) ; save(list)
 * - RecapView : showInSummary(recap, locale) ; showFloating(recap) ; setLocale(locale)
 * - Settings : get(key) → valeur (clés et défauts : SETTINGS_SCHEMA) ; set(key, value)
 * - GameState : playerPromotionId() → number|null
 * - Logger : log(...args) ; error(...args)
 */

function setting(key, label, type, def, description, bounds = {}) {
  return Object.freeze({ key, label, type, default: def, description, ...bounds });
}

const SETTINGS_SCHEMA = Object.freeze([
  setting('showEndOfShowPanel', 'End-of-show panel', 'boolean', true, 'Show the recap on the results screen'),
  setting('onlyMyPromotion', 'Only my promotion', 'boolean', true, "Ignore other promotions' shows"),
  setting('trackPopularity', 'Popularity', 'boolean', true, 'Popularity in the six regions'),
  setting('trackMomentumMorale', 'Momentum and morale', 'boolean', true, 'Contract momentum and morale'),
  setting('trackCondition', 'Fatigue and stamina', 'boolean', true, 'Fatigue and stamina'),
  setting('trackSkills', 'Skills', 'boolean', true, 'Simple or detailed, depending on the world'),
  setting('trackRelationships', 'Relationships', 'boolean', true, 'Between wrestlers of the same segment'),
  setting('minDelta', 'Minimum change', 'number', 0.5, 'Smaller changes are hidden', { min: 0, max: 10 }),
  setting('historySize', 'Shows kept', 'number', 20, 'Number of shows in the history', { min: 1, max: 100 }),
]);

const PORTS = Object.freeze({
  RosterReader: ['readRoster', 'readWorkers', 'readRelations', 'readCard', 'findLatestCompletedShow'],
  HistoryStore: ['load', 'save'],
  RecapView: ['showInSummary', 'showFloating', 'setLocale'],
  Settings: ['get', 'set'],
  GameState: ['playerPromotionId'],
  Logger: ['log', 'error'],
});

function assertPort(name, candidate) {
  const methods = PORTS[name];
  if (!methods) throw new TypeError(`Port inconnu : ${name}`);
  if (!candidate || typeof candidate !== 'object') throw new TypeError(`${name} : objet attendu`);
  for (const method of methods) {
    if (typeof candidate[method] !== 'function') throw new TypeError(`${name} : méthode ${method}() manquante`);
  }
  return candidate;
}

function assertWorkerRow(w) {
  if (!w || typeof w.workerID !== 'number' || typeof w.name !== 'string' || !w.stats || typeof w.stats !== 'object') {
    throw new TypeError('WorkerRow invalide');
  }
  return w;
}

function assertRelation(r) {
  if (!r || typeof r.worker1 !== 'number' || typeof r.worker2 !== 'number' || typeof r.value !== 'number') {
    throw new TypeError('Relation invalide');
  }
  return r;
}

function assertSnapshot(s) {
  if (!s || !Array.isArray(s.workers) || !Array.isArray(s.relations)) {
    throw new TypeError('Snapshot : { workers: [], relations: [] } attendu');
  }
  s.workers.forEach(assertWorkerRow);
  s.relations.forEach(assertRelation);
  return s;
}

function assertSegments(list) {
  if (!Array.isArray(list)) throw new TypeError('Segments : tableau attendu');
  for (const s of list) {
    if (!s || typeof s.name !== 'string' || typeof s.type !== 'string' || !Array.isArray(s.workers)) {
      throw new TypeError('Segment invalide');
    }
    for (const w of s.workers) {
      if (!w || typeof w.workerID !== 'number' || typeof w.name !== 'string') throw new TypeError('Participant invalide');
    }
  }
  return list;
}

module.exports = {
  SETTINGS_SCHEMA, PORTS, assertPort, assertSnapshot, assertWorkerRow, assertRelation, assertSegments,
};

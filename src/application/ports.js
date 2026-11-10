'use strict';

/**
 * @typedef {{workerID:number,name:string,stats:Object<string,number|null>,injuryType:string|null,injuryHealDate:string|null}} WorkerRow
 * @typedef {{worker1:number,worker2:number,value:number}} Relation
 * @typedef {{workers:WorkerRow[],relations:Relation[]}} Snapshot
 * @typedef {{segmentID:number|null,name:string,type:string,rating:number|null,workers:{workerID:number,name:string}[]}} Segment
 *
 * Ports :
 * - RosterReader : readRoster(promotionID) → Snapshot ; readWorkers(ids, promotionID) → WorkerRow[] ;
 *   readRelations(ids) → Relation[] ; readCard(showID) → Segment[] ;
 *   findLatestCompletedShow(promotionID, date) → number|null
 * - HistoryStore : load() → Recap[] (vide si absent/corrompu) ; save(list)
 * - RecapView : showInSummary(recap) ; showFloating(recap)
 * - Settings : get(key) → valeur (clés et défauts : SETTINGS_SCHEMA)
 * - GameState : playerPromotionId() → number|null
 * - Logger : log(...args) ; error(...args)
 */

function setting(key, label, type, def, description, bounds = {}) {
  return Object.freeze({ key, label, type, default: def, description, ...bounds });
}

const SETTINGS_SCHEMA = Object.freeze([
  setting('showEndOfShowPanel', 'Panneau de fin de show', 'boolean', true, "Affiche le récap Match Impact dans l'écran de fin de show"),
  setting('onlyMyPromotion', 'Seulement ma promotion', 'boolean', true, 'Ignore les shows des autres promotions'),
  setting('trackPopularity', 'Suivre la popularité', 'boolean', true, 'Popularité dans les six régions'),
  setting('trackMomentumMorale', 'Suivre momentum et moral', 'boolean', true, 'Momentum et moral du contrat'),
  setting('trackCondition', 'Suivre la forme', 'boolean', true, 'Fatigue et endurance'),
  setting('trackSkills', 'Suivre le talent', 'boolean', true, 'Stats de talent, simples et détaillées'),
  setting('trackRelationships', 'Suivre les relations', 'boolean', true, "Relations entre lutteurs d'un même segment"),
  setting('minDelta', 'Écart minimum', 'number', 0.5, 'Les écarts plus petits sont ignorés', { min: 0, max: 10 }),
  setting('historySize', "Taille de l'historique", 'number', 20, 'Nombre de shows conservés', { min: 1, max: 100 }),
]);

const PORTS = Object.freeze({
  RosterReader: ['readRoster', 'readWorkers', 'readRelations', 'readCard', 'findLatestCompletedShow'],
  HistoryStore: ['load', 'save'],
  RecapView: ['showInSummary', 'showFloating'],
  Settings: ['get'],
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
